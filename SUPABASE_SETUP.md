# 🔍 Verificar Projeto Supabase - Guia Passo a Passo

## 🎯 Objetivo
Verificar se você já tem um projeto Supabase para o Café Saporino e configurá-lo corretamente.

---

## Passo 1: Acessar Supabase Dashboard

### 🌐 Ação Manual - Navegador

1. **Acesse:** https://app.supabase.com/
2. **Faça login** com sua conta
3. **Você vai ver** uma lista dos seus projetos

---

## Passo 2: Identificar o Projeto

### Opção A: Projeto Já Existe

Se você vê um projeto chamado algo como:
- `website_project`
- `cafe-saporino`
- `saporino`
- Ou qualquer nome relacionado

**✅ Ótimo! Vamos usar esse projeto.**

**Me diga:**
1. Qual é o nome do projeto?
2. Clique no projeto e me passe:
   - URL do projeto (ex: `https://xxxxx.supabase.co`)
   - Região (ex: South America)

### Opção B: Projeto Não Existe

Se não tem nenhum projeto ou quer criar um novo:

**Vamos criar agora:**
1. Clique em **"New Project"**
2. Preencha:
   - **Name:** `cafe-saporino`
   - **Database Password:** Crie uma senha forte e **ANOTE!**
   - **Region:** South America (São Paulo)
3. Clique **"Create new project"**
4. Aguarde 2-3 minutos (criação do banco)

---

## Passo 3: Obter Credenciais

### 🔑 Onde Encontrar

1. **No seu projeto**, clique em **"Settings"** (⚙️ no menu lateral)
2. Clique em **"API"**
3. **Você vai ver:**

```
Project URL
https://xxxxxxxxxxxxx.supabase.co

API Keys
┌─────────────────────────────────────┐
│ anon public                         │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ service_role secret                 │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...│
└─────────────────────────────────────┘
```

### 📋 O Que Você Precisa Copiar

**Me passe essas 2 informações:**

1. **Project URL** (a URL completa)
2. **anon public key** (a chave grande que começa com `eyJ...`)

> [!IMPORTANT]
> **NÃO compartilhe** a `service_role` key publicamente! Ela é secreta.

---

## Passo 4: Verificar Tabelas

### 🗄️ Ver o Que Já Existe

1. No menu lateral, clique em **"Table Editor"**
2. **Você vai ver** uma lista de tabelas (se houver)

### ❓ O Que Esperar

**Se você vê tabelas como:**
- `products`
- `orders`
- `user_profiles`
- `subscriptions`

✅ **Ótimo!** O banco já está configurado.

**Se NÃO vê nenhuma tabela:**
❌ Precisamos aplicar as migrations (eu vou te ajudar)

---

## Passo 5: Verificar Storage

### 📦 Configuração de Armazenamento

1. No menu lateral, clique em **"Storage"**
2. **Você vai ver** uma lista de buckets (pastas)

### ❓ O Que Esperar

**Se você vê um bucket chamado:**
- `product-images` ou
- `products` ou
- Qualquer bucket para imagens

✅ **Ótimo!** Storage configurado.

**Se NÃO vê nenhum bucket:**
❌ Precisamos criar (eu vou te ajudar)

---

## 📊 Resumo - Me Diga

Depois de verificar, me responda:

1. **Tem projeto Supabase?**
   - ✅ Sim, nome: `_______`
   - ❌ Não, vou criar agora

2. **Se tem projeto, me passe:**
   - Project URL: `https://xxxxx.supabase.co`
   - Anon Key: `eyJhbGci...` (primeiros 20 caracteres)

3. **Tem tabelas no banco?**
   - ✅ Sim, vejo: products, orders, etc.
   - ❌ Não, está vazio

4. **Tem bucket de storage?**
   - ✅ Sim
   - ❌ Não

---

## 🎯 Próximos Passos

**Depois que você me passar essas informações:**

1. ✅ Vou criar o arquivo `.env` com as credenciais
2. ✅ Vou aplicar as migrations (se necessário)
3. ✅ Vou configurar o Storage (se necessário)
4. ✅ Vamos testar a conexão

**Aguardo suas respostas para continuar!** 😊
