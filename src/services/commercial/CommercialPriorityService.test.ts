import { describe, expect, it } from 'vitest'
import type { Lead } from '../../types'
import { buildCommercialActionQueue, buildCommercialInsights, calculateCommercialPriority } from './CommercialPriorityService'

const lead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'lead-1', fullName: 'Contato', companyName: 'Empresa', phone: '', whatsapp: '', email: '', instagram: '',
  city: 'Curitiba', neighborhood: '', address: '', source: 'Lead Hunter', serviceInterest: 'Vídeo institucional',
  pipelineStage: 'Entrada', temperature: 'Morno', estimatedValue: 0, probability: 60, entryDate: '2026-07-01',
  notes: '', responsibleUserId: 'user-1', archived: false, tags: [], createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z', ...overrides,
})

const state = { quotes: [], leadInteractions: [] }

describe('Commercial priority', () => {
  it('prioriza retorno atrasado com WhatsApp', () => {
    const now = new Date('2026-07-17T12:00:00.000Z')
    const urgent = calculateCommercialPriority(lead({ whatsapp: '41999999999', nextContactAt: '2026-07-14T12:00:00.000Z' }), state, now)
    const future = calculateCommercialPriority(lead({ id: 'lead-2', nextContactAt: '2026-07-20T12:00:00.000Z' }), state, now)
    expect(urgent.score).toBeGreaterThan(future.score)
    expect(urgent.overdueDays).toBe(3)
  })

  it('exibe apenas ações vencidas, sem data ou próximas', () => {
    const now = new Date('2026-07-17T12:00:00.000Z')
    const queue = buildCommercialActionQueue([
      lead({ id: 'overdue', nextContactAt: '2026-07-16T12:00:00.000Z' }),
      lead({ id: 'future', nextContactAt: '2026-07-25T12:00:00.000Z' }),
      lead({ id: 'missing', nextContactAt: undefined }),
    ], state, now)
    expect(queue.map((item) => item.lead.id)).toEqual(expect.arrayContaining(['overdue', 'missing']))
    expect(queue.some((item) => item.lead.id === 'future')).toBe(false)
  })

  it('identifica oportunidade parada e calcula conversão', () => {
    const insights = buildCommercialInsights([
      lead({ id: 'won', pipelineStage: 'Serviço confirmado', source: 'Lead Hunter' }),
      lead({ id: 'stalled', updatedAt: '2026-07-01T00:00:00.000Z', source: 'Indicação' }),
    ], state, new Date('2026-07-17T12:00:00.000Z'))
    expect(insights.conversionRate).toBe(50)
    expect(insights.stalled.map((item) => item.id)).toContain('stalled')
  })

  it('mede abordagens e identifica problemas de higiene do CRM', () => {
    const approached = lead({ id: 'approached', whatsapp: '41999999999', city: 'Curitiba', nextContactAt: undefined })
    const insights = buildCommercialInsights([approached, lead({ id: 'duplicate', whatsapp: '41999999999' })], {
      quotes: [],
      projects: [],
      payments: [],
      leadInteractions: [
        { id: 'int-1', leadId: 'approached', interactionType: 'WhatsApp · Primeiro contato', description: 'Mensagem', interactionDate: '2026-07-17T12:00:00.000Z', userId: 'user-1', createdAt: '2026-07-17T12:00:00.000Z' },
        { id: 'int-2', leadId: 'approached', interactionType: 'WhatsApp · Interesse demonstrado', description: 'Resposta', interactionDate: '2026-07-17T13:00:00.000Z', userId: 'user-1', createdAt: '2026-07-17T13:00:00.000Z' },
      ],
    })
    expect(insights.outreach.attempts).toBe(2)
    expect(insights.outreach.responseRate).toBe(100)
    expect(insights.hygieneIssues.find((issue) => issue.id === 'duplicates')?.count).toBe(1)
  })
})
