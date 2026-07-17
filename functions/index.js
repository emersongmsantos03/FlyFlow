import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import OpenAI from 'openai'

initializeApp()

const openaiApiKey = defineSecret('OPENAI_API_KEY')
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
      const inputLeads = Array.isArray(request.body?.leads) ? request.body.leads.slice(0, 10) : []
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
        sourceUrls: Array.isArray(lead.sourceUrls) ? lead.sourceUrls.slice(0, 5).map((url) => clean(url, 400)) : [],
      })).filter((lead) => lead.id && lead.name)
      const client = new OpenAI({ apiKey: openaiApiKey.value() })
      const result = await client.responses.create({
        model: 'gpt-5.6-luna',
        reasoning: { effort: 'low' },
        store: false,
        tools: [{ type: 'web_search' }],
        include: ['web_search_call.action.sources'],
        instructions: [
          'Você enriquece leads B2B brasileiros usando somente informações públicas verificáveis.',
          'Pesquise cada empresa pelo nome, cidade e site. Procure proprietário, gerente comercial ou responsável publicamente identificado.',
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
        max_output_tokens: 3500,
      })
      const parsed = JSON.parse(result.output_text)
      const requestedIds = new Set(leads.map((lead) => lead.id))
      const enriched = (Array.isArray(parsed.leads) ? parsed.leads : [])
        .filter((lead) => requestedIds.has(lead.id))
        .map((lead) => ({
          id: clean(lead.id, 100),
          contactName: clean(lead.contactName, 160),
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
