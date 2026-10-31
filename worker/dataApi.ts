import { hashToken, parseScopes, type TokenScope } from './metrics'

// API de dados para rotinas: lê e edita CRM e conteúdo no snapshot do workspace.
// Financeiro e usuários ficam de fora. Nada é apagado: excluir só marca o registro.

type Row = Record<string, unknown>

interface DataEnv {
  FLYFLOW_DB: D1Database
}

export interface DataStateAccess {
  read: (workspaceId: string, fallbackJson: string) => Promise<Row>
  write: (workspaceId: string, stateJson: string, updatedAt: string) => Promise<void>
}

export class DataApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const sections: Record<string, { read: TokenScope; write: TokenScope; required: string[]; defaults: Row }> = {
  leads: {
    read: 'crm:read',
    write: 'crm:write',
    required: ['fullName'],
    defaults: {
      companyName: '', phone: '', whatsapp: '', email: '', instagram: '', city: '', neighborhood: '', address: '',
      estimatedValue: 0, probability: 0, notes: '', responsibleUserId: '', archived: false, tags: [],
    },
  },
  leadInteractions: { read: 'crm:read', write: 'crm:write', required: ['leadId', 'interactionType', 'description'], defaults: { userId: '' } },
  clients: { read: 'crm:read', write: 'crm:write', required: [], defaults: {} },
  tasks: {
    read: 'crm:read',
    write: 'crm:write',
    required: ['title', 'dueAt'],
    defaults: { description: '', priority: 'Média', status: 'Pendente' },
  },
  contentItems: {
    read: 'content:read',
    write: 'content:write',
    required: ['title', 'platform', 'format', 'status'],
    defaults: { hook: '', caption: '', script: '', callToAction: '', hashtags: '', mediaUrl: '', permalink: '', campaign: '', notes: '' },
  },
  contentPillars: { read: 'content:read', write: 'content:write', required: ['name'], defaults: { color: '', description: '', targetShare: 0 } },
}

const creatable = new Set(['leads', 'leadInteractions', 'tasks', 'contentItems', 'contentPillars'])
const protectedFields = new Set(['id', 'createdAt', 'updatedAt'])
const MAX_LIST = 200
const MAX_BODY_BYTES = 256_000

/** Excluir vira a marcação que cada tela do FlyFlow já entende; o log guarda o antes. */
const softDelete: Record<string, (record: Row, now: string) => Row> = {
  leads: (record, now) => ({ ...record, deletedAt: now, deletedBy: 'api', deletionReason: 'Excluído pela API de dados' }),
  contentItems: (record, now) => ({ ...record, archivedAt: now }),
  tasks: (record) => ({ ...record, status: 'Cancelada' }),
}

const listOf = (state: Row, section: string) => (Array.isArray(state[section]) ? state[section] as Row[] : [])

const asObject = (value: unknown, label: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DataApiError(`${label} inválido.`, 400)
  return value as Row
}

const sameKind = (left: unknown, right: unknown) =>
  left === undefined || left === null || right === null || (Array.isArray(left) === Array.isArray(right) && typeof left === typeof right)

export const createRecord = (section: string, input: unknown, now: string, id: string) => {
  const config = sections[section]
  if (!creatable.has(section)) throw new DataApiError('Esta seção não aceita novos registros por aqui.', 403)
  const fields = asObject(input, 'Registro')
  const missing = config.required.filter((key) => fields[key] === undefined || fields[key] === '')
  if (missing.length) throw new DataApiError(`Campos obrigatórios: ${missing.join(', ')}.`, 400)
  const clean = Object.fromEntries(Object.entries(fields).filter(([key]) => !protectedFields.has(key)))
  return { ...config.defaults, ...clean, id, createdAt: now, updatedAt: now }
}

export const patchRecord = (current: Row, input: unknown, now: string) => {
  const fields = asObject(input, 'Alteração')
  const entries = Object.entries(fields).filter(([key]) => !protectedFields.has(key))
  if (!entries.length) throw new DataApiError('Nenhum campo para alterar.', 400)
  const wrong = entries.filter(([key, value]) => !sameKind(current[key], value)).map(([key]) => key)
  if (wrong.length) throw new DataApiError(`Tipo inválido em: ${wrong.join(', ')}.`, 400)
  return { ...current, ...Object.fromEntries(entries), ...('updatedAt' in current ? { updatedAt: now } : {}) }
}

export const deleteRecord = (section: string, current: Row, now: string) => {
  const mark = softDelete[section]
  if (!mark) throw new DataApiError('Esta seção não aceita exclusão por aqui.', 403)
  return { ...mark(current, now), ...('updatedAt' in current ? { updatedAt: now } : {}) }
}

export const filterRecords = (records: Row[], query: string, limit: number, offset: number) => {
  const term = query.trim().toLowerCase()
  const matched = term ? records.filter((record) => JSON.stringify(record).toLowerCase().includes(term)) : records
  return { total: matched.length, records: matched.slice(offset, offset + limit) }
}

const authenticate = async (env: DataEnv, token: string) => {
  if (!token.startsWith('ffk_')) throw new DataApiError('Token de integração ausente ou inválido.', 401)
  const stored = await env.FLYFLOW_DB.prepare(
    'SELECT id, workspace_id, scopes FROM integration_tokens WHERE token_hash = ? AND revoked_at IS NULL',
  ).bind(await hashToken(token)).first<{ id: string; workspace_id: string; scopes: string }>()
  if (!stored) throw new DataApiError('Token de integração ausente ou inválido.', 401)
  return { tokenId: stored.id, workspaceId: stored.workspace_id, scopes: parseScopes(stored.scopes) }
}

const requireScope = (scopes: TokenScope[], scope: TokenScope) => {
  if (!scopes.includes(scope)) throw new DataApiError(`Este token não tem a permissão ${scope}.`, 403)
}

const readBody = async (request: Request) => {
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new DataApiError('Alteração grande demais.', 413)
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new DataApiError('JSON inválido.', 400)
  }
}

export const handleDataApiRequest = async (
  request: Request,
  url: URL,
  env: DataEnv,
  token: string,
  store: DataStateAccess,
  reply: (body: unknown, status: number) => Response,
) => {
  try {
    const match = url.pathname.match(/^\/integrations\/data\/([A-Za-z]+)(?:\/([^/]+))?$/)
    const config = match ? sections[match[1]] : undefined
    if (!match || !config) throw new DataApiError('Rota não encontrada.', 404)
    const [, section, id] = match
    const { tokenId, workspaceId, scopes } = await authenticate(env, token)
    const workspace = await env.FLYFLOW_DB.prepare('SELECT state_json, updated_at FROM workspaces WHERE workspace_id = ?')
      .bind(workspaceId).first<{ state_json: string; updated_at: string }>()
    if (!workspace) throw new DataApiError('Workspace não encontrado.', 404)
    const state = await store.read(workspaceId, workspace.state_json)
    const records = listOf(state, section)
    const found = id ? records.find((record) => String(record.id) === id) : undefined

    if (request.method === 'GET') {
      requireScope(scopes, config.read)
      if (id) {
        if (!found) throw new DataApiError('Registro não encontrado.', 404)
        return reply({ record: found, updatedAt: workspace.updated_at }, 200)
      }
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), MAX_LIST)
      const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
      return reply({ ...filterRecords(records, url.searchParams.get('q') || '', limit, offset), updatedAt: workspace.updated_at }, 200)
    }

    requireScope(scopes, config.write)
    const now = new Date().toISOString()
    let action: string
    let after: Row
    if (request.method === 'POST' && !id) {
      action = 'create'
      after = createRecord(section, await readBody(request), now, crypto.randomUUID())
    } else if (found && request.method === 'PATCH') {
      action = 'update'
      after = patchRecord(found, await readBody(request), now)
    } else if (found && request.method === 'DELETE') {
      action = 'delete'
      after = deleteRecord(section, found, now)
    } else if (id && !found) {
      throw new DataApiError('Registro não encontrado.', 404)
    } else {
      throw new DataApiError('Rota não encontrada.', 404)
    }

    state[section] = found ? records.map((record) => (record === found ? after : record)) : [...records, after]
    state.updatedAt = now
    const current = await env.FLYFLOW_DB.prepare('SELECT updated_at FROM workspaces WHERE workspace_id = ?')
      .bind(workspaceId).first<{ updated_at: string }>()
    if (current?.updated_at !== workspace.updated_at) throw new DataApiError('Os dados mudaram durante a alteração. Tente de novo.', 409)
    await env.FLYFLOW_DB.prepare(`
      INSERT INTO data_api_audit (id, workspace_id, token_id, action, section, record_id, before_json, after_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), workspaceId, tokenId, action, section, String(after.id), found ? JSON.stringify(found) : null, JSON.stringify(after), now).run()
    await store.write(workspaceId, JSON.stringify(state), now)
    return reply({ record: after, updatedAt: now }, action === 'create' ? 201 : 200)
  } catch (error) {
    if (error instanceof DataApiError) return reply({ error: error.message }, error.status)
    const message = error instanceof Error ? error.message : ''
    if (/no such (table|column)/i.test(message)) return reply({ error: 'Rode: npx wrangler d1 migrations apply flyflow-db --remote' }, 500)
    return reply({ error: message || 'Falha ao acessar os dados.' }, 500)
  }
}

/** Histórico exibido em Integrações, sem o conteúdo dos registros. */
export const listDataAudit = async (env: DataEnv, workspaceId: string) => {
  const rows = await env.FLYFLOW_DB.prepare(`
    SELECT audit.id, audit.action, audit.section, audit.record_id AS recordId, audit.created_at AS createdAt, token.label AS tokenLabel
    FROM data_api_audit audit LEFT JOIN integration_tokens token ON token.id = audit.token_id
    WHERE audit.workspace_id = ? ORDER BY audit.created_at DESC LIMIT 50
  `).bind(workspaceId).all()
  return rows.results
}
