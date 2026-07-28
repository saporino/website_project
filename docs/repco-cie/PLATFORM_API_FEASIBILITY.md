# PLATFORM_API_FEASIBILITY — RepCo C.I.E.
Viabilidade real de cada API (conforme termos vigentes; confirmar na doc oficial antes de implementar).

## Instagram (Meta)
- **Conta própria:** API with Instagram Login (`graph.instagram.com`) — mídia, insights, comentários do próprio perfil, **publicação** (Reels/imagem). Já integrado. Token IGAA long-lived (60d) com refresh.
- **Concorrente:** apenas metadados públicos/manuais. **Sem** acesso a seguidores/comentários de terceiros. Uso via importação/captura autorizada.
- **Private Replies:** resposta privada a quem comentou no post próprio, dentro de janela/regras.
- **Risco:** revisão do app Meta para permissões avançadas.

## YouTube (Data API v3) — recomendado como 1ª fonte pública
- Pesquisar vídeos, consultar canais, estatísticas, **`commentThreads.list`** (comentários públicos por vídeo).
- Quota diária (~10.000 unidades); comentários podem estar desativados em alguns vídeos.
- **Melhor plataforma para provar Arqueologia Emocional** em conteúdo público. Grátis. Precisa `YOUTUBE_API_KEY` (Google Cloud).

## TikTok
- **Content Posting API:** publicar da conta própria (código pronto). Requer scope `video.publish` (auditoria) + domínio do storage verificado. Sandbox exige `SELF_ONLY`.
- **Research API:** dados públicos, mas **condicionada a aprovação** de projeto de pesquisa — não é API comercial aberta. Para MVP usar Creative Center + importação + conta própria.

## WhatsApp Cloud API
- Atendimento/campanha com **templates aprovados + consentimento + janela de 24h**. Pago por conversa. Fase 4.

## Amazon SP-API / Mercado Livre API
- Só dados da **conta própria** (vendas, pedidos, anúncios). Não dão inteligência total de concorrentes. Concorrentes = páginas públicas/serviços licenciados com compliance.

## Apify (raspagem)
- Usado hoje para posts/seguidores de perfis IG. Respeitar termos de plataforma; não usar para lista de seguidores/DM. Pago por result.

## Conclusão de sequência recomendada
1. **YouTube Data API** (comentários públicos, grátis) → prova o motor de comentários.
2. **Instagram próprio** (comentários do próprio perfil + publicação) → ciclo fechado.
3. Marketplace snapshots com compliance.
4. TikTok/WhatsApp/SP-API conforme aprovação e necessidade.
