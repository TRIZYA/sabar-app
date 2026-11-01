function authError(response, status, code, message) {
  return response.status(status).json({ error: { code, message } })
}

export function createAuthMiddleware(verifyIdToken) {
  return async function requireVerifiedFirebaseUser(request, response, next) {
    const authorization = request.get('authorization') || ''
    const match = authorization.match(/^Bearer\s+(\S+)$/i)
    if (!match) {
      return authError(response, 401, 'AUTH_REQUIRED', 'Sign in to continue.')
    }

    let claims
    try {
      claims = await verifyIdToken(match[1])
    } catch {
      return authError(response, 401, 'INVALID_TOKEN', 'Your session is invalid or expired.')
    }

    if (typeof claims?.uid !== 'string' || claims.uid.length === 0) {
      return authError(response, 401, 'INVALID_TOKEN', 'Your session is invalid or expired.')
    }

    if (claims.email_verified !== true) {
      return authError(response, 403, 'EMAIL_NOT_VERIFIED', 'Verify your email before continuing.')
    }

    request.authUser = { uid: claims.uid, email: claims.email || null }
    return next()
  }
}