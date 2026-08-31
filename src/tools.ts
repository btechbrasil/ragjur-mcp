import { z } from 'zod'
import { apiCall } from './api-client.js'

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const TOOLS = {
  buscar_jurisprudencia: {
    description: 'Busca decisões judiciais em 67M+ julgados de 55 tribunais brasileiros. Usa BM25 + filtros por tribunal, turma, relator, classe e data.',
    schema: z.object({
      query: z.string().min(3).describe('Termos de busca (ex: "dano moral consumidor banco")'),
      fonte: z.string().optional().describe('Código do tribunal (ex: stj_integras, tst_jurisprudencia, tjsp_cjsg)'),
      turma: z.string().optional().describe('Órgão julgador específico'),
      relator: z.string().optional().describe('Nome do relator/juiz'),
      classe: z.string().optional().describe('Classe processual (ex: REsp, AgInt, HC)'),
      dataInicio: z.string().optional().describe('Data início YYYY-MM-DD'),
      dataFim: z.string().optional().describe('Data fim YYYY-MM-DD'),
      pagina: z.number().min(1).max(200).optional().describe('Página (1-200, 50 resultados/página)'),
    }),
    handler: async (params: Record<string, unknown>) => {
      const p: Record<string, string> = { q: params.query as string }
      if (params.fonte) p.fonte = params.fonte as string
      if (params.turma) p.turma = params.turma as string
      if (params.relator) p.relator = params.relator as string
      if (params.classe) p.classe = params.classe as string
      if (params.dataInicio) p.dataInicio = params.dataInicio as string
      if (params.dataFim) p.dataFim = params.dataFim as string
      if (params.pagina) p.pagina = String(params.pagina)
      return apiCall('busca', { params: p })
    },
  },

  panorama_tema: {
    description: 'Visão panorâmica de um tema jurídico: taxa de provimento, categorias de resultado, tendência. Ideal para entender o cenário antes de ajuizar.',
    schema: z.object({
      busca: z.string().min(3).describe('Tema jurídico para analisar'),
      fonte: z.string().optional().describe('Tribunal (ex: stj_integras)'),
      turma: z.string().optional().describe('Turma/câmara específica'),
    }),
    handler: async (params: Record<string, unknown>) => {
      const p: Record<string, string> = { busca: params.busca as string }
      if (params.fonte) p.fonte = params.fonte as string
      if (params.turma) p.turma = params.turma as string
      return apiCall('panorama', { params: p })
    },
  },

  divergencia_turmas: {
    description: 'Detecta divergência de entendimento entre turmas/câmaras sobre um mesmo tema. Útil para fundamentar recursos baseados em divergência.',
    schema: z.object({
      busca: z.string().min(3).describe('Tema jurídico'),
      fonte: z.string().optional().describe('Tribunal'),
    }),
    handler: async (params: Record<string, unknown>) => {
      const p: Record<string, string> = { busca: params.busca as string }
      if (params.fonte) p.fonte = params.fonte as string
      return apiCall('divergencia', { params: p })
    },
  },

  evolucao_jurisprudencial: {
    description: 'Mostra como o entendimento sobre um tema evoluiu ao longo do tempo (trimestral). Identifica tendências crescentes, decrescentes ou estáveis.',
    schema: z.object({
      busca: z.string().min(3).describe('Tema jurídico'),
      fonte: z.string().optional().describe('Tribunal'),
      turma: z.string().optional().describe('Turma/câmara'),
    }),
    handler: async (params: Record<string, unknown>) => {
      const p: Record<string, string> = { busca: params.busca as string }
      if (params.fonte) p.fonte = params.fonte as string
      if (params.turma) p.turma = params.turma as string
      return apiCall('evolucao', { params: p })
    },
  },

  predicao_resultado: {
    description: 'Predição estatística multi-fator do resultado de um caso: combina taxa histórica, tendência temporal, perfil do tribunal e intervalo de confiança.',
    schema: z.object({
      busca: z.string().min(3).describe('Tema/tese jurídica'),
      fonte: z.string().optional().describe('Tribunal'),
      turma: z.string().optional().describe('Turma'),
      relator: z.string().optional().describe('Relator'),
    }),
    handler: async (params: Record<string, unknown>) => {
      const p: Record<string, string> = { busca: params.busca as string }
      if (params.fonte) p.fonte = params.fonte as string
      if (params.turma) p.turma = params.turma as string
      if (params.relator) p.relator = params.relator as string
      return apiCall('predicao', { params: p })
    },
  },

  perfil_relator: {
    description: 'Analisa o perfil de um relator/juiz: taxa de provimento, termos que mais usa, tendências recentes.',
    schema: z.object({
      busca: z.string().min(3).describe('Tema jurídico'),
      fonte: z.string().optional().describe('Tribunal'),
      turma: z.string().optional().describe('Turma'),
    }),
    handler: async (params: Record<string, unknown>) => {
      const p: Record<string, string> = { busca: params.busca as string }
      if (params.fonte) p.fonte = params.fonte as string
      if (params.turma) p.turma = params.turma as string
      return apiCall('relator', { params: p })
    },
  },

  dna_turma: {
    description: 'Extrai os termos estatisticamente significativos (DNA) que caracterizam as decisões de uma turma sobre um tema.',
    schema: z.object({
      busca: z.string().min(3).describe('Tema jurídico'),
      fonte: z.string().optional().describe('Tribunal'),
      turma: z.string().optional().describe('Turma'),
    }),
    handler: async (params: Record<string, unknown>) => {
      const p: Record<string, string> = { busca: params.busca as string }
      if (params.fonte) p.fonte = params.fonte as string
      if (params.turma) p.turma = params.turma as string
      return apiCall('dna', { params: p, timeout: 45000 })
    },
  },

  clusters_tematicos: {
    description: 'Agrupa decisões similares em clusters temáticos usando embeddings. Revela sub-temas e abordagens distintas dentro de um mesmo assunto.',
    schema: z.object({
      busca: z.string().min(3).describe('Tema jurídico'),
      fonte: z.string().optional().describe('Tribunal'),
      clusters: z.number().min(2).max(10).optional().describe('Número de clusters (2-10, padrão 5)'),
    }),
    handler: async (params: Record<string, unknown>) => {
      const p: Record<string, string> = { busca: params.busca as string }
      if (params.fonte) p.fonte = params.fonte as string
      if (params.clusters) p.clusters = String(params.clusters)
      return apiCall('clusters', { params: p, timeout: 110000 })
    },
  },

  estrategia_juiz: {
    description: 'Análise estratégica completa de um juiz/relator para um tema: perfil, tendência, argumentos que ressoam, índice de rigor, recomendações.',
    schema: z.object({
      relator: z.string().min(3).describe('Nome do relator/juiz'),
      tema: z.string().min(3).describe('Tema jurídico'),
      fonte: z.string().describe('Tribunal (obrigatório, ex: stj_integras)'),
      turma: z.string().optional().describe('Turma'),
    }),
    handler: async (params: Record<string, unknown>) => {
      return apiCall('estrategia-juiz', {
        method: 'POST',
        body: params,
        timeout: 110000,
      })
    },
  },

  verificar_citacao: {
    description: 'Verifica se citações jurisprudenciais em um texto são reais e corretas. Anti-alucinação para conteúdo gerado por IA.',
    schema: z.object({
      content: z.string().min(20).describe('Texto contendo citações jurídicas para verificar'),
      mode: z.enum(['rapido', 'deep']).optional().describe('Modo: rapido (local) ou deep (busca completa)'),
    }),
    handler: async (params: Record<string, unknown>) => {
      return apiCall('verificar-citacao', {
        method: 'POST',
        body: params,
        timeout: 110000,
      })
    },
  },

  gerar_peca: {
    description: 'Gera peça processual (petição inicial, contestação, recurso, parecer) com base em jurisprudência real.',
    schema: z.object({
      tipo: z.enum(['peticao_inicial', 'contestacao', 'recurso', 'parecer']).describe('Tipo da peça'),
      tema: z.string().min(3).describe('Tema/tese principal'),
      fonte: z.string().describe('Tribunal de referência'),
      fatos: z.string().min(10).describe('Resumo dos fatos do caso'),
      lado: z.enum(['autor', 'reu']).describe('Lado representado'),
    }),
    handler: async (params: Record<string, unknown>) => {
      return apiCall('gerar-peca', {
        method: 'POST',
        body: params,
        timeout: 120000,
      })
    },
  },

  similaridade: {
    description: 'Encontra decisões semanticamente similares a um texto usando embeddings vetoriais. Ideal para encontrar precedentes relevantes.',
    schema: z.object({
      texto: z.string().min(10).describe('Texto para buscar similares (ementa, tese, fato)'),
      fonte: z.string().optional().describe('Restringir a um tribunal'),
      limite: z.number().min(1).max(20).optional().describe('Número de resultados (1-20)'),
    }),
    handler: async (params: Record<string, unknown>) => {
      return apiCall('similaridade', {
        method: 'POST',
        body: params,
        timeout: 110000,
      })
    },
  },

  chat_juridico: {
    description: 'Chat com IA jurídica grounded em jurisprudência real. A IA busca decisões relevantes antes de responder.',
    schema: z.object({
      pergunta: z.string().min(5).describe('Pergunta jurídica'),
      fonte: z.string().describe('Tribunal de referência para grounding'),
    }),
    handler: async (params: Record<string, unknown>) => {
      return apiCall('chat', {
        method: 'POST',
        body: params,
        timeout: 110000,
      })
    },
  },

  tempo_tramitacao: {
    description: 'Estatísticas de tempo de tramitação para um tema: mediana, percentis, variação por turma e por ano.',
    schema: z.object({
      busca: z.string().min(3).describe('Tema jurídico'),
      fonte: z.string().optional().describe('Tribunal'),
      turma: z.string().optional().describe('Turma'),
    }),
    handler: async (params: Record<string, unknown>) => {
      const p: Record<string, string> = { busca: params.busca as string }
      if (params.fonte) p.fonte = params.fonte as string
      if (params.turma) p.turma = params.turma as string
      return apiCall('tempo-tramitacao', { params: p })
    },
  },
} as const

export type ToolName = keyof typeof TOOLS
