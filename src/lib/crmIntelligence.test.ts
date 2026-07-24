import { describe, expect, it } from 'vitest'
import { averageOpportunityAge, opportunityHealth, stageProbability, weightedPipelineValue } from './crmIntelligence'
import type { Lead } from '../types'

const lead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'lead-1', fullName: 'Cliente', companyName: '', phone: '', whatsapp: '', email: '', instagram: '',
  city: '', neighborhood: '', address: '', source: 'Indicação', serviceInterest: 'Fotos aéreas',
  pipelineStage: 'Em negociação', temperature: 'Morno', estimatedValue: 1000, probability: 50,
  entryDate: '2026-07-01', notes: '', responsibleUserId: 'user-1', archived: false, tags: [],
  createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z', ...overrides,
})

describe('crm intelligence', () => {
  it('calcula previsão ponderada do funil', () => {
    expect(weightedPipelineValue([lead(), lead({ id: 'lead-2', estimatedValue: 2000, probability: 25 })])).toBe(1000)
  })

  it('calcula idade média das oportunidades', () => {
    expect(averageOpportunityAge([lead()], new Date('2026-07-11T00:00:00.000Z'))).toBe(10)
  })

  it('classifica oportunidade atrasada como risco', () => {
    expect(opportunityHealth(lead({ nextContactAt: '2026-07-20T00:00:00.000Z' }), new Date('2026-07-24T00:00:00.000Z')).tone).toBe('danger')
  })

  it('fornece probabilidade operacional por etapa', () => {
    expect(stageProbability('Proposta enviada')).toBe(65)
    expect(stageProbability('Serviço confirmado')).toBe(100)
  })
})
