# RAGJur MCP Server

Servidor MCP (Model Context Protocol) para busca jurisprudencial e jurimetria em **67M+ decisões** de 55 tribunais brasileiros.

## Compatibilidade

| Plataforma | Transporte | Status |
|------------|-----------|--------|
| Claude Desktop / Claude Code | stdio | Suportado |
| Claude (cloud) | Streamable HTTP | Suportado |
| GPT Actions (ChatGPT) | OpenAPI REST | Suportado |
| Microsoft Copilot | OpenAPI REST | Suportado |
| Google Vertex AI Extensions | OpenAPI REST | Suportado |
| Any MCP Client | Streamable HTTP | Suportado |

## Quick Start

### Local (Claude Desktop / Claude Code)

```bash
cd tools/ragjur-mcp
npm install
npm run build

# Testar
RAGJUR_API_KEY=rj_... npm test
```

Adicione ao `claude_desktop_config.json` (ajuste o caminho para a sua máquina —
exemplo com caminho relativo ao repositório):

```json
{
  "mcpServers": {
    "ragjur": {
      "command": "node",
      "args": ["/caminho/para/1.RagJUR/tools/ragjur-mcp/build/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "RAGJUR_API_KEY": "rj_..."
      }
    }
  }
}
```

> **Remote (Claude Code / clientes HTTP)**: use o `mcp.json` deste diretório —
> endpoint `https://ragjur-mcp-662926580906.southamerica-east1.run.app/mcp`
> com header `x-api-key`. O `/mcp` exige autenticação (x-api-key ou Bearer).

### Cloud Run (HTTP)

```bash
gcloud builds submit --config=cloudbuild.yaml --project=beanstech
```

### GPT Actions / Copilot

Use a spec em `/openapi.json`:
```
https://ragjur-mcp-662926580906.southamerica-east1.run.app/openapi.json
```

## Tools Disponíveis (14)

| Tool | Descrição |
|------|-----------|
| `buscar_jurisprudencia` | Busca BM25 em 67M+ julgados com filtros |
| `panorama_tema` | Visão panorâmica: taxa de provimento, categorias |
| `divergencia_turmas` | Divergência entre turmas sobre um tema |
| `evolucao_jurisprudencial` | Evolução temporal (trimestral) |
| `predicao_resultado` | Predição multi-fator do resultado |
| `perfil_relator` | Perfil estatístico de juiz/relator |
| `dna_turma` | Termos significativos de uma turma |
| `clusters_tematicos` | Agrupamento por embeddings |
| `estrategia_juiz` | Análise estratégica completa |
| `verificar_citacao` | Anti-alucinação: verifica citações |
| `gerar_peca` | Gera peças processuais |
| `similaridade` | Busca vetorial por similaridade |
| `chat_juridico` | Chat grounded em jurisprudência |
| `tempo_tramitacao` | Estatísticas de tempo processual |

## Endpoints

| Rota | Método | Descrição |
|------|--------|-----------|
| `/` | GET | Info do servidor |
| `/mcp` | POST/GET/DELETE | MCP Streamable HTTP |
| `/health` | GET | Health check completo |
| `/api/tools` | GET | Lista de tools |
| `/api/tools/:name` | POST | Executa tool (REST) |
| `/openapi.json` | GET | OpenAPI 3.1 spec |

## Health Check

```bash
curl https://ragjur-mcp-662926580906.southamerica-east1.run.app/health
```

Retorna:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "checks": {
    "api": true,
    "elasticsearch": true,
    "doc_count": 67110561,
    "api_latency_ms": 650
  },
  "tools": { "count": 14, "available": [...] }
}
```

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `RAGJUR_API_KEY` | Sim | API key do RAGJur |
| `TRANSPORT` | Não | `streamable-http` (default) ou `stdio` |
| `PORT` | Não | Porta HTTP (default: 8080) |
| `RAGJUR_API_URL` | Não | URL base da API (default: produção) |

---

## 🏪 Publicação em Marketplaces

| Canal | Status | Como |
|---|---|---|
| **MCP Registry** (registry.modelcontextprotocol.io) | Pronto — `server.json` incluído | `mcp-publisher login github && mcp-publisher publish` |
| **Claude Connectors Directory** | Pendente | Requer org Team/Enterprise na Anthropic + submissão em claude.ai/admin-settings/directory/submissions/new |
| **GPT Store** | Config pronto — `gpt-store-config.json` | platform.openai.com/gpts → import actions via `openapi.json` |
| **npm** | Pronto — `package.json` publicável | `npm publish` (requer token) |

**Auth:** header `x-api-key` com chave RAGJur (planos: ragjur.com.br/precos).
