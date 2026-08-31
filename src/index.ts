#!/usr/bin/env node
/**
 * RAGJur MCP Server v2.1.0
 *
 * Conserto definitivo (2026-08-15):
 *   - AUTENTICAÇÃO no /mcp (x-api-key ou Authorization: Bearer) — antes era
 *     aberto com Cloud Run --allow-unauthenticated = proxy público da API paga.
 *   - Rate limiting por key (token bucket janela fixa, MCP_RATE_LIMIT_PER_MIN).
 *   - Conformidade MCP Streamable HTTP: session id desconhecido → 404.
 *   - TTL de sessão (MCP_SESSION_TTL_MIN, default 30min) — fim do leak de memória.
 *   - CORS configurável (MCP_CORS_ORIGIN, default *) — browser clients
 *     (Copilot Studio, claude.ai).
 *   - /health desacoplado do upstream (container saudável ≠ API up).
 *   - Boot validation: RAGJUR_API_KEY ausente → fail-fast no stdio.
 *   - Body 5mb (documentos longos em verificar_citacao; antes 413 em >100kb).
 *   - OpenAPI/zodToJsonSchema via zod-to-json-schema (preserva min/max/defaults).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { TOOLS, type ToolName } from './tools.js'
import { healthCheck } from './api-client.js'

const PORT = Number(process.env.PORT) || 8080
const TRANSPORT = process.env.TRANSPORT || 'streamable-http'
const VERSION = '2.1.0'
const RATE_LIMIT_PER_MIN = Number(process.env.MCP_RATE_LIMIT_PER_MIN) || 60
const SESSION_TTL_MIN = Number(process.env.MCP_SESSION_TTL_MIN) || 30
const CORS_ORIGIN = process.env.MCP_CORS_ORIGIN || '*'
const PUBLIC_URL =
  process.env.RAGJUR_PUBLIC_URL || 'https://ragjur-mcp-662926580906.southamerica-east1.run.app'

function log(level: string, message: string, data?: unknown) {
  const entry = { ts: new Date().toISOString(), level, msg: message, ...(data ? { data } : {}) }
  console.error(JSON.stringify(entry))
}

function createServer(): McpServer {
  const server = new McpServer({
    name: 'ragjur',
    version: VERSION,
  })

  for (const [name, tool] of Object.entries(TOOLS)) {
    server.tool(
      name,
      tool.description,
      tool.schema.shape as Record<string, unknown>,
      async (params) => {
        const start = Date.now()
        try {
          const result = await tool.handler(params as Record<string, unknown>)
          log('info', `tool:${name}`, { took_ms: Date.now() - start })
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          log('error', `tool:${name} failed`, { error: msg, took_ms: Date.now() - start })
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
            isError: true,
          }
        }
      }
    )
  }

  return server
}

// ============================================================================
// Auth + Rate limiting
// ============================================================================

function extractApiKey(req: express.Request): string | null {
  const header = req.headers['x-api-key'] as string | undefined
  if (header) return header
  const auth = req.headers['authorization'] as string | undefined
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}

const validateApiKey: express.RequestHandler = (req, res, next) => {
  const expectedKey = process.env.RAGJUR_API_KEY
  if (!expectedKey) {
    log('error', 'auth: RAGJUR_API_KEY não configurada no servidor')
    res.status(500).json({ error: 'Server misconfigured: missing RAGJUR_API_KEY' })
    return
  }
  const provided = extractApiKey(req)
  if (!provided || provided !== expectedKey) {
    res.status(401).json({ error: 'Missing or invalid API key (x-api-key or Bearer)' })
    return
  }
  next()
}

// Janela fixa por minuto por key — suficiente para proteger a API upstream.
const rateBuckets = new Map<string, { count: number; windowStart: number }>()
const rateLimit: express.RequestHandler = (req, res, next) => {
  const key = extractApiKey(req) ?? req.ip ?? 'anon'
  const now = Date.now()
  let b = rateBuckets.get(key)
  if (!b || now - b.windowStart >= 60_000) {
    b = { count: 0, windowStart: now }
    rateBuckets.set(key, b)
  }
  b.count++
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_PER_MIN))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_PER_MIN - b.count)))
  if (b.count > RATE_LIMIT_PER_MIN) {
    res.setHeader('Retry-After', '60')
    res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' })
    return
  }
  next()
}

// ============================================================================
// HTTP Transport (Cloud Run, Claude, GPT Actions, Copilot)
// ============================================================================

interface SessionEntry {
  transport: StreamableHTTPServerTransport
  lastActivity: number
}

async function startHTTP() {
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  // CORS — browser clients (Copilot Studio web tester, claude.ai connectors)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, x-api-key, Authorization, mcp-session-id, mcp-protocol-version, Last-Event-ID',
    )
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  const sessions = new Map<string, SessionEntry>()

  // Sweeper de sessões ociosas (TTL) — evita leak de memória em instâncias longas
  const sweeper = setInterval(() => {
    const now = Date.now()
    for (const [id, entry] of sessions) {
      if (now - entry.lastActivity > SESSION_TTL_MIN * 60_000) {
        log('info', 'session:expired', { id, idle_min: Math.round((now - entry.lastActivity) / 60000) })
        entry.transport.close().catch(() => {})
        sessions.delete(id)
      }
    }
  }, 5 * 60_000)
  sweeper.unref()

  const touch = (id: string) => {
    const e = sessions.get(id)
    if (e) e.lastActivity = Date.now()
  }

  // MCP Streamable HTTP endpoint — autenticado
  app.post('/mcp', validateApiKey, rateLimit, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    // Spec: session id desconhecido → 404 (não criar sessão nova silenciosamente)
    if (sessionId && !sessions.has(sessionId)) {
      res.status(404).json({ error: 'Session not found. Initialize a new session first.' })
      return
    }

    let transport: StreamableHTTPServerTransport
    if (sessionId) {
      transport = sessions.get(sessionId)!.transport
      touch(sessionId)
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, lastActivity: Date.now() })
          log('info', 'session:created', { id })
        },
      })
      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId)
          log('info', 'session:closed', { id: transport.sessionId })
        }
      }
      const server = createServer()
      await server.connect(transport)
    }

    await transport.handleRequest(req, res, req.body)
  })

  app.get('/mcp', validateApiKey, rateLimit, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    const entry = sessions.get(sessionId)
    if (!entry) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    touch(sessionId)
    await entry.transport.handleRequest(req, res)
  })

  app.delete('/mcp', validateApiKey, rateLimit, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    const entry = sessions.get(sessionId)
    if (!entry) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    await entry.transport.handleRequest(req, res)
  })

  // ========================================================================
  // REST API — OpenAI-compatible for GPT Actions / Copilot
  // ========================================================================

  app.get('/', (_req, res) => {
    res.json({
      service: 'ragjur-mcp',
      version: VERSION,
      status: 'healthy',
      auth: 'required (x-api-key or Bearer) on /mcp and /api/tools',
      tools_count: Object.keys(TOOLS).length,
      decisions: '67M+',
      transports: ['streamable-http', 'openai-actions'],
      endpoints: {
        mcp: '/mcp',
        health: '/health',
        openapi: '/openapi.json',
        tools: '/api/tools',
      },
    })
  })

  // Container health — NÃO depende do upstream (antes um blip da API marcava
  // o container unhealthy no Cloud Run). Status da API vira campo informativo.
  app.get('/health', async (_req, res) => {
    const h = await healthCheck()
    const toolNames = Object.keys(TOOLS)
    res.status(200).json({
      status: 'healthy',
      version: VERSION,
      timestamp: new Date().toISOString(),
      checks: {
        api: h.api,
        elasticsearch: h.elastic,
        doc_count: h.docCount,
        api_latency_ms: h.latencyMs,
      },
      tools: {
        count: toolNames.length,
        available: toolNames,
      },
      sessions: { active: sessions.size, ttl_min: SESSION_TTL_MIN },
      rate_limit_per_min: RATE_LIMIT_PER_MIN,
    })
  })

  // OpenAI Actions / GPT — direct tool execution via REST
  app.get('/api/tools', validateApiKey, rateLimit, (_req, res) => {
    const tools = Object.entries(TOOLS).map(([name, t]) => ({
      name,
      description: t.description,
      parameters: zodToJsonSchema(t.schema, { target: 'openApi3' }),
    }))
    res.json({ tools })
  })

  app.post('/api/tools/:name', validateApiKey, rateLimit, async (req, res) => {
    const name = req.params.name as ToolName
    const tool = TOOLS[name]
    if (!tool) {
      res.status(404).json({ error: `Tool "${name}" not found` })
      return
    }

    const parsed = tool.schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid parameters', details: parsed.error.issues })
      return
    }

    try {
      const result = await tool.handler(parsed.data as Record<string, unknown>)
      res.json(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const status = typeof (err as { status?: number }).status === 'number'
        ? (err as { status: number }).status
        : 502
      // 401/403/429 do upstream passam adiante; resto vira 502 (bad gateway)
      res.status([401, 403, 429].includes(status) ? status : 502).json({ error: msg })
    }
  })

  // OpenAPI spec for GPT Actions / Copilot Marketplace
  app.get('/openapi.json', (_req, res) => {
    res.json(generateOpenApiSpec())
  })

  // 404 JSON + error middleware
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log('error', 'unhandled', { error: err instanceof Error ? err.message : String(err) })
    if (res.headersSent) return
    res.status(500).json({ error: 'Internal server error' })
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('info', 'SIGTERM')
    sweeper.close()
    process.exit(0)
  })

  if (!process.env.RAGJUR_API_KEY) {
    log('error', 'RAGJUR_API_KEY não configurada — toda chamada de tool vai falhar com 401 upstream')
  }

  app.listen(PORT, '0.0.0.0', () => {
    log('info', `RAGJur MCP Server v${VERSION} on :${PORT} [${TRANSPORT}]`, {
      rate_limit_per_min: RATE_LIMIT_PER_MIN,
      session_ttl_min: SESSION_TTL_MIN,
      cors: CORS_ORIGIN,
    })
  })
}

// ============================================================================
// STDIO Transport (Claude Desktop / Claude Code local)
// ============================================================================

async function startStdio() {
  if (!process.env.RAGJUR_API_KEY) {
    log('error', 'RAGJUR_API_KEY não configurada. Exporte RAGJUR_API_KEY=rj_... antes de iniciar.')
    process.exit(1)
  }
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  log('info', 'RAGJur MCP Server (stdio) ready')
}

// ============================================================================
// OpenAPI Spec Generator (for GPT Actions / Copilot)
// ============================================================================

function generateOpenApiSpec() {
  const paths: Record<string, unknown> = {}

  for (const [name, tool] of Object.entries(TOOLS)) {
    paths[`/api/tools/${name}`] = {
      post: {
        operationId: name,
        summary: tool.description,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: zodToJsonSchema(tool.schema, { target: 'openApi3' }) } },
        },
        responses: {
          '200': { description: 'Tool result', content: { 'application/json': { schema: { type: 'object' } } } },
          '400': { description: 'Invalid parameters', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' }, details: { type: 'array' } } } } } },
          '401': { description: 'Missing or invalid API key', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } } },
          '502': { description: 'Upstream API error', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } } },
        },
      },
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'RAGJur — Jurimetria e Busca Jurisprudencial',
      version: VERSION,
      description: 'API de jurimetria e busca em 67M+ decisões judiciais brasileiras. Suporta busca BM25, embeddings vetoriais, predição de resultado, análise de juiz, e geração de peças.',
    },
    servers: [
      { url: PUBLIC_URL, description: 'Production' },
      { url: 'http://localhost:8080', description: 'Local development' },
    ],
    security: [{ ApiKeyAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key for RAGJur. Obtain at ragjur.com.br',
        },
      },
    },
  }
}

// ============================================================================
// MAIN
// ============================================================================

if (TRANSPORT === 'stdio') {
  startStdio()
} else {
  startHTTP()
}
