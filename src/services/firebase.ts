import { deleteApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
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

export const observeFirebaseAuth = (listener: (user: FirebaseUser | null) => void) => {
  if (!firebaseAuth) return () => undefined
  return onAuthStateChanged(firebaseAuth, listener)
}

export const provisionFirebaseAuthUser = async (email: string, password: string) => {
  if (!isFirebaseConfigured) throw new Error('Firebase não configurado.')

  const secondaryApp = initializeApp(firebaseConfig, `flyflow-user-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const secondaryAuth = getAuth(secondaryApp)

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), password)
    return { uid: credential.user.uid, email: credential.user.email ?? email.trim().toLowerCase() }
  } finally {
    await signOut(secondaryAuth).catch(() => undefined)
    await deleteApp(secondaryApp)
  }
}
