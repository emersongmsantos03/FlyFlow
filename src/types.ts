export const userRoles = [
  'Administrador',
  'Editor',
  'Piloto',
  'Financeiro',
  'Assistente',
] as const

export const userPermissions = [
  'viewDashboard',
  'manageLeads',
  'manageClients',
  'manageProjects',
  'manageAgenda',
  'manageQuotes',
  'manageFinance',
  'manageEquipment',
  'viewReports',
  'manageSettings',
  'manageUsers',
] as const

export const pipelineStages = [
  'Entrada',
  'Contato realizado',
  'Em negociação',
  'Proposta enviada',
  'Aguardando aprovação',
  'Aguardando entrada',
  'Serviço confirmado',
  'Retorno futuro',
  'Perdido',
  // Etapas legadas mantidas para migrar cadastros locais existentes.
  'Novo lead',
  'Primeiro contato',
  'Aguardando resposta',
  'Entendendo necessidade',
  'Orçamento solicitado',
  'Orçamento enviado',
  'Negociação',
  'Aguardando sinal',
  'Serviço agendado',
  'Convertido em cliente',
  'Contato futuro',
] as const

export const leadSources = [
  'Lead Hunter',
  'Instagram',
  'WhatsApp',
  'Google',
  'Indicação',
  'Facebook',
  'LinkedIn',
  'Prospecção ativa',
  'Grupo de WhatsApp',
  'Cliente antigo',
  'Site',
  'Anúncio pago',
  'Outro',
] as const

export const leadTemperatures = ['Frio', 'Morno', 'Quente'] as const

export const serviceTypes = [
  'Fotos aéreas',
  'Vídeo aéreo',
  'Vídeo para Reels',
  'Vídeo horizontal',
  'Fotos e vídeo',
  'Filmagem de imóvel',
  'Filmagem de chácara',
  'Filmagem de pousada',
  'Filmagem de Airbnb',
  'Filmagem de comércio',
  'Filmagem de evento',
  'Inspeção visual de telhado',
  'Inspeção de fachada',
  'Inspeção de calhas',
  'Acompanhamento de obra',
  'Filmagem de lote ou terreno',
  'Vídeo institucional',
  'Entrega de imagens brutas',
  'Edição de vídeo',
  'Pacote personalizado',
  'Outro',
] as const

export const projectStatuses = [
  'Aguardando agendamento',
  'Agendado',
  'Confirmação pendente',
  'Confirmado',
  'Captação realizada',
  'Em edição',
  'Pronto para revisão',
  'Aguardando aprovação do cliente',
  'Aguardando pagamento final',
  'Pago',
  'Entregue',
  'Concluído',
  'Pausado',
  'Cancelado',
  // Status legados mantidos para migração e leitura de dados existentes.
  'Orçamento',
  'Aguardando aprovação',
  'Aguardando sinal',
  'Seleção de arquivos',
  'Aguardando revisão',
  'Ajustes solicitados',
  'Pronto para entrega',
  'Finalizado',
  'Reagendado',
] as const

export const financialStatuses = [
  'Não faturado',
  'Aguardando sinal',
  'Parcialmente pago',
  'Pago',
  'Vencido',
  'Cancelado',
  'Reembolsado',
] as const

export const appointmentTypes = [
  'Tarefa',
  'Captação',
  'Reunião',
  'Follow-up',
  'Prazo de entrega',
  'Vencimento',
  'Edição',
  'Manutenção',
] as const

export const appointmentStatuses = [
  'Agendado',
  'Concluído',
  'Cancelado',
  'Reagendado',
] as const

export const revenueCategories = [
  'Fotos aéreas',
  'Vídeos',
  'Pacote de fotos e vídeos',
  'Inspeções',
  'Acompanhamento de obra',
  'Edição',
  'Venda de arquivos brutos',
  'Adicional de deslocamento',
  'Adicional de urgência',
  'Serviço extra',
  'Outro',
] as const

export const expenseCategories = [
  'Combustível',
  'Pedágio',
  'Estacionamento',
  'Alimentação em trabalho',
  'Manutenção do drone',
  'Manutenção do veículo',
  'Baterias',
  'Hélices',
  'Cartão de memória',
  'Equipamentos',
  'Acessórios',
  'Seguro',
  'Software',
  'Armazenamento em nuvem',
  'Internet',
  'Telefone',
  'Marketing',
  'Anúncios',
  'Impostos',
  'DAS',
  'Contabilidade',
  'Freelancer',
  'Música ou licença',
  'Taxas bancárias',
  'Reembolso',
  'Outro',
] as const

export const expenseTypes = [
  'Custo direto do projeto',
  'Despesa operacional',
  'Investimento em equipamento',
  'Despesa administrativa',
  'Imposto',
  'Despesa pessoal não contabilizável',
] as const

export const paymentMethods = [
  'PIX',
  'Dinheiro',
  'Transferência',
  'Cartão de crédito',
  'Cartão de débito',
  'Boleto',
  'Outro',
] as const

export const bankAccountTypes = [
  'Conta corrente',
  'Conta poupança',
  'Conta digital',
  'Carteira',
  'Dinheiro',
] as const

export const paymentTypes = [
  'Sinal',
  'Parcela',
  'Pagamento final',
  'Adicional',
  'Reembolso',
] as const

export const paymentStatuses = [
  'Prevista',
  'Pendente',
  'Parcialmente recebida',
  'Recebida',
  'Vencida',
  'Cancelada',
  'Reembolsada',
] as const

export const expenseStatuses = [
  'Prevista',
  'A pagar',
  'Paga',
  'Vencida',
  'Cancelada',
  'Reembolsada',
] as const

export const expenseRecurrenceFrequencies = [
  'Semanal',
  'Quinzenal',
  'Mensal',
  'Bimestral',
  'Trimestral',
  'Semestral',
  'Anual',
] as const

export const quoteStatuses = [
  'Rascunho',
  'Gerada',
  'Enviada',
  'Visualizada',
  'Em negociação',
  'Aprovada',
  'Aguardando entrada',
  'Entrada recebida',
  'Convertida em projeto',
  'Recusada',
  'Expirada',
  'Cancelada',
  'Arquivada',
  'Excluída logicamente',
  // Status legados mantidos para migração e leitura de dados existentes.
  'Enviado',
  'Visualizado',
  'Aprovado',
  'Recusado',
  'Expirado',
  'Cancelado',
] as const

export const equipmentConditions = [
  'Excelente',
  'Bom',
  'Precisa de atenção',
  'Em manutenção',
  'Danificado',
  'Inativo',
] as const

export type UserRole = (typeof userRoles)[number]
export type UserPermission = (typeof userPermissions)[number]
export type PipelineStage = (typeof pipelineStages)[number]
export type LeadSource = (typeof leadSources)[number]
export type LeadTemperature = (typeof leadTemperatures)[number]
export type ServiceType = (typeof serviceTypes)[number]
export type ProjectStatus = (typeof projectStatuses)[number]
export type FinancialStatus = (typeof financialStatuses)[number]
export type AppointmentType = (typeof appointmentTypes)[number]
export type AppointmentStatus = (typeof appointmentStatuses)[number]
export type RevenueCategory = (typeof revenueCategories)[number]
export type ExpenseCategory = (typeof expenseCategories)[number]
export type ExpenseType = (typeof expenseTypes)[number]
export type ExpenseStatus = (typeof expenseStatuses)[number]
export type ExpenseRecurrenceFrequency = (typeof expenseRecurrenceFrequencies)[number]
export type PaymentMethod = (typeof paymentMethods)[number]
export type BankAccountType = (typeof bankAccountTypes)[number]
export type PaymentType = (typeof paymentTypes)[number]
export type PaymentStatus = (typeof paymentStatuses)[number]
export type QuoteStatus = (typeof quoteStatuses)[number]
export type EquipmentCondition = (typeof equipmentConditions)[number]

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  permissions: UserPermission[]
  isPrimaryOwner?: boolean
  avatarUrl?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Lead {
  id: string
  contactId?: string
  fullName: string
  companyName: string
  phone: string
  whatsapp: string
  email: string
  instagram: string
  city: string
  neighborhood: string
  address: string
  source: LeadSource
  serviceInterest: ServiceType
  pipelineStage: PipelineStage
  temperature: LeadTemperature
  estimatedValue: number
  probability: number
  entryDate: string
  lastContactAt?: string
  nextContactAt?: string
  lossReason?: string
  notes: string
  leadHunterData?: LeadHunterProspect
  responsibleUserId: string
  archived: boolean
  archivedAt?: string
  archivedBy?: string
  deletedAt?: string
  deletedBy?: string
  deletionReason?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface LeadInteraction {
  id: string
  leadId: string
  interactionType: string
  description: string
  interactionDate: string
  userId: string
  createdAt: string
}

export interface Client {
  id: string
  companyId?: string
  fullName: string
  jobTitle?: string
  companyName: string
  document: string
  phone: string
  whatsapp: string
  email: string
  instagram: string
  neighborhood?: string
  postalCode?: string
  address: string
  city: string
  source: LeadSource
  notes: string
  tags: string[]
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Company {
  id: string
  legalName: string
  tradeName: string
  document: string
  email: string
  phone: string
  whatsapp: string
  website: string
  address: string
  neighborhood: string
  postalCode: string
  city: string
  notes: string
  tags: string[]
  archived: boolean
  createdAt: string
  updatedAt: string
}

export type LeadHunterPriority = 'Máxima' | 'Alta' | 'Média' | 'Baixa'
export type LeadHunterStatus = 'Descoberto' | 'Analisado' | 'Importado' | 'Contatado' | 'Adiado' | 'Descartado' | 'Bloqueado'

export interface LeadHunterCity {
  id: string
  name: string
  state: string
  distanceFromBaseKm: number
  active: boolean
  blockedUntil?: string
  lastSearchedAt?: string
  searchCount: number
  discoveredCount: number
  newLeadCount: number
  createdAt: string
  updatedAt: string
}

export interface LeadHunterCategory {
  id: string
  name: string
  group: string
  priority: LeadHunterPriority
  weight: number
  active: boolean
  searchTerms: string[]
  searchCount: number
  discoveredCount: number
  newLeadCount: number
  createdAt: string
  updatedAt: string
}

export interface LeadScoreReason {
  id: string
  label: string
  points: number
  evidence?: string
}

export interface LeadHunterProspect {
  id: string
  externalIds: Record<string, string>
  name: string
  contactName?: string
  normalizedName: string
  categoryId: string
  categoryName: string
  recommendedService?: ServiceType
  cityId?: string
  city: string
  neighborhood: string
  address: string
  latitude?: number
  longitude?: number
  distanceKm?: number
  phone: string
  whatsapp: string
  email: string
  instagram: string
  website: string
  googleMapsUrl: string
  googleRating?: number
  googleReviewCount?: number
  photoUrl?: string
  sources: string[]
  sourceUrls: string[]
  score: number
  scoreReasons: LeadScoreReason[]
  status: LeadHunterStatus
  isNew: boolean
  possibleDuplicateId?: string
  contactId?: string
  leadId?: string
  firstDiscoveredAt: string
  lastDiscoveredAt: string
  lastAnalyzedAt?: string
  lastDisplayedAt?: string
  lastContactAt?: string
  nextDisplayAllowedAt?: string
  discoveryCount: number
  displayCount: number
  lastSearchId?: string
  changedSinceLastDisplay: boolean
  reappearanceReason?: string
  discardedPermanently: boolean
  aiSummary?: string
  aiApproach?: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface LeadHunterSearch {
  id: string
  mode: 'Manual' | 'Rotação automática'
  cityIds: string[]
  categoryIds: string[]
  radiusKm: number
  neighborhood: string
  onlyNew: boolean
  includeEligibleKnown: boolean
  minimumScore: number
  sources: string[]
  totalFound: number
  newCount: number
  repeatedCount: number
  duplicateCount: number
  cooldownBlockedCount: number
  errorCount: number
  estimatedCost: number
  tokenUsage: number
  durationMs: number
  userId: string
  createdAt: string
}

export interface LeadHunterRoute {
  id: string
  name: string
  startAddress: string
  targetCity: string
  prospectIds: string[]
  visitedProspectIds: string[]
  status: 'Planejada' | 'Em andamento' | 'Concluída' | 'Cancelada'
  estimatedDistanceKm?: number
  estimatedDurationMinutes?: number
  googleMapsUrl: string
  notes: string
  plannedFor?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface LeadHunterSettings {
  radiusKm: number
  maxResultsPerSearch: number
  maxAnalysesPerBatch: number
  maxDailyCalls: number
  minimumNewLeadPercentage: number
  maximumReappearances: number
  cooldownDays: Record<'discovered' | 'analyzed' | 'contactedNoReply' | 'refused' | 'strongRefusal' | 'visited', number>
  scoringWeights: Record<string, number>
  categoryDistribution: Record<string, number>
  updatedAt: string
}

export interface ServiceCatalogItem {
  id: string
  name: ServiceType
  category: string
  description: string
  defaultPrice: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  projectCode: string
  name: string
  clientId: string
  leadId?: string
  quoteId?: string
  manualCreationReason?: string
  serviceId?: string
  serviceName: ServiceType
  description: string
  captureDate: string
  captureStartTime: string
  captureEndTime: string
  deliveryDeadline: string
  deliveryDeadlineNegotiated?: boolean
  deliveryDaysAfterCapture?: number
  deliveredAt?: string
  actualCaptureAt?: string
  editingStartedAt?: string
  originalDeliveryDeadline?: string
  reviewSentAt?: string
  finalDeliveryAt?: string
  completedAt?: string
  exceptionalDeliveryReason?: string
  address: string
  city: string
  contactName: string
  contactPhone: string
  totalValue: number
  estimatedHours?: number
  workedHours?: number
  discountValue: number
  travelFee: number
  depositValue: number
  remainingValue: number
  projectStatus: ProjectStatus
  financialStatus: FinancialStatus
  paymentMethod: PaymentMethod
  notes: string
  equipmentNeeded: string[]
  links: string[]
  responsibleUserId: string
  lastContactAt?: string
  archivedAt?: string
  archivedBy?: string
  deletedAt?: string
  deletedBy?: string
  deletionReason?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectChecklistItem {
  id: string
  projectId: string
  title: string
  category: 'Comercial' | 'Pré-produção' | 'Captação' | 'Pós-produção' | 'Financeiro e entrega' | 'Antes da captação' | 'Durante a captação' | 'Depois da captação'
  completed: boolean
  completedAt?: string
  orderIndex: number
  createdAt: string
}

export interface Appointment {
  id: string
  title: string
  appointmentType: AppointmentType
  clientId?: string
  leadId?: string
  projectId?: string
  quoteId?: string
  startAt: string
  endAt: string
  address: string
  notes: string
  status: AppointmentStatus
  color: string
  previousStartAt?: string
  externalEventId?: string
  calendarUrl?: string
  createGoogleCalendar?: boolean
  confirmationStatus?: 'Pendente' | 'Confirmado' | 'Aguardando resposta' | 'Reagendamento solicitado' | 'Cancelado'
  rescheduleReason?: string
  createdAt: string
  updatedAt: string
}

export interface Quote {
  id: string
  quoteNumber: string
  leadId?: string
  clientId?: string
  version?: number
  parentQuoteId?: string
  projectId?: string
  issueDate: string
  expirationDate: string
  subtotal: number
  discount: number
  travelFee: number
  urgencyFee: number
  totalValue: number
  depositValue: number
  deliveryDeadline: string
  paymentTerms: string
  status: QuoteStatus
  sentAt?: string
  viewedAt?: string
  approvedAt?: string
  approvedBy?: string
  approvalMethod?: 'Manual' | 'Link' | 'Aceite eletrônico'
  approvalNotes?: string
  refusalReason?: string
  cancellationReason?: string
  cancellationNotes?: string
  cancelledAt?: string
  cancelledBy?: string
  archivedAt?: string
  archivedBy?: string
  deletedAt?: string
  deletedBy?: string
  deletionReason?: string
  validityChangeReason?: string
  serviceLocation?: string
  responsibleUserId?: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface QuoteItem {
  id: string
  quoteId: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  createdAt: string
}

export interface Payment {
  id: string
  projectId?: string
  clientId: string
  leadId?: string
  quoteId?: string
  paymentType: PaymentType
  amount: number
  dueDate: string
  paidAt?: string
  paymentMethod: PaymentMethod
  status: PaymentStatus
  notes: string
  receiptUrl?: string
  bankAccountId?: string
  account?: string
  transactionNumber?: string
  confirmedReceived?: boolean
  confirmedAt?: string
  sourceKey?: string
  reversalOfPaymentId?: string
  reversedByPaymentId?: string
  installmentGroupId?: string
  installmentNumber?: number
  installmentCount?: number
  archivedAt?: string
  archivedBy?: string
  deletedAt?: string
  deletedBy?: string
  deletionReason?: string
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: string
  projectId?: string
  description: string
  category: ExpenseCategory
  expenseType: ExpenseType
  amount: number
  expenseDate: string
  dueDate?: string
  paidAt?: string
  paymentMethod: PaymentMethod
  status: ExpenseStatus
  supplier: string
  recurring: boolean
  recurrenceParentId?: string
  recurrenceNumber?: number
  installmentGroupId?: string
  installmentNumber?: number
  installmentCount?: number
  recurrenceFrequency?: ExpenseRecurrenceFrequency
  recurrenceEndDate?: string
  receiptUrl?: string
  bankAccountId?: string
  account?: string
  transactionNumber?: string
  archivedAt?: string
  archivedBy?: string
  deletedAt?: string
  deletedBy?: string
  deletionReason?: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface RecurringExpense {
  id: string
  description: string
  category: ExpenseCategory
  amount: number
  frequency: ExpenseRecurrenceFrequency
  nextChargeDate: string
  startDate: string
  endDate?: string
  paymentMethod: PaymentMethod
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface BankAccount {
  id: string
  name: string
  bankName: string
  accountType: BankAccountType
  agency?: string
  accountNumber?: string
  openingBalance: number
  statementBalance?: number
  reconciledAt?: string
  active: boolean
  notes: string
  createdAt: string
  updatedAt: string
}

export interface BankTransfer {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  transferredAt: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface ProjectFile {
  id: string
  projectId?: string
  clientId?: string
  leadId?: string
  quoteId?: string
  paymentId?: string
  fileName: string
  fileType: string
  fileUrl?: string
  externalLink?: string
  description: string
  clientVisible: boolean
  fileSize?: number
  uploadedBy?: string
  receiptStatus?: 'Anexado' | 'Conferido' | 'Recusado' | 'Substituir'
  verifiedAt?: string
  verifiedBy?: string
  archivedAt?: string
  deletedAt?: string
  deletedBy?: string
  deletionReason?: string
  createdAt: string
}

export interface ProjectRevision {
  id: string
  projectId: string
  revisionNumber: number
  requestDate: string
  description: string
  deadline: string
  status: 'Solicitada' | 'Em andamento' | 'Concluída' | 'Cancelada'
  completedAt?: string
  additionalCharge: boolean
  additionalValue: number
  createdAt: string
  updatedAt: string
}

export interface Equipment {
  id: string
  name: string
  category: string
  brand: string
  model: string
  serialNumber: string
  purchaseDate: string
  purchaseValue: number
  condition: EquipmentCondition
  lastMaintenanceDate?: string
  nextMaintenanceDate?: string
  notes: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface NotificationItem {
  id: string
  userId: string
  title: string
  message: string
  notificationType: string
  entityType?: string
  entityId?: string
  read: boolean
  createdAt: string
}

export interface TaskItem {
  id: string
  title: string
  description: string
  taskType?: 'Tarefa' | 'Ligação' | 'E-mail' | 'WhatsApp' | 'Follow-up'
  dueAt: string
  durationMinutes?: number
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente'
  status: 'Pendente' | 'Em andamento' | 'Concluída' | 'Cancelada'
  leadId?: string
  clientId?: string
  quoteId?: string
  projectId?: string
  appointmentId?: string
  responsibleUserId?: string
  sourceKey?: string
  createdAt: string
  updatedAt: string
}

export interface StatusHistoryItem {
  id: string
  entityType: 'Contato' | 'Proposta' | 'Projeto' | 'Pagamento' | 'Agendamento' | 'Conta bancária' | 'Transferência'
  entityId: string
  action: string
  fromStatus?: string
  toStatus?: string
  details: string
  userId?: string
  createdAt: string
}

export interface ProjectAdjustment {
  id: string
  projectId: string
  version: number
  description: string
  status: 'Solicitado' | 'Em andamento' | 'Concluído' | 'Cancelado'
  requestedAt: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CompanySettings {
  id: string
  companyName: string
  logoUrl?: string
  document: string
  phone: string
  email: string
  instagram: string
  address: string
  baseCity: string
  pixKey: string
  pixHolderName: string
  defaultDepositPercentage: number
  defaultDeliveryDays: number
  defaultFreeRevisions: number
  vehicleAverageConsumption: number
  fuelAveragePrice: number
  pricePerKm: number
  freeKm: number
  currency: 'BRL'
  timezone: 'America/Sao_Paulo'
  dateFormat: 'DD/MM/AAAA'
  paymentTerms: string
  createdAt: string
  updatedAt: string
}

export interface AppState {
  users: User[]
  leads: Lead[]
  leadInteractions: LeadInteraction[]
  clients: Client[]
  companies?: Company[]
  leadHunterCities?: LeadHunterCity[]
  leadHunterCategories?: LeadHunterCategory[]
  leadHunterProspects?: LeadHunterProspect[]
  leadHunterSearches?: LeadHunterSearch[]
  leadHunterRoutes?: LeadHunterRoute[]
  leadHunterSettings?: LeadHunterSettings
  services: ServiceCatalogItem[]
  projects: Project[]
  projectChecklistItems: ProjectChecklistItem[]
  appointments: Appointment[]
  quotes: Quote[]
  quoteItems: QuoteItem[]
  payments: Payment[]
  expenses: Expense[]
  recurringExpenses: RecurringExpense[]
  bankAccounts: BankAccount[]
  bankTransfers: BankTransfer[]
  files: ProjectFile[]
  projectRevisions: ProjectRevision[]
  equipment: Equipment[]
  notifications: NotificationItem[]
  tasks: TaskItem[]
  statusHistory: StatusHistoryItem[]
  projectAdjustments: ProjectAdjustment[]
  companySettings: CompanySettings
  updatedAt: string
}
