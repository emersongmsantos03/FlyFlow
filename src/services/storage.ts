import { createEmptyState } from '../data/demoData'
import { rolePermissionPresets } from '../lib/permissions'
import { synchronizeOperationalState } from '../lib/operations'
import type { AppState, BankAccount, Expense, User } from '../types'

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
    expenses: (state.expenses || []).map((expense) => ({
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
