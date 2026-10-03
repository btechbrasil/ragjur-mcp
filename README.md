# RAGJur — Claude Plugin

**Brazilian legal RAG for Claude — search 112M+ court decisions from 90+ Brazilian tribunals.**

This repository contains the **Claude plugin manifest** for RAGJur. The plugin connects Claude to the RAGJur MCP server (remote, streamable HTTP) at `https://mcp.ragjur.ai/mcp`.

## Install

In Claude Code:

```
/plugin marketplace add btechbrasil/ragjur-mcp
/plugin install ragjur@btechbrasil
```

During installation, Claude asks for your **RAGJur API Key** (stored as a sensitive user config — it is never read from your machine without asking). API keys are included with RAGJur subscriptions: [ragjur.ai](https://ragjur.ai).

## What you get — 14 tools

| Tool | What it does |
|---|---|
| `buscar_jurisprudencia` | Full-text search over 112M+ decisions (BM25, filters by tribunal/class/date) |
| `similaridade` | Semantic search — decisions similar to a case or ementa (embeddings) |
| `panorama_tema` | Topic overview: outcome rate, result categories, trend |
| `divergencia_turmas` | Divergence between panels/chambers on a topic |
| `evolucao_jurisprudencial` | How a thesis evolved over time (quarterly) |
| `predicao_resultado` | Statistical outcome prediction with confidence interval |
| `tempo_tramitacao` | Litigation-time statistics (median, percentiles) |
| `perfil_relator` | Judge/rapporteur profile on a topic |
| `dna_turma` | Statistically characteristic terms of a panel |
| `clusters_tematicos` | Cluster a topic into sub-issues |
| `estrategia_juiz` | Full strategic analysis of a judge for a topic |
| `verificar_citacao` | Anti-hallucination citation verification |
| `chat_juridico` | Q&A grounded on retrieved decisions |
| `gerar_peca` | Draft a procedural document grounded on real precedents |

### Coverage

STF, STJ, TST, TSE, TCU, all TRFs (1–6), all state courts (TJs), labor courts (TRTs), electoral courts, state audit courts (TCEs) and administrative tax appeal tribunals (CARF/DRJs/TARFs) — 112 million+ decisions and growing daily.

### Example prompts

- "Busque os acórdãos mais recentes do STJ sobre busca e apreensão em alienação fiduciária"
- "Qual a taxa de provimento de recursos sobre dano moral no TJSP? Há divergência entre as câmaras?"
- "Verifique se as citações desta peça existem"
- "Redija uma contestação sobre despejo por falta de pagamento, lado réu, TJMG"

## How it works

The plugin registers one remote MCP server (HTTP transport). Your queries are sent to `mcp.ragjur.ai`, which searches the Elasticsearch corpus and returns grounded results. The server is **stateless** — no conversation or query data is persisted after the session ends.

## Privacy & data

- Stateless MCP server (30-minute session TTL, nothing stored)
- Data processed in Brazil (Alibaba Cloud São Paulo region)
- LGPD-compliant: [ragjur.ai/lgpd](https://ragjur.ai/lgpd)
- Privacy policy: [ragjur.ai/privacidade](https://ragjur.ai/privacidade)

## Support

- Site: [ragjur.ai](https://ragjur.ai)
- API docs: [api.ragjur.ai](https://api.ragjur.ai/api/v1/openapi.json)
- Contact: contato@ragjur.com.br

## License

MIT (this repository — plugin manifest and documentation). The RAGJur service is a commercial product of Beans Tech.
