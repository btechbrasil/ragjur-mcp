# Marketplace Submission Guide

## 1. Microsoft Copilot (Declarative Agent / Plugin)

### Requisitos
- OpenAPI 3.0/3.1 spec (já gerada em `/openapi.json`)
- Manifest file (`ai-plugin.json`)
- Autenticação via API key no header

### ai-plugin.json

```json
{
  "schema_version": "v1",
  "name_for_human": "RAGJur - Jurimetria Brasileira",
  "name_for_model": "ragjur",
  "description_for_human": "Busca jurisprudencial e jurimetria preditiva em 67M+ decisões de 55 tribunais brasileiros.",
  "description_for_model": "Search and analyze 67 million Brazilian court decisions. Use this tool for: legal research, predicting case outcomes, analyzing judge behavior, finding similar precedents, detecting jurisprudential trends, generating legal documents grounded in real case law, and verifying legal citations for accuracy.",
  "auth": {
    "type": "service_http",
    "authorization_type": "custom",
    "custom_auth_header": "x-api-key",
    "verification_tokens": {}
  },
  "api": {
    "type": "openapi",
    "url": "https://ragjur-mcp-662926580906.southamerica-east1.run.app/openapi.json"
  },
  "logo_url": "https://ragjur.com.br/logo-512.png",
  "contact_email": "suporte@ragjur.com.br",
  "legal_info_url": "https://ragjur.com.br/termos"
}
```

### Submissão
1. Acesse https://dev.teams.microsoft.com/
2. Crie um novo "Declarative Agent"
3. Faça upload do `ai-plugin.json`
4. A spec OpenAPI será importada automaticamente
5. Teste no Copilot Studio
6. Submeta para review

### Categorias recomendadas
- **Primary:** Productivity > Legal
- **Secondary:** Data & Analytics

---

## 2. GPT Store (OpenAI)

### Custom GPT com Actions

#### Instructions (System Prompt)

```
Você é o RAGJur, assistente jurídico especializado em direito brasileiro com acesso a 67 milhões de decisões judiciais.

REGRAS:
1. Sempre use as actions para buscar jurisprudência ANTES de responder sobre direito
2. Cite decisões reais com número do processo, relator e data
3. Use verificar_citacao antes de afirmar que uma decisão existe
4. Para perguntas sobre chances de sucesso, use predicao_resultado
5. Para estratégia processual, use estrategia_juiz com o nome do relator
6. Nunca invente jurisprudência — se não encontrou, diga que não encontrou

FLUXO IDEAL:
- Pergunta genérica → buscar_jurisprudencia + panorama_tema
- "Quais as chances?" → predicao_resultado
- "Como é esse juiz?" → perfil_relator + estrategia_juiz
- "Houve mudança?" → evolucao_jurisprudencial + divergencia_turmas
- "Gere uma peça" → gerar_peca (com fatos do usuário)
```

#### Configuração de Actions
1. Vá em "Configure" > "Actions" > "Create new action"
2. Import from URL: `https://ragjur-mcp-662926580906.southamerica-east1.run.app/openapi.json`
3. Authentication: API Key, Header `x-api-key`
4. Teste cada action antes de publicar

#### Metadata para GPT Store
- **Name:** RAGJur — Jurimetria com IA
- **Description:** Busca e análise de 67M+ decisões judiciais brasileiras. Jurimetria preditiva, perfil de juiz, divergência entre turmas, e geração de peças processuais fundamentadas.
- **Category:** Research & Analysis
- **Capabilities:** Web Browsing OFF, DALL-E OFF, Code Interpreter OFF

---

## 3. Claude (Anthropic MCP)

### Claude Desktop / Claude Code

Já documentado no README principal. Usa transporte `stdio`.

### Claude.ai (MCP Remoto)

Quando disponível, configurar com:
```json
{
  "mcpServers": {
    "ragjur": {
      "url": "https://ragjur-mcp-662926580906.southamerica-east1.run.app/mcp",
      "transport": "streamable-http"
    }
  }
}
```

---

## 4. Google Vertex AI (Extensions)

### Extension Manifest

```yaml
apiSpec:
  openApiGcsUri: gs://beanstech-configs/ragjur-openapi.json
displayName: RAGJur - Jurimetria Brasileira
description: Busca e análise preditiva em 67M+ decisões judiciais brasileiras.
toolUseExamples:
  - extensionOperation:
      operationId: buscar_jurisprudencia
    displayName: Buscar Jurisprudência
    query: "Quais decisões do STJ sobre dano moral em relações de consumo?"
    requestParams:
      query: "dano moral consumidor"
      fonte: "stj_integras"
    responseParams:
      total: 9763
      resultados: [...]
  - extensionOperation:
      operationId: predicao_resultado
    displayName: Predição de Resultado
    query: "Qual a chance de sucesso em ação de dano moral contra banco?"
    requestParams:
      busca: "dano moral banco negativação"
      fonte: "stj_integras"
```

### Deploy no Vertex
```bash
# Upload spec para GCS
gsutil cp openapi.json gs://beanstech-configs/ragjur-openapi.json

# Criar extension via gcloud
gcloud ai extensions create ragjur-jurimetria \
  --display-name="RAGJur" \
  --description="Jurimetria e busca em 67M+ decisões" \
  --manifest-file=vertex-extension.yaml \
  --region=us-central1
```

---

## 5. Checklist de Submissão

### Pré-requisitos (todos os marketplaces)

- [ ] OpenAPI spec válida e acessível publicamente
- [ ] Health check respondendo 200
- [ ] Rate limiting configurado (prevenir abuso)
- [ ] Política de privacidade publicada (ragjur.com.br/privacidade)
- [ ] Termos de uso publicados (ragjur.com.br/termos)
- [ ] Logo em alta resolução (512x512 PNG)
- [ ] Email de suporte configurado
- [ ] Testes funcionais passando (npm test)

### Microsoft Copilot específico
- [ ] Manifest `ai-plugin.json` válido
- [ ] Testes no Copilot Studio
- [ ] Compliance com Microsoft Store policies

### GPT Store específico
- [ ] Actions importadas e testadas
- [ ] System prompt otimizado
- [ ] Conversation starters definidos
- [ ] Sem violação de OpenAI usage policies

### Vertex AI específico
- [ ] Spec no GCS
- [ ] Tool use examples com request/response reais
- [ ] IAM configurado para o service account do Vertex
