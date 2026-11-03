import { describe, expect, it } from 'vitest'
import { dotStuff, handleMailRequest, listMail, openAccount, readMail, sealAccount, sendMail, validateAccount, verifyAccount, type Dial, type MailSocket, type StoredAccount } from './mail'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Servidor falso: recebe cada linha do cliente e devolve o que responder. */
type Script = (line: string, state: { raw: string[]; tls: boolean }) => string | string[] | null
const dialWith = (scripts: { smtp: Script; imap: Script }, log: string[] = []): Dial => (_host, port, tls) => {
  const isSmtp = port === 465 || port === 587
  const script = isSmtp ? scripts.smtp : scripts.imap
  const state = { raw: [] as string[], tls: tls === 'on' }
  const make = (greeting?: string): MailSocket => {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const send = (reply: string | string[] | null) => { if (reply !== null) controller.enqueue(encoder.encode([reply].flat().map((line) => `${line}\r\n`).join(''))) }
    const readable = new ReadableStream<Uint8Array>({ start(value) { controller = value; if (greeting) send(greeting) } })
    let pending = ''
    let literal = 0
    let literalTag = ''
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        pending += decoder.decode(chunk)
        for (;;) {
          if (literal) {
            if (pending.length < literal + 2) return
            state.raw.push(pending.slice(0, literal)); pending = pending.slice(literal + 2); literal = 0
            send(`${literalTag} OK APPEND concluído`)
            continue
          }
          const index = pending.indexOf('\r\n')
          if (index < 0) return
          const line = pending.slice(0, index)
          pending = pending.slice(index + 2)
          log.push(`${isSmtp ? 'smtp' : 'imap'}> ${line}`)
          const size = line.match(/\{(\d+)\}$/)
          send(script(line, state))
          if (size) { literal = Number(size[1]); literalTag = line.split(' ')[0]; send('+ go') }
        }
      },
    })
    return { readable, writable, close: () => { try { controller.close() } catch { /* fechado */ } }, startTls: () => { state.tls = true; return make() } }
  }
  return make(isSmtp ? '220 smtp.umbler.com ESMTP' : '* OK IMAP pronto')
}

const account: StoredAccount = {
  email: 'contato@herodrone.com.br', name: 'Hero Drone',
  smtp: { host: 'smtp.umbler.com', port: 587, user: 'contato@herodrone.com.br', pass: 'segredo' },
  imap: { host: 'imap.umbler.com', port: 993, user: 'contato@herodrone.com.br', pass: 'segredo' },
}

const message = (subject: string, from: string, body: string) => [
  `From: ${from}`, 'To: contato@herodrone.com.br', `Subject: ${subject}`, 'Date: Mon, 02 Nov 2026 17:05:00 -0300', 'Content-Type: text/plain; charset=utf-8', '', body, '',
].join('\r\n')

const imapServer = (messages: string[], sentFolder = 'INBOX.Sent'): Script => (line) => {
  const [tag, command, ...rest] = line.split(' ')
  switch (command?.toUpperCase()) {
    case 'LOGIN': return rest.join(' ').includes('"segredo"') ? `${tag} OK logado` : `${tag} NO [AUTHENTICATIONFAILED] senha`
    case 'LIST': return [`* LIST (\\HasNoChildren) "." "INBOX"`, `* LIST (\\HasNoChildren \\Sent) "." "${sentFolder}"`, `${tag} OK LIST`]
    case 'EXAMINE': return [`* ${messages.length} EXISTS`, '* OK [UIDVALIDITY 777] ok', `${tag} OK [READ-ONLY] EXAMINE`]
    case 'FETCH':
    case 'UID': {
      const out: string[] = []
      messages.forEach((source, index) => {
        if (command.toUpperCase() === 'UID' && rest[1] !== String(100 + index)) return
        out.push(`* ${index + 1} FETCH (UID ${100 + index} FLAGS (${index === 0 ? '\\Seen' : ''}) BODY[]<0> {${encoder.encode(source).length}}`)
        out.push(`${source})`)
      })
      return [...out, `${tag} OK FETCH`]
    }
    case 'APPEND': return null
    case 'LOGOUT': return ['* BYE', `${tag} OK`]
    default: return `${tag} BAD ${command}`
  }
}

const smtpServer = (log: string[]): Script => {
  let data = false
  let body = ''
  return (line, state) => {
    if (data) {
      if (line === '.') { data = false; log.push(`DATA:${body}`); return '250 2.0.0 Ok: queued' }
      body += `${line}\n`
      return null
    }
    if (/^EHLO/i.test(line)) return state.tls ? ['250-smtp.umbler.com', '250 AUTH PLAIN LOGIN'] : ['250-smtp.umbler.com', '250-STARTTLS', '250 AUTH PLAIN LOGIN']
    if (line === 'STARTTLS') return '220 Ready'
    if (line.startsWith('AUTH PLAIN')) return atob(line.slice(11)).endsWith('\0segredo') ? '235 ok' : '535 auth'
    if (line.startsWith('MAIL FROM')) return '250 ok'
    if (line.startsWith('RCPT TO')) return line.includes('recusado@') ? '550 nope' : '250 ok'
    if (line === 'DATA') { data = true; return '354 go' }
    if (line === 'QUIT') return '221 bye'
    return '500 ?'
  }
}

describe('validateAccount', () => {
  it('aceita a Umbler e mantém a senha anterior quando o servidor não muda', () => {
    const next = validateAccount({ email: 'contato@herodrone.com.br', smtp: { host: 'smtp.umbler.com', port: 587, user: 'contato@herodrone.com.br' }, imap: { host: 'imap.umbler.com', port: 993, user: 'contato@herodrone.com.br' } }, account)
    expect(next.smtp.pass).toBe('segredo')
  })
  it('não reaproveita a senha para outro servidor', () => {
    expect(() => validateAccount({ email: 'contato@herodrone.com.br', smtp: { host: 'smtp.outro.com', port: 587 }, imap: { host: 'imap.umbler.com', port: 993 } }, account)).toThrow(/senha SMTP/)
  })
  it('recusa IP literal, porta errada e e-mail inválido', () => {
    expect(() => validateAccount({ email: 'x@y.com', smtp: { host: '10.0.0.1', port: 587, pass: 'a' }, imap: { host: 'imap.y.com', port: 993, pass: 'a' } })).toThrow(/servidor/)
    expect(() => validateAccount({ email: 'x@y.com', smtp: { host: 'smtp.y.com', port: 25, pass: 'a' }, imap: { host: 'imap.y.com', port: 993, pass: 'a' } })).toThrow(/Porta/)
    expect(() => validateAccount({ email: 'nada' })).toThrow(/e-mail/)
  })
})

describe('credenciais cifradas', () => {
  it('abre só com a mesma chave', async () => {
    const sealed = await sealAccount('chave-1', account)
    expect(sealed).not.toContain('segredo')
    expect((await openAccount('chave-1', sealed))?.imap.pass).toBe('segredo')
    expect(await openAccount('chave-2', sealed)).toBeUndefined()
  })
})

describe('IMAP', () => {
  const inbox = [message('Orçamento', 'Janaina <janaina@example.com>', 'Tenho interesse'), message('Outro', 'cliente@example.com', 'Olá\r\n.linha com ponto')]

  it('lista a caixa de entrada com remetente, assunto, corpo e lido/não lido', async () => {
    const result = await listMail(dialWith({ smtp: smtpServer([]), imap: imapServer(inbox) }), account, 'inbox', 30)
    expect(result).toHaveLength(2)
    const janaina = result.find((item) => item.subject === 'Orçamento')!
    expect(janaina.from).toBe('Janaina <janaina@example.com>')
    expect(janaina.body).toBe('Tenho interesse')
    expect(janaina.unread).toBe(false)
    expect(janaina.id).toBe('INBOX:777:100')
    expect(result.find((item) => item.subject === 'Outro')!.unread).toBe(true)
  })

  it('abre uma mensagem pelo id', async () => {
    const opened = await readMail(dialWith({ smtp: smtpServer([]), imap: imapServer(inbox) }), account, 'INBOX:777:101')
    expect(opened.subject).toBe('Outro')
  })

  it('não abre pasta fora de Entrada/Enviados', async () => {
    await expect(readMail(dialWith({ smtp: smtpServer([]), imap: imapServer(inbox) }), account, 'Lixo:777:101')).rejects.toThrow(/Pasta/)
  })

  it('senha errada vira erro 400 legível', async () => {
    await expect(listMail(dialWith({ smtp: smtpServer([]), imap: imapServer(inbox) }), { ...account, imap: { ...account.imap, pass: 'errada' } }, 'inbox', 30)).rejects.toMatchObject({ status: 400 })
  })
})

describe('SMTP', () => {
  it('verifica a conta com STARTTLS na 587 e envia com cópia em Enviados', async () => {
    const log: string[] = []
    const dial = dialWith({ smtp: smtpServer(log), imap: imapServer([]) }, log)
    await verifyAccount(dial, account)
    expect(log).toContain('smtp> STARTTLS')
    const raw = btoa('To: cliente@example.com\r\nSubject: Oi\r\nContent-Type: text/plain\r\n\r\n.começa com ponto\r\nfim')
    const result = await sendMail(dial, account, { to: ['cliente@example.com', 'recusado@example.com'], raw })
    expect(result.warning).toMatch(/recusados/)
    const data = log.find((line) => line.startsWith('DATA:'))!
    expect(data).toContain('From: "Hero Drone" <contato@herodrone.com.br>')
    expect(data).toContain('\n..')
    expect(log.some((line) => /APPEND "INBOX.Sent" \(\\Seen\) \{\d+\}/.test(line))).toBe(true)
  })

  it('recusa From forjado no corpo', async () => {
    await expect(sendMail(dialWith({ smtp: smtpServer([]), imap: imapServer([]) }), account, { to: ['a@b.com'], raw: btoa('From: outro@x.com\r\n\r\noi') })).rejects.toThrow(/remetente/)
  })

  it('faz dot-stuffing', () => {
    expect(decoder.decode(dotStuff(encoder.encode('a\r\n.b\n.c')))).toBe('a\r\n..b\r\n..c\r\n')
  })
})

describe('rotas', () => {
  const kv = () => {
    const store = new Map<string, string>()
    return { get: async (key: string) => store.get(key) ?? null, put: async (key: string, value: string) => { store.set(key, value) }, delete: async (key: string) => { store.delete(key) }, store } as unknown as KVNamespace & { store: Map<string, string> }
  }
  it('salva, devolve sem senha e desconecta', async () => {
    const env = { GOOGLE_OAUTH: kv(), MAIL_ENCRYPTION_KEY: 'k' }
    const dial = dialWith({ smtp: smtpServer([]), imap: imapServer([]) })
    const empty = await handleMailRequest(new Request('https://w/mail/account'), env, 'ws1', dial)
    expect(empty.body).toEqual({ connected: false, email: '' })
    const saved = await handleMailRequest(new Request('https://w/mail/account', { method: 'POST', body: JSON.stringify(account) }), env, 'ws1', dial)
    expect(saved.status).toBe(200)
    expect(JSON.stringify(saved.body)).not.toContain('segredo')
    expect([...(env.GOOGLE_OAUTH as unknown as { store: Map<string, string> }).store.values()].join()).not.toContain('segredo')
    const again = await handleMailRequest(new Request('https://w/mail/account'), env, 'ws1', dial)
    expect(again.body).toMatchObject({ connected: true, email: 'contato@herodrone.com.br' })
    expect((await handleMailRequest(new Request('https://w/mail/account'), env, 'outro', dial)).body).toMatchObject({ connected: false })
    await handleMailRequest(new Request('https://w/mail/account', { method: 'DELETE' }), env, 'ws1', dial)
    expect((await handleMailRequest(new Request('https://w/mail/account'), env, 'ws1', dial)).body).toMatchObject({ connected: false })
  })
})

describe('diagnóstico', () => {
  it('mostra a etapa e o motivo quando a conexão cai, testando SMTP e IMAP', async () => {
    const dial: Dial = (host, port) => { throw new Error(`proxy request failed, cannot connect to ${host}:${port}`) }
    await expect(verifyAccount(dial, account)).rejects.toThrow(/SMTP smtp\.umbler\.com:587: proxy request failed.*IMAP imap\.umbler\.com:993: proxy request failed/)
  })
})
