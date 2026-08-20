import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

import { api } from './client'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

it('initializes the same-origin CSRF cookie with credentials', async () => {
  let credentials: RequestCredentials | null = null
  let correlationId: string | null = null

  server.use(
    http.get('http://localhost/sanctum/csrf-cookie', ({ request }) => {
      credentials = request.credentials
      correlationId = request.headers.get('X-Correlation-Id')

      return new HttpResponse(null, { status: 204 })
    }),
  )

  await expect(api.initializeCsrf()).resolves.toBeUndefined()
  expect(credentials).toBe('include')
  expect(correlationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  )
})

it('returns a typed health payload', async () => {
  server.use(
    http.get('http://localhost/api/health', () => HttpResponse.json({ status: 'ok' })),
  )

  await expect(api.getHealth()).resolves.toEqual({ status: 'ok' })
})

it('sends a correlation ID with the health request', async () => {
  let correlationId: string | null = null

  server.use(
    http.get('http://localhost/api/health', ({ request }) => {
      correlationId = request.headers.get('X-Correlation-Id')

      return HttpResponse.json({ status: 'ok' })
    }),
  )

  await api.getHealth()

  expect(correlationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  )
})

it('normalizes a safe API error with its correlation ID', async () => {
  server.use(
    http.get('http://localhost/api/health', () =>
      HttpResponse.json(
        {
          code: 'service_unavailable',
          message: 'The service is temporarily unavailable.',
          correlation_id: '824d6d37-986f-4b31-849a-1c9276ee6fbf',
        },
        { status: 503 },
      ),
    ),
  )

  await expect(api.getHealth()).rejects.toMatchObject({
    code: 'service_unavailable',
    message: 'The service is temporarily unavailable.',
    correlationId: '824d6d37-986f-4b31-849a-1c9276ee6fbf',
    status: 503,
  })
})

it('preserves the status for an empty successful response', async () => {
  server.use(
    http.get('http://localhost/api/health', () => new HttpResponse(null, { status: 200 })),
  )

  await expect(api.getHealth()).rejects.toMatchObject({
    code: 'unexpected_response',
    status: 200,
  })
})
