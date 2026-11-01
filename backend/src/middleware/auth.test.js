import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthMiddleware } from './auth.js'

function createRequest(authorization = '') {
  return { get: (name) => name.toLowerCase() === 'authorization' ? authorization : undefined }
}

function createResponse() {
  return {
    statusCode: 200,
    payload: undefined,
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
}

test('rejects requests without a bearer token', async () => {
  const middleware = createAuthMiddleware(async () => ({ uid: 'user-1', email_verified: true }))
  const response = createResponse()
  let continued = false

  await middleware(createRequest(), response, () => { continued = true })

  assert.equal(response.statusCode, 401)
  assert.equal(response.payload.error.code, 'AUTH_REQUIRED')
  assert.equal(continued, false)
})

test('rejects invalid Firebase tokens without exposing verifier errors', async () => {
  const middleware = createAuthMiddleware(async () => { throw new Error('private verifier details') })
  const response = createResponse()

  await middleware(createRequest('Bearer bad-token'), response, () => {})

  assert.equal(response.statusCode, 401)
  assert.equal(response.payload.error.code, 'INVALID_TOKEN')
  assert.equal(JSON.stringify(response.payload).includes('private verifier details'), false)
})

test('requires a verified email before granting API access', async () => {
  const middleware = createAuthMiddleware(async () => ({ uid: 'user-1', email_verified: false }))
  const response = createResponse()

  await middleware(createRequest('Bearer valid-token'), response, () => {})

  assert.equal(response.statusCode, 403)
  assert.equal(response.payload.error.code, 'EMAIL_NOT_VERIFIED')
})

test('attaches only verified Firebase identity to the request', async () => {
  const middleware = createAuthMiddleware(async () => ({
    uid: 'user-1',
    email: 'user@example.com',
    email_verified: true,
  }))
  const request = createRequest('Bearer valid-token')
  const response = createResponse()
  let continued = false

  await middleware(request, response, () => { continued = true })

  assert.deepEqual(request.authUser, { uid: 'user-1', email: 'user@example.com' })
  assert.equal(continued, true)
  assert.equal(response.statusCode, 200)
})