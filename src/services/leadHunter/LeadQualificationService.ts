import type { LeadHunterProspect, LeadQualification } from '../../types'

const normalize = (value = '') =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

const contains = (value: string, pattern: RegExp) => pattern.test(normalize(value))
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const LARGE_CHAINS =
  /ibis|accor|slaviero|bourbon|mercure|novotel|radisson|hilton|marriott|sheraton|intercity|transamerica|blue tree|mabu|nacional inn/
const LODGING =
  /airbnb|booking|pousada|chale|cabana|casa de temporada|hospedagem|hotel fazenda|glamping|refugio|chacara|sitio.*locacao/
const RENTAL =
  /airbnb|booking|casa de temporada|chale|cabana|pousada|hospedagem|chacara.*locacao|sitio.*locacao/

export const qualifyLead = (
  lead: Partial<LeadHunterProspect> & Pick<LeadHunterProspect, 'name' | 'categoryName'>,
): LeadQualification => {
  const searchable = [
    lead.name, lead.categoryName, lead.website, lead.instagram, lead.aiSummary,
    lead.aiSocialInsight, lead.aiContactHook, ...(lead.sources || []), ...(lead.sourceUrls || []),
  ].filter(Boolean).join(' ')
  const lodging = contains(searchable, LODGING)
  const rental = contains(searchable, RENTAL)
  const booking = contains(searchable, /booking\.com|\bbooking\b/)
  const airbnb = contains(searchable, /airbnb\.(com|com\.br)|\bairbnb\b/)
  const chain = contains(lead.name, LARGE_CHAINS)
  const directContact = Boolean(lead.whatsapp || lead.phone || lead.email || lead.instagram)
  const directMessaging = Boolean(lead.whatsapp || lead.instagram)
  const googlePresence = Boolean(lead.googleMapsUrl || lead.externalIds?.googlePlaces || lead.externalIds?.googleBusiness || lead.googleReviewCount)
  const reviewCount = lead.googleReviewCount || 0
  const healthyIndependentSize = reviewCount >= 5 && reviewCount <= 500
  const oversized = chain || reviewCount > 1500
  const visualNeed = contains(searchable, /sem (foto|video|imagem).*drone|sem conteudo aereo|imagem.*fraca|foto.*desatualizada|oportunidade visual/)
  const attractive = contains(searchable, /paisagem|natureza|area externa|vista|montanha|lago|piscina|jardim|rural|campo|chacara|sitio|cabana|chale/)
  const activeSignal = contains(searchable, /inaugur|reforma|nova unidade|temporada|evento|lancamento|recent|em funcionamento|reservas abertas/)
  const strongRating = Boolean(lead.googleRating && lead.googleRating >= 4.2)

  let fit = lodging ? 78 : 35
  if (rental) fit += 12
  if (booking) fit += 8
  if (airbnb) fit += 10
  if (chain) fit -= 42

  let visualOpportunity = lodging ? 62 : 40
  if (attractive) visualOpportunity += 20
  if (visualNeed) visualOpportunity += 18
  if (contains(searchable, /conteudo aereo profissional|drone profissional recente/)) visualOpportunity -= 25

  let buyingCapacity = lodging ? 55 : 40
  if (healthyIndependentSize) buyingCapacity += 18
  if (strongRating) buyingCapacity += 10
  if (booking || airbnb) buyingCapacity += 10
  if (oversized) buyingCapacity -= 25

  let timing = 38
  if (activeSignal) timing += 35
  if (lead.changedSinceLastDisplay) timing += 12
  if (visualNeed) timing += 12
  if (lead.lastContactAt) timing -= 18

  let contactability = directContact ? 58 : 15
  if (directMessaging) contactability += 22
  if (lead.contactName) contactability += 12
  if (lead.contactValidation?.whatsapp === 'Confirmado' || lead.contactValidation?.instagram === 'Confirmado') contactability += 8

  fit = clamp(fit)
  visualOpportunity = clamp(visualOpportunity)
  buyingCapacity = clamp(buyingCapacity)
  timing = clamp(timing)
  contactability = clamp(contactability)
  const total = clamp(fit * .32 + visualOpportunity * .23 + buyingCapacity * .18 + timing * .12 + contactability * .15)
  const tier = total >= 72 && directContact
    ? 'Pronto para abordar'
    : total >= 55 || (lodging && !directContact)
      ? 'Precisa de pesquisa'
      : 'Baixa prioridade'

  const evidence = [
    booking ? 'Presença identificada no Booking.com' : '',
    airbnb ? 'Presença identificada no Airbnb' : '',
    rental ? 'Hospedagem independente alinhada ao foco atual' : '',
    googlePresence ? 'Presença no Google Business' : '',
    healthyIndependentSize ? `${reviewCount} avaliações: porte compatível com atendimento próximo` : '',
    strongRating ? `Nota ${lead.googleRating} no Google` : '',
    attractive ? 'Espaço com apelo visual para imagens aéreas' : '',
    visualNeed ? 'Há indício de oportunidade para melhorar o conteúdo visual' : '',
    directMessaging ? 'Canal direto para abordagem disponível' : '',
    activeSignal ? 'Sinal de momento comercial identificado' : '',
    chain ? 'Grande rede: fora do perfil desejado neste momento' : '',
  ].filter(Boolean)
  const missing = [
    !directContact ? 'Encontrar um canal direto de contato' : '',
    !lead.contactName ? 'Identificar proprietário ou responsável' : '',
    !googlePresence ? 'Validar operação e reputação no Google' : '',
    !visualNeed ? 'Confirmar se já utiliza imagens aéreas profissionais' : '',
    !activeSignal ? 'Procurar um motivo de compra para agora' : '',
  ].filter(Boolean)

  const bestArgument = visualNeed
    ? 'Mostrar como imagens aéreas podem elevar a apresentação e as reservas do espaço.'
    : booking || airbnb
      ? 'Apresentar um ensaio aéreo pensado para destacar o espaço nos anúncios e redes sociais.'
      : attractive
        ? 'Demonstrar como uma visão aérea valoriza a estrutura, o entorno e a experiência do local.'
        : 'Validar primeiro a necessidade visual antes de oferecer uma produção.'

  return {
    fit, visualOpportunity, buyingCapacity, timing, contactability, total, tier,
    idealCustomerProfile: chain ? 'Grande rede — fora do foco atual' : lodging ? 'Hospedagem pequena ou média' : 'Segmento complementar',
    bestArgument, evidence, missing,
  }
}

export const qualificationPriority = (lead: LeadHunterProspect) => {
  const qualification = lead.qualification || qualifyLead(lead)
  const tierWeight = qualification.tier === 'Pronto para abordar' ? 20_000 : qualification.tier === 'Precisa de pesquisa' ? 10_000 : 0
  return tierWeight + qualification.total * 100 + qualification.contactability
}
