import type { LeadHunterSettings, LeadScoreReason } from '../../types'

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

export const leadScoreLabel = (score: number) => score >= 90 ? 'Oportunidade excelente' : score >= 75 ? 'Oportunidade muito boa' : score >= 60 ? 'Vale contato' : score >= 40 ? 'Baixa prioridade' : 'Não priorizar'
