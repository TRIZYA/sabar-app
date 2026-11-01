import { createHash } from 'node:crypto'

export class ProductApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

function parseProductUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ProductApiError(400, 'INVALID_URL', 'A valid product URL is required.')
  }

  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new ProductApiError(400, 'INVALID_URL', 'A valid product URL is required.')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new ProductApiError(400, 'INVALID_URL', 'Only public HTTP or HTTPS product URLs are allowed.')
  }

  url.hash = ''
  return url
}

function parsePrice(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ProductApiError(400, 'INVALID_PRICE', `${field} must be a positive integer.`)
  }

  return value
}

export function normalizeManualProduct(input, now = Date.now()) {
  const url = parseProductUrl(input?.url)
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name.length === 0 || name.length > 240) {
    throw new ProductApiError(400, 'INVALID_NAME', 'Name must contain 1 to 240 characters.')
  }

  let image
  if (input.image !== undefined && input.image !== '') {
    image = parseProductUrl(input.image).toString()
  }

  const normalizedUrl = url.toString()
  const product = {
    url: normalizedUrl,
    urlHash: createHash('sha256').update(normalizedUrl).digest('hex'),
    name,
    store: url.hostname.replace(/^www\./, ''),
    currency: 'IDR',
    currentPrice: parsePrice(input.currentPrice, 'currentPrice'),
    lowestPrice: parsePrice(input.currentPrice, 'currentPrice'),
    highestPrice: parsePrice(input.currentPrice, 'currentPrice'),
    targetPrice: parsePrice(input.targetPrice, 'targetPrice'),
    status: 'aktif',
    lastCheckedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  if (image) product.image = image
  return product
}

export function normalizeProductPatch(input) {
  const patch = {}
  if (input?.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (name.length === 0 || name.length > 240) {
      throw new ProductApiError(400, 'INVALID_NAME', 'Name must contain 1 to 240 characters.')
    }
    patch.name = name
  }
  if (input?.url !== undefined) {
    const url = parseProductUrl(input.url)
    const normalizedUrl = url.toString()
    patch.url = normalizedUrl
    patch.urlHash = createHash('sha256').update(normalizedUrl).digest('hex')
    patch.store = url.hostname.replace(/^www\./, '')
  }
  if (input?.currentPrice !== undefined) {
    patch.currentPrice = parsePrice(input.currentPrice, 'currentPrice')
  }
  if (input?.targetPrice !== undefined) {
    patch.targetPrice = parsePrice(input.targetPrice, 'targetPrice')
  }
  if (input?.status !== undefined) {
    if (!['aktif', 'dijeda'].includes(input.status)) {
      throw new ProductApiError(400, 'INVALID_STATUS', 'Status must be aktif or dijeda.')
    }
    patch.status = input.status
  }
  if (Object.keys(patch).length === 0) {
    throw new ProductApiError(400, 'EMPTY_UPDATE', 'Provide product details, currentPrice, targetPrice, or status to update.')
  }
  return patch
}

export function parseHistoryLimit(value) {
  const limit = value === undefined ? 90 : Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > 90) {
    throw new ProductApiError(400, 'INVALID_LIMIT', 'History limit must be between 1 and 90.')
  }
  return limit
}

export function getUserDataPath(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new ProductApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.')
  }
  const userKey = createHash('sha256').update(userId).digest('hex')
  return `users/${userKey}`
}

function parseProductId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new ProductApiError(400, 'INVALID_PRODUCT_ID', 'A valid product ID is required.')
  }
  return value
}

function snapshotEntries(snapshot) {
  return Object.entries(snapshot.val() ?? {}).map(([id, product]) => ({ id, ...product }))
}

export async function listProducts(database, userId) {
  const productsPath = `${getUserDataPath(userId)}/products`
  const snapshot = await database.ref(productsPath).limitToLast(100).get()
  return snapshotEntries(snapshot).sort((left, right) => right.createdAt - left.createdAt)
}

export async function getProduct(database, userId, productId) {
  const productsPath = `${getUserDataPath(userId)}/products`
  const id = parseProductId(productId)
  const snapshot = await database.ref(`${productsPath}/${id}`).get()
  if (!snapshot.exists()) {
    throw new ProductApiError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.')
  }
  return { id, ...snapshot.val() }
}

export async function createManualProduct(database, userId, input, now = Date.now()) {
  const userPath = getUserDataPath(userId)
  const productsPath = `${userPath}/products`
  const pricePointsPath = `${userPath}/pricePoints`
  const product = normalizeManualProduct(input, now)
  const productRef = database.ref(productsPath).push()
  const productId = productRef.key
  if (!productId) {
    throw new Error('Unable to allocate a product ID.')
  }

  const pointId = database.ref(`${pricePointsPath}/${productId}`).push().key
  if (!pointId) {
    throw new Error('Unable to allocate a price point ID.')
  }

  const urlHashRef = database.ref(`${userPath}/productUrlHashes/${product.urlHash}`)
  let ownsReservation = false
  try {
    let reservation
    for (let attempt = 0; attempt < 3; attempt += 1) {
      reservation = await urlHashRef.transaction((currentProductId) => (
        currentProductId == null ? productId : undefined
      ))
      if (reservation.committed) break

      const conflictingProductId = reservation.snapshot.val()
      let existingProduct
      if (typeof conflictingProductId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(conflictingProductId)) {
        existingProduct = await database.ref(`${productsPath}/${conflictingProductId}`).get()
      }

      if (existingProduct?.exists()) break
      reservation = await urlHashRef.transaction((currentProductId) => (
        currentProductId == null || currentProductId === conflictingProductId ? productId : undefined
      ))
      if (reservation.committed) break
    }

    if (!reservation.committed) {
      throw new ProductApiError(409, 'DUPLICATE_PRODUCT', 'This product is already being tracked.', {
        productId: reservation.snapshot.val(),
      })
    }

    ownsReservation = true
    await database.ref().update({
      [`${productsPath}/${productId}`]: product,
      [`${pricePointsPath}/${productId}/${pointId}`]: {
        price: product.currentPrice,
        checkedAt: now,
        source: 'manual',
      },
    })
  } catch (error) {
    if (ownsReservation) {
      await urlHashRef.transaction((currentProductId) => (
        currentProductId === productId ? null : undefined
      ))
    }
    await database.ref().update({
      [`${productsPath}/${productId}`]: null,
      [`${pricePointsPath}/${productId}`]: null,
    })
    throw error
  }

  return { id: productId, ...product }
}

export async function updateProduct(database, userId, productId, input, now = Date.now()) {
  const userPath = getUserDataPath(userId)
  const productsPath = `${userPath}/products`
  const id = parseProductId(productId)
  const patch = normalizeProductPatch(input)
  const product = await getProduct(database, userId, id)
  const updates = { ...patch, updatedAt: now }
  let previousUrlHash = typeof product.urlHash === 'string' ? product.urlHash : null
  if (!previousUrlHash && typeof product.url === 'string') {
    try {
      previousUrlHash = createHash('sha256').update(parseProductUrl(product.url).toString()).digest('hex')
    } catch {
      previousUrlHash = null
    }
  }
  const changedUrlHash = patch.urlHash && patch.urlHash !== previousUrlHash
    ? patch.urlHash
    : null
  const urlHashRef = changedUrlHash
    ? database.ref(`${userPath}/productUrlHashes/${changedUrlHash}`)
    : null

  if (urlHashRef) {
    const reservation = await urlHashRef.transaction((currentProductId) => (
      currentProductId == null || currentProductId === id ? id : undefined
    ))
    if (!reservation.committed) {
      throw new ProductApiError(409, 'DUPLICATE_PRODUCT', 'This product is already being tracked.', {
        productId: reservation.snapshot.val(),
      })
    }
  }

  try {
    if (patch.currentPrice !== undefined) {
      const pointId = database.ref(`${userPath}/pricePoints/${id}`).push().key
      if (!pointId) throw new Error('Unable to allocate a price point ID.')

      const priorPrice = Number.isSafeInteger(product.currentPrice) ? product.currentPrice : patch.currentPrice
      const priorLowest = Number.isSafeInteger(product.lowestPrice) ? product.lowestPrice : priorPrice
      const priorHighest = Number.isSafeInteger(product.highestPrice) ? product.highestPrice : priorPrice
      updates.lowestPrice = Math.min(priorLowest, patch.currentPrice)
      updates.highestPrice = Math.max(priorHighest, patch.currentPrice)
      updates.lastCheckedAt = now

      await database.ref().update({
        [`${productsPath}/${id}`]: updates,
        [`${userPath}/pricePoints/${id}/${pointId}`]: {
          price: patch.currentPrice,
          checkedAt: now,
          source: 'manual',
        },
      })
    } else {
      await database.ref(`${productsPath}/${id}`).update(updates)
    }
  } catch (error) {
    if (urlHashRef) {
      await urlHashRef.transaction((currentProductId) => (
        currentProductId === id ? null : undefined
      ))
    }
    throw error
  }

  if (urlHashRef && previousUrlHash) {
    await database.ref(`${userPath}/productUrlHashes/${previousUrlHash}`).transaction((currentProductId) => (
      currentProductId === id ? null : undefined
    ))
  }

  return { ...product, ...updates }
}

export async function deleteProduct(database, userId, productId) {
  const userPath = getUserDataPath(userId)
  const id = parseProductId(productId)
  const product = await getProduct(database, userId, id)
  const updates = {
    [`${userPath}/products/${id}`]: null,
    [`${userPath}/pricePoints/${id}`]: null,
  }
  let urlHash = typeof product.urlHash === 'string' ? product.urlHash : null
  if (!urlHash && typeof product.url === 'string') {
    try {
      urlHash = createHash('sha256').update(parseProductUrl(product.url).toString()).digest('hex')
    } catch {
      urlHash = null
    }
  }
  if (urlHash) updates[`${userPath}/productUrlHashes/${urlHash}`] = null
  await database.ref().update(updates)
  return { id, deleted: true }
}

export async function getProductPriceHistory(database, userId, productId, requestedLimit) {
  const userPath = getUserDataPath(userId)
  const id = parseProductId(productId)
  const limit = parseHistoryLimit(requestedLimit)
  await getProduct(database, userId, id)
  const snapshot = await database.ref(`${userPath}/pricePoints/${id}`)
    .orderByChild('checkedAt')
    .limitToLast(limit)
    .get()

  return snapshotEntries(snapshot).sort((left, right) => left.checkedAt - right.checkedAt)
}