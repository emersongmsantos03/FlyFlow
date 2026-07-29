import type { LeadHunterSettings, LeadScoreReason } from '../../types'
import type { LeadHunterProspect } from '../../types'

export interface LeadScoringSignals {
  noDroneContent?: boolean
  outdatedInstagram?: boolean
  largeOutdoorArea?: boolean
  visuallyAttractive?: boolean
  goodGoogleRating?: boolean
  relevantReviews?: boolean
  incompleteData?: boolean
  outsideServiceArea?: boolean
  recentContact?: boolean
  duplicate?: boolean
  professionalDroneContent?: boolean
}

const labels: Record<keyof LeadScoringSignals, string> = {
  noDroneContent: 'Sem conteúdo de drone identificado', outdatedInstagram: 'Instagram desatualizado',
  largeOutdoorArea: 'Grande área externa', visuallyAttractive: 'Local visualmente atrativo',
  goodGoogleRating: 'Boa nota no Google', relevantReviews: 'Quantidade relevante de avaliações',
  incompleteData: 'Dados incompletos', outsideServiceArea: 'Fora da área de atendimento',
  recentContact: 'Contato realizado recentemente', duplicate: 'Possível duplicidade',
  professionalDroneContent: 'Conteúdo aéreo profissional recente',
}

export const calculateLeadScore = (signals: LeadScoringSignals, settings: LeadHunterSettings) => {
  const reasons: LeadScoreReason[] = Object.entries(signals).flatMap(([key, enabled]) => {
    if (!enabled) return []
    const points = settings.scoringWeights[key] ?? 0
    return [{ id: key, label: labels[key as keyof LeadScoringSignals], points }]
  })
  const score = Math.max(0, Math.min(100, 50 + reasons.reduce((total, reason) => total + reason.points, 0)))
  return { score, reasons }
}

export const leadScoreLabel = (score: number) => score >= 85 ? 'Excelente' : score >= 70 ? 'Boa' : score >= 50 ? 'Média' : 'Ruim'

/**
 * Pontuação comercial v2.0. Parte de zero e usa somente sinais sustentados
 * pela pesquisa pública; campo desconhecido nunca recebe pontos.
 */
export const calculateVisualOpportunityScore = (
  lead: Partial<LeadHunterProspect>,
): { score: number; reasons: LeadScoreReason[] } => {
  const visual = lead.visualAssessment || {}
  const rules: Array<[boolean, string, string, number]> = [
    [visual.hasDroneImages === false, 'no-drone', 'Sem imagens de drone identificadas', 30],
    [visual.simpleImages === true, 'simple-images', 'Fotos simples ou amadoras', 20],
    [visual.largeOutdoorArea === true, 'outdoor-area', 'Grande área aberta', 15],
    [visual.strikingNature === true, 'nature', 'Natureza marcante', 15],
    [visual.poolLakeOrView === true, 'water-or-view', 'Piscina, lago ou vista panorâmica', 10],
    [visual.activeInstagram === true, 'active-instagram', 'Instagram ativo', 10],
    [visual.professionalWebsite === true, 'professional-site', 'Site profissional', 10],
    [Boolean(lead.airbnbUrl), 'airbnb', 'Presença confirmada no Airbnb', 10],
    [Boolean(lead.bookingUrl), 'booking', 'Presença confirmada no Booking.com', 10],
    [Boolean(lead.googleRating && lead.googleRating > 4.8), 'rating', 'Nota superior a 4,8', 10],
    [Boolean(lead.googleReviewCount && lead.googleReviewCount > 100), 'reviews', 'Mais de 100 avaliações', 10],
    [visual.goodVisualIdentity === true, 'visual-identity', 'Boa identidade visual', 5],
    [visual.beautifulArchitecture === true, 'architecture', 'Arquitetura bonita', 5],
  ]
  const reasons = rules.filter(([enabled]) => enabled).map(([, id, label, points]) => ({ id, label, points }))
  return { score: Math.min(100, reasons.reduce((sum, reason) => sum + reason.points, 0)), reasons }
}
