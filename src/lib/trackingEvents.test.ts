import { describe, expect, it } from 'vitest'
import { createEmptyState } from '../data/demoData'
import { applyTrackingEvents, type TrackingEvent } from './trackingEvents'
import type { AppState, Client, Lead } from '../types'

const now = '2026-10-30T12:00:00.000Z'
const lead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'l1', contactId: 'c1', fullName: 'Ana', companyName: 'Studio', phone: '', whatsapp: '', email: 'ana@x.com', instagram: '', city: '', neighborhood: '', address: '',
  source: 'Site', serviceInterest: 'Outro', pipelineStage: 'Em negociação', temperature: 'Morno', estimatedValue: 0, probability: 10, entryDate: '2026-10-01',
  notes: '', responsibleUserId: 'u1', archived: false, tags: [], createdAt: now, updatedAt: now, ...overrides,
})
const client: Client = { id: 'c1', fullName: 'Ana', companyName: 'Studio', document: '', phone: '', whatsapp: '', email: 'ana@x.com', instagram: '', address: '', city: '', source: 'Site', notes: '', tags: [], archived: false, createdAt: now, updatedAt: now }
const base = (leads: Lead[] = [lead()]): AppState => ({ ...createEmptyState(), leads, clients: [client] })
const event = (overrides: Partial<TrackingEvent>): TrackingEvent => ({ id: 'e1', type: 'link_click', leadEmail: 'ANA@x.com', occurredAt: now, metadata: { button: 'whatsapp' }, campaign: 'Outubro', ...overrides })

describe('eventos no CRM', () => {
  it('liga por e-mail, sem diferenciar maiúsculas, e dá o selo de clique', () => {
    const result = applyTrackingEvents(base(), [event({})], now)
    expect(result.state.leads[0].emailEngagement).toBe('Clicou')
    expect(result.state.leadInteractions[0]).toMatchObject({ leadId: 'l1', interactionType: 'Clique no e-mail' })
    expect(result.processedIds).toEqual(['e1'])
  })

  it('liga pelo lead_id quando vier', () => {
    const state = base([lead(), lead({ id: 'l2', email: 'outro@x.com' })])
    expect(applyTrackingEvents(state, [event({ leadId: 'l2', leadEmail: 'qualquer@x.com' })], now).state.leadInteractions[0].leadId).toBe('l2')
  })

  it('reprocessar não duplica, mesmo com outra aba', () => {
    const first = applyTrackingEvents(base(), [event({ type: 'email_reply' })], now)
    const second = applyTrackingEvents(first.state, [event({ type: 'email_reply' })], now)
    expect(second.state.leadInteractions).toHaveLength(1)
    expect(second.state.tasks.filter((task) => task.id.startsWith('task-email-reply'))).toHaveLength(1)
    expect(second.processedIds).toEqual(['e1'])
    expect(second.changed.leadInteractions).toHaveLength(0)
  })

  it('resposta vira prioridade e clique posterior não rebaixa o selo', () => {
    const replied = applyTrackingEvents(base(), [event({ id: 'r', type: 'email_reply' }), event({ id: 'c', occurredAt: '2026-10-30T13:00:00.000Z' })], now)
    expect(replied.state.leads[0].emailEngagement).toBe('Respondeu')
    expect(replied.state.tasks[0]).toMatchObject({ priority: 'Urgente', title: 'Responder Studio', leadId: 'l1' })
    expect(replied.changed.notifications).toHaveLength(1)
  })

  it('e-mail desconhecido cria lead na primeira etapa, uma vez só', () => {
    const result = applyTrackingEvents(base(), [event({ id: 'a', leadEmail: 'novo@y.com' }), event({ id: 'b', leadEmail: 'novo@y.com', type: 'email_reply' })], now)
    const created = result.state.leads.filter((item) => item.email === 'novo@y.com')
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ source: 'Prospecção por email', pipelineStage: 'Entrada' })
    expect(result.changed.clients).toHaveLength(1)
  })

  it('descadastro marca lead e contato como não contatar', () => {
    const result = applyTrackingEvents(base(), [event({ type: 'email_unsubscribe' })], now)
    expect(result.state.leads[0].doNotContact).toBe(true)
    expect(result.state.clients[0].doNotContact).toBe(true)
  })

  it('não recria lead excluído', () => {
    const result = applyTrackingEvents(base([lead({ deletedAt: now })]), [event({ type: 'email_reply' })], now)
    expect(result.state.leads).toHaveLength(1)
    expect(result.changed.tasks).toHaveLength(0)
  })
})
