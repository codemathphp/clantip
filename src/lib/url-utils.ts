/**
 * Get the base URL for the application
 * Dynamically handles deployment environment
 */
export function getBaseUrl(): string {
  // If in browser, use window.location
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // If on server, use environment variable or default
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  // Fallback
  return 'http://localhost:3000'
}

/**
 * Get the full callback URL based on current host
 */
export function getCallbackUrl(): string {
  return `${getBaseUrl()}/payment/callback`
}
