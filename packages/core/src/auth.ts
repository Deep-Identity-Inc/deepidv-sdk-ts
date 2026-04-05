/**
 * Auth helper utilities for building request headers and URLs.
 *
 * Pure functions with no side effects — safe for use across all runtimes.
 *
 * @module auth
 */

/**
 * Builds HTTP request headers for a deepidv API request.
 *
 * Always includes `x-api-key` and `Accept: application/json`.
 * Adds `Content-Type: application/json` only when a request body is present (D-15).
 *
 * @param apiKey - The API key to inject.
 * @param body - Optional request body. When provided, Content-Type is set.
 * @returns Plain object of HTTP headers.
 */
export function buildHeaders(
  apiKey: string,
  body?: unknown,
): Record<string, string> {
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

/**
 * Constructs a full URL by joining a base URL and a path segment.
 *
 * Normalizes trailing slashes on the base and leading slashes on the path
 * so callers don't need to be careful about slash presence (D-15).
 *
 * @param base - Base URL (e.g. `https://api.deepidv.com` or `https://api.deepidv.com/`).
 * @param path - API path (e.g. `/v1/sessions` or `v1/sessions`).
 * @returns Fully-qualified URL string with no double-slashes.
 *
 * @example
 * buildUrl('https://api.deepidv.com/', '/v1/sessions')
 * // => 'https://api.deepidv.com/v1/sessions'
 *
 * buildUrl('https://api.deepidv.com', 'v1/sessions')
 * // => 'https://api.deepidv.com/v1/sessions'
 */
export function buildUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
