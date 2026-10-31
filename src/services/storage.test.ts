import { describe, expect, it } from 'vitest'
import { createEmptyState } from '../data/demoData'
import { normalizeAppState } from './storage'
import type { AppState, Lead } from '../types'

const lead = (overrides: Partial<Lead>): Lead => ({
  id: 'lead-1', fullName: 'Ana', companyName: '', phone: '', whatsapp: '', email: 'ana@x.com', instagram: '', city: '', neighborhood: '', address: '',
  source: 'Site', serviceInterest: 'Outro', pipelineStage: 'Entrada', temperature: 'Morno', estimatedValue: 0, probability: 10, entryDate: '2026-10-01',
  notes: '', responsibleUserId: 'u', archived: false, tags: [], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', ...overrides,
})

const withLeads = (leads: Lead[]): AppState => ({ ...createEmptyState(), leads })

describe('normalizeAppState', () => {
  it('oportunidade excluída não recria o contato apagado', () => {
    expect(normalizeAppState(withLeads([lead({ deletedAt: '2026-10-02T00:00:00Z' })])).clients).toHaveLength(0)
  })

  it('oportunidade ativa sem contato continua ganhando um', () => {
    expect(normalizeAppState(withLeads([lead({})])).clients).toHaveLength(1)
  })

  it('migra a origem Lead Hunter e cria os pilares padrão', () => {
    const state = normalizeAppState(withLeads([lead({ source: 'Lead Hunter' as Lead['source'] })]))
    expect(state.leads[0].source).toBe('Prospecção ativa')
    expect(state.contentPillars?.length).toBeGreaterThan(0)
  })

  it('preserva dados antigos do Lead Hunter sem apagá-los', () => {
    const legacy = { ...withLeads([]), leadHunterProspects: [{ id: 'p1' }] } as AppState
    expect((normalizeAppState(legacy) as unknown as { leadHunterProspects: unknown[] }).leadHunterProspects).toHaveLength(1)
  })
})
