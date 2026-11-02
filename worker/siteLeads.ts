import { siteCors, siteOrigins, withinRateLimit, type TrackingEnv } from './tracking'
import type { DataStateAccess } from './dataApi'

// Cadastro público do site: cria ou atualiza o lead e deixa o primeiro contato para o agente de WhatsApp.

type Row = Record<string, unknown>

export const AWAITING_CONTACT_TAG = 'aguardando-primeiro-contato'
const SITE_TAG = 'site-cadastro'

export interface SiteLead {
  fullName: string
  whatsapp: string
  email: string
  city: string
  spaceType: string
  goal: string
  source: string
}

const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

const lastDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '').slice(-8)

export const normalizeWhatsapp = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+/, '')
  const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  return national.length === 10 || national.length === 11 ? `55${national}` : ''
}

/** Devolve null quando falta dado obrigatório ou quando a autorização de contato não veio marcada. */
export const parseSiteLead = (body: unknown): SiteLead | null => {
  if (!body || typeof body !== 'object') return null
  const input = body as Row
  const whatsapp = normalizeWhatsapp(input.whatsapp)
  const fullName = text(input.nome, 120)
  const email = text(input.email, 160).toLowerCase()
  if (!fullName || !whatsapp || input.autorizacao !== true) return null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return { fullName, whatsapp, email, city: text(input.cidade, 80), spaceType: text(input.tipo, 80), goal: text(input.objetivo, 300), source: text(input.origem, 40) }
}

export const applySiteLead = (state: Row, lead: SiteLead, now: string, newId: () => string) => {
  const leads = Array.isArray(state.leads) ? state.leads as Row[] : []
  const interactions = Array.isArray(state.leadInteractions) ? state.leadInteractions as Row[] : []
  const digits = lastDigits(lead.whatsapp)
  const found = leads.find((item) => !item.deletedAt && !item.archived && [item.whatsapp, item.phone].some((phone) => lastDigits(phone) === digits))
  const summary = [lead.spaceType && `Espaço: ${lead.spaceType}`, lead.goal && `Objetivo: ${lead.goal}`, lead.source && `Origem: ${lead.source}`].filter(Boolean).join(' · ')
  const blocked = Boolean(found?.doNotContact)
  const tags = [...new Set([...(Array.isArray(found?.tags) ? found.tags as string[] : []), SITE_TAG, ...(blocked ? [] : [AWAITING_CONTACT_TAG])])]
  const record: Row = found
    ? { ...found, fullName: found.fullName || lead.fullName, email: found.email || lead.email, city: found.city || lead.city, notes: found.notes || summary, tags, lastContactAt: now, whatsappConsentAt: now, updatedAt: now }
    : {
        id: newId(), fullName: lead.fullName, companyName: '', phone: lead.whatsapp, whatsapp: lead.whatsapp, email: lead.email, instagram: '', city: lead.city, neighborhood: '', address: '',
        source: 'Site', serviceInterest: 'Outro', pipelineStage: 'Entrada', temperature: 'Quente', estimatedValue: 0, probability: 0, entryDate: now, lastContactAt: now, notes: summary,
        responsibleUserId: '', archived: false, tags, whatsappConsentAt: now, createdAt: now, updatedAt: now,
      }
  const interaction = { id: newId(), leadId: record.id, interactionType: 'Cadastro no site', description: summary || 'Cadastro pelo site.', interactionDate: now, userId: '', createdAt: now }
  return {
    record,
    state: { ...state, leads: found ? leads.map((item) => (item === found ? record : item)) : [...leads, record], leadInteractions: [...interactions, interaction], updatedAt: now },
  }
}

export const handleSiteLead = async (request: Request, env: TrackingEnv, store: DataStateAccess) => {
  const origin = request.headers.get('Origin')
  const headers = { ...siteCors(origin), 'Content-Type': 'application/json; charset=utf-8' }
  const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers })
  if (!origin || !siteOrigins.has(origin)) return new Response(null, { status: 403, headers })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return new Response(null, { status: 405, headers })
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'desconhecido'
    if (!await withinRateLimit(env, ip)) return reply({ error: 'Muitas tentativas. Tente de novo em instantes.' }, 429)
    const body = JSON.parse((await request.text()).slice(0, 4000) || '{}') as Row
    // Campo invisível para pessoas: robôs preenchem e recebem sucesso sem gravar nada.
    if (text(body.site, 200)) return reply({ ok: true }, 200)
    const lead = parseSiteLead(body)
    if (!lead) return reply({ error: 'Confira os campos e autorize o contato.' }, 400)
    const workspace = await env.FLYFLOW_DB.prepare('SELECT workspace_id, state_json, updated_at FROM workspaces ORDER BY rowid LIMIT 1')
      .first<{ workspace_id: string; state_json: string; updated_at: string }>()
    if (!workspace) return reply({ error: 'Cadastro indisponível.' }, 503)
    const now = new Date().toISOString()
    const state = await store.read(workspace.workspace_id, workspace.state_json)
    const result = applySiteLead(state, lead, now, () => crypto.randomUUID())
    const current = await env.FLYFLOW_DB.prepare('SELECT updated_at FROM workspaces WHERE workspace_id = ?').bind(workspace.workspace_id).first<{ updated_at: string }>()
    if (current?.updated_at !== workspace.updated_at) return reply({ error: 'Tente de novo em instantes.' }, 409)
    await store.write(workspace.workspace_id, JSON.stringify(result.state), now)
    return reply({ ok: true }, 200)
  } catch {
    return reply({ error: 'Não foi possível enviar agora.' }, 500)
  }
}
