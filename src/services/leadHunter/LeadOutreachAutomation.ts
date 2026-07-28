import type { LeadHunterProspect } from '../../types'

export type LeadOutreachConfidence = 'Alta' | 'Média' | 'Baixa'

export interface LeadOutreachAssessment {
  confidence: LeadOutreachConfidence
  canSend: boolean
  reason: string
}

export type LeadOutreachChannel = 'WhatsApp' | 'Email' | 'Instagram'

export interface LeadPreferredChannel {
  channel?: LeadOutreachChannel
  confidence: LeadOutreachConfidence
  canProceed: boolean
  reason: string
}

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const publicSource = (url: string) => /^https?:\/\//i.test(url)
const officialDomainMatches = (lead: LeadHunterProspect) => {
  if (!lead.website || !lead.email) return false
  try {
    const websiteHost = new URL(/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`)
      .hostname.replace(/^www\./, '').toLowerCase()
    const emailDomain = lead.email.split('@')[1]?.toLowerCase()
    return Boolean(emailDomain && (emailDomain === websiteHost || websiteHost.endsWith(`.${emailDomain}`)))
  } catch {
    return false
  }
}

export const assessLeadEmailConfidence = (lead: LeadHunterProspect): LeadOutreachAssessment => {
  const email = lead.email.trim().toLowerCase()
  if (!validEmail.test(email)) {
    return { confidence: 'Baixa', canSend: false, reason: 'E-mail ausente ou inválido.' }
  }
  if (lead.lastContactAt || lead.outreachEmail?.status === 'Enviado') {
    return { confidence: 'Baixa', canSend: false, reason: 'Este lead já possui contato registrado.' }
  }
  const validation = lead.contactValidation?.email
  const hasOfficialMatch = officialDomainMatches(lead)
  const evidenceCount = new Set((lead.sourceUrls || []).filter(publicSource)).size
  if (hasOfficialMatch && validation === 'Confirmado' && evidenceCount >= 1) {
    return { confidence: 'Alta', canSend: true, reason: 'E-mail confirmado e domínio igual ao site oficial.' }
  }
  if (validation === 'Confirmado' && evidenceCount >= 2) {
    return { confidence: 'Alta', canSend: true, reason: 'E-mail confirmado por múltiplas evidências públicas.' }
  }
  return {
    confidence: 'Média',
    canSend: false,
    reason: hasOfficialMatch
      ? 'O domínio coincide, mas falta confirmação suficiente da fonte.'
      : 'E-mail localizado, porém a associação com a empresa precisa de revisão.',
  }
}

export const assessLeadPreferredChannel = (lead: LeadHunterProspect): LeadPreferredChannel => {
  if (lead.lastContactAt || lead.outreachEmail?.status === 'Enviado') {
    return { confidence: 'Baixa', canProceed: false, reason: 'Este lead já possui contato registrado.' }
  }
  const whatsappValue = lead.whatsapp || lead.phone
  const whatsappDigits = whatsappValue.replace(/\D/g, '')
  if (lead.whatsapp && whatsappDigits.length >= 10 && whatsappDigits.length <= 13) {
    const confirmed = lead.contactValidation?.whatsapp === 'Confirmado'
    return {
      channel: 'WhatsApp',
      confidence: confirmed ? 'Alta' : 'Média',
      canProceed: true,
      reason: confirmed
        ? 'WhatsApp confirmado por vínculo explícito no CRM ou link oficial.'
        : 'Número de WhatsApp válido disponível como primeiro canal da prospecção.',
    }
  }
  if (lead.instagram.trim()) {
    const confirmed = lead.contactValidation?.instagram === 'Confirmado'
    return {
      channel: 'Instagram',
      confidence: confirmed ? 'Alta' : 'Média',
      canProceed: true,
      reason: confirmed
        ? 'Perfil do Instagram confirmado durante a pesquisa.'
        : 'Instagram disponível como segundo canal da prospecção.',
    }
  }
  if (validEmail.test(lead.email.trim().toLowerCase())) {
    const email = assessLeadEmailConfidence(lead)
    return {
      channel: 'Email',
      confidence: email.confidence === 'Baixa' ? 'Média' : email.confidence,
      canProceed: true,
      reason: email.canSend ? email.reason : 'E-mail válido disponível como último canal da prospecção.',
    }
  }
  return {
    confidence: 'Baixa',
    canProceed: false,
    reason: 'Nenhum WhatsApp, Instagram ou e-mail válido foi localizado.',
  }
}

export const leadOutreachIdempotencyKey = (lead: LeadHunterProspect) =>
  `lead-hunter:first-email:v1:${lead.id}:${lead.email.trim().toLowerCase()}`

export const buildLeadOutreachEmail = (lead: LeadHunterProspect) => {
  const businessName = lead.name.trim()
  const service = lead.recommendedService || 'vídeo institucional com drone'
  const storedHook = lead.aiContactHook?.trim() || lead.aiSummary?.trim()
  const hook = storedHook && !/cadastrad[oa]\s+manualmente|fluxo comercial|para teste/i.test(storedHook)
    ? storedHook
    : `Identifiquei uma oportunidade de fortalecer a apresentação da ${businessName} com imagens aéreas profissionais.`
  return {
    subject: `Uma ideia visual para ${businessName}`,
    body: `Olá! Tudo bem?

Aqui é o Emerson, da Hero Drone. ${hook}

Preparei uma ideia de ${service.toLocaleLowerCase('pt-BR')} pensada para destacar o espaço, a localização e os diferenciais da ${businessName} nas redes sociais e no Google.

Posso te apresentar essa proposta em uma conversa rápida, sem compromisso?

Abraço,
Emerson
Hero Drone`,
  }
}
