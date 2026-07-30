import { deleteApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User as FirebaseUser,
} from 'firebase/auth'
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore'

const env = import.meta.env

export const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

const app = isFirebaseConfigured
  ? getApps().find((item) => item.name === '[DEFAULT]') ?? initializeApp(firebaseConfig)
  : null

const createFirestore = (firebaseApp: FirebaseApp): Firestore => {
  try {
    return initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true })
  } catch {
    return getFirestore(firebaseApp)
  }
}

export const firebaseAuth = app ? getAuth(app) : null
export const firebaseDb = app ? createFirestore(app) : null

if (app && firebaseConfig.measurementId && typeof window !== 'undefined') {
  void isAnalyticsSupported()
    .then((supported) => {
      if (supported) getAnalytics(app)
    })
    .catch(() => undefined)
}

export const signInWithFirebase = async (email: string, password: string, remember: boolean) => {
  if (!firebaseAuth) throw new Error('Firebase não configurado.')
  await setPersistence(firebaseAuth, remember ? browserLocalPersistence : browserSessionPersistence)
  return signInWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password)
}

export const signOutFromFirebase = async () => {
  if (firebaseAuth) await signOut(firebaseAuth)
}

export const requestFirebasePasswordReset = async (email: string) => {
  if (!firebaseAuth) throw new Error('Firebase não configurado.')
  await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase())
}

export const updateCurrentFirebasePassword = async (password: string) => {
  if (!firebaseAuth?.currentUser) throw new Error('Sua sessão não está disponível. Entre novamente para alterar a senha.')
  await updatePassword(firebaseAuth.currentUser, password)
}

export const updateFirebaseUserTemporaryPassword = async (email: string, password: string) => {
  if (!firebaseAuth?.currentUser || !firebaseConfig.projectId) {
    throw new Error('Entre novamente antes de alterar a senha.')
  }
  const token = await firebaseAuth.currentUser.getIdToken()
  const response = await fetch(
    `https://southamerica-east1-${firebaseConfig.projectId}.cloudfunctions.net/userAdminApi/temporary-password`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    },
  )
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || 'Não foi possível alterar a senha temporária.')
}

export const observeFirebaseAuth = (listener: (user: FirebaseUser | null) => void) => {
  if (!firebaseAuth) return () => undefined
  return onAuthStateChanged(firebaseAuth, listener)
}

export const provisionFirebaseAuthUser = async (email: string, password: string) => {
  if (!isFirebaseConfigured) throw new Error('Firebase não configurado.')
  const secondaryApp = initializeApp(firebaseConfig, `flyflow-user-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const secondaryAuth = getAuth(secondaryApp)
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password)
    return { uid: credential.user.uid, email: credential.user.email ?? normalizedEmail, recovered: false }
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    if (code.includes('email-already-in-use')) {
      try {
        const existing = await signInWithEmailAndPassword(secondaryAuth, normalizedEmail, password)
        return { uid: existing.user.uid, email: existing.user.email ?? normalizedEmail, recovered: true }
      } catch (signInError) {
        const signInCode = typeof signInError === 'object' && signInError && 'code' in signInError ? String(signInError.code) : ''
        if (signInCode.includes('invalid-credential') || signInCode.includes('wrong-password')) {
          return { uid: '', email: normalizedEmail, recovered: false, requiresPasswordReset: true }
        }
        throw signInError
      }
    }
    if (code.includes('weak-password')) throw new Error('A senha temporária é muito fraca. Use pelo menos 8 caracteres, uma letra e um número.')
    if (code.includes('invalid-email')) throw new Error('O e-mail informado é inválido.')
    if (code.includes('operation-not-allowed')) throw new Error('A criação de usuários por e-mail está desativada no Firebase Authentication.')
    if (code.includes('too-many-requests')) throw new Error('Muitas tentativas foram realizadas. Aguarde alguns minutos e tente novamente.')
    throw error
  } finally {
    await signOut(secondaryAuth).catch(() => undefined)
    await deleteApp(secondaryApp)
  }
}
