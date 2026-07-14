import { createId } from './storage'

const AUTH_ACCOUNTS_KEY = 'hero-drone-manager:auth-accounts:v2'
const AUTH_SESSION_KEY = 'hero-drone-manager:session:v2'
const LEGACY_AUTH_KEY = 'hero-drone-manager:auth:v1'
const PRIMARY_OWNER_INITIAL_SALT = '4a50cbef834fef3403563f743a649dfc'
const PRIMARY_OWNER_INITIAL_PASSWORD_HASH = '6fa94d27c39764233a3db92f0313840aadf426530546f3deab0bdf0d84710542'

export const PRIMARY_OWNER = {
  id: 'usr-primary-owner',
  name: 'Hero Drone CWB',
  email: 'herodronecwb@gmail.com',
}

export interface AuthAccount {
  userId: string
  email: string
  passwordHash: string
  salt: string
  resetRequestedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  userId: string
  email: string
  createdAt: string
}

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const getAccounts = (): AuthAccount[] => {
  if (!canUseStorage()) return []
  try {
    return JSON.parse(window.localStorage.getItem(AUTH_ACCOUNTS_KEY) || '[]') as AuthAccount[]
  } catch {
    return []
  }
}

const saveAccounts = (accounts: AuthAccount[]) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(accounts))
}

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

const createSalt = () => {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const hashPassword = async (password: string, salt: string) => {
  const encoder = new TextEncoder()
  const input = encoder.encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return toHex(digest)
}

export const ensurePrimaryAuthAccount = async () => {
  const accounts = getAccounts()
  if (accounts.some((account) => account.email.toLowerCase() === PRIMARY_OWNER.email)) return

  const now = new Date().toISOString()
  accounts.unshift({
    userId: PRIMARY_OWNER.id,
    email: PRIMARY_OWNER.email,
    salt: PRIMARY_OWNER_INITIAL_SALT,
    passwordHash: PRIMARY_OWNER_INITIAL_PASSWORD_HASH,
    createdAt: now,
    updatedAt: now,
  })
  saveAccounts(accounts)
}

export const authenticateUser = async (email: string, password: string) => {
  await ensurePrimaryAuthAccount()
  const normalizedEmail = email.trim().toLowerCase()
  const account = getAccounts().find((item) => item.email.toLowerCase() === normalizedEmail)
  if (!account) return null

  const passwordHash = await hashPassword(password, account.salt)
  if (passwordHash !== account.passwordHash) return null
  return account
}

export const saveAuthSession = (account: Pick<AuthAccount, 'userId' | 'email'>, remember: boolean) => {
  if (typeof window === 'undefined') return
  const session: AuthSession = {
    userId: account.userId,
    email: account.email,
    createdAt: new Date().toISOString(),
  }
  const target = remember ? window.localStorage : window.sessionStorage
  target.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  window.localStorage.removeItem(LEGACY_AUTH_KEY)
  window.sessionStorage.removeItem(LEGACY_AUTH_KEY)
}

export const getAuthSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY) || window.sessionStorage.getItem(AUTH_SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export const clearAuthSession = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_SESSION_KEY)
  window.sessionStorage.removeItem(AUTH_SESSION_KEY)
  window.localStorage.removeItem(LEGACY_AUTH_KEY)
  window.sessionStorage.removeItem(LEGACY_AUTH_KEY)
}

export const createUserAuthAccount = async (email: string, password: string, userId?: string) => {
  await ensurePrimaryAuthAccount()
  const normalizedEmail = email.trim().toLowerCase()
  const accounts = getAccounts()

  if (accounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
    throw new Error('Já existe uma conta com este e-mail.')
  }

  const now = new Date().toISOString()
  const salt = createSalt()
  const account: AuthAccount = {
    userId: userId ?? createId('usr'),
    email: normalizedEmail,
    salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: now,
    updatedAt: now,
  }
  saveAccounts([account, ...accounts])
  return account
}

export const updateUserPassword = async (email: string, password: string) => {
  await ensurePrimaryAuthAccount()
  const normalizedEmail = email.trim().toLowerCase()
  const accounts = getAccounts()
  const index = accounts.findIndex((account) => account.email.toLowerCase() === normalizedEmail)
  if (index < 0) throw new Error('Conta não encontrada.')

  const salt = createSalt()
  accounts[index] = {
    ...accounts[index],
    salt,
    passwordHash: await hashPassword(password, salt),
    updatedAt: new Date().toISOString(),
  }
  saveAccounts(accounts)
}

export const requestLocalPasswordReset = async (email: string) => {
  await ensurePrimaryAuthAccount()
  const normalizedEmail = email.trim().toLowerCase()
  const accounts = getAccounts()
  const index = accounts.findIndex((account) => account.email.toLowerCase() === normalizedEmail)
  if (index < 0) return false

  accounts[index] = {
    ...accounts[index],
    resetRequestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  saveAccounts(accounts)
  return true
}
