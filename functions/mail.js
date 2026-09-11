import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { lookup } from 'node:dns/promises'
import { randomUUID } from 'node:crypto'
import ipaddr from 'ipaddr.js'

const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }) }
const email = (value) => typeof value === 'string' && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value) && value.length <= 254

export function validateAccount(input, previous = {}) {
  if (!email(input.email)) fail('Informe um endereço de e-mail válido.')
  const result = { email: input.email.trim(), name: String(input.name || '').replace(/[\r\n]/g, '').slice(0, 120) }
  for (const protocol of ['smtp', 'imap']) {
    const config = input[protocol] || {}
    const port = Number(config.port)
    if (!(protocol === 'smtp' ? [465, 587] : [993, 143]).includes(port)) fail(`Porta ${protocol.toUpperCase()} inválida.`)
    const host = String(config.host || '').trim().toLowerCase()
    if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || !host.includes('.')) fail('Informe o servidor do provedor.')
    const user = String(config.user || input.email).trim()
    const pass = config.pass || previous[protocol]?.pass
    if (!user || user.length > 254 || typeof pass !== 'string' || !pass || pass.length > 1024) fail(`Informe usuário e senha ${protocol.toUpperCase()}.`)
    result[protocol] = { host, port, user, pass }
  }
  return result
}

export const publicAccount = (account) => account ? {
  connected: true, email: account.email, name: account.name,
  smtp: { host: account.smtp.host, port: account.smtp.port, user: account.smtp.user },
  imap: { host: account.imap.host, port: account.imap.port, user: account.imap.user },
} : { connected: false, email: '' }

async function connectionOptions(config) {
  const addresses = await lookup(config.host, { all: true })
  if (!addresses.length || addresses.some(({ address }) => ipaddr.process(address).range() !== 'unicast')) fail('O servidor precisa ter um endereço público.')
  return { host: addresses[0].address, servername: config.host, port: config.port, secure: [465, 993].includes(config.port),
    auth: { user: config.user, pass: config.pass }, tls: { servername: config.host, rejectUnauthorized: true } }
}

async function smtp(account) {
  return nodemailer.createTransport({ ...await connectionOptions(account.smtp), requireTLS: true,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false })
}

async function imap(account) {
  const client = new ImapFlow({ ...await connectionOptions(account.imap), ...(account.imap.port === 143 ? { doSTARTTLS: true } : {}),
    logger: false, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 })
  client.on('error', () => {})
  try { await client.connect() } catch (error) { client.close(); throw error }
  return client
}

export async function verifyAccount(account) {
  const transport = await smtp(account)
  try { await transport.verify() } finally { transport.close() }
  const client = await imap(account)
  try { const lock = await client.getMailboxLock('INBOX', { readOnly: true }); lock.release() }
  finally { await client.logout().catch(() => client.close()) }
}

export async function listMail(account, box, limit = 30) {
  const client = await imap(account)
  try {
    const sent = box === 'sent'
    const path = sent ? (await client.list()).find((folder) => folder.specialUse === '\\Sent')?.path : 'INBOX'
    if (!path) fail('O provedor não informou a pasta Enviados via IMAP.')
    const lock = await client.getMailboxLock(path, { readOnly: true })
    try {
      const total = client.mailbox.exists
      if (!total) return []
      const messages = []
      for await (const message of client.fetch(`${Math.max(1, total - Math.min(30, Math.max(1, Number(limit) || 30)) + 1)}:*`, { uid: true, flags: true, envelope: true, source: { maxLength: 256000 } })) {
        const parsed = await simpleParser(message.source, { skipHtmlToText: false, skipTextToHtml: true, skipImageLinks: true })
        const id = `${path}:${client.mailbox.uidValidity}:${message.uid}`
        messages.push({ id, threadId: id, subject: parsed.subject || '(Sem assunto)', from: parsed.from?.text || '',
          to: (Array.isArray(parsed.to) ? parsed.to.map((to) => to.text).join(', ') : parsed.to?.text) || '',
          date: parsed.date?.toISOString() || '', body: parsed.text || '', snippet: (parsed.text || '').slice(0, 180),
          unread: !message.flags.has('\\Seen'), sent, hasAttachments: parsed.attachments.length > 0 })
      }
      return messages.reverse()
    } finally { lock.release() }
  } finally { await client.logout().catch(() => client.close()) }
}

export async function sendMail(account, input) {
  if (!Array.isArray(input.to) || !input.to.length || input.to.length > 20 || !input.to.every(email)) fail('Destinatários inválidos.')
  if (typeof input.raw !== 'string' || input.raw.length > 14000000) fail('Mensagem inválida ou maior que 10 MB.')
  const raw = Buffer.from(input.raw, 'base64')
  const headers = raw.toString('utf8').split(/\r?\n\r?\n/, 1)[0]
  if (/^(from|sender|return-path|bcc|date|message-id|resent-[^:]+):/im.test(headers)) fail('Cabeçalho de remetente inválido.')
  // The server controls the sender, including the visible From header.
  const messageId = `<${randomUUID()}@${account.email.split('@')[1]}>`
  const content = Buffer.concat([Buffer.from(`From: ${account.email}\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: ${messageId}\r\n`), raw])
  const transport = await smtp(account)
  let result
  try { result = await transport.sendMail({ envelope: { from: account.email, to: input.to }, raw: content }) }
  finally { transport.close() }
  if (!result.accepted?.length) fail('O servidor não aceitou os destinatários.')
  let warning = result.rejected?.length ? 'Alguns destinatários foram recusados pelo servidor.' : ''
  // Once SMTP accepts a message, an IMAP failure must never trigger a resend.
  try {
    const client = await imap(account)
    try {
      const folder = (await client.list()).find((entry) => entry.specialUse === '\\Sent')
      if (folder) await client.append(folder.path, content, ['\\Seen'])
      else warning = 'E-mail enviado, mas o provedor não informou a pasta Enviados.'
    } finally { await client.logout().catch(() => client.close()) }
  } catch { warning = 'E-mail enviado, mas não foi possível salvar a cópia em Enviados.' }
  return { id: result.messageId || messageId, threadId: result.messageId || messageId, warning }
}
