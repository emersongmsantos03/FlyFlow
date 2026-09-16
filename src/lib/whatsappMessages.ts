import type { Lead, ServiceType } from '../types'

const displayName = (lead: Lead) => lead.companyName?.trim() || lead.fullName?.trim() || 'Contato sem nome'

// Cada nicho (a partir do serviço de interesse) ganha um ângulo e um benefício
// próprios, para a mensagem soar como algo pensado para aquele negócio
// específico em vez de um texto genérico com a palavra do serviço trocada.
type NicheProfile = { angle: string; benefit: string }

const serviceNicheProfiles: Partial<Record<ServiceType, NicheProfile>> = {
  'Filmagem de imóvel': {
    angle: 'imagens aéreas que mostram o imóvel por inteiro, com destaque para localização e diferenciais',
    benefit: 'atrair mais interessados e agilizar a venda ou locação',
  },
  'Filmagem de lote ou terreno': {
    angle: 'imagens aéreas que mostram as dimensões reais e o entorno do terreno',
    benefit: 'facilitar a decisão de quem está avaliando comprar',
  },
  'Filmagem de chácara': {
    angle: 'um vídeo aéreo que mostra a experiência completa do espaço — área externa, vista e estrutura',
    benefit: 'conquistar mais reservas e se destacar nos anúncios',
  },
  'Filmagem de pousada': {
    angle: 'um vídeo aéreo que mostra a experiência completa da pousada, da fachada à vista',
    benefit: 'conquistar mais reservas e se destacar nos anúncios',
  },
  'Filmagem de Airbnb': {
    angle: 'fotos e vídeo aéreo que mostram o diferencial do espaço logo nas primeiras fotos do anúncio',
    benefit: 'se destacar entre os outros anúncios e conquistar mais reservas',
  },
  'Filmagem de comércio': {
    angle: 'fotos e vídeo aéreo que valorizam a fachada e a estrutura do estabelecimento',
    benefit: 'fortalecer a presença online e atrair mais clientes',
  },
  'Filmagem de evento': {
    angle: 'uma cobertura aérea que registra a energia do evento com um ângulo que o resto da produção não tem',
    benefit: 'um material que vocês vão usar por muito tempo na divulgação',
  },
  'Inspeção visual de telhado': {
    angle: 'uma inspeção aérea segura e rápida, sem precisar subir no telhado',
    benefit: 'identificar problemas cedo e economizar com manutenção',
  },
  'Inspeção de fachada': {
    angle: 'uma inspeção aérea segura e rápida, sem precisar de andaime',
    benefit: 'identificar problemas cedo e economizar com manutenção',
  },
  'Inspeção de calhas': {
    angle: 'uma inspeção aérea das calhas sem precisar de acesso de risco',
    benefit: 'identificar entupimentos antes que virem um transtorno maior',
  },
  'Acompanhamento de obra': {
    angle: 'um acompanhamento aéreo periódico da evolução da obra',
    benefit: 'documentar o progresso com clareza para quem acompanha o projeto',
  },
  'Vídeo institucional': {
    angle: 'um vídeo institucional aéreo que fortalece a imagem da empresa',
    benefit: 'transmitir mais credibilidade para clientes e parceiros',
  },
}

const defaultNicheProfile: NicheProfile = {
  angle: 'conteúdo aéreo profissional, sob medida para o que vocês precisam',
  benefit: 'um material com um padrão visual diferente do que a concorrência costuma usar',
}

const nicheProfileFor = (lead: Lead): NicheProfile => {
  const service = lead.leadHunterData?.recommendedService || lead.serviceInterest
  return (service && serviceNicheProfiles[service]) || defaultNicheProfile
}

const firstNameGreeting = (lead: Lead, punctuation: string) => {
  const company = displayName(lead)
  const contactName = lead.leadHunterData?.contactName?.trim()
  return contactName && contactName.toLocaleLowerCase('pt-BR') !== company.toLocaleLowerCase('pt-BR')
    ? `Olá, ${contactName.split(/\s+/)[0]}${punctuation}`
    : 'Olá! Tudo bem?'
}

/** Primeira abordagem: usa a mensagem gerada por IA no Lead Hunter quando
 * existir (já personalizada com dados reais do negócio); caso contrário,
 * monta uma mensagem profissional com o ângulo do nicho do serviço. */
export const buildPriorityWhatsAppMessage = (lead: Lead) => {
  const aiMessage = lead.leadHunterData?.aiFirstMessage?.trim()
  if (aiMessage) return aiMessage

  const company = displayName(lead)
  const greeting = firstNameGreeting(lead, '! Tudo bem?')
  const { angle, benefit } = nicheProfileFor(lead)

  return [
    greeting,
    'Sou o Emerson, da Hero Drone — trabalhamos com imagens aéreas profissionais.',
    `Conheci a ${company} e pensei em ${angle}, para ${benefit}.`,
    'Posso te mostrar rapidinho um exemplo do que tenho em mente?',
  ].join(' ')
}

export const whatsappContexts = [
  'Primeiro contato',
  'Acompanhamento',
  'Sem resposta',
  'Interesse demonstrado',
  'Enviar portfólio',
  'Enviar proposta',
  'Retomada',
] as const
export type WhatsAppContext = (typeof whatsappContexts)[number]

export const buildContextualWhatsAppMessage = (lead: Lead, context: WhatsAppContext) => {
  const firstMessage = buildPriorityWhatsAppMessage(lead)
  const company = displayName(lead)
  const greeting = firstNameGreeting(lead, '!')
  const { angle, benefit } = nicheProfileFor(lead)
  const messages: Record<WhatsAppContext, string> = {
    'Primeiro contato': firstMessage,
    'Acompanhamento': `${greeting} Aqui é o Emerson, da Hero Drone. Passando para saber se você chegou a ver minha mensagem sobre ${angle} para a ${company}. Se fizer sentido, te explico rapidinho como funciona.`,
    'Sem resposta': `${greeting} Prometo ser breve: se ${benefit} estiver nos planos da ${company}, posso te mandar uma sugestão objetiva, sem compromisso. Se não for o momento, sem problema nenhum.`,
    'Interesse demonstrado': `${greeting} Que bom que a ideia fez sentido! Para eu montar uma proposta certeira para a ${company}, posso te fazer duas perguntas rápidas sobre o espaço e o que vocês querem destacar?`,
    'Enviar portfólio': `${greeting} Separei alguns trabalhos parecidos com o que a ${company} precisa, para você ver na prática ${angle}. Te envio o portfólio e, se gostar da linha, já preparo uma ideia específica para vocês.`,
    'Enviar proposta': `${greeting} Preparei a proposta para a ${company} com ${angle}. Posso te enviar agora? Se quiser, explico rapidinho cada etapa e o prazo de entrega.`,
    'Retomada': `${greeting} Aqui é o Emerson, da Hero Drone. Faz um tempo que conversamos sobre a ${company} — ainda faz sentido pensarmos em ${angle}? Se quiser, retomo com uma condição especial.`,
  }
  return messages[context]
}
