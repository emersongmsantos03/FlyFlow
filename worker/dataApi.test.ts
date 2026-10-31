import { describe, expect, it } from 'vitest'
import { createRecord, DataApiError, deleteRecord, filterRecords, handleDataApiRequest, patchRecord } from './dataApi'
import { hashToken } from './metrics'

const now = '2026-10-31T12:00:00.000Z'

const statusOf = (action: () => unknown) => {
  try {
    action()
  } catch (error) {
    return error instanceof DataApiError ? error.status : 0
  }
  return 200
}

describe('regras de escrita', () => {
  it('cria com padrões e ignora campos protegidos', () => {
    const lead = createRecord('leads', { fullName: 'Ana', id: 'hack', createdAt: 'x' }, now, 'id-1')
    expect(lead).toMatchObject({ id: 'id-1', fullName: 'Ana', createdAt: now, tags: [] })
  })

  it('recusa criação sem obrigatórios ou em seção protegida', () => {
    expect(statusOf(() => createRecord('leads', {}, now, 'a'))).toBe(400)
    expect(statusOf(() => createRecord('clients', { name: 'x' }, now, 'a'))).toBe(403)
  })

  it('edita só o pedido e recusa troca de tipo', () => {
    const lead = { id: '1', notes: 'a', tags: [], updatedAt: 'antes' }
    expect(patchRecord(lead, { notes: 'b', id: '2' }, now)).toEqual({ id: '1', notes: 'b', tags: [], updatedAt: now })
    expect(statusOf(() => patchRecord(lead, { tags: 'x' }, now))).toBe(400)
  })

  it('excluir nunca remove: marca o registro', () => {
    expect(deleteRecord('leads', { id: '1' }, now)).toMatchObject({ id: '1', deletedAt: now })
    expect(deleteRecord('tasks', { id: '1', status: 'Pendente' }, now)).toMatchObject({ status: 'Cancelada' })
    expect(statusOf(() => deleteRecord('clients', { id: '1' }, now))).toBe(403)
  })

  it('filtra e pagina', () => {
    const result = filterRecords([{ fullName: 'Ana' }, { fullName: 'Bia' }], 'ana', 10, 0)
    expect(result).toEqual({ total: 1, records: [{ fullName: 'Ana' }] })
  })
})

const fakeEnv = async (scopes: string, updatedAtSequence = ['t1', 't1']) => {
  const hash = await hashToken('ffk_teste')
  const audits: unknown[][] = []
  const updates = [...updatedAtSequence]
  const env = {
    FLYFLOW_DB: {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => ({
          first: async () => {
            if (sql.includes('integration_tokens')) return values[0] === hash ? { id: 'tok', workspace_id: 'w', scopes } : null
            if (sql.includes('state_json')) return { state_json: '{}', updated_at: updates[0] }
            return { updated_at: updates[1] }
          },
          run: async () => { audits.push(values) },
        }),
      }),
    },
  } as never
  return { env, audits }
}

const call = async (scopes: string, method: string, path: string, body?: unknown, sequence?: string[]) => {
  const { env, audits } = await fakeEnv(scopes, sequence)
  const writes: string[] = []
  const response = await handleDataApiRequest(
    new Request(`https://x${path}`, { method, body: body ? JSON.stringify(body) : undefined }),
    new URL(`https://x${path}`),
    env,
    'ffk_teste',
    { read: async () => ({ leads: [{ id: '1', notes: 'a', updatedAt: 'x' }], payments: [{ id: 'p' }] }), write: async (_, json) => { writes.push(json) } },
    (payload, status) => new Response(JSON.stringify(payload), { status }),
  )
  return { status: response.status, audits, writes }
}

describe('rotas', () => {
  it('bloqueia sem permissão', async () => {
    expect((await call('metrics', 'GET', '/integrations/data/leads')).status).toBe(403)
    expect((await call('crm:read', 'PATCH', '/integrations/data/leads/1', { notes: 'b' })).status).toBe(403)
  })

  it('financeiro não existe na API', async () => {
    expect((await call('crm:read,crm:write', 'GET', '/integrations/data/payments')).status).toBe(404)
  })

  it('escreve e audita', async () => {
    const result = await call('crm:write', 'PATCH', '/integrations/data/leads/1', { notes: 'b' })
    expect(result.status).toBe(200)
    expect(result.audits).toHaveLength(1)
    expect(result.writes[0]).toContain('"notes":"b"')
  })

  it('não grava se os dados mudaram no meio', async () => {
    const result = await call('crm:write', 'PATCH', '/integrations/data/leads/1', { notes: 'b' }, ['t1', 't2'])
    expect(result.status).toBe(409)
    expect(result.writes).toHaveLength(0)
    expect(result.audits).toHaveLength(0)
  })
})
