import { firebaseAuth, firebaseConfig } from './firebase'

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const GOOGLE_SESSION_KEY = 'flyflow.google.workspace.session'
const GOOGLE_CONNECTED_KEY = 'flyflow.google.workspace.connected'
const GOOGLE_CLIENT_ID_KEY = 'flyflow.google.workspace.client-id'
export const CONFIGURED_GOOGLE_OAUTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() || ''
const GOOGLE_WORKSPACE_API_URL =
  import.meta.env.VITE_GOOGLE_WORKSPACE_API_URL ||
  `https://southamerica-east1-${firebaseConfig.projectId}.cloudfunctions.net/googleWorkspaceApi`
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

interface GoogleAccessToken {
  accessToken: string
  expiresAt: number
  email?: string
}

const readLegacyToken = () => {
  try {
    const token = JSON.parse(localStorage.getItem(GOOGLE_SESSION_KEY) || 'null') as GoogleAccessToken | null
    return token?.accessToken && token.expiresAt > Date.now() + 30_000 ? token : undefined
  } catch {
    return undefined
  }
}

let currentToken: GoogleAccessToken | undefined = readLegacyToken()
let currentConnection = { connected: Boolean(currentToken), email: currentToken?.email || '' }

interface GoogleCodeResponse {
  code?: string
  error?: string
}

interface GoogleCodeClient {
  requestCode: () => void
}

interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface GoogleOAuthRoot {
  accounts?: {
    oauth2?: {
      initCodeClient: (config: {
        client_id: string
        scope: string
        ux_mode: 'popup'
        callback: (response: GoogleCodeResponse) => void
        error_callback?: (error: unknown) => void
      }) => GoogleCodeClient
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void
        error_callback?: (error: unknown) => void
      }) => GoogleTokenClient
      revoke: (token: string, callback: () => void) => void
    }
  }
}

const googleOAuth = () => (window as unknown as { google?: GoogleOAuthRoot }).google?.accounts?.oauth2

const loadGoogleIdentityServices = () => new Promise<void>((resolve, reject) => {
  if (googleOAuth()) {
    resolve()
    return
  }
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`)
  if (existing) {
    existing.addEventListener('load', () => resolve(), { once: true })
    existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o Google Identity Services.')), { once: true })
    return
  }
  const script = document.createElement('script')
  script.src = GIS_SCRIPT_URL
  script.async = true
  script.defer = true
  script.onload = () => resolve()
  script.onerror = () => reject(new Error('Não foi possível carregar o Google Identity Services.'))
  document.head.appendChild(script)
})

export const getGoogleWorkspaceConnection = () => {
  return currentConnection
}

export const getStoredGoogleOAuthClientId = () => localStorage.getItem(GOOGLE_CLIENT_ID_KEY)?.trim() || ''

const backendRequest = async <T>(path: string, init?: RequestInit) => {
  const user = firebaseAuth?.currentUser
  if (!user) throw new Error('Entre novamente no FlyFlow antes de conectar o Google.')
  const response = await fetch(`${GOOGLE_WORKSPACE_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || 'A integração com o Google não respondeu.')
  return body
}

const connectLegacyGoogleWorkspace = async (clientId: string) => {
  const oauth2 = googleOAuth()
  if (!oauth2) throw new Error('Google Identity Services indisponível.')
  return new Promise<{ email: string }>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: SCOPES,
      callback: async (response) => {
        if (!response.access_token) return reject(new Error(response.error || 'A autorização do Google não foi concluída.'))
        try {
          const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          })
          const profile = await profileResponse.json() as { email?: string }
          const token = {
            accessToken: response.access_token,
            expiresAt: Date.now() + Math.max(response.expires_in || 3600, 60) * 1000,
            email: profile.email || '',
          }
          currentToken = token
          currentConnection = { connected: true, email: token.email }
          localStorage.setItem(GOOGLE_SESSION_KEY, JSON.stringify(token))
          localStorage.setItem(GOOGLE_CONNECTED_KEY, 'true')
          resolve({ email: token.email })
        } catch (error) {
          reject(error)
        }
      },
      error_callback: () => reject(new Error('A janela de autorização do Google foi fechada ou bloqueada.')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export const connectGoogleWorkspace = async (clientId: string) => {
  const effectiveClientId = CONFIGURED_GOOGLE_OAUTH_CLIENT_ID || clientId.trim()
  if (!effectiveClientId) throw new Error('Informe o OAuth Client ID do Google.')
  await loadGoogleIdentityServices()
  const oauth2 = googleOAuth()
  if (!oauth2) throw new Error('Google Identity Services indisponível.')
  try {
    await backendRequest('/status')
  } catch {
    const connection = await connectLegacyGoogleWorkspace(effectiveClientId)
    localStorage.setItem(GOOGLE_CLIENT_ID_KEY, effectiveClientId)
    return connection
  }

  return new Promise<{ email: string }>((resolve, reject) => {
    const client = oauth2.initCodeClient({
      client_id: effectiveClientId,
      scope: SCOPES,
      ux_mode: 'popup',
      callback: async (response) => {
        if (!response.code) {
          reject(new Error(response.error || 'A autorização do Google não foi concluída.'))
          return
        }
        try {
          const connection = await backendRequest<{ connected: boolean; email: string }>('/connect', {
            method: 'POST',
            body: JSON.stringify({ code: response.code, redirectUri: window.location.origin }),
          })
          currentConnection = { connected: connection.connected, email: connection.email || '' }
          currentToken = undefined
          localStorage.setItem(GOOGLE_CLIENT_ID_KEY, effectiveClientId)
          resolve({ email: connection.email || '' })
        } catch (error) {
          reject(error)
        }
      },
      error_callback: () => reject(new Error('A janela de autorização do Google foi fechada ou bloqueada.')),
    })
    client.requestCode()
  })
}

export const restoreGoogleWorkspaceConnection = async (clientId: string) => {
  if (clientId.trim()) localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId.trim())
  try {
    const connection = await backendRequest<{ connected: boolean; email: string }>('/status')
    currentConnection = { connected: connection.connected, email: connection.email || '' }
    return currentConnection
  } catch {
    currentToken = readLegacyToken()
    currentConnection = { connected: Boolean(currentToken), email: currentToken?.email || '' }
    return currentConnection
  }
}

export const disconnectGoogleWorkspace = async () => {
  const legacyToken = currentToken
  currentToken = undefined
  await backendRequest('/connection', { method: 'DELETE' }).catch(async () => {
    localStorage.removeItem(GOOGLE_SESSION_KEY)
    localStorage.removeItem(GOOGLE_CONNECTED_KEY)
    if (legacyToken?.accessToken) {
      await loadGoogleIdentityServices()
      await new Promise<void>((resolve) => googleOAuth()?.revoke(legacyToken.accessToken, resolve) ?? resolve())
    }
  })
  currentConnection = { connected: false, email: '' }
}

const requireToken = async () => {
  if (currentToken?.accessToken && currentToken.expiresAt > Date.now() + 60_000) return currentToken.accessToken
  const token = await backendRequest<{ accessToken: string; expiresIn: number; email: string }>('/token', { method: 'POST' }).catch(() => {
    throw new Error('Conecte novamente sua conta Google nas Configurações.')
  })
  currentToken = {
    accessToken: token.accessToken,
    expiresAt: Date.now() + Math.max(token.expiresIn || 3600, 60) * 1000,
    email: token.email || '',
  }
  currentConnection = { connected: true, email: token.email || '' }
  return currentToken.accessToken
}

export const createGoogleWorkspaceEvent = async (input: {
  externalEventId?: string
  title: string
  description: string
  startAt: string
  endAt: string
  location?: string
  timeZone: string
  attendeeEmails?: string[]
}) => {
  const eventPath = input.externalEventId ? `/${encodeURIComponent(input.externalEventId)}` : ''
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${eventPath}?sendUpdates=all`, {
    method: input.externalEventId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${await requireToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: input.title,
      description: input.description,
      location: input.location || '',
      start: { dateTime: input.startAt, timeZone: input.timeZone },
      end: { dateTime: input.endAt, timeZone: input.timeZone },
      attendees: [...new Set(input.attendeeEmails?.filter(Boolean) || [])].map((email) => ({ email })),
      reminders: { useDefault: true },
    }),
  })
  if (!response.ok) throw new Error(`Google Calendar recusou o evento (${response.status}).`)
  return response.json() as Promise<{ id: string; htmlLink: string }>
}

const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[character] || character))

const sanitizeEmailHtml = (value: string) => {
  const documentNode = new DOMParser().parseFromString(value, 'text/html')
  documentNode.querySelectorAll('script,style,iframe,object,embed').forEach((node) => node.remove())
  documentNode.querySelectorAll('*').forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name)
    }
  })
  return documentNode.body.innerHTML
}

export interface GoogleEmailAttachment {
  fileName: string
  mimeType: string
  data: Blob
}

export const sendGoogleWorkspaceEmail = async (input: {
  to: string[]
  subject: string
  body: string
  htmlBody?: string
  signatureImageUrl?: string
  attachments?: GoogleEmailAttachment[]
}) => {
  const recipients = [...new Set(input.to.map((email) => email.trim()).filter(Boolean))]
  if (!recipients.length) throw new Error('Informe pelo menos um destinatário.')
  const inlineSignature = input.signatureImageUrl?.match(/^data:([^;]+);base64,(.+)$/)
  const signatureSource = inlineSignature ? 'cid:flyflow-email-signature' : input.signatureImageUrl
  const messageHtml = input.htmlBody?.trim() ? sanitizeEmailHtml(input.htmlBody) : escapeHtml(input.body).replace(/\n/g, '<br>')
  const htmlBody = `${messageHtml}${
    signatureSource
      ? `<div style="margin-top:20px"><img src="${escapeHtml(signatureSource)}" alt="Assinatura de e-mail" style="max-width:520px;width:100%;height:auto"></div>`
      : ''
  }`
  const attachments = input.attachments || []
  const alternativeBoundary = `flyflow-alt-${Date.now()}`
  const mixedBoundary = `flyflow-mixed-${Date.now()}`
  const bodyParts = [
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.body,
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody,
    `--${alternativeBoundary}--`,
  ].join('\r\n')
  const attachmentParts: string[] = []
  if (inlineSignature) {
    attachmentParts.push([
      `--${mixedBoundary}`,
      `Content-Type: ${inlineSignature[1]}; name="assinatura.jpg"`,
      'Content-Transfer-Encoding: base64',
      'Content-Disposition: inline; filename="assinatura.jpg"',
      'Content-ID: <flyflow-email-signature>',
      '',
      inlineSignature[2].replace(/(.{76})/g, '$1\r\n'),
    ].join('\r\n'))
  }
  for (const attachment of attachments) {
    const bytes = new Uint8Array(await attachment.data.arrayBuffer())
    attachmentParts.push([
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.fileName.replace(/"/g, '')}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.fileName.replace(/"/g, '')}"`,
      '',
      bytesToBase64(bytes).replace(/(.{76})/g, '$1\r\n'),
    ].join('\r\n'))
  }
  const raw = [
    `To: ${recipients.join(', ')}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    ...(attachments.length || inlineSignature
      ? [`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`, '', `--${mixedBoundary}`, `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`, '', bodyParts, ...attachmentParts, `--${mixedBoundary}--`]
      : [`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`, '', bodyParts]),
  ].join('\r\n')
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await requireToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeBase64Url(raw) }),
  })
  if (!response.ok) throw new Error(`Gmail recusou o envio (${response.status}).`)
  return response.json() as Promise<{ id: string; threadId: string }>
}

export interface GoogleMailboxMessage {
  id: string
  threadId: string
  subject: string
  from: string
  to: string
  date: string
  snippet: string
  body: string
  unread: boolean
  sent: boolean
  hasAttachments: boolean
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const fetchGmailMessage = async (id: string) => {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${await requireToken()}` },
    })
    if (response.ok) return response.json()
    if (response.status !== 429 || attempt === 2) {
      throw new Error(`Não foi possível abrir uma mensagem (${response.status}).`)
    }
    await wait(750 * (attempt + 1))
  }
  throw new Error('Não foi possível abrir a mensagem.')
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) => {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

type GmailPayloadPart = {
  mimeType?: string
  filename?: string
  body?: { data?: string; attachmentId?: string }
  parts?: GmailPayloadPart[]
  headers?: Array<{ name: string; value: string }>
}

const decodeBase64Url = (value = '') => {
  if (!value) return ''
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
}

const stripHtml = (html: string) => {
  const documentNode = new DOMParser().parseFromString(html, 'text/html')
  return documentNode.body.textContent?.replace(/\n{3,}/g, '\n\n').trim() || ''
}

const findMessageBody = (part?: GmailPayloadPart): string => {
  if (!part) return ''
  if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64Url(part.body.data)
  const plain = part.parts?.map(findMessageBody).find(Boolean)
  if (plain) return plain
  if (part.mimeType === 'text/html' && part.body?.data) return stripHtml(decodeBase64Url(part.body.data))
  return ''
}

const mapGmailMessage = (message: {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  payload?: GmailPayloadPart
  internalDate?: string
}): GoogleMailboxMessage => {
  const headers = new Map((message.payload?.headers || []).map((header) => [header.name.toLowerCase(), header.value]))
  const allParts = (part?: GmailPayloadPart): GmailPayloadPart[] => part ? [part, ...(part.parts || []).flatMap(allParts)] : []
  return {
    id: message.id,
    threadId: message.threadId,
    subject: headers.get('subject') || '(Sem assunto)',
    from: headers.get('from') || '',
    to: headers.get('to') || '',
    date: headers.get('date') || (message.internalDate ? new Date(Number(message.internalDate)).toISOString() : ''),
    snippet: message.snippet || '',
    body: findMessageBody(message.payload),
    unread: Boolean(message.labelIds?.includes('UNREAD')),
    sent: Boolean(message.labelIds?.includes('SENT')),
    hasAttachments: allParts(message.payload).some((part) => Boolean(part.filename)),
  }
}

export const listGoogleWorkspaceEmails = async (input: {
  box: 'inbox' | 'sent'
  query?: string
  maxResults?: number
}) => {
  const params = new URLSearchParams({
    maxResults: String(Math.min(Math.max(input.maxResults || 30, 1), 50)),
    ...(input.query?.trim() ? { q: input.query.trim() } : {}),
  })
  params.append('labelIds', input.box === 'sent' ? 'SENT' : 'INBOX')
  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${await requireToken()}` },
  })
  if (!listResponse.ok) throw new Error(`Gmail recusou a leitura da caixa (${listResponse.status}). Reconecte sua conta Google.`)
  const list = await listResponse.json() as { messages?: Array<{ id: string }> }
  const messages = await mapWithConcurrency(list.messages || [], 3, async ({ id }) =>
    mapGmailMessage(await fetchGmailMessage(id)))
  return messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
