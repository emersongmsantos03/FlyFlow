import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import OpenAI from 'openai'

initializeApp()

const openaiApiKey = defineSecret('OPENAI_API_KEY')
const googleOAuthClientId = defineSecret('GOOGLE_OAUTH_CLIENT_ID')
const googleOAuthClientSecret = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET')
const allowedOrigins = new Set([
  'https://flyflow-a97ab.web.app',
  'https://flyflow-a97ab.firebaseapp.com',
  'https://emersongmsantos03.github.io',
  'http://localhost:5173',
])

const clean = (value, max = 300) => [...String(value || '')]
  .map((character) => character.charCodeAt(0) < 32 || character === '<' || character === '>' ? ' ' : character)
  .join('').replace(/\s+/g, ' ').trim().slice(0, max)
const leadSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    leads: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          contactName: { type: 'string' },
          address: { type: 'string' },
          phone: { type: 'string' },
          whatsapp: { type: 'string' },
          email: { type: 'string' },
          website: { type: 'string' },
          instagram: { type: 'string' },
          sourceUrls: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'contactName', 'address', 'phone', 'whatsapp', 'email', 'website', 'instagram', 'sourceUrls'],
      },
    },
  },
  required: ['leads'],
}

const setCors = (request, response) => {
  const origin = request.get('origin')
  if (origin && allowedOrigins.has(origin)) response.set('Access-Control-Allow-Origin', origin)
  response.set('Vary', 'Origin')
  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
}

export const leadApi = onRequest(
  { region: 'southamerica-east1', secrets: [openaiApiKey], timeoutSeconds: 120, memory: '512MiB', maxInstances: 5 },
  async (request, response) => {
    setCors(request, response)
    if (request.method === 'OPTIONS') return response.status(204).send('')
    if (request.method !== 'POST' || request.path !== '/lead-enrichment') return response.status(404).json({ error: 'Rota não encontrada.' })
    try {
      const authHeader = request.get('authorization') || ''
      if (!authHeader.startsWith('Bearer ')) return response.status(401).json({ error: 'Autenticação obrigatória.' })
      await getAuth().verifyIdToken(authHeader.slice(7))
      const inputLeads = Array.isArray(request.body?.leads) ? request.body.leads.slice(0, 3) : []
      if (!inputLeads.length) return response.status(400).json({ error: 'Envie ao menos um lead.' })
      const leads = inputLeads.map((lead) => ({
        id: clean(lead.id, 100),
        name: clean(lead.name, 160),
        city: clean(lead.city, 100),
        categoryName: clean(lead.categoryName, 100),
        address: clean(lead.address),
        phone: clean(lead.phone, 60),
        whatsapp: clean(lead.whatsapp, 60),
        email: clean(lead.email, 160),
        website: clean(lead.website, 240),
        instagram: clean(lead.instagram, 160),
        googleMapsUrl: clean(lead.googleMapsUrl, 400),
        sourceUrls: Array.isArray(lead.sourceUrls) ? lead.sourceUrls.slice(0, 5).map((url) => clean(url, 400)) : [],
      })).filter((lead) => lead.id && lead.name)
      const client = new OpenAI({ apiKey: openaiApiKey.value() })
      const result = await client.responses.create({
        model: 'gpt-5.6-luna',
        reasoning: { effort: 'none' },
        store: false,
        tools: [{ type: 'web_search', search_context_size: 'medium' }],
        include: ['web_search_call.action.sources'],
        instructions: [
          'Você enriquece leads B2B brasileiros usando somente informações públicas verificáveis.',
          'Pesquise cada empresa pelo nome, cidade, site e perfil fornecido do Google Maps/Google Business. Procure proprietário, gerente comercial ou responsável publicamente identificado.',
          'Procure contatos no Google Business, site oficial, Instagram oficial, bio, Linktree e Facebook comercial.',
          'Confirme também o endereço comercial completo, com rua, número, bairro, cidade e estado quando publicado. Não use endereço de diretório, sede de rede ou empresa homônima.',
          'Para cada telefone, WhatsApp ou e-mail retornado, inclua em sourceUrls a página exata onde o dado aparece. Não use agregadores sem confirmação cruzada com Google Business, site ou rede oficial.',
          'Diferencie telefone de WhatsApp: só preencha whatsapp quando houver botão, link wa.me/api.whatsapp.com ou indicação pública explícita de atendimento por WhatsApp.',
          'Busque links wa.me, api.whatsapp.com ou indicação explícita de WhatsApp. Telefone comum não deve ser marcado como WhatsApp sem evidência pública.',
          'Nunca invente dados. Deixe o campo vazio quando não houver evidência confiável.',
          'Não substitua um dado recebido por outro sem evidência mais forte. WhatsApp deve ser um número publicamente anunciado como WhatsApp.',
          'Não retorne dados pessoais sensíveis nem contatos encontrados somente em bases vazadas.',
          'sourceUrls deve conter URLs públicas que comprovem os dados retornados.',
        ].join(' '),
        input: JSON.stringify(leads),
        text: {
          format: { type: 'json_schema', name: 'lead_enrichment', strict: true, schema: leadSchema },
          verbosity: 'low',
        },
        max_output_tokens: 1200,
      })
      const parsed = JSON.parse(result.output_text)
      const requestedIds = new Set(leads.map((lead) => lead.id))
      const enriched = (Array.isArray(parsed.leads) ? parsed.leads : [])
        .filter((lead) => requestedIds.has(lead.id))
        .map((lead) => ({
          id: clean(lead.id, 100),
          contactName: clean(lead.contactName, 160),
          address: clean(lead.address, 300),
          phone: clean(lead.phone, 60),
          whatsapp: clean(lead.whatsapp, 60),
          email: clean(lead.email, 160),
          website: clean(lead.website, 240),
          instagram: clean(lead.instagram, 160),
          sourceUrls: Array.isArray(lead.sourceUrls) ? lead.sourceUrls.filter((url) => /^https?:\/\//i.test(url)).slice(0, 8) : [],
        }))
      return response.json({ leads: enriched, tokenUsage: result.usage?.total_tokens || 0 })
    } catch (error) {
      console.error('lead-enrichment failed', error)
      const status = error?.status === 429 ? 429 : 500
      return response.status(status).json({ error: status === 429 ? 'Créditos ou limite da OpenAI atingidos.' : 'Falha ao pesquisar os contatos públicos.' })
    }
  },
)

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
