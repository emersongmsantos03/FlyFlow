import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { User as FirebaseUser } from 'firebase/auth'
import type { AppState, Expense, Payment, ProjectFile } from '../types'
import { firebaseAuth, firebaseDb, isFirebaseConfigured, provisionFirebaseAuthUser } from './firebase'

const STATE_SECTION_KEYS: (keyof AppState)[] = [
  'users',
  'leads',
  'leadInteractions',
  'clients',
  'services',
  'projects',
  'projectChecklistItems',
  'appointments',
  'quotes',
  'quoteItems',
  'payments',
  'expenses',
  'recurringExpenses',
  'files',
  'projectRevisions',
  'equipment',
  'notifications',
  'tasks',
  'statusHistory',
  'projectAdjustments',
  'companySettings',
  'updatedAt',
]

const MAX_SECTION_BYTES = 900_000
const textEncoder = new TextEncoder()

let activeWorkspaceId = ''
let cachedWorkspaceId = ''
const sectionCache = new Map<keyof AppState, string>()

const isEmbeddedFile = (value?: string) => Boolean(value?.startsWith('data:'))

const prepareSectionForCloud = (key: keyof AppState, value: AppState[keyof AppState]) => {
  if (key === 'payments') {
    return (value as Payment[]).map((payment) =>
      isEmbeddedFile(payment.receiptUrl) ? { ...payment, receiptUrl: undefined } : payment,
    )
  }

  if (key === 'expenses') {
    return (value as Expense[]).map((expense) =>
      isEmbeddedFile(expense.receiptUrl) ? { ...expense, receiptUrl: undefined } : expense,
    )
  }

  if (key === 'files') {
    return (value as ProjectFile[]).filter((file) => !isEmbeddedFile(file.fileUrl))
  }

  return value
}

const restoreLocalAttachments = (cloudState: AppState, localState: AppState): AppState => {
  const localPayments = new Map(localState.payments.map((payment) => [payment.id, payment]))
  const localExpenses = new Map(localState.expenses.map((expense) => [expense.id, expense]))
  const cloudFileIds = new Set(cloudState.files.map((file) => file.id))

  return {
    ...cloudState,
    payments: cloudState.payments.map((payment) => {
      const local = localPayments.get(payment.id)
      return !payment.receiptUrl && isEmbeddedFile(local?.receiptUrl)
        ? { ...payment, receiptUrl: local?.receiptUrl }
        : payment
    }),
    expenses: cloudState.expenses.map((expense) => {
      const local = localExpenses.get(expense.id)
      return !expense.receiptUrl && isEmbeddedFile(local?.receiptUrl)
        ? { ...expense, receiptUrl: local?.receiptUrl }
        : expense
    }),
    files: [
      ...cloudState.files,
      ...localState.files.filter((file) => !cloudFileIds.has(file.id) && isEmbeddedFile(file.fileUrl)),
    ],
  }
}

const ensureServices = () => {
  if (!isFirebaseConfigured || !firebaseDb || !firebaseAuth) {
    throw new Error('Firebase não configurado.')
  }
  return { auth: firebaseAuth, db: firebaseDb }
}

export const getActiveFirebaseWorkspaceId = () => activeWorkspaceId

export const clearActiveFirebaseWorkspace = () => {
  activeWorkspaceId = ''
  cachedWorkspaceId = ''
  sectionCache.clear()
}

export const ensureFirebaseWorkspace = async (user: FirebaseUser) => {
  const { db } = ensureServices()
  const membershipRef = doc(db, 'memberships', user.uid)
  const membershipSnapshot = await getDoc(membershipRef)

  if (membershipSnapshot.exists()) {
    const membership = membershipSnapshot.data() as { workspaceId?: string; active?: boolean }
    if (!membership.active || !membership.workspaceId) {
      throw new Error('Usuário sem acesso ativo ao espaço de trabalho.')
    }
    activeWorkspaceId = membership.workspaceId
    return activeWorkspaceId
  }

  const workspaceId = user.uid
  const now = new Date().toISOString()
  const batch = writeBatch(db)
  batch.set(doc(db, 'workspaces', workspaceId), {
    ownerUid: user.uid,
    name: 'FlyFlow by Hero Drone',
    createdAt: now,
    updatedAt: serverTimestamp(),
  })
  batch.set(membershipRef, {
    workspaceId,
    email: user.email ?? '',
    active: true,
    createdAt: now,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
  activeWorkspaceId = workspaceId
  return workspaceId
}

export const loadFirebaseAppState = async (fallback: AppState): Promise<AppState | null> => {
  const { db } = ensureServices()
  if (!activeWorkspaceId) throw new Error('Espaço de trabalho do Firebase não identificado.')

  const snapshots = await getDocs(collection(db, 'workspaces', activeWorkspaceId, 'state'))
  if (snapshots.empty) return null

  const next = { ...fallback } as AppState
  sectionCache.clear()
  cachedWorkspaceId = activeWorkspaceId

  snapshots.forEach((snapshot) => {
    const key = snapshot.id as keyof AppState
    if (!STATE_SECTION_KEYS.includes(key)) return
    const value = snapshot.data().value as AppState[typeof key]
    ;(next as unknown as Record<string, unknown>)[key] = value
    sectionCache.set(key, JSON.stringify(prepareSectionForCloud(key, value)))
  })

  return restoreLocalAttachments(next, fallback)
}

export const saveFirebaseAppState = async (state: AppState) => {
  const { db } = ensureServices()
  if (!activeWorkspaceId) return

  if (cachedWorkspaceId !== activeWorkspaceId) {
    sectionCache.clear()
    cachedWorkspaceId = activeWorkspaceId
  }

  const changedSections = STATE_SECTION_KEYS.flatMap((key) => {
    const value = prepareSectionForCloud(key, state[key])
    const serialized = JSON.stringify(value)
    const size = textEncoder.encode(serialized).byteLength
    if (size > MAX_SECTION_BYTES) {
      throw new Error(`A seção "${String(key)}" excedeu o limite seguro do Firestore.`)
    }
    return sectionCache.get(key) === serialized ? [] : [{ key, value, serialized }]
  })

  if (!changedSections.length) return

  const batch = writeBatch(db)
  changedSections.forEach(({ key, value }) => {
    batch.set(doc(db, 'workspaces', activeWorkspaceId, 'state', String(key)), {
      value,
      schemaVersion: 1,
      updatedAt: serverTimestamp(),
    })
  })
  batch.set(
    doc(db, 'workspaces', activeWorkspaceId),
    { updatedAt: serverTimestamp() },
    { merge: true },
  )
  await batch.commit()

  changedSections.forEach(({ key, serialized }) => sectionCache.set(key, serialized))
}

export const createFirebaseWorkspaceUser = async (email: string, password: string) => {
  const { db, auth } = ensureServices()
  if (!activeWorkspaceId || !auth.currentUser) {
    throw new Error('Entre novamente antes de criar um usuário.')
  }
  if (auth.currentUser.uid !== activeWorkspaceId) {
    throw new Error('Somente o proprietário do workspace pode criar acessos no Firebase.')
  }

  const provisioned = await provisionFirebaseAuthUser(email, password)
  await setDoc(doc(db, 'memberships', provisioned.uid), {
    workspaceId: activeWorkspaceId,
    email: provisioned.email,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  })
  return { userId: provisioned.uid, email: provisioned.email }
}

export const setFirebaseWorkspaceUserActive = async (userId: string, active: boolean) => {
  const { db, auth } = ensureServices()
  if (!activeWorkspaceId) throw new Error('Espaço de trabalho do Firebase não identificado.')
  if (auth.currentUser?.uid !== activeWorkspaceId) {
    throw new Error('Somente o proprietário do workspace pode alterar acessos no Firebase.')
  }
  await setDoc(
    doc(db, 'memberships', userId),
    { workspaceId: activeWorkspaceId, active, updatedAt: serverTimestamp() },
    { merge: true },
  )
}
