import createClient from 'openapi-fetch'

import type { components, paths } from './generated'

type ApiErrorPayload = components['schemas']['ApiError']

export class ApiError extends Error {
  readonly code: string
  readonly correlationId: string
  readonly status: number
  readonly fieldErrors?: Record<string, string[]>

  constructor(
    code: string,
    message: string,
    correlationId: string,
    status: number,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.correlationId = correlationId
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const origin = globalThis.location?.origin ?? 'http://localhost'
const fetchCurrent = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args)

const client = createClient<paths>({
  baseUrl: new URL('/api/', origin).toString(),
  credentials: 'include',
  fetch: fetchCurrent,
})

client.use({
  onRequest({ request }) {
    request.headers.set('X-Correlation-Id', crypto.randomUUID())

    return request
  },
})

function normalizeApiError(
  payload: ApiErrorPayload | undefined,
  status: number,
): ApiError {
  return new ApiError(
    payload?.code ?? 'unexpected_response',
    payload?.message ?? 'The service returned an unexpected response.',
    payload?.correlation_id ?? crypto.randomUUID(),
    status,
    payload?.field_errors,
  )
}

async function initializeCsrf(): Promise<void> {
  const response = await fetchCurrent(new URL('/sanctum/csrf-cookie', origin), {
    credentials: 'include',
    headers: {
      'X-Correlation-Id': crypto.randomUUID(),
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  if (!response.ok) {
    throw normalizeApiError(undefined, response.status)
  }
}

export const api = {
  initializeCsrf,
  async getHealth(): Promise<components['schemas']['Health']> {
    const { data, error, response } = await client.GET('/health')
    const responseStatus = response.status

    if (error !== undefined) {
      throw normalizeApiError(error, responseStatus)
    }

    if (data === undefined) {
      throw normalizeApiError(undefined, responseStatus)
    }

    return data
  },
}
