import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  ContactRound,
  Copy,
  DollarSign,
  Download,
  Eye,
  FileText,
  Handshake,
  LayoutDashboard,
  Landmark,
  LogOut,
  Mail,
  Menu,
  MapPin,
  MessageCircle,
  Moon,
  PackageCheck,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  Wand2,
  X,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useForm } from 'react-hook-form'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button, InputField, MetricCard, Modal, Panel, StatusBadge, Tag, Toast } from './components/ui'
import { CrmPage, type CrmView } from './components/crm/CrmPage'
const LeadHunterPage = lazy(() => import('./components/leadHunter/LeadHunterPage').then((module) => ({ default: module.LeadHunterPage })))
import {
  buildLeadSourceSeries,
  buildMonthlySeries,
  buildServiceSeries,
  calculateDashboardMetrics,
  getProjectDirectCosts,
  getProjectPaidAmount,
  getProjectProfit,
  getPeriodRange,
  getBankAccountBalance,
  getFinancialForecast,
  getMonthlyRecurringExpenseAmount,
  getPaymentCashEffect,
  getTotalBankBalance,
  isExpenseOverdue,
  isOfficialExpense,
  isPaidExpense,
  isPaymentOverdue,
  periodOptions,
  recalculateProjectFinancials,
  type AccountingRegime,
  type PeriodPreset,
} from './lib/financial'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDaysUntil,
  daysUntil,
  mapsLink,
  slugify,
  whatsappLink,
} from './lib/format'
import {
  downloadUrl,
  getBrowserSafeFileUrl,
  getFilePreviewMode,
  openUrlInNewTab,
} from './lib/files'
import { allPermissions, can, canOpenPage, permissionLabels, permissionSummary, rolePermissionPresets } from './lib/permissions'
import {
  addCalendarDays,
  buildGoogleCalendarUrl,
  calendarDaysBetween,
  createOperationalChecklist,
  createStatusHistory,
  getNextQuoteNumber,
  getNextQuoteVersionNumber,
  synchronizeOperationalState,
} from './lib/operations'
import {
  appointmentFormSchema,
  clientFormSchema,
  companyFormSchema,
  equipmentFormSchema,
  expenseFormSchema,
  leadFormSchema,
  loginSchema,
  paymentFormSchema,
  projectFormSchema,
  quoteFormSchema,
  settingsFormSchema,
  type AppointmentFormValues,
  type AppointmentFormInput,
  type ClientFormInput,
  type ClientFormValues,
  type CompanyFormInput,
  type CompanyFormValues,
  type EquipmentFormInput,
  type EquipmentFormValues,
  type ExpenseFormInput,
  type ExpenseFormValues,
  type LeadFormInput,
  type LeadFormValues,
  type LoginFormInput,
  type LoginFormValues,
  type PaymentFormInput,
  type PaymentFormValues,
  type ProjectFormInput,
  type ProjectFormValues,
  type QuoteFormInput,
  type QuoteFormValues,
  type SettingsFormInput,
  type SettingsFormValues,
} from './lib/validation'
import {
  authenticateUser,
  clearAuthSession,
  createUserAuthAccount,
  ensurePrimaryAuthAccount,
  getAuthSession,
  PRIMARY_OWNER,
  requestLocalPasswordReset,
  saveAuthSession,
  updateUserPassword,
} from './services/auth'
import { createId, loadAppState, normalizeAppState, resetAppState, saveAppState } from './services/storage'
import { OpenStreetMapLeadProvider } from './services/leadHunter/OpenStreetMapProvider'
import { enrichLeadsWithOpenAI, isOpenAILeadEnrichmentConfigured } from './services/leadHunter/OpenAILeadEnricher'
import { findLeadDuplicates, normalizeLeadText } from './services/leadHunter/LeadDeduplicationService'
import { leadContactPriority, refineLeadOpportunity } from './services/leadHunter/LeadOpportunityService'
import { loadCloudAppState, saveCloudAppState } from './services/cloudStorage'
import {
  isFirebaseConfigured,
  observeFirebaseAuth,
  requestFirebasePasswordReset,
  signInWithFirebase,
  signOutFromFirebase,
} from './services/firebase'
import {
  clearActiveFirebaseWorkspace,
  createFirebaseWorkspaceUser,
  ensureFirebaseWorkspace,
  loadFirebaseAppState,
  saveFirebaseAppState,
  setFirebaseWorkspaceUserActive,
} from './services/firebaseData'
import { syncGoogleCalendarEvent } from './services/googleCalendar'
import { isSupabaseConfigured, supabase } from './services/supabase'
import {
  appointmentStatuses,
  appointmentTypes,
  bankAccountTypes,
  equipmentConditions,
  expenseCategories,
  expenseRecurrenceFrequencies,
  expenseStatuses,
  expenseTypes,
  leadSources,
  leadTemperatures,
  paymentMethods,
  paymentStatuses,
  paymentTypes,
  quoteStatuses,
  serviceTypes,
  type AppState,
  type Appointment,
  type BankAccount,
  type BankTransfer,
  type Client,
  type Company,
  type Equipment,
  type Expense,
  type Lead,
  type Payment,
  type PipelineStage,
  type Project,
  type ProjectChecklistItem,
  type Quote,
  type QuoteItem,
  type TaskItem,
  type User,
  type UserPermission,
  type UserRole,
} from './types'

type Page =
  | 'dashboard'
  | 'leads'
  | 'clients'
  | 'leadHunter'
  | 'projects'
  | 'agenda'
  | 'quotes'
  | 'finance'
  | 'equipment'
  | 'reports'
  | 'settings'
  | 'users'

type FinanceTab = 'dashboard' | 'receitas' | 'despesas' | 'receber' | 'fluxo' | 'contas' | 'arquivados'

type ModalType =
  | 'lead'
  | 'leadDetail'
  | 'client'
  | 'company'
  | 'project'
  | 'appointment'
  | 'task'
  | 'payment'
  | 'expense'
  | 'bankAccount'
  | 'bankTransfer'
  | 'quote'
  | 'proposal'
  | 'proposalOptions'
  | 'quotePayment'
  | 'closeDeal'
  | 'receipt'
  | 'serviceConfirmed'
  | 'proposalCancel'
  | 'proposalDelete'
  | 'user'
  | 'equipment'
  | null

interface ConfirmDialogState {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'warning'
  onConfirm: () => void
}

interface NoticeDialogState {
  title: string
  description: string
  buttonLabel?: string
  tone?: 'neutral' | 'warning' | 'danger'
}

interface InputDialogState {
  title: string
  description?: string
  label: string
  placeholder?: string
  initialValue?: string
  inputType?: 'text' | 'password' | 'url' | 'textarea'
  required?: boolean
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'neutral' | 'warning' | 'danger'
  onSubmit: (value: string) => void
}

interface ServiceConfirmationState {
  leadId: string
  previousStage: PipelineStage
  quoteId?: string
}

interface TaskFormDefaults {
  leadId?: string
  clientId?: string
  dueAt?: string
  durationMinutes?: number
}

interface TaskFormValues {
  title: string
  description: string
  taskType: NonNullable<TaskItem['taskType']>
  dueAt: string
  durationMinutes: number
  priority: TaskItem['priority']
  leadId?: string
  clientId?: string
  responsibleUserId?: string
}

interface UserFormValues {
  name: string
  email: string
  password: string
  role: UserRole
  permissions: UserPermission[]
}

interface ProposalItemDraft {
  description: string
  quantity: number
  unitPrice: number
}

interface ProposalFormValues {
  quoteId?: string
  clientId?: string
  leadId?: string
  title: string
  packageId: string
  items: ProposalItemDraft[]
  discount: number
  travelFee: number
  urgencyFee: number
  depositPercentage: number
  expirationDate: string
  validityChangeReason: string
  deliveryDeadline: string
  paymentTerms: string
  notes: string
  status: Quote['status']
}

interface CloseDealFormValues {
  leadId: string
  quoteId?: string
  projectName: string
  serviceName: Project['serviceName']
  totalValue: number
  depositPercentage: number
  depositValue: number
  depositPaid: boolean
  depositPaidAt: string
  paymentMethod: Payment['paymentMethod']
  captureDate: string
  captureStartTime: string
  captureEndTime: string
  deliveryDeadline: string
  address: string
  city: string
  contactName: string
  contactPhone: string
  notes: string
}

interface QuotePaymentFormValues {
  amount: number
  paidAt: string
  paymentMethod: Payment['paymentMethod']
  bankAccountId: string
  account: string
  transactionNumber: string
  receiptUrl: string
  notes: string
  confirmedReceived: boolean
}

interface BankAccountFormValues {
  name: string
  bankName: string
  accountType: BankAccount['accountType']
  agency: string
  accountNumber: string
  openingBalance: number
  statementBalance?: number
  reconciledAt?: string
  active: boolean
  notes: string
}

interface BankTransferFormValues {
  fromAccountId: string
  toAccountId: string
  amount: number
  transferredAt: string
  description: string
}

interface ReceiptFormValues {
  receipts: Array<{
    receiptUrl: string
    fileName: string
    fileType: string
    fileSize?: number
    status: NonNullable<import('./types').ProjectFile['receiptStatus']>
  }>
}

type AppointmentFormDefaults = Partial<AppointmentFormValues>

type GoogleAddressPrediction = {
  description: string
  place_id: string
}

type GoogleAutocompleteService = {
  getPlacePredictions: (
    request: {
      input: string
      componentRestrictions?: { country: string }
      types?: string[]
    },
    callback: (predictions: GoogleAddressPrediction[] | null) => void,
  ) => void
}

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => GoogleAutocompleteService
        }
      }
    }
    __flyFlowGoogleMapsPromise?: Promise<boolean>
  }
}

const proposalPackages: Array<{
  id: string
  name: string
  description: string
  deliveryDays: number
  items: ProposalItemDraft[]
}> = [
  {
    id: 'reels-imovel',
    name: 'Reels para imóvel ou comércio',
    description: 'Captação rápida com vídeo vertical pronto para redes sociais.',
    deliveryDays: 5,
    items: [
      { description: 'Captação aérea com drone', quantity: 1, unitPrice: 250 },
      { description: 'Vídeo vertical de até 60 segundos', quantity: 1, unitPrice: 220 },
      { description: 'Tratamento básico de cor e trilha', quantity: 1, unitPrice: 80 },
    ],
  },
  {
    id: 'fotos-video',
    name: 'Fotos e vídeo completo',
    description: 'Pacote comercial com fotos editadas, vídeo vertical e arquivos selecionados.',
    deliveryDays: 7,
    items: [
      { description: 'Fotos aéreas editadas', quantity: 15, unitPrice: 18 },
      { description: 'Vídeo vertical para Reels', quantity: 1, unitPrice: 250 },
      { description: 'Entrega de melhores arquivos brutos', quantity: 1, unitPrice: 120 },
    ],
  },
  {
    id: 'pousada-airbnb',
    name: 'Pousada, chácara ou Airbnb',
    description: 'Apresentação visual para hospedagens e propriedades de lazer.',
    deliveryDays: 8,
    items: [
      { description: 'Captação aérea externa', quantity: 1, unitPrice: 300 },
      { description: 'Fotos editadas para anúncio', quantity: 20, unitPrice: 18 },
      { description: 'Vídeo horizontal ou vertical de até 90 segundos', quantity: 1, unitPrice: 350 },
    ],
  },
  {
    id: 'inspecao',
    name: 'Inspeção visual',
    description: 'Registro técnico para telhado, fachada, calhas ou acompanhamento de obra.',
    deliveryDays: 3,
    items: [
      { description: 'Vistoria aérea com drone', quantity: 1, unitPrice: 450 },
      { description: 'Fotos técnicas organizadas', quantity: 1, unitPrice: 120 },
      { description: 'Relatório visual simples', quantity: 1, unitPrice: 180 },
    ],
  },
]

const navigation: Array<{ page: Page; label: string; icon: typeof LayoutDashboard }> = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'leads', label: 'Comercial', icon: Handshake },
  { page: 'clients', label: 'Contatos', icon: ContactRound },
  { page: 'leadHunter', label: 'Lead Hunter', icon: Search },
  { page: 'projects', label: 'Projetos', icon: Briefcase },
  { page: 'agenda', label: 'Agenda', icon: CalendarDays },
  { page: 'quotes', label: 'Propostas', icon: FileText },
  { page: 'finance', label: 'Financeiro', icon: DollarSign },
  { page: 'equipment', label: 'Equipamentos', icon: PackageCheck },
  { page: 'reports', label: 'Relatórios', icon: BarChart3 },
  { page: 'settings', label: 'Configurações', icon: Settings },
  { page: 'users', label: 'Usuários', icon: UserCog },
]

const chartColors = ['#d8a500', '#16a34a', '#2563eb', '#dc2626', '#7c3aed', '#0891b2']
const heroLogoSrc = './hero-drone-logo.png'
const appName = 'FlyFlow by Hero Drone'
const appShortName = 'FlyFlow'
const appSubtitle = 'by Hero Drone'
const googleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim()
const googleMapsScriptId = 'flyflow-google-maps-places'
const customPackageId = 'personalizado'
const appointmentColorOptions = [
  { label: 'Ouro', value: '#d8a500' },
  { label: 'Azul', value: '#2563eb' },
  { label: 'Verde', value: '#16a34a' },
  { label: 'Vermelho', value: '#dc2626' },
  { label: 'Roxo', value: '#7c3aed' },
  { label: 'Ciano', value: '#0891b2' },
  { label: 'Laranja', value: '#ea580c' },
  { label: 'Rosa', value: '#db2777' },
  { label: 'Cinza', value: '#64748b' },
  { label: 'Preto', value: '#171717' },
] as const

const loadGoogleMapsPlaces = () => {
  if (typeof window === 'undefined' || !googleMapsApiKey) return Promise.resolve(false)
  if (window.google?.maps?.places?.AutocompleteService) return Promise.resolve(true)

  if (!window.__flyFlowGoogleMapsPromise) {
    window.__flyFlowGoogleMapsPromise = new Promise<boolean>((resolve, reject) => {
      const existingScript = document.getElementById(googleMapsScriptId) as HTMLScriptElement | null
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(Boolean(window.google?.maps?.places?.AutocompleteService)), { once: true })
        existingScript.addEventListener('error', () => reject(new Error('Google Maps script failed')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.id = googleMapsScriptId
      script.async = true
      script.defer = true
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=places&language=pt-BR&region=BR`
      script.onload = () => resolve(Boolean(window.google?.maps?.places?.AutocompleteService))
      script.onerror = () => reject(new Error('Google Maps script failed'))
      document.head.appendChild(script)
    }).catch(() => false)
  }

  return window.__flyFlowGoogleMapsPromise
}

const getError = (message: unknown) => (typeof message === 'string' ? message : undefined)

const dateInput = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

const dateTimeInput = (offset = 0, hour = 9, minute = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  date.setHours(hour, minute, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const dateInputFromDate = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const dateTimeInputFromDate = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${dateInputFromDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const getDurationMinutes = (startAt?: string, endAt?: string) => {
  if (!startAt || !endAt) return 60
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  const minutes = Math.round((end - start) / 60_000)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 60
}

const formatDurationLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours > 0 && remainingMinutes > 0) return `${hours}h ${remainingMinutes}min`
  if (hours > 0) return `${hours}h`
  return `${minutes}min`
}

const asIsoFromInput = (value: string) => new Date(value).toISOString()

const matches = (value: string, query: string) => slugify(value).includes(slugify(query))

const projectClient = (state: AppState, project: Project) =>
  state.clients.find((client) => client.id === project.clientId) ??
  (project.leadId ? state.leads.find((lead) => lead.id === project.leadId) : undefined)

const isVisibleProject = (project: Project) => !project.deletedAt && !project.archivedAt

const sameContact = (lead: Lead, client: Client) => {
  const leadWhatsapp = lead.whatsapp.replace(/\D/g, '')
  const leadPhone = lead.phone.replace(/\D/g, '')
  const clientWhatsapp = client.whatsapp.replace(/\D/g, '')
  const clientPhone = client.phone.replace(/\D/g, '')
  return (
    (leadWhatsapp && (leadWhatsapp === clientWhatsapp || leadWhatsapp === clientPhone)) ||
    (leadPhone && (leadPhone === clientPhone || leadPhone === clientWhatsapp)) ||
    (lead.email && client.email && lead.email.toLowerCase() === client.email.toLowerCase())
  )
}

const findClientForLead = (clients: Client[], lead: Lead) =>
  clients.find((client) => sameContact(lead, client))

const createClientFromLead = (lead: Lead, now: string): Client => ({
  id: createId('client'),
  fullName: lead.fullName || lead.companyName || lead.whatsapp || lead.phone || lead.email || lead.instagram || lead.city || 'Contato sem nome',
  companyName: lead.companyName,
  document: '',
  phone: lead.phone,
  whatsapp: lead.whatsapp,
  email: lead.email,
  instagram: lead.instagram,
  address: lead.address,
  city: lead.city,
  source: lead.source,
  notes: lead.notes,
  tags: lead.tags,
  archived: false,
  createdAt: now,
  updatedAt: now,
})

const contactDisplayName = (contact: Pick<Lead | Client, 'fullName' | 'companyName' | 'whatsapp' | 'phone' | 'email' | 'instagram' | 'city'>) =>
  contact.fullName ||
  contact.companyName ||
  contact.whatsapp ||
  contact.phone ||
  contact.email ||
  contact.instagram ||
  contact.city ||
  'Contato sem nome'

const contactDisplayDetail = (contact: Pick<Lead | Client, 'companyName' | 'fullName' | 'city'>) =>
  [contact.companyName && contact.companyName !== contact.fullName ? contact.companyName : '', contact.city].filter(Boolean).join(' • ') || 'Sem detalhes'

const normalizeContactValues = <T extends LeadFormValues | ClientFormValues>(values: T): T => {
  const displayName =
    values.fullName.trim() ||
    values.companyName.trim() ||
    values.whatsapp.trim() ||
    values.phone.trim() ||
    values.email.trim() ||
    values.instagram.trim() ||
    values.city.trim() ||
    'Contato sem nome'

  return {
    ...values,
    fullName: displayName,
    companyName: values.companyName.trim(),
    phone: values.phone.trim(),
    whatsapp: values.whatsapp.trim(),
    email: values.email.trim(),
    instagram: values.instagram.trim(),
  }
}

const parseCurrencyInput = (value: string) => {
  const cents = Number(value.replace(/\D/g, ''))
  return Number.isFinite(cents) ? cents / 100 : 0
}

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const getProposalServiceOptions = (state: AppState) => {
  const byName = new Set<string>()
  const addOption = (name: string) => {
    const normalizedName = name.trim()
    if (normalizedName) byName.add(normalizedName)
  }

  state.services
    .filter((service) => service.active)
    .forEach((service) => addOption(service.name))
  proposalPackages.forEach((proposalPackage) =>
    proposalPackage.items.forEach((item) => addOption(item.description)),
  )
  serviceTypes.forEach((service) => addOption(service))

  return Array.from(byName).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

const getQuoteServiceName = (lead: Lead, items: QuoteItem[]): Project['serviceName'] => {
  const matchedItem = items.find((item) => serviceTypes.includes(item.description as Project['serviceName']))
  return (matchedItem?.description as Project['serviceName'] | undefined) ?? lead.serviceInterest ?? 'Pacote personalizado'
}

const getNextProjectStatus = (project: Project): Project['projectStatus'] | undefined => {
  const flow: Project['projectStatus'][] = [
    'Aguardando agendamento',
    'Agendado',
    'Confirmação pendente',
    'Confirmado',
    'Em edição',
    'Pronto para revisão',
    'Aguardando aprovação do cliente',
    'Aguardando pagamento final',
    'Pago',
    'Entregue',
    'Concluído',
  ]
  if (project.projectStatus === 'Aguardando sinal') return 'Aguardando agendamento'
  if (project.projectStatus === 'Captação realizada') return 'Em edição'
  if (project.projectStatus === 'Pronto para entrega') return 'Aguardando pagamento final'
  if (project.projectStatus === 'Finalizado') return 'Concluído'
  const index = flow.indexOf(project.projectStatus)
  return index >= 0 && index < flow.length - 1 ? flow[index + 1] : undefined
}

const projectDeliveryDateTime = (deadline: string, hour: number) =>
  new Date(`${deadline}T${String(hour).padStart(2, '0')}:00`).toISOString()

const createProjectDeliveryAppointment = (project: Project, now: string, id = createId('appt')): Appointment => ({
  id,
  title: `Entrega ${project.name}`,
  appointmentType: 'Prazo de entrega',
  clientId: project.clientId,
  leadId: project.leadId,
  projectId: project.id,
  startAt: projectDeliveryDateTime(project.deliveryDeadline, 18),
  endAt: projectDeliveryDateTime(project.deliveryDeadline, 19),
  address: project.address,
  notes: `Prazo de entrega do projeto ${project.projectCode}.`,
  status: project.projectStatus === 'Entregue' || project.projectStatus === 'Finalizado' ? 'Concluído' : 'Agendado',
  color: '#dc2626',
  createdAt: now,
  updatedAt: now,
})

const leadNeedsContact = (lead: Lead) => {
  if (lead.archived || lead.deletedAt || lead.pipelineStage === 'Serviço confirmado' || lead.pipelineStage === 'Convertido em cliente' || lead.pipelineStage === 'Serviço agendado') return false
  if (!lead.nextContactAt) return true
  if (!lead.lastContactAt) return true
  const last = new Date(lead.lastContactAt)
  const now = new Date()
  return now.getTime() - last.getTime() > 7 * 86_400_000
}

const commercialStageRank: Partial<Record<PipelineStage, number>> = {
  Entrada: 0,
  'Contato realizado': 1,
  'Em negociação': 2,
  'Proposta enviada': 3,
  'Aguardando aprovação': 4,
  'Aguardando entrada': 5,
  'Serviço confirmado': 6,
}

const keepMostAdvancedCommercialStage = (currentStage: PipelineStage, proposedStage: PipelineStage): PipelineStage => {
  const currentRank = commercialStageRank[currentStage]
  const proposedRank = commercialStageRank[proposedStage]
  if (currentRank !== undefined && proposedRank !== undefined && currentRank > proposedRank) return currentStage
  return proposedStage
}

const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const content = [
    headers.join(';'),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? '').replaceAll('"', '""')}"`)
        .join(';'),
    ),
  ].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const getQuoteRecipient = (state: AppState, quote: Quote) => {
  const client = quote.clientId ? state.clients.find((item) => item.id === quote.clientId) : undefined
  const lead = quote.leadId ? state.leads.find((item) => item.id === quote.leadId) : undefined

  if (client) {
    return {
      type: 'Cliente',
      name: client.fullName,
      company: client.companyName,
      phone: client.phone,
      whatsapp: client.whatsapp,
      email: client.email,
      instagram: client.instagram,
      address: client.address,
      city: client.city,
    }
  }

  if (lead) {
    return {
      type: 'Lead',
      name: lead.fullName,
      company: lead.companyName,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      instagram: lead.instagram,
      address: lead.address,
      city: lead.city,
    }
  }

  return {
    type: 'Destinatário',
    name: '',
    company: 'Cliente',
    phone: '',
    whatsapp: '',
    email: '',
    instagram: '',
    address: '',
    city: '',
  }
}

const sanitizeFilenamePart = (value: string) =>
  Array.from(value.normalize('NFD'))
    .filter((char) => char >= ' ')
    .join('')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const getQuoteTitle = (quote: Quote) => quote.notes.split(/\n+/).find((line) => line.trim())?.trim() || 'Proposta comercial'

const getQuoteDisplayTitle = (quote: Quote, recipientCompany = '') => {
  const title = getQuoteTitle(quote)
  const company = recipientCompany.trim()
  if (company && slugify(title) !== slugify(company)) return `${company} - ${title}`
  if (company) return `Proposta comercial - ${company}`
  return title
}

const getQuotePdfFilename = (quote: Quote, recipientCompany = '') => {
  const company = sanitizeFilenamePart(recipientCompany) || 'Cliente'
  return `Proposta Comercial - ${company} - ${quote.quoteNumber}.pdf`
}

const SARPAS_URL = 'https://servicos.decea.mil.br/sarpas/'

const loadImageDataUrl = async (src: string) => {
  const response = await fetch(src)
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const hasWorkspaceData = (candidate: AppState) =>
  candidate.leads.length > 0 ||
  candidate.leadInteractions.length > 0 ||
  candidate.clients.length > 0 ||
  candidate.projects.length > 0 ||
  candidate.appointments.length > 0 ||
  candidate.quotes.length > 0 ||
  candidate.payments.length > 0 ||
  candidate.expenses.length > 0 ||
  candidate.recurringExpenses.length > 0 ||
  candidate.files.length > 0 ||
  candidate.tasks.length > 0 ||
  candidate.users.length > 1

const resolveFirebaseState = (cloudState: AppState | null, localState: AppState) => {
  const localUpdatedAt = new Date(localState.updatedAt || 0).getTime()
  const cloudUpdatedAt = new Date(cloudState?.updatedAt || 0).getTime()
  const localHasData = hasWorkspaceData(localState)
  const cloudHasData = Boolean(cloudState && hasWorkspaceData(cloudState))
  const shouldMigrateLocal = Boolean(
    cloudState && localHasData && (!cloudHasData || localUpdatedAt > cloudUpdatedAt),
  )
  return {
    state: normalizeAppState(shouldMigrateLocal ? localState : cloudState ?? localState),
    shouldSave: !cloudState || shouldMigrateLocal,
  }
}

function App() {
  const [state, setState] = useState<AppState>(() => loadAppState())
  const [authSession, setAuthSession] = useState(() => getAuthSession())
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(!isFirebaseConfigured)
  const firebaseLoginInProgress = useRef(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = window.localStorage.getItem('hero-drone-manager:theme:v2')
    if (stored === 'light' || stored === 'dark') return stored
    return 'dark'
  })
  const [page, setPage] = useState<Page>('dashboard')
  const [modal, setModal] = useState<ModalType>(null)
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<PeriodPreset>('month')
  const [regime, setRegime] = useState<AccountingRegime>('cash')
  const [leadView, setLeadView] = useState<CrmView>(() => {
    const stored = window.localStorage.getItem('flyflow:crm-view')
    return stored === 'table' || stored === 'tasks' ? stored : 'kanban'
  })
  const [financeTab, setFinanceTab] = useState<FinanceTab>('dashboard')
  const [calendarView, setCalendarView] = useState<'mensal' | 'semanal' | 'diaria' | 'lista'>('diaria')
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  useEffect(() => {
    if (!mobileMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) }
  }, [mobileMenuOpen])
  const [selectedProposalClientId, setSelectedProposalClientId] = useState<string>('')
  const [selectedProposalLeadId, setSelectedProposalLeadId] = useState<string>('')
  const [selectedProposalQuoteId, setSelectedProposalQuoteId] = useState<string>('')
  const [selectedLeadId, setSelectedLeadId] = useState<string>('')
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedCloseDealLeadId, setSelectedCloseDealLeadId] = useState<string>('')
  const [selectedCloseDealQuoteId, setSelectedCloseDealQuoteId] = useState<string>('')
  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState<string>('')
  const [selectedQuotePaymentId, setSelectedQuotePaymentId] = useState<string>('')
  const [selectedPaymentProjectId, setSelectedPaymentProjectId] = useState<string>('')
  const [selectedFinancePaymentId, setSelectedFinancePaymentId] = useState<string>('')
  const [selectedFinanceExpenseId, setSelectedFinanceExpenseId] = useState<string>('')
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('')
  const [selectedBankTransferId, setSelectedBankTransferId] = useState<string>('')
  const [selectedQuoteActionId, setSelectedQuoteActionId] = useState<string>('')
  const [serviceConfirmation, setServiceConfirmation] = useState<ServiceConfirmationState | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('')
  const [appointmentDefaults, setAppointmentDefaults] = useState<AppointmentFormDefaults>({})
  const [taskDefaults, setTaskDefaults] = useState<TaskFormDefaults>({})
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [noticeDialog, setNoticeDialog] = useState<NoticeDialogState | null>(null)
  const [inputDialog, setInputDialog] = useState<InputDialogState | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured && !isSupabaseConfigured) void ensurePrimaryAuthAccount()
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) return

    let cancelled = false
    const unsubscribe = observeFirebaseAuth((firebaseUser) => {
      if (firebaseLoginInProgress.current) return

      void (async () => {
        if (!firebaseUser) {
          clearActiveFirebaseWorkspace()
          clearAuthSession()
          if (!cancelled) {
            setAuthSession(null)
            setFirebaseAuthReady(true)
          }
          return
        }

        try {
          await ensureFirebaseWorkspace(firebaseUser)
          const localState = loadAppState()
          const cloudState = await loadFirebaseAppState(localState)
          const resolved = resolveFirebaseState(cloudState, localState)
          const resolvedState = resolved.state
          const internalUser = resolvedState.users.find(
            (user) => user.email.toLowerCase() === firebaseUser.email?.toLowerCase(),
          )

          if (!internalUser?.active) {
            await signOutFromFirebase()
            clearActiveFirebaseWorkspace()
            clearAuthSession()
            if (!cancelled) {
              setAuthSession(null)
              setToast('Usuário sem perfil interno ativo.')
            }
            return
          }

          if (resolved.shouldSave) await saveFirebaseAppState(resolvedState)
          if (cancelled) return

          setState(resolvedState)
          const existingSession = getAuthSession()
          if (!existingSession || existingSession.email.toLowerCase() !== internalUser.email.toLowerCase()) {
            saveAuthSession({ userId: internalUser.id, email: internalUser.email }, true)
          }
          setAuthSession(getAuthSession())
        } catch (error) {
          await signOutFromFirebase().catch(() => undefined)
          clearActiveFirebaseWorkspace()
          clearAuthSession()
          if (!cancelled) {
            setAuthSession(null)
            setToast(error instanceof Error ? error.message : 'Não foi possível carregar o Firebase.')
          }
        } finally {
          if (!cancelled) setFirebaseAuthReady(true)
        }
      })()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const refreshAutomations = () => setState((current) => synchronizeOperationalState(current))
    const interval = window.setInterval(refreshAutomations, 30 * 60_000)
    window.addEventListener('focus', refreshAutomations)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshAutomations)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('hero-drone-manager:theme:v2', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('flyflow:crm-view', leadView)
  }, [leadView])

  useEffect(() => {
    saveAppState(state)
    if (!authSession) return

    if (isFirebaseConfigured) {
      const timeout = window.setTimeout(() => {
        void saveFirebaseAppState(state).catch((error) =>
          setToast(error instanceof Error ? error.message : 'Não foi possível sincronizar as alterações com o Firebase.'),
        )
      }, 600)
      return () => window.clearTimeout(timeout)
    }

    if (!isSupabaseConfigured) return
    const timeout = window.setTimeout(() => {
      void saveCloudAppState(state).catch(() => setToast('Não foi possível sincronizar as alterações com o Supabase.'))
    }, 600)
    return () => window.clearTimeout(timeout)
  }, [authSession, state])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const metrics = useMemo(() => calculateDashboardMetrics(state, period, regime), [period, regime, state])
  const monthlySeries = useMemo(() => buildMonthlySeries(state, regime), [regime, state])
  const cashMonthlySeries = useMemo(() => buildMonthlySeries(state, 'cash'), [state])
  const leadSourceSeries = useMemo(() => buildLeadSourceSeries(state), [state])
  const serviceSeries = useMemo(() => buildServiceSeries(state), [state])
  const currentUser = useMemo(
    () => state.users.find((user) => user.id === authSession?.userId && user.active),
    [authSession?.userId, state.users],
  )
  const activeUserId = currentUser?.id ?? PRIMARY_OWNER.id
  const availableNavigation = useMemo(
    () => navigation.filter((item) => canOpenPage(currentUser, item.page)),
    [currentUser],
  )
  const availableMobileNavigation = useMemo(
    () => availableNavigation.filter((item) => ['dashboard', 'leads', 'projects', 'agenda', 'finance'].includes(item.page)),
    [availableNavigation],
  )

  useEffect(() => {
    if (!authSession) return
    if (!currentUser) {
      clearAuthSession()
      setAuthSession(null)
      return
    }

    if (!canOpenPage(currentUser, page)) {
      setPage(availableNavigation[0]?.page ?? 'dashboard')
    }
  }, [authSession, availableNavigation, currentUser, page])

  const filteredLeads = useMemo(
    () =>
      state.leads.filter((lead) =>
        query.trim()
          ? matches(
              `${lead.fullName} ${lead.companyName} ${lead.city} ${lead.phone} ${lead.email} ${lead.serviceInterest}`,
              query,
            )
          : true,
      ),
    [query, state.leads],
  )

  const filteredClients = useMemo(
    () =>
      state.clients.filter((client) =>
        query.trim()
          ? matches(`${client.fullName} ${client.companyName} ${client.city} ${client.phone} ${client.email}`, query)
          : true,
      ),
    [query, state.clients],
  )

  const filteredProjects = useMemo(
    () =>
      state.projects.filter((project) => {
        if (project.deletedAt || project.archivedAt) return false
        const client = projectClient(state, project)
        return query.trim()
          ? matches(
              `${project.projectCode} ${project.name} ${project.city} ${project.serviceName} ${client?.fullName ?? ''} ${client?.companyName ?? ''}`,
              query,
            )
          : true
      }),
    [query, state],
  )

  const selectedCloseDealLead = useMemo(
    () => state.leads.find((lead) => lead.id === selectedCloseDealLeadId),
    [selectedCloseDealLeadId, state.leads],
  )
  const selectedLead = useMemo(
    () => state.leads.find((lead) => lead.id === selectedLeadId),
    [selectedLeadId, state.leads],
  )
  const selectedClient = useMemo(() => state.clients.find((client) => client.id === selectedClientId), [selectedClientId, state.clients])
  const selectedProposalQuote = useMemo(
    () => state.quotes.find((quote) => quote.id === selectedProposalQuoteId),
    [selectedProposalQuoteId, state.quotes],
  )
  const relatedProposalQuotes = useMemo(
    () => state.quotes.filter((quote) =>
      (selectedProposalLeadId && quote.leadId === selectedProposalLeadId) ||
      (selectedProposalClientId && quote.clientId === selectedProposalClientId),
    ),
    [selectedProposalClientId, selectedProposalLeadId, state.quotes],
  )
  const activeRelatedProposalQuotes = useMemo(
    () => relatedProposalQuotes.filter((quote) => !quote.deletedAt && !quote.archivedAt),
    [relatedProposalQuotes],
  )
  const relatedProposalDraft = activeRelatedProposalQuotes.find((quote) => quote.status === 'Rascunho' || quote.status === 'Gerada')
  const latestRelatedProposal = activeRelatedProposalQuotes[0]
  const selectedCloseDealQuote = useMemo(
    () => state.quotes.find((quote) => quote.id === selectedCloseDealQuoteId),
    [selectedCloseDealQuoteId, state.quotes],
  )
  const selectedReceiptPayment = useMemo(
    () => state.payments.find((payment) => payment.id === selectedReceiptPaymentId),
    [selectedReceiptPaymentId, state.payments],
  )
  const selectedQuotePayment = useMemo(
    () => state.quotes.find((quote) => quote.id === selectedQuotePaymentId),
    [selectedQuotePaymentId, state.quotes],
  )
  const selectedQuoteAction = useMemo(
    () => state.quotes.find((quote) => quote.id === selectedQuoteActionId),
    [selectedQuoteActionId, state.quotes],
  )
  const selectedFinancePayment = useMemo(
    () => state.payments.find((payment) => payment.id === selectedFinancePaymentId),
    [selectedFinancePaymentId, state.payments],
  )
  const selectedFinanceExpense = useMemo(
    () => state.expenses.find((expense) => expense.id === selectedFinanceExpenseId),
    [selectedFinanceExpenseId, state.expenses],
  )
  const selectedBankAccount = useMemo(
    () => state.bankAccounts.find((account) => account.id === selectedBankAccountId),
    [selectedBankAccountId, state.bankAccounts],
  )
  const selectedBankTransfer = useMemo(
    () => state.bankTransfers.find((transfer) => transfer.id === selectedBankTransferId),
    [selectedBankTransferId, state.bankTransfers],
  )
  const selectedAppointment = useMemo(
    () => state.appointments.find((appointment) => appointment.id === selectedAppointmentId),
    [selectedAppointmentId, state.appointments],
  )
  const selectedProject = useMemo(
    () => state.projects.find((project) => project.id === selectedProjectId),
    [selectedProjectId, state.projects],
  )
  const selectedEquipment = useMemo(
    () => state.equipment.find((equipment) => equipment.id === selectedEquipmentId),
    [selectedEquipmentId, state.equipment],
  )

  const updateState = (producer: (current: AppState) => AppState, message: string) => {
    setState((current) => synchronizeOperationalState(producer(current)))
    setToast(message)
  }

  const requestConfirm = (dialog: ConfirmDialogState) => {
    setConfirmDialog(dialog)
  }

  const showNotice = (dialog: NoticeDialogState) => {
    setNoticeDialog(dialog)
  }

  const requestInput = (dialog: InputDialogState) => {
    setInputDialog(dialog)
  }

  const cancelConfirm = () => {
    setConfirmDialog(null)
  }

  const runConfirmAction = () => {
    const action = confirmDialog?.onConfirm
    setConfirmDialog(null)
    action?.()
  }

  const closeProposalModal = () => {
    setModal(null)
    setSelectedProposalClientId('')
    setSelectedProposalLeadId('')
    setSelectedProposalQuoteId('')
  }

  const openProposalGenerator = (clientId = '', leadId = '', quoteId = '') => {
    setSelectedProposalClientId(clientId)
    setSelectedProposalLeadId(leadId)
    setSelectedProposalQuoteId(quoteId)
    if (quoteId) {
      const quote = state.quotes.find((item) => item.id === quoteId)
      if (quote && !['Rascunho', 'Gerada'].includes(quote.status)) {
        setModal('proposalOptions')
        setToast('Propostas já enviadas são preservadas. Crie uma revisão ou nova proposta.')
        return
      }
      setModal('proposal')
      return
    }
    const hasPrevious = state.quotes.some((quote) =>
      !quote.deletedAt && !quote.archivedAt && ((leadId && quote.leadId === leadId) || (clientId && quote.clientId === clientId)),
    )
    setModal(hasPrevious ? 'proposalOptions' : 'proposal')
  }

  const cloneProposal = (source: Quote, asVersion: boolean) => {
    const now = new Date().toISOString()
    const issueDate = dateInput()
    const versionData = asVersion ? getNextQuoteVersionNumber(state.quotes, source) : undefined
    const quoteId = createId('quote')
    const quoteNumber = versionData?.quoteNumber ?? getNextQuoteNumber(state.quotes)
    updateState(
      (current) => ({
        ...current,
        quotes: [
          {
            ...source,
            id: quoteId,
            quoteNumber,
            version: versionData?.version ?? 0,
            parentQuoteId: asVersion ? source.parentQuoteId ?? source.id : undefined,
            projectId: undefined,
            issueDate,
            expirationDate: addCalendarDays(issueDate, 7),
            status: 'Rascunho',
            sentAt: undefined,
            viewedAt: undefined,
            approvedAt: undefined,
            approvedBy: undefined,
            approvalMethod: undefined,
            refusalReason: undefined,
            createdAt: now,
            updatedAt: now,
          },
          ...current.quotes,
        ],
        quoteItems: [
          ...current.quoteItems
            .filter((item) => item.quoteId === source.id)
            .map((item) => ({ ...item, id: createId('qitem'), quoteId, createdAt: now })),
          ...current.quoteItems,
        ],
        statusHistory: [
          createStatusHistory('Proposta', quoteId, asVersion ? 'Revisão criada' : 'Proposta duplicada', `${quoteNumber} criada a partir de ${source.quoteNumber}.`, activeUserId, undefined, 'Rascunho', now),
          ...current.statusHistory,
        ],
      }),
      asVersion ? 'Revisão criada sem alterar a proposta original.' : 'Nova proposta duplicada.',
    )
    setSelectedProposalQuoteId(quoteId)
    setSelectedProposalClientId(source.clientId ?? '')
    setSelectedProposalLeadId(source.leadId ?? '')
    setModal('proposal')
  }

  const openCloseDeal = (leadId: string, quoteId = '') => {
    setSelectedCloseDealLeadId(leadId)
    setSelectedCloseDealQuoteId(quoteId)
    setModal('closeDeal')
  }

  const openLeadModal = (lead?: Lead) => {
    setSelectedLeadId(lead?.id ?? '')
    setModal('lead')
  }

  const openLeadDetail = (lead: Lead) => {
    setSelectedLeadId(lead.id)
    setModal(null)
  }

  const registerLeadInteraction = (lead: Lead, interactionType: string) => {
    requestInput({
      title: `Registrar ${interactionType.toLowerCase()}`,
      description: `Adicione os detalhes da atividade com ${contactDisplayName(lead)}.`,
      label: 'Descrição',
      inputType: 'textarea',
      required: true,
      confirmLabel: 'Registrar atividade',
      onSubmit: (description) => {
        const now = new Date().toISOString()
        updateState((current) => ({
          ...current,
          leads: current.leads.map((item) => item.id === lead.id ? { ...item, lastContactAt: now, pipelineStage: item.pipelineStage === 'Entrada' ? 'Contato realizado' : item.pipelineStage, updatedAt: now } : item),
          leadInteractions: [{ id: createId('int'), leadId: lead.id, interactionType, description, interactionDate: now, userId: activeUserId, createdAt: now }, ...current.leadInteractions],
          statusHistory: [createStatusHistory('Contato', lead.id, interactionType, description, activeUserId, lead.pipelineStage, lead.pipelineStage, now), ...current.statusHistory],
        }), `${interactionType} registrado.`)
      },
    })
  }

  const openAppointmentModal = (defaults: AppointmentFormDefaults = {}, appointment?: Appointment) => {
    setSelectedAppointmentId(appointment?.id ?? '')
    setAppointmentDefaults(defaults)
    setModal('appointment')
  }

  const openTaskModal = (defaults: TaskFormDefaults = {}) => {
    setTaskDefaults(defaults)
    setModal('task')
  }

  const openExistingAppointment = (appointment: Appointment) => {
    openAppointmentModal(
      {
        title: appointment.title,
        appointmentType: appointment.appointmentType,
        clientId: appointment.clientId ?? '',
        leadId: appointment.leadId ?? '',
        projectId: appointment.projectId ?? '',
        startAt: dateTimeInputFromDate(new Date(appointment.startAt)),
        endAt: dateTimeInputFromDate(new Date(appointment.endAt)),
        address: appointment.address,
        notes: appointment.notes,
        status: appointment.status,
        color: appointment.color,
        createGoogleCalendar: appointment.createGoogleCalendar ?? true,
        rescheduleReason: '',
      },
      appointment,
    )
  }

  const openProjectModal = (project?: Project) => {
    setSelectedProjectId(project?.id ?? '')
    setModal('project')
  }

  const handleLogin = async (values: LoginFormValues) => {
    if (isFirebaseConfigured) {
      firebaseLoginInProgress.current = true
      try {
        const credential = await signInWithFirebase(values.email, values.password, values.remember)
        await ensureFirebaseWorkspace(credential.user)
        const cloudState = await loadFirebaseAppState(state)
        const resolved = resolveFirebaseState(cloudState, state)
        const resolvedState = resolved.state
        const internalUser = resolvedState.users.find(
          (item) => item.email.toLowerCase() === values.email.trim().toLowerCase(),
        )

        if (!internalUser?.active) {
          await signOutFromFirebase()
          clearActiveFirebaseWorkspace()
          setToast('Usuário sem perfil interno ativo.')
          return
        }

        setState(resolvedState)
        if (resolved.shouldSave) await saveFirebaseAppState(resolvedState)

        saveAuthSession({ userId: internalUser.id, email: internalUser.email }, values.remember)
        setAuthSession(getAuthSession())
        setPage(
          canOpenPage(internalUser, 'dashboard')
            ? 'dashboard'
            : navigation.find((item) => canOpenPage(internalUser, item.page))?.page ?? 'dashboard',
        )
        setToast('Login realizado e dados sincronizados com o Firebase.')
      } catch (error) {
        await signOutFromFirebase().catch(() => undefined)
        clearActiveFirebaseWorkspace()
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
        setToast(
          code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
            ? 'E-mail ou senha inválidos.'
            : error instanceof Error
              ? error.message
              : 'Não foi possível entrar com o Firebase.',
        )
      } finally {
        firebaseLoginInProgress.current = false
      }
      return
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: values.email.trim().toLowerCase(), password: values.password })
      if (error) {
        setToast('E-mail ou senha inválidos no Supabase.')
        return
      }
      const internalUser = state.users.find((item) => item.email.toLowerCase() === values.email.trim().toLowerCase())
      if (!internalUser?.active) {
        await supabase.auth.signOut()
        setToast('Usuário sem perfil interno ativo.')
        return
      }
      saveAuthSession({ userId: internalUser.id, email: internalUser.email }, values.remember)
      setAuthSession(getAuthSession())
      try {
        const cloudState = await loadCloudAppState()
        if (cloudState) setState(normalizeAppState(cloudState))
        else await saveCloudAppState(state)
      } catch {
        setToast('Login realizado, mas não foi possível carregar o banco remoto.')
        return
      }
      setPage(canOpenPage(internalUser, 'dashboard') ? 'dashboard' : navigation.find((item) => canOpenPage(internalUser, item.page))?.page ?? 'dashboard')
      setToast('Login e sincronização com Supabase realizados.')
      return
    }
    const account = await authenticateUser(values.email, values.password)
    if (!account) {
      setToast('E-mail ou senha inválidos.')
      return
    }

    const user = state.users.find((item) => item.email.toLowerCase() === account.email.toLowerCase())
    if (!user?.active) {
      setToast('Usuário inativo ou sem cadastro interno.')
      return
    }

    saveAuthSession(account, values.remember)
    setAuthSession(getAuthSession())
    const userNavigation = navigation.filter((item) => canOpenPage(user, item.page))
    setPage(canOpenPage(user, 'dashboard') ? 'dashboard' : userNavigation[0]?.page ?? 'dashboard')
    setToast('Login realizado.')
  }

  const handleLogout = () => {
    if (isFirebaseConfigured) {
      void signOutFromFirebase()
      clearActiveFirebaseWorkspace()
    } else if (isSupabaseConfigured && supabase) void supabase.auth.signOut()
    clearAuthSession()
    setAuthSession(null)
  }

  const handlePasswordReset = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setToast('Informe o e-mail para recuperar a senha.')
      return
    }

    if (isFirebaseConfigured) {
      try {
        await requestFirebasePasswordReset(normalizedEmail)
        setToast('E-mail de recuperação enviado.')
      } catch {
        setToast('Não foi possível enviar o e-mail de recuperação.')
      }
      return
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase!.auth.resetPasswordForEmail(normalizedEmail)
      setToast(error ? 'Não foi possível enviar o e-mail de recuperação.' : 'E-mail de recuperação enviado.')
      return
    }

    const found = await requestLocalPasswordReset(normalizedEmail)
    setToast(
      found
        ? 'Solicitação registrada. Configure Supabase Auth para envio real por e-mail.'
        : 'Conta não encontrada.',
    )
  }

  const saveLead = (values: LeadFormValues) => {
    const now = new Date().toISOString()
    const normalizedValues = normalizeContactValues(values)
    updateState(
      (current) => {
        const linkedContact = current.clients.find((contact) => contact.id === normalizedValues.contactId)
        if (!linkedContact) return current
        const opportunityValues = {
          ...normalizedValues,
          fullName: linkedContact.fullName,
          companyName: (current.companies || []).find((company) => company.id === linkedContact.companyId)?.tradeName || linkedContact.companyName,
          phone: linkedContact.phone,
          whatsapp: linkedContact.whatsapp,
          email: linkedContact.email,
          instagram: linkedContact.instagram,
          city: linkedContact.city,
          neighborhood: linkedContact.neighborhood || '',
          address: linkedContact.address,
          source: linkedContact.source,
        }
        const existing = selectedLeadId
          ? current.leads.find((lead) => lead.id === selectedLeadId)
          : undefined

        if (existing) {
          return {
            ...current,
            leads: current.leads.map((lead) =>
              lead.id === existing.id
                ? {
                    ...lead,
                    ...opportunityValues,
                    nextContactAt: opportunityValues.nextContactAt ? asIsoFromInput(opportunityValues.nextContactAt) : undefined,
                    updatedAt: now,
                  }
                : lead,
            ),
            leadInteractions: [
              {
                id: createId('int'),
                leadId: existing.id,
                interactionType: 'Contato atualizado',
                description: 'Dados do contato editados no CRM.',
                interactionDate: now,
                userId: activeUserId,
                createdAt: now,
              },
              ...current.leadInteractions,
            ],
          }
        }

        const lead: Lead = {
          id: createId('lead'),
          ...opportunityValues,
          entryDate: dateInput(),
          lastContactAt: undefined,
          nextContactAt: opportunityValues.nextContactAt ? asIsoFromInput(opportunityValues.nextContactAt) : undefined,
          responsibleUserId: activeUserId,
          archived: false,
          tags: [],
          createdAt: now,
          updatedAt: now,
        }

        return {
          ...current,
          leads: [lead, ...current.leads],
          leadInteractions: [
            {
              id: createId('int'),
              leadId: lead.id,
              interactionType: 'Lead criado',
              description: 'Lead cadastrado no CRM.',
              interactionDate: now,
              userId: activeUserId,
              createdAt: now,
            },
            ...current.leadInteractions,
          ],
        }
      },
      selectedLeadId ? 'Contato atualizado.' : 'Contato cadastrado.',
    )
    setModal(null)
    setSelectedLeadId('')
  }

  const addClient = (values: ClientFormValues, forceCreate = false) => {
    const normalizedValues = normalizeContactValues(values)
    const normalizedWhatsapp = normalizedValues.whatsapp.replace(/\D/g, '')
    const duplicate = state.clients.find(
      (client) =>
        client.id !== selectedClientId &&
        (normalizedWhatsapp.length > 0 && normalizedWhatsapp === client.whatsapp.replace(/\D/g, '')) ||
        (normalizedValues.email && normalizedValues.email === client.email),
    )
    if (duplicate && !forceCreate) {
      requestConfirm({
        title: 'Cliente parecido encontrado',
        description: `${duplicate.fullName} já parece estar cadastrado. Se for outro cliente, você pode criar mesmo assim.`,
        confirmLabel: 'Criar mesmo assim',
        tone: 'warning',
        onConfirm: () => addClient(values, true),
      })
      return
    }

    const now = new Date().toISOString()
    updateState((current) => selectedClientId ? {
      ...current,
      clients: current.clients.map((client) => client.id === selectedClientId ? { ...client, ...normalizedValues, updatedAt: now } : client),
      leads: current.leads.map((lead) => lead.contactId === selectedClientId ? { ...lead, fullName: normalizedValues.fullName, companyName: (current.companies || []).find((company) => company.id === normalizedValues.companyId)?.tradeName || normalizedValues.companyName, phone: normalizedValues.phone, whatsapp: normalizedValues.whatsapp, email: normalizedValues.email, instagram: normalizedValues.instagram, city: normalizedValues.city, neighborhood: normalizedValues.neighborhood, address: normalizedValues.address, updatedAt: now } : lead),
    } : {
      ...current,
      clients: [{ id: createId('client'), ...normalizedValues, tags: [], archived: false, createdAt: now, updatedAt: now }, ...current.clients],
    }, selectedClientId ? 'Contato atualizado em todo o CRM.' : 'Contato cadastrado na base central.')
    setModal(null)
    setSelectedClientId('')
  }

  const addCompany = (values: CompanyFormValues) => {
    const now = new Date().toISOString()
    const company: Company = {
      id: createId('company'),
      ...values,
      tags: [],
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    updateState((current) => ({ ...current, companies: [company, ...(current.companies || [])] }), 'Empresa cadastrada e disponível para vincular aos contatos.')
    setModal(null)
  }

  const importLeadHunterProspects = (prospectIds: string[]) => {
    const now = new Date().toISOString()
    updateState((current) => {
      let clients = [...current.clients]
      let leads = [...current.leads]
      const importedLinks = new Map<string, { contactId: string; leadId: string }>()
      const normalizePhone = (value = '') => value.replace(/\D/g, '')
      for (const prospect of (current.leadHunterProspects || []).filter((item) => prospectIds.includes(item.id))) {
        const intelligenceNotes = [
          `Descoberto pelo Lead Hunter. Score inicial: ${prospect.score}.`,
          `Serviço recomendado: ${prospect.recommendedService || 'Vídeo institucional'}.`,
          prospect.aiSummary ? `Análise da IA: ${prospect.aiSummary}` : '',
          prospect.aiApproach ? `Abordagem sugerida: ${prospect.aiApproach}` : '',
          prospect.instagram ? `Instagram: ${prospect.instagram}` : '',
          prospect.whatsapp ? `WhatsApp: ${prospect.whatsapp}` : '',
          `Fontes: ${prospect.sources.join(', ') || 'não informadas'}.`,
        ].filter(Boolean).join('\n')
        const existingContact = clients.find((contact) =>
          (normalizePhone(prospect.whatsapp || prospect.phone) && normalizePhone(prospect.whatsapp || prospect.phone) === normalizePhone(contact.whatsapp || contact.phone)) ||
          (prospect.email && prospect.email.toLowerCase() === contact.email.toLowerCase()) ||
          (prospect.name.toLowerCase() === (contact.companyName || contact.fullName).toLowerCase() && prospect.city.toLowerCase() === contact.city.toLowerCase()),
        )
        const contact = existingContact || {
          id: createId('client'), fullName: prospect.contactName || prospect.name, companyName: prospect.name, jobTitle: '', document: '', phone: prospect.phone,
          whatsapp: prospect.whatsapp, email: prospect.email, instagram: prospect.instagram, neighborhood: prospect.neighborhood,
          postalCode: '', address: prospect.address, city: prospect.city, source: 'Lead Hunter' as const,
          notes: intelligenceNotes,
          tags: ['Lead Hunter', prospect.categoryName], archived: false, createdAt: now, updatedAt: now,
        }
        if (!existingContact) {
          clients = [contact, ...clients]
        } else {
          clients = clients.map((item) => item.id === existingContact.id ? {
            ...item,
            fullName: item.fullName || prospect.contactName || prospect.name,
            phone: item.phone || prospect.phone,
            whatsapp: item.whatsapp || prospect.whatsapp,
            email: item.email || prospect.email,
            instagram: item.instagram || prospect.instagram,
            neighborhood: item.neighborhood || prospect.neighborhood,
            address: item.address || prospect.address,
            city: item.city || prospect.city,
            notes: item.notes.includes('Lead Hunter') ? item.notes : [item.notes, intelligenceNotes].filter(Boolean).join('\n\n'),
            tags: [...new Set([...item.tags, 'Lead Hunter', prospect.categoryName])],
            updatedAt: now,
          } : item)
        }
        const resolvedContact = clients.find((item) => item.id === contact.id) || contact
        const existingLead = leads.find((lead) => lead.contactId === resolvedContact.id)
        const lead = existingLead || {
          id: createId('lead'), contactId: resolvedContact.id, fullName: resolvedContact.fullName, companyName: resolvedContact.companyName,
          phone: resolvedContact.phone, whatsapp: resolvedContact.whatsapp, email: resolvedContact.email, instagram: resolvedContact.instagram, city: resolvedContact.city,
          neighborhood: resolvedContact.neighborhood || '', address: resolvedContact.address, source: 'Lead Hunter' as const,
          serviceInterest: prospect.recommendedService || 'Vídeo institucional' as const,
          pipelineStage: 'Entrada' as const, temperature: prospect.score >= 75 ? 'Quente' as const : prospect.score >= 60 ? 'Morno' as const : 'Frio' as const,
          estimatedValue: 0, probability: Math.min(prospect.score, 90), entryDate: dateInput(), notes: intelligenceNotes,
          leadHunterData: { ...prospect },
          responsibleUserId: activeUserId, archived: false, tags: ['Lead Hunter', prospect.categoryName], createdAt: now, updatedAt: now,
        }
        if (!existingLead) {
          leads = [lead, ...leads]
        } else {
          leads = leads.map((item) => item.id === existingLead.id ? {
            ...item,
            phone: item.phone || prospect.phone,
            whatsapp: item.whatsapp || prospect.whatsapp,
            email: item.email || prospect.email,
            instagram: item.instagram || prospect.instagram,
            city: item.city || prospect.city,
            neighborhood: item.neighborhood || prospect.neighborhood,
            address: item.address || prospect.address,
            serviceInterest: prospect.recommendedService || item.serviceInterest,
            probability: Math.max(item.probability, Math.min(prospect.score, 90)),
            notes: item.notes.includes('Análise da IA:') ? item.notes : [item.notes, intelligenceNotes].filter(Boolean).join('\n\n'),
            leadHunterData: { ...prospect },
            tags: [...new Set([...item.tags, 'Lead Hunter', prospect.categoryName])],
            updatedAt: now,
          } : item)
        }
        importedLinks.set(prospect.id, { contactId: resolvedContact.id, leadId: lead.id })
      }
      return {
        ...current, clients, leads,
        leadHunterProspects: (current.leadHunterProspects || []).map((prospect) => {
          const link = importedLinks.get(prospect.id)
          return link ? { ...prospect, ...link, status: 'Importado' as const, isNew: false, updatedAt: now } : prospect
        }),
      }
    }, `${prospectIds.length} lead(s) processado(s) e vinculado(s) ao Comercial.`)
  }

  const saveProject = (values: ProjectFormValues) => {
    if (!selectedProjectId && values.manualCreationReason.trim().length < 5) {
      setToast('Informe a justificativa para criar um projeto manualmente sem proposta aceita.')
      return
    }
    const now = new Date().toISOString()
    updateState(
      (current) => {
        const selectedLead = values.leadId ? current.leads.find((lead) => lead.id === values.leadId) : undefined
        const matchedClient = values.clientId
          ? current.clients.find((client) => client.id === values.clientId)
          : selectedLead
            ? findClientForLead(current.clients, selectedLead)
            : undefined
        const createdClient = !matchedClient && selectedLead ? createClientFromLead(selectedLead, now) : undefined
        const projectValues: ProjectFormValues = {
          ...values,
          clientId: matchedClient?.id ?? createdClient?.id ?? values.clientId,
          leadId: values.leadId || '',
        }
        const defaultDeliveryDays = Math.max(Number(current.companySettings.defaultDeliveryDays) || 7, 1)
        const automaticDeliveryDeadline = addCalendarDays(projectValues.captureDate, defaultDeliveryDays)
        const deliveryDaysAfterCapture = projectValues.deliveryDeadlineNegotiated
          ? Math.max(Number(projectValues.deliveryDaysAfterCapture) || 0, 0)
          : defaultDeliveryDays
        const normalizedProjectValues: ProjectFormValues = {
          ...projectValues,
          deliveryDeadline: addCalendarDays(projectValues.captureDate, deliveryDaysAfterCapture),
          deliveryDaysAfterCapture,
        }
        const nextClients = createdClient ? [createdClient, ...current.clients] : current.clients
        const existing = selectedProjectId
          ? current.projects.find((project) => project.id === selectedProjectId)
          : undefined

        if (existing) {
          const updatedProject: Project = {
            ...existing,
            ...normalizedProjectValues,
            leadId: normalizedProjectValues.leadId || undefined,
            serviceId: current.services.find((service) => service.name === normalizedProjectValues.serviceName)?.id,
            originalDeliveryDeadline: automaticDeliveryDeadline,
            remainingValue: Math.max(normalizedProjectValues.totalValue - normalizedProjectValues.depositValue, 0),
            updatedAt: now,
          }
          const appointmentStartAt = new Date(`${normalizedProjectValues.captureDate}T${normalizedProjectValues.captureStartTime}`).toISOString()
          const appointmentEndAt = new Date(`${normalizedProjectValues.captureDate}T${normalizedProjectValues.captureEndTime || normalizedProjectValues.captureStartTime}`).toISOString()
          const existingDeliveryAppointment = current.appointments.find((appointment) =>
            appointment.projectId === existing.id && appointment.appointmentType === 'Prazo de entrega',
          )
          const updatedAppointments = current.appointments.map((appointment) => {
            if (appointment.projectId === existing.id && appointment.appointmentType === 'Captação') {
              return {
                ...appointment,
                title: `Captação ${updatedProject.name}`,
                clientId: updatedProject.clientId,
                leadId: updatedProject.leadId,
                startAt: appointmentStartAt,
                endAt: appointmentEndAt,
                address: updatedProject.address,
                notes: updatedProject.notes,
                updatedAt: now,
              }
            }
            if (appointment.id === existingDeliveryAppointment?.id) {
              return createProjectDeliveryAppointment(updatedProject, now, appointment.id)
            }
            return appointment
          })

          return {
            ...current,
            clients: nextClients,
            projects: current.projects.map((project) =>
              project.id === existing.id ? updatedProject : project,
            ),
            payments: current.payments.map((payment) =>
              payment.projectId === existing.id && payment.paymentType === 'Pagamento final' && payment.status !== 'Recebida'
                ? { ...payment, dueDate: updatedProject.deliveryDeadline, updatedAt: now }
                : payment,
            ),
            appointments: existingDeliveryAppointment
              ? updatedAppointments
              : [createProjectDeliveryAppointment(updatedProject, now), ...updatedAppointments],
          }
        }

        const code = `HD-${new Date().getFullYear()}-${String(current.projects.length + 1).padStart(3, '0')}`
        const project: Project = {
          id: createId('project'),
          projectCode: code,
          ...normalizedProjectValues,
          leadId: normalizedProjectValues.leadId || undefined,
          serviceId: current.services.find((service) => service.name === normalizedProjectValues.serviceName)?.id,
          originalDeliveryDeadline: automaticDeliveryDeadline,
          remainingValue: Math.max(normalizedProjectValues.totalValue - normalizedProjectValues.depositValue, 0),
          equipmentNeeded: ['Drone DJI Mini 2'],
          links: [],
          responsibleUserId: activeUserId,
          createdAt: now,
          updatedAt: now,
        }

        const payments: Payment[] = []
        if (project.depositValue > 0) {
          payments.push({
            id: createId('pay'),
            projectId: project.id,
            clientId: project.clientId,
            paymentType: 'Sinal',
            amount: project.depositValue,
            dueDate: normalizedProjectValues.captureDate,
            paymentMethod: normalizedProjectValues.paymentMethod,
            status: 'Pendente',
            notes: 'Sinal para reserva da data.',
            createdAt: now,
            updatedAt: now,
          })
        }
        if (project.remainingValue > 0) {
          payments.push({
            id: createId('pay'),
            projectId: project.id,
            clientId: project.clientId,
            paymentType: 'Pagamento final',
            amount: project.remainingValue,
            dueDate: normalizedProjectValues.deliveryDeadline,
            paymentMethod: normalizedProjectValues.paymentMethod,
            status: 'Pendente',
            notes: 'Restante após entrega completa.',
            createdAt: now,
            updatedAt: now,
          })
        }

        const checklist = createDefaultChecklist(project.id, now)
        const appointment: Appointment = {
          id: createId('appt'),
          title: `Captação ${project.name}`,
          appointmentType: 'Captação',
          clientId: project.clientId,
          leadId: project.leadId,
          projectId: project.id,
          startAt: new Date(`${normalizedProjectValues.captureDate}T${normalizedProjectValues.captureStartTime}`).toISOString(),
          endAt: new Date(`${normalizedProjectValues.captureDate}T${normalizedProjectValues.captureEndTime || normalizedProjectValues.captureStartTime}`).toISOString(),
          address: normalizedProjectValues.address,
          notes: normalizedProjectValues.notes,
          status: 'Agendado',
          color: '#d8a500',
          createdAt: now,
          updatedAt: now,
        }

        const deliveryAppointment = createProjectDeliveryAppointment(project, now)

        return {
          ...current,
          clients: nextClients,
          projects: [project, ...current.projects],
          payments: [...payments, ...current.payments],
          projectChecklistItems: [...checklist, ...current.projectChecklistItems],
          appointments: [appointment, deliveryAppointment, ...current.appointments],
        }
      },
      selectedProjectId ? 'Projeto atualizado.' : 'Projeto cadastrado com checklist, agenda e contas a receber.',
    )
    setModal(null)
    setSelectedProjectId('')
  }

  const deleteProject = (project: Project) => {
    requestConfirm({
      title: 'Excluir projeto?',
      description: `${project.projectCode} • ${project.name} será removido das telas do sistema. Pagamentos, arquivos e histórico já registrados serão preservados.`,
      confirmLabel: 'Excluir projeto',
      tone: 'danger',
      onConfirm: () => {
        const now = new Date().toISOString()
        updateState(
          (current) => ({
            ...current,
            projects: current.projects.map((item) => item.id === project.id ? {
              ...item,
              deletedAt: now,
              deletedBy: activeUserId,
              deletionReason: undefined,
              updatedAt: now,
            } : item),
            statusHistory: [
              createStatusHistory(
                'Projeto',
                project.id,
                'Projeto excluído',
                'Projeto removido das telas do sistema. Registros financeiros, arquivos e histórico foram preservados.',
                activeUserId,
                project.projectStatus,
                project.projectStatus,
                now,
              ),
              ...current.statusHistory,
            ],
          }),
          'Projeto excluído.',
        )
        setSelectedProjectId('')
      },
    })
  }

  const saveTask = (values: TaskFormValues) => {
    const now = new Date().toISOString()
    const dueAt = asIsoFromInput(values.dueAt)
    const durationMinutes = Math.max(Number(values.durationMinutes) || 30, 15)
    const endAt = new Date(new Date(dueAt).getTime() + durationMinutes * 60_000).toISOString()
    const taskId = createId('task')
    const appointmentId = createId('appt')
    updateState(
      (current) => {
        const lead = values.leadId ? current.leads.find((item) => item.id === values.leadId) : undefined
        const client = values.clientId ? current.clients.find((item) => item.id === values.clientId) : undefined
        const address = lead?.address || client?.address || ''
        const task: TaskItem = {
          id: taskId,
          title: values.title.trim(),
          description: values.description.trim(),
          taskType: values.taskType,
          dueAt,
          durationMinutes,
          priority: values.priority,
          status: 'Pendente',
          leadId: values.leadId || undefined,
          clientId: values.clientId || undefined,
          appointmentId,
          responsibleUserId: values.responsibleUserId || activeUserId,
          createdAt: now,
          updatedAt: now,
        }
        const appointment: Appointment = {
          id: appointmentId,
          title: values.title.trim(),
          appointmentType: 'Tarefa',
          leadId: values.leadId || undefined,
          clientId: values.clientId || undefined,
          startAt: dueAt,
          endAt,
          address,
          notes: values.description.trim(),
          status: 'Agendado',
          color: values.priority === 'Urgente' ? '#dc2626' : values.priority === 'Alta' ? '#d97706' : values.priority === 'Média' ? '#2563eb' : '#64748b',
          createdAt: now,
          updatedAt: now,
        }
        return {
          ...current,
          tasks: [task, ...current.tasks],
          appointments: [appointment, ...current.appointments],
          leads: lead
            ? current.leads.map((item) => item.id === lead.id && (!item.nextContactAt || item.nextContactAt > dueAt)
                ? { ...item, nextContactAt: dueAt, updatedAt: now }
                : item)
            : current.leads,
          statusHistory: [
            createStatusHistory('Agendamento', appointmentId, 'Tarefa criada', `${values.taskType}: ${values.title.trim()} · ${formatDateTime(dueAt)}.`, activeUserId, undefined, 'Agendado', now),
            ...current.statusHistory,
          ],
        }
      },
      'Tarefa criada e vinculada ao contato.',
    )
    setModal(null)
    setTaskDefaults({})
  }

  const setTaskStatus = (task: TaskItem, status: TaskItem['status']) => {
    const now = new Date().toISOString()
    updateState(
      (current) => ({
        ...current,
        tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status, updatedAt: now } : item),
        appointments: task.appointmentId
          ? current.appointments.map((appointment) => appointment.id === task.appointmentId
              ? { ...appointment, status: status === 'Concluída' ? 'Concluído' : status === 'Cancelada' ? 'Cancelado' : 'Agendado', updatedAt: now }
              : appointment)
          : current.appointments,
      }),
      status === 'Concluída' ? 'Tarefa concluída.' : 'Tarefa cancelada.',
    )
  }

  const saveAppointment = async (values: AppointmentFormValues) => {
    const now = new Date().toISOString()
    const existingBeforeSave = selectedAppointment ?? (values.projectId && values.appointmentType === 'Captação'
      ? state.appointments.find((appointment) => appointment.projectId === values.projectId && appointment.appointmentType === 'Captação' && appointment.status !== 'Cancelado')
      : undefined)
    const appointmentId = existingBeforeSave?.id ?? createId('appt')
    let calendarUrl = ''
    updateState(
      (current) => {
        const selectedExisting = selectedAppointmentId
          ? current.appointments.find((appointment) => appointment.id === selectedAppointmentId)
          : undefined
        const duplicateCapture = !selectedExisting && values.projectId && values.appointmentType === 'Captação'
          ? current.appointments.find((appointment) => appointment.projectId === values.projectId && appointment.appointmentType === 'Captação' && appointment.status !== 'Cancelado')
          : undefined
        const existing = selectedExisting ?? duplicateCapture
        const project = values.projectId ? current.projects.find((item) => item.id === values.projectId) : undefined
        const changed = existing && (existing.startAt !== asIsoFromInput(values.startAt) || existing.endAt !== asIsoFromInput(values.endAt))
        const appointmentBase: Appointment = {
          id: existing?.id ?? appointmentId,
          ...values,
          clientId: values.clientId || undefined,
          leadId: values.leadId || undefined,
          projectId: values.projectId || undefined,
          quoteId: project?.quoteId,
          startAt: asIsoFromInput(values.startAt),
          endAt: asIsoFromInput(values.endAt),
          previousStartAt: changed ? existing.startAt : existing?.previousStartAt,
          rescheduleReason: changed ? values.rescheduleReason : existing?.rescheduleReason,
          externalEventId: existing?.externalEventId,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        calendarUrl = values.createGoogleCalendar ? buildGoogleCalendarUrl(appointmentBase, project) : ''
        const appointment: Appointment = { ...appointmentBase, calendarUrl: calendarUrl || existing?.calendarUrl }
        const captureDate = values.startAt.slice(0, 10)
        const captureStartTime = values.startAt.slice(11, 16)
        const captureEndTime = values.endAt.slice(11, 16)
        const defaultDeliveryDays = Math.max(Number(current.companySettings.defaultDeliveryDays) || 7, 1)
        const automaticDeliveryDeadline = project && appointment.appointmentType === 'Captação'
          ? addCalendarDays(captureDate, defaultDeliveryDays)
          : ''
        const deliveryDaysAfterCapture = project?.deliveryDeadlineNegotiated
          ? Math.max(project.deliveryDaysAfterCapture ?? calendarDaysBetween(project.captureDate, project.deliveryDeadline), 0)
          : defaultDeliveryDays
        const updatedProject = project && appointment.appointmentType === 'Captação'
          ? {
              ...project,
              captureDate,
              captureStartTime,
              captureEndTime,
              originalDeliveryDeadline: automaticDeliveryDeadline,
              deliveryDeadline: addCalendarDays(captureDate, deliveryDaysAfterCapture),
              deliveryDaysAfterCapture,
              address: appointment.address || project.address,
              projectStatus: ['Aguardando agendamento', 'Agendado', 'Confirmação pendente', 'Aguardando sinal'].includes(project.projectStatus)
                ? ('Confirmado' as const)
                : project.projectStatus,
              updatedAt: now,
            }
          : undefined
        let appointments = existing
          ? current.appointments.map((item) => (item.id === existing.id ? appointment : item))
          : [appointment, ...current.appointments]
        if (updatedProject?.deliveryDeadline) {
          const existingDeliveryAppointment = current.appointments.find((item) =>
            item.projectId === updatedProject.id && item.appointmentType === 'Prazo de entrega',
          )
          appointments = existingDeliveryAppointment
            ? appointments.map((item) => item.id === existingDeliveryAppointment.id
                ? createProjectDeliveryAppointment(updatedProject, now, item.id)
                : item)
            : [createProjectDeliveryAppointment(updatedProject, now), ...appointments]
        }

        return {
          ...current,
          appointments,
          projects: updatedProject
            ? current.projects.map((item) => item.id === updatedProject.id ? updatedProject : item)
            : current.projects,
          payments: updatedProject
            ? current.payments.map((payment) =>
                payment.projectId === updatedProject.id && payment.paymentType === 'Pagamento final' && payment.status !== 'Recebida'
                  ? { ...payment, dueDate: updatedProject.deliveryDeadline, updatedAt: now }
                  : payment,
              )
            : current.payments,
          tasks: current.tasks.map((task) => task.appointmentId === appointment.id
            ? {
                ...task,
                title: appointment.title,
                description: appointment.notes,
                dueAt: appointment.startAt,
                durationMinutes: getDurationMinutes(appointment.startAt, appointment.endAt),
                status: appointment.status === 'Concluído' ? 'Concluída' : appointment.status === 'Cancelado' ? 'Cancelada' : task.status,
                updatedAt: now,
              }
            : task),
          statusHistory: [
            createStatusHistory('Agendamento', appointment.id, changed ? 'Captação reagendada' : existing ? 'Agendamento atualizado' : 'Agendamento criado', changed ? `Data anterior: ${formatDateTime(existing.startAt)}. Motivo: ${values.rescheduleReason}.${updatedProject ? ` Entrega: ${formatDate(updatedProject.deliveryDeadline)}.` : ''}` : `${appointment.title} em ${formatDateTime(appointment.startAt)}.${updatedProject ? ` Entrega: ${formatDate(updatedProject.deliveryDeadline)}.` : ''}`, activeUserId, existing?.status, appointment.status, now),
            ...current.statusHistory,
          ],
        }
      },
      selectedAppointmentId ? 'Agendamento atualizado sem duplicar o evento.' : 'Agendamento criado.',
    )
    if (values.createGoogleCalendar && calendarUrl) {
      const project = values.projectId ? state.projects.find((item) => item.id === values.projectId) : undefined
      try {
        const synced = await syncGoogleCalendarEvent({
          externalEventId: existingBeforeSave?.externalEventId,
          title: values.title,
          description: [
            project ? `Cliente: ${project.contactName}` : '',
            project ? `Telefone: ${project.contactPhone}` : '',
            project ? `Serviço: ${project.serviceName}` : '',
            project ? `Projeto: ${project.projectCode}` : '',
            project ? `Valor restante: ${formatCurrency(project.remainingValue)}` : '',
            values.notes ? `Observações: ${values.notes}` : '',
          ].filter(Boolean).join('\n'),
          startAt: asIsoFromInput(values.startAt),
          endAt: asIsoFromInput(values.endAt),
          location: values.address,
          timeZone: state.companySettings.timezone,
        })
        if (synced) {
          updateState((current) => ({
            ...current,
            appointments: current.appointments.map((appointment) => appointment.id === appointmentId ? { ...appointment, externalEventId: synced.externalEventId, calendarUrl: synced.calendarUrl, updatedAt: new Date().toISOString() } : appointment),
          }), existingBeforeSave?.externalEventId ? 'Evento atualizado no Google Calendar.' : 'Evento criado no Google Calendar.')
        } else {
          window.open(calendarUrl, '_blank', 'noopener,noreferrer')
        }
      } catch {
        window.open(calendarUrl, '_blank', 'noopener,noreferrer')
        setToast('Evento salvo internamente. Confirme o evento aberto no Google Calendar.')
      }
    }
    setModal(null)
    setAppointmentDefaults({})
    setSelectedAppointmentId('')
  }

  const deleteAppointment = (appointment: Appointment) => {
    const storedAppointment = state.appointments.find((item) => item.id === appointment.id)
    if (!storedAppointment) {
      setToast('Agendamento não encontrado.')
      return
    }

    requestConfirm({
      title: 'Excluir agendamento?',
      description: storedAppointment.externalEventId
        ? 'O agendamento será removido do banco e do Google Calendar.'
        : 'O agendamento será removido do banco.',
      confirmLabel: 'Excluir agendamento',
      cancelLabel: 'Cancelar',
      tone: 'danger',
      onConfirm: () => {
        const now = new Date().toISOString()
        const shouldResetProject = Boolean(
          storedAppointment.projectId &&
          storedAppointment.appointmentType === 'Captação' &&
          state.projects.some(
            (project) =>
              project.id === storedAppointment.projectId &&
              !project.actualCaptureAt &&
              !project.editingStartedAt &&
              !project.reviewSentAt &&
              !project.finalDeliveryAt &&
              !project.completedAt,
          ),
        )

        updateState(
          (current) => {
            const appointmentToDelete = current.appointments.find((item) => item.id === storedAppointment.id)
            if (!appointmentToDelete) return current

            const project = appointmentToDelete.projectId
              ? current.projects.find((item) => item.id === appointmentToDelete.projectId)
              : undefined
            const resetProject = Boolean(
              project &&
              appointmentToDelete.appointmentType === 'Captação' &&
              !project.actualCaptureAt &&
              !project.editingStartedAt &&
              !project.reviewSentAt &&
              !project.finalDeliveryAt &&
              !project.completedAt,
            )

            const appointments = current.appointments
              .filter((item) => item.id !== appointmentToDelete.id)
              .filter((item) => !(resetProject && item.projectId === project?.id && item.appointmentType === 'Prazo de entrega'))

            const projectUpdate = resetProject && project
              ? {
                  ...project,
                  captureDate: '',
                  captureStartTime: '',
                  captureEndTime: '',
                  deliveryDeadline: '',
                  originalDeliveryDeadline: undefined,
                  deliveryDeadlineNegotiated: false,
                  deliveryDaysAfterCapture: Math.max(Number(current.companySettings.defaultDeliveryDays) || 7, 1),
                  projectStatus: 'Aguardando agendamento' as const,
                  updatedAt: now,
                }
              : undefined

            return {
              ...current,
              appointments,
              tasks: current.tasks.map((task) =>
                task.appointmentId === appointmentToDelete.id
                  ? { ...task, appointmentId: undefined, updatedAt: now }
                  : task,
              ),
              leads: appointmentToDelete.leadId
                ? current.leads.map((lead) =>
                    lead.id === appointmentToDelete.leadId && lead.nextContactAt === appointmentToDelete.startAt
                      ? { ...lead, nextContactAt: undefined, updatedAt: now }
                      : lead,
                  )
                : current.leads,
              projects: projectUpdate
                ? current.projects.map((item) => item.id === projectUpdate.id ? projectUpdate : item)
                : current.projects,
              statusHistory: [
                createStatusHistory(
                  'Agendamento',
                  appointmentToDelete.id,
                  'Agendamento excluído',
                  shouldResetProject
                    ? 'Captação removida e projeto voltou para aguardar novo agendamento.'
                    : 'Agendamento removido do calendário e do banco.',
                  activeUserId,
                  appointmentToDelete.status,
                  'Excluído',
                  now,
                ),
                ...current.statusHistory,
              ],
            }
          },
          'Agendamento excluído.',
        )

        setModal(null)
        setAppointmentDefaults({})
        setSelectedAppointmentId('')

        if (storedAppointment.externalEventId) {
          void syncGoogleCalendarEvent({
            externalEventId: storedAppointment.externalEventId,
            deleteEvent: true,
            title: storedAppointment.title,
            description: storedAppointment.notes,
            startAt: storedAppointment.startAt,
            endAt: storedAppointment.endAt,
            location: storedAppointment.address,
            timeZone: state.companySettings.timezone,
          }).catch(() => {
            setToast('Agendamento excluído internamente, mas não foi possível remover o evento no Google Calendar.')
          })
        }
      },
    })
  }

  const resizeAppointment = async (appointment: Appointment, endAt: string) => {
    const storedAppointment = state.appointments.find((item) => item.id === appointment.id)
    if (!storedAppointment || new Date(endAt).getTime() <= new Date(storedAppointment.startAt).getTime()) return
    const now = new Date().toISOString()
    const previousEndAt = storedAppointment.endAt
    const captureEndTime = dateTimeInputFromDate(new Date(endAt)).slice(11, 16)

    updateState(
      (current) => ({
        ...current,
        appointments: current.appointments.map((item) => item.id === storedAppointment.id
          ? { ...item, endAt, updatedAt: now }
          : item),
        projects: storedAppointment.projectId && storedAppointment.appointmentType === 'Captação'
          ? current.projects.map((project) => project.id === storedAppointment.projectId
              ? { ...project, captureEndTime, updatedAt: now }
              : project)
          : current.projects,
        tasks: current.tasks.map((task) => task.appointmentId === storedAppointment.id
          ? { ...task, durationMinutes: getDurationMinutes(storedAppointment.startAt, endAt), updatedAt: now }
          : task),
        statusHistory: [
          createStatusHistory(
            'Agendamento',
            storedAppointment.id,
            'Duração ajustada',
            `Término alterado de ${formatDateTime(previousEndAt)} para ${formatDateTime(endAt)}.`,
            activeUserId,
            storedAppointment.status,
            storedAppointment.status,
            now,
          ),
          ...current.statusHistory,
        ],
      }),
      `Duração atualizada para ${getDurationMinutes(storedAppointment.startAt, endAt)} minutos.`,
    )

    if (!storedAppointment.externalEventId) return
    const project = storedAppointment.projectId ? state.projects.find((item) => item.id === storedAppointment.projectId) : undefined
    try {
      const synced = await syncGoogleCalendarEvent({
        externalEventId: storedAppointment.externalEventId,
        title: storedAppointment.title,
        description: [
          project ? `Cliente: ${project.contactName}` : '',
          project ? `Projeto: ${project.projectCode}` : '',
          storedAppointment.notes ? `Observações: ${storedAppointment.notes}` : '',
        ].filter(Boolean).join('\n'),
        startAt: storedAppointment.startAt,
        endAt,
        location: storedAppointment.address,
        timeZone: state.companySettings.timezone,
      })
      if (synced) {
        updateState((current) => ({
          ...current,
          appointments: current.appointments.map((item) => item.id === storedAppointment.id
            ? { ...item, externalEventId: synced.externalEventId, calendarUrl: synced.calendarUrl, updatedAt: new Date().toISOString() }
            : item),
        }), 'Duração sincronizada com o Google Calendar.')
      }
    } catch {
      setToast('Duração salva na agenda. Não foi possível sincronizar com o Google Calendar agora.')
    }
  }

  const addPayment = (values: PaymentFormValues) => {
    const project = state.projects.find((item) => item.id === values.projectId)
    const lead = state.leads.find((item) => item.id === values.leadId) ?? (project?.leadId ? state.leads.find((item) => item.id === project.leadId) : undefined)
    const client = state.clients.find((item) => item.id === values.clientId) ?? (project ? state.clients.find((item) => item.id === project.clientId) : undefined)
    if (!project && !client && !lead) {
      setToast('Vincule a receita a um cliente, contato ou projeto.')
      return
    }
    if (values.transactionNumber && state.payments.some((payment) => payment.id !== selectedFinancePaymentId && payment.transactionNumber?.trim() === values.transactionNumber.trim() && !payment.deletedAt)) {
      setToast('Já existe um pagamento com este número de transação.')
      return
    }

    if (values.status === 'Recebida' && (!values.confirmedReceived || !values.paidAt)) {
      setToast('Confirme que o pagamento foi recebido e informe a data.')
      return
    }
    if (values.installmentCount > 1 && values.status === 'Recebida') {
      setToast('Para parcelar, salve como prevista ou pendente e confirme cada parcela quando ela for recebida.')
      return
    }
    const existingPayment = selectedFinancePaymentId ? state.payments.find((payment) => payment.id === selectedFinancePaymentId) : undefined
    if (values.status === 'Recebida' && !state.bankAccounts.some((account) => account.id === values.bankAccountId && (account.active || account.id === existingPayment?.bankAccountId))) {
      setToast('Selecione uma conta bancária ativa para o recebimento.')
      return
    }

    const currentPaid = project
      ? state.payments.filter((payment) => payment.projectId === project.id && payment.id !== selectedFinancePaymentId).reduce((total, payment) => total + getPaymentCashEffect(payment), 0)
      : 0
    const receivedNow = values.status === 'Recebida' ? (values.paymentType === 'Reembolso' ? -values.amount : values.amount) : 0
    if (project && currentPaid + receivedNow > project.totalValue) {
      showNotice({ title: 'Valor acima do projeto', description: 'O valor recebido não pode ultrapassar o valor total do projeto, exceto quando o lançamento for do tipo adicional.', tone: 'warning' })
      return
    }

    const now = new Date().toISOString()
    updateState(
      (current) => {
        const existing = selectedFinancePaymentId ? current.payments.find((item) => item.id === selectedFinancePaymentId) : undefined
        const currentProject = values.projectId ? current.projects.find((item) => item.id === values.projectId) : undefined
        const currentLead = values.leadId ? current.leads.find((item) => item.id === values.leadId) : currentProject?.leadId ? current.leads.find((item) => item.id === currentProject.leadId) : undefined
        const currentQuote = values.quoteId ? current.quotes.find((item) => item.id === values.quoteId) : currentProject?.quoteId ? current.quotes.find((item) => item.id === currentProject.quoteId) : undefined
        const matchedClient = values.clientId
          ? current.clients.find((item) => item.id === values.clientId)
          : currentProject
            ? current.clients.find((item) => item.id === currentProject.clientId)
            : currentLead
              ? findClientForLead(current.clients, currentLead)
              : undefined
        const createdClient = !matchedClient && currentLead ? createClientFromLead(currentLead, now) : undefined
        const paymentClient = matchedClient ?? createdClient
        if (!paymentClient) return current
        const sourceKey = existing?.sourceKey ?? (currentQuote
          ? values.paymentType === 'Sinal'
            ? `quote-deposit:${currentQuote.id}`
            : values.paymentType === 'Pagamento final'
              ? `quote-final:${currentQuote.id}`
              : undefined
          : undefined)
        const existingSourcePayment = existing ?? (sourceKey ? current.payments.find((item) => item.sourceKey === sourceKey) : undefined)
        const bankAccount = values.bankAccountId ? current.bankAccounts.find((account) => account.id === values.bankAccountId) : undefined
        const payment: Payment = {
          id: existingSourcePayment?.id ?? createId('pay'),
          ...values,
          projectId: currentProject?.id,
          clientId: paymentClient.id,
          leadId: currentLead?.id,
          quoteId: currentQuote?.id,
          paidAt: values.paidAt ? asIsoFromInput(values.paidAt) : undefined,
          receiptUrl: values.receiptUrl || undefined,
          bankAccountId: bankAccount?.id,
          account: bankAccount?.name || values.account || undefined,
          confirmedAt: values.status === 'Recebida' && values.confirmedReceived ? now : undefined,
          sourceKey,
          createdAt: existingSourcePayment?.createdAt ?? now,
          updatedAt: now,
        }
        const installmentGroupId = !existing && values.installmentCount > 1 ? createId('installments') : undefined
        const installmentPayments = installmentGroupId ? Array.from({ length: values.installmentCount }, (_, index) => {
          const regularAmount = Math.floor((values.amount / values.installmentCount) * 100) / 100
          const installmentAmount = index === values.installmentCount - 1 ? values.amount - regularAmount * (values.installmentCount - 1) : regularAmount
          return { ...payment, id: createId('pay'), paymentType: 'Parcela' as const, amount: installmentAmount, dueDate: addCalendarDays(values.dueDate, index * values.installmentIntervalDays), paidAt: undefined, status: 'Pendente' as const, confirmedReceived: false, confirmedAt: undefined, installmentGroupId, installmentNumber: index + 1, installmentCount: values.installmentCount, transactionNumber: undefined, receiptUrl: undefined, notes: `${values.notes || 'Pagamento parcelado'} · parcela ${index + 1}/${values.installmentCount}.`, createdAt: now, updatedAt: now }
        }) : [payment]
        const payments = [...installmentPayments, ...current.payments.filter((item) => item.id !== existingSourcePayment?.id)]
        const receivedTotal = currentProject ? payments.filter((item) => item.projectId === currentProject.id).reduce((total, item) => total + getPaymentCashEffect(item), 0) : 0
        const existingReceiptFile = current.files.find((file) => file.paymentId === payment.id)
        return {
          ...current,
          clients: createdClient ? [createdClient, ...current.clients] : current.clients,
          payments,
          projects: currentProject ? current.projects.map((item) =>
            item.id === currentProject.id
              ? {
                  ...recalculateProjectFinancials(item, payments),
                  projectStatus: receivedTotal >= currentProject.totalValue && values.paymentType === 'Pagamento final'
                    ? 'Pago'
                    : receivedTotal < currentProject.totalValue && item.projectStatus === 'Pago'
                      ? 'Aguardando pagamento final'
                      : item.projectStatus,
                }
              : item,
          ) : current.projects,
          files: values.receiptUrl ? [{
            id: existingReceiptFile?.id ?? createId('file'),
            projectId: currentProject?.id,
            clientId: paymentClient.id,
            leadId: currentLead?.id,
            quoteId: currentQuote?.id,
            paymentId: payment.id,
            fileName: `Comprovante - ${payment.paymentType}`,
            fileType: 'payment-receipt',
            fileUrl: values.receiptUrl,
            description: `Comprovante vinculado ao pagamento ${payment.id}.`,
            clientVisible: false,
            uploadedBy: activeUserId,
            receiptStatus: existingReceiptFile?.receiptStatus ?? 'Anexado',
            createdAt: existingReceiptFile?.createdAt ?? now,
          }, ...current.files.filter((file) => file.id !== existingReceiptFile?.id)] : current.files,
          statusHistory: [createStatusHistory('Pagamento', payment.id, existing ? 'Pagamento editado' : 'Pagamento registrado', `${formatCurrency(payment.amount)} · ${payment.status}.`, activeUserId, existing?.status, payment.status, now), ...current.statusHistory],
        }
      },
      selectedFinancePaymentId ? 'Lançamento atualizado e histórico registrado.' : 'Pagamento registrado.',
    )
    setModal(null)
    setSelectedPaymentProjectId('')
    setSelectedFinancePaymentId('')
  }

  const openReceiptModal = (payment: Payment) => {
    setSelectedReceiptPaymentId(payment.id)
    setModal('receipt')
  }

  const openEquipmentModal = (equipment?: Equipment) => {
    setSelectedEquipmentId(equipment?.id ?? '')
    setModal('equipment')
  }

  const savePaymentReceipt = (paymentId: string, values: ReceiptFormValues) => {
    const now = new Date().toISOString()
    updateState(
      (current) => {
        const payment = current.payments.find((item) => item.id === paymentId)
        const project = payment?.projectId ? current.projects.find((item) => item.id === payment.projectId) : undefined
        const newReceipts = values.receipts.filter((receipt) => receipt.receiptUrl)
        const latestReceipt = newReceipts.at(-1)
        const createdFiles = payment ? newReceipts.map((receipt) => ({ id: createId('file'), projectId: payment.projectId, clientId: payment.clientId, leadId: payment.leadId ?? project?.leadId, quoteId: payment.quoteId ?? project?.quoteId, paymentId, fileName: receipt.fileName || `Comprovante - ${payment.paymentType}`, fileType: receipt.fileType || 'payment-receipt', fileSize: receipt.fileSize, fileUrl: receipt.receiptUrl, description: 'Comprovante financeiro vinculado.', clientVisible: false, uploadedBy: activeUserId, receiptStatus: receipt.status, verifiedAt: receipt.status === 'Conferido' ? now : undefined, verifiedBy: receipt.status === 'Conferido' ? activeUserId : undefined, createdAt: now })) : []
        return {
        ...current,
        payments: current.payments.map((paymentItem) =>
          paymentItem.id === paymentId
            ? {
                ...paymentItem,
                receiptUrl: latestReceipt?.receiptUrl || paymentItem.receiptUrl,
                updatedAt: now,
              }
            : paymentItem,
        ),
        files: [...createdFiles, ...current.files],
        statusHistory: payment && newReceipts.length ? [createStatusHistory('Pagamento', paymentId, 'Comprovantes anexados', `${newReceipts.length} novo(s) comprovante(s).`, activeUserId, payment.status, payment.status, now), ...current.statusHistory] : current.statusHistory,
      }
      },
      values.receipts.length ? `${values.receipts.length} comprovante(s) adicionado(s).` : 'Nenhum novo comprovante adicionado.',
    )
    setModal(null)
    setSelectedReceiptPaymentId('')
  }

  const saveEquipment = (values: EquipmentFormValues) => {
    const now = new Date().toISOString()

    updateState(
      (current) => {
        const existing = selectedEquipmentId
          ? current.equipment.find((equipment) => equipment.id === selectedEquipmentId)
          : undefined

        const equipment: Equipment = {
          id: existing?.id ?? createId('eqp'),
          ...values,
          lastMaintenanceDate: values.lastMaintenanceDate || undefined,
          nextMaintenanceDate: values.nextMaintenanceDate || undefined,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }

        return {
          ...current,
          equipment: existing
            ? current.equipment.map((item) => (item.id === existing.id ? equipment : item))
            : [equipment, ...current.equipment],
        }
      },
      selectedEquipmentId ? 'Equipamento atualizado.' : 'Equipamento cadastrado.',
    )
    setModal(null)
    setSelectedEquipmentId('')
  }

  const deleteEquipment = (equipment: Equipment) => {
    requestConfirm({
      title: 'Excluir equipamento?',
      description: `${equipment.name} será removido do inventário. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir equipamento',
      tone: 'danger',
      onConfirm: () => {
        updateState(
          (current) => ({
            ...current,
            equipment: current.equipment.filter((item) => item.id !== equipment.id),
          }),
          'Equipamento excluído.',
        )
      },
    })
  }

  const addExpense = (values: ExpenseFormValues) => {
    if (values.transactionNumber && state.expenses.some((expense) => expense.id !== selectedFinanceExpenseId && expense.transactionNumber?.trim() === values.transactionNumber.trim() && !expense.deletedAt)) {
      setToast('Já existe uma despesa com este número de transação.')
      return
    }
    const existingExpense = selectedFinanceExpenseId ? state.expenses.find((expense) => expense.id === selectedFinanceExpenseId) : undefined
    if (!existingExpense && values.installmentCount > 1 && values.status === 'Paga') { setToast('Para parcelar uma despesa, salve como prevista ou a pagar e confirme cada parcela separadamente.'); return }
    if (!existingExpense && values.installmentCount > 1 && values.recurring) { setToast('Escolha parcelamento ou recorrência; os dois não podem ser usados no mesmo lançamento.'); return }
    if (values.status === 'Paga' && !state.bankAccounts.some((account) => account.id === values.bankAccountId && (account.active || account.id === existingExpense?.bankAccountId))) {
      setToast('Selecione a conta bancária usada no pagamento.')
      return
    }
    const now = new Date().toISOString()
    updateState(
      (current) => {
        const existing = selectedFinanceExpenseId ? current.expenses.find((item) => item.id === selectedFinanceExpenseId) : undefined
        const bankAccount = values.bankAccountId ? current.bankAccounts.find((account) => account.id === values.bankAccountId) : undefined
        const expense: Expense = {
          id: existing?.id ?? createId('exp'),
          ...values,
          projectId: values.projectId || undefined,
          dueDate: values.dueDate || undefined,
          paidAt: ['Paga', 'Reembolsada'].includes(values.status) && values.paidAt ? asIsoFromInput(values.paidAt) : undefined,
          recurrenceFrequency: values.recurring ? values.recurrenceFrequency : undefined,
          recurrenceEndDate: values.recurring && values.recurrenceEndDate ? values.recurrenceEndDate : undefined,
          receiptUrl: existing?.receiptUrl,
          bankAccountId: bankAccount?.id,
          account: bankAccount?.name || values.account || undefined,
          archivedAt: existing?.archivedAt,
          archivedBy: existing?.archivedBy,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        const installmentGroupId = !existing && values.installmentCount > 1 ? createId('expense-installments') : undefined
        const installmentExpenses = installmentGroupId ? Array.from({ length: values.installmentCount }, (_, index) => {
          const regularAmount = Math.floor((values.amount / values.installmentCount) * 100) / 100
          const installmentAmount = index === values.installmentCount - 1 ? values.amount - regularAmount * (values.installmentCount - 1) : regularAmount
          const dueDate = addCalendarDays(values.dueDate || values.expenseDate, index * values.installmentIntervalDays)
          return { ...expense, id: createId('exp'), amount: installmentAmount, expenseDate: dueDate, dueDate, status: 'A pagar' as const, paidAt: undefined, bankAccountId: undefined, account: undefined, transactionNumber: undefined, installmentGroupId, installmentNumber: index + 1, installmentCount: values.installmentCount, notes: `${values.notes || 'Despesa parcelada'} · parcela ${index + 1}/${values.installmentCount}.`, createdAt: now, updatedAt: now }
        }) : [expense]
        return {
          ...current,
          expenses: [...installmentExpenses, ...current.expenses.filter((item) => item.id !== expense.id)],
        }
      },
      selectedFinanceExpenseId ? 'Despesa atualizada.' : 'Despesa registrada.',
    )
    setModal(null)
    setSelectedFinanceExpenseId('')
  }

  const openPaymentEditor = (payment?: Payment) => {
    setSelectedFinancePaymentId(payment?.id ?? '')
    setSelectedPaymentProjectId(payment?.projectId ?? '')
    setModal('payment')
  }

  const openExpenseEditor = (expense?: Expense) => {
    setSelectedFinanceExpenseId(expense?.id ?? '')
    setModal('expense')
  }

  const openBankAccountEditor = (account?: BankAccount) => {
    setSelectedBankAccountId(account?.id ?? '')
    setModal('bankAccount')
  }

  const saveBankAccount = (values: BankAccountFormValues) => {
    const normalizedName = values.name.trim().toLowerCase()
    if (state.bankAccounts.some((account) => account.id !== selectedBankAccountId && account.name.trim().toLowerCase() === normalizedName)) {
      setToast('Já existe uma conta bancária com este nome.')
      return
    }
    const now = new Date().toISOString()
    updateState((current) => {
      const existing = selectedBankAccountId ? current.bankAccounts.find((account) => account.id === selectedBankAccountId) : undefined
      const account: BankAccount = {
        id: existing?.id ?? createId('bank'),
        ...values,
        name: values.name.trim(),
        bankName: values.bankName.trim(),
        agency: values.agency.trim() || undefined,
        accountNumber: values.accountNumber.trim() || undefined,
        notes: values.notes.trim(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      return {
        ...current,
        bankAccounts: existing
          ? current.bankAccounts.map((item) => item.id === existing.id ? account : item)
          : [account, ...current.bankAccounts],
        payments: existing
          ? current.payments.map((payment) => payment.bankAccountId === existing.id ? { ...payment, account: account.name, updatedAt: now } : payment)
          : current.payments,
        expenses: existing
          ? current.expenses.map((expense) => expense.bankAccountId === existing.id ? { ...expense, account: account.name, updatedAt: now } : expense)
          : current.expenses,
        statusHistory: [createStatusHistory('Conta bancária', account.id, existing ? 'Conta bancária editada' : 'Conta bancária criada', `${account.name} · ${account.bankName}.`, activeUserId, existing?.active ? 'Ativa' : existing ? 'Inativa' : undefined, account.active ? 'Ativa' : 'Inativa', now), ...current.statusHistory],
      }
    }, selectedBankAccountId ? 'Conta bancária atualizada.' : 'Conta bancária criada.')
    setSelectedBankAccountId('')
    setModal(null)
  }

  const deleteBankAccount = (account: BankAccount) => {
    const linkedPayments = state.payments.filter((payment) => payment.bankAccountId === account.id).length
    const linkedExpenses = state.expenses.filter((expense) => expense.bankAccountId === account.id).length
    const linkedTransfers = state.bankTransfers.filter((transfer) => transfer.fromAccountId === account.id || transfer.toAccountId === account.id).length
    if (linkedPayments || linkedExpenses || linkedTransfers) {
      showNotice({
        title: 'Conta com movimentações',
        description: `Esta conta possui ${linkedPayments} receita(s), ${linkedExpenses} despesa(s) e ${linkedTransfers} transferência(s). Edite a conta e desative-a para preservar o histórico.`,
        tone: 'warning',
      })
      return
    }
    requestConfirm({
      title: 'Excluir conta bancária?',
      description: `${account.name} será removida definitivamente.`,
      confirmLabel: 'Excluir conta',
      tone: 'danger',
      onConfirm: () => {
        const now = new Date().toISOString()
        updateState((current) => ({
          ...current,
          bankAccounts: current.bankAccounts.filter((item) => item.id !== account.id),
          statusHistory: [createStatusHistory('Conta bancária', account.id, 'Conta bancária excluída', account.name, activeUserId, account.active ? 'Ativa' : 'Inativa', 'Excluída', now), ...current.statusHistory],
        }), 'Conta bancária excluída.')
      },
    })
  }

  const openBankTransferEditor = (transfer?: BankTransfer) => {
    setSelectedBankTransferId(transfer?.id ?? '')
    setModal('bankTransfer')
  }

  const saveBankTransfer = (values: BankTransferFormValues) => {
    const source = state.bankAccounts.find((account) => account.id === values.fromAccountId && account.active)
    const destination = state.bankAccounts.find((account) => account.id === values.toAccountId && account.active)
    if (!source || !destination || source.id === destination.id) {
      setToast('Selecione duas contas ativas e diferentes.')
      return
    }
    const existing = selectedBankTransferId ? state.bankTransfers.find((transfer) => transfer.id === selectedBankTransferId) : undefined
    const availableBeforeTransfer = getBankAccountBalance(state, source)
      + (existing?.fromAccountId === source.id ? existing.amount : 0)
      - (existing?.toAccountId === source.id ? existing.amount : 0)
    if (values.amount <= 0 || values.amount > availableBeforeTransfer) {
      setToast(`Saldo disponível em ${source.name}: ${formatCurrency(availableBeforeTransfer)}.`)
      return
    }
    const now = new Date().toISOString()
    updateState((current) => {
      const transfer: BankTransfer = {
        id: existing?.id ?? createId('transfer'),
        ...values,
        transferredAt: asIsoFromInput(values.transferredAt),
        description: values.description.trim() || `Transferência de ${source.name} para ${destination.name}`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      return {
        ...current,
        bankTransfers: existing
          ? current.bankTransfers.map((item) => item.id === existing.id ? transfer : item)
          : [transfer, ...current.bankTransfers],
        statusHistory: [createStatusHistory('Transferência', transfer.id, existing ? 'Transferência editada' : 'Transferência realizada', `${source.name} → ${destination.name} · ${formatCurrency(transfer.amount)}.`, activeUserId, undefined, 'Concluída', now), ...current.statusHistory],
      }
    }, selectedBankTransferId ? 'Transferência atualizada.' : 'Transferência registrada.')
    setSelectedBankTransferId('')
    setModal(null)
  }

  const deleteBankTransfer = (transfer: BankTransfer) => {
    const source = state.bankAccounts.find((account) => account.id === transfer.fromAccountId)
    const destination = state.bankAccounts.find((account) => account.id === transfer.toAccountId)
    requestConfirm({
      title: 'Excluir transferência?',
      description: `${formatCurrency(transfer.amount)} de ${source?.name || 'conta de origem'} para ${destination?.name || 'conta de destino'} será estornado dos saldos.`,
      confirmLabel: 'Excluir transferência',
      tone: 'danger',
      onConfirm: () => {
        const now = new Date().toISOString()
        updateState((current) => ({
          ...current,
          bankTransfers: current.bankTransfers.filter((item) => item.id !== transfer.id),
          statusHistory: [createStatusHistory('Transferência', transfer.id, 'Transferência excluída', `${source?.name || '-'} → ${destination?.name || '-'} · ${formatCurrency(transfer.amount)}.`, activeUserId, 'Concluída', 'Excluída', now), ...current.statusHistory],
        }), 'Transferência excluída e saldos recalculados.')
      },
    })
  }

  const archiveFinancialRecord = (kind: 'payment' | 'expense', id: string, archived: boolean) => {
    const now = new Date().toISOString()
    updateState((current) => ({
      ...current,
      payments: kind === 'payment' ? current.payments.map((item) => item.id === id ? { ...item, archivedAt: archived ? now : undefined, archivedBy: archived ? activeUserId : undefined, deletedAt: archived ? item.deletedAt : undefined, deletedBy: archived ? item.deletedBy : undefined, deletionReason: archived ? item.deletionReason : undefined, updatedAt: now } : item) : current.payments,
      expenses: kind === 'expense' ? current.expenses.map((item) => item.id === id ? { ...item, archivedAt: archived ? now : undefined, archivedBy: archived ? activeUserId : undefined, deletedAt: archived ? item.deletedAt : undefined, deletedBy: archived ? item.deletedBy : undefined, deletionReason: archived ? item.deletionReason : undefined, updatedAt: now } : item) : current.expenses,
    }), archived ? 'Lançamento arquivado.' : 'Lançamento restaurado.')
  }

  const deleteFinancialRecord = (kind: 'payment' | 'expense', record: Payment | Expense) => {
    requestConfirm({
      title: 'Excluir lançamento logicamente?',
      description: 'O lançamento sairá das telas principais, mas comprovantes, vínculos e histórico serão preservados.',
      confirmLabel: 'Excluir logicamente',
      tone: 'danger',
      onConfirm: () => {
        requestInput({
          title: 'Excluir lançamento',
          description: 'O motivo é opcional. O lançamento será removido das telas principais sem apagar vínculos ou comprovantes.',
          label: 'Motivo da exclusão',
          inputType: 'textarea',
          required: false,
          confirmLabel: 'Excluir logicamente',
          tone: 'danger',
          onSubmit: (reason) => {
            const now = new Date().toISOString()
            const detail = reason || 'Sem motivo informado.'
            updateState((current) => ({
              ...current,
              payments: kind === 'payment' ? current.payments.map((item) => item.id === record.id ? { ...item, deletedAt: now, deletedBy: activeUserId, deletionReason: reason || undefined, updatedAt: now } : item) : current.payments,
              expenses: kind === 'expense' ? current.expenses.map((item) => item.id === record.id ? { ...item, deletedAt: now, deletedBy: activeUserId, deletionReason: reason || undefined, updatedAt: now } : item) : current.expenses,
              statusHistory: kind === 'payment' ? [createStatusHistory('Pagamento', record.id, 'Lançamento excluído logicamente', detail, activeUserId, (record as Payment).status, (record as Payment).status, now), ...current.statusHistory] : current.statusHistory,
            }), 'Lançamento excluído logicamente.')
          },
        })
      },
    })
  }

  const updatePaymentStatus = (payment: Payment, status: Payment['status']) => {
    if (status === 'Recebida') {
      openPaymentEditor(payment)
      return
    }
    const now = new Date().toISOString()
    updateState((current) => ({
      ...current,
      payments: current.payments.map((item) => item.id === payment.id ? { ...item, status, paidAt: undefined, confirmedReceived: false, updatedAt: now } : item),
      statusHistory: [createStatusHistory('Pagamento', payment.id, 'Status financeiro alterado', `${payment.status} → ${status}.`, activeUserId, payment.status, status, now), ...current.statusHistory],
    }), `Lançamento marcado como ${status.toLowerCase()}.`)
  }

  const reversePayment = (payment: Payment) => {
    if (payment.status !== 'Recebida' || payment.paymentType === 'Reembolso' || payment.reversedByPaymentId) return
    requestConfirm({
      title: 'Registrar estorno?',
      description: `${formatCurrency(payment.amount)} será registrado como saída na mesma conta. O recebimento original será preservado para auditoria.`,
      confirmLabel: 'Registrar estorno',
      cancelLabel: 'Cancelar',
      tone: 'warning',
      onConfirm: () => {
        const now = new Date().toISOString()
        updateState((current) => {
          const reversalId = createId('refund')
          const reversal: Payment = { ...payment, id: reversalId, paymentType: 'Reembolso', status: 'Recebida', dueDate: dateInput(), paidAt: now, confirmedReceived: true, confirmedAt: now, receiptUrl: undefined, transactionNumber: undefined, sourceKey: undefined, reversalOfPaymentId: payment.id, reversedByPaymentId: undefined, notes: `Estorno vinculado ao recebimento ${payment.id}.`, createdAt: now, updatedAt: now }
          const payments = [reversal, ...current.payments.map((item) => item.id === payment.id ? { ...item, reversedByPaymentId: reversalId, updatedAt: now } : item)]
          return {
            ...current,
            payments,
            projects: payment.projectId ? current.projects.map((project) => project.id === payment.projectId ? { ...recalculateProjectFinancials(project, payments), projectStatus: project.projectStatus === 'Pago' ? 'Aguardando pagamento final' : project.projectStatus } : project) : current.projects,
            statusHistory: [createStatusHistory('Pagamento', payment.id, 'Estorno registrado', `${formatCurrency(payment.amount)} estornado com vínculo ${reversalId}.`, activeUserId, payment.status, payment.status, now), ...current.statusHistory],
          }
        }, 'Estorno registrado e vinculado ao recebimento original.')
      },
    })
  }

  const markPaymentPaid = (payment: Payment) => {
    const paymentLabel = payment.paymentType === 'Sinal' ? 'sinal' : payment.paymentType === 'Pagamento final' ? 'pagamento final' : 'pagamento'
    if (payment.status === 'Recebida') {
      requestConfirm({
        title: `Desmarcar ${paymentLabel} como pago?`,
        description: `${formatCurrency(payment.amount)} voltará para pendente. O comprovante anexado será preservado.`,
        confirmLabel: 'Desmarcar pagamento',
        cancelLabel: 'Manter como pago',
        tone: 'warning',
        onConfirm: () => {
          const now = new Date().toISOString()
          updateState((current) => {
            const payments = current.payments.map((item) => item.id === payment.id ? { ...item, status: 'Pendente' as const, paidAt: undefined, confirmedReceived: false, confirmedAt: undefined, updatedAt: now } : item)
            const project = payment.projectId ? current.projects.find((item) => item.id === payment.projectId) : undefined
            const hasActiveProject = payment.leadId ? current.projects.some((item) => item.leadId === payment.leadId && !item.deletedAt && item.projectStatus !== 'Cancelado') : false
            return {
              ...current,
              payments,
              quotes: payment.paymentType === 'Sinal' && payment.quoteId
                ? current.quotes.map((quote) => quote.id === payment.quoteId && quote.status === 'Entrada recebida' ? { ...quote, status: 'Aguardando entrada', updatedAt: now } : quote)
                : current.quotes,
              leads: payment.paymentType === 'Sinal' && payment.leadId && !hasActiveProject
                ? current.leads.map((lead) => lead.id === payment.leadId ? { ...lead, pipelineStage: 'Aguardando entrada', updatedAt: now } : lead)
                : current.leads,
              projects: project ? current.projects.map((item) => {
                if (item.id !== project.id) return item
                const recalculated = recalculateProjectFinancials(item, payments)
                return { ...recalculated, projectStatus: payment.paymentType === 'Pagamento final' && item.projectStatus === 'Pago' ? 'Aguardando pagamento final' : recalculated.projectStatus }
              }) : current.projects,
              statusHistory: [createStatusHistory('Pagamento', payment.id, 'Confirmação de pagamento desfeita', `${payment.paymentType} de ${formatCurrency(payment.amount)} voltou para pendente.`, activeUserId, payment.status, 'Pendente', now), ...current.statusHistory],
            }
          }, `${payment.paymentType} voltou para pendente.`)
        },
      })
      return
    }
    openPaymentEditor(payment)
    setToast(`Confirme o recebimento do ${paymentLabel} e escolha a conta de destino.`)
  }

  const addQuote = (values: QuoteFormValues) => {
    const now = new Date().toISOString()
    updateState(
      (current) => {
        const subtotal = values.quantity * values.unitPrice
        const totalValue = subtotal - values.discount + values.travelFee + values.urgencyFee
        const quoteId = createId('quote')
        const quote: Quote = {
          id: quoteId,
          quoteNumber: `ORC-${new Date().getFullYear()}-${String(current.quotes.length + 1).padStart(3, '0')}`,
          leadId: values.leadId || undefined,
          clientId: values.clientId || undefined,
          issueDate: dateInput(),
          expirationDate: values.expirationDate,
          subtotal,
          discount: values.discount,
          travelFee: values.travelFee,
          urgencyFee: values.urgencyFee,
          totalValue,
          depositValue: values.depositValue,
          deliveryDeadline: values.deliveryDeadline,
          paymentTerms: values.paymentTerms,
          status: values.status,
          notes: values.notes,
          createdAt: now,
          updatedAt: now,
        }

        return {
          ...current,
          quotes: [quote, ...current.quotes],
          quoteItems: [
            {
              id: createId('qitem'),
              quoteId,
              description: values.description,
              quantity: values.quantity,
              unitPrice: values.unitPrice,
              totalPrice: subtotal,
              createdAt: now,
            },
            ...current.quoteItems,
          ],
        }
      },
      'Orçamento criado.',
    )
    setModal(null)
  }

  const addProposal = (values: ProposalFormValues) => {
    const now = new Date().toISOString()
    const subtotal = values.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
    const totalValue = Math.max(subtotal - values.discount + values.travelFee + values.urgencyFee, 0)
    const depositValue = totalValue * (values.depositPercentage / 100)
    const proposalStatus: Quote['status'] = values.status === 'Rascunho' ? 'Gerada' : values.status

    updateState(
      (current) => {
        const existingQuote = values.quoteId
          ? current.quotes.find((quote) => quote.id === values.quoteId)
          : undefined
        const quoteId = existingQuote?.id ?? createId('quote')
        const packageDescription = proposalPackages.find((item) => item.id === values.packageId)?.description
        const nextLeadStage: PipelineStage = ['Aprovada', 'Aguardando entrada'].includes(proposalStatus)
          ? 'Aguardando entrada'
          : ['Enviada', 'Visualizada'].includes(proposalStatus)
            ? 'Proposta enviada'
            : 'Em negociação'
        const nextLeadProbability = ['Aprovada', 'Aguardando entrada'].includes(proposalStatus) ? 80 : proposalStatus === 'Enviada' ? 45 : 30
        const updatedLeads = values.leadId
          ? current.leads.map((lead) =>
              lead.id === values.leadId
                ? {
                    ...lead,
                    pipelineStage: keepMostAdvancedCommercialStage(lead.pipelineStage, nextLeadStage),
                    estimatedValue: totalValue,
                    probability: Math.max(lead.probability, nextLeadProbability),
                    lastContactAt: now,
                    updatedAt: now,
                  }
                : lead,
            )
          : current.leads
        const quote: Quote = {
          id: quoteId,
          quoteNumber: existingQuote?.quoteNumber ?? getNextQuoteNumber(current.quotes),
          version: existingQuote?.version ?? 0,
          clientId: values.clientId || undefined,
          leadId: values.leadId || undefined,
          issueDate: existingQuote?.issueDate ?? dateInput(),
          expirationDate: values.expirationDate,
          subtotal,
          discount: values.discount,
          travelFee: values.travelFee,
          urgencyFee: values.urgencyFee,
          totalValue,
          depositValue,
          deliveryDeadline: values.deliveryDeadline,
          paymentTerms: values.paymentTerms,
          status: proposalStatus,
          sentAt: proposalStatus === 'Enviada' ? existingQuote?.sentAt ?? now : existingQuote?.sentAt,
          approvedAt: proposalStatus === 'Aprovada' || proposalStatus === 'Aguardando entrada' ? existingQuote?.approvedAt ?? now : existingQuote?.approvedAt,
          approvedBy: proposalStatus === 'Aprovada' || proposalStatus === 'Aguardando entrada' ? existingQuote?.approvedBy ?? currentUser?.name ?? 'Usuário do sistema' : existingQuote?.approvedBy,
          approvalMethod: proposalStatus === 'Aprovada' || proposalStatus === 'Aguardando entrada' ? existingQuote?.approvalMethod ?? 'Manual' : existingQuote?.approvalMethod,
          validityChangeReason: values.validityChangeReason || undefined,
          serviceLocation: values.leadId
            ? current.leads.find((lead) => lead.id === values.leadId)?.address
            : current.clients.find((client) => client.id === values.clientId)?.address,
          responsibleUserId: existingQuote?.responsibleUserId ?? activeUserId,
          notes: [
            values.title,
            packageDescription,
            values.notes,
          ]
            .filter(Boolean)
            .join('\n\n'),
          createdAt: existingQuote?.createdAt ?? now,
          updatedAt: now,
        }
        const quoteItems = values.items.map((item) => ({
          id: createId('qitem'),
          quoteId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          createdAt: now,
        }))

        if (existingQuote) {
          return {
            ...current,
            quotes: current.quotes.map((item) => (item.id === existingQuote.id ? quote : item)),
            quoteItems: [...quoteItems, ...current.quoteItems.filter((item) => item.quoteId !== existingQuote.id)],
            leads: updatedLeads,
            statusHistory: existingQuote.status !== quote.status
              ? [createStatusHistory('Proposta', quote.id, 'Status alterado', `${quote.quoteNumber}: ${existingQuote.status} → ${quote.status}.`, activeUserId, existingQuote.status, quote.status, now), ...current.statusHistory]
              : current.statusHistory,
          }
        }

        return {
          ...current,
          quotes: [quote, ...current.quotes],
          quoteItems: [...quoteItems, ...current.quoteItems],
          leads: updatedLeads,
          statusHistory: [createStatusHistory('Proposta', quote.id, 'Proposta criada', `${quote.quoteNumber} criada para o contato.`, activeUserId, undefined, quote.status, now), ...current.statusHistory],
        }
      },
      values.quoteId ? 'Proposta atualizada.' : 'Proposta gerada com dados de contato.',
    )
    closeProposalModal()
  }

  const approveQuote = (quote: Quote) => {
    if (quote.status === 'Expirada') {
      setToast('A proposta expirou. Crie uma revisão ou renove antes de aprovar.')
      return
    }
    const items = state.quoteItems.filter((item) => item.quoteId === quote.id)
    if (!quote.clientId && !quote.leadId) {
      setToast('A proposta precisa estar vinculada a um contato.')
      return
    }
    if (!items.length || quote.totalValue <= 0) {
      setToast('Uma proposta sem itens e valor não pode ser aprovada.')
      return
    }
    const now = new Date().toISOString()
    updateState(
      (current) => {
        const lead = quote.leadId ? current.leads.find((item) => item.id === quote.leadId) : undefined
        const existingClient = quote.clientId
          ? current.clients.find((item) => item.id === quote.clientId)
          : lead
            ? findClientForLead(current.clients, lead)
            : undefined
        const client = existingClient ?? (lead ? createClientFromLead(lead, now) : undefined)
        if (!client) return current
        const depositKey = `quote-deposit:${quote.id}`
        const finalKey = `quote-final:${quote.id}`
        const predictedPayments: Payment[] = []
        if (quote.depositValue > 0 && !current.payments.some((payment) => payment.sourceKey === depositKey)) {
          predictedPayments.push({
            id: createId('pay'),
            clientId: client.id,
            leadId: quote.leadId,
            quoteId: quote.id,
            paymentType: 'Sinal',
            amount: quote.depositValue,
            dueDate: dateInput(),
            paymentMethod: 'PIX',
            status: 'Pendente',
            notes: 'Entrada prevista após aprovação da proposta.',
            confirmedReceived: false,
            sourceKey: depositKey,
            createdAt: now,
            updatedAt: now,
          })
        }
        const remaining = Math.max(quote.totalValue - quote.depositValue, 0)
        if (remaining > 0 && !current.payments.some((payment) => payment.sourceKey === finalKey)) {
          predictedPayments.push({
            id: createId('pay'),
            clientId: client.id,
            leadId: quote.leadId,
            quoteId: quote.id,
            paymentType: 'Pagamento final',
            amount: remaining,
            dueDate: quote.deliveryDeadline,
            paymentMethod: 'PIX',
            status: 'Pendente',
            notes: 'Saldo previsto para a conclusão e entrega.',
            confirmedReceived: false,
            sourceKey: finalKey,
            createdAt: now,
            updatedAt: now,
          })
        }
        return {
          ...current,
          clients: existingClient ? current.clients : [client, ...current.clients],
          quotes: current.quotes.map((item) => item.id === quote.id ? {
            ...item,
            clientId: client.id,
            status: 'Aguardando entrada',
            approvedAt: now,
            approvedBy: currentUser?.name ?? 'Usuário do sistema',
            approvalMethod: 'Manual',
            updatedAt: now,
          } : item),
          payments: [...predictedPayments, ...current.payments],
          leads: quote.leadId ? current.leads.map((leadItem) => leadItem.id === quote.leadId ? {
            ...leadItem,
            pipelineStage: 'Aguardando entrada',
            probability: Math.max(leadItem.probability, 80),
            updatedAt: now,
          } : leadItem) : current.leads,
          statusHistory: [
            createStatusHistory('Proposta', quote.id, 'Proposta aprovada', `${quote.quoteNumber} aprovada manualmente. Aguardando confirmação da entrada.`, activeUserId, quote.status, 'Aguardando entrada', now),
            ...current.statusHistory,
          ],
        }
      },
      'Proposta aprovada. Entrada e saldo foram lançados como previstos.',
    )
  }

  const confirmQuoteApproval = (quote: Quote) => {
    requestConfirm({
      title: 'Aprovar proposta?',
      description: `${quote.quoteNumber} será aprovada e os valores de entrada e saldo serão lançados como previstos no financeiro.`,
      confirmLabel: 'Aprovar proposta',
      onConfirm: () => approveQuote(quote),
    })
  }

  const openQuotePayment = (quote: Quote) => {
    if (!['Aprovada', 'Aguardando entrada', 'Entrada recebida'].includes(quote.status)) {
      setToast('Aprove a proposta antes de registrar a entrada.')
      return
    }
    setSelectedQuotePaymentId(quote.id)
    setModal('quotePayment')
  }

  const registerQuoteDeposit = (quote: Quote, values: QuotePaymentFormValues) => {
    if (!values.confirmedReceived) {
      setToast('Confirme que o pagamento foi recebido e conferido.')
      return
    }
    if (values.amount <= 0 || !values.paidAt) {
      setToast('Informe valor e data do pagamento.')
      return
    }
    if (!state.bankAccounts.some((account) => account.id === values.bankAccountId && account.active)) {
      setToast('Selecione a conta bancária que recebeu a entrada.')
      return
    }
    if (values.amount > quote.totalValue) {
      setToast('A entrada não pode ser maior que o total da proposta.')
      return
    }
    const now = new Date().toISOString()
    updateState(
      (current) => {
        const latestQuote = current.quotes.find((item) => item.id === quote.id)
        if (!latestQuote) return current
        const lead = quote.leadId ? current.leads.find((item) => item.id === quote.leadId) : undefined
        const existingClient = quote.clientId
          ? current.clients.find((item) => item.id === quote.clientId)
          : lead
            ? findClientForLead(current.clients, lead)
            : undefined
        const client = existingClient ?? (lead ? createClientFromLead(lead, now) : undefined)
        if (!client) return current
        const remainingValue = Math.max(quote.totalValue - values.amount, 0)
        const depositKey = `quote-deposit:${quote.id}`
        const existingDeposit = current.payments.find((payment) => payment.sourceKey === depositKey)
        const bankAccount = current.bankAccounts.find((account) => account.id === values.bankAccountId)
        const depositPayment: Payment = {
          id: existingDeposit?.id ?? createId('pay'),
          projectId: existingDeposit?.projectId,
          clientId: client.id,
          leadId: quote.leadId,
          quoteId: quote.id,
          paymentType: 'Sinal',
          amount: values.amount,
          dueDate: existingDeposit?.dueDate ?? dateInput(),
          paidAt: asIsoFromInput(values.paidAt),
          paymentMethod: values.paymentMethod,
          status: 'Recebida',
          notes: values.notes || 'Entrada recebida e conferida.',
          receiptUrl: values.receiptUrl || undefined,
          bankAccountId: bankAccount?.id,
          account: bankAccount?.name || values.account,
          transactionNumber: values.transactionNumber || undefined,
          confirmedReceived: true,
          confirmedAt: now,
          sourceKey: depositKey,
          createdAt: existingDeposit?.createdAt ?? now,
          updatedAt: now,
        }
        const finalKey = `quote-final:${quote.id}`
        let payments = current.payments
          .filter((payment) => payment.id !== existingDeposit?.id)
          .map((payment) => payment.sourceKey === finalKey ? { ...payment, clientId: client.id, amount: remainingValue, updatedAt: now } : payment)
        if (remainingValue > 0 && !payments.some((payment) => payment.sourceKey === finalKey)) {
          payments = [{ id: createId('pay'), clientId: client.id, leadId: quote.leadId, quoteId: quote.id, paymentType: 'Pagamento final', amount: remainingValue, dueDate: quote.deliveryDeadline, paymentMethod: values.paymentMethod, status: 'Pendente', notes: 'Saldo previsto para aprovação final e entrega.', confirmedReceived: false, sourceKey: finalKey, createdAt: now, updatedAt: now }, ...payments]
        }
        const existingReceipt = current.files.find((file) => file.paymentId === depositPayment.id && !file.deletedAt)
        const receiptFile = values.receiptUrl
          ? [{
              id: existingReceipt?.id ?? createId('file'),
              clientId: client.id,
              leadId: quote.leadId,
              quoteId: quote.id,
              paymentId: depositPayment.id,
              fileName: `Comprovante de entrada - ${quote.quoteNumber}`,
              fileType: values.receiptUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image-or-link',
              fileUrl: values.receiptUrl,
              description: 'Comprovante da entrada confirmado manualmente.',
              clientVisible: false,
              uploadedBy: activeUserId,
              receiptStatus: 'Conferido' as const,
              verifiedAt: now,
              verifiedBy: activeUserId,
              createdAt: existingReceipt?.createdAt ?? now,
            }] : []
        return {
          ...current,
          clients: existingClient ? current.clients : [client, ...current.clients],
          payments: [depositPayment, ...payments],
          files: [...receiptFile, ...current.files.filter((file) => file.id !== existingReceipt?.id)],
          quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, clientId: client.id, status: 'Entrada recebida', updatedAt: now } : item),
          statusHistory: [
            createStatusHistory('Pagamento', depositPayment.id, 'Entrada confirmada', `${formatCurrency(values.amount)} recebido e conferido.`, activeUserId, existingDeposit?.status, 'Recebida', now),
            createStatusHistory('Proposta', quote.id, 'Entrada recebida', 'Entrada confirmada. A criação do projeto depende da confirmação do usuário.', activeUserId, latestQuote.status, 'Entrada recebida', now),
            ...current.statusHistory,
          ],
        }
      },
      'Entrada confirmada e financeiro atualizado. Confirme agora se deseja criar o projeto.',
    )
    setSelectedQuotePaymentId('')
    const lead = quote.leadId ? state.leads.find((item) => item.id === quote.leadId) : undefined
    if (lead) beginServiceConfirmation(lead, quote.id)
    else setModal(null)
  }

  const openCancelProposal = (quote: Quote) => {
    setSelectedQuoteActionId(quote.id)
    setModal('proposalCancel')
  }

  const cancelProposal = (quote: Quote, reason: string, notes: string, createNew: boolean, scheduleFuture: boolean) => {
    const now = new Date().toISOString()
    const detail = reason.trim() || 'Sem motivo informado'
    updateState((current) => ({
      ...current,
      quotes: current.quotes.map((item) => item.id === quote.id ? {
        ...item,
        status: 'Cancelada',
        cancellationReason: reason || undefined,
        cancellationNotes: notes,
        cancelledAt: now,
        cancelledBy: activeUserId,
        updatedAt: now,
      } : item),
      payments: current.payments.map((payment) => payment.quoteId === quote.id && payment.status !== 'Recebida' ? { ...payment, status: 'Cancelada', updatedAt: now } : payment),
      leads: scheduleFuture && quote.leadId ? current.leads.map((lead) => lead.id === quote.leadId ? { ...lead, pipelineStage: 'Retorno futuro', updatedAt: now } : lead) : current.leads,
      statusHistory: [
        createStatusHistory('Proposta', quote.id, 'Proposta cancelada', `${detail}${notes ? ` · ${notes}` : ''}. Pagamentos, comprovantes e projetos foram preservados.`, activeUserId, quote.status, 'Cancelada', now),
        ...current.statusHistory,
      ],
    }), 'Proposta cancelada e preservada no histórico.')
    setModal(null)
    setSelectedQuoteActionId('')
    if (createNew) cloneProposal(quote, false)
  }

  const openDeleteProposal = (quote: Quote) => {
    setSelectedQuoteActionId(quote.id)
    setModal('proposalDelete')
  }

  const proposalLinks = (quote: Quote) => ({
    payments: state.payments.filter((payment) => payment.quoteId === quote.id && !payment.deletedAt).length,
    receipts: state.files.filter((file) => file.quoteId === quote.id && file.paymentId && !file.deletedAt).length,
    projects: state.projects.filter((project) => project.quoteId === quote.id && !project.deletedAt).length,
    sentOrApproved: Boolean(quote.sentAt || quote.approvedAt || ['Enviada', 'Visualizada', 'Em negociação', 'Aprovada', 'Aguardando entrada', 'Entrada recebida', 'Convertida em projeto'].includes(quote.status)),
  })

  const softDeleteProposal = (quote: Quote, reason: string) => {
    const links = proposalLinks(quote)
    if (links.payments || links.receipts || links.projects || links.sentOrApproved) {
      setToast('Esta proposta possui registros relacionados. Cancele ou arquive para preservar os vínculos.')
      return
    }
    const now = new Date().toISOString()
    const detail = reason.trim() || 'Sem motivo informado.'
    updateState((current) => ({
      ...current,
      quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, status: 'Excluída logicamente', deletedAt: now, deletedBy: activeUserId, deletionReason: reason || undefined, updatedAt: now } : item),
      statusHistory: [createStatusHistory('Proposta', quote.id, 'Proposta excluída logicamente', detail, activeUserId, quote.status, 'Excluída logicamente', now), ...current.statusHistory],
    }), 'Proposta removida das ativas; histórico preservado.')
    setModal(null)
    setSelectedQuoteActionId('')
  }

  const archiveProposal = (quote: Quote) => {
    const now = new Date().toISOString()
    updateState((current) => ({
      ...current,
      quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, status: 'Arquivada', archivedAt: now, archivedBy: activeUserId, updatedAt: now } : item),
      statusHistory: [createStatusHistory('Proposta', quote.id, 'Proposta arquivada', 'Retirada das telas principais sem apagar vínculos.', activeUserId, quote.status, 'Arquivada', now), ...current.statusHistory],
    }), 'Proposta arquivada.')
    setModal(null)
    setSelectedQuoteActionId('')
  }

  const restoreProposal = (quote: Quote) => {
    const now = new Date().toISOString()
    const restoredStatus: Quote['status'] = quote.projectId ? 'Convertida em projeto' : quote.approvedAt ? 'Aguardando entrada' : quote.sentAt ? 'Enviada' : 'Gerada'
    updateState((current) => ({
      ...current,
      quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, status: restoredStatus, archivedAt: undefined, archivedBy: undefined, deletedAt: undefined, deletedBy: undefined, deletionReason: undefined, updatedAt: now } : item),
      statusHistory: [createStatusHistory('Proposta', quote.id, 'Proposta restaurada', `Restaurada com status ${restoredStatus}.`, activeUserId, quote.status, restoredStatus, now), ...current.statusHistory],
    }), 'Proposta restaurada.')
  }

  const markQuoteSent = (quote: Quote) => {
    const items = state.quoteItems.filter((item) => item.quoteId === quote.id)
    if (!items.length || quote.totalValue <= 0) {
      setToast('Inclua ao menos um item com valor antes de enviar.')
      return
    }
    const now = new Date().toISOString()
    updateState(
      (current) => ({
        ...current,
        quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, status: 'Enviada', sentAt: now, updatedAt: now } : item),
        leads: quote.leadId ? current.leads.map((lead) => lead.id === quote.leadId ? { ...lead, pipelineStage: 'Proposta enviada', lastContactAt: now, updatedAt: now } : lead) : current.leads,
        statusHistory: [createStatusHistory('Proposta', quote.id, 'Proposta enviada', `${quote.quoteNumber} marcada como enviada.`, activeUserId, quote.status, 'Enviada', now), ...current.statusHistory],
      }),
      'Proposta marcada como enviada.',
    )
  }

  const updateSettings = (values: SettingsFormValues) => {
    updateState(
      (current) => ({
        ...current,
        companySettings: {
          ...current.companySettings,
          ...values,
          updatedAt: new Date().toISOString(),
        },
      }),
      'Configurações salvas.',
    )
  }

  const addUser = async (values: UserFormValues) => {
    if (!can(currentUser, 'manageUsers')) {
      setToast('Seu usuário não tem permissão para criar contas.')
      return
    }

    const normalizedEmail = values.email.trim().toLowerCase()
    if (state.users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
      setToast('Já existe um usuário com este e-mail.')
      return
    }

    try {
      const account = isFirebaseConfigured
        ? await createFirebaseWorkspaceUser(normalizedEmail, values.password)
        : await createUserAuthAccount(normalizedEmail, values.password)
      const now = new Date().toISOString()
      const user: User = {
        id: account.userId,
        name: values.name,
        email: normalizedEmail,
        role: values.role,
        permissions: values.permissions,
        active: true,
        createdAt: now,
        updatedAt: now,
      }

      setState((current) => ({
        ...current,
        users: [user, ...current.users],
      }))
      setModal(null)
      setToast('Usuário criado com acesso interno.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Não foi possível criar o usuário.')
    }
  }

  const toggleUserActive = async (user: User) => {
    if (!can(currentUser, 'manageUsers')) {
      setToast('Seu usuário não tem permissão para gerenciar contas.')
      return
    }
    if (user.isPrimaryOwner) {
      setToast('A conta principal não pode ser desativada.')
      return
    }

    const nextActive = !user.active
    if (isFirebaseConfigured) {
      try {
        await setFirebaseWorkspaceUserActive(user.id, nextActive)
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Não foi possível atualizar o acesso no Firebase.')
        return
      }
    }

    updateState(
      (current) => ({
        ...current,
        users: current.users.map((item) =>
          item.id === user.id ? { ...item, active: nextActive, updatedAt: new Date().toISOString() } : item,
        ),
      }),
      user.active ? 'Usuário desativado.' : 'Usuário ativado.',
    )
  }

  const resetUserPassword = async (user: User) => {
    if (!can(currentUser, 'manageUsers')) {
      setToast('Seu usuário não tem permissão para redefinir senhas.')
      return
    }

    if (isFirebaseConfigured) {
      try {
        await requestFirebasePasswordReset(user.email)
        setToast(`E-mail de redefinição enviado para ${user.email}.`)
      } catch {
        setToast('Não foi possível enviar o e-mail de redefinição.')
      }
      return
    }

    requestInput({
      title: 'Redefinir senha',
      description: `Defina uma nova senha para ${user.email}.`,
      label: 'Nova senha',
      inputType: 'password',
      required: true,
      confirmLabel: 'Salvar nova senha',
      onSubmit: async (password) => {
        if (password.length < 8) {
          showNotice({ title: 'Senha muito curta', description: 'A senha precisa ter pelo menos 8 caracteres.', tone: 'warning' })
          return
        }
        try {
          await updateUserPassword(user.email, password)
          setToast('Senha redefinida.')
        } catch (error) {
          showNotice({ title: 'Não foi possível redefinir a senha', description: error instanceof Error ? error.message : 'Tente novamente.', tone: 'danger' })
        }
      },
    })
  }

  const beginServiceConfirmation = (lead: Lead, quoteId?: string) => {
    const relatedQuote = quoteId
      ? state.quotes.find((quote) => quote.id === quoteId)
      : state.quotes
          .filter((quote) => quote.leadId === lead.id && !quote.deletedAt && !quote.archivedAt)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .find((quote) => ['Aprovada', 'Aguardando entrada', 'Entrada recebida', 'Convertida em projeto'].includes(quote.status))
    setServiceConfirmation({ leadId: lead.id, previousStage: lead.pipelineStage, quoteId: relatedQuote?.id })
    setModal('serviceConfirmed')
  }

  const finishServiceConfirmation = (createProject: boolean) => {
    if (!serviceConfirmation) return
    const now = new Date().toISOString()
    const navigationLead = state.leads.find((lead) => lead.id === serviceConfirmation.leadId)
    updateState((current) => {
      const lead = current.leads.find((item) => item.id === serviceConfirmation.leadId)
      if (!lead) return current
      const quote = serviceConfirmation.quoteId
        ? current.quotes.find((item) => item.id === serviceConfirmation.quoteId)
        : current.quotes
            .filter((item) => item.leadId === lead.id && !item.deletedAt && !item.archivedAt)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      const existingProject = quote
        ? current.projects.find((project) => project.quoteId === quote.id && !project.deletedAt)
        : current.projects.find((project) => project.leadId === lead.id && !project.deletedAt && project.projectStatus !== 'Cancelado')

      if (!createProject) {
        return {
          ...current,
          leads: current.leads.map((item) => item.id === lead.id ? { ...item, pipelineStage: 'Serviço confirmado', probability: 100, updatedAt: now } : item),
          statusHistory: [
            createStatusHistory('Contato', lead.id, 'Serviço confirmado sem projeto', 'Movimentação confirmada. O projeto poderá ser criado posteriormente.', activeUserId, serviceConfirmation.previousStage, 'Serviço confirmado', now),
            ...current.statusHistory,
          ],
        }
      }

      if (existingProject) {
        const normalizedExistingStatus: Project['projectStatus'] = ['Aguardando agendamento', 'Agendado', 'Confirmação pendente', 'Aguardando sinal']
          .includes(existingProject.projectStatus)
          ? 'Confirmado'
          : existingProject.projectStatus
        return {
          ...current,
          leads: current.leads.map((item) => item.id === lead.id ? { ...item, pipelineStage: 'Serviço confirmado', probability: 100, updatedAt: now } : item),
          projects: current.projects.map((project) => project.id === existingProject.id
            ? { ...project, projectStatus: normalizedExistingStatus, updatedAt: now }
            : project),
          ...(normalizedExistingStatus !== existingProject.projectStatus
            ? {
                statusHistory: [
                  createStatusHistory(
                    'Projeto',
                    existingProject.id,
                    'Projeto confirmado',
                    `${existingProject.projectCode} marcado como confirmado ao entrar em projetos.`,
                    activeUserId,
                    existingProject.projectStatus,
                    normalizedExistingStatus,
                    now,
                  ),
                  ...current.statusHistory,
                ],
              }
            : {}),
        }
      }

      const existingClient = quote?.clientId
        ? current.clients.find((client) => client.id === quote.clientId)
        : findClientForLead(current.clients, lead)
      const client = existingClient ?? createClientFromLead(lead, now)
      const quoteItems = quote ? current.quoteItems.filter((item) => item.quoteId === quote.id) : []
      const received = current.payments
        .filter((payment) => payment.status === 'Recebida' && (payment.quoteId === quote?.id || payment.leadId === lead.id) && !payment.deletedAt)
        .reduce((total, payment) => total + payment.amount, 0)
      const totalValue = quote?.totalValue ?? lead.estimatedValue
      const projectId = createId('project')
      const project: Project = {
        id: projectId,
        projectCode: `HDP-${new Date().getFullYear()}-${String(current.projects.length + 1).padStart(4, '0')}`,
        name: quote ? getQuoteTitle(quote) : `${lead.serviceInterest} · ${contactDisplayName(lead)}`,
        clientId: client.id,
        leadId: lead.id,
        quoteId: quote?.id,
        manualCreationReason: quote ? undefined : 'Criado após confirmação explícita do serviço no CRM.',
        serviceName: getQuoteServiceName(lead, quoteItems),
        description: quote?.notes || lead.notes,
        captureDate: '',
        captureStartTime: '',
        captureEndTime: '',
        deliveryDeadline: '',
        deliveryDeadlineNegotiated: false,
        deliveryDaysAfterCapture: Math.max(Number(current.companySettings.defaultDeliveryDays) || 7, 1),
        address: quote?.serviceLocation || lead.address,
        city: lead.city,
        contactName: contactDisplayName(lead),
        contactPhone: lead.whatsapp || lead.phone,
        totalValue,
        discountValue: quote?.discount ?? 0,
        travelFee: quote?.travelFee ?? 0,
        depositValue: Math.min(received, totalValue),
        remainingValue: Math.max(totalValue - received, 0),
        projectStatus: 'Confirmado',
        financialStatus: received >= totalValue && totalValue > 0 ? 'Pago' : received > 0 ? 'Parcialmente pago' : 'Não faturado',
        paymentMethod: current.payments.find((payment) => payment.quoteId === quote?.id && payment.status === 'Recebida')?.paymentMethod ?? 'PIX',
        notes: quote?.notes || lead.notes,
        equipmentNeeded: [],
        links: [],
        responsibleUserId: quote?.responsibleUserId ?? lead.responsibleUserId ?? activeUserId,
        createdAt: now,
        updatedAt: now,
      }
      return {
        ...current,
        clients: existingClient ? current.clients : [client, ...current.clients],
        projects: [project, ...current.projects],
        projectChecklistItems: [...createOperationalChecklist(projectId, now), ...current.projectChecklistItems],
        leads: current.leads.map((item) => item.id === lead.id ? { ...item, pipelineStage: 'Serviço confirmado', probability: 100, updatedAt: now } : item),
        quotes: quote ? current.quotes.map((item) => item.id === quote.id ? { ...item, projectId, status: 'Convertida em projeto', updatedAt: now } : item) : current.quotes,
        payments: current.payments.map((payment) => payment.quoteId === quote?.id || payment.leadId === lead.id ? { ...payment, projectId, clientId: client.id, updatedAt: now } : payment),
        files: current.files.map((file) => file.quoteId === quote?.id || file.leadId === lead.id ? { ...file, projectId, clientId: client.id } : file),
        statusHistory: [
          createStatusHistory('Projeto', projectId, 'Projeto criado', `${project.projectCode} criado após confirmação explícita no CRM.`, activeUserId, undefined, project.projectStatus, now),
          createStatusHistory('Contato', lead.id, 'Serviço confirmado', `Projeto ${project.projectCode} vinculado sem duplicar proposta, pagamentos ou comprovantes.`, activeUserId, serviceConfirmation.previousStage, 'Serviço confirmado', now),
          ...current.statusHistory,
        ],
      }
    }, createProject ? 'Serviço confirmado e projeto criado sem duplicidade.' : 'Serviço confirmado. Projeto deixado para depois.')
    setModal(null)
    setServiceConfirmation(null)
    if (createProject) {
      setQuery(navigationLead ? contactDisplayName(navigationLead) : '')
      setPage('projects')
    }
  }

  const moveLead = (leadId: string, pipelineStage: PipelineStage) => {
    const lead = state.leads.find((item) => item.id === leadId)
    if (!lead || lead.pipelineStage === pipelineStage) return
    const quotes = state.quotes.filter((quote) => quote.leadId === leadId && !quote.deletedAt && !quote.archivedAt)
    const applyMove = (lossReason = '', quoteToSend?: Quote) => {
      const now = new Date().toISOString()
      updateState(
        (current) => ({
          ...current,
          leads: current.leads.map((leadItem) =>
            leadItem.id === leadId
              ? {
                  ...leadItem,
                  pipelineStage,
                  lossReason: pipelineStage === 'Perdido' ? lossReason || undefined : leadItem.lossReason,
                  archived: pipelineStage === 'Perdido' ? leadItem.archived : false,
                  updatedAt: now,
                }
              : leadItem,
          ),
          quotes: quoteToSend
            ? current.quotes.map((quote) => quote.id === quoteToSend.id ? { ...quote, status: 'Enviada', sentAt: quote.sentAt ?? now, updatedAt: now } : quote)
            : current.quotes,
          leadInteractions: [
            {
              id: createId('int'),
              leadId,
              interactionType: 'Alteração de status',
              description: `Lead movido para ${pipelineStage}${lossReason ? ` · ${lossReason}` : ''}.`,
              interactionDate: now,
              userId: activeUserId,
              createdAt: now,
            },
            ...current.leadInteractions,
          ],
          statusHistory: quoteToSend
            ? [createStatusHistory('Proposta', quoteToSend.id, 'Proposta enviada', `${quoteToSend.quoteNumber} marcada como enviada ao mover o contato no CRM.`, activeUserId, quoteToSend.status, 'Enviada', now), ...current.statusHistory]
            : current.statusHistory,
        }),
        quoteToSend ? 'Proposta marcada como enviada e contato movido.' : 'Etapa do contato atualizada.',
      )
    }
    if (pipelineStage === 'Proposta enviada' && !quotes.some((quote) => ['Enviada', 'Visualizada', 'Em negociação', 'Aprovada', 'Aguardando entrada', 'Entrada recebida', 'Convertida em projeto'].includes(quote.status))) {
      const quoteToSend = quotes
        .filter((quote) => quote.status === 'Gerada' || (quote.status === 'Rascunho' && quote.totalValue > 0 && state.quoteItems.some((item) => item.quoteId === quote.id)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      if (!quoteToSend) {
        showNotice({
          title: 'Gere a proposta primeiro',
          description: 'O contato só pode ir para “Proposta enviada” depois que uma proposta válida for criada com serviços e valores.',
          tone: 'warning',
        })
        return
      }
      applyMove('', quoteToSend)
      return
    }
    if (pipelineStage === 'Aguardando entrada' && !quotes.some((quote) => ['Aprovada', 'Aguardando entrada', 'Entrada recebida', 'Convertida em projeto'].includes(quote.status))) {
      const quoteToApprove = quotes
        .filter((quote) => ['Rascunho', 'Gerada', 'Enviada', 'Visualizada', 'Em negociação'].includes(quote.status) && quote.totalValue > 0 && state.quoteItems.some((item) => item.quoteId === quote.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      if (!quoteToApprove) {
        showNotice({ title: 'Proposta ainda não aprovada', description: 'Crie uma proposta com serviços e valores antes de mover o contato para “Aguardando entrada”.', tone: 'warning' })
        return
      }
      requestConfirm({
        title: 'Proposta ainda não aprovada',
        description: `${quoteToApprove.quoteNumber} precisa ser aprovada antes de mover o contato para “Aguardando entrada”. Ao aprovar, a entrada e o saldo serão lançados como previstos no financeiro.`,
        confirmLabel: 'Aprovar proposta',
        cancelLabel: 'Agora não',
        tone: 'warning',
        onConfirm: () => approveQuote(quoteToApprove),
      })
      return
    }
    if (pipelineStage === 'Serviço confirmado') {
      beginServiceConfirmation(lead)
      return
    }
    if (pipelineStage === 'Perdido') {
      requestInput({ title: 'Marcar contato como perdido', description: 'Informe o motivo para registrar no histórico comercial.', label: 'Motivo da perda', inputType: 'textarea', required: true, confirmLabel: 'Marcar como perdido', tone: 'danger', onSubmit: applyMove })
      return
    }
    applyMove()
  }

  const deleteLead = (lead: Lead) => {
    requestConfirm({
      title: 'Excluir contato?',
      description: `${contactDisplayName(lead)} será removido das telas principais. Propostas, projetos, pagamentos e histórico continuarão preservados.`,
      confirmLabel: 'Excluir contato',
      tone: 'danger',
      onConfirm: () => {
        const now = new Date().toISOString()
        updateState(
          (current) => ({
            ...current,
            leads: current.leads.map((item) => item.id === lead.id ? { ...item, deletedAt: now, deletedBy: activeUserId, deletionReason: undefined, updatedAt: now } : item),
            statusHistory: [createStatusHistory('Contato', lead.id, 'Contato excluído', 'Contato removido das telas principais sem apagar os relacionamentos.', activeUserId, lead.pipelineStage, lead.pipelineStage, now), ...current.statusHistory],
          }),
          'Contato excluído. O histórico foi preservado.',
        )
        setSelectedLeadId('')
      },
    })
  }

  const closeLeadDeal = (values: CloseDealFormValues) => {
    const lead = state.leads.find((item) => item.id === values.leadId)
    if (!lead) {
      setToast('Contato não encontrado.')
      return
    }

    const now = new Date().toISOString()
    const totalValue = Math.max(values.totalValue, 0)
    const depositValue = Math.min(Math.max(values.depositValue, 0), totalValue)
    const remainingValue = Math.max(totalValue - depositValue, 0)
    const depositPaidDate = values.depositPaidAt || dateInput()

    if (totalValue <= 0) {
      showNotice({ title: 'Valor do serviço não informado', description: 'Informe um valor total maior que zero para concluir o fechamento.', tone: 'warning' })
      return
    }

    if (!values.captureDate || !values.captureStartTime || !values.deliveryDeadline) {
      showNotice({ title: 'Dados de agendamento incompletos', description: 'Informe a data, o horário da captação e o prazo de entrega.', tone: 'warning' })
      return
    }

    updateState(
      (current) => {
        const leadWhatsapp = lead.whatsapp.replace(/\D/g, '')
        const existingClient = current.clients.find(
          (client) =>
            (leadWhatsapp.length > 0 && client.whatsapp.replace(/\D/g, '') === leadWhatsapp) ||
            (lead.email.length > 0 && client.email.toLowerCase() === lead.email.toLowerCase()),
        )
        const client: Client =
          existingClient ??
          ({
            id: createId('client'),
            fullName: contactDisplayName(lead),
            companyName: lead.companyName,
            document: '',
            phone: lead.phone,
            whatsapp: lead.whatsapp,
            email: lead.email,
            instagram: lead.instagram,
            address: lead.address,
            city: lead.city,
            source: lead.source,
            notes: lead.notes,
            tags: lead.tags,
            archived: false,
            createdAt: now,
            updatedAt: now,
          } satisfies Client)

        const hasDeposit = depositValue > 0
        const depositIsPaid = values.depositPaid && hasDeposit
        const projectStatus: Project['projectStatus'] = 'Confirmado'
        const financialStatus: Project['financialStatus'] = depositIsPaid
          ? remainingValue > 0
            ? 'Parcialmente pago'
            : 'Pago'
          : hasDeposit
            ? 'Aguardando sinal'
            : 'Não faturado'

        const automaticDeliveryDeadline = addCalendarDays(
          values.captureDate,
          Math.max(Number(current.companySettings.defaultDeliveryDays) || 7, 1),
        )
        const project: Project = {
          id: createId('project'),
          projectCode: `HD-${new Date().getFullYear()}-${String(current.projects.length + 1).padStart(3, '0')}`,
          name: values.projectName,
          clientId: client.id,
          leadId: lead.id,
          serviceId: current.services.find((service) => service.name === values.serviceName)?.id,
          serviceName: values.serviceName,
          description: values.notes || lead.notes,
          captureDate: values.captureDate,
          captureStartTime: values.captureStartTime,
          captureEndTime: values.captureEndTime || values.captureStartTime,
          deliveryDeadline: values.deliveryDeadline || automaticDeliveryDeadline,
          originalDeliveryDeadline: automaticDeliveryDeadline,
          deliveryDeadlineNegotiated: Boolean(values.deliveryDeadline && values.deliveryDeadline !== automaticDeliveryDeadline),
          deliveryDaysAfterCapture: Math.max(calendarDaysBetween(values.captureDate, values.deliveryDeadline || automaticDeliveryDeadline), 0),
          address: values.address,
          city: values.city,
          contactName: values.contactName,
          contactPhone: values.contactPhone,
          totalValue,
          discountValue: 0,
          travelFee: 0,
          depositValue,
          remainingValue,
          projectStatus,
          financialStatus,
          paymentMethod: values.paymentMethod,
          notes: values.notes,
          equipmentNeeded: ['Drone DJI Mini 2'],
          links: [],
          responsibleUserId: activeUserId,
          createdAt: now,
          updatedAt: now,
        }

        const payments: Payment[] = []
        if (hasDeposit) {
          payments.push({
            id: createId('pay'),
            projectId: project.id,
            clientId: client.id,
            paymentType: 'Sinal',
            amount: depositValue,
            dueDate: depositIsPaid ? depositPaidDate : dateInput(),
            paidAt: depositIsPaid ? new Date(`${depositPaidDate}T12:00:00`).toISOString() : undefined,
            paymentMethod: values.paymentMethod,
            status: depositIsPaid ? 'Recebida' : 'Pendente',
            notes: depositIsPaid ? 'Entrada recebida no fechamento do serviço.' : 'Entrada pendente para confirmar o serviço.',
            createdAt: now,
            updatedAt: now,
          })
        }

        if (remainingValue > 0) {
          payments.push({
            id: createId('pay'),
            projectId: project.id,
            clientId: client.id,
            paymentType: 'Pagamento final',
            amount: remainingValue,
            dueDate: values.deliveryDeadline,
            paymentMethod: values.paymentMethod,
            status: 'Pendente',
            notes: 'Restante combinado para entrega/finalização.',
            createdAt: now,
            updatedAt: now,
          })
        }

        const appointment: Appointment = {
          id: createId('appt'),
          title: `Captação ${project.name}`,
          appointmentType: 'Captação',
          clientId: client.id,
          leadId: lead.id,
          projectId: project.id,
          startAt: new Date(`${values.captureDate}T${values.captureStartTime}`).toISOString(),
          endAt: new Date(`${values.captureDate}T${values.captureEndTime || values.captureStartTime}`).toISOString(),
          address: values.address,
          notes: values.notes,
          status: 'Agendado',
          color: '#d4af37',
          createdAt: now,
          updatedAt: now,
        }
        const deliveryAppointment = createProjectDeliveryAppointment(project, now)

        const nextStage: PipelineStage = 'Serviço agendado'

        return {
          ...current,
          clients: existingClient ? current.clients : [client, ...current.clients],
          projects: [project, ...current.projects],
          projectChecklistItems: [...createDefaultChecklist(project.id, now), ...current.projectChecklistItems],
          appointments: [appointment, deliveryAppointment, ...current.appointments],
          payments: [...payments, ...current.payments],
          quotes: values.quoteId
            ? current.quotes.map((quote) =>
                quote.id === values.quoteId
                  ? { ...quote, status: 'Aprovado', updatedAt: now }
                  : quote,
              )
            : current.quotes,
          leads: current.leads.map((item) =>
            item.id === lead.id
              ? {
                  ...item,
                  pipelineStage: nextStage,
                  estimatedValue: totalValue,
                  probability: 100,
                  lastContactAt: now,
                  updatedAt: now,
                }
              : item,
          ),
          leadInteractions: [
            {
              id: createId('int'),
              leadId: lead.id,
              interactionType: 'Serviço agendado',
              description: `${project.projectCode} criado com total de ${formatCurrency(totalValue)}, entrada de ${formatCurrency(depositValue)} e restante de ${formatCurrency(remainingValue)}.`,
              interactionDate: now,
              userId: activeUserId,
              createdAt: now,
            },
            ...current.leadInteractions,
          ],
        }
      },
      values.depositPaid ? 'Serviço fechado, agenda e pagamentos criados.' : 'Serviço agendado com entrada pendente no financeiro.',
    )
    setModal(null)
    setSelectedCloseDealLeadId('')
    setSelectedCloseDealQuoteId('')
  }

  const toggleChecklistCategory = (projectId: string, category: ProjectChecklistItem['category'], completed: boolean) => {
    const now = new Date().toISOString()
    updateState(
      (current) => ({
        ...current,
        projectChecklistItems: current.projectChecklistItems.map((checklistItem) =>
          checklistItem.projectId === projectId && checklistItem.category === category
            ? {
                ...checklistItem,
                completed,
                completedAt: completed ? checklistItem.completedAt ?? now : undefined,
              }
            : checklistItem,
        ),
      }),
      completed ? `Etapa ${category} concluída.` : `Etapa ${category} reaberta.`,
    )
  }

  const advanceProjectStage = (project: Project, providedFinalDeliveryLink = '') => {
    const nextStatus = getNextProjectStatus(project)
    if (!nextStatus) {
      setToast('Projeto já está na última etapa.')
      return
    }

    const paidAmount = getProjectPaidAmount(state, project.id)
    const pendingBalance = Math.max(project.totalValue - paidAmount, 0)
    if ((nextStatus === 'Pago' || nextStatus === 'Concluído') && pendingBalance > 0) {
      setToast(`Ainda existe saldo pendente de ${formatCurrency(pendingBalance)}.`)
      return
    }
    if (project.projectStatus === 'Confirmado' && project.captureDate && project.captureDate > dateInput()) {
      setToast('A captação não pode ser registrada como realizada em uma data futura.')
      return
    }
    if (nextStatus === 'Concluído' && state.projectAdjustments.some((adjustment) => adjustment.projectId === project.id && !['Concluído', 'Cancelado'].includes(adjustment.status))) {
      setToast('Conclua ou cancele os ajustes pendentes antes de finalizar o projeto.')
      return
    }
    if (nextStatus === 'Aguardando pagamento final' && state.projectAdjustments.some((adjustment) => adjustment.projectId === project.id && !['Concluído', 'Cancelado'].includes(adjustment.status))) {
      setToast('Conclua os ajustes solicitados antes de aprovar o material.')
      return
    }
    const finalDeliveryLink = providedFinalDeliveryLink || project.links[0] || ''
    if (nextStatus === 'Entregue' && !finalDeliveryLink) {
      requestInput({ title: 'Registrar entrega final', description: `Informe o link dos arquivos finais de ${project.projectCode}.`, label: 'Link dos arquivos finais', inputType: 'url', required: true, placeholder: 'https://…', confirmLabel: 'Registrar entrega', onSubmit: (link) => advanceProjectStage(project, link) })
      return
    }

    const now = new Date().toISOString()
    updateState(
      (current) => {
        const captureCompleted = project.projectStatus === 'Confirmado' && nextStatus === 'Em edição'
        const captureDate = project.captureDate || dateInput()
        const automaticDeliveryDeadline = addCalendarDays(
          captureDate,
          Math.max(Number(current.companySettings.defaultDeliveryDays) || 7, 1),
        )
        const deliveryDaysAfterCapture = project.deliveryDeadlineNegotiated
          ? Math.max(project.deliveryDaysAfterCapture ?? calendarDaysBetween(project.captureDate, project.deliveryDeadline), 0)
          : Math.max(Number(current.companySettings.defaultDeliveryDays) || 7, 1)
        const deliveryDeadline = captureCompleted
          ? addCalendarDays(captureDate, deliveryDaysAfterCapture)
          : project.deliveryDeadline
        const updatedProject: Project = {
          ...project,
          projectStatus: nextStatus,
          actualCaptureAt: captureCompleted ? now : project.actualCaptureAt,
          editingStartedAt: captureCompleted ? now : project.editingStartedAt,
          originalDeliveryDeadline: captureCompleted ? automaticDeliveryDeadline : project.originalDeliveryDeadline,
          deliveryDaysAfterCapture,
          deliveryDeadline,
          reviewSentAt: nextStatus === 'Aguardando aprovação do cliente' ? now : project.reviewSentAt,
          deliveredAt: nextStatus === 'Entregue' || nextStatus === 'Concluído' ? project.deliveredAt ?? now : project.deliveredAt,
          finalDeliveryAt: nextStatus === 'Entregue' ? now : project.finalDeliveryAt,
          completedAt: nextStatus === 'Concluído' ? now : project.completedAt,
          links: nextStatus === 'Entregue' && finalDeliveryLink ? [finalDeliveryLink, ...project.links.filter((link) => link !== finalDeliveryLink)] : project.links,
          updatedAt: now,
        }
        const deliveryAppointment = current.appointments.find((appointment) => appointment.projectId === project.id && appointment.appointmentType === 'Prazo de entrega')
        let appointments = captureCompleted
          ? deliveryAppointment
            ? current.appointments.map((appointment) => appointment.id === deliveryAppointment.id ? createProjectDeliveryAppointment(updatedProject, now, appointment.id) : appointment)
            : [createProjectDeliveryAppointment(updatedProject, now), ...current.appointments]
          : current.appointments
        if (nextStatus === 'Confirmado') {
          appointments = appointments.map((appointment) => appointment.projectId === project.id && appointment.appointmentType === 'Captação' ? { ...appointment, confirmationStatus: 'Confirmado', updatedAt: now } : appointment)
        }
        const autoChecklistTitles = nextStatus === 'Confirmado'
          ? ['Data agendada', 'Evento criado no calendário', 'Local confirmado', 'Cliente confirmado']
          : captureCompleted
          ? ['Captação realizada', 'Fotos captadas', 'Vídeos captados', 'Arquivos brutos salvos']
          : nextStatus === 'Aguardando aprovação do cliente'
            ? ['Revisão interna', 'Arquivos exportados', 'Material enviado para aprovação']
            : nextStatus === 'Pago'
              ? ['Pagamento final solicitado', 'Pagamento final recebido']
              : nextStatus === 'Entregue'
                ? ['Link de entrega criado', 'Entrega final realizada']
                : nextStatus === 'Concluído'
                  ? ['Projeto concluído']
                  : []
        const autoChecklistCategories: ProjectChecklistItem['category'][] = captureCompleted
          ? ['Pré-produção', 'Captação']
          : nextStatus === 'Aguardando aprovação do cliente'
            ? ['Pós-produção']
            : nextStatus === 'Entregue' || nextStatus === 'Concluído'
              ? ['Financeiro e entrega']
              : []
        return {
        ...current,
        projects: current.projects.map((item) => item.id === project.id ? updatedProject : item),
        payments: captureCompleted ? current.payments.map((payment) => payment.projectId === project.id && payment.paymentType === 'Pagamento final' && payment.status !== 'Recebida' ? { ...payment, dueDate: deliveryDeadline, updatedAt: now } : payment) : current.payments,
        appointments,
        projectChecklistItems: current.projectChecklistItems.map((item) => item.projectId === project.id && (autoChecklistTitles.includes(item.title) || autoChecklistCategories.includes(item.category)) ? { ...item, completed: true, completedAt: item.completedAt ?? now } : item),
        leads: project.leadId && (nextStatus === 'Entregue' || nextStatus === 'Concluído')
          ? current.leads.map((lead) =>
              lead.id === project.leadId
                ? {
                    ...lead,
                    pipelineStage: 'Retorno futuro',
                    nextContactAt: lead.nextContactAt ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
                    updatedAt: now,
                  }
                : lead,
            )
          : current.leads,
        leadInteractions: project.leadId && (nextStatus === 'Entregue' || nextStatus === 'Concluído')
          ? [
              {
                id: createId('int'),
                leadId: project.leadId,
                interactionType: 'Retorno futuro',
                description: `Projeto ${project.projectCode} entregue. Cliente movido para pós-venda.`,
                interactionDate: now,
                userId: activeUserId,
                createdAt: now,
              },
              ...current.leadInteractions,
            ]
          : current.leadInteractions,
        statusHistory: [
          ...(captureCompleted ? [createStatusHistory('Projeto', project.id, 'Captação realizada', `Captação registrada e edição iniciada. Prazo calculado para ${formatDate(deliveryDeadline)}.`, activeUserId, 'Confirmado', 'Captação realizada', now)] : []),
          createStatusHistory('Projeto', project.id, 'Status alterado', `${project.projectCode}: ${project.projectStatus} → ${nextStatus}.`, activeUserId, project.projectStatus, nextStatus, now),
          ...current.statusHistory,
        ],
      }
      },
      `Projeto movido para ${nextStatus}.`,
    )
  }

  const releaseExceptionalDelivery = (project: Project) => {
    requestInput({
      title: 'Liberar entrega com saldo pendente',
      description: 'Esta ação é excepcional e ficará registrada na timeline.',
      label: 'Justificativa',
      inputType: 'textarea',
      required: true,
      confirmLabel: 'Continuar',
      tone: 'warning',
      onSubmit: (reason) => {
        if (reason.length < 5) {
          showNotice({ title: 'Justificativa muito curta', description: 'Informe pelo menos 5 caracteres para registrar a liberação excepcional.', tone: 'warning' })
          return
        }
        requestInput({
          title: 'Link da entrega final',
          description: 'Informe onde o cliente poderá acessar os arquivos.',
          label: 'Link dos arquivos finais',
          inputType: 'url',
          required: true,
          placeholder: 'https://…',
          confirmLabel: 'Liberar entrega',
          tone: 'warning',
          onSubmit: (link) => {
            const now = new Date().toISOString()
            updateState((current) => ({
              ...current,
              projects: current.projects.map((item) => item.id === project.id ? { ...item, projectStatus: 'Entregue', exceptionalDeliveryReason: reason, links: [link, ...item.links.filter((value) => value !== link)], deliveredAt: now, finalDeliveryAt: now, updatedAt: now } : item),
              statusHistory: [createStatusHistory('Projeto', project.id, 'Entrega excepcional liberada', `${reason} Saldo pendente: ${formatCurrency(Math.max(project.totalValue - getProjectPaidAmount(current, project.id), 0))}.`, activeUserId, project.projectStatus, 'Entregue', now), ...current.statusHistory],
            }), 'Entrega excepcional registrada com alerta de saldo pendente.')
          },
        })
      },
    })
  }

  const addProjectAdjustment = (project: Project) => {
    requestInput({
      title: 'Registrar ajustes',
      description: `Descreva os ajustes solicitados para ${project.projectCode}.`,
      label: 'Ajustes solicitados',
      inputType: 'textarea',
      required: true,
      confirmLabel: 'Registrar ajustes',
      onSubmit: (description) => {
        const now = new Date().toISOString()
        updateState((current) => {
          const version = current.projectAdjustments.filter((item) => item.projectId === project.id).reduce((max, item) => Math.max(max, item.version), 0) + 1
          return {
            ...current,
            projectAdjustments: [{ id: createId('adjust'), projectId: project.id, version, description, status: 'Solicitado', requestedAt: now, createdAt: now, updatedAt: now }, ...current.projectAdjustments],
            statusHistory: [createStatusHistory('Projeto', project.id, 'Ajustes solicitados', `Versão ${version}: ${description}`, activeUserId, project.projectStatus, project.projectStatus, now), ...current.statusHistory],
          }
        }, 'Ajustes registrados sem substituir versões anteriores.')
      },
    })
  }

  const completeProjectAdjustment = (adjustmentId: string) => {
    const now = new Date().toISOString()
    updateState((current) => {
      const adjustment = current.projectAdjustments.find((item) => item.id === adjustmentId)
      if (!adjustment) return current
      return {
        ...current,
        projectAdjustments: current.projectAdjustments.map((item) => item.id === adjustmentId ? { ...item, status: 'Concluído', completedAt: now, updatedAt: now } : item),
        statusHistory: [createStatusHistory('Projeto', adjustment.projectId, 'Ajuste concluído', `Versão ${adjustment.version}: ${adjustment.description}`, activeUserId, adjustment.status, 'Concluído', now), ...current.statusHistory],
      }
    }, 'Ajuste concluído.')
  }

  const copyQuoteText = async (quote: Quote) => {
    const items = state.quoteItems.filter((item) => item.quoteId === quote.id)
    const recipient = getQuoteRecipient(state, quote)
    const remaining = Math.max(quote.totalValue - quote.depositValue, 0)
    const text = [
      `${getQuoteDisplayTitle(quote, recipient.company)} (${quote.quoteNumber})`,
      `${state.companySettings.companyName} - ${state.companySettings.instagram}`,
      `CNPJ: ${state.companySettings.document || '52.075.318/0001-35'}`,
      '',
      `Cliente: ${recipient.company}`,
      recipient.name ? `Contato: ${recipient.name}` : '',
      recipient.whatsapp || recipient.phone ? `WhatsApp: ${recipient.whatsapp || recipient.phone}` : '',
      recipient.email ? `E-mail: ${recipient.email}` : '',
      recipient.address || recipient.city ? `Local: ${[recipient.address, recipient.city].filter(Boolean).join(' - ')}` : '',
      '',
      quote.notes ? `Escopo:\n${quote.notes}` : '',
      '',
      'Itens inclusos:',
      ...items.map((item) => `${item.quantity}x ${item.description}: ${formatCurrency(item.totalPrice)}`),
      '',
      `Total: ${formatCurrency(quote.totalValue)}`,
      `Sinal: ${formatCurrency(quote.depositValue)}`,
      `Restante: ${formatCurrency(remaining)}`,
      `Validade: ${formatDate(quote.expirationDate)}`,
      'Esta proposta é válida por 7 dias corridos a partir da data de emissão. Após esse prazo, os valores e a disponibilidade poderão ser revisados.',
      'Prazo de entrega: até 7 dias corridos após a realização da captação.',
      '',
      'Condições:',
      quote.paymentTerms,
      '',
      `PIX para pagamento do sinal (CNPJ): ${state.companySettings.pixKey || state.companySettings.document || '52.075.318/0001-35'}`,
      `Base: ${state.companySettings.baseCity}`,
    ]
      .filter((line) => line !== '')
      .join('\n')
    await navigator.clipboard.writeText(text)
    setToast('Texto da proposta copiado.')
  }

  const downloadQuotePdf = async (quote: Quote) => {
    const { jsPDF } = await import('jspdf')
    let logoDataUrl = ''
    try {
      logoDataUrl = await loadImageDataUrl(heroLogoSrc)
    } catch {
      logoDataUrl = ''
    }
    const items = state.quoteItems.filter((item) => item.quoteId === quote.id)
    const recipient = getQuoteRecipient(state, quote)
    const settings = state.companySettings
    const remaining = Math.max(quote.totalValue - quote.depositValue, 0)
    const additionalTotal = quote.travelFee + quote.urgencyFee
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - margin * 2
    const pageBottom = pageHeight - 14
    let y = 40

    const fitLines = (text: string, width: number, fontSize: number, maxLines: number) => {
      doc.setFontSize(fontSize)
      const lines = doc.splitTextToSize(text || '-', width) as string[]
      if (lines.length <= maxLines) return lines
      const visible = lines.slice(0, maxLines)
      visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[. ]+$/, '')}...`
      return visible
    }

    const sectionTitle = (text: string) => {
      doc.setFillColor(216, 165, 0)
      doc.roundedRect(margin, y - 2.8, 2, 5.5, 0.8, 0.8, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(17, 24, 39)
      doc.text(text, margin + 5, y + 0.5)
      y += 6
    }

    const prepareCardLines = (entries: string[], width: number) => entries
      .filter(Boolean)
      .flatMap((entry) => fitLines(entry, width - 8, 7.8, 2))
      .slice(0, 7)

    const drawInfoCard = (title: string, lines: string[], x: number, top: number, width: number, height: number) => {
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(229, 231, 235)
      doc.setLineWidth(0.25)
      doc.roundedRect(x, top, width, height, 2, 2, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(17, 24, 39)
      doc.text(title, x + 4, top + 6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.8)
      doc.setTextColor(75, 85, 99)
      lines.forEach((line, index) => doc.text(line, x + 4, top + 11 + index * 3.7))
    }

    doc.setFillColor(17, 17, 17)
    doc.rect(0, 0, pageWidth, 31, 'F')
    doc.setFillColor(216, 165, 0)
    doc.rect(0, 31, pageWidth, 2, 'F')
    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', margin, 4.5, 21, 21)
    const brandX = logoDataUrl ? margin + 27 : margin
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(settings.companyName || 'Hero Drone', brandX, 13)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text('Fotografia e filmagem aérea', brandX, 19)
    doc.setFont('helvetica', 'bold')
    doc.text(`Proposta ${quote.quoteNumber}`, pageWidth - margin, 12, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(`Emitida em ${formatDate(quote.issueDate)}`, pageWidth - margin, 18, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(17, 24, 39)
    doc.text('Proposta comercial', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(75, 85, 99)
    const proposalTitleLines = fitLines(getQuoteDisplayTitle(quote, recipient.company), contentWidth, 9, 2)
    doc.text(proposalTitleLines, margin, y, { lineHeightFactor: 1.25 })
    y += proposalTitleLines.length * 4 + 4

    const cardGap = 4
    const cardWidth = (contentWidth - cardGap) / 2
    const companyLines = prepareCardLines([
      settings.document ? `CNPJ: ${settings.document}` : '',
      settings.phone ? `WhatsApp: ${settings.phone}` : '',
      settings.email ? `E-mail: ${settings.email}` : '',
      settings.instagram ? `Instagram: ${settings.instagram}` : '',
      settings.address || settings.baseCity ? `Base: ${[settings.address, settings.baseCity].filter(Boolean).join(' - ')}` : '',
    ], cardWidth)
    const clientLines = prepareCardLines([
      `Cliente: ${recipient.company}`,
      recipient.name ? `Contato: ${recipient.name}` : '',
      recipient.whatsapp || recipient.phone ? `WhatsApp: ${recipient.whatsapp || recipient.phone}` : '',
      recipient.email ? `E-mail: ${recipient.email}` : '',
      recipient.instagram ? `Instagram: ${recipient.instagram}` : '',
      recipient.address || recipient.city ? `Local: ${[recipient.address, recipient.city].filter(Boolean).join(' - ')}` : '',
    ], cardWidth)
    const infoCardHeight = 14 + Math.max(companyLines.length, clientLines.length) * 3.7
    drawInfoCard('Hero Drone', companyLines, margin, y, cardWidth, infoCardHeight)
    drawInfoCard('Cliente', clientLines, margin + cardWidth + cardGap, y, cardWidth, infoCardHeight)
    y += infoCardHeight + 5

    if (quote.notes) {
      sectionTitle('Escopo')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(55, 65, 81)
      const scopeLines = fitLines(quote.notes, contentWidth - 4, 8, 4)
      doc.text(scopeLines, margin + 2, y, { lineHeightFactor: 1.25 })
      y += scopeLines.length * 3.8 + 3
    }

    sectionTitle('Itens inclusos')
    const descriptionWidth = 96
    const quantityWidth = 16
    const unitWidth = 32
    const headerHeight = 7
    doc.setFillColor(31, 41, 55)
    doc.roundedRect(margin, y, contentWidth, headerHeight, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    doc.text('Serviço', margin + 2, y + 4.6)
    doc.text('Qtd.', margin + descriptionWidth + quantityWidth / 2, y + 4.6, { align: 'center' })
    doc.text('Unitário', margin + descriptionWidth + quantityWidth + unitWidth - 2, y + 4.6, { align: 'right' })
    doc.text('Total', pageWidth - margin - 2, y + 4.6, { align: 'right' })
    y += headerHeight

    const reservedAfterItems = 72
    const itemsBottom = pageBottom - reservedAfterItems
    let hiddenItems = 0
    items.forEach((item, index) => {
      if (hiddenItems > 0) {
        hiddenItems += 1
        return
      }
      const descriptionLines = fitLines(`${index + 1}. ${item.description}`, descriptionWidth - 4, 7.5, 2)
      const rowHeight = Math.max(6.5, descriptionLines.length * 3.3 + 2)
      if (y + rowHeight > itemsBottom) {
        hiddenItems = 1
        return
      }
      doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252)
      doc.setDrawColor(229, 231, 235)
      doc.rect(margin, y, contentWidth, rowHeight, 'FD')
      doc.line(margin + descriptionWidth, y, margin + descriptionWidth, y + rowHeight)
      doc.line(margin + descriptionWidth + quantityWidth, y, margin + descriptionWidth + quantityWidth, y + rowHeight)
      doc.line(margin + descriptionWidth + quantityWidth + unitWidth, y, margin + descriptionWidth + quantityWidth + unitWidth, y + rowHeight)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(31, 41, 55)
      doc.text(descriptionLines, margin + 2, y + 4, { lineHeightFactor: 1.15 })
      doc.text(String(item.quantity), margin + descriptionWidth + quantityWidth / 2, y + 4, { align: 'center' })
      doc.text(formatCurrency(item.unitPrice), margin + descriptionWidth + quantityWidth + unitWidth - 2, y + 4, { align: 'right' })
      doc.text(formatCurrency(item.totalPrice), pageWidth - margin - 2, y + 4, { align: 'right' })
      y += rowHeight
    })
    if (hiddenItems > 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(75, 85, 99)
      doc.text(`Mais ${hiddenItems} item(ns) registrado(s) no detalhamento da proposta.`, margin + 2, y + 4)
      y += 6
    }

    y += 4
    const summaryHeight = 25
    doc.setFillColor(255, 251, 235)
    doc.setDrawColor(216, 165, 0)
    doc.setLineWidth(0.4)
    doc.roundedRect(margin, y, contentWidth, summaryHeight, 2.5, 2.5, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(75, 85, 99)
    const adjustmentParts = [`Subtotal ${formatCurrency(quote.subtotal)}`]
    if (quote.discount > 0) adjustmentParts.push(`Desconto -${formatCurrency(quote.discount)}`)
    if (additionalTotal > 0) adjustmentParts.push(`Adicionais ${formatCurrency(additionalTotal)}`)
    doc.text(adjustmentParts.join('  |  '), margin + 4, y + 6)
    const summaryColumns = [
      ['Total', formatCurrency(quote.totalValue)],
      ['Sinal', formatCurrency(quote.depositValue)],
      ['Restante', formatCurrency(remaining)],
    ]
    summaryColumns.forEach(([label, value], index) => {
      const x = margin + 4 + index * (contentWidth / 3)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(index === 0 ? 11 : 9.5)
      doc.setTextColor(17, 24, 39)
      doc.text(value, x, y + 16)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(107, 114, 128)
      doc.text(label, x, y + 21)
    })
    y += summaryHeight + 5

    sectionTitle('Condições comerciais')
    const conditionsHeight = 35
    const conditionsHalf = contentWidth / 2
    const pixKey = settings.pixKey || settings.document || '52.075.318/0001-35'
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(margin, y, contentWidth, conditionsHeight, 2, 2, 'FD')

    doc.setDrawColor(218, 223, 230)
    doc.line(margin + conditionsHalf, y + 3, margin + conditionsHalf, y + 12)
    doc.line(margin + 4, y + 14, pageWidth - margin - 4, y + 14)
    doc.line(margin + conditionsHalf, y + 17, margin + conditionsHalf, y + 27)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(107, 114, 128)
    doc.text('VALIDADE DA PROPOSTA', margin + 4, y + 5)
    doc.text('PRAZO DE ENTREGA', margin + conditionsHalf + 4, y + 5)
    doc.text('CONDIÇÃO DE PAGAMENTO', margin + 4, y + 19)
    doc.text('PIX DO SINAL (CNPJ)', margin + conditionsHalf + 4, y + 19)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(31, 41, 55)
    doc.text(formatDate(quote.expirationDate), margin + 4, y + 10)
    doc.text('Até 7 dias após a captação', margin + conditionsHalf + 4, y + 10)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.setTextColor(31, 41, 55)
    const paymentLines = fitLines(quote.paymentTerms, conditionsHalf - 9, 8.2, 2)
    doc.text(paymentLines, margin + 4, y + 24, { lineHeightFactor: 1.2 })
    doc.setFont('helvetica', 'bold')
    doc.text(pixKey, margin + conditionsHalf + 4, y + 24)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(107, 114, 128)
    doc.text('Após a validade, valores e disponibilidade poderão ser revisados.', margin + 4, y + 32)

    doc.setFontSize(7)
    doc.setTextColor(107, 114, 128)
    doc.text(`Documento gerado pelo ${appName}.`, margin, pageHeight - 6)
    doc.text('Página 1 de 1', pageWidth - margin, pageHeight - 6, { align: 'right' })
    doc.save(getQuotePdfFilename(quote, recipient.company))
    if (quote.status === 'Rascunho') {
      const now = new Date().toISOString()
      updateState((current) => ({
        ...current,
        quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, status: 'Gerada', updatedAt: now } : item),
        statusHistory: [createStatusHistory('Proposta', quote.id, 'Documento gerado', `PDF de ${quote.quoteNumber} gerado.`, activeUserId, 'Rascunho', 'Gerada', now), ...current.statusHistory],
      }), 'PDF gerado. Proposta atualizada para Gerada.')
      return
    }
    setToast('PDF da proposta baixado.')
  }

  const restoreDemo = () => {
    requestConfirm({
      title: 'Limpar banco local?',
      description: 'Todos os cadastros salvos neste navegador serão apagados e o sistema voltará para o banco vazio.',
      confirmLabel: 'Limpar banco',
      tone: 'danger',
      onConfirm: () => {
        setState(resetAppState())
        setToast('Banco local limpo.')
      },
    })
  }

  if (isFirebaseConfigured && !firebaseAuthReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1012] text-sm font-bold text-white">
        Carregando FlyFlow...
      </div>
    )
  }

  if (!authSession || !currentUser) {
    return <LoginScreen onSubmit={handleLogin} onPasswordReset={handlePasswordReset} />
  }

  const currentNavigation = navigation.find((item) => item.page === page)
  const CurrentPageIcon = currentNavigation?.icon ?? LayoutDashboard


  return (
    <div className="page-shell app-shell bg-[#f4f5f7]">
      {toast ? <Toast message={toast} /> : null}
      {confirmDialog ? (
        <ConfirmDialog
          dialog={confirmDialog}
          onCancel={cancelConfirm}
          onConfirm={runConfirmAction}
        />
      ) : null}
      {noticeDialog ? <NoticeDialog dialog={noticeDialog} onClose={() => setNoticeDialog(null)} /> : null}
      {inputDialog ? <InputDialog key={`${inputDialog.title}-${inputDialog.label}`} dialog={inputDialog} onCancel={() => setInputDialog(null)} onSubmit={(value) => { const action = inputDialog.onSubmit; setInputDialog(null); action(value) }} /> : null}
      <aside className="app-sidebar hidden border-r border-gray-200 bg-[#171717] text-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="app-brand border-b border-white/10 px-4 py-5">
            <div className="flex items-center gap-3">
              <img className="h-11 w-11 shrink-0 object-contain" src={heroLogoSrc} alt="FlyFlow by Hero Drone" />
              <div>
                <h1 className="text-base font-black tracking-tight">{appShortName}</h1>
                <p className="text-xs font-bold text-[#d4af37]">{appSubtitle}</p>
                <p className="text-xs text-white/55">CRM, projetos e gestão financeira</p>
              </div>
            </div>
          </div>
          <nav className="no-scrollbar flex-1 space-y-1 overflow-auto px-3 py-4">
            {availableNavigation.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.page}
                  className={`app-nav-item focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${
                    page === item.page ? 'is-active bg-white text-gray-950' : 'text-white/65 hover:bg-white/10 hover:text-white'
                  }`}
                  type="button"
                  onClick={() => setPage(item.page)}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              )
            })}
          </nav>
          <div className="app-sidebar-footer space-y-3 border-t border-white/10 p-4 text-xs text-white/55">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-bold text-white">{currentUser.name}</p>
              <p className="mt-1 truncate">{currentUser.email}</p>
              <p className="mt-1">{permissionSummary(currentUser)}</p>
            </div>
            <p>{isFirebaseConfigured ? 'Firebase sincronizado' : isSupabaseConfigured ? 'Supabase configurado' : 'Banco local vazio no navegador'}</p>
            <Button className="w-full border border-white/10 bg-white/5 text-white hover:bg-white/10" type="button" onClick={restoreDemo}>
              Limpar banco
            </Button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen ? <div className="mobile-drawer-layer fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu principal"><button className="absolute inset-0 bg-black/55" type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} /><aside className="mobile-drawer absolute bottom-0 left-0 top-0 flex w-[min(88vw,22rem)] flex-col bg-[#101216] text-white shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 px-4 py-4"><div className="flex min-w-0 items-center gap-3"><img className="h-10 w-10 shrink-0 object-contain" src={heroLogoSrc} alt="" /><div className="min-w-0"><strong className="block truncate">{appShortName}</strong><span className="block truncate text-xs text-[#d4af37]">{appSubtitle}</span></div></div><button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 text-white" type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)}><X size={21} /></button></div><nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-3">{availableNavigation.map((item) => { const Icon = item.icon; return <button key={item.page} className={`app-nav-item flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold ${page === item.page ? 'is-active bg-white/10 text-white' : 'text-white/70'}`} type="button" onClick={() => { setPage(item.page); setMobileMenuOpen(false); setQuery('') }}><Icon size={19} />{item.label}</button> })}</nav><div className="mobile-drawer-footer space-y-3 border-t border-white/10 p-4"><div className="grid grid-cols-2 gap-2"><label className="text-xs text-white/60">Período<select className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-sm text-white" value={period} onChange={(event) => setPeriod(event.target.value as PeriodPreset)}>{periodOptions.map((option) => <option className="text-black" key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-xs text-white/60">Regime<select className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-sm text-white" value={regime} onChange={(event) => setRegime(event.target.value as AccountingRegime)}><option className="text-black" value="cash">Caixa</option><option className="text-black" value="accrual">Competência</option></select></label></div><div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs"><strong className="block text-white">{currentUser.name}</strong><span className="mt-1 block truncate text-white/60">{currentUser.email}</span></div><Button className="w-full border border-white/15 bg-white/10 text-white" type="button" onClick={handleLogout}><LogOut size={16} /> Sair</Button></div></aside></div> : null}

      <main className="min-w-0">
        <header className="app-header sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="app-header-inner flex flex-wrap items-center gap-2 px-3 py-2.5 lg:flex-nowrap lg:px-5">
            <div className="app-current-page order-1 flex min-w-0 items-center gap-2.5 lg:w-36 lg:shrink-0">
              <button className="app-header-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 lg:hidden" type="button" aria-label="Abrir menu principal" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><Menu size={21} /></button>
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex">
                <CurrentPageIcon size={17} />
              </span>
              <h2 className="truncate text-sm font-black text-gray-950 sm:text-base">{currentNavigation?.label}</h2>
            </div>
            <div className="app-global-search relative order-3 w-full min-w-0 flex-1 lg:order-2 lg:w-auto lg:max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                aria-label="Busca global"
                className="field-input field-input-with-leading-icon min-h-9 py-1.5 text-sm"
                placeholder="Buscar contato, projeto ou telefone..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <GlobalSearchResults query={query} state={state} onNavigate={setPage} />
            </div>
            <div className="app-header-controls order-2 ml-auto flex shrink-0 items-center gap-2 lg:order-3">
              <div className="hidden w-28 shrink-0 sm:block">
                <select className="field-input min-h-9 py-1.5 text-sm" aria-label="Período" value={period} onChange={(event) => setPeriod(event.target.value as PeriodPreset)}>
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hidden w-28 shrink-0 md:block">
                <select className="field-input min-h-9 py-1.5 text-sm" aria-label="Regime financeiro" value={regime} onChange={(event) => setRegime(event.target.value as AccountingRegime)}>
                  <option value="cash">Caixa</option>
                  <option value="accrual">Competência</option>
                </select>
              </div>
              <button
                className="app-header-icon focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700"
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                className="app-header-icon focus-ring relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700"
                type="button"
                onClick={() => setPage('dashboard')}
                aria-label="Notificações"
              >
                <Bell size={17} />
                {state.notifications.some((item) => !item.read) ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-600" />
                ) : null}
              </button>
              <button
                className="app-header-icon focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700"
                type="button"
                onClick={handleLogout}
                aria-label="Sair"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="app-content space-y-5 p-3 sm:p-4 lg:p-5 xl:p-6">
          {page === 'dashboard' ? (
            <DashboardPage
              metrics={metrics}
              monthlySeries={monthlySeries}
              leadSourceSeries={leadSourceSeries}
              serviceSeries={serviceSeries}
              state={state}
              onOpenModal={setModal}
              onNavigate={setPage}
              onCompleteTask={(taskId) => { const task = state.tasks.find((item) => item.id === taskId); if (task) setTaskStatus(task, 'Concluída') }}
            />
          ) : null}
          {page === 'leads' ? (
            <CrmPage
              leads={filteredLeads}
              state={state}
              view={leadView}
              selectedLead={selectedLead}
              onViewChange={setLeadView}
              onMoveLead={moveLead}
              onCreateLead={() => openLeadModal()}
              onEditLead={openLeadModal}
              onOpenLead={openLeadDetail}
              onCloseLead={() => setSelectedLeadId('')}
              onDeleteLead={deleteLead}
              onAttachReceipt={openReceiptModal}
              onGenerateProposal={openProposalGenerator}
              onRegisterInteraction={registerLeadInteraction}
              onScheduleReturn={(lead) => openAppointmentModal({ title: `Retorno - ${contactDisplayName(lead)}`, appointmentType: 'Follow-up', leadId: lead.id })}
              onRegisterDeposit={openQuotePayment}
              onDownloadQuote={downloadQuotePdf}
              onApproveQuote={confirmQuoteApproval}
              onMarkPaymentPaid={markPaymentPaid}
              onCreateProject={(lead) => beginServiceConfirmation(lead)}
              onCreateTask={(lead) => openTaskModal({ leadId: lead?.id })}
              onCompleteTask={(task) => setTaskStatus(task, 'Concluída')}
              onCancelTask={(task) => setTaskStatus(task, 'Cancelada')}
            />
          ) : null}
          {page === 'clients' ? (
            <ClientsPage
              clients={filteredClients}
              state={state}
              onOpenModal={setModal}
              onGenerateProposal={openProposalGenerator}
              onEditContact={(client) => { setSelectedClientId(client.id); setModal('client') }}
            />
          ) : null}
          {page === 'leadHunter' && state.leadHunterSettings ? (
            <Suspense fallback={<div className="flex min-h-72 items-center justify-center rounded-2xl border border-gray-200 bg-white text-sm font-medium text-gray-500">Carregando Lead Hunter...</div>}><LeadHunterPage
              cities={state.leadHunterCities || []}
              categories={state.leadHunterCategories || []}
              prospects={state.leadHunterProspects || []}
              searches={state.leadHunterSearches || []}
              routes={state.leadHunterRoutes || []}
              settings={state.leadHunterSettings}
              providerReady
              onSearch={async (filters) => {
                const startedAt = Date.now()
                const now = new Date().toISOString()
                const activeCities = (state.leadHunterCities || []).filter((item) => item.active && (!item.blockedUntil || item.blockedUntil <= now))
                const activeCategories = (state.leadHunterCategories || []).filter((item) => item.active)
                const publicSearchCategories = activeCategories.filter((item) =>
                  item.group !== 'Eventos' &&
                  /hotel|pousada|restaurante|imobiliária|vinícola|resort|haras|pesqueiro|concessionária|shopping|academia|clínica|escola|indústria|logístico|galpão|energia solar|condomínio|fazenda|sítio|cooperativa|construtora|incorporadora|loteamento/i.test(item.name),
                )
                const categoryCoveragePriority = (name: string) => {
                  const normalized = normalizeLeadText(name)
                  if (/^hotel$/.test(normalized)) return 100
                  if (/restaurante/.test(normalized)) return 95
                  if (/imobiliaria/.test(normalized)) return 90
                  if (/construtora|incorporadora|loteamento/.test(normalized)) return 85
                  if (/concessionaria|shopping|academia|clinica|escola/.test(normalized)) return 80
                  if (/industria|logistic|galpao|energia solar/.test(normalized)) return 75
                  if (/pousada|resort|vinicola|condominio/.test(normalized)) return 70
                  return 50
                }
                const candidateCities = filters.cityIds.length
                  ? activeCities.filter((item) => filters.cityIds.includes(item.id)).slice(0, 1)
                  : [...activeCities].sort((a, b) => a.searchCount - b.searchCount || a.distanceFromBaseKm - b.distanceFromBaseKm).slice(0, 3)
                let city = candidateCities[0]
                const selectedCategories = filters.categoryIds.length
                  ? activeCategories.filter((item) => filters.categoryIds.includes(item.id)).slice(0, 1)
                  : [...(publicSearchCategories.length ? publicSearchCategories : activeCategories)]
                    .sort((a, b) => (categoryCoveragePriority(b.name) - b.searchCount * 5) - (categoryCoveragePriority(a.name) - a.searchCount * 5))
                    .slice(0, 3)
                if (!city || !selectedCategories.length) { setToast('Ative ao menos uma cidade e uma categoria nas configurações.'); return }
                const searchId = createId('lh-search')
                try {
                  const controller = new AbortController()
                  const timeout = window.setTimeout(() => controller.abort(), 45_000)
                  const provider = new OpenStreetMapLeadProvider()
                  const resultsPerSearch = Math.max(10, state.leadHunterSettings?.maxResultsPerSearch || 10)
                  const providerLimit = Math.min(30, resultsPerSearch * 3)
                  const unavailableProspects = (state.leadHunterProspects || []).filter((prospect) =>
                    prospect.status === 'Importado' ||
                    prospect.status === 'Descartado' ||
                    prospect.discardedPermanently ||
                    Boolean(prospect.leadId),
                  )
                  const isAlreadyImported = (raw: { id?: string; name: string; city: string; externalIds?: Record<string, string> }) => {
                    const osmId = raw.externalIds?.openstreetmap
                    const normalizedName = normalizeLeadText(raw.name)
                    const normalizedCity = normalizeLeadText(raw.city)
                    return unavailableProspects.some((prospect) =>
                      prospect.id === raw.id ||
                      Boolean(osmId && prospect.externalIds.openstreetmap === osmId) ||
                      (prospect.normalizedName === normalizedName && normalizeLeadText(prospect.city) === normalizedCity),
                    )
                  }
                  let result = await provider.search({ cityNames: [city.name], categoryNames: selectedCategories.map((item) => item.name), radiusKm: filters.radiusKm, limit: providerLimit }, controller.signal)
                  result = { ...result, leads: result.leads.filter((lead) => !isAlreadyImported(lead)) }
                  const combinedLeads = new Map(result.leads.map((lead) => [lead.id || `${normalizeLeadText(lead.name)}|${normalizeLeadText(lead.city)}`, lead]))
                  const combinedSources = new Set(result.sources)
                  for (const fallbackCity of candidateCities.slice(1)) {
                    if (combinedLeads.size >= resultsPerSearch) break
                    const fallbackResult = await provider.search({ cityNames: [fallbackCity.name], categoryNames: selectedCategories.map((item) => item.name), radiusKm: filters.radiusKm, limit: providerLimit }, controller.signal)
                    fallbackResult.sources.forEach((source) => combinedSources.add(source))
                    fallbackResult.leads.filter((lead) => !isAlreadyImported(lead)).forEach((lead) => {
                      const key = lead.id || `${normalizeLeadText(lead.name)}|${normalizeLeadText(lead.city)}`
                      if (!combinedLeads.has(key)) combinedLeads.set(key, lead)
                    })
                  }
                  result = { ...result, leads: [...combinedLeads.values()].sort((a, b) => leadContactPriority(b) - leadContactPriority(a)).slice(0, resultsPerSearch), sources: [...combinedSources] }
                  window.clearTimeout(timeout)
                  let tokenUsage = 0
                  let enrichmentById = new Map<string, Awaited<ReturnType<typeof enrichLeadsWithOpenAI>>['leads'][number]>()
                  const aiCallsToday = (state.leadHunterSearches || []).filter((search) => search.createdAt.slice(0, 10) === now.slice(0, 10) && search.tokenUsage > 0).length
                  const effectiveDailyAiLimit = state.leadHunterSettings?.maxDailyCalls || 50
                  const aiBudgetAvailable = aiCallsToday < effectiveDailyAiLimit
                  if (isOpenAILeadEnrichmentConfigured && aiBudgetAvailable) {
                    try {
                      const knownProspects = state.leadHunterProspects || []
                      const enrichmentPriority = (raw: typeof result.leads[number]) => {
                        const category = normalizeLeadText(raw.categoryName)
                        const commercialPotential =
                          /construtora|incorporadora|loteamento|imobiliaria|condominio|industria|logistic|galpao|energia solar|concessionaria/.test(category) ? 24 :
                          /hotel|pousada|resort|vinicola|fazenda|haras|shopping|clinica|escola|academia|restaurante/.test(category) ? 16 :
                          8
                        const discoverability =
                          (raw.website ? 18 : 0) +
                          (raw.instagram ? 10 : 0) +
                          (raw.phone ? 6 : 0) +
                          (raw.address ? 4 : 0)
                        return (raw.score || 0) + commercialPotential + discoverability
                      }
                      const enrichmentInput = result.leads.filter((raw) => {
                        const stableId = raw.id || `lh-${normalizeLeadText(`${raw.name}-${raw.city}-${raw.address}`)}`
                        const osmId = raw.externalIds?.openstreetmap
                        const normalizedName = normalizeLeadText(raw.name)
                        const normalizedCity = normalizeLeadText(raw.city)
                        const alreadyKnown = knownProspects.some((item) =>
                          item.id === stableId ||
                          Boolean(osmId && item.externalIds.openstreetmap === osmId) ||
                          (item.normalizedName === normalizedName && normalizeLeadText(item.city) === normalizedCity),
                        )
                        return !alreadyKnown
                      }).sort((a, b) => enrichmentPriority(b) - enrichmentPriority(a))
                        .slice(0, 3).map((raw) => ({
                        externalIds: {}, neighborhood: '', address: '', phone: '', whatsapp: '', email: '', instagram: '', website: '', googleMapsUrl: '',
                        sources: [], sourceUrls: [], score: 0, scoreReasons: [], normalizedName: normalizeLeadText(raw.name), categoryId: '', status: 'Descoberto' as const,
                        isNew: true, firstDiscoveredAt: now, lastDiscoveredAt: now, discoveryCount: 1, displayCount: 0, changedSinceLastDisplay: false,
                        discardedPermanently: false, notes: '', createdAt: now, updatedAt: now, ...raw,
                        id: raw.id || `lh-${normalizeLeadText(`${raw.name}-${raw.city}-${raw.address}`)}`,
                      }))
                      const enrichment = await enrichLeadsWithOpenAI(enrichmentInput, AbortSignal.timeout(110_000))
                      tokenUsage = enrichment.tokenUsage
                      enrichmentById = new Map(enrichment.leads.map((lead) => [lead.id, lead]))
                    } catch (error) {
                      setToast(`${error instanceof Error ? error.message : 'A pesquisa de contatos falhou.'} Os resultados públicos foram mantidos.`)
                    }
                  }
                  let newCount = 0
                  let repeatedCount = 0
                  let duplicateCount = 0
                  updateState((current) => {
                    const existingProspects = [...(current.leadHunterProspects || [])]
                    const incoming = result.leads.map((raw) => {
                      const stableId = raw.id || `lh-${normalizeLeadText(`${raw.name}-${raw.city}-${raw.address}`)}`
                      const enrichment = enrichmentById.get(stableId)
                      const enrichedRaw = enrichment ? {
                        ...raw,
                        contactName: enrichment.contactName || undefined,
                        phone: enrichment.phone || raw.phone,
                        whatsapp: enrichment.whatsapp || raw.whatsapp,
                        email: enrichment.email || raw.email,
                        website: enrichment.website || raw.website,
                        instagram: enrichment.instagram || raw.instagram,
                        aiSummary: enrichment.aiSummary || raw.aiSummary,
                        aiApproach: enrichment.aiApproach || raw.aiApproach,
                        sources: [...new Set([...(raw.sources || []), 'OpenAI Web Search'])],
                        sourceUrls: [...new Set([...(raw.sourceUrls || []), ...enrichment.sourceUrls])],
                      } : raw
                      const existing = existingProspects.find((item) => item.id === stableId || item.externalIds.openstreetmap === raw.externalIds?.openstreetmap)
                      const duplicate = findLeadDuplicates(raw, existingProspects, current.clients, current.leads)[0]
                      if (duplicate && duplicate.id !== existing?.id) duplicateCount += 1
                      const category = selectedCategories.find((item) => normalizeLeadText(item.name) === normalizeLeadText(raw.categoryName)) || selectedCategories[0]
                      const leadCity = activeCities.find((item) => normalizeLeadText(item.name) === normalizeLeadText(raw.city)) || city
                      const refined = refineLeadOpportunity(enrichedRaw, leadCity.distanceFromBaseKm)
                      const evaluatedRaw = { ...enrichedRaw, ...refined, distanceKm: leadCity.distanceFromBaseKm }
                      if (existing) {
                        repeatedCount += 1
                        return { ...existing, ...evaluatedRaw, categoryId: category.id, cityId: leadCity.id, isNew: false, possibleDuplicateId: duplicate?.id, discoveryCount: existing.discoveryCount + 1, lastDiscoveredAt: now, lastSearchId: searchId, updatedAt: now }
                      }
                      newCount += 1
                      return { externalIds: {}, neighborhood: '', address: '', phone: '', whatsapp: '', email: '', instagram: '', website: '', googleMapsUrl: '', sources: [], sourceUrls: [], ...evaluatedRaw, id: stableId, normalizedName: normalizeLeadText(raw.name), categoryId: category.id, cityId: leadCity.id, status: 'Descoberto' as const, isNew: true, possibleDuplicateId: duplicate?.id, firstDiscoveredAt: now, lastDiscoveredAt: now, discoveryCount: 1, displayCount: 0, lastSearchId: searchId, changedSinceLastDisplay: false, discardedPermanently: false, notes: '', createdAt: now, updatedAt: now }
                    })
                    const incomingIds = new Set(incoming.map((item) => item.id))
                    return { ...current, leadHunterProspects: [...incoming, ...existingProspects.filter((item) => !incomingIds.has(item.id))], leadHunterCities: (current.leadHunterCities || []).map((item) => item.id === city.id ? { ...item, searchCount: item.searchCount + 1, discoveredCount: item.discoveredCount + incoming.length, newLeadCount: item.newLeadCount + newCount, lastSearchedAt: now, updatedAt: now } : item), leadHunterCategories: (current.leadHunterCategories || []).map((item) => selectedCategories.some((selected) => selected.id === item.id) ? { ...item, searchCount: item.searchCount + 1, updatedAt: now } : item), leadHunterSearches: [{ id: searchId, ...filters, cityIds: [city.id], categoryIds: selectedCategories.map((item) => item.id), neighborhood: '', sources: isOpenAILeadEnrichmentConfigured ? [...result.sources, 'OpenAI Web Search'] : result.sources, totalFound: incoming.length, newCount, repeatedCount, duplicateCount, cooldownBlockedCount: 0, errorCount: 0, estimatedCost: 0, tokenUsage, durationMs: Date.now() - startedAt, userId: activeUserId, createdAt: now }, ...(current.leadHunterSearches || [])] }
                  }, `${newCount} novo(s), ${repeatedCount} já conhecido(s). Busca real e gratuita concluída.`)
                } catch (error) {
                  updateState((current) => ({ ...current, leadHunterSearches: [{ id: searchId, ...filters, cityIds: [city.id], categoryIds: selectedCategories.map((item) => item.id), neighborhood: '', sources: ['OpenStreetMap / Overpass API'], totalFound: 0, newCount: 0, repeatedCount: 0, duplicateCount: 0, cooldownBlockedCount: 0, errorCount: 1, estimatedCost: 0, tokenUsage: 0, durationMs: Date.now() - startedAt, userId: activeUserId, createdAt: now }, ...(current.leadHunterSearches || [])] }), error instanceof Error ? error.message : 'Não foi possível concluir a busca pública.')
                }
              }}
              onSaveSettings={(settings) => updateState((current) => ({ ...current, leadHunterSettings: settings }), 'Configurações do Lead Hunter salvas.')}
              onSaveCities={(cities) => updateState((current) => ({ ...current, leadHunterCities: cities }), 'Cidades do Lead Hunter atualizadas.')}
              onSaveCategories={(categories) => updateState((current) => ({ ...current, leadHunterCategories: categories }), 'Categorias do Lead Hunter atualizadas.')}
              onImport={importLeadHunterProspects}
              onReject={(prospectId) => {
                const now = new Date().toISOString()
                updateState((current) => ({
                  ...current,
                  leadHunterProspects: (current.leadHunterProspects || []).map((prospect) =>
                    prospect.id === prospectId
                      ? { ...prospect, status: 'Descartado' as const, discardedPermanently: true, isNew: false, updatedAt: now }
                      : prospect,
                  ),
                }), 'Lead rejeitado e removido das próximas buscas.')
              }}
              onCreateRoute={(input) => {
                const now = new Date().toISOString()
                updateState((current) => ({ ...current, leadHunterRoutes: [{ id: createId('lh-route'), ...input, visitedProspectIds: [], status: 'Planejada', notes: '', createdBy: activeUserId, createdAt: now, updatedAt: now }, ...(current.leadHunterRoutes || [])] }), 'Rota salva no Lead Hunter.')
              }}
              onToggleVisited={(routeId, prospectId) => updateState((current) => ({ ...current, leadHunterRoutes: (current.leadHunterRoutes || []).map((route) => {
                if (route.id !== routeId) return route
                const visitedProspectIds = route.visitedProspectIds.includes(prospectId) ? route.visitedProspectIds.filter((id) => id !== prospectId) : [...route.visitedProspectIds, prospectId]
                return { ...route, visitedProspectIds, status: visitedProspectIds.length === route.prospectIds.length ? 'Concluída' : visitedProspectIds.length ? 'Em andamento' : 'Planejada', updatedAt: new Date().toISOString() }
              }) }), 'Visita atualizada na rota.')}
            /></Suspense>
          ) : null}
          {page === 'projects' ? (
            <ProjectsPage
              projects={filteredProjects}
              state={state}
              onCreateProject={() => openProjectModal()}
              onEditProject={openProjectModal}
              onDeleteProject={deleteProject}
              onOpenReceipt={openReceiptModal}
              onAdvanceProject={advanceProjectStage}
              onToggleChecklistCategory={toggleChecklistCategory}
              onScheduleCapture={(project) => {
                const existingCapture = state.appointments.find((appointment) => appointment.projectId === project.id && appointment.appointmentType === 'Captação' && appointment.status !== 'Cancelado')
                if (existingCapture) {
                  openExistingAppointment(existingCapture)
                  return
                }
                openAppointmentModal({
                  title: `Hero Drone — Captação — ${project.contactName || project.name}`,
                  appointmentType: 'Captação',
                  clientId: project.clientId,
                  leadId: project.leadId ?? '',
                  projectId: project.id,
                  startAt: project.captureDate && project.captureStartTime ? `${project.captureDate}T${project.captureStartTime}` : dateTimeInput(1, 9),
                  endAt: project.captureDate && project.captureEndTime ? `${project.captureDate}T${project.captureEndTime}` : dateTimeInput(1, 11),
                  address: project.address,
                  notes: project.notes,
                  status: 'Agendado',
                  color: '#d8a500',
                  createGoogleCalendar: true,
                })
              }}
              onRegisterFinalPayment={(project) => {
                setSelectedPaymentProjectId(project.id)
                setModal('payment')
              }}
              onExceptionalDelivery={releaseExceptionalDelivery}
              onAddAdjustment={addProjectAdjustment}
              onCompleteAdjustment={completeProjectAdjustment}
            />
          ) : null}
          {page === 'agenda' ? (
            <AgendaPage
              state={state}
              calendarView={calendarView}
              onCalendarViewChange={setCalendarView}
              onCreateTask={openTaskModal}
              onOpenAppointment={openExistingAppointment}
              onResizeAppointment={resizeAppointment}
            />
          ) : null}
          {page === 'quotes' ? (
            <QuotesPage
              state={state}
              onOpenModal={setModal}
              onCopyQuote={copyQuoteText}
              onCancelQuote={openCancelProposal}
              onDeleteQuote={openDeleteProposal}
              onArchiveQuote={archiveProposal}
              onRestoreQuote={restoreProposal}
              onDownloadPdf={downloadQuotePdf}
              onMarkSent={markQuoteSent}
              onApprove={confirmQuoteApproval}
              onRegisterDeposit={openQuotePayment}
              onCreateRevision={(quote) => cloneProposal(quote, true)}
              onEditQuote={(quote) => openProposalGenerator(quote.clientId ?? '', quote.leadId ?? '', quote.id)}
              onGenerateProposal={openProposalGenerator}
              onOpenReceipt={openReceiptModal}
              onScheduleQuote={(quote) => {
                if (quote.projectId) {
                  const project = state.projects.find((item) => item.id === quote.projectId)
                  setQuery(project?.projectCode ?? '')
                  setPage('projects')
                  return
                }
                if (!quote.leadId) {
                  setToast('A proposta precisa estar ligada a um contato para agendar o serviço.')
                  return
                }
                openCloseDeal(quote.leadId, quote.id)
              }}
            />
          ) : null}
          {page === 'finance' ? (
            <FinancePage
              state={state}
              monthlySeries={cashMonthlySeries}
              financeTab={financeTab}
              onFinanceTabChange={setFinanceTab}
              onOpenReceipt={openReceiptModal}
              onOpenPayment={openPaymentEditor}
              onOpenExpense={openExpenseEditor}
              onArchiveRecord={archiveFinancialRecord}
              onDeleteRecord={deleteFinancialRecord}
              onUpdatePaymentStatus={updatePaymentStatus}
              onReversePayment={reversePayment}
              onOpenBankAccount={openBankAccountEditor}
              onDeleteBankAccount={deleteBankAccount}
              onOpenBankTransfer={openBankTransferEditor}
              onDeleteBankTransfer={deleteBankTransfer}
            />
          ) : null}
          {page === 'equipment' ? (
            <EquipmentPage
              state={state}
              onCreate={() => openEquipmentModal()}
              onEdit={openEquipmentModal}
              onDelete={deleteEquipment}
            />
          ) : null}
          {page === 'reports' ? (
            <ReportsPage
              state={state}
              metrics={metrics}
              monthlySeries={monthlySeries}
              leadSourceSeries={leadSourceSeries}
              serviceSeries={serviceSeries}
              period={period}
              regime={regime}
            />
          ) : null}
          {page === 'settings' ? <SettingsPage state={state} onSubmit={updateSettings} /> : null}
          {page === 'users' ? (
            <UsersPage
              currentUser={currentUser}
              state={state}
              onOpenModal={setModal}
              onToggleActive={toggleUserActive}
              onResetPassword={resetUserPassword}
            />
          ) : null}
        </div>
      </main>

      <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-gray-200 bg-white lg:hidden">
        {availableMobileNavigation.slice(0, 4).map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.page}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-bold ${
                page === item.page ? 'text-[#171717]' : 'text-gray-500'
              }`}
              type="button"
              onClick={() => setPage(item.page)}
            >
              <Icon size={19} />
              {item.label}
            </button>
          )
        })}
        <button className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-bold ${availableMobileNavigation.slice(0, 4).some((item) => item.page === page) ? 'text-gray-500' : 'text-[#171717]'}`} type="button" aria-label="Abrir menu completo" onClick={() => setMobileMenuOpen(true)}><Menu size={19} />Menu</button>
      </nav>

      <div className="quick-actions-dock fixed bottom-20 right-4 z-40 lg:bottom-6">
        <div className="group relative">
          <Button
            aria-expanded={quickActionsOpen}
            aria-label="Ações rápidas"
            className="h-14 w-14 rounded-full bg-[#d8a500] p-0 text-black shadow-xl hover:bg-[#c69700]"
            type="button"
            onClick={() => setQuickActionsOpen((open) => !open)}
          >
            <Plus size={26} />
          </Button>
          {quickActionsOpen ? (
          <div className="quick-actions-menu absolute bottom-16 right-0 w-52 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
            {[
              { label: 'Nova oportunidade', modalName: 'lead', permission: 'manageLeads' },
              { label: 'Novo contato', modalName: 'client', permission: 'manageClients' },
              { label: 'Nova empresa', modalName: 'company', permission: 'manageClients' },
              { label: 'Nova tarefa', modalName: 'task', permission: 'manageAgenda' },
              { label: 'Novo projeto', modalName: 'project', permission: 'manageProjects' },
              { label: 'Nova proposta', modalName: 'proposal', permission: 'manageQuotes' },
              { label: 'Novo agendamento', modalName: 'appointment', permission: 'manageAgenda' },
              { label: 'Nova receita', modalName: 'payment', permission: 'manageFinance' },
              { label: 'Nova despesa', modalName: 'expense', permission: 'manageFinance' },
              { label: 'Novo equipamento', modalName: 'equipment', permission: 'manageEquipment' },
            ].filter((action) => can(currentUser, action.permission as UserPermission)).map(({ label, modalName }) => (
              <button
                key={modalName}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-gray-700 hover:bg-gray-100"
                type="button"
                onClick={() => {
                  setQuickActionsOpen(false)
                  if (modalName === 'appointment') {
                    setAppointmentDefaults({})
                    setSelectedAppointmentId('')
                  }
                  if (modalName === 'task') setTaskDefaults({})
                  if (modalName === 'lead') setSelectedLeadId('')
                  if (modalName === 'project') setSelectedProjectId('')
                  if (modalName === 'equipment') setSelectedEquipmentId('')
                  if (modalName === 'payment') { setSelectedFinancePaymentId(''); setSelectedPaymentProjectId('') }
                  if (modalName === 'expense') setSelectedFinanceExpenseId('')
                  setModal(modalName as ModalType)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          ) : null}
        </div>
      </div>

      {modal === 'leadDetail' && selectedLead ? (
        <Modal title={contactDisplayName(selectedLead)} onClose={() => { setModal(null); setSelectedLeadId('') }}>
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SmallStat label="Etapa atual" value={selectedLead.pipelineStage} />
              <SmallStat label="Valor potencial" value={formatCurrency(selectedLead.estimatedValue)} />
              <SmallStat label="Propostas" value={state.quotes.filter((quote) => quote.leadId === selectedLead.id).length} />
              <SmallStat label="Projetos" value={state.projects.filter((project) => isVisibleProject(project) && project.leadId === selectedLead.id).length} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Dados do contato">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="font-bold text-gray-500">Telefone</dt><dd className="font-black text-gray-950">{selectedLead.whatsapp || selectedLead.phone || '-'}</dd></div>
                  <div><dt className="font-bold text-gray-500">E-mail</dt><dd className="break-all font-black text-gray-950">{selectedLead.email || '-'}</dd></div>
                  <div><dt className="font-bold text-gray-500">Origem</dt><dd className="font-black text-gray-950">{selectedLead.source}</dd></div>
                  <div><dt className="font-bold text-gray-500">Local</dt><dd className="font-black text-gray-950">{[selectedLead.address, selectedLead.city].filter(Boolean).join(' · ') || '-'}</dd></div>
                  <div><dt className="font-bold text-gray-500">Entrada</dt><dd className="font-black text-gray-950">{formatDate(selectedLead.entryDate)}</dd></div>
                  <div><dt className="font-bold text-gray-500">Próxima ação</dt><dd className="font-black text-gray-950">{selectedLead.nextContactAt ? formatDateTime(selectedLead.nextContactAt) : 'Não definida'}</dd></div>
                </dl>
              </Panel>
              <Panel title="Ações do contato">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={() => registerLeadInteraction(selectedLead, 'Contato realizado')}><MessageCircle size={16} /> Registrar contato</Button>
                  <Button variant="secondary" type="button" onClick={() => openTaskModal({ leadId: selectedLead.id })}><Plus size={16} /> Criar tarefa</Button>
                  <Button type="button" onClick={() => openProposalGenerator('', selectedLead.id)}><Wand2 size={16} /> Gerar proposta</Button>
                  <Button variant="secondary" type="button" onClick={() => openAppointmentModal({ title: `Retorno - ${contactDisplayName(selectedLead)}`, appointmentType: 'Follow-up', leadId: selectedLead.id })}><CalendarDays size={16} /> Agendar retorno</Button>
                  <Button variant="secondary" type="button" onClick={() => { setQuery(contactDisplayName(selectedLead)); setPage('projects'); setModal(null) }}><Briefcase size={16} /> Visualizar projetos</Button>
                  <Button variant="secondary" type="button" onClick={() => registerLeadInteraction(selectedLead, 'Observação')}><FileText size={16} /> Adicionar observação</Button>
                  <Button className="sm:col-span-2" variant="danger" type="button" onClick={() => moveLead(selectedLead.id, 'Perdido')}><AlertTriangle size={16} /> Marcar como perdido</Button>
                </div>
              </Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Propostas, projetos e pagamentos">
                <div className="space-y-2 text-sm">
                  {state.quotes.filter((quote) => quote.leadId === selectedLead.id).map((quote) => <div key={quote.id} className="flex justify-between gap-3 rounded-lg border border-gray-200 p-3"><strong>{quote.quoteNumber}</strong><StatusBadge>{quote.status}</StatusBadge></div>)}
                  {state.projects.filter((project) => isVisibleProject(project) && project.leadId === selectedLead.id).map((project) => <div key={project.id} className="flex justify-between gap-3 rounded-lg border border-gray-200 p-3"><strong>{project.projectCode} · {project.name}</strong><StatusBadge>{project.projectStatus}</StatusBadge></div>)}
                  {state.payments.filter((payment) => payment.leadId === selectedLead.id).map((payment) => <div key={payment.id} className="flex justify-between gap-3 rounded-lg border border-gray-200 p-3"><span>{payment.paymentType} · {formatCurrency(payment.amount)}</span><StatusBadge>{payment.status}</StatusBadge></div>)}
                </div>
              </Panel>
              <Panel title="Tarefas, eventos e arquivos">
                <div className="space-y-2 text-sm">
                  {state.tasks.filter((task) => task.leadId === selectedLead.id && task.status !== 'Concluída').map((task) => <div key={task.id} className="rounded-lg border border-gray-200 p-3"><strong>{task.title}</strong><p className="text-gray-500">{formatDateTime(task.dueAt)}</p></div>)}
                  {state.appointments.filter((appointment) => appointment.leadId === selectedLead.id).slice(0, 5).map((appointment) => <div key={appointment.id} className="rounded-lg border border-gray-200 p-3"><strong>{appointment.title}</strong><p className="text-gray-500">{formatDateTime(appointment.startAt)}</p></div>)}
                  <p className="rounded-lg bg-gray-50 p-3 font-bold text-gray-600">{state.files.filter((file) => file.leadId === selectedLead.id).length} arquivo(s) vinculado(s)</p>
                </div>
              </Panel>
            </div>
            <Panel title="Timeline completa">
              <div className="space-y-3">
                {[...state.leadInteractions.filter((item) => item.leadId === selectedLead.id).map((item) => ({ id: item.id, date: item.interactionDate, title: item.interactionType, details: item.description })), ...state.statusHistory.filter((item) => item.entityType === 'Contato' && item.entityId === selectedLead.id).map((item) => ({ id: item.id, date: item.createdAt, title: item.action, details: item.details }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => <div key={item.id} className="border-l-2 border-[#d8a500] pl-4"><strong className="text-gray-950">{item.title}</strong><p className="text-xs text-gray-500">{formatDateTime(item.date)}</p><p className="mt-1 text-sm text-gray-700">{item.details}</p></div>)}
              </div>
            </Panel>
          </div>
        </Modal>
      ) : null}
      {modal === 'lead' ? (
        <Modal
          title={selectedLead ? 'Editar oportunidade' : 'Nova oportunidade'}
          size="md"
          onClose={() => {
            setModal(null)
            setSelectedLeadId('')
          }}
        >
          <LeadForm
            key={selectedLead?.id ?? 'new-lead'}
            lead={selectedLead}
            contacts={state.clients.filter((contact) => !contact.archived)}
            onCancel={() => {
              setModal(null)
              setSelectedLeadId('')
            }}
            onSubmit={saveLead}
          />
        </Modal>
      ) : null}
      {modal === 'client' ? (
        <Modal title={selectedClient ? 'Editar contato' : 'Novo contato'} onClose={() => { setModal(null); setSelectedClientId('') }}>
          <ClientForm client={selectedClient} companies={(state.companies || []).filter((company) => !company.archived)} onCancel={() => { setModal(null); setSelectedClientId('') }} onSubmit={addClient} />
        </Modal>
      ) : null}
      {modal === 'company' ? (
        <Modal title="Nova empresa" onClose={() => setModal(null)}>
          <CompanyForm onCancel={() => setModal(null)} onSubmit={addCompany} />
        </Modal>
      ) : null}
      {modal === 'project' ? (
        <Modal
          title={selectedProject ? 'Editar projeto' : 'Novo projeto'}
          onClose={() => {
            setModal(null)
            setSelectedProjectId('')
          }}
        >
          <ProjectForm
            key={selectedProject?.id ?? 'new-project'}
            project={selectedProject}
            state={state}
            onCancel={() => {
              setModal(null)
              setSelectedProjectId('')
            }}
            onSubmit={saveProject}
          />
        </Modal>
      ) : null}
      {modal === 'appointment' ? (
        <Modal
          title={selectedAppointment ? 'Editar agendamento' : 'Novo agendamento'}
          size={selectedAppointment ? 'md' : 'lg'}
          onClose={() => {
            setModal(null)
            setAppointmentDefaults({})
            setSelectedAppointmentId('')
          }}
        >
          <AppointmentForm
            appointment={selectedAppointment}
            initialValues={appointmentDefaults}
            state={state}
            onCancel={() => {
              setModal(null)
              setAppointmentDefaults({})
              setSelectedAppointmentId('')
            }}
            onDelete={selectedAppointment ? () => deleteAppointment(selectedAppointment) : undefined}
            onSubmit={saveAppointment}
          />
        </Modal>
      ) : null}
      {modal === 'task' ? (
        <Modal title="Nova tarefa" size="sm" onClose={() => { setModal(null); setTaskDefaults({}) }}>
          <TaskForm
            state={state}
            initialValues={taskDefaults}
            onCancel={() => { setModal(null); setTaskDefaults({}) }}
            onSubmit={saveTask}
          />
        </Modal>
      ) : null}
      {modal === 'payment' ? (
        <Modal title={selectedFinancePayment ? 'Editar receita ou pagamento' : 'Nova receita ou pagamento'} onClose={() => { setModal(null); setSelectedPaymentProjectId(''); setSelectedFinancePaymentId('') }}>
          <PaymentForm payment={selectedFinancePayment} initialProjectId={selectedPaymentProjectId} state={state} onCancel={() => { setModal(null); setSelectedPaymentProjectId(''); setSelectedFinancePaymentId('') }} onSubmit={addPayment} />
        </Modal>
      ) : null}
      {modal === 'expense' ? (
        <Modal title={selectedFinanceExpense ? 'Editar despesa' : 'Nova despesa'} onClose={() => { setModal(null); setSelectedFinanceExpenseId('') }}>
          <ExpenseForm expense={selectedFinanceExpense} state={state} onCancel={() => { setModal(null); setSelectedFinanceExpenseId('') }} onSubmit={addExpense} />
        </Modal>
      ) : null}
      {modal === 'bankAccount' ? (
        <Modal title={selectedBankAccount ? 'Editar conta bancária' : 'Nova conta bancária'} size="sm" onClose={() => { setModal(null); setSelectedBankAccountId('') }}>
          <BankAccountForm account={selectedBankAccount} onCancel={() => { setModal(null); setSelectedBankAccountId('') }} onSubmit={saveBankAccount} />
        </Modal>
      ) : null}
      {modal === 'bankTransfer' ? (
        <Modal title={selectedBankTransfer ? 'Editar transferência' : 'Transferir entre contas'} size="sm" onClose={() => { setModal(null); setSelectedBankTransferId('') }}>
          <BankTransferForm state={state} transfer={selectedBankTransfer} onCancel={() => { setModal(null); setSelectedBankTransferId('') }} onSubmit={saveBankTransfer} />
        </Modal>
      ) : null}
      {modal === 'receipt' && selectedReceiptPayment ? (
        <Modal
          title="Comprovante de pagamento"
          onClose={() => {
            setModal(null)
            setSelectedReceiptPaymentId('')
          }}
        >
          <ReceiptForm
            payment={selectedReceiptPayment}
            state={state}
            onCancel={() => {
              setModal(null)
              setSelectedReceiptPaymentId('')
            }}
            onSubmit={savePaymentReceipt}
          />
        </Modal>
      ) : null}
      {modal === 'quotePayment' && selectedQuotePayment ? (
        <Modal
          title={`Registrar entrada · ${selectedQuotePayment.quoteNumber}`}
          onClose={() => {
            setModal(null)
            setSelectedQuotePaymentId('')
          }}
        >
          <QuoteDepositForm
            quote={selectedQuotePayment}
            state={state}
            onCancel={() => {
              setModal(null)
              setSelectedQuotePaymentId('')
            }}
            onSubmit={(values) => registerQuoteDeposit(selectedQuotePayment, values)}
          />
        </Modal>
      ) : null}
      {modal === 'serviceConfirmed' && serviceConfirmation ? (
        <Modal title="Próximo passo" size="sm" onClose={() => { setModal(null); setServiceConfirmation(null) }}>
          <ServiceConfirmedPrompt
            lead={state.leads.find((lead) => lead.id === serviceConfirmation.leadId)}
            quote={serviceConfirmation.quoteId ? state.quotes.find((quote) => quote.id === serviceConfirmation.quoteId) : undefined}
            existingProject={state.projects.find((project) => project.leadId === serviceConfirmation.leadId && !project.deletedAt && project.projectStatus !== 'Cancelado')}
            onCreate={() => finishServiceConfirmation(true)}
            onLater={() => finishServiceConfirmation(false)}
            onCancel={() => { setModal(null); setServiceConfirmation(null) }}
          />
        </Modal>
      ) : null}
      {modal === 'proposalCancel' && selectedQuoteAction ? (
        <Modal title={`Cancelar proposta · ${selectedQuoteAction.quoteNumber}`} onClose={() => { setModal(null); setSelectedQuoteActionId('') }}>
          <ProposalCancelForm quote={selectedQuoteAction} onCancel={() => { setModal(null); setSelectedQuoteActionId('') }} onSubmit={(values) => cancelProposal(selectedQuoteAction, values.reason, values.notes, values.createNew, values.scheduleFuture)} />
        </Modal>
      ) : null}
      {modal === 'proposalDelete' && selectedQuoteAction ? (
        <Modal title={`Excluir proposta · ${selectedQuoteAction.quoteNumber}`} onClose={() => { setModal(null); setSelectedQuoteActionId('') }}>
          <ProposalDeleteForm quote={selectedQuoteAction} links={proposalLinks(selectedQuoteAction)} onDelete={(reason) => softDeleteProposal(selectedQuoteAction, reason)} onCancelQuote={() => openCancelProposal(selectedQuoteAction)} onArchive={() => archiveProposal(selectedQuoteAction)} onClose={() => { setModal(null); setSelectedQuoteActionId('') }} />
        </Modal>
      ) : null}
      {modal === 'quote' ? (
        <Modal title="Novo orçamento" onClose={() => setModal(null)}>
          <QuoteForm state={state} onCancel={() => setModal(null)} onSubmit={addQuote} />
        </Modal>
      ) : null}
      {modal === 'proposal' ? (
        <Modal title={selectedProposalQuote ? 'Editar proposta' : 'Nova proposta'} size="xl" onClose={closeProposalModal}>
          <ProposalGenerator
            key={selectedProposalQuote?.id ?? `new-${selectedProposalClientId}-${selectedProposalLeadId}`}
            editingQuote={selectedProposalQuote}
            editingQuoteItems={selectedProposalQuote ? state.quoteItems.filter((item) => item.quoteId === selectedProposalQuote.id) : []}
            initialClientId={selectedProposalClientId}
            initialLeadId={selectedProposalLeadId}
            state={state}
            onCancel={closeProposalModal}
            onSubmit={addProposal}
          />
        </Modal>
      ) : null}
      {modal === 'proposalOptions' ? (
        <Modal title="Criar proposta" size="md" onClose={closeProposalModal}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Já existem propostas ativas para este contato. Escolha uma opção:</p>
            <button className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#d8a500] bg-amber-50 p-3 text-left" type="button" onClick={() => { setSelectedProposalQuoteId(''); setModal('proposal') }}>
              <span><strong className="block text-gray-950">Criar proposta vazia</strong><span className="mt-0.5 block text-xs text-gray-600">Sem serviços ou valores preenchidos.</span></span><Plus size={19} />
            </button>
            {relatedProposalDraft ? (
              <button className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left hover:bg-gray-50" type="button" onClick={() => { setSelectedProposalQuoteId(relatedProposalDraft.id); setModal('proposal') }}>
                <span><strong className="block text-gray-950">Continuar {relatedProposalDraft.quoteNumber}</strong><span className="mt-0.5 block text-xs text-gray-500">{relatedProposalDraft.status} · {formatCurrency(relatedProposalDraft.totalValue)}</span></span><Pencil size={17} />
              </button>
            ) : null}
            {latestRelatedProposal ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" type="button" onClick={() => cloneProposal(latestRelatedProposal, false)}><Copy size={16} /> Duplicar última</Button>
                <Button variant="secondary" type="button" onClick={() => cloneProposal(latestRelatedProposal, true)}><FileText size={16} /> Criar revisão</Button>
              </div>
            ) : null}
            <details className="group rounded-lg border border-gray-200 bg-gray-50">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-bold text-gray-700 [&::-webkit-details-marker]:hidden"><span>Histórico ({relatedProposalQuotes.length})</span><span className="text-xs text-gray-500 group-open:hidden">Mostrar</span><span className="hidden text-xs text-gray-500 group-open:inline">Recolher</span></summary>
              <div className="max-h-52 space-y-2 overflow-y-auto border-t border-gray-200 p-2">
                {relatedProposalQuotes.map((quote) => <div key={quote.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm"><span className="font-bold text-gray-950">{quote.quoteNumber} · {formatCurrency(quote.totalValue)}</span><StatusBadge>{quote.status}</StatusBadge></div>)}
              </div>
            </details>
            <div className="flex justify-end"><Button variant="ghost" type="button" onClick={closeProposalModal}>Cancelar</Button></div>
          </div>
        </Modal>
      ) : null}
      {modal === 'closeDeal' && selectedCloseDealLead ? (
        <Modal
          title="Fechar serviço"
          onClose={() => {
            setModal(null)
            setSelectedCloseDealLeadId('')
            setSelectedCloseDealQuoteId('')
          }}
        >
          <ClosedServiceForm
            lead={selectedCloseDealLead}
            initialQuote={selectedCloseDealQuote}
            initialQuoteItems={selectedCloseDealQuote ? state.quoteItems.filter((item) => item.quoteId === selectedCloseDealQuote.id) : []}
            state={state}
            onNotify={showNotice}
            onCancel={() => {
              setModal(null)
              setSelectedCloseDealLeadId('')
              setSelectedCloseDealQuoteId('')
            }}
            onSubmit={closeLeadDeal}
          />
        </Modal>
      ) : null}
      {modal === 'user' ? (
        <Modal title="Novo usuário interno" onClose={() => setModal(null)}>
          <UserForm onCancel={() => setModal(null)} onSubmit={addUser} />
        </Modal>
      ) : null}
      {modal === 'equipment' ? (
        <Modal
          title={selectedEquipment ? 'Editar equipamento' : 'Novo equipamento'}
          onClose={() => {
            setModal(null)
            setSelectedEquipmentId('')
          }}
        >
          <EquipmentForm
            equipment={selectedEquipment}
            onCancel={() => {
              setModal(null)
              setSelectedEquipmentId('')
            }}
            onSubmit={saveEquipment}
          />
        </Modal>
      ) : null}
    </div>
  )
}

function ServiceConfirmedPrompt({ lead, quote, existingProject, onCreate, onLater, onCancel }: {
  lead?: Lead
  quote?: Quote
  existingProject?: Project
  onCreate: () => void
  onLater: () => void
  onCancel: () => void
}) {
  return <div className="space-y-3">
    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><CheckCircle2 size={19} /></div>
      <div><h3 className="font-black text-emerald-950">Serviço confirmado</h3><p className="mt-0.5 text-sm text-emerald-800">Deseja criar o projeto agora?</p></div>
    </div>
    <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-3">
      <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-xs font-bold text-gray-500">Contato</dt><dd className="truncate text-sm font-black text-gray-950">{lead ? contactDisplayName(lead) : 'Contato'}</dd></div>
      <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-xs font-bold text-gray-500">Proposta</dt><dd className="text-sm font-black text-gray-950">{quote?.quoteNumber || 'Sem proposta'}</dd></div>
      <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-xs font-bold text-gray-500">Valor</dt><dd className="text-sm font-black text-gray-950">{formatCurrency(quote?.totalValue ?? lead?.estimatedValue ?? 0)}</dd></div>
    </dl>
    {existingProject ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">O projeto {existingProject.projectCode} já existe e será aberto sem duplicidade.</div> : null}
    <div className="grid gap-2 sm:grid-cols-2"><Button variant="secondary" type="button" onClick={onLater}>Fazer depois</Button><Button type="button" onClick={onCreate}><Briefcase size={16} /> {existingProject ? 'Abrir projeto' : 'Criar projeto'}</Button></div>
    <button className="mx-auto block px-2 py-1 text-xs font-bold text-gray-500 hover:text-gray-800" type="button" onClick={onCancel}>Cancelar alteração</button>
  </div>
}

function ProposalCancelForm({ quote, onSubmit, onCancel }: {
  quote: Quote
  onSubmit: (values: { reason: string; notes: string; createNew: boolean; scheduleFuture: boolean }) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [createNew, setCreateNew] = useState(false)
  const [scheduleFuture, setScheduleFuture] = useState(false)
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit({ reason, notes, createNew, scheduleFuture }) }}>
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm"><strong>{getQuoteDisplayTitle(quote)}</strong><p className="mt-1 text-gray-500">{quote.quoteNumber} · {formatCurrency(quote.totalValue)}</p></div>
    <InputField label="Motivo do cancelamento (opcional)"><select className="field-input" value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Sem motivo informado</option>{['Cliente desistiu', 'Valor alterado', 'Serviço alterado', 'Proposta substituída', 'Erro de preenchimento', 'Fora do prazo', 'Outro'].map((item) => <option key={item}>{item}</option>)}</select></InputField>
    <InputField label="Observações"><textarea className="field-input min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} /></InputField>
    <div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm font-bold text-gray-700"><input className="h-4 w-4 accent-[#d8a500]" type="checkbox" checked={createNew} onChange={(event) => setCreateNew(event.target.checked)} /> Criar uma nova proposta</label><label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm font-bold text-gray-700"><input className="h-4 w-4 accent-[#d8a500]" type="checkbox" checked={scheduleFuture} onChange={(event) => setScheduleFuture(event.target.checked)} /> Agendar retorno futuro</label></div>
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Pagamentos, comprovantes, projetos e versões antigas serão preservados.</p>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" type="button" onClick={onCancel}>Voltar</Button><Button variant="danger" type="submit">Cancelar proposta</Button></div>
  </form>
}

function ProposalDeleteForm({ quote, links, onDelete, onCancelQuote, onArchive, onClose }: {
  quote: Quote
  links: { payments: number; receipts: number; projects: number; sentOrApproved: boolean }
  onDelete: (reason: string) => void
  onCancelQuote: () => void
  onArchive: () => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const hasImportantLinks = links.payments > 0 || links.receipts > 0 || links.projects > 0 || links.sentOrApproved
  if (hasImportantLinks) return <div className="space-y-4"><div className="rounded-xl border border-red-200 bg-red-50 p-4"><h3 className="font-black text-red-900">Esta proposta possui registros relacionados e não pode ser excluída definitivamente.</h3><p className="mt-2 text-sm leading-6 text-red-800">Use cancelamento ou arquivamento para preservar a integridade do histórico.</p></div><div className="grid gap-2 sm:grid-cols-4">{[['Pagamentos', links.payments], ['Comprovantes', links.receipts], ['Projetos', links.projects], ['Enviada/aprovada', links.sentOrApproved ? 'Sim' : 'Não']].map(([label, value]) => <SmallStat key={String(label)} label={String(label)} value={String(value)} />)}</div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" type="button" onClick={onClose}>Voltar</Button><Button variant="secondary" type="button" onClick={onArchive}>Arquivar proposta</Button><Button variant="danger" type="button" onClick={onCancelQuote}>Cancelar proposta</Button></div></div>
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (confirmation === quote.quoteNumber) onDelete(reason) }}><p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">A proposta será excluída logicamente e deixará de aparecer entre as ativas. O histórico será mantido.</p><InputField label="Motivo da exclusão (opcional)"><textarea className="field-input min-h-20" value={reason} onChange={(event) => setReason(event.target.value)} /></InputField><InputField label={`Digite ${quote.quoteNumber} para confirmar`}><input className="field-input" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></InputField><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" type="button" onClick={onClose}>Voltar</Button><Button variant="danger" disabled={confirmation !== quote.quoteNumber} type="submit">Excluir logicamente</Button></div></form>
}

function NoticeDialog({ dialog, onClose }: { dialog: NoticeDialogState; onClose: () => void }) {
  const toneClass = dialog.tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-700'
    : dialog.tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-sky-200 bg-sky-50 text-sky-700'
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="notice-dialog-title">
    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
      <div className="flex items-start gap-4"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}><AlertTriangle size={24} /></div><div><h2 id="notice-dialog-title" className="text-lg font-black text-gray-950">{dialog.title}</h2><p className="mt-2 text-sm leading-6 text-gray-600">{dialog.description}</p></div></div>
      <div className="mt-5 flex justify-end"><Button type="button" onClick={onClose}>{dialog.buttonLabel || 'Entendi'}</Button></div>
    </div>
  </div>
}

function InputDialog({ dialog, onCancel, onSubmit }: { dialog: InputDialogState; onCancel: () => void; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState(dialog.initialValue ?? '')
  const invalid = Boolean(dialog.required && !value.trim())
  const inputClass = 'field-input mt-1'
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="input-dialog-title">
    <form className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-2xl" onSubmit={(event) => { event.preventDefault(); if (!invalid) onSubmit(value.trim()) }}>
      <h2 id="input-dialog-title" className="text-lg font-black text-gray-950">{dialog.title}</h2>
      {dialog.description ? <p className="mt-2 text-sm leading-6 text-gray-600">{dialog.description}</p> : null}
      <label className="mt-5 block"><span className="field-label">{dialog.label}{dialog.required ? '' : ' (opcional)'}</span>{dialog.inputType === 'textarea' ? <textarea autoFocus className={`${inputClass} min-h-28`} placeholder={dialog.placeholder} value={value} onChange={(event) => setValue(event.target.value)} /> : <input autoFocus className={inputClass} type={dialog.inputType === 'password' ? 'password' : dialog.inputType === 'url' ? 'url' : 'text'} placeholder={dialog.placeholder} value={value} onChange={(event) => setValue(event.target.value)} />}</label>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" type="button" onClick={onCancel}>{dialog.cancelLabel || 'Cancelar'}</Button><Button variant={dialog.tone === 'danger' ? 'danger' : 'primary'} disabled={invalid} type="submit">{dialog.confirmLabel || 'Confirmar'}</Button></div>
    </form>
  </div>
}

function ConfirmDialog({
  dialog,
  onCancel,
  onConfirm,
}: {
  dialog: ConfirmDialogState
  onCancel: () => void
  onConfirm: () => void
}) {
  const isDanger = dialog.tone === 'danger'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${isDanger ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-gray-950">{dialog.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{dialog.description}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button className="w-full sm:w-auto" variant="secondary" type="button" onClick={onCancel}>
            {dialog.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button className="w-full sm:w-auto" variant={isDanger ? 'danger' : 'primary'} type="button" onClick={onConfirm}>
            {dialog.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function LoginScreen({
  onSubmit,
  onPasswordReset,
}: {
  onSubmit: (values: LoginFormValues) => void | Promise<void>
  onPasswordReset: (email: string) => void | Promise<void>
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  })

  return (
    <main className="grid min-h-screen bg-[#171717] lg:grid-cols-[1.15fr_0.85fr]">
      <section className="flex min-h-[42vh] flex-col justify-between overflow-hidden bg-[#171717] p-6 text-white lg:min-h-screen lg:p-10">
        <div className="flex items-center gap-3">
          <img className="h-16 w-16 shrink-0 object-contain" src={heroLogoSrc} alt="FlyFlow by Hero Drone" />
          <div>
            <h1 className="text-2xl font-black">{appShortName}</h1>
            <p className="text-sm font-bold text-[#d4af37]">{appSubtitle}</p>
            <p className="text-sm text-white/60">CRM, projetos e gestão financeira</p>
          </div>
        </div>
        <div className="max-w-3xl py-12">
          <p className="text-sm font-bold uppercase text-[#d8a500]">Operação de drones</p>
          <h2 className="mt-3 max-w-2xl text-4xl font-black leading-tight text-white sm:text-5xl">
            Controle contatos, propostas, captações, entregas e financeiro em uma rotina simples.
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {['Funil visual', 'Projetos com checklist', 'Lucro por período'].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm font-bold">
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/50">Fuso horário padrão: America/Sao_Paulo</p>
      </section>
      <section className="flex items-center justify-center bg-white p-4 sm:p-8">
        <form className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl" onSubmit={handleSubmit(onSubmit)}>
          <h2 className="text-2xl font-black text-gray-950">Entrar</h2>
          <p className="mt-1 text-sm text-gray-500">Digite seu e-mail e sua senha para acessar o FlyFlow.</p>
          <div className="mt-6 space-y-4">
            <InputField label="E-mail" error={getError(errors.email?.message)}>
              <input autoComplete="username" autoFocus className="field-input" placeholder="seu@email.com" type="email" {...register('email')} />
            </InputField>
            <InputField label="Senha" error={getError(errors.password?.message)}>
              <input autoComplete="current-password" className="field-input" placeholder="Digite sua senha" type="password" {...register('password')} />
            </InputField>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <label className="inline-flex items-center gap-2 font-bold text-gray-700">
                <input className="h-4 w-4 accent-[#d8a500]" type="checkbox" {...register('remember')} />
                Manter conectado
              </label>
              <button className="font-bold text-gray-700 underline" type="button" onClick={() => onPasswordReset(watch('email') || '')}>
                Recuperar senha
              </button>
            </div>
            <Button className="w-full" type="submit">
              Entrar no sistema
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

function DashboardPage({
  metrics,
  monthlySeries,
  leadSourceSeries,
  serviceSeries,
  state,
  onOpenModal,
  onNavigate,
  onCompleteTask,
}: {
  metrics: ReturnType<typeof calculateDashboardMetrics>
  monthlySeries: ReturnType<typeof buildMonthlySeries>
  leadSourceSeries: ReturnType<typeof buildLeadSourceSeries>
  serviceSeries: ReturnType<typeof buildServiceSeries>
  state: AppState
  onOpenModal: (modal: ModalType) => void
  onNavigate: (page: Page) => void
  onCompleteTask: (taskId: string) => void
}) {
  const visibleProjects = state.projects.filter(isVisibleProject)
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id))
  const visibleAppointments = state.appointments.filter((appointment) => !appointment.projectId || visibleProjectIds.has(appointment.projectId))
  const upcomingAppointments = visibleAppointments
    .filter((appointment) => appointment.status === 'Agendado' && new Date(appointment.startAt) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 5)

  const upcomingDeliveries = visibleProjects
    .filter((project) => ['Em edição', 'Aguardando revisão', 'Pronto para entrega', 'Agendado', 'Confirmado'].includes(project.projectStatus))
    .sort((a, b) => new Date(a.deliveryDeadline).getTime() - new Date(b.deliveryDeadline).getTime())
  const criticalDeliveryCount = upcomingDeliveries.filter((project) => getProjectDeadlineInfo(project.deliveryDeadline).level === 'danger').length

  const accountsReceivable = state.payments
    .filter((payment) => payment.status !== 'Recebida' && payment.status !== 'Cancelada')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 6)

  const attentionLeads = state.leads.filter(leadNeedsContact).slice(0, 6)
  const today = dateInput()
  const weekEnd = addCalendarDays(today, 7)
  const operational = {
    draftQuotes: state.quotes.filter((quote) => quote.status === 'Rascunho').length,
    waitingApproval: state.quotes.filter((quote) => ['Enviada', 'Visualizada', 'Em negociação'].includes(quote.status)).length,
    expiringQuotes: state.quotes.filter((quote) => !['Expirada', 'Cancelada', 'Recusada', 'Convertida em projeto'].includes(quote.status) && quote.expirationDate >= today && quote.expirationDate <= addCalendarDays(today, 2)).length,
    expiredQuotes: state.quotes.filter((quote) => quote.status === 'Expirada').length,
    waitingDeposits: state.quotes.filter((quote) => ['Aprovada', 'Aguardando entrada'].includes(quote.status)).length,
    waitingSchedule: visibleProjects.filter((project) => {
      const capture = visibleAppointments.some((appointment) => appointment.projectId === project.id && appointment.appointmentType === 'Captação' && appointment.status !== 'Cancelado')
      return !capture && ['Aguardando agendamento', 'Confirmado'].includes(project.projectStatus)
    }).length,
    capturesToday: visibleAppointments.filter((appointment) => appointment.appointmentType === 'Captação' && appointment.startAt.slice(0, 10) === today && appointment.status !== 'Cancelado').length,
    capturesWeek: visibleAppointments.filter((appointment) => appointment.appointmentType === 'Captação' && appointment.startAt.slice(0, 10) >= today && appointment.startAt.slice(0, 10) <= weekEnd && appointment.status !== 'Cancelado').length,
    finalPayments: visibleProjects.filter((project) => project.projectStatus === 'Aguardando pagamento final').length,
    delayedProjects: visibleProjects.filter((project) => project.deliveryDeadline && getProjectDeadlineInfo(project.deliveryDeadline).level === 'danger' && !['Entregue', 'Concluído', 'Cancelado'].includes(project.projectStatus)).length,
  }
  const priorityOrder = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 }
  const nextActions = state.tasks
    .filter((task) => task.status !== 'Concluída' && task.status !== 'Cancelada')
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 10)

  const supportingMetrics = [
    { label: 'Margem', value: `${metrics.margin.toFixed(1)}%`, icon: <BarChart3 size={17} />, tone: metrics.margin >= 25 ? 'positive' as const : 'warning' as const },
    { label: 'Pagamentos atrasados', value: metrics.overduePayments, icon: <AlertTriangle size={17} />, tone: metrics.overduePayments > 0 ? 'danger' as const : 'neutral' as const },
    { label: 'Novos contatos', value: metrics.newLeads, icon: <UserPlus size={17} />, tone: 'neutral' as const },
    { label: 'Serviços agendados', value: metrics.scheduledServices, icon: <CalendarDays size={17} />, tone: 'neutral' as const },
    { label: 'Projetos em edição', value: metrics.editingProjects, icon: <Camera size={17} />, tone: 'neutral' as const },
    { label: 'Entregas próximas', value: metrics.upcomingDeliveries, icon: <CheckCircle2 size={17} />, tone: criticalDeliveryCount ? 'danger' as const : 'warning' as const },
    { label: 'Despesas', value: formatCurrency(metrics.expenses), icon: <DollarSign size={17} />, tone: 'danger' as const },
    { label: 'Previsão no funil', value: formatCurrency(metrics.predictedPipelineValue), icon: <Briefcase size={17} />, tone: 'neutral' as const },
  ]

  return (
    <div className="dashboard-page space-y-4">
      <section className="dashboard-intro flex flex-col gap-4 rounded-2xl border border-gray-200 px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div>
          <p className="dashboard-eyebrow text-[0.68rem] font-black uppercase tracking-[0.18em]">Visão geral</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-gray-950 sm:text-2xl">Seu negócio em um só olhar</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Financeiro, agenda e operação reunidos de forma simples para você decidir o próximo passo.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" type="button" onClick={() => onNavigate('leads')}><Handshake size={16} /> Abrir comercial</Button>
          <Button variant="secondary" type="button" onClick={() => onNavigate('clients')}><ContactRound size={16} /> Ver contatos</Button>
          <Button type="button" onClick={() => onOpenModal('appointment')}><CalendarDays size={16} /> Novo agendamento</Button>
        </div>
      </section>

      <div className="dashboard-primary-metrics grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Wallet size={20} />} label="Faturado no período" value={formatCurrency(metrics.revenue)} detail="Alterna caixa ou competência no topo" />
        <MetricCard icon={<DollarSign size={20} />} label="Recebido" value={formatCurrency(metrics.received)} tone="positive" />
        <MetricCard icon={<Clock size={20} />} label="Pendente" value={formatCurrency(metrics.pendingReceivable)} tone="warning" />
        <MetricCard icon={<TrendingUp size={20} />} label="Lucro líquido" value={formatCurrency(metrics.netProfit)} tone={metrics.netProfit >= 0 ? 'positive' : 'danger'} />
      </div>

      <section className="dashboard-supporting-metrics rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-gray-950">Indicadores do período</h2>
            <p className="mt-0.5 text-xs text-gray-500">Os números complementares mais importantes.</p>
          </div>
          <span className="dashboard-period-chip rounded-full px-2.5 py-1 text-[0.68rem] font-black">Atualizado agora</span>
        </div>
        <div className="dashboard-indicator-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          {supportingMetrics.map((item) => <DashboardIndicator key={item.label} {...item} />)}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Pulso da operação">
          <p className="-mt-1 mb-3 text-xs text-gray-500">Pendências do fluxo atualizadas automaticamente.</p>
          <dl className="dashboard-operation-grid grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <SmallStat label="Rascunhos" value={operational.draftQuotes} />
            <SmallStat label="Aguardando aprovação" value={operational.waitingApproval} />
            <SmallStat label="Expirando" value={operational.expiringQuotes} />
            <SmallStat label="Expiradas" value={operational.expiredQuotes} />
            <SmallStat label="Entradas pendentes" value={operational.waitingDeposits} />
            <SmallStat label="Aguardando agenda" value={operational.waitingSchedule} />
            <SmallStat label="Captações hoje" value={operational.capturesToday} />
            <SmallStat label="Captações na semana" value={operational.capturesWeek} />
            <SmallStat label="Projetos atrasados" value={operational.delayedProjects} />
            <SmallStat label="Pagamentos finais" value={operational.finalPayments} />
          </dl>
        </Panel>

        <Panel title="Próximas ações" action={<button className="text-xs font-black text-gray-500 hover:text-gray-950" type="button" onClick={() => onNavigate('agenda')}>Ver agenda</button>}>
          <div className="dashboard-next-actions max-h-64 space-y-2 overflow-y-auto pr-1">
            {nextActions.length ? nextActions.map((task) => (
              <div key={task.id} className="dashboard-task flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 transition">
                <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onNavigate(task.quoteId ? 'quotes' : task.projectId ? 'projects' : task.leadId ? 'leads' : 'agenda')}>
                  <strong className="block truncate text-sm text-gray-950">{task.title}</strong>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">{task.description || formatDateTime(task.dueAt)}</span>
                </button>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[0.65rem] font-black ${task.priority === 'Urgente' ? 'bg-red-100 text-red-700' : task.priority === 'Alta' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{task.priority}</span>
                <button aria-label={`Concluir ${task.title}`} className="dashboard-task-complete flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700" type="button" onClick={() => onCompleteTask(task.id)}><CheckCircle2 size={16} /></button>
              </div>
            )) : <DashboardEmptyState icon={<CheckCircle2 size={20} />} message="Tudo em dia. Nenhuma ação pendente." />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
        <Panel
          title="Faturamento, lucro e despesas"
          action={
            <Button variant="secondary" type="button" onClick={() => onNavigate('reports')}>
              <BarChart3 size={16} /> Relatórios
            </Button>
          }
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySeries}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={54} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }} formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#16a34a" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#dc2626" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Notificações e alertas">
          <div className="space-y-2">
            {state.notifications.length ? state.notifications.slice(0, 5).map((notification) => (
              <div key={notification.id} className="dashboard-notification rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><AlertTriangle size={16} /></span>
                  <div>
                    <p className="text-sm font-bold text-gray-950">{notification.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-gray-500">{notification.message}</p>
                  </div>
                </div>
              </div>
            )) : <DashboardEmptyState icon={<Bell size={20} />} message="Nenhum alerta importante no momento." />}
            <Button className="mt-2 w-full" variant="secondary" type="button" onClick={() => onOpenModal('appointment')}>
              <Plus size={16} /> Novo agendamento
            </Button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Próximos agendamentos">
          <div className="space-y-2">
            {upcomingAppointments.length ? upcomingAppointments.map((appointment) => {
              const client = appointment.clientId ? state.clients.find((item) => item.id === appointment.clientId) : undefined
              const project = appointment.projectId ? state.projects.find((item) => item.id === appointment.projectId) : undefined
              return (
                <div key={appointment.id} className="dashboard-list-card rounded-xl border border-gray-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-gray-950">{appointment.title}</p>
                      <p className="text-sm text-gray-500">
                        {client?.companyName ?? 'Sem cliente'} • {project?.serviceName ?? appointment.appointmentType}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {formatDateTime(appointment.startAt)} • {appointment.address || 'Sem endereço'}
                      </p>
                    </div>
                    <StatusBadge>{appointment.status}</StatusBadge>
                  </div>
                </div>
              )
            }) : <DashboardEmptyState icon={<CalendarDays size={20} />} message="Nenhum agendamento futuro." />}
          </div>
        </Panel>

        <Panel title="Próximas entregas">
          <div className="space-y-2">
            {upcomingDeliveries.length ? upcomingDeliveries.map((project) => {
              const client = projectClient(state, project)
              const deadline = getProjectDeadlineInfo(project.deliveryDeadline)
              return (
                <div key={project.id} className={`dashboard-list-card rounded-xl border p-3 ${deadline.level === 'danger' ? deadline.cardClass : 'border-gray-200'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-gray-950">{client?.companyName ?? project.name}</p>
                      <p className="text-sm text-gray-500">{project.name}</p>
                      <p className={`mt-1 text-sm font-black ${deadline.textClass}`}>{deadline.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {deadline.level === 'danger' ? (
                        <span className={`rounded-full px-2 py-1 text-xs font-black ${deadline.badgeClass}`}>{deadline.label}</span>
                      ) : null}
                      <StatusBadge>{project.projectStatus}</StatusBadge>
                    </div>
                  </div>
                </div>
              )
            }) : <DashboardEmptyState icon={<CheckCircle2 size={20} />} message="Nenhuma entrega próxima." />}
          </div>
        </Panel>

        <Panel title="Contas a receber">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {accountsReceivable.length ? accountsReceivable.map((payment) => {
                  const client = state.clients.find((item) => item.id === payment.clientId)
                  return (
                    <tr key={payment.id}>
                      <td data-label="Cliente">{client?.companyName ?? 'Cliente'}</td>
                      <td data-label="Valor">{formatCurrency(payment.amount)}</td>
                      <td data-label="Vencimento">{formatDate(payment.dueDate)}</td>
                      <td data-label="Situação">
                        <StatusBadge>{isPaymentOverdue(payment) ? 'Vencida' : payment.status}</StatusBadge>
                      </td>
                    </tr>
                  )
                }) : <tr><td className="text-center text-gray-500" colSpan={4}>Nenhuma conta pendente.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Contatos que precisam de retorno">
          <div className="space-y-2">
            {attentionLeads.length ? attentionLeads.map((lead) => (
              <div key={lead.id} className="dashboard-list-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                <div>
                  <p className="font-black text-gray-950">{contactDisplayName(lead)}</p>
                  <p className="text-sm text-gray-500">
                    {[contactDisplayDetail(lead), lead.pipelineStage].filter(Boolean).join(' • ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {lead.whatsapp || lead.phone ? (
                    <a className="focus-ring rounded-lg border border-gray-200 p-2 text-gray-700" href={whatsappLink(lead.whatsapp || lead.phone)} target="_blank" rel="noreferrer">
                      <MessageCircle size={18} />
                    </a>
                  ) : null}
                  <StatusBadge>{lead.temperature}</StatusBadge>
                </div>
              </div>
            )) : <DashboardEmptyState icon={<Users size={20} />} message="Nenhum contato aguardando retorno." />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Origem dos contatos">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={leadSourceSeries} dataKey="total" nameKey="source" innerRadius={58} outerRadius={88} paddingAngle={4} stroke="var(--surface)" strokeWidth={3}>
                  {leadSourceSeries.map((_, index) => (
                    <Cell key={index} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Serviços mais vendidos">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceSeries}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
                <XAxis dataKey="service" hide />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                <Bar dataKey="total" name="Projetos" fill="var(--accent)" radius={[8, 8, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function DashboardIndicator({ label, value, icon, tone = 'neutral' }: {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  tone?: 'neutral' | 'positive' | 'warning' | 'danger'
}) {
  const toneClass = tone === 'positive'
    ? 'is-positive'
    : tone === 'warning'
      ? 'is-warning'
      : tone === 'danger'
        ? 'is-danger'
        : ''

  return (
    <div className={`dashboard-indicator ${toneClass}`}>
      <span className="dashboard-indicator-icon">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[0.66rem] font-bold uppercase text-gray-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-black text-gray-950">{value}</p>
      </div>
    </div>
  )
}

function DashboardEmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="dashboard-empty-state flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 text-center">
      <span className="mb-2 text-gray-400">{icon}</span>
      <p className="text-xs font-bold text-gray-500">{message}</p>
    </div>
  )
}

function ClientsPage({
  clients,
  state,
  onOpenModal,
  onGenerateProposal,
  onEditContact,
}: {
  clients: Client[]
  state: AppState
  onOpenModal: (modal: ModalType) => void
  onGenerateProposal: (clientId: string) => void
  onEditContact: (client: Client) => void
}) {
  return (
    <div className="space-y-4">
      <PageToolbar
        title="Contatos"
        description="Base central conectada ao comercial, propostas, projetos e financeiro."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={() => onOpenModal('company')}><Plus size={16} /> Nova empresa</Button>
            <Button variant="secondary" type="button" onClick={() => onGenerateProposal(clients[0]?.id ?? '')}>
              <Wand2 size={16} /> Gerar proposta
            </Button>
            <Button type="button" onClick={() => onOpenModal('client')}><Plus size={16} /> Novo contato</Button>
          </div>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Panel title="Base de contatos">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contato</th>
                  <th>Canais</th>
                  <th>Empresa</th>
                  <th>Cidade</th>
                  <th>Total faturado</th>
                  <th>Recebido</th>
                  <th>Projetos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const company = (state.companies || []).find((item) => item.id === client.companyId)
                  const projects = state.projects.filter((project) => isVisibleProject(project) && project.clientId === client.id)
                  const total = projects.reduce((sum, project) => sum + project.totalValue, 0)
                  const received = state.payments
                    .filter((payment) => payment.clientId === client.id && payment.status === 'Recebida')
                    .reduce((sum, payment) => sum + payment.amount, 0)
                  return (
                    <tr key={client.id}>
                      <td data-label="Canais">
                        <div className="font-black text-gray-950">{contactDisplayName(client)}</div>
                        <div className="text-sm text-gray-500">{contactDisplayDetail(client)}</div>
                      </td>
                      <td data-label="Empresa">{company?.tradeName || client.companyName || '-'}</td>
                      <td data-label="Contato">
                        <div className="flex gap-2">
                          {client.whatsapp || client.phone ? (
                            <a className="rounded-lg border border-gray-200 p-2" href={whatsappLink(client.whatsapp || client.phone)} target="_blank" rel="noreferrer"><MessageCircle size={16} /></a>
                          ) : null}
                          {client.email ? <a className="rounded-lg border border-gray-200 p-2" href={`mailto:${client.email}`}><Mail size={16} /></a> : null}
                          {!client.whatsapp && !client.phone && !client.email ? <span className="text-sm font-bold text-gray-400">Sem contato</span> : null}
                        </div>
                      </td>
                      <td data-label="Cidade">{client.city}</td>
                      <td data-label="Total">{formatCurrency(total)}</td>
                      <td data-label="Recebido">{formatCurrency(received)}</td>
                      <td data-label="Projetos">{projects.length}</td>
                      <td data-label="Ações">
                        <div className="flex gap-2"><Button variant="secondary" type="button" onClick={() => onEditContact(client)}><Pencil size={16} /> Editar</Button><Button variant="secondary" type="button" onClick={() => onGenerateProposal(client.id)}><Wand2 size={16} /> Proposta</Button></div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Detalhes rápidos">
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-bold uppercase text-gray-500">Empresas cadastradas</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{(state.companies || []).filter((company) => !company.archived).length}</p>
              <div className="mt-2 space-y-1 text-sm">{(state.companies || []).filter((company) => !company.archived).slice(0, 4).map((company) => <div key={company.id} className="flex justify-between gap-3"><strong className="truncate">{company.tradeName}</strong><span className="text-gray-500">{company.document || company.city}</span></div>)}</div>
            </div>
            {clients.slice(0, 4).map((client) => {
              const projects = state.projects.filter((project) => isVisibleProject(project) && project.clientId === client.id)
              const total = projects.reduce((sum, project) => sum + project.totalValue, 0)
              const received = state.payments
                .filter((payment) => payment.clientId === client.id && payment.status === 'Recebida')
                .reduce((sum, payment) => sum + payment.amount, 0)
              const pending = Math.max(total - received, 0)
              return (
                <article key={client.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-gray-950">{contactDisplayName(client)}</h3>
                      <p className="text-sm text-gray-500">{contactDisplayDetail(client)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {client.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-gray-500">Gerado</dt><dd className="font-black">{formatCurrency(total)}</dd></div>
                    <div><dt className="text-gray-500">Pendente</dt><dd className="font-black">{formatCurrency(pending)}</dd></div>
                    <div><dt className="text-gray-500">Ticket</dt><dd className="font-black">{formatCurrency(projects.length ? total / projects.length : 0)}</dd></div>
                  </dl>
                  <Button className="mt-3 w-full" variant="secondary" type="button" onClick={() => onGenerateProposal(client.id)}>
                    <Wand2 size={16} /> Gerar proposta rápida
                  </Button>
                </article>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function ProjectsPage({
  projects,
  state,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onOpenReceipt,
  onAdvanceProject,
  onToggleChecklistCategory,
  onScheduleCapture,
  onRegisterFinalPayment,
  onExceptionalDelivery,
  onAddAdjustment,
  onCompleteAdjustment,
}: {
  projects: Project[]
  state: AppState
  onCreateProject: () => void
  onEditProject: (project: Project) => void
  onDeleteProject: (project: Project) => void
  onOpenReceipt: (payment: Payment) => void
  onAdvanceProject: (project: Project) => void
  onToggleChecklistCategory: (projectId: string, category: ProjectChecklistItem['category'], completed: boolean) => void
  onScheduleCapture: (project: Project) => void
  onRegisterFinalPayment: (project: Project) => void
  onExceptionalDelivery: (project: Project) => void
  onAddAdjustment: (project: Project) => void
  onCompleteAdjustment: (adjustmentId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<'active' | 'completed'>('active')
  const [openedProjectId, setOpenedProjectId] = useState('')
  const completedStatuses: Project['projectStatus'][] = ['Concluído', 'Finalizado', 'Cancelado']
  const isCompletedProject = (project: Project) => {
    if (completedStatuses.includes(project.projectStatus)) return true
    const checklist = state.projectChecklistItems.filter((item) => item.projectId === project.id)
    const isFullyPaid = project.totalValue > 0 && getProjectPaidAmount(state, project.id) >= project.totalValue
    return isFullyPaid && checklist.length > 0 && checklist.every((item) => item.completed)
  }
  const activeProjects = projects.filter((project) => !isCompletedProject(project))
  const completedProjects = projects.filter(isCompletedProject)
  const waitingPayment = projects.filter((project) => project.financialStatus === 'Aguardando sinal' || project.projectStatus === 'Aguardando pagamento final')
  const criticalProjects = activeProjects
    .filter((project) => getProjectDeadlineInfo(project.deliveryDeadline).level === 'danger')
    .sort((a, b) => new Date(a.deliveryDeadline).getTime() - new Date(b.deliveryDeadline).getTime())
  const scheduledProjects = activeProjects.filter((project) => state.appointments.some((appointment) => appointment.projectId === project.id && appointment.appointmentType === 'Captação' && appointment.status !== 'Cancelado'))
  const shownProjects = projects.filter((project) => {
    if (scope === 'active' && isCompletedProject(project)) return false
    if (scope === 'completed' && !isCompletedProject(project)) return false
    if (!search.trim()) return true
    const client = projectClient(state, project)
    return matches(`${project.projectCode} ${project.name} ${project.serviceName} ${client ? contactDisplayName(client) : ''} ${project.city}`, search)
  }).sort((a, b) => {
    const firstDate = a.captureDate || a.deliveryDeadline || '9999-12-31'
    const secondDate = b.captureDate || b.deliveryDeadline || '9999-12-31'
    return firstDate.localeCompare(secondDate)
  })
  const openedProject = projects.find((project) => project.id === openedProjectId)

  const projectPayments = (project: Project) => state.payments
    .filter((payment) => payment.projectId === project.id && !payment.deletedAt && !payment.archivedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const paymentHasReceipt = (payment: Payment) => Boolean(payment.receiptUrl || state.files.some((file) => file.paymentId === payment.id && !file.deletedAt))

  const attachReceipt = (payment: Payment) => {
    setOpenedProjectId('')
    onOpenReceipt(payment)
  }

  const renderProjectRow = (project: Project) => {
    const client = projectClient(state, project)
    const checklist = state.projectChecklistItems.filter((item) => item.projectId === project.id)
    const checklistCategories = [...new Set(checklist.map((item) => item.category))]
    const completedStages = checklistCategories.filter((category) => checklist.filter((item) => item.category === category).every((item) => item.completed)).length
    const stageProgress = checklistCategories.length ? Math.round((completedStages / checklistCategories.length) * 100) : 0
    const profit = getProjectProfit(state, project)
    const deadline = getProjectDeadlineInfo(project.deliveryDeadline)
    const payments = projectPayments(project)
    const receiptTarget = payments.find((payment) => !paymentHasReceipt(payment)) ?? payments[0]
    const paidPercentage = project.totalValue ? Math.min(Math.round((profit.paid / project.totalValue) * 100), 100) : 0
    const captureAppointment = state.appointments
      .filter((appointment) => appointment.projectId === project.id && appointment.appointmentType === 'Captação' && appointment.status !== 'Cancelado')
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0]

    return (
      <article key={project.id} className={`rounded-xl border bg-white p-3 shadow-sm ${deadline.level === 'danger' ? deadline.cardClass : 'border-gray-200'}`}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(13rem,0.75fr)_minmax(11rem,0.55fr)_auto] lg:items-center">
          <button className="min-w-0 text-left" type="button" onClick={() => setOpenedProjectId(project.id)}>
            <div className="flex flex-wrap items-center gap-2"><span className="text-[0.68rem] font-black uppercase tracking-wide text-gray-400">{project.projectCode}</span><StatusBadge>{project.projectStatus}</StatusBadge>{deadline.level === 'danger' ? <AlertTriangle className="text-red-600" size={15} /> : null}</div>
            <h3 className="mt-1 truncate text-base font-black text-gray-950">{project.name}</h3>
            <p className="mt-0.5 truncate text-xs text-gray-500">{client ? contactDisplayName(client) : 'Sem cliente'} · {project.serviceName}</p>
          </button>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3"><p className="text-[0.68rem] font-black uppercase text-gray-400">Captação</p><StatusBadge>{captureAppointment?.status || 'Sem agendamento'}</StatusBadge></div>
            <p className="mt-1 text-sm font-black text-gray-900">{captureAppointment ? formatDateTime(captureAppointment.startAt) : project.captureDate ? `${formatDate(project.captureDate)} · horário pendente` : 'Data ainda não definida'}</p>
            <button className="mt-1 inline-flex items-center gap-1 text-xs font-black text-[#9a7900] hover:underline" type="button" onClick={() => onScheduleCapture(project)}><CalendarDays size={14} /> {captureAppointment ? 'Editar agendamento' : 'Agendar agora'}</button>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs"><span className="font-bold text-gray-400">Financeiro</span><StatusBadge>{project.financialStatus}</StatusBadge></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPercentage}%` }} /></div>
            <div className="mt-1 flex justify-between text-[0.68rem] font-bold text-gray-500"><span>{formatCurrency(profit.paid)} recebido</span><span>{paidPercentage}%</span></div>
            <p className="mt-1 text-[0.68rem] font-bold text-gray-400">Etapas {completedStages}/{checklistCategories.length} · {stageProgress}% · entrega {project.deliveryDeadline ? formatDate(project.deliveryDeadline) : 'definida ao agendar'}</p>
          </div>

          <div className="flex items-center gap-1.5 lg:justify-end">
            <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => setOpenedProjectId(project.id)}>Abrir</Button>
            {receiptTarget ? <IconActionButton label="Comprovantes" icon={<Paperclip size={15} />} onClick={() => onOpenReceipt(receiptTarget)} /> : <IconActionButton label="Criar pagamento e anexar comprovante" icon={<Paperclip size={15} />} onClick={() => onRegisterFinalPayment(project)} />}
            <IconActionButton label="Editar projeto" icon={<Pencil size={15} />} onClick={() => onEditProject(project)} />
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-lg font-black text-gray-950">Projetos</h2><p className="text-sm text-gray-500">Agenda, andamento e financeiro sem excesso de informação.</p></div>
          <Button className="min-h-9 self-start px-3 py-1 text-xs" type="button" onClick={onCreateProject}><Plus size={15} /> Novo projeto</Button>
        </div>
        <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            <button className={`min-h-9 rounded-md px-4 text-sm font-black ${scope === 'active' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`} type="button" onClick={() => setScope('active')}>Ativos <span className="ml-1 text-xs">{activeProjects.length}</span></button>
            <button className={`min-h-9 rounded-md px-4 text-sm font-black ${scope === 'completed' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`} type="button" onClick={() => setScope('completed')}>Finalizados <span className="ml-1 text-xs">{completedProjects.length}</span></button>
          </div>
          <label className="relative block flex-1 lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input className="field-input field-input-with-leading-icon min-h-9 py-1.5 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projeto ou cliente…" /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-gray-500"><span>{scheduledProjects.length} agendado(s)</span><span>{waitingPayment.length} aguardando pagamento</span>{criticalProjects.length ? <span className="text-red-600">{criticalProjects.length} entrega(s) atrasada(s)</span> : null}</div>
      </section>

      {shownProjects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <h3 className="text-lg font-black text-gray-950">Nenhum projeto encontrado</h3>
          <p className="mt-1 text-sm text-gray-500">Ajuste a busca ou crie um novo projeto.</p>
          {!projects.length ? <Button className="mt-4 bg-emerald-600 text-white hover:bg-emerald-700" type="button" onClick={onCreateProject}><Plus size={16} /> Criar projeto</Button> : null}
        </div>
      ) : (
        <div className="space-y-2">{shownProjects.map(renderProjectRow)}</div>
      )}

      {openedProject ? <ProjectWorkspace
        project={openedProject}
        state={state}
        payments={projectPayments(openedProject)}
        onClose={() => setOpenedProjectId('')}
        onEdit={() => { setOpenedProjectId(''); onEditProject(openedProject) }}
        onDelete={() => { setOpenedProjectId(''); onDeleteProject(openedProject) }}
        onOpenReceipt={attachReceipt}
        onAdvance={() => onAdvanceProject(openedProject)}
        onToggleChecklistCategory={onToggleChecklistCategory}
        onScheduleCapture={() => { setOpenedProjectId(''); onScheduleCapture(openedProject) }}
        onRegisterFinalPayment={() => { setOpenedProjectId(''); onRegisterFinalPayment(openedProject) }}
        onExceptionalDelivery={() => onExceptionalDelivery(openedProject)}
        onAddAdjustment={() => onAddAdjustment(openedProject)}
        onCompleteAdjustment={onCompleteAdjustment}
      /> : null}
    </div>
  )
}

function ProjectWorkspace({
  project,
  state,
  payments,
  onClose,
  onEdit,
  onDelete,
  onOpenReceipt,
  onAdvance,
  onToggleChecklistCategory,
  onScheduleCapture,
  onRegisterFinalPayment,
  onExceptionalDelivery,
  onAddAdjustment,
  onCompleteAdjustment,
}: {
  project: Project
  state: AppState
  payments: Payment[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenReceipt: (payment: Payment) => void
  onAdvance: () => void
  onToggleChecklistCategory: (projectId: string, category: ProjectChecklistItem['category'], completed: boolean) => void
  onScheduleCapture: () => void
  onRegisterFinalPayment: () => void
  onExceptionalDelivery: () => void
  onAddAdjustment: () => void
  onCompleteAdjustment: (adjustmentId: string) => void
}) {
  const [tab, setTab] = useState<'summary' | 'finance' | 'checklist' | 'history'>('summary')
  const client = projectClient(state, project)
  const checklist = state.projectChecklistItems.filter((item) => item.projectId === project.id)
  const profit = getProjectProfit(state, project)
  const pending = Math.max(project.totalValue - profit.paid, 0)
  const deadline = getProjectDeadlineInfo(project.deliveryDeadline)
  const nextStatus = getNextProjectStatus(project)
  const location = [project.address, project.city].filter(Boolean).join(' ')
  const adjustments = state.projectAdjustments.filter((adjustment) => adjustment.projectId === project.id)
  const timeline = state.statusHistory.filter((history) =>
    (history.entityType === 'Projeto' && history.entityId === project.id) ||
    (history.entityType === 'Agendamento' && state.appointments.some((appointment) => appointment.id === history.entityId && appointment.projectId === project.id)),
  ).slice(0, 10)
  const checklistCategories = [...new Set(checklist.map((item) => item.category))]
  const completedChecklistCategories = checklistCategories.filter((category) => checklist.filter((item) => item.category === category).every((item) => item.completed)).length
  const checklistProgress = checklistCategories.length ? Math.round((completedChecklistCategories / checklistCategories.length) * 100) : 0
  const defaultDeliveryDays = Math.max(Number(state.companySettings.defaultDeliveryDays) || 7, 1)

  const primaryAction = (!project.captureDate || project.projectStatus === 'Aguardando agendamento')
    ? { label: 'Agendar captação', action: onScheduleCapture, icon: <CalendarDays size={16} /> }
    : project.projectStatus === 'Aguardando pagamento final'
      ? { label: 'Registrar pagamento final', action: onRegisterFinalPayment, icon: <Wallet size={16} /> }
      : nextStatus
        ? { label: `Avançar para ${nextStatus}`, action: onAdvance, icon: <CheckCircle2 size={16} /> }
        : undefined

  return (
    <Modal title={`${project.projectCode} · ${project.name}`} size="md" onClose={onClose}>
      <div className="space-y-3">
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap gap-2"><StatusBadge>{project.projectStatus}</StatusBadge><StatusBadge>{project.financialStatus}</StatusBadge></div><h2 className="mt-2 truncate text-base font-black text-gray-950">{client ? contactDisplayName(client) : 'Sem cliente vinculado'}</h2><p className="mt-0.5 truncate text-xs text-gray-500">{project.serviceName} · {project.contactName || project.city || 'Sem detalhes'}</p></div>
            <div className="flex shrink-0 gap-2">{primaryAction ? <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={primaryAction.action}>{primaryAction.icon}{primaryAction.label}</Button> : null}<IconActionButton label="Editar projeto" icon={<Pencil size={15} />} onClick={onEdit} /></div>
          </div>
        </section>

        <nav className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1">
          {([['summary', 'Resumo'], ['finance', `Financeiro ${payments.length}`], ['checklist', `Etapas ${completedChecklistCategories}/${checklistCategories.length}`], ['history', 'Histórico']] as const).map(([value, label]) => <button key={value} className={`min-h-9 truncate rounded-md px-2 text-xs font-black ${tab === value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`} type="button" onClick={() => setTab(value)}>{label}</button>)}
        </nav>

        {tab === 'summary' ? <div className="space-y-3">
          <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-lg border border-gray-200 bg-white py-3 text-center"><div><p className="text-[0.65rem] font-bold uppercase text-gray-400">Total</p><p className="mt-1 text-sm font-black text-gray-950">{formatCurrency(project.totalValue)}</p></div><div><p className="text-[0.65rem] font-bold uppercase text-gray-400">Recebido</p><p className="mt-1 text-sm font-black text-emerald-700">{formatCurrency(profit.paid)}</p></div><div><p className="text-[0.65rem] font-bold uppercase text-gray-400">Pendente</p><p className="mt-1 text-sm font-black text-gray-950">{formatCurrency(pending)}</p></div></div>
          <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-gray-200 p-3"><p className="text-[0.65rem] font-black uppercase text-gray-400">Captação</p><p className="mt-1 text-sm font-black text-gray-900">{project.captureDate ? formatDate(project.captureDate) : 'Não agendada'}{project.captureStartTime ? ` · ${project.captureStartTime}` : ''}</p><div className="mt-2 flex flex-wrap gap-2">{!project.captureDate ? <button className="text-xs font-black text-[#8a6a00]" type="button" onClick={onScheduleCapture}>Agendar agora</button> : null}<a className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 text-xs font-black text-amber-900 hover:bg-amber-100" href={SARPAS_URL} target="_blank" rel="noopener noreferrer"><ShieldCheck size={14} /> Solicitar voo no SARPAS</a></div></div><div className={`rounded-lg border p-3 ${deadline.boxClass}`}><p className="text-[0.65rem] font-black uppercase text-gray-400">Entrega</p><p className={`mt-1 text-sm font-black ${deadline.textClass}`}>{project.deliveryDeadline ? `${formatDate(project.deliveryDeadline)} · ${deadline.label}` : 'Definida ao agendar a captação'}</p><div className="mt-1 flex items-center justify-between gap-2"><span className="text-xs text-gray-500">{project.deliveryDeadlineNegotiated ? `Negociado: ${project.deliveryDaysAfterCapture ?? calendarDaysBetween(project.captureDate, project.deliveryDeadline)} dia(s) após a captação` : `Padrão: ${defaultDeliveryDays} dias após a captação`}</span>{project.captureDate ? <button className="shrink-0 text-xs font-black text-[#8a6a00]" type="button" onClick={onEdit}>Ajustar prazo</button> : null}</div></div></div>
          <div className="flex flex-wrap gap-2">{location ? <a className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-700" href={mapsLink(location)} target="_blank" rel="noreferrer"><MapPin size={15} /> Abrir mapa</a> : null}{project.links[0] ? <a className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-700" href={project.links[0]} target="_blank" rel="noreferrer"><FileText size={15} /> Arquivos</a> : null}{project.projectStatus === 'Aguardando aprovação do cliente' ? <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={onAddAdjustment}>Registrar ajuste</Button> : null}{project.projectStatus === 'Aguardando pagamento final' ? <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={onExceptionalDelivery}>Liberar entrega</Button> : null}</div>
        </div> : null}

        {tab === 'finance' ? <div className="space-y-2">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-gray-950">Pagamentos e comprovantes</p><Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={onRegisterFinalPayment}><Plus size={14} /> Novo</Button></div>
          {payments.map((payment) => { const file = state.files.find((item) => item.paymentId === payment.id && !item.deletedAt); const hasReceipt = Boolean(payment.receiptUrl || file); return <article key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-gray-950">{payment.paymentType}</strong><StatusBadge>{payment.status}</StatusBadge></div><p className="mt-1 text-xs text-gray-500">{formatCurrency(payment.amount)} · {hasReceipt ? 'com comprovante' : 'sem comprovante'}</p></div><Button className="min-h-9 shrink-0 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onOpenReceipt(payment)}><Paperclip size={14} /> {hasReceipt ? 'Abrir' : 'Anexar'}</Button></article> })}
          {!payments.length ? <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Nenhum pagamento vinculado.</p> : null}
        </div> : null}

        {tab === 'checklist' ? <div className="space-y-3">
          <div><div className="flex justify-between text-xs font-bold text-gray-500"><span>{completedChecklistCategories} de {checklistCategories.length} etapas concluídas</span><span>{checklistProgress}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${checklistProgress}%` }} /></div></div>
          <div className="space-y-2">{checklistCategories.map((category) => {
            const categoryItems = checklist.filter((item) => item.category === category)
            const categoryCompleted = categoryItems.filter((item) => item.completed).length
            const categoryDone = categoryItems.length > 0 && categoryCompleted === categoryItems.length
            return <article key={category} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${categoryDone ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex min-w-0 items-center gap-3"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${categoryDone ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{categoryDone ? <CheckCircle2 size={16} /> : <Clock size={16} />}</div><div className="min-w-0"><h3 className="truncate text-sm font-black text-gray-950">{category}</h3><p className="mt-0.5 text-xs text-gray-500">{categoryDone ? 'Etapa concluída' : 'Etapa pendente'}</p></div></div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">{category === 'Antes da captação' ? <a className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-900 hover:bg-amber-100" href={SARPAS_URL} target="_blank" rel="noopener noreferrer"><ShieldCheck size={14} /> SARPAS</a> : null}<Button className="min-h-9 shrink-0 px-3 py-1 text-xs" variant={categoryDone ? 'secondary' : 'primary'} type="button" onClick={() => onToggleChecklistCategory(project.id, category, !categoryDone)}>{categoryDone ? 'Reabrir etapa' : 'Concluir etapa'}</Button></div>
            </article>
          })}{!checklistCategories.length ? <p className="rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-500">Nenhuma etapa configurada.</p> : null}</div>
        </div> : null}

        {tab === 'history' ? <div className="space-y-3">
          {adjustments.length ? <section><h3 className="mb-2 text-xs font-black uppercase text-gray-500">Ajustes</h3><div className="space-y-2">{adjustments.map((adjustment) => <div key={adjustment.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-2.5 text-sm"><span className="min-w-0 truncate"><strong>V{adjustment.version}</strong> · {adjustment.description}</span>{adjustment.status !== 'Concluído' ? <Button className="min-h-8 shrink-0 px-2 py-1 text-xs" variant="secondary" type="button" onClick={() => onCompleteAdjustment(adjustment.id)}>Concluir</Button> : <StatusBadge>{adjustment.status}</StatusBadge>}</div>)}</div></section> : null}
          <section><h3 className="mb-2 text-xs font-black uppercase text-gray-500">Movimentações</h3><div className="max-h-[44vh] space-y-3 overflow-y-auto pr-1">{timeline.map((history) => <div key={history.id} className="border-l-2 border-[#d8a500] pl-3 text-sm"><div className="flex justify-between gap-3"><strong>{history.action}</strong><span className="shrink-0 text-xs text-gray-400">{formatDateTime(history.createdAt)}</span></div><p className="mt-0.5 text-xs text-gray-600">{history.details}</p></div>)}{!timeline.length ? <p className="text-sm text-gray-500">Nenhum histórico registrado.</p> : null}</div></section>
          <div className="border-t border-gray-200 pt-3"><Button className="min-h-9 px-3 py-1 text-xs" variant="danger" type="button" onClick={onDelete}><Trash2 size={14} /> Excluir projeto</Button></div>
        </div> : null}
      </div>
    </Modal>
  )
}

function AgendaPage({
  state,
  calendarView,
  onCalendarViewChange,
  onCreateTask,
  onOpenAppointment,
  onResizeAppointment,
}: {
  state: AppState
  calendarView: 'mensal' | 'semanal' | 'diaria' | 'lista'
  onCalendarViewChange: (view: 'mensal' | 'semanal' | 'diaria' | 'lista') => void
  onCreateTask: (defaults?: TaskFormDefaults) => void
  onOpenAppointment: (appointment: Appointment) => void
  onResizeAppointment: (appointment: Appointment, endAt: string) => void
}) {
  const visibleProjects = state.projects.filter(isVisibleProject)
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id))
  const deliveryAppointments = visibleProjects
    .filter((project) => project.deliveryDeadline && project.projectStatus !== 'Cancelado')
    .filter((project) => !state.appointments.some((appointment) =>
      appointment.projectId === project.id && appointment.appointmentType === 'Prazo de entrega',
    ))
    .map((project) => createProjectDeliveryAppointment(project, project.updatedAt, `delivery-${project.id}`))
  const sortedAppointments = [
    ...state.appointments.filter((appointment) => !appointment.projectId || visibleProjectIds.has(appointment.projectId)),
    ...deliveryAppointments,
  ].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  const conflicts = findAppointmentConflicts(sortedAppointments)
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const createAtSlot = (startAt: string, endAt: string) => {
    onCreateTask({
      dueAt: startAt,
      durationMinutes: getDurationMinutes(startAt, endAt),
    })
  }
  const moveCalendar = (direction: -1 | 1) => {
    setCalendarDate((current) => {
      const next = new Date(current)
      if (calendarView === 'mensal') next.setMonth(next.getMonth() + direction)
      if (calendarView === 'semanal') next.setDate(next.getDate() + direction * 7)
      if (calendarView === 'diaria' || calendarView === 'lista') next.setDate(next.getDate() + direction)
      return next
    })
  }
  const calendarLabel = calendarView === 'mensal'
    ? calendarDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : calendarView === 'semanal'
      ? `Semana de ${getWeekStart(calendarDate).toLocaleDateString('pt-BR')}`
      : calendarDate.toLocaleDateString('pt-BR')

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Agenda"
        description="Captações, reuniões, follow-ups, entregas, vencimentos e manutenção."
        action={
          <div className="flex flex-wrap gap-2">
            {([['mensal', 'Mensal'], ['semanal', 'Semanal'], ['diaria', 'Diário'], ['lista', 'Lista']] as const).map(([view, label]) => (
              <Button key={view} variant={calendarView === view ? 'primary' : 'secondary'} type="button" onClick={() => onCalendarViewChange(view)}>
                {label}
              </Button>
            ))}
            <Button type="button" onClick={() => onCreateTask()}><Plus size={16} /> Tarefa</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">Período</p>
          <h2 className="text-lg font-black capitalize text-gray-950">{calendarLabel}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" type="button" onClick={() => moveCalendar(-1)}>Anterior</Button>
          <Button variant="secondary" type="button" onClick={() => setCalendarDate(new Date())}>Hoje</Button>
          <Button variant="secondary" type="button" onClick={() => moveCalendar(1)}>Próximo</Button>
        </div>
      </div>

      {conflicts.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          {conflicts.length} conflito(s) de horário detectado(s). Ajuste os agendamentos sobrepostos.
        </div>
      ) : null}

      {calendarView === 'mensal' ? (
        <MonthCalendar
          appointments={sortedAppointments}
          anchorDate={calendarDate}
          onCreateAt={createAtSlot}
          onOpenAppointment={onOpenAppointment}
        />
      ) : null}
      {calendarView === 'semanal' || calendarView === 'diaria' ? (
        <TimeGridCalendar
          anchorDate={calendarDate}
          appointments={sortedAppointments}
          state={state}
          view={calendarView}
          onCreateAt={createAtSlot}
          onOpenAppointment={onOpenAppointment}
          onResizeAppointment={onResizeAppointment}
        />
      ) : null}

      {calendarView === 'lista' ? (
      <Panel title="Lista de eventos">
        <div className="space-y-3">
          {sortedAppointments.map((appointment) => {
            const client = appointment.clientId ? state.clients.find((item) => item.id === appointment.clientId) : undefined
            const project = appointment.projectId ? state.projects.find((item) => item.id === appointment.projectId) : undefined
            const lead = appointment.leadId ? state.leads.find((item) => item.id === appointment.leadId) : undefined
            const contactName = client?.companyName || lead?.companyName || 'Sem cliente'
            const whatsapp = client?.whatsapp || lead?.whatsapp || client?.phone || lead?.phone || ''
            return (
              <article
                key={appointment.id}
                className="cursor-pointer rounded-lg border border-gray-200 p-3 transition hover:border-[#d8a500] hover:bg-amber-50"
                role="button"
                tabIndex={0}
                onClick={() => onOpenAppointment(appointment)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onOpenAppointment(appointment)
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-gray-950">{appointment.title}</h3>
                    <p className="text-sm text-gray-500">{formatDateTime(appointment.startAt)} até {formatDateTime(appointment.endAt)}</p>
                    <p className="text-sm text-gray-500">{contactName} • {project?.projectCode ?? appointment.appointmentType}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {appointment.address ? (
                        <a className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700" href={mapsLink(appointment.address)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                          <MapPin size={15} /> Mapa
                        </a>
                      ) : null}
                      {whatsapp ? (
                        <a className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700" href={whatsappLink(whatsapp)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                          <MessageCircle size={15} /> WhatsApp
                        </a>
                      ) : null}
                      {appointment.calendarUrl ? (
                        <a className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700" href={appointment.calendarUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                          <CalendarDays size={15} /> Google Calendar
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2"><StatusBadge>{appointment.status}</StatusBadge>{appointment.appointmentType === 'Captação' && appointment.confirmationStatus !== 'Confirmado' ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">Confirmação pendente</span> : null}</div>
                </div>
              </article>
            )
          })}
        </div>
      </Panel>
      ) : null}
    </div>
  )
}

function QuotesPage({
  state,
  onOpenModal,
  onCopyQuote,
  onCancelQuote,
  onDeleteQuote,
  onArchiveQuote,
  onRestoreQuote,
  onDownloadPdf,
  onMarkSent,
  onApprove,
  onRegisterDeposit,
  onCreateRevision,
  onEditQuote,
  onGenerateProposal,
  onOpenReceipt,
  onScheduleQuote,
}: {
  state: AppState
  onOpenModal: (modal: ModalType) => void
  onCopyQuote: (quote: Quote) => void
  onCancelQuote: (quote: Quote) => void
  onDeleteQuote: (quote: Quote) => void
  onArchiveQuote: (quote: Quote) => void
  onRestoreQuote: (quote: Quote) => void
  onDownloadPdf: (quote: Quote) => void | Promise<void>
  onMarkSent: (quote: Quote) => void
  onApprove: (quote: Quote) => void
  onRegisterDeposit: (quote: Quote) => void
  onCreateRevision: (quote: Quote) => void
  onEditQuote: (quote: Quote) => void
  onGenerateProposal: (clientId?: string) => void
  onOpenReceipt: (payment: Payment) => void
  onScheduleQuote: (quote: Quote) => void
}) {
  const [scope, setScope] = useState<'active' | 'history'>('active')
  const [search, setSearch] = useState('')
  const [expandedQuoteId, setExpandedQuoteId] = useState('')
  const [previewFile, setPreviewFile] = useState<{ fileName: string; url: string; mode: 'image' | 'pdf' | 'link' } | null>(null)
  const visibleQuotes = state.quotes
    .filter((quote) => scope === 'history' ? Boolean(quote.archivedAt || quote.deletedAt) : !quote.archivedAt && !quote.deletedAt)
    .filter((quote) => {
      if (!search.trim()) return true
      const lead = quote.leadId ? state.leads.find((item) => item.id === quote.leadId) : undefined
      const client = quote.clientId ? state.clients.find((item) => item.id === quote.clientId) : undefined
      return matches(`${quote.quoteNumber} ${getQuoteTitle(quote)} ${lead?.fullName || ''} ${lead?.companyName || ''} ${client?.fullName || ''} ${client?.companyName || ''}`, search)
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-950">Propostas</h2>
            <p className="text-sm text-gray-500">Documentos, envio e aprovação em um só lugar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onGenerateProposal()}><Wand2 size={15} /> Nova proposta</Button>
            <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onOpenModal('quote')}><Plus size={15} /> Orçamento simples</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 md:flex-row md:items-center">
          <label className="relative block flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input className="field-input field-input-with-leading-icon min-h-9 py-1.5 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, cliente ou serviço…" /></label>
          <div className="flex gap-2"><Button className="min-h-9 px-3 py-1 text-xs" variant={scope === 'active' ? 'primary' : 'secondary'} type="button" onClick={() => setScope('active')}>Ativas</Button><Button className="min-h-9 px-3 py-1 text-xs" variant={scope === 'history' ? 'primary' : 'secondary'} type="button" onClick={() => setScope('history')}>Histórico</Button></div>
        </div>
      </section>

      <div className="space-y-2">
        {visibleQuotes.map((quote) => {
          const lead = quote.leadId ? state.leads.find((item) => item.id === quote.leadId) : undefined
          const client = quote.clientId ? state.clients.find((item) => item.id === quote.clientId) : undefined
          const items = state.quoteItems.filter((item) => item.quoteId === quote.id)
          const payments = state.payments.filter((payment) => payment.quoteId === quote.id && !payment.deletedAt)
          const receipts = state.files.filter((file) => file.quoteId === quote.id && file.paymentId && !file.deletedAt)
          const whatsapp = client?.whatsapp || lead?.whatsapp
          const recipientCompany = client?.companyName || lead?.companyName || 'Sem cliente'
          const displayTitle = getQuoteDisplayTitle(quote, recipientCompany)
          const expanded = expandedQuoteId === quote.id
          const history = state.statusHistory.filter((entry) => entry.entityType === 'Proposta' && entry.entityId === quote.id)
          const approvalIsPrimary = ['Enviada', 'Visualizada', 'Em negociação'].includes(quote.status)
          const canApprove = ['Rascunho', 'Gerada', 'Enviada', 'Visualizada', 'Em negociação'].includes(quote.status) && items.length > 0 && quote.totalValue > 0
          const primaryAction = quote.status === 'Rascunho'
            ? <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onDownloadPdf(quote)}><Download size={15} /> Gerar PDF</Button>
            : quote.status === 'Gerada'
              ? <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onMarkSent(quote)}><Mail size={15} /> Marcar enviada</Button>
              : ['Enviada', 'Visualizada', 'Em negociação'].includes(quote.status)
                ? <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onApprove(quote)}><CheckCircle2 size={15} /> Aprovar</Button>
                : ['Aprovada', 'Aguardando entrada', 'Entrada recebida'].includes(quote.status)
                  ? <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onRegisterDeposit(quote)}><Wallet size={15} /> Registrar entrada</Button>
                  : quote.status === 'Convertida em projeto'
                    ? <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onScheduleQuote(quote)}><Briefcase size={15} /> Abrir projeto</Button>
                    : ['Expirada', 'Recusada', 'Cancelada'].includes(quote.status)
                      ? <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onCreateRevision(quote)}><Copy size={15} /> Nova versão</Button>
                      : null
          return (
            <article key={quote.id} className="quote-card overflow-hidden rounded-xl border shadow-sm">
              <div className="quote-card-summary grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                <button className="min-w-0 text-left" type="button" onClick={() => setExpandedQuoteId(expanded ? '' : quote.id)}>
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[0.68rem] font-black uppercase tracking-wide text-gray-400">{quote.quoteNumber}</span><StatusBadge>{quote.status}</StatusBadge>{receipts.length ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Paperclip size={13} /> {receipts.length}</span> : null}</div>
                  <h3 className="mt-1 truncate text-sm font-black text-gray-950 sm:text-base">{displayTitle}</h3>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{recipientCompany} · {items.length} item(ns) · validade {formatDate(quote.expirationDate)}</p>
                </button>
                <div className="grid grid-cols-3 gap-4 text-right text-xs lg:min-w-[260px]"><div><p className="font-bold text-gray-400">Total</p><p className="mt-0.5 font-black text-gray-900">{formatCurrency(quote.totalValue)}</p></div><div><p className="font-bold text-gray-400">Sinal</p><p className="mt-0.5 font-black text-gray-900">{formatCurrency(quote.depositValue)}</p></div><div><p className="font-bold text-gray-400">Entrega</p><p className="mt-0.5 font-black text-gray-900">{formatDate(quote.deliveryDeadline)}</p></div></div>
                <div className="quote-card-primary-actions flex flex-wrap items-center gap-1.5 lg:justify-end">
                  {quote.archivedAt || quote.deletedAt ? <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onRestoreQuote(quote)}>Restaurar</Button> : primaryAction}
                  {!quote.archivedAt && !quote.deletedAt && canApprove && !approvalIsPrimary ? <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onApprove(quote)}><CheckCircle2 size={15} /> Aprovar</Button> : null}
                  {!(quote.archivedAt || quote.deletedAt) ? <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onDownloadPdf(quote)}><Download size={15} /><span className="hidden sm:inline">PDF</span></Button> : null}
                  <button className="focus-ring min-h-9 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-600 hover:bg-gray-50" type="button" onClick={() => setExpandedQuoteId(expanded ? '' : quote.id)}>{expanded ? 'Fechar' : 'Detalhes'}</button>
                </div>
              </div>

              {expanded ? <div className="quote-card-details border-t p-3">
                <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
                  <div className="quote-card-section rounded-lg border p-3"><p className="text-xs font-black uppercase text-gray-500">Itens</p><div className="mt-2 space-y-1.5">{items.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 text-sm"><span>{item.quantity}x {item.description}</span><strong className="whitespace-nowrap">{formatCurrency(item.totalPrice)}</strong></div>)}{!items.length ? <p className="text-sm text-gray-500">Nenhum item.</p> : null}</div></div>
                  <div className="quote-card-section rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase text-gray-500">Pagamentos</p>
                      <span className="text-xs font-bold text-gray-400">{receipts.length} comprovante(s)</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 text-xs"><span>{payment.paymentType} · {formatCurrency(payment.amount)}</span><StatusBadge>{payment.status}</StatusBadge></div>)}
                      {!payments.length ? <p className="text-sm text-gray-500">Sem lançamentos.</p> : null}
                      {receipts.map((file) => {
                        const linkedPayment = payments.find((payment) => payment.id === file.paymentId)
                        const fileUrl = file.externalLink || file.fileUrl || linkedPayment?.receiptUrl || ''
                        const previewMode = getFilePreviewMode(fileUrl, `${file.fileType} ${file.fileName}`)
                        if (!fileUrl) {
                          return (
                            <button
                              key={file.id}
                              className="focus-ring flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-2 text-left text-xs font-bold text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:underline"
                              type="button"
                              onClick={() => linkedPayment && onOpenReceipt(linkedPayment)}
                            >
                              <Paperclip size={13} />
                              <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
                              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-black">Abrir</span>
                            </button>
                          )
                        }
                        return (
                          <div
                            key={file.id}
                            className="cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-2 hover:border-emerald-300 hover:bg-emerald-50/40"
                            role="button"
                            tabIndex={0}
                            onClick={() => setPreviewFile({ fileName: file.fileName, url: fileUrl, mode: previewMode })}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setPreviewFile({ fileName: file.fileName, url: fileUrl, mode: previewMode })
                              }
                            }}
                          >
                            <button
                              className="flex w-full min-w-0 items-center gap-1 text-left text-xs font-bold text-emerald-700 hover:underline"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setPreviewFile({ fileName: file.fileName, url: fileUrl, mode: previewMode })
                              }}
                            >
                              <Paperclip size={13} />
                              <span className="truncate">{file.fileName}</span>
                            </button>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button
                                aria-label={`Visualizar ${file.fileName}`}
                                className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[0.7rem] font-bold text-gray-700 hover:bg-gray-50"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setPreviewFile({ fileName: file.fileName, url: fileUrl, mode: previewMode })
                                }}
                              >
                                <Eye size={12} /> Visualizar
                              </button>
                              <button
                                aria-label={`Baixar ${file.fileName}`}
                                className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[0.7rem] font-bold text-gray-700 hover:bg-gray-50"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  downloadUrl(fileUrl, file.fileName)
                                }}
                              >
                                <Download size={12} /> Baixar
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="quote-card-actions mt-3 flex flex-wrap items-center gap-1.5">
                  {!quote.archivedAt && !quote.deletedAt && !['Cancelada', 'Arquivada', 'Excluída logicamente'].includes(quote.status) ? <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onEditQuote(quote)}><Pencil size={14} /> Editar</Button> : null}
                  <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onCopyQuote(quote)}><Copy size={14} /> Copiar</Button>
                  {whatsapp ? <a className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-900" href={whatsappLink(whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a> : null}
                  {!quote.archivedAt && !quote.deletedAt ? <Button className="min-h-9 px-3 py-1 text-xs" variant="ghost" type="button" onClick={() => onArchiveQuote(quote)}>Arquivar</Button> : null}
                  {!quote.archivedAt && !quote.deletedAt && quote.status !== 'Cancelada' ? <Button className="min-h-9 px-3 py-1 text-xs" variant="ghost" type="button" onClick={() => onCancelQuote(quote)}>Cancelar</Button> : null}
                  {!quote.archivedAt && !quote.deletedAt ? <Button className="min-h-9 px-3 py-1 text-xs text-red-600" variant="ghost" type="button" onClick={() => onDeleteQuote(quote)}><Trash2 size={14} /> Excluir</Button> : null}
                </div>
                <details className="quote-card-section mt-3 rounded-lg border p-3"><summary className="cursor-pointer text-xs font-black uppercase text-gray-500">Histórico</summary><div className="mt-3 space-y-3">{history.map((entry) => <div key={entry.id} className="border-l-2 border-[#d8a500] pl-3 text-sm"><strong>{entry.action}</strong><p className="text-xs text-gray-500">{formatDateTime(entry.createdAt)}</p><p className="text-gray-600">{entry.details}</p></div>)}{!history.length ? <p className="text-sm text-gray-500">Criada em {formatDateTime(quote.createdAt)}</p> : null}</div></details>
              </div> : null}
            </article>
          )
        })}
        {!visibleQuotes.length ? <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center"><h3 className="font-black text-gray-900">Nenhuma proposta encontrada</h3><p className="mt-1 text-sm text-gray-500">Ajuste a busca ou crie uma nova proposta.</p></div> : null}
      </div>
      {previewFile ? (
        <Modal title={previewFile.fileName} size="xl" onClose={() => setPreviewFile(null)}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" type="button" onClick={() => openUrlInNewTab(previewFile.url)}>
                <FileText size={15} /> Abrir em nova aba
              </Button>
              <Button variant="secondary" type="button" onClick={() => downloadUrl(previewFile.url, previewFile.fileName)}>
                <Download size={15} /> Baixar
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {previewFile.mode === 'image' ? (
                <img className="max-h-[75vh] w-full object-contain bg-black/5" src={previewFile.url} alt={previewFile.fileName} />
              ) : previewFile.mode === 'pdf' ? (
                <iframe className="h-[75vh] w-full" src={getBrowserSafeFileUrl(previewFile.url)} title={previewFile.fileName} />
              ) : (
                <div className="space-y-3 p-6 text-sm text-gray-600">
                  <p>Esse arquivo não oferece pré-visualização direta aqui.</p>
                  <p>Use as opções acima para abrir ou baixar.</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function FinancePage({
  state,
  monthlySeries,
  financeTab,
  onFinanceTabChange,
  onOpenReceipt,
  onOpenPayment,
  onOpenExpense,
  onArchiveRecord,
  onDeleteRecord,
  onUpdatePaymentStatus,
  onReversePayment,
  onOpenBankAccount,
  onDeleteBankAccount,
  onOpenBankTransfer,
  onDeleteBankTransfer,
}: {
  state: AppState
  monthlySeries: ReturnType<typeof buildMonthlySeries>
  financeTab: FinanceTab
  onFinanceTabChange: (tab: FinanceTab) => void
  onOpenReceipt: (payment: Payment) => void
  onOpenPayment: (payment?: Payment) => void
  onOpenExpense: (expense?: Expense) => void
  onArchiveRecord: (kind: 'payment' | 'expense', id: string, archived: boolean) => void
  onDeleteRecord: (kind: 'payment' | 'expense', record: Payment | Expense) => void
  onUpdatePaymentStatus: (payment: Payment, status: Payment['status']) => void
  onReversePayment: (payment: Payment) => void
  onOpenBankAccount: (account?: BankAccount) => void
  onDeleteBankAccount: (account: BankAccount) => void
  onOpenBankTransfer: (transfer?: BankTransfer) => void
  onDeleteBankTransfer: (transfer: BankTransfer) => void
}) {
  const validPayments = state.payments.filter((payment) => !payment.archivedAt && !payment.deletedAt && !['Cancelada', 'Reembolsada'].includes(payment.status))
  const receivedTotal = validPayments.filter((payment) => payment.status === 'Recebida').reduce((total, payment) => total + getPaymentCashEffect(payment), 0)
  const pendingTotal = validPayments.filter((payment) => payment.status !== 'Recebida').reduce((total, payment) => total + payment.amount, 0)
  const overdueTotal = validPayments.filter(isPaymentOverdue).reduce((total, payment) => total + payment.amount, 0)
  const pendingExpenseTotal = state.expenses
    .filter((expense) => isOfficialExpense(expense) && !isPaidExpense(expense))
    .reduce((total, expense) => total + expense.amount, 0)
  const currentBalance = getTotalBankBalance(state)
  const projectedBalance = currentBalance + pendingTotal
  const projectedNetBalance = projectedBalance - pendingExpenseTotal
  const receivableProgress = receivedTotal + pendingTotal > 0 ? (receivedTotal / (receivedTotal + pendingTotal)) * 100 : 0
  const exportFinancialCsv = () => {
    const rows = [
      ['Tipo', 'Descrição', 'Valor', 'Data', 'Status', 'Projeto', 'Conta', 'Recorrência'],
      ...state.payments.filter((item) => !item.deletedAt).map((payment) => [payment.paymentType === 'Reembolso' ? 'Estorno' : 'Receita', payment.paymentType, payment.paymentType === 'Reembolso' ? -payment.amount : payment.amount, payment.paidAt || payment.dueDate, payment.status, payment.projectId || '', state.bankAccounts.find((account) => account.id === payment.bankAccountId)?.name || payment.account || '', '']),
      ...state.expenses.filter((item) => !item.deletedAt).map((expense) => ['Despesa', expense.description, expense.amount, expense.paidAt || expense.expenseDate, expense.status, expense.projectId || '', state.bankAccounts.find((account) => account.id === expense.bankAccountId)?.name || expense.account || '', expense.recurring ? expense.recurrenceFrequency || 'Mensal' : 'Única']),
      ...state.bankTransfers.map((transfer) => ['Transferência', transfer.description, transfer.amount, transfer.transferredAt, 'Concluída', '', `${state.bankAccounts.find((account) => account.id === transfer.fromAccountId)?.name || ''} → ${state.bankAccounts.find((account) => account.id === transfer.toAccountId)?.name || ''}`, '']),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
    link.download = `financeiro-hero-drone-${dateInput()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const pendingReceipts = state.payments.filter((payment) => payment.status === 'Recebida' && !payment.receiptUrl && !payment.deletedAt).length
  const receiptShortcut = state.payments.find((payment) => payment.status === 'Recebida' && !payment.receiptUrl && !payment.deletedAt && !payment.archivedAt)
    ?? state.payments.find((payment) => !payment.deletedAt && !payment.archivedAt)
  return (
    <div className="space-y-4">
      <PageToolbar
        title="Financeiro"
        description="Receitas, despesas, contas a receber, fluxo de caixa e pagamentos parciais."
        action={
          <div className="flex flex-wrap gap-2">
            {receiptShortcut ? <Button variant="secondary" type="button" onClick={() => onOpenReceipt(receiptShortcut)}><Paperclip size={16} /> {pendingReceipts ? 'Anexar comprovante' : 'Comprovantes'}</Button> : null}
            <Button type="button" onClick={() => onOpenPayment()}><Plus size={16} /> Receita</Button>
            <Button variant="secondary" type="button" onClick={() => onOpenExpense()}><Plus size={16} /> Despesa</Button>
            <Button variant="secondary" type="button" onClick={() => onOpenBankTransfer()}><ArrowRightLeft size={16} /> Transferir</Button>
            <Button variant="secondary" type="button" onClick={exportFinancialCsv}><Download size={16} /> Exportar CSV</Button>
          </div>
        }
      />
      <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div><h2 className="flex items-center gap-2 text-sm font-black text-gray-950"><Wallet className="text-amber-600" size={17} /> Posição financeira acumulada</h2><p className="mt-0.5 text-xs text-gray-500">Saldos atuais e todos os compromissos em aberto; use o Dashboard abaixo para analisar períodos.</p></div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">{receivableProgress.toFixed(0)}% recebido</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <article className="relative overflow-hidden rounded-xl border border-amber-200 bg-amber-50 p-4 xl:col-span-4">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-200/50" />
            <div className="relative"><p className="text-xs font-black uppercase tracking-wide text-amber-800">Disponível hoje</p><p className="mt-2 text-3xl font-black tracking-tight text-gray-950">{formatCurrency(currentBalance)}</p><p className="mt-2 text-xs text-gray-600">Saldo consolidado das suas contas bancárias.</p></div>
          </article>
          <article className="rounded-xl border border-gray-200 bg-gray-50 p-4 xl:col-span-3">
            <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wide text-gray-500">Depois de receber</p><p className="mt-2 text-2xl font-black text-gray-950">{formatCurrency(projectedBalance)}</p></div><TrendingUp className="text-amber-600" size={20} /></div>
            <p className="mt-2 text-xs text-gray-500">Inclui {formatCurrency(pendingTotal)} pendentes.</p>
          </article>
          <article className="rounded-xl border border-gray-200 p-4 xl:col-span-2">
            <p className="text-xs font-black uppercase tracking-wide text-gray-500">Recebido acumulado</p><p className="mt-2 text-xl font-black text-emerald-600">{formatCurrency(receivedTotal)}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(receivableProgress, 100)}%` }} /></div>
          </article>
          <article className="rounded-xl border border-gray-200 p-4 xl:col-span-3">
            <p className="text-xs font-black uppercase tracking-wide text-gray-500">Ainda falta receber</p><p className="mt-2 text-xl font-black text-amber-600">{formatCurrency(pendingTotal)}</p><p className={`mt-2 text-xs font-bold ${overdueTotal > 0 ? 'text-red-600' : 'text-gray-500'}`}>{overdueTotal > 0 ? `${formatCurrency(overdueTotal)} já vencidos` : 'Nenhum valor vencido'}</p>
          </article>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm">
          <span className="text-gray-600">Contas a pagar: <strong className="text-gray-950">{formatCurrency(pendingExpenseTotal)}</strong></span>
          <span className="text-gray-600">Projeção líquida: <strong className={projectedNetBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(projectedNetBalance)}</strong></span>
        </div>
      </section>
      {pendingReceipts ? <button className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-bold text-amber-800" type="button" onClick={() => receiptShortcut && onOpenReceipt(receiptShortcut)}><span>{pendingReceipts} comprovante(s) pendente(s) de anexação ou conferência.</span><span className="whitespace-nowrap underline">Anexar agora</span></button> : null}
      <div className="flex flex-wrap gap-2">
        {(['dashboard', 'receitas', 'despesas', 'receber', 'fluxo', 'contas', 'arquivados'] as const).map((tab) => (
          <Button key={tab} variant={financeTab === tab ? 'primary' : 'secondary'} type="button" onClick={() => onFinanceTabChange(tab)}>
            {tab === 'dashboard' ? 'Dashboard' : tab === 'receber' ? 'contas a receber' : tab === 'contas' ? 'contas bancárias' : tab}
          </Button>
        ))}
      </div>
      {financeTab === 'dashboard' ? (
        <FinancialDashboard state={state} />
      ) : financeTab === 'fluxo' ? (
        <Panel title="Fluxo de caixa">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="faturamento" name="Recebido" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      ) : financeTab === 'contas' ? (
        <BankAccountsPanel state={state} onCreate={onOpenBankAccount} onEdit={onOpenBankAccount} onDelete={onDeleteBankAccount} onTransfer={onOpenBankTransfer} onDeleteTransfer={onDeleteBankTransfer} />
      ) : (
        <FinancialTable tab={financeTab} state={state} onOpenReceipt={onOpenReceipt} onOpenPayment={onOpenPayment} onOpenExpense={onOpenExpense} onArchiveRecord={onArchiveRecord} onDeleteRecord={onDeleteRecord} onUpdatePaymentStatus={onUpdatePaymentStatus} onReversePayment={onReversePayment} />
      )}
    </div>
  )
}

type FinancialPeriodSnapshot = {
  received: number
  pending: number
  expenses: number
  result: number
  overdue: number
  payments: Payment[]
  expenseItems: Expense[]
  directCosts: number
  operatingExpenses: number
  taxes: number
  grossProfit: number
}

function FinancialDashboard({ state }: { state: AppState }) {
  const [reportPeriod, setReportPeriod] = useState<PeriodPreset>('month')
  const [comparisonPeriod, setComparisonPeriod] = useState<PeriodPreset>('last30')
  const [reportRegime, setReportRegime] = useState<AccountingRegime>('cash')
  const [drilldown, setDrilldown] = useState<'all' | 'received' | 'pending' | 'expenses'>('all')

  const snapshotFor = (preset: PeriodPreset): FinancialPeriodSnapshot => {
    const metrics = calculateDashboardMetrics(state, preset, reportRegime)
    const { start, end } = getPeriodRange(preset)
    const inRange = (value?: string) => {
      if (!value) return false
      const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
      return date >= start && date <= end
    }
    const payments = state.payments.filter((payment) => !payment.archivedAt && !payment.deletedAt && !['Cancelada', 'Reembolsada'].includes(payment.status))
    const receivedItems = payments.filter((payment) => payment.status === 'Recebida' && inRange(payment.paidAt))
    const pendingItems = payments.filter((payment) => payment.status !== 'Recebida' && inRange(payment.dueDate))
    const expenseItems = state.expenses.filter((expense) =>
      isOfficialExpense(expense) && (reportRegime === 'cash' ? isPaidExpense(expense) && inRange(expense.paidAt) : inRange(expense.expenseDate)),
    )
    const received = metrics.revenue
    const pending = pendingItems.reduce((total, payment) => total + payment.amount, 0)
    const expenses = metrics.expenses
    return {
      received,
      pending,
      expenses,
      result: received - expenses,
      overdue: pendingItems.filter(isPaymentOverdue).reduce((total, payment) => total + payment.amount, 0),
      payments: [...receivedItems, ...pendingItems],
      expenseItems,
      directCosts: metrics.directCosts,
      operatingExpenses: metrics.operatingExpenses,
      taxes: metrics.taxes,
      grossProfit: metrics.grossProfit,
    }
  }

  const current = snapshotFor(reportPeriod)
  const comparison = snapshotFor(comparisonPeriod)
  const forecast = getFinancialForecast(state)
  const periodLabel = periodOptions.find((option) => option.value === reportPeriod)?.label || reportPeriod
  const comparisonLabel = periodOptions.find((option) => option.value === comparisonPeriod)?.label || comparisonPeriod
  const variation = (value: number, previous: number) => previous === 0 ? value === 0 ? 0 : 100 : ((value - previous) / Math.abs(previous)) * 100
  const comparisonData = [
    { metric: 'Recebido', atual: current.received, comparacao: comparison.received },
    { metric: 'Despesas', atual: current.expenses, comparacao: comparison.expenses },
    { metric: 'Resultado', atual: current.result, comparacao: comparison.result },
    { metric: 'Pendente', atual: current.pending, comparacao: comparison.pending },
  ]
  const expenseBreakdown = Array.from(current.expenseItems.reduce((groups, expense) => {
    groups.set(expense.category || expense.expenseType, (groups.get(expense.category || expense.expenseType) || 0) + expense.amount)
    return groups
  }, new Map<string, number>())).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total).slice(0, 6)
  const reportRows = [
    ...current.payments.map((payment) => ({ id: `payment-${payment.id}`, date: payment.paidAt || payment.dueDate, type: payment.paymentType === 'Reembolso' ? 'Estorno' : payment.status === 'Recebida' ? 'Receita recebida' : 'A receber', description: payment.paymentType, status: payment.status, value: payment.paymentType === 'Reembolso' ? -payment.amount : payment.amount })),
    ...current.expenseItems.map((expense) => ({ id: `expense-${expense.id}`, date: expense.paidAt || expense.expenseDate, type: 'Despesa', description: expense.description, status: expense.status, value: -expense.amount })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const visibleReportRows = reportRows.filter((row) => drilldown === 'all' || (drilldown === 'received' ? ['Receita recebida', 'Estorno'].includes(row.type) : drilldown === 'pending' ? row.type === 'A receber' : row.type === 'Despesa'))

  const exportReport = () => downloadCsv(`relatorio-financeiro-${reportPeriod}-${dateInput()}.csv`, visibleReportRows.map((row) => ({ Data: formatDate(row.date), Tipo: row.type, Descricao: row.description, Status: row.status, Valor: row.value })))
  const Delta = ({ value, previous, inverse = false }: { value: number; previous: number; inverse?: boolean }) => {
    const delta = variation(value, previous)
    const positive = inverse ? delta <= 0 : delta >= 0
    return <span className={`text-xs font-black ${positive ? 'text-emerald-600' : 'text-red-600'}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>
  }

  return (
    <div className="space-y-4">
      <Panel title="Dashboard por período" action={<Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={exportReport}><Download size={14} /> Exportar relatório</Button>}>
        <div className="grid gap-3 md:grid-cols-3">
          <InputField label="Período principal"><select className="field-input" value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value as PeriodPreset)}>{periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></InputField>
          <InputField label="Comparar com"><select className="field-input" value={comparisonPeriod} onChange={(event) => setComparisonPeriod(event.target.value as PeriodPreset)}>{periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></InputField>
          <InputField label="Regime"><select className="field-input" value={reportRegime} onChange={(event) => setReportRegime(event.target.value as AccountingRegime)}><option value="cash">Caixa (quando pagou/recebeu)</option><option value="accrual">Competência (quando ocorreu)</option></select></InputField>
        </div>
        <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">Comparando <strong className="text-gray-800">{periodLabel}</strong> com <strong className="text-gray-800">{comparisonLabel}</strong>.</p>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<DollarSign size={19} />} label="Recebido no período" value={formatCurrency(current.received)} tone="positive" detail={<span className="flex items-center justify-between gap-2">Comparativo <Delta value={current.received} previous={comparison.received} /></span>} />
        <MetricCard icon={<AlertTriangle size={19} />} label="Despesas no período" value={formatCurrency(current.expenses)} tone="danger" detail={<span className="flex items-center justify-between gap-2">Comparativo <Delta inverse value={current.expenses} previous={comparison.expenses} /></span>} />
        <MetricCard icon={<TrendingUp size={19} />} label="Resultado do período" value={formatCurrency(current.result)} tone={current.result >= 0 ? 'positive' : 'danger'} detail={<span className="flex items-center justify-between gap-2">Comparativo <Delta value={current.result} previous={comparison.result} /></span>} />
        <MetricCard icon={<Clock size={19} />} label="A receber no período" value={formatCurrency(current.pending)} tone="warning" detail={`${formatCurrency(current.overdue)} vencidos`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Comparação dos períodos">
          <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparisonData}><CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" /><XAxis dataKey="metric" /><YAxis /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Legend /><Bar dataKey="atual" name={periodLabel} fill="#d8a500" radius={[5, 5, 0, 0]} /><Bar dataKey="comparacao" name={comparisonLabel} fill="#64748b" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Despesas por categoria">
          <div className="space-y-3">{expenseBreakdown.map((item) => { const share = current.expenses > 0 ? item.total / current.expenses * 100 : 0; return <div key={item.category}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-bold text-gray-700">{item.category}</span><strong className="whitespace-nowrap text-gray-950">{formatCurrency(item.total)}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-red-400" style={{ width: `${share}%` }} /></div></div> })}{!expenseBreakdown.length ? <p className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">Sem despesas no período selecionado.</p> : null}</div>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title={`DRE simplificada · ${periodLabel}`}>
          <div className="space-y-2 text-sm">
            {[['Receita bruta', current.received], ['(-) Custos diretos', -current.directCosts], ['Lucro bruto', current.grossProfit], ['(-) Despesas operacionais', -current.operatingExpenses], ['(-) Impostos', -current.taxes], ['Resultado líquido', current.result]].map(([label, value], index) => <div key={String(label)} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${index === 2 || index === 5 ? 'bg-gray-100 font-black' : 'border-b border-gray-100'}`}><span>{label}</span><strong className={Number(value) < 0 ? 'text-red-600' : 'text-gray-950'}>{formatCurrency(Number(value))}</strong></div>)}
          </div>
        </Panel>
        <Panel title="Fluxo de caixa previsto · 90 dias" action={<span className={`text-xs font-black ${forecast.projectedBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>Saldo projetado {formatCurrency(forecast.projectedBalance)}</span>}>
          <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Faixa</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead><tbody>{forecast.buckets.map((bucket) => <tr key={bucket.label}><td><strong>{bucket.label}</strong><span className="ml-2 text-xs text-gray-400">{bucket.items.length} lançamento(s)</span></td><td className="text-emerald-600">{formatCurrency(bucket.inflow)}</td><td className="text-red-600">{formatCurrency(bucket.outflow)}</td><td><strong className={bucket.net < 0 ? 'text-red-600' : 'text-emerald-600'}>{formatCurrency(bucket.net)}</strong></td></tr>)}</tbody></table></div>
          <p className="mt-3 text-xs text-gray-500">Inclui contas em aberto e ocorrências futuras calculadas a partir das despesas recorrentes.</p>
        </Panel>
      </div>
      <Panel title={`Relatório detalhado · ${periodLabel}`} action={<span className="text-xs font-bold text-gray-500">{visibleReportRows.length} lançamento(s)</span>}>
        <div className="mb-3 flex flex-wrap gap-2">{([['all', 'Todos'], ['received', 'Recebidos'], ['pending', 'A receber'], ['expenses', 'Despesas']] as const).map(([value, label]) => <Button className="min-h-9 px-3 py-1 text-xs" key={value} variant={drilldown === value ? 'primary' : 'secondary'} type="button" onClick={() => setDrilldown(value)}>{label}</Button>)}</div>
        <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Status</th><th>Valor</th></tr></thead><tbody>{visibleReportRows.map((row) => <tr key={row.id}><td data-label="Data">{formatDate(row.date)}</td><td data-label="Tipo"><StatusBadge>{row.type}</StatusBadge></td><td data-label="Descrição">{row.description}</td><td data-label="Status">{row.status}</td><td data-label="Valor"><strong className={row.value >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(row.value)}</strong></td></tr>)}</tbody></table>{!visibleReportRows.length ? <p className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">Nenhum lançamento encontrado neste filtro.</p> : null}</div>
      </Panel>
    </div>
  )
}

function BankAccountsPanel({ state, onCreate, onEdit, onDelete, onTransfer, onDeleteTransfer }: {
  state: AppState
  onCreate: (account?: BankAccount) => void
  onEdit: (account: BankAccount) => void
  onDelete: (account: BankAccount) => void
  onTransfer: (transfer?: BankTransfer) => void
  onDeleteTransfer: (transfer: BankTransfer) => void
}) {
  const accounts = [...state.bankAccounts].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const transfers = [...state.bankTransfers].sort((a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime())
  const activeAccounts = accounts.filter((account) => account.active)
  const transferVolume = transfers.reduce((total, transfer) => total + transfer.amount, 0)
  const pendingReceivables = state.payments.filter((payment) => !payment.archivedAt && !payment.deletedAt && !['Recebida', 'Cancelada', 'Reembolsada'].includes(payment.status)).reduce((total, payment) => total + payment.amount, 0)
  const consolidatedBalance = getTotalBankBalance(state)

  const getLastMovementAt = (accountId: string) => {
    const movementDates = [
      ...state.payments.filter((item) => item.bankAccountId === accountId && item.status === 'Recebida' && !item.deletedAt).map((item) => item.paidAt),
      ...state.expenses.filter((item) => item.bankAccountId === accountId && isPaidExpense(item) && !item.deletedAt).map((item) => item.paidAt),
      ...state.bankTransfers.filter((item) => item.fromAccountId === accountId || item.toAccountId === accountId).map((item) => item.transferredAt),
    ].filter(Boolean) as string[]

    if (!movementDates.length) return ''
    return [...movementDates].sort((a, b) => b.localeCompare(a))[0]
  }

  return (
    <div className="space-y-4">
      <Panel title="Contas bancárias" action={<div className="flex flex-wrap gap-2"><Button variant="secondary" type="button" onClick={() => onTransfer()}><ArrowRightLeft size={16} /> Transferir</Button><Button type="button" onClick={() => onCreate()}><Plus size={16} /> Nova conta</Button></div>}>
        <div className="mb-4 grid gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-gray-500">Saldo consolidado</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-gray-950">{formatCurrency(consolidatedBalance)}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">O saldo consolida valor inicial, receitas recebidas, despesas pagas e transferências entre contas.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[30rem]">
            <SmallStat label="Contas ativas" value={String(activeAccounts.length)} />
            <SmallStat label="A receber" value={formatCurrency(pendingReceivables)} />
            <SmallStat label="Saldo após receber" value={formatCurrency(consolidatedBalance + pendingReceivables)} />
            <SmallStat label="Transferências" value={`${transfers.length} · ${formatCurrency(transferVolume)}`} />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {accounts.map((account) => {
            const balance = getBankAccountBalance(state, account)
            const movementCount = state.payments.filter((item) => item.bankAccountId === account.id && item.status === 'Recebida' && !item.deletedAt).length
              + state.expenses.filter((item) => item.bankAccountId === account.id && isPaidExpense(item) && !item.deletedAt).length
              + state.bankTransfers.filter((item) => item.fromAccountId === account.id || item.toAccountId === account.id).length
            const lastMovementAt = getLastMovementAt(account.id)
            const reconciliationDifference = account.statementBalance === undefined ? undefined : account.statementBalance - balance
            return (
              <article key={account.id} className="finance-bank-card dashboard-list-card rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-black tracking-tight text-gray-950">{account.name}</h3>
                      <StatusBadge>{account.active ? 'Ativa' : 'Inativa'}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{account.bankName} · {account.accountType}</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
                    <Landmark size={18} />
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Saldo atual</p>
                    <p className={`mt-1 text-3xl font-black tracking-tight ${balance < 0 ? 'text-red-600' : 'text-gray-950'}`}>{formatCurrency(balance)}</p>
                  </div>
                  <div className="text-sm text-gray-500 sm:text-right">
                    <p>{movementCount} movimentação(ões)</p>
                    <p>Inicial {formatCurrency(account.openingBalance)}</p>
                  </div>
                </div>
                {lastMovementAt ? <p className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">Última movimentação: <strong className="text-gray-950">{formatDateTime(lastMovementAt)}</strong></p> : null}
                {reconciliationDifference !== undefined ? <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${Math.abs(reconciliationDifference) < 0.01 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}><strong>{Math.abs(reconciliationDifference) < 0.01 ? 'Conta conciliada' : `Diferença de ${formatCurrency(reconciliationDifference)}`}</strong><span className="ml-1">· extrato {formatCurrency(account.statementBalance || 0)}{account.reconciledAt ? ` em ${formatDate(account.reconciledAt)}` : ''}</span></div> : null}
                {account.notes ? <p className="mt-3 rounded-xl border border-dashed border-gray-200 bg-white/70 px-3 py-2 text-xs leading-5 text-gray-500">{account.notes}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-3">
                  <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onEdit(account)}><Pencil size={14} /> Editar</Button>
                  <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onTransfer()}><ArrowRightLeft size={14} /> Transferir</Button>
                  <IconActionButton label="Excluir conta" icon={<Trash2 size={15} />} tone="danger" onClick={() => onDelete(account)} />
                </div>
              </article>
            )
          })}
        </div>
        {!accounts.length ? <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center"><Landmark className="mx-auto text-gray-400" size={28} /><h3 className="mt-3 font-black text-gray-950">Cadastre sua primeira conta</h3><p className="mt-1 text-sm text-gray-500">Use uma conta para acompanhar saldos, recebimentos, despesas e transferências.</p><Button className="mt-4" type="button" onClick={() => onCreate()}><Plus size={16} /> Criar conta bancária</Button></div> : null}
      </Panel>
      <Panel title="Transferências entre contas">
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <SmallStat label="Transferências" value={String(transfers.length)} />
          <SmallStat label="Volume transferido" value={formatCurrency(transferVolume)} />
          <SmallStat label="Saldo consolidado" value={formatCurrency(getTotalBankBalance(state))} />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Data</th><th>Origem</th><th>Destino</th><th>Descrição</th><th>Valor</th><th>Ações</th></tr></thead>
            <tbody>{transfers.map((transfer) => <tr key={transfer.id}><td data-label="Data">{formatDateTime(transfer.transferredAt)}</td><td data-label="Origem">{state.bankAccounts.find((account) => account.id === transfer.fromAccountId)?.name || '-'}</td><td data-label="Destino">{state.bankAccounts.find((account) => account.id === transfer.toAccountId)?.name || '-'}</td><td data-label="Descrição">{transfer.description}</td><td data-label="Valor"><strong>{formatCurrency(transfer.amount)}</strong></td><td data-label="Ações"><div className="flex gap-1"><IconActionButton label="Editar transferência" icon={<Pencil size={15} />} onClick={() => onTransfer(transfer)} /><IconActionButton label="Excluir transferência" icon={<Trash2 size={15} />} tone="danger" onClick={() => onDeleteTransfer(transfer)} /></div></td></tr>)}</tbody>
          </table>
          {!transfers.length ? <p className="rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-500">Nenhuma transferência registrada.</p> : null}
        </div>
      </Panel>
    </div>
  )
}

function FinancialTable({
  tab,
  state,
  onOpenReceipt,
  onOpenPayment,
  onOpenExpense,
  onArchiveRecord,
  onDeleteRecord,
  onUpdatePaymentStatus,
  onReversePayment,
}: {
  tab: 'receitas' | 'despesas' | 'receber' | 'arquivados'
  state: AppState
  onOpenReceipt: (payment: Payment) => void
  onOpenPayment: (payment?: Payment) => void
  onOpenExpense: (expense?: Expense) => void
  onArchiveRecord: (kind: 'payment' | 'expense', id: string, archived: boolean) => void
  onDeleteRecord: (kind: 'payment' | 'expense', record: Payment | Expense) => void
  onUpdatePaymentStatus: (payment: Payment, status: Payment['status']) => void
  onReversePayment: (payment: Payment) => void
}) {
  const [search, setSearch] = useState('')
  const [expenseScope, setExpenseScope] = useState<'all' | 'single' | 'recurring'>('all')
  const [expenseDueScope, setExpenseDueScope] = useState<'all' | 'overdue' | 'next7'>('all')
  const [paymentScope, setPaymentScope] = useState<'all' | 'overdue' | 'today' | 'next7'>('all')
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; fileName: string } | null>(null)
  const matchesFinancial = (text: string) => !search.trim() || text.toLowerCase().includes(search.trim().toLowerCase())
  if (tab === 'arquivados') {
    const archivedPayments = state.payments.filter((item) => item.archivedAt || item.deletedAt)
    const archivedExpenses = state.expenses.filter((item) => item.archivedAt || item.deletedAt)
    return <Panel title="Arquivados e excluídos logicamente"><div className="space-y-3">{[...archivedPayments.map((record) => ({ kind: 'payment' as const, record, title: record.paymentType, value: record.amount })), ...archivedExpenses.map((record) => ({ kind: 'expense' as const, record, title: record.description, value: record.amount }))].map(({ kind, record, title, value }) => <article key={`${kind}-${record.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"><div><strong>{title}</strong><p className="text-sm text-gray-500">{formatCurrency(value)} · {record.deletedAt ? `Excluído: ${record.deletionReason || 'sem motivo'}` : 'Arquivado'}</p></div><Button variant="secondary" type="button" onClick={() => onArchiveRecord(kind, record.id, false)}>Restaurar</Button></article>)}{!archivedPayments.length && !archivedExpenses.length ? <p className="rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-500">Nenhum lançamento arquivado.</p> : null}</div></Panel>
  }
  if (tab === 'despesas') {
    const expenses = state.expenses.filter((expense) => {
      if (expense.archivedAt || expense.deletedAt || (expenseScope !== 'all' && (expenseScope === 'recurring' ? !expense.recurring : expense.recurring))) return false
      if (!matchesFinancial(`${expense.description} ${expense.category} ${expense.supplier} ${expense.recurrenceFrequency || ''}`)) return false
      if (expenseDueScope === 'overdue') return isExpenseOverdue(expense)
      if (expenseDueScope === 'next7') { const days = daysUntil(expense.dueDate); return !isPaidExpense(expense) && days >= 0 && days <= 7 }
      return true
    }).sort((a, b) => (a.dueDate || a.expenseDate).localeCompare(b.dueDate || b.expenseDate))
    const visibleExpenses = state.expenses.filter((expense) => !expense.archivedAt && !expense.deletedAt)
    const uniqueTotal = visibleExpenses.filter((expense) => !expense.recurring && isOfficialExpense(expense)).reduce((total, expense) => total + expense.amount, 0)
    const recurringMonthly = visibleExpenses.reduce((total, expense) => total + getMonthlyRecurringExpenseAmount(expense), 0)
    return (
      <Panel title="Despesas">
        <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input className="field-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar despesas…" />
          <div className="flex flex-wrap gap-2">{([['all', 'Todas'], ['single', 'Únicas'], ['recurring', 'Recorrentes']] as const).map(([value, label]) => <Button className="min-h-10 px-3 py-1 text-xs" key={value} variant={expenseScope === value ? 'primary' : 'secondary'} type="button" onClick={() => setExpenseScope(value)}>{label}</Button>)}</div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">{([['all', 'Todos os vencimentos'], ['overdue', 'Vencidas'], ['next7', 'Próximos 7 dias']] as const).map(([value, label]) => <Button className="min-h-9 px-3 py-1 text-xs" key={value} variant={expenseDueScope === value ? 'primary' : 'secondary'} type="button" onClick={() => setExpenseDueScope(value)}>{label}</Button>)}</div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2"><SmallStat label="Despesas únicas registradas" value={formatCurrency(uniqueTotal)} /><SmallStat label="Compromisso recorrente mensal" value={formatCurrency(recurringMonthly)} /></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Data</th><th>Recorrência</th><th>Conta</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td data-label="Descrição">{expense.description}</td>
                  <td data-label="Categoria">{expense.category}</td>
                  <td data-label="Tipo">{expense.expenseType}</td>
                  <td data-label="Valor">{formatCurrency(expense.amount)}</td>
                  <td data-label="Data">{formatDate(expense.expenseDate)}</td>
                  <td data-label="Recorrência">{expense.recurring ? <span className="text-xs font-bold text-gray-700">{expense.recurrenceFrequency || 'Mensal'}</span> : <span className="text-xs text-gray-500">Única</span>}</td>
                  <td data-label="Conta">{state.bankAccounts.find((account) => account.id === expense.bankAccountId)?.name || expense.account || '-'}</td>
                  <td data-label="Situação"><StatusBadge>{isExpenseOverdue(expense) ? 'Vencida' : expense.status}</StatusBadge></td>
                  <td data-label="Ações"><div className="flex flex-wrap gap-1"><IconActionButton label="Editar despesa" icon={<Pencil size={15} />} onClick={() => onOpenExpense(expense)} /><Button className="min-h-9 px-2 text-xs" variant="ghost" type="button" onClick={() => onArchiveRecord('expense', expense.id, true)}>Arquivar</Button><IconActionButton label="Excluir despesa" icon={<Trash2 size={15} />} tone="danger" onClick={() => onDeleteRecord('expense', expense)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    )
  }

  const payments = state.payments.filter((payment) => {
    if (payment.archivedAt || payment.deletedAt || (tab === 'receber' && payment.status === 'Recebida')) return false
    if (!matchesFinancial(`${payment.paymentType} ${payment.transactionNumber || ''} ${state.clients.find((client) => client.id === payment.clientId)?.companyName || ''}`)) return false
    if (tab !== 'receber' || paymentScope === 'all') return true
    const days = daysUntil(payment.dueDate)
    if (paymentScope === 'overdue') return isPaymentOverdue(payment)
    if (paymentScope === 'today') return days === 0
    return days >= 1 && days <= 7
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return (
    <>
    <Panel title={tab === 'receber' ? 'Contas a receber' : 'Receitas e pagamentos'}>
      <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto]"><input className="field-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar cliente, tipo ou transação…" />{tab === 'receber' ? <div className="flex flex-wrap gap-2">{([['all', 'Todas'], ['overdue', 'Vencidas'], ['today', 'Hoje'], ['next7', 'Próximos 7 dias']] as const).map(([value, label]) => <Button className="min-h-10 px-3 py-1 text-xs" key={value} variant={paymentScope === value ? 'primary' : 'secondary'} type="button" onClick={() => setPaymentScope(value)}>{label}</Button>)}</div> : null}</div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Cliente</th><th>Projeto</th><th>Tipo</th><th>Valor</th><th>Vencimento</th><th>Recebimento</th><th>Conta</th><th>Status</th><th>Comprovante</th><th>Ações</th></tr></thead>
          <tbody>
            {payments.map((payment) => {
              const client = state.clients.find((item) => item.id === payment.clientId)
              const project = state.projects.find((item) => item.id === payment.projectId)
              return (
                <tr key={payment.id}>
                  <td data-label="Cliente">{client?.companyName ?? '-'}</td>
                  <td data-label="Projeto">{project?.projectCode ?? '-'}</td>
                  <td data-label="Tipo">{payment.paymentType}</td>
                  <td data-label="Valor">{formatCurrency(payment.amount)}</td>
                  <td data-label="Vencimento">{formatDate(payment.dueDate)}</td>
                  <td data-label="Recebimento">{formatDate(payment.paidAt)}</td>
                  <td data-label="Conta">{state.bankAccounts.find((account) => account.id === payment.bankAccountId)?.name || payment.account || '-'}</td>
                  <td data-label="Status"><StatusBadge>{isPaymentOverdue(payment) ? 'Vencida' : payment.status}</StatusBadge></td>
                  <td data-label="Comprovante">
                    <div className="flex flex-wrap gap-2">
                      {payment.receiptUrl ? (
                        <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => setReceiptPreview({ url: payment.receiptUrl || '', fileName: `Comprovante - ${payment.paymentType}` })}>
                          <Eye size={14} /> Visualizar
                        </Button>
                      ) : null}
                      <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onOpenReceipt(payment)}>
                        {payment.receiptUrl ? 'Trocar' : 'Anexar'}
                      </Button>
                    </div>
                  </td>
                  <td data-label="Ações"><div className="flex flex-wrap gap-1">{tab === 'receber' && (client?.whatsapp || client?.phone) ? <a className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-gray-200 px-2 text-xs font-bold text-gray-700" href={`${whatsappLink(client.whatsapp || client.phone)}?text=${encodeURIComponent(`Olá! Passando para lembrar do pagamento de ${formatCurrency(payment.amount)}, previsto para ${formatDate(payment.dueDate)}.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Cobrar</a> : null}<IconActionButton label="Editar lançamento" icon={<Pencil size={15} />} onClick={() => onOpenPayment(payment)} />{payment.status !== 'Recebida' ? <Button className="min-h-9 px-2 text-xs" variant="ghost" type="button" onClick={() => onUpdatePaymentStatus(payment, 'Recebida')}>Marcar pago</Button> : <><Button className="min-h-9 px-2 text-xs" variant="ghost" type="button" onClick={() => onUpdatePaymentStatus(payment, 'Pendente')}>Marcar pendente</Button>{payment.paymentType !== 'Reembolso' && !payment.reversedByPaymentId ? <Button className="min-h-9 px-2 text-xs text-red-600" variant="ghost" type="button" onClick={() => onReversePayment(payment)}>Estornar</Button> : null}</>}<Button className="min-h-9 px-2 text-xs" variant="ghost" type="button" onClick={() => onArchiveRecord('payment', payment.id, true)}>Arquivar</Button><IconActionButton label="Excluir lançamento" icon={<Trash2 size={15} />} tone="danger" onClick={() => onDeleteRecord('payment', payment)} /></div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
    {receiptPreview ? <ReceiptPreviewModal url={receiptPreview.url} fileName={receiptPreview.fileName} onClose={() => setReceiptPreview(null)} /> : null}
    </>
  )
}

function ReceiptPreviewModal({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  const mode = getFilePreviewMode(url, fileName)
  return (
    <Modal title={fileName} size="lg" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => downloadUrl(url, fileName)}><Download size={16} /> Baixar comprovante</Button>
          <Button variant="secondary" type="button" onClick={() => openUrlInNewTab(url)}><ArrowRight size={16} /> Abrir em nova aba</Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          {mode === 'image' ? (
            <img className="max-h-[70vh] w-full object-contain" src={url} alt={fileName} />
          ) : mode === 'pdf' ? (
            <iframe className="h-[70vh] w-full bg-white" src={getBrowserSafeFileUrl(url)} title={fileName} />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-gray-600">Este link não permite visualização dentro do sistema.</p>
              <Button type="button" onClick={() => openUrlInNewTab(url)}><ArrowRight size={16} /> Abrir arquivo</Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ProposalGenerator({
  editingQuote,
  editingQuoteItems,
  state,
  initialClientId,
  initialLeadId,
  onSubmit,
  onCancel,
}: {
  editingQuote?: Quote
  editingQuoteItems: QuoteItem[]
  state: AppState
  initialClientId: string
  initialLeadId: string
  onSubmit: (values: ProposalFormValues) => void
  onCancel: () => void
}) {
  const editNoteSections = editingQuote?.notes.split(/\n{2,}/).map((section) => section.trim()).filter(Boolean) ?? []
  const proposalPackageDescriptions = new Set(proposalPackages.map((proposalPackage) => proposalPackage.description))
  const editableNotes = editNoteSections.slice(1).filter((section) => !proposalPackageDescriptions.has(section)).join('\n\n')
  const initialItems = editingQuote
    ? editingQuoteItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    : [{ description: '', quantity: 1, unitPrice: 0 }]
  const initialTotal = editingQuote?.totalValue ?? 0
  const initialDepositPercentage = editingQuote && initialTotal > 0
    ? (editingQuote.depositValue / initialTotal) * 100
    : state.companySettings.defaultDepositPercentage
  const standardExpirationDate = addCalendarDays(editingQuote?.issueDate ?? dateInput(), 7)
  const [clientId, setClientId] = useState(editingQuote?.clientId || (initialLeadId ? '' : initialClientId || state.clients[0]?.id || ''))
  const [leadId, setLeadId] = useState(editingQuote?.leadId || initialLeadId || '')
  const [title, setTitle] = useState(editingQuote ? editNoteSections[0] || getQuoteTitle(editingQuote) : '')
  const [items, setItems] = useState<ProposalItemDraft[]>(initialItems.length ? initialItems : [{ description: '', quantity: 1, unitPrice: 0 }])
  const [discount, setDiscount] = useState(editingQuote?.discount ?? 0)
  const [showDiscount, setShowDiscount] = useState((editingQuote?.discount ?? 0) > 0)
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(Boolean(editingQuote && (editingQuote.discount || editingQuote.travelFee || editingQuote.urgencyFee || editableNotes)))
  const [travelFee, setTravelFee] = useState(editingQuote?.travelFee ?? 0)
  const [urgencyFee, setUrgencyFee] = useState(editingQuote?.urgencyFee ?? 0)
  const [depositPercentage, setDepositPercentage] = useState(initialDepositPercentage)
  const [expirationDate, setExpirationDate] = useState(editingQuote?.expirationDate ?? standardExpirationDate)
  const [validityChangeReason, setValidityChangeReason] = useState(editingQuote?.validityChangeReason ?? '')
  const [deliveryDeadline] = useState(editingQuote?.deliveryDeadline ?? dateInput(7))
  const [paymentTerms, setPaymentTerms] = useState(editingQuote?.paymentTerms ?? state.companySettings.paymentTerms)
  const [notes, setNotes] = useState(editingQuote ? editableNotes : '')
  const status: Quote['status'] = editingQuote?.status ?? 'Rascunho'
  const [error, setError] = useState('')

  const selectedClient = state.clients.find((client) => client.id === clientId)
  const selectedLead = state.leads.find((lead) => lead.id === leadId)
  const recipientName = selectedClient ? contactDisplayName(selectedClient) : selectedLead ? contactDisplayName(selectedLead) : '-'
  const recipientContact = selectedClient?.whatsapp || selectedClient?.phone || selectedLead?.whatsapp || selectedLead?.phone || '-'
  const recipientLocation = [selectedClient?.address || selectedLead?.address, selectedClient?.city || selectedLead?.city]
    .filter(Boolean)
    .join(' - ')
  const contactOptions = [
    ...state.leads.filter((lead) => !lead.archived && !lead.deletedAt).map((lead) => ({
      key: `lead:${lead.id}`,
      label: contactDisplayName(lead),
      detail: [lead.whatsapp || lead.phone || 'Sem telefone', lead.city || 'Sem cidade'].join(' • '),
    })),
    ...state.clients.map((client) => ({
      key: `client:${client.id}`,
      label: contactDisplayName(client),
      detail: [client.whatsapp || client.phone || 'Sem telefone', client.city || 'Sem cidade'].join(' • '),
    })),
  ]
  const recipientKey = leadId ? `lead:${leadId}` : clientId ? `client:${clientId}` : ''

  const chooseRecipient = (key: string) => {
    const [type, id] = key.split(':')
    if (type === 'lead') {
      setLeadId(id)
      setClientId('')
      return
    }
    if (type === 'client') {
      setClientId(id)
      setLeadId('')
      return
    }
    setLeadId('')
    setClientId('')
  }
  const serviceOptions = useMemo(() => getProposalServiceOptions(state), [state])
  const subtotal = items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0)
  const activeDiscount = showDiscount ? Number(discount || 0) : 0
  const total = Math.max(subtotal - activeDiscount + Number(travelFee || 0) + Number(urgencyFee || 0), 0)
  const deposit = total * (Number(depositPercentage || 0) / 100)
  const remaining = Math.max(total - deposit, 0)

  const updateItem = (index: number, patch: Partial<ProposalItemDraft>) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, ...patch }
          : item,
      ),
    )
  }

  const addItem = () => {
    setItems((current) => [...current, { description: '', quantity: 1, unitPrice: 0 }])
  }

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!clientId && !leadId) {
      setError('Selecione um contato para atrelar a proposta.')
      return
    }
    if (!title.trim()) {
      setError('Informe o título da proposta.')
      return
    }
    if (items.length === 0 || items.some((item) => !item.description.trim() || item.quantity <= 0)) {
      setError('Informe o serviço e a quantidade de cada item.')
      return
    }
    if (items.some((item) => item.unitPrice <= 0)) {
      setError('Digite manualmente um valor maior que zero para cada serviço.')
      return
    }
    if (depositPercentage < 0 || depositPercentage > 100) {
      setError('O percentual de sinal deve ficar entre 0 e 100.')
      return
    }
    if (expirationDate !== standardExpirationDate && !validityChangeReason.trim()) {
      setError('Informe a justificativa para uma validade diferente de 7 dias corridos.')
      return
    }

    onSubmit({
      quoteId: editingQuote?.id,
      clientId,
      leadId,
      title: title.trim(),
      packageId: customPackageId,
      items,
      discount: activeDiscount,
      travelFee,
      urgencyFee,
      depositPercentage,
      expirationDate,
      validityChangeReason: validityChangeReason.trim(),
      deliveryDeadline,
      paymentTerms,
      notes,
      status,
    })
  }

  return (
    <form className="proposal-form space-y-4" onSubmit={submit}>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <InputField label="Contato">
          <select className="field-input" value={recipientKey} onChange={(event) => chooseRecipient(event.target.value)}>
            <option value="">Selecione um contato</option>
            {contactOptions.map((contact) => <option key={contact.key} value={contact.key}>{contact.label} | {contact.detail}</option>)}
          </select>
        </InputField>
        <InputField label="Título">
          <input className="field-input" placeholder="Ex.: Filmagem aérea do imóvel" value={title} onChange={(event) => setTitle(event.target.value)} />
        </InputField>
      </div>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="text-sm font-black text-gray-950">Serviços e valores</h3><p className="mt-1 text-xs text-gray-500">Começa vazio. Digite os serviços e valores que desejar.</p></div>
          <Button className="min-h-9 px-3 py-1 text-xs" variant="secondary" type="button" onClick={addItem}><Plus size={15} /> Adicionar</Button>
        </div>
        <datalist id="proposal-service-options">{serviceOptions.map((service) => <option key={service} value={service} />)}</datalist>
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div key={index} className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_5rem_9rem_2.75rem]">
              <InputField label="Serviço"><input className="field-input" list="proposal-service-options" placeholder="Digite o serviço" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} /></InputField>
              <InputField label="Qtd."><input className="field-input text-center" min="1" type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></InputField>
              <InputField label="Valor unitário"><CurrencyInput value={item.unitPrice} onChange={(value) => updateItem(index, { unitPrice: value })} /></InputField>
              <button aria-label="Remover item" className="focus-ring flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-600" disabled={items.length === 1} type="button" onClick={() => removeItem(index)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <InputField label="Sinal (%)"><input className="field-input" max="100" min="0" type="number" value={depositPercentage} onChange={(event) => setDepositPercentage(Number(event.target.value))} /></InputField>
            <InputField label="Validade"><input className="field-input" type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} /></InputField>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <CalendarDays className="shrink-0 text-amber-700" size={18} />
            <div><p className="text-xs font-black uppercase text-amber-800">Prazo de entrega</p><p className="mt-0.5 text-sm font-bold text-gray-800">Até 7 dias corridos após a realização da captação.</p></div>
          </div>
          {expirationDate !== standardExpirationDate ? <InputField label="Motivo da validade diferente"><textarea className="field-input min-h-16" required value={validityChangeReason} onChange={(event) => setValidityChangeReason(event.target.value)} /></InputField> : null}

          <details className="group rounded-lg border border-gray-200 bg-white" open={additionalOptionsOpen} onToggle={(event) => setAdditionalOptionsOpen(event.currentTarget.open)}>
            <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm font-black text-gray-800 [&::-webkit-details-marker]:hidden"><span>Adicionais e observações</span><span className="text-xs text-gray-500 group-open:hidden">Abrir</span><span className="hidden text-xs text-gray-500 group-open:inline">Recolher</span></summary>
            <div className="grid gap-3 border-t border-gray-200 p-3 sm:grid-cols-3">
              {showDiscount ? <InputField label="Desconto"><div className="flex gap-2"><CurrencyInput value={discount} onChange={setDiscount} /><button aria-label="Remover desconto" className="h-11 w-11 shrink-0 rounded-lg border border-gray-200 text-gray-500" type="button" onClick={() => { setDiscount(0); setShowDiscount(false) }}>×</button></div></InputField> : <div className="flex items-end"><Button className="w-full" variant="secondary" type="button" onClick={() => setShowDiscount(true)}><Plus size={15} /> Desconto</Button></div>}
              <InputField label="Deslocamento"><CurrencyInput value={travelFee} onChange={setTravelFee} /></InputField>
              <InputField label="Urgência"><CurrencyInput value={urgencyFee} onChange={setUrgencyFee} /></InputField>
              <div className="sm:col-span-3"><InputField label="Condições de pagamento"><textarea className="field-input min-h-16" value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} /></InputField></div>
              <div className="sm:col-span-3"><InputField label="Observações e escopo"><textarea className="field-input min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} /></InputField></div>
            </div>
          </details>
        </div>

        <aside className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold uppercase text-gray-500">Resumo</p>
          <p className="mt-1 truncate text-sm font-black text-gray-950">{recipientName}</p>
          <p className="truncate text-xs text-gray-500">{recipientContact} · {recipientLocation || 'Local não informado'}</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><span className="text-gray-500">Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
            {activeDiscount > 0 ? <div className="flex justify-between gap-3"><span className="text-gray-500">Desconto</span><strong>- {formatCurrency(activeDiscount)}</strong></div> : null}
            {travelFee + urgencyFee > 0 ? <div className="flex justify-between gap-3"><span className="text-gray-500">Adicionais</span><strong>{formatCurrency(travelFee + urgencyFee)}</strong></div> : null}
            <div className="border-t border-gray-200 pt-3"><div className="flex justify-between gap-3 text-base"><span className="font-black">Total</span><strong>{formatCurrency(total)}</strong></div><div className="mt-2 flex justify-between gap-3"><span className="text-gray-500">Sinal</span><strong>{formatCurrency(deposit)}</strong></div><div className="mt-2 flex justify-between gap-3"><span className="text-gray-500">Restante</span><strong>{formatCurrency(remaining)}</strong></div></div>
          </div>
        </aside>
      </div>

      <FormActions onCancel={onCancel} submitLabel={editingQuote ? 'Salvar proposta' : 'Criar proposta'} />
    </form>
  )
}

function EquipmentPage({
  state,
  onCreate,
  onEdit,
  onDelete,
}: {
  state: AppState
  onCreate: () => void
  onEdit: (equipment: Equipment) => void
  onDelete: (equipment: Equipment) => void
}) {
  return (
    <div className="space-y-4">
      <PageToolbar
        title="Equipamentos"
        description="Inventário, estado, manutenção e itens disponíveis para operação."
        action={<Button type="button" onClick={onCreate}><Plus size={16} /> Novo equipamento</Button>}
      />
      {state.equipment.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <PackageCheck className="mx-auto text-gray-400" size={34} />
          <h3 className="mt-3 text-base font-black text-gray-950">Nenhum equipamento cadastrado</h3>
          <p className="mt-1 text-sm text-gray-500">Cadastre drones, baterias, cartões, filtros, câmeras e acessórios para controlar manutenção e disponibilidade.</p>
          <Button className="mt-4" type="button" onClick={onCreate}><Plus size={16} /> Cadastrar equipamento</Button>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.equipment.map((item) => (
          <article key={item.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-gray-500">{item.category}</p>
                <h3 className="text-lg font-black text-gray-950">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.brand} {item.model}</p>
                {item.serialNumber ? <p className="mt-1 text-xs font-bold text-gray-400">S/N {item.serialNumber}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex gap-1">
                  <IconActionButton label="Editar equipamento" icon={<Pencil size={15} />} onClick={() => onEdit(item)} />
                  <IconActionButton label="Excluir equipamento" icon={<Trash2 size={15} />} tone="danger" onClick={() => onDelete(item)} />
                </div>
                <StatusBadge>{item.active ? item.condition : 'Inativo'}</StatusBadge>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <SmallStat label="Compra" value={formatCurrency(item.purchaseValue)} />
              <SmallStat label="Próxima revisão" value={formatDate(item.nextMaintenanceDate)} />
            </dl>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <SmallStat label="Comprado em" value={item.purchaseDate ? formatDate(item.purchaseDate) : '-'} />
              <SmallStat label="Última revisão" value={item.lastMaintenanceDate ? formatDate(item.lastMaintenanceDate) : '-'} />
            </div>
            {item.notes ? <p className="mt-3 text-sm text-gray-600">{item.notes}</p> : null}
          </article>
        ))}
      </div>
    </div>
  )
}

function EquipmentForm({
  equipment,
  onSubmit,
  onCancel,
}: {
  equipment?: Equipment
  onSubmit: (values: EquipmentFormValues) => void
  onCancel: () => void
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EquipmentFormInput, unknown, EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: equipment?.name ?? '',
      category: equipment?.category ?? 'Drone',
      brand: equipment?.brand ?? '',
      model: equipment?.model ?? '',
      serialNumber: equipment?.serialNumber ?? '',
      purchaseDate: equipment?.purchaseDate ?? '',
      purchaseValue: equipment?.purchaseValue ?? 0,
      condition: equipment?.condition ?? 'Bom',
      lastMaintenanceDate: equipment?.lastMaintenanceDate ?? '',
      nextMaintenanceDate: equipment?.nextMaintenanceDate ?? '',
      notes: equipment?.notes ?? '',
      active: equipment?.active ?? true,
    },
  })
  const purchaseValue = Number(watch('purchaseValue') || 0)

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <InputField label="Nome do equipamento" error={getError(errors.name?.message)}>
        <input className="field-input" placeholder="DJI Mini 4 Pro" {...register('name')} />
      </InputField>
      <InputField label="Categoria" error={getError(errors.category?.message)}>
        <input className="field-input" placeholder="Drone, bateria, câmera, acessório..." {...register('category')} />
      </InputField>
      <InputField label="Marca" error={getError(errors.brand?.message)}>
        <input className="field-input" placeholder="DJI" {...register('brand')} />
      </InputField>
      <InputField label="Modelo" error={getError(errors.model?.message)}>
        <input className="field-input" placeholder="Mini 4 Pro" {...register('model')} />
      </InputField>
      <InputField label="Número de série" error={getError(errors.serialNumber?.message)}>
        <input className="field-input" {...register('serialNumber')} />
      </InputField>
      <InputField label="Condição" error={getError(errors.condition?.message)}>
        <Select options={equipmentConditions} register={register('condition')} />
      </InputField>
      <InputField label="Data da compra" error={getError(errors.purchaseDate?.message)}>
        <input className="field-input" type="date" {...register('purchaseDate')} />
      </InputField>
      <InputField label="Valor de compra" error={getError(errors.purchaseValue?.message)}>
        <input type="hidden" {...register('purchaseValue')} />
        <CurrencyInput
          value={purchaseValue}
          onChange={(nextValue) => setValue('purchaseValue', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </InputField>
      <InputField label="Última manutenção" error={getError(errors.lastMaintenanceDate?.message)}>
        <input className="field-input" type="date" {...register('lastMaintenanceDate')} />
      </InputField>
      <InputField label="Próxima manutenção" error={getError(errors.nextMaintenanceDate?.message)}>
        <input className="field-input" type="date" {...register('nextMaintenanceDate')} />
      </InputField>
      <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-bold text-gray-700">
        <input className="h-4 w-4 accent-[#d8a500]" type="checkbox" {...register('active')} />
        Equipamento ativo e disponível
      </label>
      <div className="md:col-span-2">
        <InputField label="Observações" error={getError(errors.notes?.message)}>
          <textarea className="field-input min-h-24" placeholder="Estado, acessórios vinculados, histórico de manutenção..." {...register('notes')} />
        </InputField>
      </div>
      <FormActions onCancel={onCancel} />
    </form>
  )
}

function UsersPage({
  currentUser,
  state,
  onOpenModal,
  onToggleActive,
  onResetPassword,
}: {
  currentUser: User
  state: AppState
  onOpenModal: (modal: ModalType) => void
  onToggleActive: (user: User) => void
  onResetPassword: (user: User) => void
}) {
  const canManageUsers = can(currentUser, 'manageUsers')

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Usuários e permissões"
        description="Criação interna de contas, perfis de acesso e proteção da conta principal."
        action={
          <Button disabled={!canManageUsers} type="button" onClick={() => onOpenModal('user')}>
            <Plus size={16} /> Novo usuário
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel title="Conta principal">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={22} />
              <div>
                <h3 className="font-black text-gray-950">Acesso total protegido</h3>
                <p className="mt-1 text-sm text-gray-700">
                  A conta {PRIMARY_OWNER.email} é a dona do sistema, não pode ser desativada e sempre mantém todas as permissões.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Usuários cadastrados">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil</th>
                  <th>Permissões</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {state.users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Usuário">
                      <div className="font-black text-gray-950">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      {user.isPrimaryOwner ? <div className="mt-1"><Tag>Conta principal</Tag></div> : null}
                    </td>
                    <td data-label="Perfil">{user.role}</td>
                    <td data-label="Permissões">{permissionSummary(user)}</td>
                    <td data-label="Status"><StatusBadge>{user.active ? 'Ativo' : 'Inativo'}</StatusBadge></td>
                    <td data-label="Ações">
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={!canManageUsers} variant="secondary" type="button" onClick={() => onResetPassword(user)}>
                          Redefinir senha
                        </Button>
                        <Button disabled={!canManageUsers || user.isPrimaryOwner} variant="ghost" type="button" onClick={() => onToggleActive(user)}>
                          {user.active ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Matriz de permissões">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {allPermissions.map((permission) => (
            <div key={permission} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="font-black text-gray-950">{permissionLabels[permission]}</p>
              <p className="mt-1 text-sm text-gray-500">
                {state.users.filter((user) => can(user, permission)).length} usuário(s) com acesso
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function ReportsPage({
  state,
  metrics,
  monthlySeries,
  leadSourceSeries,
  serviceSeries,
  period,
  regime,
}: {
  state: AppState
  metrics: ReturnType<typeof calculateDashboardMetrics>
  monthlySeries: ReturnType<typeof buildMonthlySeries>
  leadSourceSeries: ReturnType<typeof buildLeadSourceSeries>
  serviceSeries: ReturnType<typeof buildServiceSeries>
  period: PeriodPreset
  regime: AccountingRegime
}) {
  const { start: reportStart, end: reportEnd } = getPeriodRange(period)
  const isInReportPeriod = (value?: string) => {
    if (!value) return false
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
    return date >= reportStart && date <= reportEnd
  }
  const exportRows = () =>
    downloadCsv(
      'hero-drone-relatorio.csv',
      state.projects.filter((project) => isVisibleProject(project) && isInReportPeriod(project.deliveryDeadline || project.captureDate || project.createdAt)).map((project) => ({
        codigo: project.projectCode,
        projeto: project.name,
        cliente: projectClient(state, project)?.companyName ?? '',
        status: project.projectStatus,
        financeiro: project.financialStatus,
        valor: project.totalValue,
        recebido: getProjectPaidAmount(state, project.id),
        custos_diretos: getProjectDirectCosts(state, project.id),
      })),
    )

  const exportFinancialRows = () => {
    const rows: Array<Record<string, string | number>> = [
      ...state.payments.filter((payment) => !payment.deletedAt && !payment.archivedAt && !['Cancelada', 'Reembolsada'].includes(payment.status) && isInReportPeriod(regime === 'cash' ? payment.paidAt : payment.dueDate)).map((payment) => ({
        tipo: payment.paymentType === 'Reembolso' ? 'Estorno' : 'Receita',
        descricao: payment.paymentType,
        categoria: '',
        valor: payment.paymentType === 'Reembolso' ? -payment.amount : payment.amount,
        data: payment.paidAt || payment.dueDate,
        situacao: payment.status,
        recorrencia: '',
        conta: state.bankAccounts.find((account) => account.id === payment.bankAccountId)?.name || payment.account || '',
      })),
      ...state.expenses.filter((expense) => isOfficialExpense(expense) && isInReportPeriod(regime === 'cash' ? expense.paidAt : expense.expenseDate)).map((expense) => ({
        tipo: 'Despesa',
        descricao: expense.description,
        categoria: expense.category,
        valor: expense.amount,
        data: expense.paidAt || expense.expenseDate,
        situacao: expense.status,
        recorrencia: expense.recurring ? expense.recurrenceFrequency || 'Mensal' : '',
        conta: state.bankAccounts.find((account) => account.id === expense.bankAccountId)?.name || expense.account || '',
      })),
      ...state.bankTransfers.filter((transfer) => isInReportPeriod(transfer.transferredAt)).map((transfer) => ({
        tipo: 'Transferência',
        descricao: transfer.description,
        categoria: '',
        valor: transfer.amount,
        data: transfer.transferredAt,
        situacao: 'Concluída',
        recorrencia: '',
        conta: `${state.bankAccounts.find((account) => account.id === transfer.fromAccountId)?.name || ''} → ${state.bankAccounts.find((account) => account.id === transfer.toAccountId)?.name || ''}`,
      })),
    ]
    downloadCsv(`hero-drone-financeiro-${dateInput()}.csv`, rows)
  }

  const reportExpenses = state.expenses.filter((expense) =>
    isOfficialExpense(expense) && (
      regime === 'cash'
        ? isPaidExpense(expense) && isInReportPeriod(expense.paidAt)
        : isInReportPeriod(expense.expenseDate)
    ),
  )
  const expenseBreakdown = Array.from(
    reportExpenses.reduce((categories, expense) => {
      categories.set(expense.category, (categories.get(expense.category) || 0) + expense.amount)
      return categories
    }, new Map<string, number>()),
    ([category, total]) => ({ category, total }),
  ).sort((a, b) => b.total - a.total)
  const profitableProjects = state.projects
    .filter((project) => isVisibleProject(project) && isInReportPeriod(project.deliveryDeadline || project.captureDate || project.createdAt))
    .map((project) => ({ project, profit: getProjectProfit(state, project) }))
    .sort((a, b) => b.profit.profit - a.profit.profit)
    .slice(0, 8)
  const sortedLeadSources = [...leadSourceSeries].sort((a, b) => b.total - a.total)
  const sortedServices = [...serviceSeries].sort((a, b) => b.total - a.total)
  const maxLeadSource = Math.max(...sortedLeadSources.map((item) => item.total), 1)
  const maxService = Math.max(...sortedServices.map((item) => item.total), 1)
  const recurringExpenses = state.expenses.filter((expense) => expense.recurring && !expense.deletedAt && !expense.archivedAt && expense.status !== 'Cancelada')
  const uniquePeriodExpenses = reportExpenses.filter((expense) => !expense.recurring).reduce((total, expense) => total + expense.amount, 0)
  const recurringPeriodExpenses = reportExpenses.filter((expense) => expense.recurring).reduce((total, expense) => total + expense.amount, 0)
  const bankPositions = state.bankAccounts.map((account) => ({ account, balance: getBankAccountBalance(state, account) })).sort((a, b) => b.balance - a.balance)
  const recentTransfers = [...state.bankTransfers].sort((a, b) => b.transferredAt.localeCompare(a.transferredAt)).slice(0, 6)
  const periodLabel = periodOptions.find((option) => option.value === period)?.label || 'Período atual'
  const regimeLabel = regime === 'cash' ? 'Caixa · valores pagos' : 'Competência · valores lançados'
  const monthSnapshot = (monthOffset: number, yearOffset = 0) => {
    const now = new Date()
    const start = new Date(now.getFullYear() + yearOffset, now.getMonth() + monthOffset, 1)
    const end = new Date(now.getFullYear() + yearOffset, now.getMonth() + monthOffset + 1, 0, 23, 59, 59, 999)
    const inRange = (value?: string) => { if (!value) return false; const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return date >= start && date <= end }
    const revenue = regime === 'cash'
      ? state.payments.filter((payment) => payment.status === 'Recebida' && !payment.deletedAt && !payment.archivedAt && inRange(payment.paidAt)).reduce((total, payment) => total + getPaymentCashEffect(payment), 0)
      : state.projects.filter((project) => isVisibleProject(project) && inRange(project.deliveryDeadline || project.captureDate || project.createdAt)).reduce((total, project) => total + project.totalValue, 0)
    const expenses = state.expenses.filter((expense) => isOfficialExpense(expense) && inRange(regime === 'cash' ? expense.paidAt : expense.expenseDate)).reduce((total, expense) => total + expense.amount, 0)
    return { revenue, expenses, result: revenue - expenses }
  }
  const currentMonthSnapshot = monthSnapshot(0)
  const previousMonthSnapshot = monthSnapshot(-1)
  const previousYearSnapshot = monthSnapshot(0, -1)
  const funnel = [
    { label: 'Oportunidades', value: state.leads.filter((lead) => !lead.deletedAt && !lead.archived && isInReportPeriod(lead.entryDate)).length },
    { label: 'Propostas', value: state.quotes.filter((quote) => !quote.deletedAt && isInReportPeriod(quote.issueDate)).length },
    { label: 'Aprovadas', value: state.quotes.filter((quote) => !quote.deletedAt && ['Aprovada', 'Aguardando entrada', 'Entrada recebida', 'Convertida em projeto'].includes(quote.status) && isInReportPeriod(quote.approvedAt || quote.issueDate)).length },
    { label: 'Projetos', value: metrics.projectCount },
    { label: 'Pagamentos', value: state.payments.filter((payment) => payment.status === 'Recebida' && !payment.deletedAt && isInReportPeriod(payment.paidAt)).length },
  ]
  const profitabilityBy = (keyFor: (project: Project) => string) => Array.from(profitableProjects.reduce((groups, { project, profit }) => {
    const key = keyFor(project) || 'Não informado'
    const current = groups.get(key) || { revenue: 0, costs: 0 }
    groups.set(key, { revenue: current.revenue + profit.contractedRevenue, costs: current.costs + profit.directCosts })
    return groups
  }, new Map<string, { revenue: number; costs: number }>()), ([label, values]) => ({ label, ...values, result: values.revenue - values.costs, margin: values.revenue > 0 ? (values.revenue - values.costs) / values.revenue * 100 : 0 })).sort((a, b) => b.result - a.result)
  const profitabilityByService = profitabilityBy((project) => project.serviceName)
  const profitabilityByClient = profitabilityBy((project) => projectClient(state, project)?.companyName || 'Sem cliente')

  return (
    <div className="reports-page space-y-4">
      <PageToolbar
        title="Relatórios"
        description="Visão completa do resultado financeiro, comercial e operacional."
        action={<div className="flex flex-wrap gap-2"><Button variant="secondary" type="button" onClick={exportFinancialRows}><Download size={16} /> Financeiro</Button><Button type="button" onClick={exportRows}><Download size={16} /> Projetos</Button></div>}
      />

      <section className="report-context flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="report-context-icon flex h-9 w-9 items-center justify-center rounded-xl"><BarChart3 size={18} /></span>
          <div><p className="text-sm font-black text-gray-950">Período analisado: {periodLabel}</p><p className="text-xs text-gray-500">{regimeLabel}</p></div>
        </div>
        <p className="max-w-xl text-xs leading-5 text-gray-500">Altere período e regime no cabeçalho. Em Caixa entram somente receitas recebidas e despesas pagas; em Competência entram os lançamentos do período.</p>
      </section>

      <div className="grid gap-3 md:grid-cols-3"><SmallStat label="Resultado deste mês" value={formatCurrency(currentMonthSnapshot.result)} /><SmallStat label="Resultado mês anterior" value={`${formatCurrency(previousMonthSnapshot.result)} · ${previousMonthSnapshot.result ? (((currentMonthSnapshot.result - previousMonthSnapshot.result) / Math.abs(previousMonthSnapshot.result)) * 100).toFixed(1) : '0.0'}%`} /><SmallStat label="Mesmo mês do ano anterior" value={`${formatCurrency(previousYearSnapshot.result)} · ${previousYearSnapshot.result ? (((currentMonthSnapshot.result - previousYearSnapshot.result) / Math.abs(previousYearSnapshot.result)) * 100).toFixed(1) : '0.0'}%`} /></div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Wallet size={20} />} label="Faturamento" value={formatCurrency(metrics.revenue)} />
        <MetricCard icon={<TrendingUp size={20} />} label="Lucro líquido" value={formatCurrency(metrics.netProfit)} tone={metrics.netProfit >= 0 ? 'positive' : 'danger'} />
        <MetricCard icon={<BarChart3 size={20} />} label="Margem líquida" value={`${metrics.margin.toFixed(1)}%`} tone={metrics.margin >= 25 ? 'positive' : 'warning'} />
        <MetricCard icon={<Briefcase size={20} />} label="Ticket médio" value={formatCurrency(metrics.averageTicket)} />
        <MetricCard icon={<Landmark size={20} />} label="Saldo bancário" value={formatCurrency(getTotalBankBalance(state))} tone={getTotalBankBalance(state) >= 0 ? 'positive' : 'danger'} />
      </div>

      <section className="report-mini-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <DashboardIndicator icon={<DollarSign size={17} />} label="Despesas do período" value={formatCurrency(metrics.expenses)} tone="danger" />
        <DashboardIndicator icon={<Clock size={17} />} label="A receber" value={formatCurrency(metrics.pendingReceivable)} tone="warning" />
        <DashboardIndicator icon={<AlertTriangle size={17} />} label="Despesas vencidas" value={metrics.overdueExpenses} tone={metrics.overdueExpenses ? 'danger' : 'neutral'} />
        <DashboardIndicator icon={<CalendarDays size={17} />} label="Custo recorrente/mês" value={formatCurrency(metrics.recurringMonthlyExpenses)} tone="warning" />
        <DashboardIndicator icon={<Users size={17} />} label="Conversão de contatos" value={`${metrics.leadConversion.toFixed(1)}%`} />
        <DashboardIndicator icon={<Camera size={17} />} label="Projetos no período" value={metrics.projectCount} />
        <DashboardIndicator icon={<Wallet size={17} />} label="Contas a pagar" value={formatCurrency(metrics.pendingExpenses)} tone="warning" />
        <DashboardIndicator icon={<DollarSign size={17} />} label="Despesas únicas" value={formatCurrency(uniquePeriodExpenses)} tone="danger" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <Panel title="Evolução financeira · últimos 6 meses">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySeries}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={58} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }} formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="faturamento" name={regime === 'cash' ? 'Recebido' : 'Faturado'} stroke="var(--accent)" strokeWidth={2.6} dot={false} />
                <Line type="monotone" dataKey="despesas" name={regime === 'cash' ? 'Despesas pagas' : 'Despesas lançadas'} stroke="#dc2626" strokeWidth={2.4} dot={false} />
                <Line type="monotone" dataKey="lucro" name="Resultado" stroke="#16a34a" strokeWidth={2.4} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Composição das despesas">
          {expenseBreakdown.length ? <><div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseBreakdown} dataKey="total" nameKey="category" innerRadius={52} outerRadius={78} paddingAngle={4} stroke="var(--surface)" strokeWidth={3}>{expenseBreakdown.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }} formatter={(value) => formatCurrency(Number(value))} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{expenseBreakdown.slice(0, 4).map((item, index) => <div key={item.category} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 text-gray-600"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: chartColors[index % chartColors.length] }} /><span className="truncate">{item.category}</span></span><strong className="text-gray-950">{formatCurrency(item.total)}</strong></div>)}</div></> : <DashboardEmptyState icon={<DollarSign size={20} />} message="Nenhuma despesa neste período." />}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Posição por conta bancária">
          <div className="space-y-3">
            {bankPositions.map(({ account, balance }) => <div key={account.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><Landmark size={17} /></span><div className="min-w-0"><strong className="block truncate text-sm text-gray-950">{account.name}</strong><span className="text-xs text-gray-500">{account.bankName} · {account.active ? 'Ativa' : 'Inativa'}</span></div></div><strong className={balance < 0 ? 'text-red-600' : 'text-gray-950'}>{formatCurrency(balance)}</strong></div>)}
          </div>
        </Panel>
        <Panel title="Despesas únicas e recorrentes">
          <div className="grid gap-3 sm:grid-cols-2"><SmallStat label="Únicas no período" value={formatCurrency(uniquePeriodExpenses)} /><SmallStat label="Recorrentes no período" value={formatCurrency(recurringPeriodExpenses)} /><SmallStat label="Média recorrente mensal" value={formatCurrency(metrics.recurringMonthlyExpenses)} /><SmallStat label="Recorrências ativas" value={String(recurringExpenses.length)} /></div>
          <div className="mt-4 space-y-2">{recurringExpenses.slice(0, 5).map((expense) => <div key={expense.id} className="flex items-center justify-between gap-3 border-t border-gray-200 pt-2 text-sm"><span className="min-w-0 truncate text-gray-600">{expense.description} · {expense.recurrenceFrequency || 'Mensal'}</span><strong className="whitespace-nowrap text-gray-950">{formatCurrency(expense.amount)}</strong></div>)}{!recurringExpenses.length ? <p className="text-sm text-gray-500">Nenhuma despesa recorrente ativa.</p> : null}</div>
        </Panel>
        <Panel title="Transferências entre contas">
          {recentTransfers.length ? (
            <div className="space-y-3">
              {recentTransfers.map((transfer) => (
                <div key={transfer.id} className="finance-transfer-row rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-950">{state.bankAccounts.find((account) => account.id === transfer.fromAccountId)?.name || 'Origem'} → {state.bankAccounts.find((account) => account.id === transfer.toAccountId)?.name || 'Destino'}</p>
                      <p className="mt-1 text-xs text-gray-500">{transfer.description || 'Transferência entre contas'} · {formatDateTime(transfer.transferredAt)}</p>
                    </div>
                    <strong className="whitespace-nowrap text-gray-950">{formatCurrency(transfer.amount)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DashboardEmptyState icon={<ArrowRightLeft size={20} />} message="Nenhuma transferência registrada." />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Origem dos contatos">
          <div className="report-ranking space-y-3">
            {sortedLeadSources.length ? sortedLeadSources.slice(0, 7).map((item) => (
              <div key={item.source}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-gray-700">{item.source}</span><strong className="text-gray-950">{item.total}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#d8a500]" style={{ width: `${(item.total / maxLeadSource) * 100}%` }} /></div></div>
            )) : <DashboardEmptyState icon={<Users size={20} />} message="Cadastre contatos para acompanhar as origens." />}
          </div>
        </Panel>

        <Panel title="Serviços por tipo">
          <div className="report-ranking space-y-3">
            {sortedServices.length ? sortedServices.slice(0, 7).map((item) => (
              <div key={item.service}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-gray-700">{item.service}</span><strong className="text-gray-950">{item.total}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(item.total / maxService) * 100}%` }} /></div></div>
            )) : <DashboardEmptyState icon={<Camera size={20} />} message="Ainda não há projetos para comparar." />}
          </div>
        </Panel>
      </div>

      <Panel title="Funil comercial até o caixa">
        <div className="grid gap-3 sm:grid-cols-5">{funnel.map((stage, index) => { const previous = index ? funnel[index - 1].value : stage.value; const conversion = previous > 0 ? stage.value / previous * 100 : 0; return <div key={stage.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center"><p className="text-xs font-black uppercase text-gray-500">{stage.label}</p><strong className="mt-1 block text-2xl text-gray-950">{stage.value}</strong>{index ? <span className="text-xs font-bold text-amber-700">{conversion.toFixed(1)}% da etapa anterior</span> : <span className="text-xs text-gray-400">Entrada do funil</span>}</div> })}</div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">{[['Rentabilidade por serviço', profitabilityByService], ['Rentabilidade por cliente', profitabilityByClient]].map(([title, items]) => <Panel key={String(title)} title={String(title)}><div className="space-y-2">{(items as typeof profitabilityByService).slice(0, 6).map((item) => <div key={item.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm"><strong className="truncate text-gray-950">{item.label}</strong><span className={item.result < 0 ? 'text-red-600' : 'text-emerald-600'}>{formatCurrency(item.result)}</span><StatusBadge>{item.margin.toFixed(1)}%</StatusBadge></div>)}</div></Panel>)}</div>

      <Panel title="Rentabilidade dos projetos">
        {profitableProjects.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Projeto</th><th>Cliente</th><th>Contratado</th><th>Recebido</th><th>Custos diretos</th><th>Resultado contratado</th><th>Resultado realizado</th><th>Margem contratada</th><th>Horas</th><th>Receita/hora</th></tr></thead><tbody>{profitableProjects.map(({ project, profit }) => <tr key={project.id}><td data-label="Projeto"><strong>{project.projectCode}</strong><span className="mt-0.5 block text-xs text-gray-500">{project.name}</span></td><td data-label="Cliente">{projectClient(state, project)?.companyName || 'Sem cliente'}</td><td data-label="Contratado">{formatCurrency(profit.contractedRevenue)}</td><td data-label="Recebido">{formatCurrency(profit.paid)}</td><td data-label="Custos diretos">{formatCurrency(profit.directCosts)}</td><td data-label="Resultado contratado"><strong className={profit.contractedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(profit.contractedProfit)}</strong></td><td data-label="Resultado realizado"><strong className={profit.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(profit.profit)}</strong></td><td data-label="Margem contratada"><StatusBadge>{`${profit.contractedMargin.toFixed(1)}%`}</StatusBadge></td><td data-label="Horas">{project.workedHours || project.estimatedHours || 0}h</td><td data-label="Receita/hora">{project.workedHours ? formatCurrency(project.totalValue / project.workedHours) : '-'}</td></tr>)}</tbody></table></div> : <DashboardEmptyState icon={<Briefcase size={20} />} message="Nenhum projeto disponível para análise." />}
      </Panel>

      <section className="report-insights grid gap-3 md:grid-cols-3">
        <div className="report-insight-card"><span className="report-insight-icon"><TrendingUp size={18} /></span><div><p className="text-xs font-bold uppercase text-gray-500">Saúde financeira</p><strong className="mt-1 block text-gray-950">{metrics.netProfit > 0 ? 'Resultado positivo' : metrics.netProfit < 0 ? 'Resultado negativo' : 'Ponto de equilíbrio'}</strong><p className="mt-1 text-xs leading-5 text-gray-500">{metrics.margin >= 25 ? 'A margem está em uma faixa saudável.' : 'Revise preços e custos para melhorar a margem.'}</p></div></div>
        <div className="report-insight-card"><span className="report-insight-icon"><CalendarDays size={18} /></span><div><p className="text-xs font-bold uppercase text-gray-500">Compromissos fixos</p><strong className="mt-1 block text-gray-950">{formatCurrency(metrics.recurringMonthlyExpenses)} por mês</strong><p className="mt-1 text-xs leading-5 text-gray-500">{recurringExpenses.length} despesa(s) recorrente(s) ativa(s), convertidas para média mensal.</p></div></div>
        <div className="report-insight-card"><span className="report-insight-icon"><AlertTriangle size={18} /></span><div><p className="text-xs font-bold uppercase text-gray-500">Atenção necessária</p><strong className="mt-1 block text-gray-950">{metrics.overdueExpenses + metrics.overduePayments} pendência(s) vencida(s)</strong><p className="mt-1 text-xs leading-5 text-gray-500">Inclui despesas vencidas e recebimentos atrasados.</p></div></div>
      </section>
    </div>
  )
}

function SettingsPage({ state, onSubmit }: { state: AppState; onSubmit: (values: SettingsFormValues) => void }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SettingsFormInput, unknown, SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: state.companySettings,
  })

  const companyAddress = watch('address') ?? ''
  const companyPhone = watch('phone') ?? ''
  const fuelAveragePrice = Number(watch('fuelAveragePrice') || 0)
  const pricePerKm = Number(watch('pricePerKm') || 0)
  const distance = Number(watch('freeKm')) + 40
  const fuelCost = (distance / Number(watch('vehicleAverageConsumption') || 1)) * Number(watch('fuelAveragePrice') || 0)
  const additionalKm = Math.max(distance - Number(watch('freeKm') || 0), 0)
  const suggestedTravelFee = fuelCost + additionalKm * Number(watch('pricePerKm') || 0)

  return (
    <div className="space-y-4">
      <PageToolbar title="Configurações da empresa" description="Dados da proposta, padrão de entrada, entrega, PIX e deslocamento." />
      <form className="grid gap-4 xl:grid-cols-[1fr_0.72fr]" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <Panel title="Dados da empresa">
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Nome da empresa" error={getError(errors.companyName?.message)}><input className="field-input" {...register('companyName')} /></InputField>
              <InputField label="CPF/CNPJ" error={getError(errors.document?.message)}><input className="field-input" {...register('document')} /></InputField>
              <InputField label="Telefone" error={getError(errors.phone?.message)}>
                <input type="hidden" {...register('phone')} />
                <PhoneInput value={companyPhone} onChange={(nextValue) => setValue('phone', nextValue, { shouldDirty: true, shouldValidate: true })} />
              </InputField>
              <InputField label="E-mail" error={getError(errors.email?.message)}><input className="field-input" type="email" {...register('email')} /></InputField>
              <InputField label="Instagram" error={getError(errors.instagram?.message)}><input className="field-input" {...register('instagram')} /></InputField>
              <InputField label="Cidade base" error={getError(errors.baseCity?.message)}><input className="field-input" {...register('baseCity')} /></InputField>
              <div className="md:col-span-2">
                <input type="hidden" {...register('address')} />
                <MapsAddressField
                  label="Endereço comercial"
                  error={getError(errors.address?.message)}
                  value={companyAddress}
                  onChange={(nextValue) => setValue('address', nextValue, { shouldDirty: true, shouldValidate: true })}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Padrão comercial">
            <div className="grid gap-4 md:grid-cols-3">
              <InputField label="Entrada padrão (%)" error={getError(errors.defaultDepositPercentage?.message)}><input className="field-input" type="number" min="0" max="100" {...register('defaultDepositPercentage')} /></InputField>
              <InputField label="Entrega padrão (dias)" error={getError(errors.defaultDeliveryDays?.message)}><input className="field-input" type="number" min="1" {...register('defaultDeliveryDays')} /></InputField>
              <InputField label="Revisões inclusas" error={getError(errors.defaultFreeRevisions?.message)}><input className="field-input" type="number" min="0" {...register('defaultFreeRevisions')} /></InputField>
              <div className="md:col-span-3">
                <InputField label="Condições padrão de pagamento" error={getError(errors.paymentTerms?.message)}><textarea className="field-input min-h-24" {...register('paymentTerms')} /></InputField>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="PIX e cobrança">
            <div className="space-y-4">
              <InputField label="Chave PIX" error={getError(errors.pixKey?.message)}><input className="field-input" {...register('pixKey')} /></InputField>
              <InputField label="Titular do PIX" error={getError(errors.pixHolderName?.message)}><input className="field-input" {...register('pixHolderName')} /></InputField>
              <div className="grid gap-3 sm:grid-cols-2">
                <SmallStat label="Entrada padrão" value={`${Number(watch('defaultDepositPercentage') || 0).toFixed(0)}%`} />
                <SmallStat label="Entrega padrão" value={`${Number(watch('defaultDeliveryDays') || 0).toFixed(0)} dias`} />
              </div>
            </div>
          </Panel>

          <Panel title="Deslocamento">
            <div className="space-y-4">
              <InputField label="Consumo médio do veículo (km/l)" error={getError(errors.vehicleAverageConsumption?.message)}><input className="field-input" type="number" step="0.1" {...register('vehicleAverageConsumption')} /></InputField>
              <InputField label="Preço médio do combustível" error={getError(errors.fuelAveragePrice?.message)}>
                <input type="hidden" {...register('fuelAveragePrice')} />
                <CurrencyInput
                  value={fuelAveragePrice}
                  onChange={(nextValue) => setValue('fuelAveragePrice', nextValue, { shouldDirty: true, shouldValidate: true })}
                />
              </InputField>
              <InputField label="Valor por km adicional" error={getError(errors.pricePerKm?.message)}>
                <input type="hidden" {...register('pricePerKm')} />
                <CurrencyInput
                  value={pricePerKm}
                  onChange={(nextValue) => setValue('pricePerKm', nextValue, { shouldDirty: true, shouldValidate: true })}
                />
              </InputField>
              <InputField label="Quilometragem gratuita" error={getError(errors.freeKm?.message)}><input className="field-input" type="number" step="1" {...register('freeKm')} /></InputField>
              <div className="rounded-lg bg-gray-50 p-4 text-sm">
                <p className="font-black text-gray-950">Simulação de deslocamento</p>
                <p className="mt-1 text-gray-500">Distância total: {distance.toFixed(0)} km</p>
                <p className="text-gray-500">Combustível estimado: {formatCurrency(fuelCost)}</p>
                <p className="text-gray-500">Km adicional: {additionalKm.toFixed(0)} km</p>
                <p className="mt-2 text-lg font-black text-gray-950">{formatCurrency(suggestedTravelFee)}</p>
              </div>
            </div>
          </Panel>
          <Button className="w-full" type="submit">Salvar configurações</Button>
        </div>
      </form>
    </div>
  )
}

function PageToolbar({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="page-toolbar flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm sm:px-5">
      <div>
        <h2 className="text-lg font-black tracking-tight text-gray-950 sm:text-xl">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

function MapsAddressField({
  label,
  error,
  value,
  onChange,
  name,
  placeholder = 'Digite ou busque um endereço',
  required = false,
}: {
  label: string
  error?: string
  value: string
  onChange: (value: string) => void
  name?: string
  placeholder?: string
  required?: boolean
}) {
  const [query, setQuery] = useState(value ?? '')
  const [suggestions, setSuggestions] = useState<GoogleAddressPrediction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const cleanQuery = query.trim()

  useEffect(() => {
    setQuery(value ?? '')
  }, [value])

  useEffect(() => {
    let active = true

    if (!googleMapsApiKey || cleanQuery.length < 3) {
      setSuggestions([])
      setIsLoading(false)
      return () => {
        active = false
      }
    }

    setIsLoading(true)
    void loadGoogleMapsPlaces().then((ready) => {
      if (!active) return
      const AutocompleteService = window.google?.maps?.places?.AutocompleteService
      if (!ready || !AutocompleteService) {
        setSuggestions([])
        setIsLoading(false)
        return
      }

      const service = new AutocompleteService()
      service.getPlacePredictions(
        {
          input: cleanQuery,
          componentRestrictions: { country: 'br' },
          types: ['geocode'],
        },
        (predictions) => {
          if (!active) return
          setSuggestions(predictions?.slice(0, 5) ?? [])
          setIsLoading(false)
        },
      )
    })

    return () => {
      active = false
    }
  }, [cleanQuery])

  const updateValue = (nextValue: string) => {
    setQuery(nextValue)
    onChange(nextValue)
  }

  return (
    <InputField label={label} error={error}>
      <div className="relative">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              autoComplete="off"
              className="field-input field-input-with-leading-icon"
              name={name}
              placeholder={placeholder}
              required={required}
              style={{ paddingLeft: '2.75rem' }}
              value={query}
              onChange={(event) => updateValue(event.currentTarget.value)}
            />
          </div>
          {cleanQuery ? (
            <a
              className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-bold text-gray-900 hover:bg-gray-50"
              href={mapsLink(cleanQuery)}
              rel="noreferrer"
              target="_blank"
            >
              <MapPin size={16} />
              Mapa
            </a>
          ) : (
            <button
              className="inline-flex min-h-11 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 text-sm font-bold text-gray-400"
              disabled
              type="button"
            >
              <MapPin size={16} />
              Mapa
            </button>
          )}
        </div>

        {isLoading || suggestions.length ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
            {isLoading ? <p className="px-3 py-2 text-sm font-bold text-gray-500">Buscando no Maps...</p> : null}
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.place_id}
                className="flex w-full items-start gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"
                type="button"
                onClick={() => {
                  updateValue(suggestion.description)
                  setSuggestions([])
                }}
              >
                <MapPin className="mt-0.5 shrink-0 text-[#d8a500]" size={16} />
                <span className="font-bold text-gray-800">{suggestion.description}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </InputField>
  )
}

function SmallStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <dt className="text-xs font-bold uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-black text-gray-950">{value}</dd>
    </div>
  )
}

function IconActionButton({
  label,
  icon,
  onClick,
  tone = 'neutral',
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  tone?: 'neutral' | 'danger'
}) {
  const toneClasses = tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100'
    : 'border-gray-200 bg-white text-gray-600 hover:border-[#d8a500] hover:bg-[#fff8df] hover:text-gray-950'

  return (
    <button
      aria-label={label}
      className={`focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${toneClasses}`}
      title={label}
      type="button"
      onClick={onClick}
    >
      {icon}
    </button>
  )
}

function getProjectDeadlineInfo(deadline?: string) {
  if (!deadline) {
    return {
      level: 'neutral' as const,
      label: 'Sem prazo',
      description: 'Sem data de entrega',
      cardClass: '',
      boxClass: 'border-gray-200 bg-gray-50',
      textClass: 'text-gray-500',
      badgeClass: 'bg-gray-100 text-gray-600',
    }
  }

  const days = daysUntil(deadline)
  const formattedDate = formatDate(deadline)

  if (days < 0) {
    return {
      level: 'danger' as const,
      label: 'Vencido',
      description: `${formatDaysUntil(deadline)} • ${formattedDate}`,
      cardClass: 'border-red-400 bg-red-50 shadow-red-100 ring-1 ring-red-200',
      boxClass: 'border-red-300 bg-red-50',
      textClass: 'text-red-700',
      badgeClass: 'bg-red-600 text-white',
    }
  }

  if (days <= 3) {
    return {
      level: 'warning' as const,
      label: days === 0 ? 'Vence hoje' : days === 1 ? 'Vence amanhã' : `Vence em ${days} dias`,
      description: `${formatDaysUntil(deadline)} • ${formattedDate}`,
      cardClass: '',
      boxClass: 'border-amber-200 bg-amber-50',
      textClass: 'text-amber-700',
      badgeClass: 'bg-amber-100 text-amber-700',
    }
  }

  if (days <= 7) {
    return {
      level: 'warning' as const,
      label: `Vence em ${days} dias`,
      description: `${formatDaysUntil(deadline)} • ${formattedDate}`,
      cardClass: '',
      boxClass: 'border-amber-200 bg-amber-50',
      textClass: 'text-amber-700',
      badgeClass: 'bg-amber-100 text-amber-700',
    }
  }

  return {
    level: 'neutral' as const,
    label: formatDaysUntil(deadline),
    description: `${formatDaysUntil(deadline)} • ${formattedDate}`,
    cardClass: '',
    boxClass: 'border-gray-200 bg-gray-50',
    textClass: 'text-gray-500',
    badgeClass: 'bg-gray-100 text-gray-600',
  }
}

function GlobalSearchResults({ query, state, onNavigate }: { query: string; state: AppState; onNavigate: (page: Page) => void }) {
  const results = useMemo(() => {
    if (query.trim().length < 2) return []
    return [
      ...state.leads
        .filter((lead) => matches(`${lead.fullName} ${lead.companyName} ${lead.phone} ${lead.email}`, query))
        .slice(0, 3)
        .map((lead) => ({ id: lead.id, title: contactDisplayName(lead), subtitle: contactDisplayDetail(lead), page: 'leads' as Page })),
      ...state.clients
        .filter((client) => matches(`${client.fullName} ${client.companyName} ${client.phone} ${client.email}`, query))
        .slice(0, 3)
        .map((client) => ({ id: client.id, title: contactDisplayName(client), subtitle: contactDisplayDetail(client), page: 'clients' as Page })),
      ...state.projects
        .filter((project) => isVisibleProject(project) && matches(`${project.projectCode} ${project.name} ${project.serviceName}`, query))
        .slice(0, 3)
        .map((project) => ({ id: project.id, title: project.projectCode, subtitle: project.name, page: 'projects' as Page })),
    ]
  }, [query, state])

  if (!results.length) return null

  return (
    <div className="absolute left-0 right-0 top-12 z-40 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
      {results.map((result) => (
        <button
          key={`${result.page}-${result.id}`}
          className="block w-full rounded-lg px-3 py-2 text-left hover:bg-gray-50"
          type="button"
          onClick={() => onNavigate(result.page)}
        >
          <span className="block text-sm font-black text-gray-950">{result.title}</span>
          <span className="block text-xs text-gray-500">{result.subtitle}</span>
        </button>
      ))}
    </div>
  )
}

function MonthCalendar({
  appointments,
  anchorDate,
  onCreateAt,
  onOpenAppointment,
}: {
  appointments: Appointment[]
  anchorDate: Date
  onCreateAt: (startAt: string, endAt: string) => void
  onOpenAppointment: (appointment: Appointment) => void
}) {
  const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const daysInMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate()
  const offset = first.getDay()
  const cells = Array.from({ length: offset + daysInMonth }, (_, index) => (index < offset ? 0 : index - offset + 1))

  return (
    <Panel title="Calendário mensal">
      <div className="grid grid-cols-7 gap-2 text-sm">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
          <div key={day} className="p-2 text-center text-xs font-bold uppercase text-gray-500">{day}</div>
        ))}
        {cells.map((day, index) => {
          const cell = day ? new Date(anchorDate.getFullYear(), anchorDate.getMonth(), day, 9, 0, 0, 0) : undefined
          const cellDate = cell ? dateInputFromDate(cell) : ''
          const dayAppointments = appointments.filter((appointment) => dateInputFromDate(new Date(appointment.startAt)) === cellDate)
          const end = cell ? new Date(cell.getTime() + 60 * 60_000) : undefined
          return (
            <div
              key={index}
              className="min-h-24 rounded-lg border border-gray-200 bg-gray-50 p-2 text-left transition hover:border-[#d8a500] hover:bg-amber-50"
              role={cell ? 'button' : undefined}
              tabIndex={cell ? 0 : undefined}
              onClick={() => {
                if (!cell || !end) return
                onCreateAt(dateTimeInputFromDate(cell), dateTimeInputFromDate(end))
              }}
              onKeyDown={(event) => {
                if (!cell || !end) return
                if (event.key === 'Enter' || event.key === ' ') onCreateAt(dateTimeInputFromDate(cell), dateTimeInputFromDate(end))
              }}
            >
              <p className="text-xs font-black text-gray-950">{day || ''}</p>
              <div className="mt-1 space-y-1">
                {dayAppointments.slice(0, 2).map((appointment) => (
                  <button
                    key={appointment.id}
                    className="block w-full truncate rounded bg-white px-2 py-1 text-left text-[0.68rem] font-bold text-gray-700 hover:bg-gray-100"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenAppointment(appointment)
                    }}
                  >
                    {appointment.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function TimeGridCalendar({
  anchorDate,
  appointments,
  state,
  view,
  onCreateAt,
  onOpenAppointment,
  onResizeAppointment,
}: {
  anchorDate: Date
  appointments: Appointment[]
  state: AppState
  view: 'semanal' | 'diaria'
  onCreateAt: (startAt: string, endAt: string) => void
  onOpenAppointment: (appointment: Appointment) => void
  onResizeAppointment: (appointment: Appointment, endAt: string) => void
}) {
  const start = view === 'semanal' ? getWeekStart(anchorDate) : new Date(anchorDate)
  const days = Array.from({ length: view === 'semanal' ? 7 : 1 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    day.setHours(0, 0, 0, 0)
    return day
  })
  const hours = view === 'diaria'
    ? Array.from({ length: 24 }, (_, index) => index)
    : Array.from({ length: 14 }, (_, index) => 7 + index)
  const hourHeight = view === 'diaria' ? 64 : 72
  const totalHeight = hours.length * hourHeight
  const rangeStartHour = hours[0] ?? 0
  const rangeEndHour = (hours[hours.length - 1] ?? 23) + 1
  const rangeStartMinutes = rangeStartHour * 60
  const rangeEndMinutes = rangeEndHour * 60
  const [resizePreview, setResizePreview] = useState<{ appointmentId: string; endAt: string } | null>(null)

  const appointmentClient = (appointment: Appointment) => {
    const client = appointment.clientId ? state.clients.find((item) => item.id === appointment.clientId) : undefined
    const lead = appointment.leadId ? state.leads.find((item) => item.id === appointment.leadId) : undefined
    return client?.companyName || lead?.companyName || 'Sem cliente'
  }

  const appointmentTime = (appointment: Appointment) => {
    const startDate = new Date(appointment.startAt)
    const endDate = new Date(appointment.endAt)
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${pad(startDate.getHours())}:${pad(startDate.getMinutes())} - ${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
  }

  const appointmentBlockStyle = (appointment: Appointment) => {
    const startDate = new Date(appointment.startAt)
    const endDate = new Date(appointment.endAt)
    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
    const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()
    const topMinutes = Math.max(startMinutes, rangeStartMinutes) - rangeStartMinutes
    const visibleMinutes = Math.max(Math.min(endMinutes, rangeEndMinutes) - Math.max(startMinutes, rangeStartMinutes), 5)
    return {
      top: `${(topMinutes / 60) * hourHeight + 4}px`,
      height: `${Math.max((visibleMinutes / 60) * hourHeight - 8, 24)}px`,
    }
  }

  const startAppointmentResize = (event: ReactPointerEvent<HTMLDivElement>, appointment: Appointment, day: Date) => {
    event.preventDefault()
    event.stopPropagation()
    const startMs = new Date(appointment.startAt).getTime()
    const initialEndMs = new Date(appointment.endAt).getTime()
    const initialPointerY = event.clientY
    const minimumEndMs = startMs + 15 * 60_000
    const rangeEnd = new Date(day)
    rangeEnd.setHours(rangeEndHour, 0, 0, 0)
    const maximumEndMs = Math.max(rangeEnd.getTime(), minimumEndMs)
    let nextEndMs = initialEndMs
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      const rawDeltaMinutes = ((moveEvent.clientY - initialPointerY) / hourHeight) * 60
      const snappedDeltaMinutes = Math.round(rawDeltaMinutes / 15) * 15
      nextEndMs = Math.min(Math.max(initialEndMs + snappedDeltaMinutes * 60_000, minimumEndMs), maximumEndMs)
      setResizePreview({ appointmentId: appointment.id, endAt: new Date(nextEndMs).toISOString() })
    }

    const finishResize = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      setResizePreview(null)
      if (nextEndMs !== initialEndMs) onResizeAppointment(appointment, new Date(nextEndMs).toISOString())
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', finishResize)
    window.addEventListener('pointercancel', finishResize)
  }

  return (
    <Panel title={view === 'semanal' ? 'Calendário semanal' : 'Planejamento do dia'}>
      <div className="overflow-x-auto">
        <div className={view === 'diaria' ? 'min-w-[620px]' : 'min-w-[980px]'}>
          <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(9rem, 1fr))` }}>
            <div className="p-2 text-xs font-bold uppercase text-gray-500">Hora</div>
            {days.map((day) => (
              <div key={day.toISOString()} className="border-l border-gray-200 p-2">
                <p className="text-xs font-bold uppercase text-gray-500">
                  {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </p>
                <p className="text-lg font-black text-gray-950">{day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(${view === 'diaria' ? '26rem' : '9rem'}, 1fr))` }}>
            <div className="relative bg-gray-50" style={{ height: totalHeight }}>
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-b border-gray-200 p-2 text-xs font-black text-gray-500"
                  style={{ top: index * hourHeight, height: hourHeight }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayKey = dateInputFromDate(day)
              const dayAppointments = appointments.filter((appointment) => {
                const startDate = new Date(appointment.startAt)
                const endDate = new Date(appointment.endAt)
                const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
                const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()
                return dateInputFromDate(startDate) === dayKey && endMinutes > rangeStartMinutes && startMinutes < rangeEndMinutes
              })

              return (
                <div key={dayKey} className="relative border-l border-gray-200 bg-white" style={{ height: totalHeight }}>
                  {hours.map((hour, index) => {
                const startAt = new Date(day)
                startAt.setHours(hour, 0, 0, 0)
                const endAt = new Date(startAt.getTime() + 60 * 60_000)
                return (
                  <div
                    key={`${dayKey}-${hour}`}
                    className="absolute left-0 right-0 border-b border-gray-200 p-2 text-left transition hover:bg-amber-50"
                    style={{ top: index * hourHeight, height: hourHeight }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Criar tarefa às ${String(hour).padStart(2, '0')}:00`}
                    onClick={() => onCreateAt(dateTimeInputFromDate(startAt), dateTimeInputFromDate(endAt))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') onCreateAt(dateTimeInputFromDate(startAt), dateTimeInputFromDate(endAt))
                    }}
                  />
                )
              })}

                  {dayAppointments.map((appointment) => {
                    const effectiveAppointment = resizePreview?.appointmentId === appointment.id
                      ? { ...appointment, endAt: resizePreview.endAt }
                      : appointment
                    const block = appointmentBlockStyle(effectiveAppointment)
                    const canResize = state.appointments.some((item) => item.id === appointment.id)
                    return (
                      <div
                        key={appointment.id}
                        className="group absolute left-2 right-2 z-10 overflow-hidden rounded-lg border-l-4 bg-gray-50 px-2 py-1.5 pb-3 text-left shadow-sm transition hover:bg-white hover:shadow-md"
                        style={{ borderLeftColor: appointment.color || '#d8a500', ...block }}
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenAppointment(appointment)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onOpenAppointment(appointment)
                          }
                        }}
                      >
                        <p className="truncate text-xs font-black text-gray-950">{appointment.title}</p>
                        <p className="truncate text-[0.68rem] font-bold text-gray-500">{appointmentTime(effectiveAppointment)}</p>
                        <p className="truncate text-[0.68rem] text-gray-500">{appointmentClient(appointment)}</p>
                        {canResize ? <div
                          className="absolute inset-x-0 bottom-0 flex h-3 touch-none cursor-ns-resize items-center justify-center border-t border-transparent transition group-hover:border-gray-300 group-hover:bg-gray-100"
                          role="separator"
                          aria-label={`Ajustar duração de ${appointment.title}`}
                          aria-orientation="horizontal"
                          title="Arraste para aumentar ou diminuir a duração"
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => startAppointmentResize(event, appointment, day)}
                        ><span className="h-0.5 w-8 rounded-full bg-gray-400 opacity-60" /></div> : null}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Panel>
  )
}

function getWeekStart(date: Date) {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function findAppointmentConflicts(appointments: Appointment[]) {
  const conflicts: Appointment[] = []
  appointments.forEach((appointment, index) => {
    const start = new Date(appointment.startAt).getTime()
    const end = new Date(appointment.endAt).getTime()
    const hasConflict = appointments.some((other, otherIndex) => {
      if (index === otherIndex || appointment.status === 'Cancelado' || other.status === 'Cancelado') return false
      const otherStart = new Date(other.startAt).getTime()
      const otherEnd = new Date(other.endAt).getTime()
      return start < otherEnd && end > otherStart
    })
    if (hasConflict) conflicts.push(appointment)
  })
  return conflicts
}

function createDefaultChecklist(projectId: string, createdAt: string): ProjectChecklistItem[] {
  return createOperationalChecklist(projectId, createdAt).map((item) => ({ ...item, id: createId('chk') }))
}

function LeadForm({
  lead,
  contacts,
  onSubmit,
  onCancel,
}: {
  lead?: Lead
  contacts: Client[]
  onSubmit: (values: LeadFormValues) => void
  onCancel: () => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<LeadFormInput, unknown, LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      contactId: lead?.contactId ?? '',
      fullName: lead?.fullName ?? '',
      companyName: lead?.companyName ?? '',
      phone: lead?.phone ?? '',
      whatsapp: lead?.whatsapp ?? '',
      email: lead?.email ?? '',
      instagram: lead?.instagram ?? '',
      city: lead?.city ?? 'Curitiba',
      neighborhood: lead?.neighborhood ?? '',
      address: lead?.address ?? '',
      source: lead?.source ?? 'Instagram',
      serviceInterest: lead?.serviceInterest ?? 'Fotos e vídeo',
      pipelineStage: lead?.pipelineStage ?? 'Entrada',
      temperature: lead?.temperature ?? 'Morno',
      estimatedValue: lead?.estimatedValue ?? 0,
      probability: lead?.probability ?? 50,
      nextContactAt: lead?.nextContactAt ? dateTimeInputFromDate(new Date(lead.nextContactAt)) : '',
      notes: lead?.notes ?? '',
    },
  })
  const leadAddress = watch('address') ?? ''
  const leadPhone = watch('phone') ?? ''
  const leadWhatsapp = watch('whatsapp') ?? ''
  const hasAdditionalErrors = Boolean(errors.email || errors.instagram || errors.source || errors.city || errors.neighborhood || errors.address || errors.notes)

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register('pipelineStage')} />
      <input type="hidden" {...register('probability')} />
      <input type="hidden" {...register('serviceInterest')} />
      <input type="hidden" {...register('estimatedValue')} />
      <input type="hidden" {...register('nextContactAt')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <InputField label="Contato vinculado" error={getError(errors.contactId?.message)}>
            <select className="field-input" {...register('contactId')} onChange={(event) => {
              register('contactId').onChange(event)
              const contact = contacts.find((item) => item.id === event.currentTarget.value)
              if (!contact) return
              setValue('fullName', contact.fullName)
              setValue('companyName', contact.companyName)
              setValue('phone', contact.phone)
              setValue('whatsapp', contact.whatsapp)
              setValue('email', contact.email)
              setValue('instagram', contact.instagram)
              setValue('city', contact.city)
              setValue('neighborhood', contact.neighborhood)
              setValue('address', contact.address)
              setValue('source', contact.source)
            }}>
              <option value="">Selecione um contato</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactDisplayName(contact)}{contact.companyName ? ` · ${contact.companyName}` : ''}</option>)}
            </select>
          </InputField>
          {!contacts.length ? <p className="mt-1 text-xs font-bold text-amber-700">Cadastre um contato na aba Contatos antes de criar a oportunidade.</p> : null}
        </div>
        <InputField label="Nome" error={getError(errors.fullName?.message)}><input className="field-input" {...register('fullName')} /></InputField>
        <InputField label="Empresa ou estabelecimento" error={getError(errors.companyName?.message)}><input className="field-input" {...register('companyName')} /></InputField>
        <InputField label="WhatsApp" error={getError(errors.whatsapp?.message)}>
          <input type="hidden" {...register('whatsapp')} />
          <PhoneInput value={leadWhatsapp} onChange={(nextValue) => setValue('whatsapp', nextValue, { shouldDirty: true, shouldValidate: true })} />
        </InputField>
        <InputField label="Telefone" error={getError(errors.phone?.message)}>
          <input type="hidden" {...register('phone')} />
          <PhoneInput value={leadPhone} onChange={(nextValue) => setValue('phone', nextValue, { shouldDirty: true, shouldValidate: true })} />
        </InputField>
        <InputField label="Temperatura" error={getError(errors.temperature?.message)}><Select options={leadTemperatures} register={register('temperature')} /></InputField>
      </div>

      <details className="group rounded-lg border border-gray-200 bg-gray-50" open={moreOpen || hasAdditionalErrors} onToggle={(event) => { if (!hasAdditionalErrors) setMoreOpen(event.currentTarget.open) }}>
        <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm font-black text-gray-800 [&::-webkit-details-marker]:hidden">
          Mais informações
          <span className="text-xs font-bold text-gray-500 group-open:hidden">E-mail, origem e endereço</span>
          <span className="hidden text-xs font-bold text-gray-500 group-open:inline">Recolher</span>
        </summary>
        <div className="grid gap-3 border-t border-gray-200 p-4 sm:grid-cols-2">
          <InputField label="E-mail" error={getError(errors.email?.message)}><input className="field-input" type="email" {...register('email')} /></InputField>
          <InputField label="Instagram" error={getError(errors.instagram?.message)}><input className="field-input" {...register('instagram')} /></InputField>
          <InputField label="Origem" error={getError(errors.source?.message)}><Select options={leadSources} register={register('source')} /></InputField>
          <InputField label="Cidade" error={getError(errors.city?.message)}><input className="field-input" {...register('city')} /></InputField>
          <InputField label="Bairro" error={getError(errors.neighborhood?.message)}><input className="field-input" {...register('neighborhood')} /></InputField>
          <div className="sm:col-span-2">
            <input type="hidden" {...register('address')} />
            <MapsAddressField label="Endereço" error={getError(errors.address?.message)} value={leadAddress} onChange={(nextValue) => setValue('address', nextValue, { shouldDirty: true, shouldValidate: true })} />
          </div>
          <div className="sm:col-span-2"><InputField label="Observações" error={getError(errors.notes?.message)}><textarea className="field-input min-h-20" {...register('notes')} /></InputField></div>
        </div>
      </details>
      <FormActions onCancel={onCancel} submitLabel={lead ? 'Salvar oportunidade' : 'Criar oportunidade'} />
    </form>
  )
}

function ClosedServiceForm({
  lead,
  initialQuote,
  initialQuoteItems,
  state,
  onNotify,
  onSubmit,
  onCancel,
}: {
  lead: Lead
  initialQuote?: Quote
  initialQuoteItems: QuoteItem[]
  state: AppState
  onNotify: (dialog: NoticeDialogState) => void
  onSubmit: (values: CloseDealFormValues) => void
  onCancel: () => void
}) {
  const defaultServicePrice = state.services.find((service) => service.name === lead.serviceInterest)?.defaultPrice ?? state.services[0]?.defaultPrice ?? 500
  const defaultTotal = initialQuote?.totalValue ?? (lead.estimatedValue > 0 ? lead.estimatedValue : defaultServicePrice)
  const defaultDepositPercentage = initialQuote && initialQuote.totalValue > 0
    ? (initialQuote.depositValue / initialQuote.totalValue) * 100
    : state.companySettings.defaultDepositPercentage
  const defaultServiceName = initialQuote ? getQuoteServiceName(lead, initialQuoteItems) : lead.serviceInterest
  const [totalValue, setTotalValue] = useState(defaultTotal)
  const [depositPercentage, setDepositPercentage] = useState(defaultDepositPercentage)
  const [depositValue, setDepositValue] = useState(defaultTotal * (defaultDepositPercentage / 100))
  const [depositPaid, setDepositPaid] = useState(false)
  const [captureAddress, setCaptureAddress] = useState(lead.address)
  const [localContactPhone, setLocalContactPhone] = useState(lead.whatsapp || lead.phone)
  const defaultDeliveryDays = Math.max(Number(state.companySettings.defaultDeliveryDays) || 7, 1)
  const [captureDate, setCaptureDate] = useState(dateInput(3))
  const [deliveryDeadline, setDeliveryDeadline] = useState(() => addCalendarDays(dateInput(3), defaultDeliveryDays))
  const [deliveryDeadlineNegotiated, setDeliveryDeadlineNegotiated] = useState(false)
  const [deliveryDaysAfterCapture, setDeliveryDaysAfterCapture] = useState(defaultDeliveryDays)
  const remainingValue = Math.max(totalValue - depositValue, 0)
  const leadName = contactDisplayName(lead)
  const defaultProjectName = `${leadName} - ${initialQuote ? getQuoteTitle(initialQuote) : lead.serviceInterest}`

  const updateTotalValue = (nextValue: number) => {
    const normalized = Math.max(nextValue, 0)
    setTotalValue(normalized)
    setDepositValue(normalized * (depositPercentage / 100))
  }

  const updateDepositPercentage = (nextValue: number) => {
    const normalized = Math.min(Math.max(nextValue, 0), 100)
    setDepositPercentage(normalized)
    setDepositValue(totalValue * (normalized / 100))
  }

  const updateDepositValue = (nextValue: number) => {
    const normalized = Math.min(Math.max(nextValue, 0), totalValue)
    setDepositValue(normalized)
    setDepositPercentage(totalValue > 0 ? (normalized / totalValue) * 100 : 0)
  }

  const updateCaptureDate = (nextDate: string) => {
    setCaptureDate(nextDate)
    if (nextDate) setDeliveryDeadline(addCalendarDays(nextDate, deliveryDaysAfterCapture))
  }

  const updateDeliveryDeadline = (nextDate: string) => {
    const automaticDeadline = captureDate ? addCalendarDays(captureDate, defaultDeliveryDays) : ''
    const negotiatedDays = captureDate && nextDate ? Math.max(calendarDaysBetween(captureDate, nextDate), 0) : defaultDeliveryDays
    setDeliveryDeadline(nextDate)
    setDeliveryDaysAfterCapture(negotiatedDays)
    setDeliveryDeadlineNegotiated(Boolean(nextDate && automaticDeadline && nextDate !== automaticDeadline))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const projectName = String(formData.get('projectName') || defaultProjectName).trim()
    const captureDate = String(formData.get('captureDate') || '')
    const captureStartTime = String(formData.get('captureStartTime') || '')
    const deliveryDeadline = String(formData.get('deliveryDeadline') || '')

    if (!projectName) {
      onNotify({
        title: 'Nome do projeto não informado',
        description: 'Informe o nome do projeto antes de fechar o serviço.',
        tone: 'warning',
      })
      return
    }

    onSubmit({
      leadId: lead.id,
      quoteId: initialQuote?.id,
      projectName,
      serviceName: String(formData.get('serviceName') || defaultServiceName) as Project['serviceName'],
      totalValue,
      depositPercentage,
      depositValue,
      depositPaid,
      depositPaidAt: String(formData.get('depositPaidAt') || dateInput()),
      paymentMethod: String(formData.get('paymentMethod') || 'PIX') as Payment['paymentMethod'],
      captureDate,
      captureStartTime,
      captureEndTime: String(formData.get('captureEndTime') || captureStartTime),
      deliveryDeadline,
      address: String(formData.get('address') || captureAddress || lead.address),
      city: String(formData.get('city') || lead.city),
      contactName: String(formData.get('contactName') || leadName),
      contactPhone: String(formData.get('contactPhone') || localContactPhone),
      notes: String(formData.get('notes') || ''),
    })
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">Contato selecionado</p>
            <h3 className="mt-1 text-lg font-black text-gray-950">{leadName}</h3>
            <p className="text-sm text-gray-500">{contactDisplayDetail(lead)}</p>
          </div>
          <StatusBadge>{lead.pipelineStage}</StatusBadge>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
        <h3 className="text-sm font-black text-gray-950">Projeto</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <InputField label="Nome do projeto"><input className="field-input" name="projectName" defaultValue={defaultProjectName} required /></InputField>
          <InputField label="Serviço"><select className="field-input" name="serviceName" defaultValue={defaultServiceName}>{serviceTypes.map((service) => <option key={service} value={service}>{service}</option>)}</select></InputField>
          <InputField label="Cidade"><input className="field-input" name="city" defaultValue={lead.city} required /></InputField>
          <MapsAddressField
            label="Endereço da captação"
            name="address"
            value={captureAddress}
            onChange={setCaptureAddress}
          />
          <InputField label="Contato no local"><input className="field-input" name="contactName" defaultValue={leadName} /></InputField>
          <InputField label="WhatsApp do contato">
            <input readOnly type="hidden" name="contactPhone" value={localContactPhone} />
            <PhoneInput value={localContactPhone} onChange={setLocalContactPhone} />
          </InputField>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
        <h3 className="text-sm font-black text-gray-950">Valores e pagamento</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <InputField label="Valor total do serviço">
            <CurrencyInput value={totalValue} onChange={updateTotalValue} />
          </InputField>
          <InputField label="Entrada (%)"><input className="field-input" type="number" step="0.01" min="0" max="100" value={Number(depositPercentage.toFixed(2))} onChange={(event) => updateDepositPercentage(Number(event.currentTarget.value))} /></InputField>
          <InputField label="Valor da entrada">
            <CurrencyInput value={depositValue} onChange={updateDepositValue} />
          </InputField>
          <InputField label="Forma de pagamento"><select className="field-input" name="paymentMethod" defaultValue="PIX">{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></InputField>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700">
            <input className="h-4 w-4 accent-[#d4af37]" type="checkbox" checked={depositPaid} onChange={(event) => setDepositPaid(event.currentTarget.checked)} />
            Entrada já foi paga
          </label>
          <InputField label="Data da entrada"><input className="field-input" name="depositPaidAt" type="date" defaultValue={dateInput()} disabled={!depositPaid} /></InputField>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SmallStat label="Total" value={formatCurrency(totalValue)} />
          <SmallStat label="Entrada" value={formatCurrency(depositValue)} />
          <SmallStat label="Restante" value={formatCurrency(remainingValue)} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
        <h3 className="text-sm font-black text-gray-950">Agenda e entrega</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <InputField label="Data da captação"><input className="field-input" name="captureDate" type="date" value={captureDate} onChange={(event) => updateCaptureDate(event.currentTarget.value)} required /></InputField>
          <InputField label="Início"><input className="field-input" name="captureStartTime" type="time" defaultValue="09:00" required /></InputField>
          <InputField label="Fim"><input className="field-input" name="captureEndTime" type="time" defaultValue="11:00" /></InputField>
          <InputField label="Prazo máximo para entregar ao cliente">
            <input className="field-input" name="deliveryDeadline" type="date" value={deliveryDeadline} onChange={(event) => updateDeliveryDeadline(event.currentTarget.value)} required />
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
              <span>{deliveryDeadlineNegotiated ? `Entrega combinada: ${deliveryDaysAfterCapture} dia(s) após a captação.` : `Prazo padrão: ${defaultDeliveryDays} dias após a captação.`} O vermelho aparece somente depois desta data.</span>
              {deliveryDeadlineNegotiated && captureDate ? <button className="font-black text-[#8a6a00]" type="button" onClick={() => updateDeliveryDeadline(addCalendarDays(captureDate, defaultDeliveryDays))}>Usar padrão</button> : null}
            </div>
          </InputField>
        </div>
      </div>

      <div className="md:col-span-2">
        <InputField label="Observações do serviço"><textarea className="field-input min-h-24" name="notes" defaultValue={initialQuote?.notes ?? lead.notes} /></InputField>
      </div>
      <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Fechar serviço</Button>
      </div>
    </form>
  )
}

function ClientForm({ client, companies, onSubmit, onCancel }: { client?: Client; companies: Company[]; onSubmit: (values: ClientFormValues) => void; onCancel: () => void }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ClientFormInput, unknown, ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      companyId: client?.companyId ?? '',
      fullName: client?.fullName ?? '',
      jobTitle: client?.jobTitle ?? '',
      companyName: client?.companyName ?? '',
      document: client?.document ?? '',
      phone: client?.phone ?? '',
      whatsapp: client?.whatsapp ?? '',
      email: client?.email ?? '',
      instagram: client?.instagram ?? '',
      neighborhood: client?.neighborhood ?? '',
      postalCode: client?.postalCode ?? '',
      address: client?.address ?? '',
      city: client?.city ?? 'Curitiba',
      source: client?.source ?? 'Instagram',
      notes: client?.notes ?? '',
    },
  })
  const clientAddress = watch('address') ?? ''
  const clientPhone = watch('phone') ?? ''
  const clientWhatsapp = watch('whatsapp') ?? ''

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <InputField label="Nome" error={getError(errors.fullName?.message)}><input className="field-input" {...register('fullName')} /></InputField>
      <InputField label="Empresa vinculada" error={getError(errors.companyId?.message)}><select className="field-input" {...register('companyId')}><option value="">Sem empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.tradeName}</option>)}</select></InputField>
      <InputField label="Cargo ou função" error={getError(errors.jobTitle?.message)}><input className="field-input" {...register('jobTitle')} /></InputField>
      <InputField label="Empresa (texto livre)" error={getError(errors.companyName?.message)}><input className="field-input" {...register('companyName')} placeholder="Use apenas se a empresa ainda não estiver cadastrada" /></InputField>
      <InputField label="CPF/CNPJ" error={getError(errors.document?.message)}><input className="field-input" {...register('document')} /></InputField>
      <InputField label="Telefone" error={getError(errors.phone?.message)}>
        <input type="hidden" {...register('phone')} />
        <PhoneInput value={clientPhone} onChange={(nextValue) => setValue('phone', nextValue, { shouldDirty: true, shouldValidate: true })} />
      </InputField>
      <InputField label="WhatsApp" error={getError(errors.whatsapp?.message)}>
        <input type="hidden" {...register('whatsapp')} />
        <PhoneInput value={clientWhatsapp} onChange={(nextValue) => setValue('whatsapp', nextValue, { shouldDirty: true, shouldValidate: true })} />
      </InputField>
      <InputField label="E-mail" error={getError(errors.email?.message)}><input className="field-input" type="email" {...register('email')} /></InputField>
      <InputField label="Instagram" error={getError(errors.instagram?.message)}><input className="field-input" {...register('instagram')} /></InputField>
      <InputField label="Cidade" error={getError(errors.city?.message)}><input className="field-input" {...register('city')} /></InputField>
      <InputField label="Bairro" error={getError(errors.neighborhood?.message)}><input className="field-input" {...register('neighborhood')} /></InputField>
      <InputField label="CEP" error={getError(errors.postalCode?.message)}><input className="field-input" {...register('postalCode')} /></InputField>
      <InputField label="Origem" error={getError(errors.source?.message)}><Select options={leadSources} register={register('source')} /></InputField>
      <div>
        <input type="hidden" {...register('address')} />
        <MapsAddressField
          label="Endereço"
          error={getError(errors.address?.message)}
          value={clientAddress}
          onChange={(nextValue) => setValue('address', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </div>
      <div className="md:col-span-2">
        <InputField label="Observações" error={getError(errors.notes?.message)}><textarea className="field-input min-h-24" {...register('notes')} /></InputField>
      </div>
      <FormActions onCancel={onCancel} />
    </form>
  )
}

function CompanyForm({ onSubmit, onCancel }: { onSubmit: (values: CompanyFormValues) => void; onCancel: () => void }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CompanyFormInput, unknown, CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: { legalName: '', tradeName: '', document: '', email: '', phone: '', whatsapp: '', website: '', address: '', neighborhood: '', postalCode: '', city: 'Curitiba', notes: '' },
  })
  const address = watch('address') ?? ''
  const phone = watch('phone') ?? ''
  const whatsapp = watch('whatsapp') ?? ''
  return <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
    <InputField label="Nome da empresa" error={getError(errors.tradeName?.message)}><input className="field-input" {...register('tradeName')} autoFocus /></InputField>
    <InputField label="Razão social" error={getError(errors.legalName?.message)}><input className="field-input" {...register('legalName')} /></InputField>
    <InputField label="CNPJ" error={getError(errors.document?.message)}><input className="field-input" {...register('document')} /></InputField>
    <InputField label="E-mail" error={getError(errors.email?.message)}><input className="field-input" type="email" {...register('email')} /></InputField>
    <InputField label="WhatsApp" error={getError(errors.whatsapp?.message)}><input type="hidden" {...register('whatsapp')} /><PhoneInput value={whatsapp} onChange={(value) => setValue('whatsapp', value, { shouldDirty: true })} /></InputField>
    <InputField label="Telefone" error={getError(errors.phone?.message)}><input type="hidden" {...register('phone')} /><PhoneInput value={phone} onChange={(value) => setValue('phone', value, { shouldDirty: true })} /></InputField>
    <InputField label="Site" error={getError(errors.website?.message)}><input className="field-input" {...register('website')} placeholder="https://" /></InputField>
    <InputField label="Cidade" error={getError(errors.city?.message)}><input className="field-input" {...register('city')} /></InputField>
    <InputField label="Bairro" error={getError(errors.neighborhood?.message)}><input className="field-input" {...register('neighborhood')} /></InputField>
    <InputField label="CEP" error={getError(errors.postalCode?.message)}><input className="field-input" {...register('postalCode')} /></InputField>
    <div className="md:col-span-2"><input type="hidden" {...register('address')} /><MapsAddressField label="Endereço" error={getError(errors.address?.message)} value={address} onChange={(value) => setValue('address', value, { shouldDirty: true })} /></div>
    <div className="md:col-span-2"><InputField label="Observações" error={getError(errors.notes?.message)}><textarea className="field-input min-h-24" {...register('notes')} /></InputField></div>
    <FormActions onCancel={onCancel} submitLabel="Criar empresa" />
  </form>
}

function ProjectForm({
  project,
  state,
  onSubmit,
  onCancel,
}: {
  project?: Project
  state: AppState
  onSubmit: (values: ProjectFormValues) => void
  onCancel: () => void
}) {
  const settings = state.companySettings
  const defaultTotal = state.services[0]?.defaultPrice ?? 500
  const defaultDeliveryDays = Math.max(Number(settings.defaultDeliveryDays) || 7, 1)
  const initialCaptureDate = project ? project.captureDate : dateInput(3)
  const initialAutomaticDeliveryDeadline = initialCaptureDate ? addCalendarDays(initialCaptureDate, defaultDeliveryDays) : ''
  const initialDeliveryDeadline = project?.deliveryDeadline || initialAutomaticDeliveryDeadline
  const initialDeliveryDeadlineNegotiated = project?.deliveryDeadlineNegotiated ?? Boolean(
    project?.captureDate && project.deliveryDeadline && project.deliveryDeadline !== initialAutomaticDeliveryDeadline,
  )
  const initialDeliveryDaysAfterCapture = project?.deliveryDaysAfterCapture ?? (
    initialCaptureDate && initialDeliveryDeadline
      ? Math.max(calendarDaysBetween(initialCaptureDate, initialDeliveryDeadline), 0)
      : defaultDeliveryDays
  )
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProjectFormInput, unknown, ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project?.name ?? '',
      clientId: project?.clientId ?? '',
      leadId: project?.leadId ?? '',
      serviceName: project?.serviceName ?? 'Fotos e vídeo',
      description: project?.description ?? '',
      captureDate: initialCaptureDate,
      captureStartTime: project?.captureStartTime ?? '09:00',
      captureEndTime: project?.captureEndTime ?? '11:00',
      deliveryDeadline: initialDeliveryDeadline,
      deliveryDeadlineNegotiated: initialDeliveryDeadlineNegotiated,
      deliveryDaysAfterCapture: initialDeliveryDaysAfterCapture,
      address: project?.address ?? '',
      city: project?.city ?? 'Curitiba',
      contactName: project?.contactName ?? '',
      contactPhone: project?.contactPhone ?? '',
      totalValue: project?.totalValue ?? defaultTotal,
      estimatedHours: project?.estimatedHours ?? 0,
      workedHours: project?.workedHours ?? 0,
      depositValue: project?.depositValue ?? defaultTotal * (settings.defaultDepositPercentage / 100),
      discountValue: project?.discountValue ?? 0,
      travelFee: project?.travelFee ?? 0,
      projectStatus: project?.projectStatus ?? 'Confirmado',
      financialStatus: project?.financialStatus ?? 'Aguardando sinal',
      paymentMethod: project?.paymentMethod ?? 'PIX',
      notes: project?.notes ?? '',
      manualCreationReason: project?.manualCreationReason ?? '',
    },
  })
  const projectAddress = watch('address') ?? ''
  const captureDate = watch('captureDate') ?? ''
  const deliveryDeadline = watch('deliveryDeadline') ?? ''
  const deliveryDeadlineNegotiated = Boolean(watch('deliveryDeadlineNegotiated'))
  const deliveryDaysAfterCapture = Math.max(Number(watch('deliveryDaysAfterCapture')) || 0, 0)
  const totalValue = Number(watch('totalValue') || 0)
  const depositValue = Number(watch('depositValue') || 0)
  const discountValue = Number(watch('discountValue') || 0)
  const travelFee = Number(watch('travelFee') || 0)
  const contactPhone = watch('contactPhone') ?? ''
  const selectedClientId = watch('clientId') ?? ''
  const selectedLeadId = watch('leadId') ?? ''
  const selectedContactKey = selectedLeadId ? `lead:${selectedLeadId}` : selectedClientId ? `client:${selectedClientId}` : ''
  const contactOptions = [
    ...state.leads.filter((lead) => !lead.archived && !lead.deletedAt).map((lead) => ({
      key: `lead:${lead.id}`,
      label: contactDisplayName(lead),
      detail: [lead.whatsapp || lead.phone || 'sem WhatsApp', lead.city || 'sem cidade'].join(' • '),
    })),
    ...state.clients
      .filter((client) => client.id === selectedClientId || !state.leads.some((lead) => sameContact(lead, client)))
      .map((client) => ({
        key: `client:${client.id}`,
        label: contactDisplayName(client),
        detail: [client.whatsapp || client.phone || 'sem WhatsApp', client.city || 'sem cidade'].join(' • '),
      })),
  ]

  useEffect(() => {
    if (!captureDate) return
    const expectedDeadline = addCalendarDays(
      captureDate,
      deliveryDeadlineNegotiated ? deliveryDaysAfterCapture : defaultDeliveryDays,
    )
    if (deliveryDeadline !== expectedDeadline) {
      setValue('deliveryDeadline', expectedDeadline, { shouldDirty: true, shouldValidate: true })
    }
  }, [captureDate, defaultDeliveryDays, deliveryDeadline, deliveryDeadlineNegotiated, deliveryDaysAfterCapture, setValue])

  const changeProjectDeliveryDeadline = (nextDate: string) => {
    const automaticDeadline = captureDate ? addCalendarDays(captureDate, defaultDeliveryDays) : ''
    const nextDays = captureDate && nextDate ? Math.max(calendarDaysBetween(captureDate, nextDate), 0) : defaultDeliveryDays
    setValue('deliveryDeadline', nextDate, { shouldDirty: true, shouldValidate: true })
    setValue('deliveryDaysAfterCapture', nextDays, { shouldDirty: true })
    setValue('deliveryDeadlineNegotiated', Boolean(nextDate && automaticDeadline && nextDate !== automaticDeadline), { shouldDirty: true })
  }

  const chooseProjectContact = (key: string) => {
    const [type, id] = key.split(':')
    if (type === 'lead') {
      const lead = state.leads.find((item) => item.id === id)
      const client = lead ? findClientForLead(state.clients, lead) : undefined
      setValue('leadId', id, { shouldDirty: true, shouldValidate: true })
      setValue('clientId', client?.id ?? '', { shouldDirty: true, shouldValidate: true })
      if (lead) {
        if (!watch('city')) setValue('city', lead.city || 'Curitiba')
        if (!watch('address')) setValue('address', lead.address)
        if (!watch('contactName')) setValue('contactName', contactDisplayName(lead))
        if (!watch('contactPhone')) setValue('contactPhone', lead.whatsapp || lead.phone)
      }
      return
    }
    if (type === 'client') {
      const client = state.clients.find((item) => item.id === id)
      setValue('clientId', id, { shouldDirty: true, shouldValidate: true })
      setValue('leadId', '', { shouldDirty: true, shouldValidate: true })
      if (client) {
        if (!watch('city')) setValue('city', client.city || 'Curitiba')
        if (!watch('address')) setValue('address', client.address)
        if (!watch('contactName')) setValue('contactName', contactDisplayName(client))
        if (!watch('contactPhone')) setValue('contactPhone', client.whatsapp || client.phone)
      }
      return
    }
    setValue('clientId', '', { shouldDirty: true, shouldValidate: true })
    setValue('leadId', '', { shouldDirty: true, shouldValidate: true })
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register('clientId')} />
      <input type="hidden" {...register('leadId')} />
      <InputField label="Nome do projeto" error={getError(errors.name?.message)}><input className="field-input" {...register('name')} /></InputField>
      <InputField label="Contato no CRM" error={getError(errors.leadId?.message || errors.clientId?.message)}>
        <select className="field-input" value={selectedContactKey} onChange={(event) => chooseProjectContact(event.target.value)}>
          <option value="">Selecione um contato</option>
          {contactOptions.map((contact) => (
            <option key={contact.key} value={contact.key}>
              {contact.label} | {contact.detail}
            </option>
          ))}
        </select>
      </InputField>
      <InputField label="Tipo de serviço" error={getError(errors.serviceName?.message)}><Select options={serviceTypes} register={register('serviceName')} /></InputField>
      <InputField label="Data de captação" error={getError(errors.captureDate?.message)}><input className="field-input" type="date" {...register('captureDate')} /></InputField>
      <InputField label="Horário inicial" error={getError(errors.captureStartTime?.message)}><input className="field-input" type="time" {...register('captureStartTime')} /></InputField>
      <InputField label="Horário final" error={getError(errors.captureEndTime?.message)}><input className="field-input" type="time" {...register('captureEndTime')} /></InputField>
      <InputField label="Prazo máximo para entregar ao cliente" error={getError(errors.deliveryDeadline?.message)}>
        <input className="field-input" type="date" value={deliveryDeadline} onChange={(event) => changeProjectDeliveryDeadline(event.currentTarget.value)} required />
        <input type="hidden" {...register('deliveryDeadline')} />
        <input className="hidden" type="checkbox" {...register('deliveryDeadlineNegotiated')} />
        <input type="hidden" {...register('deliveryDaysAfterCapture')} />
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
          <span>{deliveryDeadlineNegotiated ? `Entrega combinada: ${deliveryDaysAfterCapture} dia(s) após a captação.` : `Prazo padrão: ${defaultDeliveryDays} dias após a captação.`} O vermelho aparece somente depois desta data.</span>
          {deliveryDeadlineNegotiated && captureDate ? <button className="font-black text-[#8a6a00]" type="button" onClick={() => changeProjectDeliveryDeadline(addCalendarDays(captureDate, defaultDeliveryDays))}>Usar padrão</button> : null}
        </div>
      </InputField>
      <InputField label="Cidade" error={getError(errors.city?.message)}><input className="field-input" {...register('city')} /></InputField>
      <div>
        <input type="hidden" {...register('address')} />
        <MapsAddressField
          label="Endereço"
          error={getError(errors.address?.message)}
          value={projectAddress}
          onChange={(nextValue) => setValue('address', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </div>
      <InputField label="Contato no local" error={getError(errors.contactName?.message)}><input className="field-input" {...register('contactName')} /></InputField>
      <InputField label="WhatsApp do contato" error={getError(errors.contactPhone?.message)}>
        <input type="hidden" {...register('contactPhone')} />
        <PhoneInput value={contactPhone} onChange={(nextValue) => setValue('contactPhone', nextValue, { shouldDirty: true, shouldValidate: true })} />
      </InputField>
      <InputField label="Valor total" error={getError(errors.totalValue?.message)}>
        <input type="hidden" {...register('totalValue')} />
        <CurrencyInput
          value={totalValue}
          onChange={(nextValue) => setValue('totalValue', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </InputField>
      <InputField label="Valor do sinal" error={getError(errors.depositValue?.message)}>
        <input type="hidden" {...register('depositValue')} />
        <CurrencyInput
          value={depositValue}
          onChange={(nextValue) => setValue('depositValue', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </InputField>
      <InputField label="Desconto" error={getError(errors.discountValue?.message)}>
        <input type="hidden" {...register('discountValue')} />
        <CurrencyInput
          value={discountValue}
          onChange={(nextValue) => setValue('discountValue', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </InputField>
      <InputField label="Adicional de deslocamento" error={getError(errors.travelFee?.message)}>
        <input type="hidden" {...register('travelFee')} />
        <CurrencyInput
          value={travelFee}
          onChange={(nextValue) => setValue('travelFee', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </InputField>
      <InputField label="Horas estimadas" error={getError(errors.estimatedHours?.message)}><input className="field-input" min="0" step="0.5" type="number" {...register('estimatedHours')} /></InputField>
      <InputField label="Horas trabalhadas" error={getError(errors.workedHours?.message)}><input className="field-input" min="0" step="0.5" type="number" {...register('workedHours')} /></InputField>
      <div><input type="hidden" {...register('projectStatus')} /><SmallStat label="Status do projeto" value={project?.projectStatus ?? 'Confirmado'} /></div>
      <div><input type="hidden" {...register('financialStatus')} /><SmallStat label="Status financeiro" value={project?.financialStatus ?? 'Aguardando sinal'} /></div>
      <InputField label="Forma de pagamento" error={getError(errors.paymentMethod?.message)}><Select options={paymentMethods} register={register('paymentMethod')} /></InputField>
      <div className="md:col-span-2">
        <InputField label="Descrição e observações" error={getError(errors.notes?.message)}><textarea className="field-input min-h-24" {...register('notes')} /></InputField>
      </div>
      {!project ? (
        <div className="md:col-span-2">
          <InputField label="Justificativa para criação manual" error={getError(errors.manualCreationReason?.message)}>
            <textarea className="field-input min-h-20" required {...register('manualCreationReason')} placeholder="Explique por que este projeto não será criado a partir de uma proposta aceita." />
          </InputField>
        </div>
      ) : null}
      <FormActions onCancel={onCancel} />
    </form>
  )
}

function TaskForm({
  state,
  initialValues,
  onSubmit,
  onCancel,
}: {
  state: AppState
  initialValues?: TaskFormDefaults
  onSubmit: (values: TaskFormValues) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [taskType, setTaskType] = useState<NonNullable<TaskItem['taskType']>>('Tarefa')
  const [dueAt, setDueAt] = useState(initialValues?.dueAt ?? dateTimeInput(0, new Date().getHours() + 1))
  const [durationMinutes, setDurationMinutes] = useState(initialValues?.durationMinutes ?? 30)
  const [priority, setPriority] = useState<TaskItem['priority']>('Média')
  const [responsibleUserId, setResponsibleUserId] = useState(state.users.find((user) => user.active)?.id ?? '')
  const [contactKey, setContactKey] = useState(initialValues?.leadId ? `lead:${initialValues.leadId}` : initialValues?.clientId ? `client:${initialValues.clientId}` : '')
  const [error, setError] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const [contactType, contactId] = contactKey.split(':')
    if (title.trim().length < 2) {
      setError('Informe o título da tarefa.')
      return
    }
    if (!contactId) {
      setError('Vincule a tarefa a um contato.')
      return
    }
    if (!dueAt) {
      setError('Informe a data e o horário da tarefa.')
      return
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      taskType,
      dueAt,
      durationMinutes,
      priority,
      leadId: contactType === 'lead' ? contactId : undefined,
      clientId: contactType === 'client' ? contactId : undefined,
      responsibleUserId,
    })
  }

  return <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
    {error ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800 sm:col-span-2">{error}</div> : null}
    <div className="sm:col-span-2"><InputField label="Tarefa"><input className="field-input" value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="Ex.: Confirmar horário com o cliente" autoFocus required /></InputField></div>
    <InputField label="Tipo"><select className="field-input" value={taskType} onChange={(event) => setTaskType(event.currentTarget.value as NonNullable<TaskItem['taskType']>)}>{['Tarefa', 'Ligação', 'E-mail', 'WhatsApp', 'Follow-up'].map((type) => <option key={type}>{type}</option>)}</select></InputField>
    <InputField label="Contato do CRM"><select className="field-input" value={contactKey} onChange={(event) => setContactKey(event.currentTarget.value)} required><option value="">Selecione o contato</option><optgroup label="Contatos">{state.leads.filter((lead) => !lead.archived && !lead.deletedAt).map((lead) => <option key={lead.id} value={`lead:${lead.id}`}>{contactDisplayName(lead)}</option>)}</optgroup><optgroup label="Clientes">{state.clients.filter((client) => !client.archived).map((client) => <option key={client.id} value={`client:${client.id}`}>{contactDisplayName(client)}</option>)}</optgroup></select></InputField>
    <InputField label="Data e horário"><input className="field-input" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.currentTarget.value)} required /></InputField>
    <InputField label="Duração"><select className="field-input" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.currentTarget.value))}>{[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutos` : minutes === 60 ? '1 hora' : `${minutes / 60} horas`}</option>)}</select></InputField>
    <InputField label="Prioridade"><select className="field-input" value={priority} onChange={(event) => setPriority(event.currentTarget.value as TaskItem['priority'])}>{['Baixa', 'Média', 'Alta', 'Urgente'].map((value) => <option key={value}>{value}</option>)}</select></InputField>
    <InputField label="Responsável"><select className="field-input" value={responsibleUserId} onChange={(event) => setResponsibleUserId(event.currentTarget.value)}>{state.users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></InputField>
    <div className="sm:col-span-2"><InputField label="Observações"><textarea className="field-input min-h-20" value={description} onChange={(event) => setDescription(event.currentTarget.value)} placeholder="Contexto ou próximo passo" /></InputField></div>
    <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button><Button type="submit"><CheckCircle2 size={16} /> Criar tarefa</Button></div>
  </form>
}

function AppointmentForm({
  state,
  appointment,
  initialValues,
  onSubmit,
  onCancel,
  onDelete,
}: {
  state: AppState
  appointment?: Appointment
  initialValues?: AppointmentFormDefaults
  onSubmit: (values: AppointmentFormValues) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<AppointmentFormInput, unknown, AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      title: initialValues?.title ?? '',
      appointmentType: initialValues?.appointmentType ?? 'Tarefa',
      clientId: initialValues?.clientId ?? '',
      leadId: initialValues?.leadId ?? '',
      projectId: initialValues?.projectId ?? '',
      startAt: initialValues?.startAt ?? dateTimeInput(1, 9),
      endAt: initialValues?.endAt ?? dateTimeInput(1, 10),
      address: initialValues?.address ?? '',
      notes: initialValues?.notes ?? '',
      status: initialValues?.status ?? 'Agendado',
      color: initialValues?.color ?? '#d8a500',
      createGoogleCalendar: initialValues?.createGoogleCalendar ?? true,
      rescheduleReason: '',
    },
  })
  const isEditing = Boolean(appointment)
  const watchedProjectId = watch('projectId')
  const watchedClientId = watch('clientId')
  const watchedLeadId = watch('leadId')
  const watchedStatus = watch('status')
  const watchedAppointmentType = watch('appointmentType')
  const watchedColor = watch('color')
  const watchedStartAt = watch('startAt')
  const watchedEndAt = watch('endAt')
  const watchedAddress = watch('address') ?? ''
  const watchedCreateGoogleCalendar = watch('createGoogleCalendar')
  const currentDuration = getDurationMinutes(watchedStartAt, watchedEndAt)
  const selectedContactKey = watchedLeadId ? `lead:${watchedLeadId}` : watchedClientId ? `client:${watchedClientId}` : ''
  const contactOptions = [
    ...state.leads.filter((lead) => !lead.archived && !lead.deletedAt).map((lead) => ({
      key: `lead:${lead.id}`,
      label: contactDisplayName(lead),
      detail: lead.city || 'Sem cidade',
    })),
    ...state.clients.map((client) => ({
      key: `client:${client.id}`,
      label: contactDisplayName(client),
      detail: client.city || 'Sem cidade',
    })),
  ]
  const selectedProject = watchedProjectId ? state.projects.find((project) => project.id === watchedProjectId) : undefined
  const selectedContactLabel = contactOptions.find((contact) => contact.key === selectedContactKey)?.label ?? 'Sem contato vinculado'
  const selectedProjectLabel = selectedProject
    ? `${selectedProject.projectCode} - ${selectedProject.name}`
    : watchedProjectId
      ? 'Projeto não localizado'
      : 'Sem projeto vinculado'

  const chooseContact = (key: string) => {
    const [type, id] = key.split(':')
    if (type === 'lead') {
      setValue('leadId', id)
      setValue('clientId', '')
      return
    }
    if (type === 'client') {
      setValue('clientId', id)
      setValue('leadId', '')
      return
    }
    setValue('clientId', '')
    setValue('leadId', '')
  }

  useEffect(() => {
    if (!watchedProjectId) return
    const project = state.projects.find((item) => item.id === watchedProjectId)
    if (!project) return
    setValue('clientId', project.clientId)
    setValue('leadId', project.leadId ?? '')
    if (!getValues('address')) setValue('address', [project.address, project.city].filter(Boolean).join(' - '))
    if (!getValues('title') || getValues('title') === 'Tarefa') setValue('title', `Hero Drone - Captação - ${project.contactName || project.name}`)
  }, [getValues, setValue, state.projects, watchedProjectId])

  useEffect(() => {
    if (!watchedClientId) return
    const client = state.clients.find((item) => item.id === watchedClientId)
    if (!client) return
    if (!getValues('address')) setValue('address', [client.address, client.city].filter(Boolean).join(' - '))
    if (!getValues('title') || getValues('title') === 'Tarefa') setValue('title', `Tarefa - ${contactDisplayName(client)}`)
  }, [getValues, setValue, state.clients, watchedClientId])

  useEffect(() => {
    if (!watchedLeadId) return
    const lead = state.leads.find((item) => item.id === watchedLeadId)
    if (!lead) return
    if (!getValues('address')) setValue('address', [lead.address, lead.city].filter(Boolean).join(' - '))
    if (!getValues('title') || getValues('title') === 'Tarefa') setValue('title', `Tarefa - ${contactDisplayName(lead)}`)
  }, [getValues, setValue, state.leads, watchedLeadId])

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register('clientId')} />
      <input type="hidden" {...register('leadId')} />
      <input type="hidden" {...register('color')} />
      <input type="hidden" {...register('address')} />
      {isEditing ? (
        <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-500">Agendamento vinculado</p>
              <h3 className="mt-1 text-base font-black text-gray-950">{appointment?.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{selectedContactLabel}</p>
              <p className="text-sm text-gray-500">{selectedProjectLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Tag>{watchedAppointmentType}</Tag>
              <StatusBadge>{watchedStatus}</StatusBadge>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-600">Edite só o que muda de fato: nome, horário, endereço, status e observações.</p>
        </div>
      ) : null}
      <InputField label={isEditing ? 'Título' : 'Título da tarefa'} error={getError(errors.title?.message)}><input className="field-input" {...register('title')} /></InputField>
      {!isEditing ? <InputField label="Tipo" error={getError(errors.appointmentType?.message)}><Select options={appointmentTypes} register={register('appointmentType')} /></InputField> : null}
      {!isEditing ? (
        <InputField label="Contato no CRM" error={getError(errors.clientId?.message || errors.leadId?.message)}>
          <select className="field-input" value={selectedContactKey} onChange={(event) => chooseContact(event.target.value)}>
            <option value="">Nenhum</option>
            {contactOptions.map((contact) => (
              <option key={contact.key} value={contact.key}>
                {contact.label} | {contact.detail}
              </option>
            ))}
          </select>
        </InputField>
      ) : null}
      {!isEditing ? <InputField label="Projeto" error={getError(errors.projectId?.message)}><select className="field-input" {...register('projectId')}><option value="">Nenhum</option>{state.projects.filter((project) => !project.deletedAt && !project.archivedAt).map((project) => <option key={project.id} value={project.id}>{project.projectCode} - {project.name}</option>)}</select></InputField> : null}
      <InputField label="Status" error={getError(errors.status?.message)}><Select options={appointmentStatuses} register={register('status')} /></InputField>
      <InputField label="Início" error={getError(errors.startAt?.message)}><input className="field-input" type="datetime-local" {...register('startAt')} /></InputField>
      <InputField label="Fim" error={getError(errors.endAt?.message)}><input className="field-input" type="datetime-local" {...register('endAt')} /></InputField>
      <div className="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700">
        Tempo calculado: <span className="text-gray-950">{formatDurationLabel(currentDuration)}</span>
      </div>
      <div className="md:col-span-2">
        <MapsAddressField
          label="Endereço / local"
          error={getError(errors.address?.message)}
          value={watchedAddress}
          onChange={(nextValue) => setValue('address', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </div>
      {!isEditing ? (
        <div className="md:col-span-2">
          <InputField label="Cor" error={getError(errors.color?.message)}>
            <div className="flex flex-wrap gap-1.5">
              {appointmentColorOptions.map((option) => (
                <button
                  key={option.value}
                  aria-label={option.label}
                  aria-pressed={watchedColor === option.value}
                  className={`focus-ring h-5 w-5 rounded-full border transition ${watchedColor === option.value ? 'border-gray-950 ring-2 ring-[#d8a500]/35' : 'border-gray-200'}`}
                  style={{ backgroundColor: option.value }}
                  type="button"
                  onClick={() => setValue('color', option.value)}
                  title={option.label}
                />
              ))}
            </div>
          </InputField>
        </div>
      ) : null}
      <div className="md:col-span-2"><InputField label="Observações" error={getError(errors.notes?.message)}><textarea className="field-input min-h-24" {...register('notes')} /></InputField></div>
      {!isEditing ? (
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-bold text-gray-700 md:col-span-2">
          <input className="h-5 w-5 accent-[#d8a500]" type="checkbox" {...register('createGoogleCalendar')} />
          Abrir evento no Google Calendar ao salvar {watchedCreateGoogleCalendar ? '(ativado)' : '(desativado)'}
        </label>
      ) : null}
      <FormActions
        onCancel={onCancel}
        leftAction={appointment && onDelete ? (
          <Button variant="danger" type="button" onClick={onDelete}>
            <Trash2 size={16} /> Excluir agendamento
          </Button>
        ) : undefined}
        submitLabel={appointment ? 'Salvar agendamento' : 'Criar agendamento'}
      />
    </form>
  )
}
function QuoteDepositForm({
  quote,
  state,
  onSubmit,
  onCancel,
}: {
  quote: Quote
  state: AppState
  onSubmit: (values: QuotePaymentFormValues) => void
  onCancel: () => void
}) {
  const existing = state.payments.find((payment) => payment.sourceKey === `quote-deposit:${quote.id}`)
  const activeAccounts = state.bankAccounts.filter((bankAccount) => bankAccount.active || bankAccount.id === existing?.bankAccountId)
  const [amount, setAmount] = useState(existing?.amount ?? quote.depositValue)
  const [paidAt, setPaidAt] = useState(dateTimeInput(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<Payment['paymentMethod']>(existing?.paymentMethod ?? 'PIX')
  const [bankAccountId, setBankAccountId] = useState(existing?.bankAccountId ?? activeAccounts[0]?.id ?? '')
  const [transactionNumber, setTransactionNumber] = useState(existing?.transactionNumber ?? '')
  const [receiptUrl, setReceiptUrl] = useState(existing?.receiptUrl ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [confirmedReceived, setConfirmedReceived] = useState(false)
  const [fileName, setFileName] = useState('')

  const attachFile = async (file?: File) => {
    if (!file) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) return
    setReceiptUrl(await readFileAsDataUrl(file))
    setFileName(file.name)
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        const bankAccount = state.bankAccounts.find((item) => item.id === bankAccountId)
        onSubmit({ amount, paidAt, paymentMethod, bankAccountId, account: bankAccount?.name ?? '', transactionNumber, receiptUrl, notes, confirmedReceived })
      }}
    >
      <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-3">
        <SmallStat label="Valor total" value={formatCurrency(quote.totalValue)} />
        <SmallStat label="Entrada prevista" value={formatCurrency(quote.depositValue)} />
        <SmallStat label="Saldo previsto" value={formatCurrency(Math.max(quote.totalValue - quote.depositValue, 0))} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InputField label="Valor recebido"><CurrencyInput value={amount} onChange={setAmount} /></InputField>
        <InputField label="Data do pagamento"><input className="field-input" required type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></InputField>
        <InputField label="Forma de pagamento"><select className="field-input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as Payment['paymentMethod'])}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></InputField>
        <InputField label="Conta de destino">
          <select className="field-input" required value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
            <option value="">Selecione a conta</option>
            {activeAccounts.map((bankAccount) => <option key={bankAccount.id} value={bankAccount.id}>{bankAccount.name} · {bankAccount.bankName}</option>)}
          </select>
        </InputField>
        <InputField label="Número da transação"><input className="field-input" value={transactionNumber} onChange={(event) => setTransactionNumber(event.target.value)} /></InputField>
        <InputField label="Comprovante">
          <input className="field-input file:mr-3 file:rounded-md file:border-0 file:bg-[#d8a500] file:px-3 file:py-1.5 file:font-bold" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => void attachFile(event.currentTarget.files?.[0])} />
        </InputField>
      </div>
      {fileName ? <p className="text-sm font-bold text-gray-500">Arquivo selecionado: {fileName}</p> : null}
      <InputField label="Observações"><textarea className="field-input min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} /></InputField>
      <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
        <input className="mt-0.5 h-5 w-5 accent-emerald-600" required type="checkbox" checked={confirmedReceived} onChange={(event) => setConfirmedReceived(event.target.checked)} />
        Pagamento recebido e conferido. O comprovante anexado sozinho não confirma o recebimento.
      </label>
      <FormActions onCancel={onCancel} submitLabel="Confirmar entrada" />
    </form>
  )
}

function ReceiptForm({
  payment,
  state,
  onSubmit,
  onCancel,
}: {
  payment: Payment
  state: AppState
  onSubmit: (paymentId: string, values: ReceiptFormValues) => void
  onCancel: () => void
}) {
  const existingFiles = state.files.filter((file) => file.paymentId === payment.id && !file.deletedAt)
  const legacyReceipt = payment.receiptUrl && !existingFiles.some((file) => file.fileUrl === payment.receiptUrl || file.externalLink === payment.receiptUrl) ? { id: 'legacy', fileName: 'Comprovante anterior', fileUrl: payment.receiptUrl, receiptStatus: 'Anexado' as const } : undefined
  const [receipts, setReceipts] = useState<ReceiptFormValues['receipts']>([])
  const [linkUrl, setLinkUrl] = useState('')
  const [preview, setPreview] = useState<{ url: string; fileName: string } | null>(null)
  const client = state.clients.find((item) => item.id === payment.clientId)
  const project = state.projects.find((item) => item.id === payment.projectId)

  const attachFiles = async (files: FileList | null) => {
    if (!files) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    const next = await Promise.all(Array.from(files).filter((file) => allowed.includes(file.type)).map(async (file) => ({ receiptUrl: await readFileAsDataUrl(file), fileName: file.name, fileType: file.type, fileSize: file.size, status: 'Anexado' as const })))
    setReceipts((current) => [...current, ...next])
  }

  return (
    <>
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(payment.id, { receipts })
      }}
    >
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-black text-gray-950">{client?.companyName ?? 'Cliente'} • {project?.projectCode ?? 'Sem projeto'}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <SmallStat label="Tipo" value={payment.paymentType} />
          <SmallStat label="Valor" value={formatCurrency(payment.amount)} />
          <SmallStat label="Status" value={payment.status} />
        </div>
      </div>

      <InputField label="Arquivo do comprovante">
        <input
          className="field-input file:mr-3 file:rounded-md file:border-0 file:bg-[#d4af37] file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-black"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(event) => void attachFiles(event.currentTarget.files)}
        />
      </InputField>

      <InputField label="Ou link do comprovante">
        <div className="flex gap-2"><input className="field-input" placeholder="https://..." value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} /><Button variant="secondary" type="button" onClick={() => { if (!linkUrl.trim()) return; setReceipts((current) => [...current, { receiptUrl: linkUrl.trim(), fileName: `Comprovante ${existingFiles.length + current.length + 1}`, fileType: 'payment-receipt', status: 'Anexado' }]); setLinkUrl('') }}>Adicionar link</Button></div>
      </InputField>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="flex items-center justify-between"><strong className="text-sm text-gray-950">Comprovantes existentes</strong><StatusBadge>{existingFiles.length + (legacyReceipt ? 1 : 0)}</StatusBadge></div>{[...existingFiles, ...(legacyReceipt ? [legacyReceipt] : [])].map((file) => { const url = file.fileUrl || ('externalLink' in file ? file.externalLink : '') || ''; return <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-2"><div><strong className="text-sm text-gray-800">{file.fileName}</strong><span className="ml-2 text-xs text-gray-500">{file.receiptStatus || 'Anexado'}</span></div><div className="flex gap-1"><Button className="min-h-8 px-2 py-1 text-xs" variant="secondary" type="button" onClick={() => setPreview({ url, fileName: file.fileName })}><Eye size={13} /> Ver</Button><Button className="min-h-8 px-2 py-1 text-xs" variant="secondary" type="button" onClick={() => downloadUrl(url, file.fileName)}><Download size={13} /> Baixar</Button></div></div> })}{!existingFiles.length && !legacyReceipt ? <p className="text-sm text-gray-500">Nenhum comprovante anexado ainda.</p> : null}</div>

      {receipts.length ? <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="flex items-center justify-between"><strong className="text-sm text-amber-900">Novos comprovantes</strong><StatusBadge>{receipts.length}</StatusBadge></div>{receipts.map((receipt, index) => <div key={`${receipt.fileName}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 text-sm"><span className="truncate font-bold text-gray-700">{receipt.fileName}{receipt.fileSize ? ` · ${(receipt.fileSize / 1024).toFixed(1)} KB` : ''}</span><Button className="min-h-8 px-2 py-1 text-xs" variant="ghost" type="button" onClick={() => setReceipts((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</Button></div>)}</div> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button disabled={!receipts.length} type="submit">Adicionar {receipts.length || ''} comprovante(s)</Button>
      </div>
    </form>
    {preview ? <ReceiptPreviewModal url={preview.url} fileName={preview.fileName} onClose={() => setPreview(null)} /> : null}
    </>
  )
}

function BankAccountForm({ account, onSubmit, onCancel }: { account?: BankAccount; onSubmit: (values: BankAccountFormValues) => void; onCancel: () => void }) {
  const [name, setName] = useState(account?.name ?? '')
  const [bankName, setBankName] = useState(account?.bankName ?? '')
  const [accountType, setAccountType] = useState<BankAccount['accountType']>(account?.accountType ?? 'Conta corrente')
  const [agency, setAgency] = useState(account?.agency ?? '')
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? '')
  const [openingBalance, setOpeningBalance] = useState(account?.openingBalance ?? 0)
  const [statementBalance, setStatementBalance] = useState(account?.statementBalance ?? account?.openingBalance ?? 0)
  const [reconciledAt, setReconciledAt] = useState(account?.reconciledAt ? dateInputFromDate(new Date(account.reconciledAt)) : '')
  const [statementFileName, setStatementFileName] = useState('')
  const [active, setActive] = useState(account?.active ?? true)
  const [notes, setNotes] = useState(account?.notes ?? '')

  return (
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault()
      onSubmit({ name, bankName, accountType, agency, accountNumber, openingBalance, statementBalance, reconciledAt: reconciledAt ? asIsoFromInput(`${reconciledAt}T12:00`) : undefined, active, notes })
    }}>
      <div className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-200 text-amber-900"><Landmark size={22} /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-wide text-amber-800">Prévia da conta</p><p className="truncate text-lg font-black text-gray-950">{name || 'Nome da conta'}</p><p className="truncate text-sm text-gray-600">{bankName || 'Instituição financeira'} · {accountType}</p></div>
        <div className="hidden text-right sm:block"><p className="text-xs font-bold text-gray-500">Saldo inicial</p><p className="font-black text-gray-950">{formatCurrency(openingBalance)}</p></div>
      </div>
      <section className="rounded-2xl border border-gray-200 p-4">
        <div className="mb-4"><h3 className="font-black text-gray-950">Identificação</h3><p className="text-sm text-gray-500">Como esta conta aparecerá nos lançamentos financeiros.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Apelido da conta"><input className="field-input" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Conta principal" /></InputField>
          <InputField label="Banco ou instituição"><input className="field-input" required value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Ex.: Nubank, Itaú ou Caixa" /></InputField>
          <InputField label="Tipo de conta"><select className="field-input" value={accountType} onChange={(event) => setAccountType(event.target.value as BankAccount['accountType'])}>{bankAccountTypes.map((type) => <option key={type}>{type}</option>)}</select></InputField>
          <InputField label="Saldo inicial"><CurrencyInput value={openingBalance} onChange={setOpeningBalance} /></InputField>
        </div>
        <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-500"><strong className="text-gray-700">Sobre o saldo inicial:</strong> informe quanto já existia na conta antes de começar a registrar movimentações no FlyFlow.</p>
      </section>
      <section className="rounded-2xl border border-gray-200 p-4">
        <div className="mb-4"><h3 className="font-black text-gray-950">Conciliação bancária</h3><p className="text-sm text-gray-500">Informe o saldo exibido pelo banco para identificar diferenças no cadastro.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><InputField label="Saldo no extrato"><CurrencyInput value={statementBalance} onChange={setStatementBalance} /></InputField><InputField label="Conferido em"><input className="field-input" type="date" value={reconciledAt} onChange={(event) => setReconciledAt(event.target.value)} /></InputField></div>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm font-bold text-gray-700"><span>{statementFileName || 'Importar extrato CSV para preencher o saldo'}</span><input className="sr-only" accept=".csv,text/csv" type="file" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const text = await file.text(); const lines = text.split(/\r?\n/).filter(Boolean); const delimiter = (lines[0]?.match(/;/g)?.length || 0) >= (lines[0]?.match(/,/g)?.length || 0) ? ';' : ','; const headers = (lines[0] || '').split(delimiter).map((value) => value.trim().toLowerCase()); const balanceIndex = headers.findIndex((header) => header.includes('saldo') || header.includes('balance')); const lastColumns = (lines.at(-1) || '').split(delimiter); const rawValue = balanceIndex >= 0 ? lastColumns[balanceIndex] : lastColumns.at(-1); const normalized = String(rawValue || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'); const parsed = Number(normalized); if (Number.isFinite(parsed)) { setStatementBalance(parsed); setReconciledAt(dateInput()); setStatementFileName(file.name) } else setStatementFileName('Não foi possível identificar o saldo no CSV') }} /></label>
      </section>
      <section className="rounded-2xl border border-gray-200 p-4">
        <div className="mb-4"><h3 className="font-black text-gray-950">Dados bancários</h3><p className="text-sm text-gray-500">Informações opcionais para facilitar a identificação.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><InputField label="Agência (opcional)"><input className="field-input" value={agency} onChange={(event) => setAgency(event.target.value)} placeholder="0001" /></InputField><InputField label="Número da conta (opcional)"><input className="field-input" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="00000-0" /></InputField></div>
      </section>
      <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
        <input className="mt-0.5 h-5 w-5 accent-emerald-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span><strong className="block">Conta ativa</strong><span className="mt-0.5 block font-normal">Disponível para receber pagamentos, pagar despesas e realizar transferências.</span></span>
      </label>
      <InputField label="Observações"><textarea className="field-input min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informações adicionais sobre esta conta…" /></InputField>
      <FormActions onCancel={onCancel} submitLabel={account ? 'Salvar conta' : 'Criar conta'} />
    </form>
  )
}

function BankTransferForm({ state, transfer, onSubmit, onCancel }: { state: AppState; transfer?: BankTransfer; onSubmit: (values: BankTransferFormValues) => void; onCancel: () => void }) {
  const activeAccounts = state.bankAccounts.filter((account) => account.active || account.id === transfer?.fromAccountId || account.id === transfer?.toAccountId)
  const [fromAccountId, setFromAccountId] = useState(transfer?.fromAccountId ?? activeAccounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(transfer?.toAccountId ?? activeAccounts.find((account) => account.id !== activeAccounts[0]?.id)?.id ?? '')
  const [amount, setAmount] = useState(transfer?.amount ?? 0)
  const [transferredAt, setTransferredAt] = useState(transfer?.transferredAt ? dateTimeInputFromDate(new Date(transfer.transferredAt)) : dateTimeInput(0, 10))
  const [description, setDescription] = useState(transfer?.description ?? '')
  const source = state.bankAccounts.find((account) => account.id === fromAccountId)
  const sourceBalance = source ? getBankAccountBalance(state, source) + (transfer?.fromAccountId === source.id ? transfer.amount : 0) - (transfer?.toAccountId === source.id ? transfer.amount : 0) : 0

  return (
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault()
      onSubmit({ fromAccountId, toAccountId, amount, transferredAt, description })
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Conta de origem"><select className="field-input" required value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}><option value="">Selecione</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></InputField>
        <InputField label="Conta de destino"><select className="field-input" required value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}><option value="">Selecione</option>{activeAccounts.map((account) => <option key={account.id} value={account.id} disabled={account.id === fromAccountId}>{account.name}</option>)}</select></InputField>
        <InputField label="Valor"><CurrencyInput value={amount} onChange={setAmount} /></InputField>
        <InputField label="Data da transferência"><input className="field-input" required type="datetime-local" value={transferredAt} onChange={(event) => setTransferredAt(event.target.value)} /></InputField>
      </div>
      <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">Saldo disponível em <strong>{source?.name ?? 'origem'}</strong>: <strong>{formatCurrency(sourceBalance)}</strong></p>
      <InputField label="Descrição"><input className="field-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional" /></InputField>
      <FormActions onCancel={onCancel} submitLabel={transfer ? 'Salvar transferência' : 'Transferir'} />
    </form>
  )
}

function PaymentForm({ state, initialProjectId = '', payment, onSubmit, onCancel }: { state: AppState; initialProjectId?: string; payment?: Payment; onSubmit: (values: PaymentFormValues) => void; onCancel: () => void }) {
  const initialProject = state.projects.find((project) => project.id === (payment?.projectId || initialProjectId))
  const activeAccounts = state.bankAccounts.filter((bankAccount) => bankAccount.active || bankAccount.id === payment?.bankAccountId)
  const initialBankAccountId = payment?.bankAccountId
    || state.bankAccounts.find((bankAccount) => bankAccount.name === payment?.account)?.id
    || activeAccounts[0]?.id
    || ''
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      projectId: payment?.projectId || initialProjectId || '',
      clientId: payment?.clientId || initialProject?.clientId || state.clients[0]?.id || '',
      leadId: payment?.leadId || initialProject?.leadId || '',
      quoteId: payment?.quoteId || initialProject?.quoteId || '',
      paymentType: payment?.paymentType || (initialProject?.projectStatus === 'Aguardando pagamento final' ? 'Pagamento final' : 'Sinal'),
      amount: payment?.amount ?? (initialProject ? Math.max(initialProject.totalValue - getProjectPaidAmount(state, initialProject.id), 0) : 0),
      installmentCount: payment?.installmentCount ?? 1,
      installmentIntervalDays: 30,
      dueDate: payment?.dueDate || initialProject?.deliveryDeadline || dateInput(),
      paidAt: payment?.paidAt ? dateTimeInputFromDate(new Date(payment.paidAt)) : dateTimeInput(0, 10),
      paymentMethod: payment?.paymentMethod || 'PIX',
      status: payment?.status || 'Recebida',
      receiptUrl: payment?.receiptUrl || '',
      bankAccountId: initialBankAccountId,
      account: payment?.account || '',
      transactionNumber: payment?.transactionNumber || '',
      confirmedReceived: payment?.confirmedReceived ?? true,
      notes: payment?.notes || '',
    },
  })
  const amount = Number(watch('amount') || 0)

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <InputField label="Projeto" error={getError(errors.projectId?.message)}><select className="field-input" {...register('projectId')}><option value="">Sem projeto</option>{state.projects.filter(isVisibleProject).map((project) => <option key={project.id} value={project.id}>{project.projectCode} - {project.name}</option>)}</select></InputField>
      <InputField label="Cliente" error={getError(errors.clientId?.message)}><select className="field-input" {...register('clientId')}><option value="">Selecione</option>{state.clients.filter((client) => !client.archived).map((client) => <option key={client.id} value={client.id}>{contactDisplayName(client)}</option>)}</select></InputField>
      <InputField label="Contato no CRM" error={getError(errors.leadId?.message)}><select className="field-input" {...register('leadId')}><option value="">Sem contato</option>{state.leads.filter((lead) => !lead.archived && !lead.deletedAt).map((lead) => <option key={lead.id} value={lead.id}>{contactDisplayName(lead)}</option>)}</select></InputField>
      <InputField label="Proposta" error={getError(errors.quoteId?.message)}><select className="field-input" {...register('quoteId')}><option value="">Sem proposta</option>{state.quotes.filter((quote) => !quote.deletedAt).map((quote) => <option key={quote.id} value={quote.id}>{quote.quoteNumber}</option>)}</select></InputField>
      <InputField label="Tipo" error={getError(errors.paymentType?.message)}><Select options={paymentTypes} register={register('paymentType')} /></InputField>
      <InputField label="Valor" error={getError(errors.amount?.message)}>
        <input type="hidden" {...register('amount')} />
        <CurrencyInput
          value={amount}
          onChange={(nextValue) => setValue('amount', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </InputField>
      {!payment ? <><InputField label="Quantidade de parcelas" error={getError(errors.installmentCount?.message)}><input className="field-input" min="1" max="48" type="number" {...register('installmentCount')} /></InputField><InputField label="Intervalo entre parcelas (dias)" error={getError(errors.installmentIntervalDays?.message)}><input className="field-input" min="1" max="365" type="number" {...register('installmentIntervalDays')} /></InputField></> : null}
      <InputField label="Previsão de recebimento" error={getError(errors.dueDate?.message)}>
        <input className="field-input" type="date" {...register('dueDate')} />
        <span className="mt-1 block text-xs text-gray-500">No pagamento final, informe a data combinada para receber após a entrega. Esta data não controla o alerta vermelho do projeto.</span>
      </InputField>
      <InputField label="Data do recebimento" error={getError(errors.paidAt?.message)}><input className="field-input" type="datetime-local" {...register('paidAt')} /></InputField>
      <InputField label="Forma de pagamento" error={getError(errors.paymentMethod?.message)}><Select options={paymentMethods} register={register('paymentMethod')} /></InputField>
      <InputField label="Status" error={getError(errors.status?.message)}><Select options={paymentStatuses} register={register('status')} /></InputField>
      <InputField label="Link do comprovante" error={getError(errors.receiptUrl?.message)}><input className="field-input" placeholder="https://..." {...register('receiptUrl')} /></InputField>
      <input type="hidden" {...register('account')} />
      <InputField label="Conta de destino" error={getError(errors.bankAccountId?.message)}>
        <select className="field-input" {...register('bankAccountId')}>
          <option value="">Selecione quando receber</option>
          {activeAccounts.map((bankAccount) => <option key={bankAccount.id} value={bankAccount.id}>{bankAccount.name} · {bankAccount.bankName}</option>)}
        </select>
      </InputField>
      <InputField label="Número da transação" error={getError(errors.transactionNumber?.message)}><input className="field-input" {...register('transactionNumber')} /></InputField>
      <label className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900 md:col-span-2">
        <input className="h-5 w-5 accent-emerald-600" type="checkbox" {...register('confirmedReceived')} /> Pagamento recebido e conferido
      </label>
      <div className="md:col-span-2"><InputField label="Observações" error={getError(errors.notes?.message)}><textarea className="field-input min-h-24" {...register('notes')} /></InputField></div>
      <FormActions onCancel={onCancel} submitLabel={payment ? 'Salvar alterações' : 'Salvar lançamento'} />
    </form>
  )
}

function ExpenseForm({ state, expense, onSubmit, onCancel }: { state: AppState; expense?: Expense; onSubmit: (values: ExpenseFormValues) => void; onCancel: () => void }) {
  const activeAccounts = state.bankAccounts.filter((bankAccount) => bankAccount.active || bankAccount.id === expense?.bankAccountId)
  const initialBankAccountId = expense?.bankAccountId
    || state.bankAccounts.find((bankAccount) => bankAccount.name === expense?.account)?.id
    || activeAccounts[0]?.id
    || ''
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ExpenseFormInput, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      projectId: expense?.projectId || '',
      description: expense?.description || '',
      category: expense?.category || 'Combustível',
      expenseType: expense?.expenseType || 'Custo direto do projeto',
      amount: expense?.amount ?? 0,
      installmentCount: expense?.installmentCount ?? 1,
      installmentIntervalDays: 30,
      expenseDate: expense?.expenseDate || dateInput(),
      dueDate: expense?.dueDate || dateInput(),
      paidAt: expense?.paidAt ? dateTimeInputFromDate(new Date(expense.paidAt)) : dateTimeInput(0, 10),
      paymentMethod: expense?.paymentMethod || 'PIX',
      status: expense?.status || 'Paga',
      supplier: expense?.supplier || '',
      bankAccountId: initialBankAccountId,
      account: expense?.account || '',
      transactionNumber: expense?.transactionNumber || '',
      recurring: expense?.recurring ?? false,
      recurrenceFrequency: expense?.recurrenceFrequency || 'Mensal',
      recurrenceEndDate: expense?.recurrenceEndDate || '',
      notes: expense?.notes || '',
    },
  })
  const amount = Number(watch('amount') || 0)
  const recurring = watch('recurring')
  const expenseStatus = watch('status')
  const paymentDateEnabled = ['Paga', 'Reembolsada'].includes(expenseStatus)

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <InputField label="Descrição" error={getError(errors.description?.message)}><input className="field-input" {...register('description')} /></InputField>
      <InputField label="Projeto relacionado" error={getError(errors.projectId?.message)}><select className="field-input" {...register('projectId')}><option value="">Sem projeto</option>{state.projects.filter((project) => !project.deletedAt && !project.archivedAt).map((project) => <option key={project.id} value={project.id}>{project.projectCode} - {project.name}</option>)}</select></InputField>
      <InputField label="Categoria" error={getError(errors.category?.message)}><Select options={expenseCategories} register={register('category')} /></InputField>
      <InputField label="Tipo de despesa" error={getError(errors.expenseType?.message)}><Select options={expenseTypes} register={register('expenseType')} /></InputField>
      <InputField label="Valor" error={getError(errors.amount?.message)}>
        <input type="hidden" {...register('amount')} />
        <CurrencyInput
          value={amount}
          onChange={(nextValue) => setValue('amount', nextValue, { shouldDirty: true, shouldValidate: true })}
        />
      </InputField>
      {!expense ? <><InputField label="Quantidade de parcelas" error={getError(errors.installmentCount?.message)}><input className="field-input" min="1" max="48" type="number" {...register('installmentCount')} /></InputField><InputField label="Intervalo entre parcelas (dias)" error={getError(errors.installmentIntervalDays?.message)}><input className="field-input" min="1" max="365" type="number" {...register('installmentIntervalDays')} /></InputField></> : null}
      <InputField label="Data" error={getError(errors.expenseDate?.message)}><input className="field-input" type="date" {...register('expenseDate')} /></InputField>
      <InputField label="Vencimento" error={getError(errors.dueDate?.message)}><input className="field-input" type="date" {...register('dueDate')} /></InputField>
      <InputField label="Data do pagamento" error={getError(errors.paidAt?.message)}><input className="field-input" disabled={!paymentDateEnabled} type="datetime-local" {...register('paidAt')} /></InputField>
      <InputField label="Forma" error={getError(errors.paymentMethod?.message)}><Select options={paymentMethods} register={register('paymentMethod')} /></InputField>
      <InputField label="Situação da despesa" error={getError(errors.status?.message)}><Select options={expenseStatuses} register={register('status')} /></InputField>
      <InputField label="Fornecedor" error={getError(errors.supplier?.message)}><input className="field-input" {...register('supplier')} /></InputField>
      <input type="hidden" {...register('account')} />
      <InputField label="Conta de saída" error={getError(errors.bankAccountId?.message)}>
        <select className="field-input" {...register('bankAccountId')}>
          <option value="">Selecione quando pagar</option>
          {activeAccounts.map((bankAccount) => <option key={bankAccount.id} value={bankAccount.id}>{bankAccount.name} · {bankAccount.bankName}</option>)}
        </select>
      </InputField>
      <InputField label="Número da transação" error={getError(errors.transactionNumber?.message)}><input className="field-input" {...register('transactionNumber')} /></InputField>
      <div className="expense-recurrence md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
          <input className="mt-0.5 h-4 w-4 accent-[#d8a500]" type="checkbox" {...register('recurring')} />
          <span><strong className="block text-gray-950">Despesa recorrente</strong><span className="mt-0.5 block text-xs text-gray-500">Use para assinaturas, impostos, aluguel e outros custos que se repetem.</span></span>
        </label>
        {recurring ? (
          <div className="mt-3 grid gap-3 border-t border-gray-200 pt-3 sm:grid-cols-2">
            <InputField label="Periodicidade" error={getError(errors.recurrenceFrequency?.message)}><Select options={expenseRecurrenceFrequencies} register={register('recurrenceFrequency')} /></InputField>
            <InputField label="Repetir até (opcional)" error={getError(errors.recurrenceEndDate?.message)}><input className="field-input" min={watch('expenseDate')} type="date" {...register('recurrenceEndDate')} /></InputField>
          </div>
        ) : null}
      </div>
      <div className="md:col-span-2"><InputField label="Observações" error={getError(errors.notes?.message)}><textarea className="field-input min-h-24" {...register('notes')} /></InputField></div>
      <FormActions onCancel={onCancel} submitLabel={expense ? 'Salvar alterações' : 'Salvar despesa'} />
    </form>
  )
}

function QuoteForm({ state, onSubmit, onCancel }: { state: AppState; onSubmit: (values: QuoteFormValues) => void; onCancel: () => void }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<QuoteFormInput, unknown, QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      leadId: '',
      clientId: state.clients[0]?.id ?? '',
      description: 'Captação aérea',
      quantity: 1,
      unitPrice: 450,
      discount: 0,
      travelFee: 0,
      urgencyFee: 0,
      depositValue: 225,
      expirationDate: dateInput(7),
      deliveryDeadline: dateInput(12),
      paymentTerms: state.companySettings.paymentTerms,
      status: 'Rascunho',
      notes: '',
    },
  })
  const unitPrice = Number(watch('unitPrice') || 0)
  const discount = Number(watch('discount') || 0)
  const travelFee = Number(watch('travelFee') || 0)
  const urgencyFee = Number(watch('urgencyFee') || 0)
  const depositValue = Number(watch('depositValue') || 0)

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <InputField label="Cliente" error={getError(errors.clientId?.message)}><select className="field-input" {...register('clientId')}><option value="">Nenhum</option>{state.clients.map((client) => <option key={client.id} value={client.id}>{contactDisplayName(client)}</option>)}</select></InputField>
      <InputField label="Contato no CRM" error={getError(errors.leadId?.message)}><select className="field-input" {...register('leadId')}><option value="">Nenhum</option>{state.leads.filter((lead) => !lead.archived && !lead.deletedAt).map((lead) => <option key={lead.id} value={lead.id}>{contactDisplayName(lead)}</option>)}</select></InputField>
      <InputField label="Item do orçamento" error={getError(errors.description?.message)}><input className="field-input" {...register('description')} /></InputField>
      <InputField label="Quantidade" error={getError(errors.quantity?.message)}><input className="field-input" type="number" {...register('quantity')} /></InputField>
      <InputField label="Valor unitário" error={getError(errors.unitPrice?.message)}>
        <input type="hidden" {...register('unitPrice')} />
        <CurrencyInput value={unitPrice} onChange={(nextValue) => setValue('unitPrice', nextValue, { shouldDirty: true, shouldValidate: true })} />
      </InputField>
      <InputField label="Desconto" error={getError(errors.discount?.message)}>
        <input type="hidden" {...register('discount')} />
        <CurrencyInput value={discount} onChange={(nextValue) => setValue('discount', nextValue, { shouldDirty: true, shouldValidate: true })} />
      </InputField>
      <InputField label="Deslocamento" error={getError(errors.travelFee?.message)}>
        <input type="hidden" {...register('travelFee')} />
        <CurrencyInput value={travelFee} onChange={(nextValue) => setValue('travelFee', nextValue, { shouldDirty: true, shouldValidate: true })} />
      </InputField>
      <InputField label="Urgência" error={getError(errors.urgencyFee?.message)}>
        <input type="hidden" {...register('urgencyFee')} />
        <CurrencyInput value={urgencyFee} onChange={(nextValue) => setValue('urgencyFee', nextValue, { shouldDirty: true, shouldValidate: true })} />
      </InputField>
      <InputField label="Sinal" error={getError(errors.depositValue?.message)}>
        <input type="hidden" {...register('depositValue')} />
        <CurrencyInput value={depositValue} onChange={(nextValue) => setValue('depositValue', nextValue, { shouldDirty: true, shouldValidate: true })} />
      </InputField>
      <InputField label="Validade" error={getError(errors.expirationDate?.message)}><input className="field-input" type="date" {...register('expirationDate')} /></InputField>
      <InputField label="Prazo de entrega" error={getError(errors.deliveryDeadline?.message)}><input className="field-input" type="date" {...register('deliveryDeadline')} /></InputField>
      <InputField label="Status" error={getError(errors.status?.message)}><Select options={quoteStatuses.filter((status) => !['Arquivada', 'Excluída logicamente'].includes(status))} register={register('status')} /></InputField>
      <div className="md:col-span-2"><InputField label="Condições de pagamento" error={getError(errors.paymentTerms?.message)}><textarea className="field-input min-h-20" {...register('paymentTerms')} /></InputField></div>
      <div className="md:col-span-2"><InputField label="Observações" error={getError(errors.notes?.message)}><textarea className="field-input min-h-20" {...register('notes')} /></InputField></div>
      <FormActions onCancel={onCancel} />
    </form>
  )
}

function UserForm({ onSubmit, onCancel }: { onSubmit: (values: UserFormValues) => void | Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('Assistente')
  const [permissions, setPermissions] = useState<UserPermission[]>(rolePermissionPresets.Assistente)
  const [error, setError] = useState('')

  const changeRole = (nextRole: UserRole) => {
    setRole(nextRole)
    setPermissions(rolePermissionPresets[nextRole])
  }

  const togglePermission = (permission: UserPermission) => {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (name.trim().length < 2) {
      setError('Informe o nome do usuário.')
      return
    }
    if (!email.includes('@')) {
      setError('Informe um e-mail válido.')
      return
    }
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (permissions.length === 0) {
      setError('Selecione pelo menos uma permissão.')
      return
    }

    await onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
      permissions,
    })
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <InputField label="Nome do usuário">
          <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} />
        </InputField>
        <InputField label="E-mail">
          <input className="field-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </InputField>
        <InputField label="Senha inicial">
          <input className="field-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </InputField>
        <InputField label="Perfil">
          <select className="field-input" value={role} onChange={(event) => changeRole(event.target.value as UserRole)}>
            {Object.keys(rolePermissionPresets).map((roleName) => (
              <option key={roleName} value={roleName}>{roleName}</option>
            ))}
          </select>
        </InputField>
      </div>

      <div>
        <p className="field-label">Permissões</p>
        <div className="grid gap-2 md:grid-cols-2">
          {allPermissions.map((permission) => (
            <label key={permission} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-bold text-gray-700">
              <input
                className="mt-1 h-4 w-4 accent-[#d8a500]"
                type="checkbox"
                checked={permissions.includes(permission)}
                onChange={() => togglePermission(permission)}
              />
              <span>{permissionLabels[permission]}</span>
            </label>
          ))}
        </div>
      </div>
      <FormActions onCancel={onCancel} />
    </form>
  )
}

function Select<T extends readonly string[]>({ options, register }: { options: T; register: Record<string, unknown> }) {
  return (
    <select className="field-input" {...register}>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  )
}

function CurrencyInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <input
      className="field-input text-right font-bold"
      inputMode="numeric"
      value={formatCurrency(value)}
      onChange={(event) => onChange(parseCurrencyInput(event.target.value))}
      onFocus={(event) => event.currentTarget.select()}
    />
  )
}

function PhoneInput({
  value,
  onChange,
  placeholder = '(41) 98765-4321',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <input
      className="field-input"
      inputMode="tel"
      placeholder={placeholder}
      value={formatPhoneInput(value)}
      onChange={(event) => onChange(formatPhoneInput(event.currentTarget.value))}
    />
  )
}

function FormActions({
  onCancel,
  submitLabel = 'Salvar',
  leftAction,
}: {
  onCancel: () => void
  submitLabel?: string
  leftAction?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2">
      <div className="flex flex-wrap gap-2">{leftAction}</div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </div>
  )
}

export default App
