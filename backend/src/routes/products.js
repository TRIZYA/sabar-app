import express from 'express'
import { getFirebaseDatabase } from '../services/firebase.js'
import {
  createManualProduct,
  deleteProduct,
  getProduct,
  getProductPriceHistory,
  listProducts,
  parseHistoryLimit,
  ProductApiError,
  updateProduct,
} from '../services/products.js'

export function createProductsRouter() {
  const router = express.Router()

  router.get('/', async (_request, response) => {
    const products = await listProducts(getFirebaseDatabase(), _request.authUser.uid)
    response.json({ data: products })
  })

  router.post('/', async (request, response) => {
    const product = await createManualProduct(getFirebaseDatabase(), request.authUser.uid, request.body)
    response.status(201).json({ data: product })
  })

  router.get('/:productId/price-history', async (request, response) => {
    const limit = parseHistoryLimit(request.query.limit)
    const points = await getProductPriceHistory(
      getFirebaseDatabase(),
      request.authUser.uid,
      request.params.productId,
      limit,
    )
    response.json({ data: points })
  })

  router.get('/:productId', async (request, response) => {
    const product = await getProduct(getFirebaseDatabase(), request.authUser.uid, request.params.productId)
    response.json({ data: product })
  })

  router.patch('/:productId', async (request, response) => {
    const product = await updateProduct(
      getFirebaseDatabase(),
      request.authUser.uid,
      request.params.productId,
      request.body,
    )
    response.json({ data: product })
  })

  router.delete('/:productId', async (request, response) => {
    const result = await deleteProduct(getFirebaseDatabase(), request.authUser.uid, request.params.productId)
    response.json({ data: result })
  })

  router.use((error, _request, response, next) => {
    if (response.headersSent) return next(error)

    const isApiError = error instanceof ProductApiError
    const statusCode = isApiError ? error.statusCode : 503
    const payload = {
      code: isApiError ? error.code : 'STORAGE_UNAVAILABLE',
      message: isApiError ? error.message : 'Product storage is unavailable.',
    }
    if (isApiError && error.details) payload.details = error.details

    response.status(statusCode).json({ error: payload })
  })

  return router
}