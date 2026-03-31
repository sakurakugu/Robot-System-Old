function shouldAttachAuth(url: URL): boolean {
  return url.origin === window.location.origin || url.pathname.startsWith('/api/');
}

export function setupAuthenticatedFetch() {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      input instanceof Request
        ? new URL(input.url, window.location.origin)
        : new URL(String(input), window.location.origin)

    if (!shouldAttachAuth(requestUrl)) {
      return originalFetch(input, init)
    }

    const token = localStorage.getItem('auth_token') || ''
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers)
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    if (!headers.has('x-client-type')) {
      headers.set('x-client-type', 'web')
    }
    if (!headers.has('x-device-name')) {
      headers.set('x-device-name', navigator.userAgent)
    }

    if (input instanceof Request) {
      return originalFetch(new Request(input, { ...init, headers }))
    }

    return originalFetch(input, { ...init, headers })
  }
}
