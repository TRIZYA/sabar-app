import express from 'express'
import { createAuthMiddleware } from './middleware/auth.js'
import { createProductsRouter } from './routes/products.js'
import { getUserDataPath } from './services/products.js'
import { getFirebaseAuth, getFirebaseDatabase } from './services/firebase.js'

const app = express()

app.use(express.json())

const requireVerifiedUser = createAuthMiddleware((token) => getFirebaseAuth().verifyIdToken(token))
app.use('/api/products', requireVerifiedUser, createProductsRouter())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/health/firebase', requireVerifiedUser, async (request, response) => {
  try {
    const userProductsPath = `${getUserDataPath(request.authUser.uid)}/products`
    await getFirebaseDatabase().ref(userProductsPath).limitToFirst(1).get()
    response.json({ status: 'ok', service: 'firebase' })
  } catch {
    response.status(503).json({
      status: 'error',
      message: 'Firebase is unavailable or not configured.',
    })
  }
})

export default app