import { createEmptyState } from '../data/demoData'
import { rolePermissionPresets } from '../lib/permissions'
import { synchronizeOperationalState } from '../lib/operations'
import { createDefaultLeadHunterCategories, createDefaultLeadHunterCities, createDefaultLeadHunterSettings } from '../constants/leadHunterDefaults'
import type { AppState, BankAccount, Client, Expense, Lead, User } from '../types'

const STORAGE_KEY = 'hero-drone-manager:data:v2-empty'
const PRIMARY_OWNER_EMAIL = 'herodronecwb@gmail.com'
const PRIMARY_OWNER_ID = 'usr-primary-owner'
const HERO_DRONE_CNPJ = '52.075.318/0001-35'
const LEGACY_PIX_KEYS = ['', 'contato@herodrone.com.br', PRIMARY_OWNER_EMAIL]

const defaultBankAccounts = (createdAt: string): BankAccount[] => [
  {
    id: 'bank-primary',
    name: 'Conta principal',
    bankName: 'A definir',
    accountType: 'Conta corrente',
    openingBalance: 0,
    active: true,
    notes: 'Conta padrão para recebimentos e pagamentos.',
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'bank-secondary',
    name: 'Conta secundária',
    bankName: 'A definir',
    accountType: 'Conta corrente',
    openingBalance: 0,
    active: true,
    notes: '',
    createdAt,
    updatedAt: createdAt,
  },
]

const normalizeExpenseStatus = (status?: string): Expense['status'] => {
  if (status === 'Recebida') return 'Paga'
  if (status === 'Pendente' || status === 'Parcialmente recebida' || status === 'Parcialmente paga') return 'A pagar'
  if (status === 'Prevista' || status === 'A pagar' || status === 'Paga' || status === 'Vencida' || status === 'Cancelada' || status === 'Reembolsada') return status
  return 'A pagar'
}

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const addExpenseRecurrence = (date: Date, frequency: Expense['recurrenceFrequency']) => {
  const next = new Date(date)
  if (frequency === 'Semanal') next.setDate(next.getDate() + 7)
  else if (frequency === 'Quinzenal') next.setDate(next.getDate() + 15)
  else if (frequency === 'Bimestral') next.setMonth(next.getMonth() + 2)
  else if (frequency === 'Trimestral') next.setMonth(next.getMonth() + 3)
  else if (frequency === 'Semestral') next.setMonth(next.getMonth() + 6)
  else if (frequency === 'Anual') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next
}

const materializeRecurringExpenses = (expenses: Expense[], createdAt: string) => {
  const result = [...expenses]
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 90)
  const existingIds = new Set(expenses.map((expense) => expense.id))
  expenses.filter((expense) => expense.recurring && !expense.recurrenceParentId && !expense.deletedAt && !expense.archivedAt && !['Cancelada', 'Reembolsada'].includes(expense.status)).forEach((template) => {
    const baseValue = template.dueDate || template.expenseDate
    let occurrence = addExpenseRecurrence(new Date(`${baseValue}T12:00:00`), template.recurrenceFrequency)
    const recurrenceEnd = template.recurrenceEndDate ? new Date(`${template.recurrenceEndDate}T23:59:59`) : undefined
    let number = 1
    while (occurrence <= horizon && (!recurrenceEnd || occurrence <= recurrenceEnd) && number <= 100) {
      const date = occurrence.toISOString().slice(0, 10)
      const id = `${template.id}-occ-${date}`
      if (!existingIds.has(id)) {
        result.push({ ...template, id, expenseDate: date, dueDate: date, paidAt: undefined, status: 'Prevista', recurring: false, recurrenceParentId: template.id, recurrenceNumber: number, receiptUrl: undefined, transactionNumber: undefined, createdAt, updatedAt: createdAt })
        existingIds.add(id)
      }
      occurrence = addExpenseRecurrence(occurrence, template.recurrenceFrequency)
      number += 1
    }
  })
  return result
}

export const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const primaryOwnerUser = (): User => {
  const now = new Date().toISOString()
  return {
    id: PRIMARY_OWNER_ID,
    name: 'Hero Drone CWB',
    email: PRIMARY_OWNER_EMAIL,
    role: 'Administrador',
    permissions: rolePermissionPresets.Administrador,
    isPrimaryOwner: true,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
}

const normalizeUsers = (users: User[]) => {
  const normalized = users
    .filter(Boolean)
    .map((user) => ({
      ...user,
      permissions: user.isPrimaryOwner
        ? rolePermissionPresets.Administrador
        : user.permissions?.length
          ? user.permissions
          : rolePermissionPresets[user.role] ?? rolePermissionPresets.Assistente,
      isPrimaryOwner: user.email?.toLowerCase() === PRIMARY_OWNER_EMAIL || user.isPrimaryOwner,
      active: user.active ?? true,
    }))

  const ownerIndex = normalized.findIndex((user) => user.email?.toLowerCase() === PRIMARY_OWNER_EMAIL)
  if (ownerIndex >= 0) {
    const [owner] = normalized.splice(ownerIndex, 1)
    normalized.unshift({
      ...owner,
      id: PRIMARY_OWNER_ID,
      name: owner.name || 'Hero Drone CWB',
      role: 'Administrador',
      permissions: rolePermissionPresets.Administrador,
      isPrimaryOwner: true,
      active: true,
    })
    return normalized
  }

  return [primaryOwnerUser(), ...normalized]
}

export const normalizeAppState = (state: AppState): AppState => {
  const createdAt = state.updatedAt || new Date().toISOString()
  const normalizedClients: Client[] = (state.clients || []).map((client) => ({
    ...client,
    jobTitle: client.jobTitle || '',
    neighborhood: client.neighborhood || '',
    postalCode: client.postalCode || '',
  }))
  const contactKey = (value?: string) => value?.trim().toLowerCase().replace(/\D/g, '') || ''
  const findContact = (lead: Lead) => normalizedClients.find((client) =>
    client.id === lead.contactId ||
    (contactKey(lead.whatsapp) && contactKey(lead.whatsapp) === contactKey(client.whatsapp)) ||
    (contactKey(lead.phone) && contactKey(lead.phone) === contactKey(client.phone)) ||
    (lead.email && lead.email.toLowerCase() === client.email?.toLowerCase()),
  )
  const normalizedLeads = (state.leads || []).map((lead) => {
    const existingContact = findContact(lead)
    if (existingContact) return { ...lead, contactId: existingContact.id }
    const migratedContact: Client = {
      id: `client-migrated-${lead.id}`,
      fullName: lead.fullName || lead.companyName || 'Contato sem nome',
      companyName: lead.companyName || '',
      jobTitle: '',
      document: '',
      phone: lead.phone || '',
      whatsapp: lead.whatsapp || '',
      email: lead.email || '',
      instagram: lead.instagram || '',
      neighborhood: lead.neighborhood || '',
      postalCode: '',
      address: lead.address || '',
      city: lead.city || '',
      source: lead.source,
      notes: lead.notes || '',
      tags: lead.tags || [],
      archived: false,
      createdAt: lead.createdAt || createdAt,
      updatedAt: lead.updatedAt || createdAt,
    }
    normalizedClients.push(migratedContact)
    return { ...lead, contactId: migratedContact.id }
  })
  const bankAccounts = state.bankAccounts?.length ? state.bankAccounts : defaultBankAccounts(createdAt)
  const primaryAccount = bankAccounts.find((account) => account.active) ?? bankAccounts[0]
  const resolveLegacyAccountId = (accountName?: string) => {
    if (!accountName) return undefined
    const normalized = accountName.trim().toLowerCase()
    return bankAccounts.find((account) =>
      account.name.trim().toLowerCase() === normalized || account.bankName.trim().toLowerCase() === normalized,
    )?.id
  }

  return synchronizeOperationalState({
    ...state,
    leads: normalizedLeads,
    clients: normalizedClients,
    companies: state.companies || [],
    leadHunterCities: state.leadHunterCities?.length ? state.leadHunterCities : createDefaultLeadHunterCities(),
    leadHunterCategories: (() => {
      const defaults = createDefaultLeadHunterCategories()
      const current = state.leadHunterCategories || []
      const currentIds = new Set(current.map((category) => category.id))
      return [...current, ...defaults.filter((category) => !currentIds.has(category.id))]
    })(),
    leadHunterProspects: state.leadHunterProspects || [],
    leadHunterSearches: state.leadHunterSearches || [],
    leadHunterRoutes: state.leadHunterRoutes || [],
    leadHunterSettings: state.leadHunterSettings || createDefaultLeadHunterSettings(),
    companySettings: {
      ...state.companySettings,
      document: state.companySettings.document?.trim() || HERO_DRONE_CNPJ,
      pixKey: LEGACY_PIX_KEYS.includes(state.companySettings.pixKey?.trim() || '') ? HERO_DRONE_CNPJ : state.companySettings.pixKey,
    },
    users: normalizeUsers(state.users || []),
    payments: (state.payments || []).map((payment) => ({
      ...payment,
      bankAccountId: payment.bankAccountId || resolveLegacyAccountId(payment.account) || (payment.status === 'Recebida' ? primaryAccount?.id : undefined),
    })),
    expenses: materializeRecurringExpenses(state.expenses || [], createdAt).map((expense) => ({
      ...expense,
      status: normalizeExpenseStatus(expense.status),
      recurring: expense.recurring ?? false,
      recurrenceFrequency: expense.recurring ? expense.recurrenceFrequency || 'Mensal' : expense.recurrenceFrequency,
      bankAccountId: expense.bankAccountId || resolveLegacyAccountId(expense.account) || (normalizeExpenseStatus(expense.status) === 'Paga' ? primaryAccount?.id : undefined),
    })),
    recurringExpenses: state.recurringExpenses || [],
    bankAccounts,
    bankTransfers: state.bankTransfers || [],
    tasks: state.tasks || [],
    statusHistory: state.statusHistory || [],
    projectAdjustments: state.projectAdjustments || [],
  })
}

export const loadAppState = (): AppState => {
  if (!canUseStorage()) return createEmptyState()

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    const state = normalizeAppState(createEmptyState())
    saveAppState(state)
    return state
  }

  try {
    const parsed = JSON.parse(stored) as AppState
    const fallback = createEmptyState()

    return normalizeAppState({
      ...fallback,
      ...parsed,
      companySettings: {
        ...fallback.companySettings,
        ...parsed.companySettings,
      },
    })
  } catch {
    const state = normalizeAppState(createEmptyState())
    saveAppState(state)
    return state
  }
}

export const saveAppState = (state: AppState) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...normalizeAppState(state),
      updatedAt: new Date().toISOString(),
    }),
  )
}

export const resetAppState = () => {
  const state = normalizeAppState(createEmptyState())
  saveAppState(state)
  return state
}
