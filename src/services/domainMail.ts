import { firebaseAuth, firebaseConfig } from './firebase'

/** O e-mail do domínio roda no Worker do Cloudflare; a Cloud Function antiga fica só como alternativa. */
const mailApiUrl = () => {
  const explicit = String(import.meta.env.VITE_MAIL_API_URL || '').replace(/\/+$/, '')
  if (explicit) return explicit
  const worker = String(import.meta.env.VITE_API_URL || import.meta.env.VITE_LEAD_HUNTER_API_URL || '').replace(/\/+$/, '')
  return worker ? `${worker}/mail` : `https://southamerica-east1-${firebaseConfig.projectId}.cloudfunctions.net/mailApi`
}

export interface MailAccount {
  connected: boolean
  email: string
  name?: string
  smtp?: { host: string; port: number; user: string; pass?: string }
  imap?: { host: string; port: number; user: string; pass?: string }
}
let connection: MailAccount = { connected: false, email: '' }
let connectionUser = ''
export class MailServiceUnavailableError extends Error {
  constructor(message = 'O serviço de e-mail do FlyFlow está indisponível. Não foi possível confirmar a conexão com seu provedor; isso não indica senha inválida. Tente verificar a disponibilidade novamente.') {
    super(message)
    this.name = 'MailServiceUnavailableError'
  }
}
export const getDomainMailConnection = () => connectionUser === firebaseAuth?.currentUser?.uid ? connection : { connected: false, email: '' }
export async function domainMailRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const user = firebaseAuth?.currentUser
  if (!user) throw new Error('Entre no FlyFlow para conectar seu e-mail.')
  const token = await user.getIdToken().catch(() => { throw new Error('Não foi possível validar sua sessão no FlyFlow. Entre novamente para conectar seu e-mail.') })
  let response: Response
  try {
    response = await fetch(`${mailApiUrl()}${path}`, {
      ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(init?.method === 'POST' ? 125000 : path === '/account' ? 15000 : 90000),
    })
  } catch {
    if (path === '/send') throw new MailServiceUnavailableError('A comunicação foi interrompida e não foi possível confirmar o envio. Confira a pasta Enviados no webmail antes de tentar novamente para evitar duplicidade.')
    throw new MailServiceUnavailableError()
  }
  if (response.status === 404 || response.status === 503) throw new MailServiceUnavailableError()
  const body = await response.json().catch(() => { throw new MailServiceUnavailableError() })
  if (!response.ok) throw new Error(body.error || 'O serviço de e-mail recusou a solicitação. Tente novamente.')
  return body as T
}
export async function refreshDomainMail() {
  const uid = firebaseAuth?.currentUser?.uid || ''
  const next = await domainMailRequest<MailAccount>('/account')
  if (firebaseAuth?.currentUser?.uid === uid) { connection = next; connectionUser = uid }
  return getDomainMailConnection()
}
export async function saveDomainMail(account: MailAccount) {
  const uid = firebaseAuth?.currentUser?.uid || ''
  const saved = await domainMailRequest<MailAccount>('/account', { method: 'POST', body: JSON.stringify(account) })
  if (firebaseAuth?.currentUser?.uid !== uid) throw new Error('Sua sessão mudou. Entre novamente para consultar a conexão.')
  connection = saved
  connectionUser = uid
  window.dispatchEvent(new Event('flyflow-mail-changed'))
  return saved
}
export async function disconnectDomainMail() {
  await domainMailRequest('/account', { method: 'DELETE' })
  connection = { connected: false, email: '' }
  window.dispatchEvent(new Event('flyflow-mail-changed'))
}
export interface DomainMailMessage {
  id: string; threadId: string; subject: string; from: string; to: string; date: string
  snippet: string; body: string; unread: boolean; sent: boolean; hasAttachments: boolean; truncated?: boolean
}
/** Mensagem completa (a lista traz só o começo de cada e-mail). */
export const readDomainMessage = (id: string) => domainMailRequest<DomainMailMessage>(`/message?id=${encodeURIComponent(id)}`)
