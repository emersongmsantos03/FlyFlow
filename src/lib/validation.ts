import { z } from 'zod'
import {
  appointmentStatuses,
  appointmentTypes,
  expenseCategories,
  expenseRecurrenceFrequencies,
  expenseStatuses,
  expenseTypes,
  equipmentConditions,
  financialStatuses,
  leadSources,
  leadTemperatures,
  paymentMethods,
  paymentStatuses,
  paymentTypes,
  pipelineStages,
  projectStatuses,
  quoteStatuses,
  serviceTypes,
} from '../types'

const optionalEmail = z.union([z.literal(''), z.string().email('Informe um e-mail válido')])
const optionalText = z.string().optional().default('')
const money = z.coerce.number().min(0, 'Informe um valor igual ou maior que zero')
const percentage = z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%')

export const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
  remember: z.boolean().default(false),
})

export const leadFormSchema = z.object({
  fullName: optionalText,
  companyName: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: optionalEmail,
  instagram: optionalText,
  city: z.string().min(2, 'Informe a cidade'),
  neighborhood: optionalText,
  address: optionalText,
  source: z.enum(leadSources),
  serviceInterest: z.enum(serviceTypes),
  pipelineStage: z.enum(pipelineStages),
  temperature: z.enum(leadTemperatures),
  estimatedValue: money,
  probability: percentage,
  nextContactAt: optionalText,
  notes: optionalText,
})

export const clientFormSchema = z.object({
  fullName: optionalText,
  companyName: optionalText,
  document: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: optionalEmail,
  instagram: optionalText,
  address: optionalText,
  city: z.string().min(2, 'Informe a cidade'),
  source: z.enum(leadSources),
  notes: optionalText,
})

export const projectFormSchema = z
  .object({
    name: z.string().min(2, 'Informe o nome do projeto'),
    clientId: optionalText,
    leadId: optionalText,
    serviceName: z.enum(serviceTypes),
    description: optionalText,
    captureDate: z.string().min(1, 'Informe a data de captação'),
    captureStartTime: z.string().min(1, 'Informe o horário inicial'),
    captureEndTime: optionalText,
    deliveryDeadline: z.string().min(1, 'Informe o prazo de entrega'),
    deliveryDeadlineNegotiated: z.boolean().default(false),
    deliveryDaysAfterCapture: z.coerce.number().min(0).default(7),
    address: optionalText,
    city: z.string().min(2, 'Informe a cidade'),
    contactName: optionalText,
    contactPhone: optionalText,
    totalValue: money,
    depositValue: money,
    discountValue: money.default(0),
    travelFee: money.default(0),
    projectStatus: z.enum(projectStatuses),
    financialStatus: z.enum(financialStatuses),
    paymentMethod: z.enum(paymentMethods),
    notes: optionalText,
    manualCreationReason: optionalText,
  })
  .refine((data) => new Date(data.deliveryDeadline) >= new Date(data.captureDate), {
    message: 'O prazo de entrega não pode ser anterior à captação',
    path: ['deliveryDeadline'],
  })
  .refine((data) => Boolean(data.clientId || data.leadId), {
    message: 'Selecione um contato do CRM',
    path: ['leadId'],
  })
  .refine((data) => data.depositValue <= data.totalValue, {
    message: 'O sinal não pode ser maior que o valor total',
    path: ['depositValue'],
  })

export const appointmentFormSchema = z
  .object({
    title: z.string().min(2, 'Informe o título do agendamento'),
    appointmentType: z.enum(appointmentTypes),
    clientId: optionalText,
    leadId: optionalText,
    projectId: optionalText,
    startAt: z.string().min(1, 'Informe a data e hora inicial'),
    endAt: z.string().min(1, 'Informe a data e hora final'),
    address: optionalText,
    notes: optionalText,
    status: z.enum(appointmentStatuses),
    color: z.string().min(4),
    createGoogleCalendar: z.boolean().default(true),
    rescheduleReason: optionalText,
  })
  .refine((data) => new Date(data.endAt) >= new Date(data.startAt), {
    message: 'O término não pode ser antes do início',
    path: ['endAt'],
  })

export const paymentFormSchema = z.object({
  projectId: optionalText,
  clientId: optionalText,
  leadId: optionalText,
  quoteId: optionalText,
  paymentType: z.enum(paymentTypes),
  amount: money,
  dueDate: z.string().min(1, 'Informe o vencimento'),
  paidAt: optionalText,
  paymentMethod: z.enum(paymentMethods),
  status: z.enum(paymentStatuses),
  receiptUrl: optionalText,
  bankAccountId: optionalText,
  account: optionalText,
  transactionNumber: optionalText,
  confirmedReceived: z.boolean().default(false),
  notes: optionalText,
}).superRefine((data, context) => {
  if (data.status === 'Recebida' && !data.bankAccountId) {
    context.addIssue({ code: 'custom', path: ['bankAccountId'], message: 'Selecione a conta que recebeu o dinheiro' })
  }
})

export const expenseFormSchema = z.object({
  projectId: optionalText,
  description: z.string().min(2, 'Informe a descrição'),
  category: z.enum(expenseCategories),
  expenseType: z.enum(expenseTypes),
  amount: money,
  expenseDate: z.string().min(1, 'Informe a data'),
  dueDate: optionalText,
  paidAt: optionalText,
  paymentMethod: z.enum(paymentMethods),
  status: z.enum(expenseStatuses),
  supplier: optionalText,
  bankAccountId: optionalText,
  account: optionalText,
  transactionNumber: optionalText,
  recurring: z.boolean().default(false),
  recurrenceFrequency: z.enum(expenseRecurrenceFrequencies).default('Mensal'),
  recurrenceEndDate: optionalText,
  notes: optionalText,
}).superRefine((data, context) => {
  if (data.status === 'Paga' && !data.bankAccountId) {
    context.addIssue({ code: 'custom', path: ['bankAccountId'], message: 'Selecione a conta usada no pagamento' })
  }
})

export const equipmentFormSchema = z.object({
  name: z.string().min(2, 'Informe o nome do equipamento'),
  category: z.string().min(2, 'Informe a categoria'),
  brand: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  purchaseDate: optionalText,
  purchaseValue: money.default(0),
  condition: z.enum(equipmentConditions),
  lastMaintenanceDate: optionalText,
  nextMaintenanceDate: optionalText,
  notes: optionalText,
  active: z.boolean().default(true),
})

export const quoteFormSchema = z.object({
  leadId: optionalText,
  clientId: optionalText,
  description: z.string().min(2, 'Informe o item do orçamento'),
  quantity: z.coerce.number().min(1, 'Quantidade mínima 1'),
  unitPrice: money,
  discount: money.default(0),
  travelFee: money.default(0),
  urgencyFee: money.default(0),
  depositValue: money,
  expirationDate: z.string().min(1, 'Informe a validade'),
  deliveryDeadline: z.string().min(1, 'Informe o prazo de entrega'),
  paymentTerms: z.string().min(2, 'Informe as condições de pagamento'),
  status: z.enum(quoteStatuses),
  notes: optionalText,
})

export const settingsFormSchema = z.object({
  companyName: z.string().min(2, 'Informe a empresa'),
  document: optionalText,
  phone: z.string().min(8, 'Informe um telefone'),
  email: z.string().email('Informe um e-mail válido'),
  instagram: optionalText,
  address: optionalText,
  baseCity: z.string().min(2, 'Informe a cidade base'),
  pixKey: optionalText,
  pixHolderName: optionalText,
  defaultDepositPercentage: percentage,
  defaultDeliveryDays: z.coerce.number().min(1, 'Mínimo de 1 dia'),
  defaultFreeRevisions: z.coerce.number().min(0, 'Não pode ser negativo'),
  vehicleAverageConsumption: z.coerce.number().min(1, 'Consumo deve ser maior que zero'),
  fuelAveragePrice: money,
  pricePerKm: money,
  freeKm: z.coerce.number().min(0, 'Não pode ser negativo'),
  paymentTerms: z.string().min(2, 'Informe a condição padrão'),
})

export type LoginFormInput = z.input<typeof loginSchema>
export type LoginFormValues = z.output<typeof loginSchema>
export type LeadFormInput = z.input<typeof leadFormSchema>
export type LeadFormValues = z.output<typeof leadFormSchema>
export type ClientFormInput = z.input<typeof clientFormSchema>
export type ClientFormValues = z.output<typeof clientFormSchema>
export type ProjectFormInput = z.input<typeof projectFormSchema>
export type ProjectFormValues = z.output<typeof projectFormSchema>
export type AppointmentFormInput = z.input<typeof appointmentFormSchema>
export type AppointmentFormValues = z.output<typeof appointmentFormSchema>
export type PaymentFormInput = z.input<typeof paymentFormSchema>
export type PaymentFormValues = z.output<typeof paymentFormSchema>
export type ExpenseFormInput = z.input<typeof expenseFormSchema>
export type ExpenseFormValues = z.output<typeof expenseFormSchema>
export type EquipmentFormInput = z.input<typeof equipmentFormSchema>
export type EquipmentFormValues = z.output<typeof equipmentFormSchema>
export type QuoteFormInput = z.input<typeof quoteFormSchema>
export type QuoteFormValues = z.output<typeof quoteFormSchema>
export type SettingsFormInput = z.input<typeof settingsFormSchema>
export type SettingsFormValues = z.output<typeof settingsFormSchema>
