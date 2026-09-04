# Política de Storage — RepCo / COFICO

**Vigente desde:** 04/09/2026 (Fase D do ciclo Coffee Network)
**Migration:** `20260904170000_fase_d_storage_hardening.sql`

---

## Princípio

Público apenas o que precisa aparecer no site aberto. Todo o resto é privado e servido por signed URL de curta duração, gerada com a identidade de quem pede e sujeita à RLS.

---

## Buckets

| Bucket | Acesso | Limite | Tipos aceitos | Conteúdo |
|---|---|---|---|---|
| `product-images` | **público** | 15 MB | JPEG, PNG, WebP, AVIF, GIF | Fotos de produto da loja |
| `carrier-logos` | **público** | 5 MB | JPEG, PNG, WebP, SVG | Logos de transportadora |
| `batch-photos` | **público** | 10 MB | JPEG, PNG, WebP | Fotos de lote para a página pública de rastreabilidade |
| `chat-media` | privado | 25 MB | imagem, áudio, PDF, texto, DOCX, XLSX | Anexos de conversa interna |
| `visit-photos` | privado | 10 MB | JPEG, PNG, WebP | Fotos de visita em ponto de venda |
| `delivery-pods` | privado | 10 MB | JPEG, PNG, WebP | Comprovante de entrega |
| `invoices` | privado | 20 MB | PDF, XML, imagem | NF, boletos, comprovantes de pagamento |
| `lot-documents` | privado | 20 MB | PDF, imagem | Documentos de custo do café verde |
| `representative-docs` | privado | 10 MB | PDF, JPEG, PNG, WebP | Documentos do representante |
| `studio-videos` | privado | 500 MB | MP4, MOV, WebM | Vídeos do Studio |

Antes da Fase D, `chat-media` e `visit-photos` eram públicos, e nove dos dez buckets não tinham limite de tamanho nem lista de tipos.

---

## Quem pode o quê

- **Leitura pública:** apenas `product-images`, `carrier-logos` e `batch-photos`.
- **Escrita nos buckets públicos:** somente administrador (`public.is_admin()`).
- **`chat-media`:** qualquer autenticado lê, para conseguir gerar a signed URL; a gravação é restrita à pasta do próprio usuário; apaga o dono ou o administrador.
- **`visit-photos` e `delivery-pods`:** autenticado lê e envia, evidência de campo; alterar e apagar é só do administrador.
- **`invoices`:** autenticado lê, envia e atualiza; apaga só administrador.
- **`lot-documents` e `studio-videos`:** somente administrador, em qualquer operação. Documento de custo do café verde nunca pode chegar ao representante.
- **`representative-docs`:** o próprio dono, pelo primeiro segmento do caminho, mais o administrador.

---

## Como o código consome arquivo privado

Nunca use `getPublicUrl` em bucket privado. O padrão do projeto é:

- Gravar no banco o **caminho** do objeto, não a URL.
- Exibir com `signedUrl` ou `signedUrls`, de `src/lib/storageUrl.ts`.
- Para imagem, usar o componente `src/components/PrivateImage.tsx`.

As funções aceitam tanto o caminho quanto uma URL pública antiga, e extraem o caminho sozinhas. Isso mantém as linhas gravadas antes da Fase D funcionando sem migração de dados.

---

## Retenção e exclusão

**Regra geral hoje:** nada é apagado automaticamente. A exclusão é sempre um ato deliberado de um administrador.

**Dívida conhecida e ainda aberta:** apagar um pedido ou um cliente **não** remove os arquivos correspondentes no Storage. `ON DELETE CASCADE` age só nas tabelas. Enquanto essa rotina não existir, arquivos órfãos se acumulam nos buckets privados.

**Retenção legal:** ainda não definida. A ideia de guardar conversas por 24 meses foi levantada, mas depende de revisão jurídica e **não** foi implementada. Nenhum prazo automático de expurgo está ativo.

**Ao definir retenção, decidir por bucket:** o que é documento fiscal, o que é evidência operacional e o que é conversa. Cada um tem obrigação legal diferente.

---

## Risco residual registrado

`invoices` permite leitura a qualquer usuário autenticado. O ideal seria restringir ao dono do pedido, mas o caminho dos arquivos não carrega o identificador do representante, então a regra não tem como ser escrita hoje. Estreitar quando o caminho for normalizado.
