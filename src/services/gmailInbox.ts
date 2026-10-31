import { gmailApi, repairTextEncoding } from './googleWorkspace'

/** Pastas do Gmail mostradas no Inbox. `q` usa a mesma sintaxe da busca do Gmail. */
export const gmailFolders = [
  { id: 'primary', label: 'Principal', q: 'in:inbox category:primary' },
  { id: 'inbox', label: 'Todos recebidos', q: 'in:inbox' },
  { id: 'unread', label: 'Não lidos', q: 'in:inbox is:unread' },
  { id: 'starred', label: 'Com estrela', q: 'is:starred' },
  { id: 'promotions', label: 'Promoções', q: 'in:inbox category:promotions' },
  { id: 'social', label: 'Social', q: 'in:inbox category:social' },
  { id: 'updates', label: 'Atualizações', q: 'in:inbox category:updates' },
  { id: 'sent', label: 'Enviados', q: 'in:sent' },
] as const

export type GmailFolderId = (typeof gmailFolders)[number]['id']

export interface GmailListItem {
  id: string
  threadId: string
  subject: string
  from: string
  to: string
  date: string
  snippet: string
  unread: boolean
  starred: boolean
  important: boolean
  sent: boolean
  hasAttachments: boolean
}

export interface GmailAttachment {
  attachmentId: string
  messageId: string
  filename: string
  mimeType: string
  size: number
}

export interface GmailThreadMessage {
  id: string
  threadId: string
  /** Cabeçalho Message-ID, usado para responder na mesma conversa. */
  messageId: string
  references: string
  subject: string
  from: string
  to: string
  cc: string
  date: string
  snippet: string
  text: string
  html: string
  unread: boolean
  sent: boolean
  attachments: GmailAttachment[]
}

type Header = { name: string; value: string }
type Part = {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: Header[]
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: Part[]
}
type RawMessage = { id: string; threadId: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: Part }

const headerMap = (headers: Header[] = []) => new Map(headers.map((header) => [header.name.toLowerCase(), header.value]))

const decodeEntities = (value: string) => {
  if (!value.includes('&')) return value
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

export const base64UrlToBytes = (value = '') => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const charsetOf = (part: Part) => headerMap(part.headers).get('content-type')?.match(/charset="?([^";\s]+)"?/i)?.[1]?.toLowerCase() || 'utf-8'

const decodePart = (part: Part) => {
  if (!part.body?.data) return ''
  const bytes = base64UrlToBytes(part.body.data)
  try {
    return new TextDecoder(charsetOf(part)).decode(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

const flatten = (part?: Part): Part[] => part ? [part, ...(part.parts || []).flatMap(flatten)] : []

const messageDate = (headers: Map<string, string>, internalDate?: string) => {
  const parsed = internalDate ? new Date(Number(internalDate)) : new Date(headers.get('date') || '')
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

const mapListItem = (message: RawMessage): GmailListItem => {
  const headers = headerMap(message.payload?.headers)
  const labels = message.labelIds || []
  return {
    id: message.id,
    threadId: message.threadId,
    subject: repairTextEncoding(headers.get('subject') || ''),
    from: repairTextEncoding(headers.get('from') || ''),
    to: repairTextEncoding(headers.get('to') || ''),
    date: messageDate(headers, message.internalDate),
    snippet: decodeEntities(message.snippet || ''),
    unread: labels.includes('UNREAD'),
    starred: labels.includes('STARRED'),
    important: labels.includes('IMPORTANT'),
    sent: labels.includes('SENT'),
    // No formato de metadados não vêm as partes; multipart/mixed é o sinal de anexo.
    hasAttachments: /multipart\/mixed/i.test(message.payload?.mimeType || ''),
  }
}

const mapWithConcurrency = async <T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) => {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

export const listGmailMessages = async (input: { folder: GmailFolderId; search?: string; pageToken?: string; maxResults?: number }) => {
  const folder = gmailFolders.find((item) => item.id === input.folder) ?? gmailFolders[0]
  const params = new URLSearchParams({
    maxResults: String(input.maxResults ?? 25),
    q: [folder.q, input.search?.trim()].filter(Boolean).join(' '),
  })
  if (input.pageToken) params.set('pageToken', input.pageToken)
  const list = await gmailApi<{ messages?: Array<{ id: string }>; nextPageToken?: string; resultSizeEstimate?: number }>(`messages?${params}`)
  const metadata = 'format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date'
  const messages = await mapWithConcurrency(list.messages || [], 6, async ({ id }) =>
    mapListItem(await gmailApi<RawMessage>(`messages/${encodeURIComponent(id)}?${metadata}`)))
  return { messages, nextPageToken: list.nextPageToken || '', estimate: list.resultSizeEstimate ?? messages.length }
}

export const loadGmailUnread = async () => {
  const [label, list] = await Promise.all([
    gmailApi<{ messagesUnread?: number; threadsUnread?: number }>('labels/INBOX'),
    gmailApi<{ messages?: Array<{ id: string }> }>(`messages?${new URLSearchParams({ q: 'in:inbox is:unread', maxResults: '500' })}`),
  ])
  const read = readMailIds.get()
  return Math.max((label.messagesUnread ?? 0) - (list.messages || []).filter(({ id }) => read.has(id)).length, 0)
}

const MAX_INLINE_BYTES = 1_500_000

/** Conversa completa, com HTML e imagens embutidas (cid:) já resolvidas. */
export const loadGmailThread = async (threadId: string): Promise<GmailThreadMessage[]> => {
  const thread = await gmailApi<{ messages?: RawMessage[] }>(`threads/${encodeURIComponent(threadId)}?format=full`)
  return Promise.all((thread.messages || []).map(async (message) => {
    const headers = headerMap(message.payload?.headers)
    const parts = flatten(message.payload)
    const textPart = parts.find((part) => part.mimeType === 'text/plain' && !part.filename && part.body?.data)
    const htmlPart = parts.find((part) => part.mimeType === 'text/html' && !part.filename && part.body?.data)
    let html = htmlPart ? decodePart(htmlPart) : ''
    const inline = parts.filter((part) => {
      const contentId = headerMap(part.headers).get('content-id')
      return contentId && part.mimeType?.startsWith('image/') && html.includes(`cid:${contentId.replace(/[<>]/g, '')}`)
    })
    await Promise.all(inline.slice(0, 8).map(async (part) => {
      const contentId = (headerMap(part.headers).get('content-id') || '').replace(/[<>]/g, '')
      let data = part.body?.data
      if (!data && part.body?.attachmentId && (part.body.size ?? 0) <= MAX_INLINE_BYTES) {
        data = (await gmailApi<{ data?: string }>(`messages/${message.id}/attachments/${part.body.attachmentId}`).catch(() => ({ data: '' }))).data
      }
      if (data) html = html.split(`cid:${contentId}`).join(`data:${part.mimeType};base64,${data.replace(/-/g, '+').replace(/_/g, '/')}`)
    }))
    const inlineIds = new Set(inline.map((part) => part.partId))
    const labels = message.labelIds || []
    return {
      id: message.id,
      threadId: message.threadId,
      messageId: headers.get('message-id') || '',
      references: headers.get('references') || '',
      subject: repairTextEncoding(headers.get('subject') || ''),
      from: repairTextEncoding(headers.get('from') || ''),
      to: repairTextEncoding(headers.get('to') || ''),
      cc: repairTextEncoding(headers.get('cc') || ''),
      date: messageDate(headers, message.internalDate),
      snippet: decodeEntities(message.snippet || ''),
      text: textPart ? decodePart(textPart) : '',
      html,
      unread: labels.includes('UNREAD'),
      sent: labels.includes('SENT'),
      attachments: parts
        .filter((part) => part.filename && part.body?.attachmentId && !inlineIds.has(part.partId))
        .map((part) => ({ attachmentId: part.body!.attachmentId!, messageId: message.id, filename: part.filename!, mimeType: part.mimeType || 'application/octet-stream', size: part.body?.size ?? 0 })),
    }
  }))
}

export const downloadGmailAttachment = async (attachment: GmailAttachment) => {
  const result = await gmailApi<{ data?: string }>(`messages/${attachment.messageId}/attachments/${attachment.attachmentId}`)
  const blob = new Blob([base64UrlToBytes(result.data)], { type: attachment.mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ------------------------------------------------------------ apresentação

export const parseAddress = (value: string) => {
  const email = (value.match(/<([^>]+)>/)?.[1] || value.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || '').toLowerCase()
  const name = value.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim() || ''
  return { email, name: name || email.split('@')[0] || value.trim() }
}

export const initialsOf = (value: string) => {
  const { name } = parseAddress(value)
  return name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

/** Rótulo do grupo na lista: Hoje, Ontem, Esta semana, ou o mês. */
export const dayGroupLabel = (iso: string, now = new Date()) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  if (dayKey(date) === dayKey(now)) return 'Hoje'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(date) === dayKey(yesterday)) return 'Ontem'
  const days = (now.getTime() - date.getTime()) / 86_400_000
  if (days < 7) return 'Esta semana'
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString('pt-BR', { month: 'long' }).replace(/^./, (letter) => letter.toUpperCase())
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (letter) => letter.toUpperCase())
}

/** Hora para hoje, dia e mês para o resto do ano. */
export const listTime = (iso: string, now = new Date()) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (dayKey(date) === dayKey(now)) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('pt-BR', date.getFullYear() === now.getFullYear() ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export const textToHtml = (text: string) =>
  escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, '<br>')

export const hasRemoteImages = (html: string) => /<img[^>]+src\s*=\s*["']?\s*https?:|url\(\s*["']?https?:/i.test(html)

/**
 * Documento isolado para o iframe do leitor. Scripts nunca rodam (sandbox e CSP);
 * imagens externas só carregam quando a pessoa libera, porque denunciam a leitura.
 */
export const buildEmailDocument = (input: { html: string; text: string }, allowRemoteImages: boolean) => {
  const body = (input.html || textToHtml(input.text) || '<p style="color:#7c7e85">Mensagem sem conteúdo.</p>')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<meta[^>]+http-equiv[^>]*>/gi, '')
  const images = allowRemoteImages ? 'data: https: http:' : 'data:'
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${images}; style-src 'unsafe-inline'${allowRemoteImages ? ' https:' : ''}; font-src data:${allowRemoteImages ? ' https:' : ''}">
<base target="_blank">
<style>
html,body{margin:0;padding:0;background:#fff;color:#1e1f24}
body{font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;padding:4px 2px;overflow-wrap:anywhere}
img{max-width:100%;height:auto}
table{max-width:100%}
a{color:#2868ad}
blockquote{margin:0 0 0 .6em;padding-left:.8em;border-left:3px solid #e5e4df;color:#54565d}
pre{white-space:pre-wrap}
</style></head><body>${body}</body></html>`
}

export const MAIL_STATE_EVENT = 'flyflow-mail-state'

const mailIdStore = (key: string) => ({
  get: () => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(key) || '[]'))
    } catch {
      return new Set<string>()
    }
  },
  add(ids: string[]) {
    const stored = new Set([...this.get(), ...ids])
    localStorage.setItem(key, JSON.stringify([...stored].slice(-2000)))
    window.dispatchEvent(new Event(MAIL_STATE_EVENT))
  },
})

/**
 * A conexão com o Gmail é só leitura, então o FlyFlow guarda neste navegador o que já foi tratado.
 * `readMailIds`: e-mails abertos no Inbox. `notifiedMailIds`: avisos já vistos no sino, que continuam não lidos no Inbox.
 */
export const readMailIds = mailIdStore('flyflow.inbox.read-messages')
export const notifiedMailIds = mailIdStore('flyflow.inbox.notified-messages')

const IMAGE_SENDERS_KEY = 'flyflow.inbox.trusted-image-senders'

export const trustedImageSenders = () => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(IMAGE_SENDERS_KEY) || '[]'))
  } catch {
    return new Set<string>()
  }
}

export const trustImageSender = (email: string) => {
  const senders = trustedImageSenders()
  senders.add(email.toLowerCase())
  localStorage.setItem(IMAGE_SENDERS_KEY, JSON.stringify([...senders].slice(-300)))
}

export const gmailThreadUrl = (account: string, threadId: string) =>
  `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#all/${encodeURIComponent(threadId)}`
