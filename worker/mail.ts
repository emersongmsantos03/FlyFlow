/**
 * E-mail com domínio próprio (ex.: contato@herodrone.com.br na Umbler) direto do Worker.
 *
 * Substitui a Cloud Function `mailApi`, que nunca foi publicada: o Worker abre
 * as conexões IMAP (ler) e SMTP (enviar) com `cloudflare:sockets`, sempre com TLS.
 * As credenciais ficam no KV cifradas com AES-GCM e nunca voltam para o navegador.
 */
import PostalMime from 'postal-mime'

export type Tls = 'on' | 'starttls'
export interface MailSocket {
  readable: ReadableStream<Uint8Array>
  writable: WritableStream<Uint8Array>
  startTls(): MailSocket
  close(): Promise<void> | void
}
export type Dial = (host: string, port: number, tls: Tls) => MailSocket | Promise<MailSocket>

export interface ServerConfig { host: string; port: number; user: string; pass: string }
export interface StoredAccount { email: string; name: string; smtp: ServerConfig; imap: ServerConfig }
export interface MailMessage {
  id: string; threadId: string; subject: string; from: string; to: string; date: string
  body: string; snippet: string; unread: boolean; sent: boolean; hasAttachments: boolean; truncated?: boolean
}

export class MailError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
const fail = (message: string, status = 400): never => { throw new MailError(message, status) }

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;"]+@[^\s<>@,;"]+\.[^\s<>@,;"]+$/.test(value)
const latin1 = (bytes: Uint8Array) => { let out = ''; for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192)); return out }
const fromLatin1 = (text: string) => Uint8Array.from(text, (character) => character.charCodeAt(0) & 255)
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}
const base64 = (bytes: Uint8Array) => btoa(latin1(bytes))
const fromBase64 = (value: string) => fromLatin1(atob(value))

// ---------------------------------------------------------------------------
// Validação da conta
// ---------------------------------------------------------------------------

export function validateAccount(input: unknown, previous?: StoredAccount): StoredAccount {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  if (!isEmail(body.email)) fail('Informe um endereço de e-mail válido.')
  const email = String(body.email).trim()
  const result = { email, name: String(body.name || '').replace(/[\r\n]/g, '').slice(0, 120) } as StoredAccount
  for (const protocol of ['smtp', 'imap'] as const) {
    const config = (body[protocol] && typeof body[protocol] === 'object' ? body[protocol] : {}) as Record<string, unknown>
    const port = Number(config.port)
    if (!(protocol === 'smtp' ? [465, 587] : [993, 143]).includes(port)) fail(`Porta ${protocol.toUpperCase()} inválida.`)
    const host = String(config.host || '').trim().toLowerCase()
    // Só nomes de domínio: IP literal ou nome sem ponto não são aceitos.
    if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || !host.includes('.') || /^[\d.]+$/.test(host) || host.endsWith('.local') || host.endsWith('.internal')) {
      fail('Informe o servidor do provedor.')
    }
    const user = String(config.user || email).trim()
    const sameServer = previous?.[protocol]?.host === host && previous?.[protocol]?.user === user
    const pass = typeof config.pass === 'string' && config.pass ? config.pass : sameServer ? previous?.[protocol]?.pass : ''
    if (!user || user.length > 254 || /[\r\n]/.test(user) || typeof pass !== 'string' || !pass || pass.length > 1024 || /[\r\n\0]/.test(pass)) {
      fail(`Informe usuário e senha ${protocol.toUpperCase()}.`)
    }
    result[protocol] = { host, port, user, pass: pass as string }
  }
  return result
}

export const publicAccount = (account?: StoredAccount | null) => account ? {
  connected: true, email: account.email, name: account.name,
  smtp: { host: account.smtp.host, port: account.smtp.port, user: account.smtp.user },
  imap: { host: account.imap.host, port: account.imap.port, user: account.imap.user },
} : { connected: false, email: '' }

// ---------------------------------------------------------------------------
// Conexão de texto por linhas sobre o socket
// ---------------------------------------------------------------------------

class Connection {
  private reader!: ReadableStreamDefaultReader<Uint8Array>
  private writer!: WritableStreamDefaultWriter<Uint8Array>
  private buffer = new Uint8Array(0)
  constructor(private socket: MailSocket) { this.attach() }
  private attach() { this.reader = this.socket.readable.getReader(); this.writer = this.socket.writable.getWriter() }
  private async fill() {
    const { value, done } = await this.reader.read()
    if (done || !value) fail('O servidor de e-mail encerrou a conexão.', 502)
    this.buffer = concat(this.buffer, value!)
  }
  async line(): Promise<string> {
    for (;;) {
      const index = this.buffer.findIndex((byte, position) => byte === 13 && this.buffer[position + 1] === 10)
      if (index >= 0) {
        const text = decoder.decode(this.buffer.subarray(0, index))
        this.buffer = this.buffer.slice(index + 2)
        return text
      }
      if (this.buffer.length > 1_000_000) fail('Resposta inválida do servidor de e-mail.', 502)
      await this.fill()
    }
  }
  async bytes(count: number): Promise<Uint8Array> {
    while (this.buffer.length < count) await this.fill()
    const out = this.buffer.slice(0, count)
    this.buffer = this.buffer.slice(count)
    return out
  }
  async write(data: string | Uint8Array) { await this.writer.write(typeof data === 'string' ? encoder.encode(data) : data) }
  async upgrade() {
    this.reader.releaseLock(); this.writer.releaseLock()
    this.socket = this.socket.startTls()
    this.buffer = new Uint8Array(0)
    this.attach()
  }
  async close() {
    try { this.reader.releaseLock(); this.writer.releaseLock() } catch { /* já liberado */ }
    try { await this.socket.close() } catch { /* ignorado */ }
  }
}

const withDeadline = async <T>(milliseconds: number, work: Promise<T>, onTimeout: () => void): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => { onTimeout(); reject(new MailError('O servidor de e-mail demorou demais para responder.', 504)) }, milliseconds) })])
  } finally { clearTimeout(timer) }
}

// ---------------------------------------------------------------------------
// SMTP
// ---------------------------------------------------------------------------

async function smtpReply(connection: Connection) {
  const lines: string[] = []
  for (;;) {
    const line = await connection.line()
    lines.push(line)
    if (!/^\d{3}-/.test(line)) return { code: Number(line.slice(0, 3)), lines }
  }
}
async function smtpCommand(connection: Connection, command: string, expect: number[], error: string) {
  await connection.write(`${command}\r\n`)
  const reply = await smtpReply(connection)
  if (!expect.includes(reply.code)) fail(error, reply.code === 535 || reply.code === 534 ? 400 : 502)
  return reply
}

async function smtpSession<T>(dial: Dial, config: ServerConfig, work: (connection: Connection) => Promise<T>): Promise<T> {
  const connection = new Connection(await dial(config.host, config.port, config.port === 465 ? 'on' : 'starttls'))
  return withDeadline(60_000, (async () => {
    try {
      if ((await smtpReply(connection)).code !== 220) fail('O servidor SMTP recusou a conexão.', 502)
      let hello = await smtpCommand(connection, 'EHLO flyflow.herodrone.com.br', [250], 'O servidor SMTP recusou a apresentação.')
      if (config.port === 587) {
        if (!hello.lines.some((line) => /^250[- ]STARTTLS/i.test(line))) fail('O servidor SMTP não oferece STARTTLS.', 502)
        await smtpCommand(connection, 'STARTTLS', [220], 'O servidor SMTP recusou o STARTTLS.')
        await connection.upgrade()
        hello = await smtpCommand(connection, 'EHLO flyflow.herodrone.com.br', [250], 'O servidor SMTP recusou a apresentação.')
      }
      const mechanisms = hello.lines.find((line) => /^250[- ]AUTH[ =]/i.test(line))?.toUpperCase() ?? 'AUTH PLAIN LOGIN'
      const authError = 'Usuário ou senha SMTP recusados pelo provedor.'
      if (/\bPLAIN\b/.test(mechanisms)) {
        await smtpCommand(connection, `AUTH PLAIN ${base64(encoder.encode(`\0${config.user}\0${config.pass}`))}`, [235], authError)
      } else {
        await smtpCommand(connection, 'AUTH LOGIN', [334], authError)
        await smtpCommand(connection, base64(encoder.encode(config.user)), [334], authError)
        await smtpCommand(connection, base64(encoder.encode(config.pass)), [235], authError)
      }
      const result = await work(connection)
      await connection.write('QUIT\r\n').catch(() => undefined)
      return result
    } finally { await connection.close() }
  })(), () => { void connection.close() })
}

/** Ponto no início da linha vira dois pontos (RFC 5321 §4.5.2). */
export const dotStuff = (content: Uint8Array) => {
  const text = latin1(content).replace(/\r?\n/g, '\r\n').replace(/(^|\r\n)\./g, '$1..')
  return fromLatin1(text.endsWith('\r\n') ? text : `${text}\r\n`)
}

// ---------------------------------------------------------------------------
// IMAP
// ---------------------------------------------------------------------------

interface ImapResponse { text: string; literals: Uint8Array[] }

class Imap {
  private tag = 0
  constructor(public connection: Connection) {}
  /** Lê uma resposta completa, juntando literais `{n}` ao texto como marcadores. */
  async response(): Promise<ImapResponse> {
    let text = ''
    const literals: Uint8Array[] = []
    for (;;) {
      const line = await this.connection.line()
      const literal = line.match(/\{(\d+)\}$/)
      if (!literal) return { text: text + line, literals }
      const size = Number(literal[1])
      if (size > 2_000_000) fail('Mensagem grande demais para o FlyFlow.', 502)
      literals.push(await this.connection.bytes(size))
      text += `${line.slice(0, -literal[0].length)}\u0000${literals.length - 1}\u0000`
    }
  }
  /**
   * `extra` é enviado depois do `+` do servidor: como literal `{n}` (APPEND)
   * ou como linha simples (AUTHENTICATE).
   */
  async command(command: string, extra?: { data: Uint8Array; literal: boolean }, error = 'O servidor IMAP recusou o comando.', status = 502) {
    const tag = `F${++this.tag}`
    const untagged: ImapResponse[] = []
    if (extra) {
      await this.connection.write(`${tag} ${command}${extra.literal ? ` {${extra.data.length}}` : ''}\r\n`)
      for (;;) {
        const response = await this.response()
        if (response.text.startsWith('+')) break
        if (response.text.startsWith(`${tag} `)) fail(error, status)
        untagged.push(response)
      }
      await this.connection.write(concat(extra.data, encoder.encode('\r\n')))
    } else {
      await this.connection.write(`${tag} ${command}\r\n`)
    }
    for (;;) {
      const response = await this.response()
      if (response.text.startsWith(`${tag} `)) {
        if (!/^\S+ OK/i.test(response.text)) fail(error, status)
        return untagged
      }
      untagged.push(response)
    }
  }
}

/** String IMAP: entre aspas quando possível; literal para o resto. */
const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
const asciiSafe = (value: string) => /^[\x20-\x7e]*$/.test(value)

async function imapSession<T>(dial: Dial, config: ServerConfig, work: (imap: Imap) => Promise<T>): Promise<T> {
  const connection = new Connection(await dial(config.host, config.port, config.port === 993 ? 'on' : 'starttls'))
  const imap = new Imap(connection)
  return withDeadline(90_000, (async () => {
    try {
      const greeting = await imap.response()
      if (!/^\* (OK|PREAUTH)/i.test(greeting.text)) fail('O servidor IMAP recusou a conexão.', 502)
      if (config.port === 143) {
        await imap.command('STARTTLS', undefined, 'O servidor IMAP recusou o STARTTLS.')
        await connection.upgrade()
      }
      const loginError = 'Usuário ou senha IMAP recusados pelo provedor.'
      if (asciiSafe(config.user) && asciiSafe(config.pass)) await imap.command(`LOGIN ${quote(config.user)} ${quote(config.pass)}`, undefined, loginError, 400)
      else await imap.command('AUTHENTICATE PLAIN', { data: encoder.encode(base64(encoder.encode(`\0${config.user}\0${config.pass}`))), literal: false }, loginError, 400)
      const result = await work(imap)
      await imap.command('LOGOUT').catch(() => undefined)
      return result
    } finally { await connection.close() }
  })(), () => { void connection.close() })
}

/** Lê o nome da caixa de uma linha LIST, já sem aspas. */
const parseListLine = (response: ImapResponse) => {
  const match = response.text.match(/^\* LIST \(([^)]*)\) (?:"(?:[^"\\]|\\.)*"|NIL) (.+)$/i)
  if (!match) return null
  const raw = match[2].trim()
  const literal = raw.match(/^\u0000(\d+)\u0000$/)
  const path = literal ? decoder.decode(response.literals[Number(literal[1])]) : raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(.)/g, '$1') : raw
  return { flags: match[1], path }
}

const sentNames = /^(?:inbox[./])?(?:sent|sent items|sent messages|sent mail|enviados|itens enviados|mensagens enviadas)$/i
async function sentFolder(imap: Imap) {
  const boxes = (await imap.command('LIST "" "*"')).map(parseListLine).filter((box): box is { flags: string; path: string } => Boolean(box))
  return boxes.find((box) => /\\Sent\b/i.test(box.flags))?.path ?? boxes.find((box) => sentNames.test(box.path))?.path
}

const htmlToText = (html: string) => html
  .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d|blockquote)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

const addressText = (value?: { name?: string; address?: string } | null) => !value ? '' : value.name ? `${value.name} <${value.address ?? ''}>` : value.address ?? ''

export async function parseMessage(source: Uint8Array, meta: { id: string; seen: boolean; sent: boolean; truncated: boolean }): Promise<MailMessage> {
  const parsed = await PostalMime.parse(source, { attachmentEncoding: 'arraybuffer' }).catch(() => null)
  const body = (parsed?.text?.trim() || (parsed?.html ? htmlToText(parsed.html) : '')).slice(0, 200_000)
  const date = parsed?.date ? new Date(parsed.date) : null
  return {
    id: meta.id, threadId: meta.id,
    subject: parsed?.subject || '(Sem assunto)',
    from: addressText(parsed?.from),
    to: (parsed?.to ?? []).map(addressText).join(', '),
    date: date && !Number.isNaN(date.valueOf()) ? date.toISOString() : '',
    body, snippet: body.replace(/\s+/g, ' ').slice(0, 180),
    unread: !meta.seen, sent: meta.sent,
    hasAttachments: Boolean(parsed?.attachments?.some((item) => item.disposition !== 'inline')) || (meta.truncated && /multipart\/mixed/i.test(latin1(source.subarray(0, 4000)))),
    ...(meta.truncated ? { truncated: true } : {}),
  }
}

const LIST_BYTES = 24_576
const FULL_BYTES = 262_144

const parseFetch = (response: ImapResponse) => {
  const uid = Number(response.text.match(/\bUID (\d+)/i)?.[1] || 0)
  const flags = response.text.match(/\bFLAGS \(([^)]*)\)/i)?.[1] ?? ''
  const literal = response.text.match(/BODY\[\]<0>\s*\u0000(\d+)\u0000/i) ?? response.text.match(/BODY\[\]\s*\u0000(\d+)\u0000/i)
  return { uid, seen: /\\Seen/i.test(flags), source: literal ? response.literals[Number(literal[1])] : null }
}

async function openBox(imap: Imap, box: string) {
  const sent = box === 'sent'
  const path = sent ? await sentFolder(imap) : 'INBOX'
  if (!path) fail('O provedor não informou a pasta Enviados via IMAP.')
  const untagged = await imap.command(`EXAMINE ${quote(path!)}`, undefined, 'Não foi possível abrir a pasta no provedor.')
  const exists = Number(untagged.map((item) => item.text.match(/^\* (\d+) EXISTS/i)?.[1]).find(Boolean) || 0)
  const validity = untagged.map((item) => item.text.match(/UIDVALIDITY (\d+)/i)?.[1]).find(Boolean) || '0'
  return { path: path!, sent, exists, validity }
}

export async function listMail(dial: Dial, account: StoredAccount, box: unknown, limit: unknown): Promise<MailMessage[]> {
  const count = Math.min(30, Math.max(1, Number(limit) || 30))
  return imapSession(dial, account.imap, async (imap) => {
    const folder = await openBox(imap, box === 'sent' ? 'sent' : 'inbox')
    if (!folder.exists) return []
    const responses = await imap.command(`FETCH ${Math.max(1, folder.exists - count + 1)}:* (UID FLAGS BODY.PEEK[]<0.${LIST_BYTES}>)`, undefined, 'Não foi possível ler as mensagens.')
    const messages: MailMessage[] = []
    for (const response of responses) {
      if (!/^\* \d+ FETCH/i.test(response.text)) continue
      const item = parseFetch(response)
      if (!item.uid || !item.source) continue
      messages.push(await parseMessage(item.source, { id: `${folder.path}:${folder.validity}:${item.uid}`, seen: item.seen, sent: folder.sent, truncated: item.source.length >= LIST_BYTES }))
    }
    return messages.sort((left, right) => right.date.localeCompare(left.date))
  })
}

export async function readMail(dial: Dial, account: StoredAccount, id: unknown): Promise<MailMessage> {
  const match = String(id || '').match(/^(.+):(\d+):(\d+)$/)
  if (!match) fail('Mensagem inválida.')
  const [, path, validity, uid] = match!
  return imapSession(dial, account.imap, async (imap) => {
    const sentPath = await sentFolder(imap)
    if (path !== 'INBOX' && path !== sentPath) fail('Pasta não permitida.')
    const folder = await openBox(imap, path === 'INBOX' ? 'inbox' : 'sent')
    if (folder.validity !== validity) fail('A mensagem mudou de lugar no provedor. Atualize a caixa.', 409)
    const response = (await imap.command(`UID FETCH ${uid} (UID FLAGS BODY.PEEK[]<0.${FULL_BYTES}>)`, undefined, 'Não foi possível abrir a mensagem.')).find((item) => /^\* \d+ FETCH/i.test(item.text))
    const item = response ? parseFetch(response) : null
    if (!item?.source) fail('Mensagem não encontrada. Atualize a caixa.', 422)
    return parseMessage(item!.source!, { id: String(id), seen: item!.seen, sent: folder.sent, truncated: item!.source!.length >= FULL_BYTES })
  })
}

export async function verifyAccount(dial: Dial, account: StoredAccount) {
  await smtpSession(dial, account.smtp, async () => undefined)
  await imapSession(dial, account.imap, async (imap) => { await imap.command('EXAMINE "INBOX"', undefined, 'Não foi possível abrir a caixa de entrada.') })
}

export async function sendMail(dial: Dial, account: StoredAccount, input: unknown) {
  const body = (input && typeof input === 'object' ? input : {}) as { to?: unknown; raw?: unknown }
  const to = body.to
  if (!Array.isArray(to) || !to.length || to.length > 20 || !to.every(isEmail)) fail('Destinatários inválidos.')
  if (typeof body.raw !== 'string' || body.raw.length > 14_000_000) fail('Mensagem inválida ou maior que 10 MB.')
  let raw: Uint8Array
  try { raw = fromBase64(body.raw as string) } catch { return fail('Mensagem inválida.') }
  const headers = latin1(raw.subarray(0, 64_000)).split(/\r?\n\r?\n/, 1)[0]
  if (/^(from|sender|return-path|bcc|date|message-id|resent-[^:]+):/im.test(headers)) fail('Cabeçalho de remetente inválido.')
  const fromHeader = account.name ? `"${account.name.replace(/["\\]/g, '')}" <${account.email}>` : account.email
  const messageId = `<${crypto.randomUUID()}@${account.email.split('@')[1]}>`
  const content = concat(encoder.encode(`From: ${fromHeader}\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: ${messageId}\r\n`), raw)
  const rejected: string[] = []
  await smtpSession(dial, account.smtp, async (connection) => {
    await smtpCommand(connection, `MAIL FROM:<${account.email}>`, [250], 'O servidor recusou o remetente.')
    for (const recipient of to as string[]) {
      await connection.write(`RCPT TO:<${recipient}>\r\n`)
      if (![250, 251].includes((await smtpReply(connection)).code)) rejected.push(recipient)
    }
    if (rejected.length === (to as string[]).length) fail('O servidor não aceitou os destinatários.')
    await smtpCommand(connection, 'DATA', [354], 'O servidor recusou a mensagem.')
    await connection.write(concat(dotStuff(content), encoder.encode('.\r\n')))
    const accepted = await smtpReply(connection)
    if (accepted.code !== 250) fail('O servidor recusou a mensagem.', 502)
  })
  let warning = rejected.length ? 'Alguns destinatários foram recusados pelo servidor.' : ''
  // Depois que o SMTP aceitou, uma falha no IMAP nunca pode causar reenvio.
  try {
    await imapSession(dial, account.imap, async (imap) => {
      const path = await sentFolder(imap)
      if (!path) { warning = 'E-mail enviado, mas o provedor não informou a pasta Enviados.'; return }
      await imap.command(`APPEND ${quote(path)} (\\Seen)`, { data: content, literal: true }, 'Falha ao salvar em Enviados.')
    })
  } catch { warning = 'E-mail enviado, mas não foi possível salvar a cópia em Enviados.' }
  return { id: messageId, threadId: messageId, warning }
}

// ---------------------------------------------------------------------------
// Guarda cifrada no KV
// ---------------------------------------------------------------------------

const cryptoKey = async (secret: string) => {
  if (!secret) fail('Configure a chave do e-mail no Worker antes de conectar.', 503)
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('flyflow-mail-v1'), info: encoder.encode('domain-mail-credentials') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export async function sealAccount(secret: string, account: StoredAccount) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(secret), encoder.encode(JSON.stringify(account))))
  return JSON.stringify({ v: 1, iv: base64(iv), data: base64(data) })
}
export async function openAccount(secret: string, sealed: string | null): Promise<StoredAccount | undefined> {
  if (!sealed) return undefined
  try {
    const box = JSON.parse(sealed) as { iv: string; data: string }
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(box.iv) }, await cryptoKey(secret), fromBase64(box.data))
    return JSON.parse(decoder.decode(plain)) as StoredAccount
  } catch { return undefined }
}

// ---------------------------------------------------------------------------
// Rotas /mail/*
// ---------------------------------------------------------------------------

export interface MailEnv { GOOGLE_OAUTH: KVNamespace; MAIL_ENCRYPTION_KEY?: string; FIREBASE_SERVICE_ACCOUNT_JSON?: string; GOOGLE_OAUTH_CLIENT_SECRET?: string }

export async function handleMailRequest(request: Request, env: MailEnv, workspaceId: string, dial: Dial): Promise<{ status: number; body: unknown }> {
  const url = new URL(request.url)
  const route = url.pathname.replace(/^\/mail/, '') || '/'
  const key = `mail:account:${workspaceId}`
  const secret = env.MAIL_ENCRYPTION_KEY || env.FIREBASE_SERVICE_ACCOUNT_JSON || env.GOOGLE_OAUTH_CLIENT_SECRET || ''
  try {
    const account = await openAccount(secret, await env.GOOGLE_OAUTH.get(key))
    if (route === '/account' && request.method === 'GET') return { status: 200, body: publicAccount(account) }
    if (route === '/account' && request.method === 'DELETE') { await env.GOOGLE_OAUTH.delete(key); return { status: 200, body: { connected: false, email: '' } } }
    if (route === '/account' && request.method === 'POST') {
      const next = validateAccount(await request.json().catch(() => ({})), account)
      await verifyAccount(dial, next)
      await env.GOOGLE_OAUTH.put(key, await sealAccount(secret, next))
      return { status: 200, body: publicAccount(next) }
    }
    if (!account) return { status: 409, body: { error: 'Conecte o e-mail do domínio no Inbox ou em Configurações.' } }
    if (route === '/messages' && request.method === 'GET') return { status: 200, body: await listMail(dial, account, url.searchParams.get('box'), url.searchParams.get('limit')) }
    if (route === '/message' && request.method === 'GET') return { status: 200, body: await readMail(dial, account, url.searchParams.get('id')) }
    if (route === '/send' && request.method === 'POST') return { status: 200, body: await sendMail(dial, account, await request.json().catch(() => ({}))) }
    return { status: 404, body: { error: 'Rota de e-mail não encontrada.' } }
  } catch (error) {
    if (error instanceof MailError) return { status: error.status, body: { error: error.message } }
    return { status: 502, body: { error: 'Não foi possível conectar ao e-mail. Confira servidores, portas, usuário e senha.' } }
  }
}
