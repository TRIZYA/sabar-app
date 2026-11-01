import { getApp, getApps, initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseAuthConfigured = Object.values(config).every(Boolean)
const firebaseApp = firebaseAuthConfigured
  ? (getApps().length > 0 ? getApp() : initializeApp(config))
  : null

export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const authPersistenceReady = auth
  ? setPersistence(auth, browserLocalPersistence)
  : Promise.resolve()