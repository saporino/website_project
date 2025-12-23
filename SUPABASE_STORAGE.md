# Configuração do Supabase Storage para Upload de Imagens

## Visão Geral

O sistema agora suporta upload direto de imagens para produtos e transportadoras. Para que essa funcionalidade funcione, você precisa criar buckets no Supabase Storage.

## Buckets Necessários

### 1. product-images
Para armazenar imagens de produtos de café.

### 2. carrier-logos  
Para armazenar logos das transportadoras.

## Passo a Passo para Configuração

### 1. Acessar o Supabase Storage

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. No menu lateral, clique em **Storage**

### 2. Criar Bucket para Produtos

1. Clique em "**New bucket**"
2. Preencha os campos:
   - **Name**: `product-images`
   - **Public bucket**: ✅ **Marque esta opção** (para que as imagens sejam acessíveis publicamente)
3. Clique em "**Create bucket**"

### 3. Criar Bucket para Logos de Transportadoras

Repita o processo:
1. Clique em "**New bucket**"
2. Preencha:
   - **Name**: `carrier-logos`
   - **Public bucket**: ✅ **Marque esta opção**
3. Clique em "**Create bucket**"

### 4. Configurar Políticas de Acesso (RLS)

Por padrão, buckets públicos já permitem leitura. Se você encontrar problemas de permissão:

#### Para product-images:

Vá em **Storage** → **Policies** → `product-images` e adicione:

**Policy Name**: Allow public upload
**Policy Definition**:
```sql
-- Permitir upload para usuários autenticados
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Permitir leitura pública
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');
```

#### Para carrier-logos:

Mesma configuração para `carrier-logos`:

```sql
-- Permitir upload para usuários autenticados
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'carrier-logos');

-- Permitir leitura pública
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'carrier-logos');
```

## Testando o Upload

### Teste de Produto

1. Vá para o painel admin
2. Clique em "**Produtos**"
3. Edite ou adicione um produto
4. Na seção "**Imagem do Produto**", clique em "**📤 Upload**"
5. Selecione uma imagem PNG ou JPEG (max 2MB)
6. Verifique se o preview aparece

### Teste de Transportadora

1. Vá para "**Transportadoras**"
2. Edite ou adicione uma transportadora
3. Na seção "**Logo da Transportadora**", clique em "**📤 Upload**"
4. Selecione uma imagem
5. Verifique o preview

## Solução de Problemas

### ❌ Erro: "new row violates row-level security"

**Causa**: O bucket não existe ou as policies não estão configuradas.

**Solução**:
1. Verifique se o bucket existe em Storage
2. Certifique-se que marcou "Public bucket"
3. Adicione as policies de upload para usuários autenticados

### ❌ Erro: "Bucket not found"

**Causa**: O nome do bucket está errado ou não foi criado.

**Solução**: Crie o bucket com o nome exato:
- `product-images`
- `carrier-logos`

### ❌ Imagem não aparece após upload

**Causa**: Bucket privado ou policies de leitura ausentes.

**Solução**: Marque o bucket como público ou adicione policy de leitura pública.

## URLs Geradas

Após o upload bem-sucedido, as URLs serão similares a:

```
https://[seu-projeto].supabase.co/storage/v1/object/public/product-images/1733234567890-abc123.jpg
```

Essas URLs são salvas automaticamente no banco de dados.

## Limites e Recomendações

- **Tamanho máximo**: 2MB por imagem (configurável no código)
- **Formatos aceitos**: PNG, JPEG, JPG, WebP
- **Dimensões recomendadas**: 
  - Produtos: 800x800px ou 1000x1000px
  - Logos: 200x200px ou 300x300px (transparência recomendada)

## Alternativa: Usar URLs Externas

Se você não quiser configurar o Storage agora, pode usar URLs de imagens hospedadas externamente:

1. Hospede a imagem no [Imgur](https://imgur.com), [ImgBB](https://imgbb.com), ou similar
2. Copie a URL da imagem
3. No formulário, clique em "**🔗 URL**"
4. Cole a URL no campo

Essa opção não requer configuração no Supabase.
