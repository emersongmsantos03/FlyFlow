import { firebaseAuth, firebaseConfig } from './firebase'

export interface MailAccount {
  connected: boolean
  email: string
  name?: string
  smtp?: { host: string; port: number; user: string; pass?: string }
  imap?: { host: string; port: number; user: string; pass?: string }
}
let connection: MailAccount = { connected: false, email: '' }
let connectionUser = ''
export const getDomainMailConnection = () => connectionUser === firebaseAuth?.currentUser?.uid ? connection : { connected: false, email: '' }
export async function domainMailRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const user = firebaseAuth?.currentUser
  if (!user) throw new Error('Entre no FlyFlow para conectar seu e-mail.')
  const response = await fetch(`${import.meta.env.VITE_MAIL_API_URL || `https://southamerica-east1-${firebaseConfig.projectId}.cloudfunctions.net/mailApi`}${path}`, {
    ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, signal: AbortSignal.timeout(125000),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'O serviço de e-mail está indisponível. Tente novamente mais tarde.')
  return body as T
}
export async function refreshDomainMail() {
  const uid = firebaseAuth?.currentUser?.uid || ''
  const next = await domainMailRequest<MailAccount>('/account')
  if (firebaseAuth?.currentUser?.uid === uid) { connection = next; connectionUser = uid }
  return getDomainMailConnection()
}
export async function saveDomainMail(account: MailAccount) {
  await domainMailRequest('/account', { method: 'POST', body: JSON.stringify(account) })
  await refreshDomainMail()
  window.dispatchEvent(new Event('flyflow-mail-changed'))
}
export async function disconnectDomainMail() {
  await domainMailRequest('/account', { method: 'DELETE' })
  connection = { connected: false, email: '' }
  window.dispatchEvent(new Event('flyflow-mail-changed'))
}
