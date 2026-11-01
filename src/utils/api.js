import { auth } from './firebase.js'
import { signOut } from 'firebase/auth'

function normalizeApiBaseUrl(value) {
  const baseUrl = value?.trim().replace(/\/+$/, '') || '/api'
  return baseUrl.toLowerCase().endsWith('/api') ? baseUrl : `${baseUrl}/api`
}

const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
const apiTimeoutMs = 15_000

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request(path, options = {}) {
  let response
  try {
    const user = auth?.currentUser
    if (!user) {
      throw new ApiError(401, 'AUTH_REQUIRED', 'Masuk untuk melanjutkan.')
    }
    const idToken = await user.getIdToken()
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(apiTimeoutMs),
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error.name === 'TimeoutError') {
      throw new ApiError(0, 'API_TIMEOUT', 'Backend terlalu lama merespons. Coba segarkan lagi.')
    }
    throw new ApiError(0, 'API_UNREACHABLE', 'Backend tidak dapat dijangkau. Coba lagi sebentar.')
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    if (response.status === 502 || response.status === 503) {
      throw new ApiError(
        response.status,
        'API_UNAVAILABLE',
        'Backend tidak merespons. Pastikan server backend berjalan di port 3000, lalu coba lagi.',
      )
    }
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Backend mengirim respons yang tidak dapat dibaca.')
  }

  const payload = await response.json()
  if (!response.ok) {
    if (response.status === 401 && auth?.currentUser) await signOut(auth)
    const error = payload.error || {}
    throw new ApiError(
      response.status,
      error.code || 'REQUEST_FAILED',
      error.message || 'Permintaan gagal. Coba lagi.',
      error.details,
    )
  }

  return payload.data ?? payload
}

export const api = {
  healthFirebase: () => request('/health/firebase'),
  getProducts: () => request('/products'),
  createProduct: (body) => request('/products', { method: 'POST', body }),
  getProduct: (productId) => request(`/products/${encodeURIComponent(productId)}`),
  updateProduct: (productId, body) => request(`/products/${encodeURIComponent(productId)}`, { method: 'PATCH', body }),
  deleteProduct: (productId) => request(`/products/${encodeURIComponent(productId)}`, { method: 'DELETE' }),
  getPriceHistory: (productId, limit = 90) => request(`/products/${encodeURIComponent(productId)}/price-history?limit=${limit}`),
}