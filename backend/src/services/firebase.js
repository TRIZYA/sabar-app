import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'

let firebaseApp
let databaseInstance

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp
  const config = {
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  }
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(`Missing Firebase environment variables: ${missing.join(', ')}`)
  }

  firebaseApp = getApps().find(({ name }) => name === '[DEFAULT]') ?? initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey.replace(/\\n/g, '\n'),
    }),
    databaseURL: config.databaseURL,
  })
  return firebaseApp
}

export function getFirebaseDatabase() {
  if (databaseInstance) return databaseInstance
  databaseInstance = getDatabase(getFirebaseApp())
  return databaseInstance
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp())
}