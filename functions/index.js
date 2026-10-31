import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { validateAccount, publicAccount, verifyAccount, listMail, sendMail } from './mail.js'

initializeApp()

const googleOAuthClientId = defineSecret('GOOGLE_OAUTH_CLIENT_ID')
const googleOAuthClientSecret = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET')
const allowedOrigins = new Set([
  'https://flyflow.herodrone.com.br',
  'https://flyflow-a97ab.web.app',
  'https://flyflow-a97ab.firebaseapp.com',
  'https://emersongmsantos03.github.io',
  'http://localhost:5173',
])

const setCors = (request, response) => {
  const origin = request.get('origin')
  if (origin && allowedOrigins.has(origin)) response.set('Access-Control-Allow-Origin', origin)
  response.set('Vary', 'Origin')
  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
}

const googleScopes = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

const authenticateWorkspace = async (request) => {
  const authorization = request.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('Autenticação obrigatória.'), { status: 401 })
  const user = await getAuth().verifyIdToken(authorization.slice(7))
  const membership = await getFirestore().doc(`memberships/${user.uid}`).get()
  const data = membership.data()
  if (!membership.exists || !data?.active || !data.workspaceId) {
    throw Object.assign(new Error('Usuário sem workspace ativo.'), { status: 403 })
  }
  return { user, workspaceId: data.workspaceId }
}

export const mailApi = onRequest(
  { region: 'southamerica-east1', timeoutSeconds: 120, memory: '512MiB', maxInstances: 5 },
  async (request, response) => {
    setCors(request, response)
    response.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    response.set('Cache-Control', 'no-store')
    if (request.method === 'OPTIONS') return response.status(204).send('')
    if (request.get('origin') && !allowedOrigins.has(request.get('origin'))) return response.status(403).json({ error: 'Origem não autorizada.' })
    try {
      const { user, workspaceId } = await authenticateWorkspace(request)
      const reference = getFirestore().doc(`privateMailAccounts/${user.uid}`)
      const stored = (await reference.get()).data()
      const account = stored?.workspaceId === workspaceId ? stored.account : undefined
      if (request.path === '/account' && request.method === 'GET') return response.json(publicAccount(account))
      if (request.path === '/account' && request.method === 'DELETE') {
        await reference.delete()
        return response.json({ connected: false, email: '' })
      }
      if (request.path === '/account' && request.method === 'POST') {
        const next = validateAccount(request.body, account)
        await verifyAccount(next)
        await reference.set({ workspaceId, account: next, updatedAt: FieldValue.serverTimestamp() })
        return response.json(publicAccount(next))
      }
      if (!account) return response.status(409).json({ error: 'Configure sua conta SMTP e IMAP em Configurações.' })
      if (request.path === '/messages' && request.method === 'GET') return response.json(await listMail(account, request.query.box, request.query.limit))
      if (request.path === '/send' && request.method === 'POST') return response.json(await sendMail(account, request.body))
      return response.status(404).json({ error: 'Rota não encontrada.' })
    } catch (error) {
      return response.status(error.status || 502).json({ error: error.status === 400 || error.status === 403 ? error.message : 'Não foi possível conectar ao e-mail. Confira servidores, portas, usuário e senha nas configurações.' })
    }
  },
)

const exchangeGoogleToken = async (parameters) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parameters),
  })
  const body = await response.json()
  if (!response.ok || !body.access_token) {
    throw Object.assign(new Error(body.error_description || 'O Google recusou a autorização.'), { status: 400 })
  }
  return body
}

export const googleWorkspaceApi = onRequest(
  {
    region: 'southamerica-east1',
    secrets: [googleOAuthClientId, googleOAuthClientSecret],
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 5,
  },
  async (request, response) => {
    setCors(request, response)
    response.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    if (request.method === 'OPTIONS') return response.status(204).send('')

    try {
      const { user, workspaceId } = await authenticateWorkspace(request)
      const connectionRef = getFirestore().doc(`workspaces/${workspaceId}/privateIntegrations/googleWorkspace`)
      const path = request.path.replace(/\/+$/, '') || '/'

      if (request.method === 'GET' && path === '/status') {
        const snapshot = await connectionRef.get()
        const connection = snapshot.data()
        return response.json({
          connected: snapshot.exists && Boolean(connection?.refreshToken),
          email: connection?.email || '',
          connectedAt: connection?.connectedAt?.toDate?.()?.toISOString?.() || '',
        })
      }

      if (request.method === 'POST' && path === '/connect') {
        const code = String(request.body?.code || '')
        const redirectUri = String(request.body?.redirectUri || '')
        if (!code || !allowedOrigins.has(redirectUri)) {
          return response.status(400).json({ error: 'Código ou origem de autorização inválida.' })
        }
        const tokens = await exchangeGoogleToken({
          code,
          client_id: googleOAuthClientId.value(),
          client_secret: googleOAuthClientSecret.value(),
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        })
        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        const profile = await profileResponse.json()
        const existing = (await connectionRef.get()).data()
        const refreshToken = tokens.refresh_token || existing?.refreshToken
        if (!refreshToken) {
          return response.status(400).json({ error: 'O Google não forneceu acesso permanente. Remova o FlyFlow das permissões da conta Google e conecte novamente.' })
        }
        await connectionRef.set({
          refreshToken,
          email: profile.email || '',
          scopes: String(tokens.scope || '').split(' ').filter((scope) => googleScopes.includes(scope)),
          connectedBy: user.uid,
          connectedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true })
        return response.json({ connected: true, email: profile.email || '' })
      }

      if (request.method === 'POST' && path === '/token') {
        const snapshot = await connectionRef.get()
        const connection = snapshot.data()
        if (!snapshot.exists || !connection?.refreshToken) {
          return response.status(404).json({ error: 'Conta Google ainda não conectada ao workspace.' })
        }
        const tokens = await exchangeGoogleToken({
          client_id: googleOAuthClientId.value(),
          client_secret: googleOAuthClientSecret.value(),
          refresh_token: connection.refreshToken,
          grant_type: 'refresh_token',
        })
        return response.json({
          accessToken: tokens.access_token,
          expiresIn: tokens.expires_in || 3600,
          email: connection.email || '',
        })
      }

      if (request.method === 'DELETE' && path === '/connection') {
        const snapshot = await connectionRef.get()
        const connection = snapshot.data()
        if (connection?.refreshToken) {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(connection.refreshToken)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }).catch(() => undefined)
        }
        await connectionRef.delete()
        return response.json({ connected: false })
      }

      return response.status(404).json({ error: 'Rota não encontrada.' })
    } catch (error) {
      console.error('google-workspace failed', error)
      return response.status(error?.status || 500).json({
        error: error?.message || 'Falha na integração com o Google.',
      })
    }
  },
)
