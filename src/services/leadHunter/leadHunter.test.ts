import { describe, expect, it } from 'vitest'
import { createDefaultLeadHunterCities, createDefaultLeadHunterSettings } from '../../constants/leadHunterDefaults'
import type { LeadHunterProspect } from '../../types'
import { normalizeLeadText } from './LeadDeduplicationService'
import { buildLeadLearningProfile, learningAdjustmentForLead, validateLeadContacts } from './LeadLearningService'
import { buildLeadWhatsAppMessage, buildLeadWhatsAppUrl, opportunityLevel, refineLeadOpportunity } from './LeadOpportunityService'
import { shouldDisplayLead } from './LeadRotationService'
import { buildGoogleMapsRouteUrl, recommendDailyMission } from './LeadRouteService'
import { calculateLeadScore } from './LeadScoringService'
import { isEligibleLeadSegment, isForbiddenLeadSegment, leadSegmentPriority } from './LeadTargetingPolicy'
import { assessLeadEmailConfidence, assessLeadPreferredChannel, leadOutreachIdempotencyKey } from './LeadOutreachAutomation'
import { qualifyLead } from './LeadQualificationService'

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

  it('sempre apresenta Emerson, Hero Drone e o trabalho com imagens aéreas', () => {
    const generatedMessage = buildLeadWhatsAppMessage(prospect({
      aiFirstMessage: 'Tenho uma ideia especial para destacar o espaço de vocês. Posso mostrar?',
    }))
    expect(generatedMessage).toContain('Aqui é o Emerson, da Hero Drone')
    expect(generatedMessage).toContain('fotos e vídeos aéreos profissionais')
    expect(generatedMessage).toContain('Tenho uma ideia especial')

    const customUrl = buildLeadWhatsAppUrl(
      prospect({ whatsapp: '(41) 99999-9999' }),
      'Preparei uma sugestão personalizada para vocês.',
    )
    const sentMessage = new URL(customUrl).searchParams.get('text')
    expect(sentMessage).toContain('Aqui é o Emerson, da Hero Drone')
    expect(sentMessage).toContain('fotos e vídeos aéreos profissionais')
    expect(sentMessage).toContain('Preparei uma sugestão personalizada')
  })

  it('abre contatos do Lead Hunter exclusivamente no WhatsApp Web', () => {
    const url = buildLeadWhatsAppUrl(prospect({ whatsapp: '(41) 99999-9999' }), 'Mensagem de teste')
    expect(url).toContain('https://web.whatsapp.com/send?')
    expect(url).toContain('phone=5541999999999')
    expect(url).not.toContain('wa.me')
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
    expect(validation.whatsapp).toBe('Provável')
    expect(validation.email).toBe('Confirmado')
    expect(validation.instagram).toBe('Não informado')
  })

  it('prioriza hospedagem e exclui segmentos de baixo potencial', () => {
    expect(leadSegmentPriority('Chalé ou cabana')).toBe(3)
    expect(leadSegmentPriority('Clube e campo de golfe')).toBe(2)
    expect(leadSegmentPriority('Construtora ou incorporadora')).toBe(1)
    expect(isEligibleLeadSegment('Hotel ou hospedagem')).toBe(true)
    expect(isForbiddenLeadSegment('Restaurante')).toBe(true)
    expect(isEligibleLeadSegment('Clínica odontológica')).toBe(false)
  })

  it('coloca hospedagem independente do Booking e Airbnb no topo', () => {
    const focused = qualifyLead(prospect({
      name: 'Cabana Vista da Serra',
      categoryName: 'Casa de temporada',
      whatsapp: '41999999999',
      instagram: '@cabanavista',
      googleMapsUrl: 'https://google.com/maps/place/cabana',
      googleRating: 4.8,
      googleReviewCount: 84,
      website: 'https://airbnb.com/rooms/123',
      sourceUrls: ['https://booking.com/hotel/br/cabana-vista'],
      aiSocialInsight: 'Área externa, vista para a serra e ainda sem conteúdo aéreo profissional.',
    }))
    const chain = qualifyLead(prospect({
      name: 'Hotel Ibis Centro',
      categoryName: 'Hotel',
      googleReviewCount: 2400,
      whatsapp: '41999999999',
    }))
    expect(focused.tier).toBe('Pronto para abordar')
    expect(focused.total).toBeGreaterThan(chain.total)
    expect(focused.evidence).toContain('Presença identificada no Booking.com')
    expect(focused.evidence).toContain('Presença identificada no Airbnb')
  })

  it('manda hospedagem promissora sem contato para pesquisa', () => {
    const result = qualifyLead(prospect({
      name: 'Chácara Recanto Verde',
      categoryName: 'Chácara para locação',
      googleRating: 4.7,
      googleReviewCount: 32,
    }))
    expect(result.tier).toBe('Precisa de pesquisa')
    expect(result.missing).toContain('Encontrar um canal direto de contato')
  })

  it('só libera envio automático com e-mail confirmado e evidência forte', () => {
    const lead = prospect({
      email: 'contato@refugio.com.br',
      website: 'https://refugio.com.br',
      sourceUrls: ['https://refugio.com.br/contato'],
      contactValidation: {
        whatsapp: 'Não informado', instagram: 'Não informado',
        email: 'Confirmado', website: 'Confirmado', checkedAt: '2026-07-17T00:00:00.000Z',
      },
    })
    expect(assessLeadEmailConfidence(lead)).toMatchObject({ confidence: 'Alta', canSend: true })
    expect(leadOutreachIdempotencyKey(lead)).toContain('contato@refugio.com.br')
    expect(assessLeadEmailConfidence({ ...lead, lastContactAt: '2026-07-18T00:00:00.000Z' }).canSend).toBe(false)
  })

  it('usa um WhatsApp válido sem interromper o bot para revisão', () => {
    const decision = assessLeadPreferredChannel(prospect({
      whatsapp: '(41) 99999-9999',
      instagram: '@refugio',
      contactValidation: {
        whatsapp: 'Provável', instagram: 'Confirmado',
        email: 'Não informado', website: 'Não informado', checkedAt: '2026-07-17T00:00:00.000Z',
      },
    }))
    expect(decision).toMatchObject({ channel: 'WhatsApp', confidence: 'Média', canProceed: true })
  })

  it('segue sempre WhatsApp, Instagram e e-mail nesta ordem', () => {
    expect(assessLeadPreferredChannel(prospect({
      whatsapp: '41999999999', email: 'contato@empresa.com.br', instagram: '@empresa',
      contactValidation: {
        whatsapp: 'Confirmado', instagram: 'Confirmado',
        email: 'Confirmado', website: 'Não informado', checkedAt: '2026-07-17T00:00:00.000Z',
      },
    })).channel).toBe('WhatsApp')
    expect(assessLeadPreferredChannel(prospect({
      email: 'contato@empresa.com.br', instagram: '@empresa',
    })).channel).toBe('Instagram')
    expect(assessLeadPreferredChannel(prospect({
      instagram: '@empresa',
    })).channel).toBe('Instagram')
    expect(assessLeadPreferredChannel(prospect({
      email: 'contato@empresa.com.br',
    }))).toMatchObject({ channel: 'Email', canProceed: true })
    const noChannel = assessLeadPreferredChannel(prospect())
    expect(noChannel.canProceed).toBe(false)
    expect(noChannel.channel).toBeUndefined()
  })
})
