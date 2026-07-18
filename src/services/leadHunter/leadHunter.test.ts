import { describe, expect, it } from 'vitest'
import { createDefaultLeadHunterCities, createDefaultLeadHunterSettings } from '../../constants/leadHunterDefaults'
import type { LeadHunterProspect } from '../../types'
import { normalizeLeadText } from './LeadDeduplicationService'
import { buildLeadLearningProfile, learningAdjustmentForLead, validateLeadContacts } from './LeadLearningService'
import { buildLeadWhatsAppMessage, opportunityLevel, refineLeadOpportunity } from './LeadOpportunityService'
import { shouldDisplayLead } from './LeadRotationService'
import { buildGoogleMapsRouteUrl, recommendDailyMission } from './LeadRouteService'
import { calculateLeadScore } from './LeadScoringService'

const prospect = (overrides: Partial<LeadHunterProspect> = {}): LeadHunterProspect => ({
  id: 'prospect-1', externalIds: {}, name: 'Refúgio Marmeleiros', normalizedName: 'refugiomarmeleiros',
  categoryId: 'cabana', categoryName: 'Cabana', city: 'Curitiba', neighborhood: '', address: '', phone: '',
  whatsapp: '', email: '', instagram: '', website: '', googleMapsUrl: '', sources: ['Manual'], sourceUrls: [],
  score: 70, scoreReasons: [], status: 'Descoberto', isNew: true, firstDiscoveredAt: '2026-07-01T00:00:00.000Z',
  lastDiscoveredAt: '2026-07-01T00:00:00.000Z', discoveryCount: 1, displayCount: 0, changedSinceLastDisplay: false,
  discardedPermanently: false, notes: '', createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
})

describe('Lead Hunter services', () => {
  it('normaliza variações de nome para deduplicação', () => {
    expect(normalizeLeadText('Refúgio Marmeleiros Hospedagem')).toBe(normalizeLeadText('Refugio Marmeleiros'))
  })

  it('calcula score com decomposição e limites', () => {
    const result = calculateLeadScore({ noDroneContent: true, largeOutdoorArea: true, duplicate: true }, createDefaultLeadHunterSettings())
    expect(result.score).toBe(45)
    expect(result.reasons).toHaveLength(3)
  })

  it('prioriza inédito e bloqueia cooldown conhecido', () => {
    const settings = createDefaultLeadHunterSettings()
    expect(shouldDisplayLead(prospect(), settings, { includeKnown: false, onlyNew: true }).display).toBe(true)
    const decision = shouldDisplayLead(prospect({ isNew: false, lastDisplayedAt: new Date().toISOString() }), settings, { includeKnown: true, onlyNew: false })
    expect(decision.display).toBe(false)
    expect(decision.reason).toContain('menos de 30 dias')
  })

  it('gera rota externa sem inventar distância ou duração', () => {
    const url = buildGoogleMapsRouteUrl('Curitiba, PR', [prospect({ address: 'Rua A, Curitiba' }), prospect({ id: 'prospect-2', name: 'Cabana B', address: 'Rua B, Curitiba' })])
    expect(url).toContain('google.com/maps/dir')
    expect(url).toContain('waypoints')
  })

  it('recomenda missão com leads reais disponíveis', () => {
    const cities = createDefaultLeadHunterCities()
    const curitiba = cities.find((city) => city.name === 'Curitiba')!
    const mission = recommendDailyMission(cities, [prospect({ cityId: curitiba.id })], [], 'Curitiba')
    expect(mission?.city.name).toBe('Curitiba')
    expect(mission?.newCount).toBe(1)
  })

  it('favorece negócio local próximo com WhatsApp e Instagram', () => {
    const local = refineLeadOpportunity(prospect({ name: 'Pousada Local', whatsapp: '41999999999', instagram: '@pousada', score: 55 }), 10)
    const chain = refineLeadOpportunity(prospect({ name: 'Hotel Ibis Centro', score: 55 }), 45)
    expect(local.score).toBeGreaterThan(chain.score)
    expect(opportunityLevel(local.score)).toBe('Boa')
    expect(chain.scoreReasons.some((reason) => reason.id === 'large-chain')).toBe(true)
  })

  it('gera abordagem natural e substitui a antiga abertura Conheci', () => {
    const message = buildLeadWhatsAppMessage(prospect({
      name: 'Refúgio Marmeleiros',
      recommendedService: 'Filmagem de pousada',
      aiFirstMessage: 'Conheci a Refúgio Marmeleiros e gostaria de apresentar meu trabalho.',
    }))
    expect(message).toContain('Emerson')
    expect(message).toContain('Refúgio Marmeleiros')
    expect(message).toContain('filmagem de pousada')
    expect(message).not.toMatch(/\bconheci\b/i)
  })

  it('aprende gradualmente com aceites e rejeições', () => {
    const history = [
      prospect({ id: 'accepted-1', categoryName: 'Pousada', city: 'Curitiba', decision: 'Aceito' }),
      prospect({ id: 'accepted-2', categoryName: 'Pousada', city: 'Curitiba', decision: 'Aceito' }),
      prospect({ id: 'rejected-1', categoryName: 'Indústria', city: 'Araucária', decision: 'Rejeitado' }),
    ]
    const profile = buildLeadLearningProfile(history)
    expect(learningAdjustmentForLead(prospect({ categoryName: 'Pousada', city: 'Curitiba' }), profile)).toBeGreaterThan(0)
    expect(learningAdjustmentForLead(prospect({ categoryName: 'Indústria', city: 'Araucária' }), profile)).toBeLessThan(0)
  })

  it('valida contatos sem afirmar o que não possui evidência', () => {
    const validation = validateLeadContacts(prospect({
      whatsapp: '41999999999', email: 'contato@empresa.com.br', sources: ['OpenAI Web Search'],
    }), '2026-07-17T00:00:00.000Z')
    expect(validation.whatsapp).toBe('Confirmado')
    expect(validation.email).toBe('Confirmado')
    expect(validation.instagram).toBe('Não informado')
  })
})
