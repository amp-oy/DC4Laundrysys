const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api'

export async function apiRequest(path, { token, method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw requestError

    throw new Error(
      `Unable to reach the API at ${apiBase}. Check that Laravel is running and that this frontend origin is allowed by CORS.`,
      { cause: requestError },
    )
  }

  let payload
  try {
    payload = await response.json()
  } catch (parseError) {
    if (response.ok) throw new Error('The server returned an unreadable response.', { cause: parseError })
    payload = null
  }

  if (!response.ok) {
    const validationMessage = payload?.errors
      ? Object.values(payload.errors).flat().join(' ')
      : null
    const requestError = new Error(validationMessage || payload?.message || `Request failed (${response.status}).`)
    requestError.status = response.status
    throw requestError
  }

  return payload
}
