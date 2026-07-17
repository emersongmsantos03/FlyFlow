interface Env {
  OPENAI_API_KEY: string
  FIREBASE_WEB_API_KEY: string
}

type InputLead = {
  id: string
  name: string
  city: string
  categoryName: string
  address?: string
  phone?: string
  whatsapp?: string
  email?: string
  website?: string
  instagram?: string
  sourceUrls?: string[]
}

const allowedOrigins = new Set([
  'https://flyflow-a97ab.web.app',
  'https://flyflow-a97ab.firebaseapp.com',
  'https://emersongmsantos03.github.io',
  'http://localhost:5173',
])

const clean = (value: unknown, max = 300) => [...String(value || '')]
  .map((character) => character.charCodeAt(0) < 32 || character === '<' || character === '>' ? ' ' : character)
  .join('').replace(/\s+/g, ' ').trim().slice(0, max)

const corsHeaders = (origin: string | null) => ({
  ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
})

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) })

const verifyFirebaseToken = async (token: string, apiKey: string) => {
  if (!apiKey) return false
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  })
  if (!response.ok) return false
  const body = await response.json() as { users?: Array<{ localId?: string }> }
  return Boolean(body.users?.[0]?.localId)
}

const schema = {
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
          phone: { type: 'string' },
          whatsapp: { type: 'string' },
          email: { type: 'string' },
          website: { type: 'string' },
          instagram: { type: 'string' },
          sourceUrls: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'contactName', 'phone', 'whatsapp', 'email', 'website', 'instagram', 'sourceUrls'],
      },
    },
  },
  required: ['leads'],
}

const outputText = (response: { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) =>
  (response.output || []).flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text || ''

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'flyflow-lead-api' }, 200, origin)
    if (request.method !== 'POST' || url.pathname !== '/lead-enrichment') return json({ error: 'Rota não encontrada.' }, 404, origin)
    if (origin && !allowedOrigins.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin)

    const authorization = request.headers.get('Authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token || !(await verifyFirebaseToken(token, env.FIREBASE_WEB_API_KEY))) {
      return json({ error: 'Autenticação Firebase inválida.' }, 401, origin)
    }

    const body = await request.json().catch(() => null) as { leads?: InputLead[] } | null
    const leads = (Array.isArray(body?.leads) ? body.leads : []).slice(0, 10).map((lead) => ({
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
      sourceUrls: (lead.sourceUrls || []).slice(0, 5).map((item) => clean(item, 400)),
    })).filter((lead) => lead.id && lead.name)
    if (!leads.length) return json({ error: 'Envie ao menos um lead.' }, 400, origin)

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        reasoning: { effort: 'low' },
        store: false,
        tools: [{ type: 'web_search' }],
        include: ['web_search_call.action.sources'],
        instructions: [
          'Enriqueça leads B2B brasileiros usando somente informações públicas verificáveis.',
          'Pesquise cada empresa por nome, cidade, endereço e site.',
          'Priorize WhatsApp público, telefone, e-mail e o nome de proprietário, gerente ou responsável comercial.',
          'Nunca invente dados. Deixe vazio quando não houver evidência confiável.',
          'Não use bases vazadas nem retorne dados pessoais sensíveis.',
          'sourceUrls deve comprovar os dados retornados.',
        ].join(' '),
        input: JSON.stringify(leads),
        text: { format: { type: 'json_schema', name: 'lead_enrichment', strict: true, schema }, verbosity: 'low' },
        max_output_tokens: 3500,
      }),
    })
    const openaiBody = await openaiResponse.json() as {
      error?: { message?: string }
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
      usage?: { total_tokens?: number }
    }
    if (!openaiResponse.ok) {
      return json({ error: openaiResponse.status === 429 ? 'Créditos ou limite da OpenAI atingidos.' : clean(openaiBody.error?.message || 'Falha na OpenAI.') }, openaiResponse.status === 429 ? 429 : 502, origin)
    }

    const parsed = JSON.parse(outputText(openaiBody) || '{"leads":[]}') as { leads?: Array<Record<string, unknown>> }
    const requestedIds = new Set(leads.map((lead) => lead.id))
    const enriched = (parsed.leads || []).filter((lead) => requestedIds.has(clean(lead.id, 100))).map((lead) => ({
      id: clean(lead.id, 100),
      contactName: clean(lead.contactName, 160),
      phone: clean(lead.phone, 60),
      whatsapp: clean(lead.whatsapp, 60),
      email: clean(lead.email, 160),
      website: clean(lead.website, 240),
      instagram: clean(lead.instagram, 160),
      sourceUrls: Array.isArray(lead.sourceUrls) ? lead.sourceUrls.map((item) => clean(item, 400)).filter((item) => /^https?:\/\//i.test(item)).slice(0, 8) : [],
    }))
    return json({ leads: enriched, tokenUsage: openaiBody.usage?.total_tokens || 0 }, 200, origin)
  },
}
