const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

interface StoredGoogleToken {
  accessToken: string
  expiresAt: number
  email?: string
}

let currentToken: StoredGoogleToken | undefined

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

interface GoogleTokenClient {
  callback: (response: GoogleTokenResponse) => void
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface GoogleOAuthRoot {
  accounts?: {
    oauth2?: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: GoogleTokenResponse) => void
        error_callback?: (error: unknown) => void
      }) => GoogleTokenClient
      revoke: (token: string, callback: () => void) => void
    }
  }
}

const googleOAuth = () => (window as unknown as { google?: GoogleOAuthRoot }).google?.accounts?.oauth2

const readStoredToken = (): StoredGoogleToken | undefined => {
  if (!currentToken?.accessToken || currentToken.expiresAt <= Date.now() + 30_000) return undefined
  return currentToken
}

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
  const token = readStoredToken()
  return { connected: Boolean(token), email: token?.email || '' }
}

export const connectGoogleWorkspace = async (clientId: string) => {
  if (!clientId.trim()) throw new Error('Informe o OAuth Client ID do Google.')
  await loadGoogleIdentityServices()
  const oauth2 = googleOAuth()
  if (!oauth2) throw new Error('Google Identity Services indisponível.')

  return new Promise<{ email: string }>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: SCOPES,
      callback: async (response) => {
        if (!response.access_token) {
          reject(new Error(response.error || 'A autorização do Google não foi concluída.'))
          return
        }
        try {
          const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          })
          if (!profileResponse.ok) throw new Error('Não foi possível identificar a conta Google.')
          const profile = await profileResponse.json() as { email?: string }
          const token: StoredGoogleToken = {
            accessToken: response.access_token,
            expiresAt: Date.now() + Math.max(response.expires_in || 3600, 60) * 1000,
            email: profile.email || '',
          }
          currentToken = token
          resolve({ email: token.email || '' })
        } catch (error) {
          reject(error)
        }
      },
      error_callback: () => reject(new Error('A janela de autorização do Google foi fechada ou bloqueada.')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export const disconnectGoogleWorkspace = async () => {
  const token = readStoredToken()
  currentToken = undefined
  if (!token?.accessToken) return
  await loadGoogleIdentityServices()
  await new Promise<void>((resolve) => googleOAuth()?.revoke(token.accessToken, resolve) ?? resolve())
}

const requireToken = () => {
  const token = readStoredToken()
  if (!token) throw new Error('Conecte novamente sua conta Google nas Configurações.')
  return token.accessToken
}

export const createGoogleWorkspaceEvent = async (input: {
  title: string
  description: string
  startAt: string
  endAt: string
  location?: string
  timeZone: string
  attendeeEmails?: string[]
}) => {
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireToken()}`,
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

export const sendGoogleWorkspaceEmail = async (input: { to: string[]; subject: string; body: string }) => {
  const recipients = [...new Set(input.to.map((email) => email.trim()).filter(Boolean))]
  if (!recipients.length) throw new Error('Informe pelo menos um destinatário.')
  const raw = [
    `To: ${recipients.join(', ')}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    input.body,
  ].join('\r\n')
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeBase64Url(raw) }),
  })
  if (!response.ok) throw new Error(`Gmail recusou o envio (${response.status}).`)
  return response.json() as Promise<{ id: string; threadId: string }>
}
