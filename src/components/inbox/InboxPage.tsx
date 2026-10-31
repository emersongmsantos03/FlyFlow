import {
  AlertTriangle, ArrowLeft, ChevronDown, Copy, Download, ExternalLink, Image as ImageIcon, Inbox as InboxIcon, Mail, MailOpen,
  Megaphone, Paperclip, PenLine, RefreshCw, Reply, Search, Send, Star, Tag, Users, X,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { Button, PageToolbar } from '../ui'
import { avatarTint, formatDateTime, slugify, webmailUrl } from '../../lib/format'
import type { Lead } from '../../types'
import { getDomainMailConnection } from '../../services/domainMail'
import {
  CONFIGURED_GOOGLE_OAUTH_CLIENT_ID, connectGoogleWorkspace, getGoogleWorkspaceConnection, getStoredGoogleOAuthClientId,
  listGoogleWorkspaceEmails, type GoogleMailboxMessage,
} from '../../services/googleWorkspace'
import {
  buildEmailDocument, dayGroupLabel, downloadGmailAttachment, formatFileSize, gmailFolders, gmailThreadUrl, hasRemoteImages,
  initialsOf, listGmailMessages, listTime, loadGmailThread, loadGmailUnread, parseAddress, readMailIds, trustImageSender, trustedImageSenders,
  type GmailAttachment, type GmailFolderId, type GmailListItem, type GmailThreadMessage,
} from '../../services/gmailInbox'

export type MailAccountKind = 'gmail' | 'domain'

export interface InboxReplyDraft {
  to: string
  displayName: string
  subject: string
  quoted: string
  via: MailAccountKind
  reply?: { threadId?: string; messageId?: string; references?: string }
}

const folderIcons: Record<string, ReactNode> = {
  primary: <InboxIcon size={16} />, inbox: <Mail size={16} />, unread: <MailOpen size={16} />, starred: <Star size={16} />,
  promotions: <Megaphone size={16} />, social: <Users size={16} />, updates: <Tag size={16} />, sent: <Send size={16} />,
}

const domainFolders = [{ id: 'inbox', label: 'Recebidos' }, { id: 'sent', label: 'Enviados' }] as const

/** Linha da lista, igual para Gmail e e-mail de domínio. */
interface Row {
  id: string
  threadId: string
  subject: string
  counterpart: string
  date: string
  snippet: string
  unread: boolean
  starred: boolean
  important: boolean
  sent: boolean
  hasAttachments: boolean
  domain?: GoogleMailboxMessage
}

const fromGmail = (item: GmailListItem): Row => ({ ...item, counterpart: item.sent ? item.to : item.from })
const fromDomain = (item: GoogleMailboxMessage): Row => ({
  id: item.id, threadId: item.threadId, subject: item.subject, counterpart: item.sent ? item.to : item.from, date: item.date,
  snippet: item.snippet, unread: item.unread, starred: false, important: false, sent: item.sent, hasAttachments: item.hasAttachments, domain: item,
})

const applyRead = (rows: Row[]) => {
  const read = readMailIds.get()
  return rows.map((row) => read.has(row.id) ? { ...row, unread: false } : row)
}

const quoteOf = (message: { date: string; from: string; text: string }) =>
  `\n\nEm ${message.date ? new Date(message.date).toLocaleString('pt-BR') : 'mensagem anterior'}, ${message.from} escreveu:\n${message.text.split('\n').map((line) => `> ${line}`).join('\n')}`

const replySubject = (subject: string) => (/^re:/i.test(subject) ? subject : `Re: ${subject || 'Sem assunto'}`)

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (/input|textarea|select/i.test(target.tagName) || target.isContentEditable)

export function InboxPage({ leads, companyEmail, googleClientId, connectionRevision, onOpenLead, onReply, onComposeNew }: {
  leads: Lead[]
  companyEmail: string
  googleClientId?: string
  connectionRevision: number
  onOpenLead: (lead: Lead) => void
  onReply: (draft: InboxReplyDraft) => void
  onComposeNew: (via: MailAccountKind) => void
}) {
  const [revision, setRevision] = useState(0)
  const gmail = useMemo(() => getGoogleWorkspaceConnection(), [connectionRevision, revision]) // eslint-disable-line react-hooks/exhaustive-deps
  const domain = useMemo(() => getDomainMailConnection(), [connectionRevision, revision]) // eslint-disable-line react-hooks/exhaustive-deps
  const [account, setAccount] = useState<MailAccountKind>(() => (getGoogleWorkspaceConnection().connected || !getDomainMailConnection().connected ? 'gmail' : 'domain'))
  const activeAccount: MailAccountKind = account === 'gmail' && !gmail.connected && domain.connected ? 'domain' : account === 'domain' && !domain.connected ? 'gmail' : account
  const accountEmail = activeAccount === 'gmail' ? gmail.email : domain.email
  const connected = activeAccount === 'gmail' ? gmail.connected : domain.connected

  const [folder, setFolder] = useState<string>('primary')
  const currentFolder = activeAccount === 'gmail'
    ? gmailFolders.find((item) => item.id === folder) ?? gmailFolders[0]
    : domainFolders.find((item) => item.id === folder) ?? domainFolders[0]
  const [rows, setRows] = useState<Row[]>([])
  const [nextPage, setNextPage] = useState('')
  const [unread, setUnread] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [crmOnly, setCrmOnly] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [mobileReading, setMobileReading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const leadByEmail = useMemo(() => new Map(leads.filter((lead) => lead.email).map((lead) => [lead.email.trim().toLowerCase(), lead])), [leads])
  const leadOf = useCallback((value: string) => leadByEmail.get(parseAddress(value).email), [leadByEmail])

  const load = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    setError('')
    try {
      if (activeAccount === 'gmail') {
        const [result, unreadCount] = await Promise.all([
          listGmailMessages({ folder: currentFolder.id as GmailFolderId, search }),
          loadGmailUnread().catch(() => null),
        ])
        const loaded = applyRead(result.messages.map(fromGmail))
        setRows(currentFolder.id === 'unread' ? loaded.filter((row) => row.unread) : loaded)
        setNextPage(result.nextPageToken)
        setUnread(unreadCount)
      } else {
        const result = await listGoogleWorkspaceEmails({ box: currentFolder.id as 'inbox' | 'sent', maxResults: 40, account: 'domain' })
        const loaded = applyRead(result.map(fromDomain))
        setRows(loaded)
        setNextPage('')
        setUnread(loaded.filter((row) => row.unread).length)
      }
    } catch (loadError) {
      setRows([])
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os e-mails.')
    } finally {
      setLoading(false)
    }
  }, [activeAccount, connected, currentFolder.id, search])

  useEffect(() => { void load() }, [load, connectionRevision])
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }) }, [activeAccount, folder, search])

  const loadMore = async () => {
    if (!nextPage || activeAccount !== 'gmail') return
    setLoadingMore(true)
    try {
      const result = await listGmailMessages({ folder: currentFolder.id as GmailFolderId, search, pageToken: nextPage })
      setRows((current) => [...current, ...applyRead(result.messages.map(fromGmail)).filter((row) => !current.some((item) => item.id === row.id))])
      setNextPage(result.nextPageToken)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar mais e-mails.')
    } finally {
      setLoadingMore(false)
    }
  }

  const visible = rows.filter((row) => {
    if (crmOnly && !leadOf(row.counterpart)) return false
    if (activeAccount === 'domain' && search) return slugify(`${row.subject} ${row.counterpart} ${row.snippet}`).includes(slugify(search))
    return true
  })
  const selected = visible.find((row) => row.id === selectedId) ?? (mobileReading ? undefined : visible[0])
  const crmCount = rows.filter((row) => leadOf(row.counterpart)).length

  const openRow = useCallback((row: Row) => {
    setSelectedId(row.id)
    setMobileReading(true)
    const opened = rows.filter((item) => item.unread && item.threadId === row.threadId).map((item) => item.id)
    if (!opened.length) return
    readMailIds.add(opened)
    setRows((current) => current.map((item) => opened.includes(item.id) ? { ...item, unread: false } : item))
    setUnread((current) => current === null ? current : Math.max(current - opened.length, 0))
  }, [rows])

  const selectIndex = useCallback((offset: number) => {
    const index = visible.findIndex((row) => row.id === selected?.id)
    const next = visible[Math.min(Math.max(index + offset, 0), visible.length - 1)]
    if (next) openRow(next)
  }, [openRow, selected?.id, visible])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'j' || event.key === 'ArrowDown') { event.preventDefault(); selectIndex(1) }
      if (event.key === 'k' || event.key === 'ArrowUp') { event.preventDefault(); selectIndex(-1) }
      if (event.key === '/') { event.preventDefault(); document.getElementById('mail-search')?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectIndex])

  const switchAccount = (next: MailAccountKind) => {
    setAccount(next)
    setFolder(next === 'gmail' ? 'primary' : 'inbox')
    setSelectedId('')
    setSearch('')
    setSearchDraft('')
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setSearch(searchDraft.trim())
    setSelectedId('')
  }

  if (!gmail.connected && !domain.connected) {
    return (
      <div className="mail-page module-page">
        <PageToolbar title="Inbox" description="Seus e-mails dentro do FlyFlow, ligados aos contatos do CRM." />
        <ConnectGmailCard clientId={googleClientId} companyEmail={companyEmail} onConnected={() => { setAccount('gmail'); setRevision((value) => value + 1) }} />
      </div>
    )
  }

  const groups: Array<{ label: string; rows: Row[] }> = []
  visible.forEach((row) => {
    const label = dayGroupLabel(row.date)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.rows.push(row)
    else groups.push({ label, rows: [row] })
  })

  return (
    <div className="mail-page module-page">
      <PageToolbar
        title="Inbox"
        description={activeAccount === 'gmail' ? 'Seu Gmail dentro do FlyFlow, com os contatos do CRM marcados.' : 'Caixa do e-mail de domínio, ligada aos contatos do CRM.'}
        action={<>
          <Button variant="secondary" type="button" disabled={loading} onClick={() => void load()}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar</Button>
          <Button type="button" onClick={() => onComposeNew(activeAccount)}><PenLine size={15} /> Escrever</Button>
        </>}
      />

      <section className={clsx('mail-shell', mobileReading && 'is-reading')}>
        <aside className="mail-sidebar">
          {gmail.connected && domain.connected ? (
            <div className="mail-accounts" role="tablist" aria-label="Conta">
              <button role="tab" aria-selected={activeAccount === 'gmail'} className={clsx(activeAccount === 'gmail' && 'is-active')} type="button" onClick={() => switchAccount('gmail')}><GmailMark /> Gmail</button>
              <button role="tab" aria-selected={activeAccount === 'domain'} className={clsx(activeAccount === 'domain' && 'is-active')} type="button" onClick={() => switchAccount('domain')} title={domain.email}><Mail size={14} /> Domínio</button>
            </div>
          ) : null}

          <nav className="mail-folders" aria-label="Pastas">
            {(activeAccount === 'gmail' ? gmailFolders : domainFolders).map((item) => {
              const count = activeAccount === 'gmail' ? (item.id === 'unread' ? unread : null) : item.id === 'inbox' ? unread : null
              return (
                <button key={item.id} className={clsx(currentFolder.id === item.id && 'is-active')} type="button" onClick={() => { setFolder(item.id); setSelectedId(''); setMobileReading(false) }}>
                  {folderIcons[item.id] ?? <Mail size={16} />}<span>{item.label}</span>{count ? <strong>{count > 999 ? '999+' : count}</strong> : null}
                </button>
              )
            })}
          </nav>

          <label className="mail-toggle">
            <input type="checkbox" checked={crmOnly} onChange={(event) => setCrmOnly(event.target.checked)} />
            <span><strong>Só contatos do CRM</strong><small>{crmCount} nesta lista</small></span>
          </label>

          {!gmail.connected ? <ConnectGmailCard compact clientId={googleClientId} companyEmail={companyEmail} onConnected={() => { setAccount('gmail'); setFolder('primary'); setRevision((value) => value + 1) }} /> : null}

          <div className="mail-account-card">
            <span className="avatar-chip" data-tint={avatarTint(accountEmail)}>{initialsOf(accountEmail)}</span>
            <div><small>{activeAccount === 'gmail' ? 'Gmail conectado' : 'E-mail de domínio'}</small><strong title={accountEmail}>{accountEmail}</strong></div>
            <a className="icon-button" href={activeAccount === 'gmail' ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(accountEmail)}` : webmailUrl(accountEmail || companyEmail)} target="_blank" rel="noreferrer" aria-label="Abrir no navegador" title="Abrir no navegador"><ExternalLink size={14} /></a>
          </div>
        </aside>

        <div className="mail-list-column">
          <header className="mail-list-header">
            <div>
              <h2>{currentFolder.label}</h2>
              <span>{loading ? 'Carregando…' : `${visible.length}${nextPage ? '+' : ''} conversa(s)${search ? ` para “${search}”` : ''}`}</span>
            </div>
          </header>
          <form className="mail-search" onSubmit={submitSearch}>
            <Search size={15} />
            <input id="mail-search" value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); if (activeAccount === 'domain') setSearch(event.target.value) }} placeholder={activeAccount === 'gmail' ? 'Buscar no Gmail (Enter)' : 'Buscar nesta caixa'} />
            {searchDraft ? <button type="button" aria-label="Limpar busca" onClick={() => { setSearchDraft(''); setSearch('') }}><X size={14} /></button> : null}
          </form>
          {error ? <p className="mail-error"><AlertTriangle size={15} /><span>{error}</span></p> : null}
          <div className="mail-list" ref={listRef}>
            {loading && !rows.length ? <div className="mail-skeleton">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div> : null}
            {groups.map((group) => (
              <div key={group.label} className="mail-group">
                <h3>{group.label}</h3>
                {group.rows.map((row) => {
                  const lead = leadOf(row.counterpart)
                  const person = parseAddress(row.counterpart)
                  return (
                    <button key={row.id} className={clsx('mail-row', selected?.id === row.id && 'is-active', row.unread && 'is-unread')} type="button" onClick={() => openRow(row)}>
                      <span className="avatar-chip" data-tint={avatarTint(person.email || row.counterpart)}>{initialsOf(row.counterpart)}</span>
                      <span className="mail-row__copy">
                        <span className="mail-row__meta"><strong>{row.sent ? `Para: ${person.name}` : person.name}</strong><time>{listTime(row.date)}</time></span>
                        <b>{row.subject || 'Sem assunto'}</b>
                        <small>{row.snippet || 'Sem prévia.'}</small>
                        {lead || row.hasAttachments || row.starred || row.important ? (
                          <span className="mail-row__badges">
                            {lead ? <em>CRM · {lead.companyName || lead.fullName || lead.email}</em> : null}
                            {row.starred ? <i className="is-star"><Star size={10} /></i> : null}
                            {row.important ? <i>Importante</i> : null}
                            {row.hasAttachments ? <i><Paperclip size={10} /> Anexo</i> : null}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            {!loading && !visible.length && !error ? (
              <div className="mail-empty">
                <InboxIcon size={30} />
                <strong>{search ? 'Nada encontrado' : crmOnly ? 'Nenhum contato do CRM aqui' : 'Caixa limpa'}</strong>
                <span>{search ? 'Tente outras palavras ou mude de pasta.' : crmOnly ? 'Desmarque o filtro para ver todos os e-mails.' : 'Nenhuma mensagem nesta pasta.'}</span>
              </div>
            ) : null}
            {nextPage && !crmOnly ? <div className="mail-more"><Button variant="secondary" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Carregando…' : 'Carregar mais'}</Button></div> : null}
          </div>
        </div>

        <div className="mail-reader">
          {selected ? (
            activeAccount === 'gmail'
              ? <GmailReader key={selected.threadId} row={selected} account={accountEmail} leadOf={leadOf} onOpenLead={onOpenLead} onReply={onReply} onBack={() => setMobileReading(false)} />
              : <DomainReader key={selected.id} row={selected} leadOf={leadOf} onOpenLead={onOpenLead} onReply={onReply} onBack={() => setMobileReading(false)} />
          ) : (
            <div className="mail-reader__empty"><Mail size={38} /><strong>Selecione uma conversa</strong><span>Use J e K para navegar e / para buscar.</span></div>
          )}
        </div>
      </section>
    </div>
  )
}

function GmailMark() {
  return <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M2 6.5v11A1.5 1.5 0 0 0 3.5 19H6V9.8l6 4.5 6-4.5V19h2.5a1.5 1.5 0 0 0 1.5-1.5v-11l-2.4 1.8L12 13 4.4 8.3 2 6.5Z" /><path fill="#EA4335" d="M6 9.8V19h0V9.8l6 4.5 6-4.5V5.5l-6 4.5-6-4.5Z" opacity=".9" /><path fill="#FBBC04" d="M18 5.5v4.3l4-3V6a1.5 1.5 0 0 0-2.4-1.2L18 5.5Z" /><path fill="#34A853" d="M2 6v.5l4 3.3V5.5L4.4 4.8A1.5 1.5 0 0 0 2 6Z" /></svg>
}

function ReaderHeader({ subject, lead, onOpenLead, onBack, children }: { subject: string; lead?: Lead; onOpenLead: (lead: Lead) => void; onBack: () => void; children: ReactNode }) {
  return (
    <header className="mail-reader__header">
      <button className="icon-button mail-back" type="button" aria-label="Voltar para a lista" onClick={onBack}><ArrowLeft size={16} /></button>
      <div className="mail-reader__title">
        <h2>{subject || 'Sem assunto'}</h2>
        {lead ? <button className="mail-lead-chip" type="button" onClick={() => onOpenLead(lead)}><Users size={12} /> {lead.companyName || lead.fullName || lead.email} · {lead.pipelineStage}</button> : <span className="mail-lead-chip is-muted">Fora do CRM</span>}
      </div>
      <div className="mail-reader__actions">{children}</div>
    </header>
  )
}

function GmailReader({ row, account, leadOf, onOpenLead, onReply, onBack }: {
  row: Row
  account: string
  leadOf: (value: string) => Lead | undefined
  onOpenLead: (lead: Lead) => void
  onReply: (draft: InboxReplyDraft) => void
  onBack: () => void
}) {
  const [messages, setMessages] = useState<GmailThreadMessage[] | null>(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    loadGmailThread(row.threadId)
      .then((thread) => {
        if (!active) return
        setMessages(thread)
        setExpanded(new Set([thread[thread.length - 1]?.id, ...thread.filter((message) => message.unread).map((message) => message.id)].filter(Boolean)))
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível abrir a conversa.') })
    return () => { active = false }
  }, [row.threadId])

  const last = messages?.[messages.length - 1]
  const counterpart = messages?.find((message) => !message.sent)?.from || row.counterpart
  const lead = leadOf(counterpart)

  const reply = (message: GmailThreadMessage) => {
    const target = message.sent ? message.to : message.from
    onReply({
      to: parseAddress(target).email,
      displayName: target,
      subject: replySubject(message.subject),
      quoted: quoteOf({ date: message.date, from: message.from, text: message.text || message.snippet }),
      via: 'gmail',
      reply: { threadId: message.threadId, messageId: message.messageId, references: message.references },
    })
  }

  return (
    <article className="mail-thread">
      <ReaderHeader subject={row.subject} lead={lead} onOpenLead={onOpenLead} onBack={onBack}>
        <a className="app-button app-button-ghost" href={gmailThreadUrl(account, row.threadId)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Gmail</a>
        <Button type="button" disabled={!last} onClick={() => last && reply(last)}><Reply size={15} /> Responder</Button>
      </ReaderHeader>
      {error ? <p className="mail-error"><AlertTriangle size={15} /><span>{error}</span></p> : null}
      {!messages && !error ? <div className="mail-skeleton is-reader"><span /><span /><span /></div> : null}
      <div className="mail-thread__messages">
        {messages?.map((message) => {
          const open = expanded.has(message.id)
          const toggle = () => setExpanded((current) => { const next = new Set(current); if (next.has(message.id)) next.delete(message.id); else next.add(message.id); return next })
          return (
            <section key={message.id} className={clsx('mail-message', open && 'is-open')}>
              <button className="mail-message__head" type="button" onClick={toggle} aria-expanded={open}>
                <span className="avatar-chip" data-tint={avatarTint(parseAddress(message.from).email)}>{initialsOf(message.from)}</span>
                <span className="mail-message__who">
                  <strong>{parseAddress(message.from).name}{message.sent ? <em>você</em> : null}</strong>
                  <small>{open ? `${parseAddress(message.from).email} → ${message.to}${message.cc ? ` · cc ${message.cc}` : ''}` : message.snippet}</small>
                </span>
                <time title={formatDateTime(message.date)}>{listTime(message.date)}</time>
                <ChevronDown size={15} className="mail-message__chevron" />
              </button>
              {open ? <>
                <EmailBody html={message.html} text={message.text || message.snippet} sender={parseAddress(message.from).email} />
                {message.attachments.length ? <Attachments items={message.attachments} /> : null}
                <div className="mail-message__foot"><Button variant="secondary" type="button" onClick={() => reply(message)}><Reply size={14} /> Responder</Button></div>
              </> : null}
            </section>
          )
        })}
      </div>
    </article>
  )
}

function DomainReader({ row, leadOf, onOpenLead, onReply, onBack }: {
  row: Row
  leadOf: (value: string) => Lead | undefined
  onOpenLead: (lead: Lead) => void
  onReply: (draft: InboxReplyDraft) => void
  onBack: () => void
}) {
  const message = row.domain!
  const lead = leadOf(row.counterpart)
  const person = parseAddress(row.counterpart)
  return (
    <article className="mail-thread">
      <ReaderHeader subject={row.subject} lead={lead} onOpenLead={onOpenLead} onBack={onBack}>
        <Button type="button" onClick={() => onReply({ to: person.email, displayName: row.counterpart, subject: replySubject(message.subject), quoted: quoteOf({ date: message.date, from: message.from, text: message.body || message.snippet }), via: 'domain' })}><Reply size={15} /> Responder</Button>
      </ReaderHeader>
      <div className="mail-thread__messages">
        <section className="mail-message is-open">
          <div className="mail-message__head">
            <span className="avatar-chip" data-tint={avatarTint(person.email)}>{initialsOf(row.counterpart)}</span>
            <span className="mail-message__who"><strong>{person.name}</strong><small>{message.sent ? `Para: ${message.to}` : `De: ${message.from}`}</small></span>
            <time>{message.date ? formatDateTime(new Date(message.date).toISOString()) : ''}</time>
          </div>
          <EmailBody html="" text={message.body || message.snippet} sender={person.email} />
          {message.hasAttachments ? <p className="mail-note"><Paperclip size={14} /> Esta mensagem tem anexos. Abra o webmail para baixar.</p> : null}
        </section>
      </div>
    </article>
  )
}

function EmailBody({ html, text, sender }: { html: string; text: string; sender: string }) {
  const remote = hasRemoteImages(html)
  const [allowImages, setAllowImages] = useState(() => trustedImageSenders().has(sender))
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(120)
  const doc = useMemo(() => buildEmailDocument({ html, text }, allowImages), [allowImages, html, text])

  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    let observer: ResizeObserver | undefined
    const measure = () => {
      const body = element.contentDocument?.documentElement
      if (body) setHeight(Math.min(Math.max(body.scrollHeight + 8, 60), 20_000))
    }
    const onLoad = () => {
      // Newsletters têm largura fixa: reduz para caber na coluna em vez de cortar.
      const root = element.contentDocument?.documentElement
      if (root && root.scrollWidth > root.clientWidth) root.style.zoom = String(Math.max(root.clientWidth / root.scrollWidth, 0.5))
      measure()
      const body = element.contentDocument?.body
      if (body && 'ResizeObserver' in window) {
        observer = new ResizeObserver(measure)
        observer.observe(body)
      }
    }
    element.addEventListener('load', onLoad)
    return () => { element.removeEventListener('load', onLoad); observer?.disconnect() }
  }, [doc])

  return <>
    {remote && !allowImages ? (
      <div className="mail-images-banner">
        <ImageIcon size={14} /><span>Imagens externas bloqueadas para proteger sua privacidade.</span>
        <button type="button" onClick={() => setAllowImages(true)}>Mostrar</button>
        {sender ? <button type="button" onClick={() => { trustImageSender(sender); setAllowImages(true) }}>Sempre deste remetente</button> : null}
      </div>
    ) : null}
    <div className="mail-body">
      {/* Sem allow-scripts: nada do e-mail executa. allow-same-origin só serve para medir a altura. */}
      <iframe ref={frame} title="Conteúdo do e-mail" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} style={{ height }} />
    </div>
  </>
}

function Attachments({ items }: { items: GmailAttachment[] }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="mail-attachments">
      {items.map((item) => (
        <button key={item.attachmentId} type="button" disabled={busy === item.attachmentId} onClick={() => {
          setBusy(item.attachmentId)
          setError('')
          void downloadGmailAttachment(item).catch((downloadError) => setError(downloadError instanceof Error ? downloadError.message : 'Falha ao baixar.')).finally(() => setBusy(''))
        }}>
          <span className="mail-attachments__ext">{(item.filename.split('.').pop() || 'arq').slice(0, 4).toUpperCase()}</span>
          <span><strong title={item.filename}>{item.filename}</strong><small>{formatFileSize(item.size)}</small></span>
          <Download size={14} />
        </button>
      ))}
      {error ? <p className="mail-error"><AlertTriangle size={14} /><span>{error}</span></p> : null}
    </div>
  )
}

function ConnectGmailCard({ clientId, companyEmail, compact, onConnected }: { clientId?: string; companyEmail: string; compact?: boolean; onConnected: () => void }) {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const effectiveClientId = CONFIGURED_GOOGLE_OAUTH_CLIENT_ID || clientId?.trim() || getStoredGoogleOAuthClientId()
  const origin = window.location.origin

  const connect = async () => {
    setConnecting(true)
    setError('')
    try {
      await connectGoogleWorkspace(effectiveClientId)
      onConnected()
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Não foi possível conectar o Gmail.')
    } finally {
      setConnecting(false)
    }
  }

  const help = (
    <details className="mail-oauth-help" open={Boolean(error)}>
      <summary>O Google mostrou “origin_mismatch” ou “redirect_uri_mismatch”?</summary>
      <p>No Google Cloud, abra APIs e serviços → Credenciais → cliente OAuth do FlyFlow e adicione este endereço em <b>Origens JavaScript autorizadas</b> e em <b>URIs de redirecionamento autorizados</b>. Salve, espere uns 5 minutos e tente de novo.</p>
      <button type="button" className="mail-origin" onClick={() => { void navigator.clipboard?.writeText(origin); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }}>
        <code>{origin}</code><Copy size={13} />{copied ? <small>copiado</small> : null}
      </button>
    </details>
  )

  if (compact) {
    return (
      <div className="mail-connect is-compact">
        <strong><GmailMark /> Ver também o Gmail</strong>
        <Button variant="secondary" type="button" disabled={connecting || !effectiveClientId} onClick={() => void connect()}>{connecting ? 'Conectando…' : 'Conectar Gmail'}</Button>
        {error ? <p className="mail-error"><AlertTriangle size={14} /><span>{error}</span></p> : null}
        {help}
      </div>
    )
  }

  return (
    <div className="mail-connect">
      <div className="mail-connect__art"><GmailMark /></div>
      <h2>Traga seu Gmail para o FlyFlow</h2>
      <p>Leia as conversas, veja quem é contato do CRM e responda sem trocar de aba. O FlyFlow só lê e envia: nada é apagado ou arquivado no seu Gmail.</p>
      <ul>
        <li><InboxIcon size={14} /> Principal, Promoções, Social e não lidos</li>
        <li><Users size={14} /> Leads do CRM destacados na lista</li>
        <li><Paperclip size={14} /> Anexos e conversas completas</li>
      </ul>
      <div className="mail-connect__actions">
        <Button type="button" disabled={connecting || !effectiveClientId} onClick={() => void connect()}>{connecting ? 'Abrindo o Google…' : 'Conectar Gmail'}</Button>
        <a className="app-button app-button-secondary" href={webmailUrl(companyEmail)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir webmail</a>
      </div>
      {!effectiveClientId ? <p className="mail-error"><AlertTriangle size={14} /><span>Falta o OAuth Client ID do Google em Configurações.</span></p> : null}
      {error ? <p className="mail-error"><AlertTriangle size={14} /><span>{error}</span></p> : null}
      {help}
    </div>
  )
}
