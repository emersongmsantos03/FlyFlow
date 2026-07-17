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

const ARRAY_SECTION_KEYS = [
  'users',
  'leads',
  'leadInteractions',
  'clients',
  'companies',
  'leadHunterCities',
  'leadHunterCategories',
  'leadHunterProspects',
  'leadHunterSearches',
  'leadHunterRoutes',
  'services',
  'projects',
  'projectChecklistItems',
  'appointments',
  'quotes',
  'quoteItems',
  'payments',
  'expenses',
  'recurringExpenses',
  'bankAccounts',
  'bankTransfers',
  'files',
  'projectRevisions',
  'equipment',
  'notifications',
  'tasks',
  'statusHistory',
  'projectAdjustments',
] as const satisfies readonly (keyof AppState)[]

const LEGACY_STATE_SECTION_KEYS: (keyof AppState)[] = [
  ...ARRAY_SECTION_KEYS,
  'companySettings',
  'updatedAt',
]

const DATA_SCHEMA_VERSION = 2
const MAX_RECORD_BYTES = 900_000
const MAX_BATCH_OPERATIONS = 400
const textEncoder = new TextEncoder()

type ArraySectionKey = (typeof ARRAY_SECTION_KEYS)[number]
type StoredRecord = { value: unknown; position: number }
type WriteOperation =
  | { kind: 'set'; section: string; id: string; payload: StoredRecord; serialized: string }
  | { kind: 'delete'; section: string; id: string }

let activeWorkspaceId = ''
let cachedWorkspaceId = ''
let cachedSchemaVersion = 0
const recordCache = new Map<string, string>()

const isEmbeddedFile = (value?: string) => Boolean(value?.startsWith('data:'))
const recordCacheKey = (section: string, id: string) => JSON.stringify([section, id])
const parseRecordCacheKey = (key: string) => JSON.parse(key) as [string, string]
const firestoreRecordId = (id: string) => encodeURIComponent(id)

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
    return (value as ProjectFile[]).map((file) =>
      isEmbeddedFile(file.fileUrl) ? { ...file, fileUrl: undefined } : file,
    )
  }

  return value
}

const restoreLocalAttachments = (cloudState: AppState, localState: AppState): AppState => {
  const localPayments = new Map(localState.payments.map((payment) => [payment.id, payment]))
  const localExpenses = new Map(localState.expenses.map((expense) => [expense.id, expense]))
  const localFiles = new Map(localState.files.map((file) => [file.id, file]))
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
      ...cloudState.files.map((file) => {
        const local = localFiles.get(file.id)
        return !file.fileUrl && isEmbeddedFile(local?.fileUrl)
          ? { ...file, fileUrl: local?.fileUrl }
          : file
      }),
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

const recordCollection = (section: string) => {
  const { db } = ensureServices()
  return collection(db, 'workspaces', activeWorkspaceId, 'collections', section, 'items')
}

const recordReference = (section: string, id: string) => {
  const { db } = ensureServices()
  return doc(db, 'workspaces', activeWorkspaceId, 'collections', section, 'items', firestoreRecordId(id))
}

const loadGranularAppState = async (fallback: AppState, workspaceUpdatedAt?: unknown): Promise<AppState> => {
  const next = { ...fallback } as AppState
  recordCache.clear()

  await Promise.all(
    ARRAY_SECTION_KEYS.map(async (section) => {
      const snapshot = await getDocs(recordCollection(section))
      const records: Array<{ value: unknown; position: number; documentId: string }> = []

      snapshot.forEach((itemSnapshot) => {
        const data = itemSnapshot.data() as Partial<StoredRecord>
        if (!data.value || typeof data.value !== 'object') return
        const value = data.value as { id?: string }
        const id = value.id || decodeURIComponent(itemSnapshot.id)
        const position = Number.isFinite(data.position) ? Number(data.position) : records.length
        const payload = { value: data.value, position }
        records.push({ value: data.value, position, documentId: id })
        recordCache.set(recordCacheKey(section, id), JSON.stringify(payload))
      })

      records.sort((left, right) => left.position - right.position)
      ;(next as unknown as Record<ArraySectionKey, unknown[]>)[section] = records.map((record) => record.value)
    }),
  )

  const settingsSnapshot = await getDoc(recordReference('companySettings', 'current'))
  if (settingsSnapshot.exists()) {
    const data = settingsSnapshot.data() as Partial<StoredRecord>
    if (data.value && typeof data.value === 'object') {
      next.companySettings = data.value as AppState['companySettings']
      recordCache.set(
        recordCacheKey('companySettings', 'current'),
        JSON.stringify({ value: data.value, position: 0 }),
      )
    }
  }

  const hunterSettingsSnapshot = await getDoc(recordReference('leadHunterSettings', 'current'))
  if (hunterSettingsSnapshot.exists()) {
    const data = hunterSettingsSnapshot.data() as Partial<StoredRecord>
    if (data.value && typeof data.value === 'object') {
      next.leadHunterSettings = data.value as AppState['leadHunterSettings']
      recordCache.set(recordCacheKey('leadHunterSettings', 'current'), JSON.stringify({ value: data.value, position: 0 }))
    }
  }

  if (workspaceUpdatedAt && typeof workspaceUpdatedAt === 'object' && 'toDate' in workspaceUpdatedAt) {
    const timestamp = workspaceUpdatedAt as { toDate?: () => Date }
    if (typeof timestamp.toDate === 'function') next.updatedAt = timestamp.toDate().toISOString()
  }

  return restoreLocalAttachments(next, fallback)
}

const loadLegacyAppState = async (fallback: AppState): Promise<AppState | null> => {
  const { db } = ensureServices()
  const snapshots = await getDocs(collection(db, 'workspaces', activeWorkspaceId, 'state'))
  if (snapshots.empty) return null

  const next = { ...fallback } as AppState
  snapshots.forEach((snapshot) => {
    const key = snapshot.id as keyof AppState
    if (!LEGACY_STATE_SECTION_KEYS.includes(key)) return
    ;(next as unknown as Record<string, unknown>)[key] = snapshot.data().value
  })
  return restoreLocalAttachments(next, fallback)
}

export const getActiveFirebaseWorkspaceId = () => activeWorkspaceId

export const clearActiveFirebaseWorkspace = () => {
  activeWorkspaceId = ''
  cachedWorkspaceId = ''
  cachedSchemaVersion = 0
  recordCache.clear()
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

  const workspaceSnapshot = await getDoc(doc(db, 'workspaces', activeWorkspaceId))
  const workspaceData = workspaceSnapshot.data() as { dataSchemaVersion?: number; updatedAt?: unknown } | undefined
  cachedWorkspaceId = activeWorkspaceId
  cachedSchemaVersion = Number(workspaceData?.dataSchemaVersion ?? 0)
  recordCache.clear()

  if (cachedSchemaVersion >= DATA_SCHEMA_VERSION) {
    return loadGranularAppState(fallback, workspaceData?.updatedAt)
  }

  return loadLegacyAppState(fallback)
}

export const saveFirebaseAppState = async (state: AppState) => {
  const { db } = ensureServices()
  if (!activeWorkspaceId) return

  if (cachedWorkspaceId !== activeWorkspaceId) {
    recordCache.clear()
    cachedWorkspaceId = activeWorkspaceId
    cachedSchemaVersion = 0
  }

  const currentRecords = new Map<string, string>()
  const operations: WriteOperation[] = []

  ARRAY_SECTION_KEYS.forEach((section) => {
    const items = prepareSectionForCloud(section, state[section]) as Array<{ id?: string }>
    items.forEach((item, position) => {
      if (!item.id) throw new Error(`Registro sem ID encontrado na seção "${section}".`)
      const payload: StoredRecord = { value: item, position }
      const serialized = JSON.stringify(payload)
      if (textEncoder.encode(serialized).byteLength > MAX_RECORD_BYTES) {
        throw new Error(`Um registro da seção "${section}" excedeu o limite seguro do Firestore.`)
      }
      const cacheKey = recordCacheKey(section, item.id)
      currentRecords.set(cacheKey, serialized)
      if (recordCache.get(cacheKey) !== serialized) {
        operations.push({ kind: 'set', section, id: item.id, payload, serialized })
      }
    })
  })

  const settingsPayload: StoredRecord = { value: state.companySettings, position: 0 }
  const settingsSerialized = JSON.stringify(settingsPayload)
  const settingsCacheKey = recordCacheKey('companySettings', 'current')
  currentRecords.set(settingsCacheKey, settingsSerialized)
  if (recordCache.get(settingsCacheKey) !== settingsSerialized) {
    operations.push({
      kind: 'set',
      section: 'companySettings',
      id: 'current',
      payload: settingsPayload,
      serialized: settingsSerialized,
    })
  }

  if (state.leadHunterSettings) {
    const hunterSettingsPayload: StoredRecord = { value: state.leadHunterSettings, position: 0 }
    const hunterSettingsSerialized = JSON.stringify(hunterSettingsPayload)
    const hunterSettingsCacheKey = recordCacheKey('leadHunterSettings', 'current')
    currentRecords.set(hunterSettingsCacheKey, hunterSettingsSerialized)
    if (recordCache.get(hunterSettingsCacheKey) !== hunterSettingsSerialized) operations.push({ kind: 'set', section: 'leadHunterSettings', id: 'current', payload: hunterSettingsPayload, serialized: hunterSettingsSerialized })
  }

  recordCache.forEach((_serialized, cacheKey) => {
    if (currentRecords.has(cacheKey)) return
    const [section, id] = parseRecordCacheKey(cacheKey)
    operations.push({ kind: 'delete', section, id })
  })

  for (let index = 0; index < operations.length; index += MAX_BATCH_OPERATIONS) {
    const batch = writeBatch(db)
    operations.slice(index, index + MAX_BATCH_OPERATIONS).forEach((operation) => {
      const reference = recordReference(operation.section, operation.id)
      if (operation.kind === 'delete') {
        batch.delete(reference)
      } else {
        batch.set(reference, {
          ...operation.payload,
          updatedAt: serverTimestamp(),
        })
      }
    })
    await batch.commit()
  }

  if (operations.length || cachedSchemaVersion < DATA_SCHEMA_VERSION) {
    await setDoc(
      doc(db, 'workspaces', activeWorkspaceId),
      {
        dataSchemaVersion: DATA_SCHEMA_VERSION,
        updatedAt: serverTimestamp(),
        ...(cachedSchemaVersion < DATA_SCHEMA_VERSION ? { migratedAt: serverTimestamp() } : {}),
      },
      { merge: true },
    )
  }

  recordCache.clear()
  currentRecords.forEach((serialized, cacheKey) => recordCache.set(cacheKey, serialized))
  cachedSchemaVersion = DATA_SCHEMA_VERSION
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
