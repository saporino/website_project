# BRIEFING — SAPORINO STUDIO
## Para colar no Claude Code

---

## CONTEXTO DO PROJETO

Você está trabalhando no repositório `saporino/website_project`.
É um painel administrativo React + Vite + TypeScript + Tailwind + Supabase + Vercel.
Já existe uma aba chamada **"Inteligência"** dentro da seção RepCo.
Essa aba será renomeada para **"Studio"** e receberá o sistema completo descrito abaixo.

---

## OBJETIVO

Construir o **Saporino Studio** — um painel de inteligência de marketing integrado ao admin existente.

O usuário arrasta ou faz upload de qualquer vídeo.
O sistema analisa automaticamente usando IA.
Entrega relatório completo, prompts prontos e permite lançar campanhas.

---

## PASSO 1 — RENOMEAR A ABA

Renomeia a aba "Inteligência" dentro do RepCo para **"Studio"**.
Mantém a mesma rota e estrutura, só muda o label e o ícone.
Ícone sugerido: `Clapperboard` ou `Sparkles` do lucide-react.

---

## PASSO 2 — ESTRUTURA DO BANCO (Supabase)

Cria as seguintes tabelas no Supabase:

```sql
-- Vídeos enviados para análise
CREATE TABLE studio_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES auth.users(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  -- pending | processing | completed | error
  duration REAL,
  language TEXT,
  brand_detected TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_text TEXT
);

-- Transcrições
CREATE TABLE studio_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES studio_videos(id) ON DELETE CASCADE,
  full_text TEXT,
  segments JSONB,
  srt_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Análises geradas pela IA
CREATE TABLE studio_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES studio_videos(id) ON DELETE CASCADE,
  resumo TEXT,
  objetivo TEXT,
  publico_alvo TEXT,
  gancho TEXT,
  estrategia TEXT,
  gatilhos JSONB,
  pontos_fortes JSONB,
  pontos_fracos JSONB,
  como_reproduzir TEXT,
  como_melhorar TEXT,
  como_vender TEXT,
  workflow TEXT,
  nivel_dificuldade TEXT,
  analise_visual JSONB,
  prompts JSONB,
  legendas JSONB,
  hashtags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campanhas geradas a partir da análise
CREATE TABLE studio_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES studio_videos(id),
  company_id UUID REFERENCES companies(id),
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  -- instagram | tiktok | facebook | youtube | ecommerce
  content TEXT,
  prompt_used TEXT,
  status TEXT DEFAULT 'draft',
  -- draft | scheduled | published
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Adiciona RLS em todas as tabelas filtrando por `company_id`.

---

## PASSO 3 — STORAGE SUPABASE

Cria um bucket chamado `studio-videos` no Supabase Storage.
Política: autenticado pode fazer upload, leitura apenas do próprio company_id.

---

## PASSO 4 — EDGE FUNCTION (processamento)

Cria uma Supabase Edge Function chamada `process-studio-video`.

Ela recebe o `video_id` e executa:

```
1. Busca o vídeo no Storage
2. Extrai áudio via FFmpeg (se disponível) ou usa o arquivo direto
3. Transcreve via OpenAI Whisper API
4. Envia transcrição + metadados para Claude API
5. Salva resultado nas tabelas studio_transcriptions e studio_analyses
6. Atualiza studio_videos.status = 'completed'
```

Claude API prompt de análise — use este sistema prompt:

```
Você é um especialista em marketing digital e engenharia reversa de conteúdo.
Analise o vídeo e retorne JSON puro (sem markdown) com esta estrutura exata:
{
  "resumo": "",
  "objetivo": "",
  "publico_alvo": "",
  "gancho": "",
  "estrutura_narrativa": "",
  "estrategia": "",
  "copywriting": "",
  "gatilhos_psicologicos": [],
  "pontos_fortes": [],
  "pontos_fracos": [],
  "como_reproduzir": "",
  "como_melhorar": "",
  "como_vender": "",
  "workflow": "",
  "nivel_dificuldade": "",
  "tempo_estimado": "",
  "marca_identificada": "",
  "prompt_claude": "",
  "prompt_gpt": "",
  "prompt_veo": "",
  "prompt_runway": "",
  "prompt_midjourney": "",
  "prompt_capcut": "",
  "legenda_instagram": "",
  "legenda_tiktok": "",
  "titulo_youtube": "",
  "hashtags": []
}
```

---

## PASSO 5 — INTERFACE REACT

### Rota
`/admin/repco/studio` (ou a rota que já existe para Inteligência)

### Layout da página Studio

```
┌─────────────────────────────────────────────┐
│  🎬 Saporino Studio                         │
│  Engenharia reversa de vídeos com IA        │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  📁 Arraste um vídeo aqui           │   │
│  │     ou clique para selecionar       │   │
│  │  Formatos: MP4, MOV, AVI, MKV       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Tabs: Todos | Processando | Concluídos]  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 🎬 video_pilao.mp4    ✅ Concluído   │  │
│  │ Marca: Pilão | 39s | há 2 horas     │  │
│  │ [Ver Análise] [Criar Campanha]      │  │
│  ├──────────────────────────────────────┤  │
│  │ 🎬 video_melitta.mp4  ⚙️ Processando│  │
│  │ ████████░░░░░  65%                  │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Modal de Análise (ao clicar em "Ver Análise")

Tabs dentro do modal:
- **Resumo** — resumo executivo, objetivo, público, gancho
- **Estratégia** — copy, gatilhos, pontos fortes/fracos
- **Como Reproduzir** — workflow, nível, como melhorar
- **Prompts** — Claude, GPT, Veo, Runway, Midjourney, CapCut (cada um com botão Copiar)
- **Publicar** — legendas prontas Instagram/TikTok com botão "Criar Campanha"

### Componentes necessários

```
src/
  pages/admin/repco/
    StudioPage.tsx          ← página principal
  components/studio/
    VideoDropzone.tsx        ← upload drag & drop
    VideoCard.tsx            ← card de cada vídeo
    AnalysisModal.tsx        ← modal com análise completa
    PromptCard.tsx           ← card com prompt + botão copiar
    CampaignCreator.tsx      ← criar campanha a partir da análise
    ProcessingIndicator.tsx  ← barra de progresso em tempo real
```

---

## PASSO 6 — FLUXO COMPLETO

```
1. Admin faz upload do vídeo
2. Vídeo salvo no Supabase Storage
3. Registro criado em studio_videos (status: pending)
4. Edge Function chamada automaticamente via trigger ou webhook
5. Status atualizado em tempo real via Supabase Realtime
6. Frontend mostra progresso via subscription
7. Quando concluído, análise disponível no modal
8. Admin pode criar campanha com os prompts gerados
```

---

## PASSO 7 — VARIÁVEIS DE AMBIENTE

Adiciona ao `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...   # para Whisper
```

E nas Supabase Edge Functions secrets:
```
ANTHROPIC_API_KEY
OPENAI_API_KEY
```

---

## REGRAS DE DESIGN

- Segue o design system existente do RepCo (vermelho #B81C2C, tipografia atual)
- Usa os componentes UI já existentes no projeto
- Não cria nova biblioteca de componentes
- Dark mode se já existe no projeto

---

## PRIORIDADE DE ENTREGA

1. Upload + salvar no Storage ← primeiro
2. Edge Function de transcrição ← segundo
3. Análise Claude ← terceiro
4. Interface com resultados ← quarto
5. Criador de campanhas ← por último

---

## IMPORTANTE

- Não quebra nada que já existe no RepCo
- Mantém RLS e multi-tenant já configurados
- Usa o Supabase Realtime já configurado para progresso em tempo real
- Todo texto da interface em Português do Brasil
- CLAUDE.md do repositório tem prioridade sobre este briefing em conflitos técnicos
