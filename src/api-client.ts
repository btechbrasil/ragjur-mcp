/**
 * Cliente da API RAGJur usado pelo MCP.
 *
 * Conserto 2026-08-15:
 *   - Timeout cap em 110s (< Cloud Run 120s) — fim da corrida de timeouts
 *     no gerar_peca (antes: client 120s == Cloud Run 120s == API 120s).
 *   - Erro preserva o status HTTP do upstream (ApiError.status) — o REST
 *     bridge propaga 401/403/429 em vez de 502 genérico.
 *   - Mensagem de erro truncada p/ 1000 chars (antes 200).
 *   - 1 retry com backoff em 429/5xx (500ms).
 */
const API_BASE = process.env.RAGJUR_API_URL || 'https://ragjur-api-662926580906.southamerica-east1.run.app/api/v1'
const API_KEY = process.env.RAGJUR_API_KEY || ''
const MAX_TIMEOUT_MS = 110_000

interface RequestOptions {
  method?: 'GET' | 'POST'
  params?: Record<string, string>
  body?: Record<string, unknown>
  timeout?: number
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function callOnce<T>(endpoint: string, opts: RequestOptions, timeoutMs: number): Promise<T> {
  const { method = 'GET', params, body } = opts

  let url = `${API_BASE}/${endpoint}`
  if (params) {
    const sp = new URLSearchParams(params)
    url += `?${sp.toString()}`
  }

  const headers: Record<string, string> = { 'x-api-key': API_KEY }
  const fetchOpts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
    fetchOpts.body = JSON.stringify(body)
  }

  const res = await fetch(url, fetchOpts)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, `API ${res.status}: ${text.slice(0, 1000)}`)
  }

  return res.json() as Promise<T>
}

export async function apiCall<T = Record<string, unknown>>(
  endpoint: string,
  opts: RequestOptions = {}
): Promise<T> {
  const timeoutMs = Math.min(opts.timeout ?? 30_000, MAX_TIMEOUT_MS)

  try {
    return await callOnce<T>(endpoint, opts, timeoutMs)
  } catch (err) {
    const retryable = err instanceof ApiError && (err.status === 429 || err.status >= 500)
    if (!retryable) throw err
    await new Promise((r) => setTimeout(r, 500))
    return callOnce<T>(endpoint, opts, timeoutMs)
  }
}

export async function healthCheck(): Promise<{
  api: boolean
  elastic: boolean
  docCount: number
  latencyMs: number
  reason?: string
}> {
  try {
    const start = Date.now()
    const data = await apiCall<{
      status: string
      elastic: { status: string; doc_count: number; latency_ms: number }
    }>('health', { timeout: 10000 })
    return {
      api: data.status === 'ok',
      elastic: data.elastic.status === 'ok',
      docCount: data.elastic.doc_count,
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      api: false,
      elastic: false,
      docCount: 0,
      latencyMs: -1,
      reason: err instanceof Error ? err.message.slice(0, 200) : String(err),
    }
  }
}
