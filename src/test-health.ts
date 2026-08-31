import { TOOLS } from './tools.js'
import { healthCheck, apiCall } from './api-client.js'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

function ok(msg: string) { console.log(`${GREEN}  ✓${RESET} ${msg}`) }
function fail(msg: string) { console.log(`${RED}  ✗${RESET} ${msg}`) }
function warn(msg: string) { console.log(`${YELLOW}  ⚠${RESET} ${msg}`) }

async function testTool(name: string, params: Record<string, unknown>): Promise<boolean> {
  const tool = (TOOLS as Record<string, any>)[name]
  if (!tool) { fail(`${name}: tool not found`); return false }

  const parsed = tool.schema.safeParse(params)
  if (!parsed.success) {
    fail(`${name}: schema validation failed — ${parsed.error.issues[0]?.message}`)
    return false
  }

  const start = Date.now()
  try {
    const result = await tool.handler(parsed.data)
    const took = Date.now() - start
    if ((result as any).error) {
      fail(`${name}: ${(result as any).error} (${took}ms)`)
      return false
    }
    ok(`${name} (${took}ms)`)
    return true
  } catch (err: any) {
    const took = Date.now() - start
    fail(`${name}: ${err.message} (${took}ms)`)
    return false
  }
}

async function main() {
  console.log('\n🏥 RAGJur MCP — Health Check\n')
  console.log('─'.repeat(50))

  // 1. API Health
  console.log('\n📡 API Connection:')
  const h = await healthCheck()
  if (h.api) ok(`API healthy (${h.latencyMs}ms)`)
  else { fail('API unreachable'); process.exit(1) }
  if (h.elastic) ok(`Elasticsearch: ${h.docCount.toLocaleString()} docs`)
  else fail('Elasticsearch down')

  // 2. Tool Registration
  console.log('\n🔧 Tools Registered:')
  const toolCount = Object.keys(TOOLS).length
  ok(`${toolCount} tools defined`)

  // 3. Functional Tests
  console.log('\n🧪 Functional Tests:')
  let passed = 0, failed = 0

  const tests: [string, Record<string, unknown>][] = [
    ['buscar_jurisprudencia', { query: 'dano moral consumidor' }],
    ['panorama_tema', { busca: 'dano moral consumidor', fonte: 'stj_integras' }],
    ['divergencia_turmas', { busca: 'dano moral consumidor', fonte: 'stj_integras' }],
    ['evolucao_jurisprudencial', { busca: 'dano moral consumidor', fonte: 'stj_integras' }],
    ['predicao_resultado', { busca: 'dano moral consumidor', fonte: 'stj_integras' }],
    ['perfil_relator', { busca: 'dano moral consumidor', fonte: 'stj_integras' }],
    ['dna_turma', { busca: 'dano moral consumidor', fonte: 'stj_integras' }],
    ['tempo_tramitacao', { busca: 'dano moral consumidor', fonte: 'stj_integras' }],
    ['similaridade', { texto: 'Consumidor negativado indevidamente no SPC' }],
  ]

  for (const [name, params] of tests) {
    const success = await testTool(name, params)
    if (success) passed++
    else failed++
  }

  // Expensive tests — skip in CI
  if (process.env.FULL_TEST) {
    const expensiveTests: [string, Record<string, unknown>][] = [
      ['clusters_tematicos', { busca: 'dano moral consumidor', fonte: 'stj_integras' }],
      ['estrategia_juiz', { relator: 'Nancy Andrighi', tema: 'dano moral consumidor', fonte: 'stj_integras' }],
      ['verificar_citacao', { content: 'Conforme decidido pelo STJ no REsp 1737412/SP, relatora Ministra Nancy Andrighi, o entendimento é de responsabilidade objetiva.' }],
      ['chat_juridico', { pergunta: 'O que é dano moral?', fonte: 'stj_integras' }],
    ]

    console.log('\n🧪 Extended Tests (AI-powered):')
    for (const [name, params] of expensiveTests) {
      const success = await testTool(name, params)
      if (success) passed++
      else failed++
    }
  } else {
    warn(`Skipping AI-powered tests (set FULL_TEST=1 to run)`)
  }

  // Summary
  console.log('\n' + '─'.repeat(50))
  const total = passed + failed
  const pct = Math.round((passed / total) * 100)
  const color = failed === 0 ? GREEN : failed <= 2 ? YELLOW : RED
  console.log(`${color}Results: ${passed}/${total} passed (${pct}%)${RESET}`)

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
