import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  normalizeManualProduct,
  normalizeProductPatch,
  parseHistoryLimit,
  getUserDataPath,
  createManualProduct,
  deleteProduct,
  getProductPriceHistory,
  updateProduct,
  ProductApiError,
} from './products.js'

function createFakeDatabase() {
  const values = new Map()
  let nextId = 0
  let shouldFailUpdate = false

  function makeSnapshot(value) {
    return { exists: () => value !== undefined && value !== null, val: () => value ?? null }
  }

  return {
    values,
    failNextUpdate() {
      shouldFailUpdate = true
    },
    ref(path = '') {
      let queryLimit = Infinity
      return {
        key: path.split('/').at(-1) || null,
        push() {
          nextId += 1
          return { key: `test-${nextId}` }
        },
        async get() {
          if (values.has(path)) return makeSnapshot(values.get(path))
          const prefix = path ? `${path}/` : ''
          const entries = [...values.entries()]
            .filter(([entryPath]) => entryPath.startsWith(prefix) && !entryPath.slice(prefix.length).includes('/'))
            .slice(-queryLimit)
          const result = Object.fromEntries(entries.map(([entryPath, value]) => [entryPath.slice(prefix.length), value]))
          return makeSnapshot(Object.keys(result).length > 0 ? result : null)
        },
        orderByChild() {
          return this
        },
        limitToLast(limit) {
          queryLimit = limit
          return this
        },
        limitToFirst(limit) {
          queryLimit = limit
          return this
        },
        async transaction(updateValue) {
          const currentValue = values.get(path)
          const nextValue = updateValue(currentValue)
          if (nextValue === undefined) {
            return { committed: false, snapshot: makeSnapshot(currentValue) }
          }
          if (nextValue === null) values.delete(path)
          else values.set(path, nextValue)
          return { committed: true, snapshot: makeSnapshot(nextValue) }
        },
        async update(updates) {
          if (shouldFailUpdate) {
            shouldFailUpdate = false
            throw new Error('Simulated database write failure.')
          }
          if (path) {
            const updatedValue = { ...(values.get(path) ?? {}) }
            for (const [key, value] of Object.entries(updates)) {
              if (value === null) delete updatedValue[key]
              else updatedValue[key] = value
            }
            values.set(path, updatedValue)
            return
          }
          for (const [updatePath, value] of Object.entries(updates)) {
            if (value === null) values.delete(updatePath)
            else values.set(updatePath, value)
          }
        },
      }
    },
  }
}

test('normalizes manual product data and creates a stable URL hash', () => {
  const product = normalizeManualProduct({
    url: 'https://www.example.com/item#details',
    name: '  Product name  ',
    currentPrice: 125000,
    targetPrice: 100000,
  }, 1234)

  assert.equal(product.url, 'https://www.example.com/item')
  assert.equal(product.store, 'example.com')
  assert.equal(product.name, 'Product name')
  assert.equal(product.currentPrice, 125000)
  assert.equal(product.lowestPrice, 125000)
  assert.equal(product.highestPrice, 125000)
  assert.equal(product.createdAt, 1234)
  assert.match(product.urlHash, /^[a-f0-9]{64}$/)
})

test('rejects non-public product URLs', () => {
  assert.throws(
    () => normalizeManualProduct({ url: 'file:///etc/passwd' }),
    (error) => error instanceof ProductApiError && error.code === 'INVALID_URL',
  )
})

test('rejects non-integer or non-positive prices', () => {
  assert.throws(
    () => normalizeManualProduct({
      url: 'https://example.com/item',
      name: 'Product',
      currentPrice: '125000',
      targetPrice: 100000,
    }),
    (error) => error instanceof ProductApiError && error.code === 'INVALID_PRICE',
  )
})

test('allows only supported status values and meaningful updates', () => {
  assert.deepEqual(normalizeProductPatch({ status: 'dijeda', targetPrice: 90000 }), {
    status: 'dijeda',
    targetPrice: 90000,
  })
  assert.throws(() => normalizeProductPatch({ status: 'deleted' }), ProductApiError)
  assert.throws(() => normalizeProductPatch({}), ProductApiError)
})

test('limits price history queries to at most 90 points', () => {
  assert.equal(parseHistoryLimit(undefined), 90)
  assert.equal(parseHistoryLimit('7'), 7)
  assert.throws(() => parseHistoryLimit('91'), ProductApiError)
})

test('isolates Firebase paths by a stable hash of the verified user ID', () => {
  const firstUserPath = getUserDataPath('firebase-user-one')
  const secondUserPath = getUserDataPath('firebase-user-two')

  assert.match(firstUserPath, /^users\/[a-f0-9]{64}$/)
  assert.notEqual(firstUserPath, secondUserPath)
  assert.equal(firstUserPath.includes('firebase-user-one'), false)
  assert.throws(() => getUserDataPath(''), ProductApiError)
})

test('creates products atomically with a per-user URL reservation and releases it on delete', async () => {
  const database = createFakeDatabase()
  const input = {
    url: 'https://example.com/item#details',
    name: 'Example item',
    currentPrice: 125000,
    targetPrice: 100000,
  }

  const product = await createManualProduct(database, 'firebase-user-one', input, 1234)
  const userPath = getUserDataPath('firebase-user-one')
  const reservationPath = `${userPath}/productUrlHashes/${product.urlHash}`

  assert.equal(database.values.get(reservationPath), product.id)
  assert.equal(database.values.get(`${userPath}/products/${product.id}`).currentPrice, 125000)
  await assert.rejects(
    createManualProduct(database, 'firebase-user-one', { ...input, url: 'https://example.com/item' }, 2345),
    (error) => error instanceof ProductApiError && error.code === 'DUPLICATE_PRODUCT',
  )
  await deleteProduct(database, 'firebase-user-one', product.id)
  assert.equal(database.values.has(reservationPath), false)
})

test('reclaims a URL reservation left behind by a deleted product', async () => {
  const database = createFakeDatabase()
  const userPath = getUserDataPath('firebase-user-one')
  const url = 'https://example.com/previously-deleted'
  const urlHash = createHash('sha256').update(url).digest('hex')
  database.values.set(`${userPath}/productUrlHashes/${urlHash}`, '-P5NEeU0J7eoOVGPqahE')

  const product = await createManualProduct(database, 'firebase-user-one', {
    url,
    name: 'Available again',
    currentPrice: 125000,
    targetPrice: 100000,
  })

  assert.equal(database.values.get(`${userPath}/productUrlHashes/${urlHash}`), product.id)
  assert.equal(database.values.get(`${userPath}/products/${product.id}`).name, 'Available again')
})

test('deleting a legacy product without URL fields skips a URL-index scan', async () => {
  const database = createFakeDatabase()
  const userPath = getUserDataPath('firebase-user-one')
  const urlHash = 'a'.repeat(64)
  database.values.set(`${userPath}/products/legacy-product`, {
    currentPrice: 125000,
    targetPrice: 100000,
  })
  database.values.set(`${userPath}/productUrlHashes/${urlHash}`, 'legacy-product')

  await deleteProduct(database, 'firebase-user-one', 'legacy-product')

  assert.equal(database.values.has(`${userPath}/products/legacy-product`), false)
  assert.equal(database.values.get(`${userPath}/productUrlHashes/${urlHash}`), 'legacy-product')
})

test('deleting a product without stored urlHash clears reservation derived from its URL', async () => {
  const database = createFakeDatabase()
  const userPath = getUserDataPath('firebase-user-one')
  const url = 'https://example.com/legacy-product'
  const urlHash = createHash('sha256').update(url).digest('hex')
  database.values.set(`${userPath}/products/legacy-product`, { url })
  database.values.set(`${userPath}/productUrlHashes/${urlHash}`, 'legacy-product')

  await deleteProduct(database, 'firebase-user-one', 'legacy-product')

  assert.equal(database.values.has(`${userPath}/products/legacy-product`), false)
  assert.equal(database.values.has(`${userPath}/productUrlHashes/${urlHash}`), false)
})

test('updates current price atomically and appends a manual price point', async () => {
  const database = createFakeDatabase()
  const product = await createManualProduct(database, 'firebase-user-one', {
    url: 'https://example.com/item',
    name: 'Example item',
    currentPrice: 125000,
    targetPrice: 100000,
  }, 1000)

  const updated = await updateProduct(database, 'firebase-user-one', product.id, {
    currentPrice: 90000,
  }, 2000)
  const points = await getProductPriceHistory(database, 'firebase-user-one', product.id, 90)

  assert.equal(updated.currentPrice, 90000)
  assert.equal(updated.lowestPrice, 90000)
  assert.equal(updated.highestPrice, 125000)
  assert.equal(updated.lastCheckedAt, 2000)
  assert.equal(points.length, 2)
  assert.deepEqual(points.at(-1), {
    id: 'test-3',
    price: 90000,
    checkedAt: 2000,
    source: 'manual',
  })
})

test('rejects invalid current price changes before writing', async () => {
  const database = createFakeDatabase()
  const product = await createManualProduct(database, 'firebase-user-one', {
    url: 'https://example.com/item',
    name: 'Example item',
    currentPrice: 125000,
    targetPrice: 100000,
  }, 1000)

  await assert.rejects(
    updateProduct(database, 'firebase-user-one', product.id, { currentPrice: 0 }, 2000),
    (error) => error instanceof ProductApiError && error.code === 'INVALID_PRICE',
  )
})

test('repairs incomplete product details and reserves the new URL', async () => {
  const database = createFakeDatabase()
  const userPath = getUserDataPath('firebase-user-one')
  database.values.set(`${userPath}/products/legacy-product`, {
    currentPrice: 125000,
    targetPrice: 0,
    status: 'aktif',
  })

  const updated = await updateProduct(database, 'firebase-user-one', 'legacy-product', {
    name: 'Recovered product',
    url: 'https://www.example.com/recovered#details',
    targetPrice: 100000,
  }, 3000)

  const urlHash = createHash('sha256').update('https://www.example.com/recovered').digest('hex')
  assert.equal(updated.name, 'Recovered product')
  assert.equal(updated.url, 'https://www.example.com/recovered')
  assert.equal(updated.store, 'example.com')
  assert.equal(updated.targetPrice, 100000)
  assert.equal(database.values.get(`${userPath}/productUrlHashes/${urlHash}`), 'legacy-product')
  assert.equal(database.values.get(`${userPath}/products/legacy-product`).urlHash, urlHash)
})

test('prevents repairing a product with another product URL', async () => {
  const database = createFakeDatabase()
  const firstProduct = await createManualProduct(database, 'firebase-user-one', {
    url: 'https://example.com/first',
    name: 'First product',
    currentPrice: 125000,
    targetPrice: 100000,
  })
  const userPath = getUserDataPath('firebase-user-one')
  database.values.set(`${userPath}/products/legacy-product`, {
    currentPrice: 125000,
    targetPrice: 0,
    status: 'aktif',
  })

  await assert.rejects(
    updateProduct(database, 'firebase-user-one', 'legacy-product', {
      name: 'Duplicate product',
      url: 'https://example.com/first',
      targetPrice: 100000,
    }),
    (error) => error instanceof ProductApiError && error.code === 'DUPLICATE_PRODUCT',
  )
  assert.equal(database.values.get(`${userPath}/products/${firstProduct.id}`).name, 'First product')
  assert.equal(database.values.get(`${userPath}/products/legacy-product`).name, undefined)
})

test('preserves the previous URL reservation and releases the new one on write failure', async () => {
  const database = createFakeDatabase()
  const userPath = getUserDataPath('firebase-user-one')
  const previousUrl = 'https://example.com/previous'
  const previousUrlHash = createHash('sha256').update(previousUrl).digest('hex')
  database.values.set(`${userPath}/products/legacy-product`, {
    url: previousUrl,
    urlHash: previousUrlHash,
    name: 'Legacy product',
    currentPrice: 125000,
    targetPrice: 100000,
    status: 'aktif',
  })
  database.values.set(`${userPath}/productUrlHashes/${previousUrlHash}`, 'legacy-product')
  database.failNextUpdate()

  await assert.rejects(
    updateProduct(database, 'firebase-user-one', 'legacy-product', {
      url: 'https://example.com/new-url',
    }),
    /Simulated database write failure/,
  )

  const newUrlHash = createHash('sha256').update('https://example.com/new-url').digest('hex')
  assert.equal(database.values.get(`${userPath}/productUrlHashes/${previousUrlHash}`), 'legacy-product')
  assert.equal(database.values.has(`${userPath}/productUrlHashes/${newUrlHash}`), false)
  assert.equal(database.values.get(`${userPath}/products/legacy-product`).url, previousUrl)
})