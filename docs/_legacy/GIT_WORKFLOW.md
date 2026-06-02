# 🚀 Guia Git - Café Saporino

## ✅ Status Atual

- ✅ **Git instalado:** v2.52.0
- ✅ **Repositório inicializado:** Sim
- ✅ **Primeiro commit:** d6bf416 - "Initial commit - Café Saporino project"
- ✅ **Credenciais configuradas:**
  - Nome: Saporino
  - Email: saporinobr@gmail.com

---

## 📋 Comandos Diários (Como Salvar Mudanças)

### 1️⃣ Ver o que mudou

🖥️ **ONDE:** Terminal PowerShell (VS Code ou Windows)  
📁 **PASTA:** `c:\Users\TATU\OneDrive\Documents\website_project`

```bash
git status
```

**O que mostra:** Lista de arquivos modificados, adicionados ou deletados

---

### 2️⃣ Adicionar mudanças

```bash
git add .
```

**O que faz:** Prepara TODOS os arquivos modificados para o commit

**Alternativa (arquivo específico):**
```bash
git add src/components/admin/ProductsManagement.tsx
```

---

### 3️⃣ Salvar com mensagem descritiva

```bash
git commit -m "Descrição do que você fez"
```

**Exemplos de boas mensagens:**
- `git commit -m "Adiciona upload de imagens de produtos"`
- `git commit -m "Corrige bug no carrinho de compras"`
- `git commit -m "Atualiza integração Mercado Pago"`

---

### 4️⃣ Enviar para GitHub (depois de configurar)

```bash
git push
```

**O que faz:** Envia suas mudanças para o backup na nuvem (GitHub)

---

## 🔗 Como Conectar com GitHub

### Passo 1: Criar Repositório no GitHub

1. **Acesse:** https://github.com/new
2. **Preencha:**
   - Nome: `cafe-saporino`
   - Descrição: `Website do Café Saporino`
   - Visibilidade: **Private** (recomendado)
3. **NÃO marque:** "Add a README file"
4. **Clique:** "Create repository"

### Passo 2: Conectar Repositório Local

🖥️ **ONDE:** Terminal PowerShell (VS Code)  
📁 **PASTA:** `c:\Users\TATU\OneDrive\Documents\website_project`

```bash
git remote add origin https://github.com/SEU_USUARIO/cafe-saporino.git
git branch -M main
git push -u origin main
```

**⚠️ Importante:** Substitua `SEU_USUARIO` pelo seu nome de usuário do GitHub

### Passo 3: Autenticação (primeira vez)

Na primeira vez que fizer `git push`, o GitHub vai pedir autenticação:

1. **Opção 1 - GitHub Desktop (Mais Fácil):**
   - Baixe: https://desktop.github.com/
   - Faça login
   - Ele gerencia a autenticação automaticamente

2. **Opção 2 - Personal Access Token:**
   - Acesse: https://github.com/settings/tokens
   - Clique: "Generate new token (classic)"
   - Marque: `repo` (acesso completo)
   - Copie o token gerado
   - Use como senha quando o Git pedir

---

## 🔄 Workflow Completo (Dia a Dia)

```bash
# 1. Ver mudanças
git status

# 2. Adicionar tudo
git add .

# 3. Salvar localmente
git commit -m "Descrição clara do que fez"

# 4. Enviar para GitHub (backup na nuvem)
git push
```

**Pronto! Seu trabalho está protegido! 🎉**

---

## 📊 Comandos Úteis

### Ver histórico de commits
```bash
git log --oneline
```

### Ver diferenças antes de commitar
```bash
git diff
```

### Desfazer mudanças não commitadas
```bash
git checkout -- nome-do-arquivo.tsx
```

### Ver status do repositório remoto
```bash
git remote -v
```

---

## 🆘 Solução de Problemas

### Git não é reconhecido
**Solução:** Adicione ao PATH temporariamente:
```bash
$env:Path += ";C:\Program Files\Git\cmd"
```

### Esqueci de fazer commit antes de mudar muita coisa
**Solução:** Não tem problema! Faça o commit agora:
```bash
git add .
git commit -m "Múltiplas melhorias e correções"
git push
```

### Quero voltar para uma versão anterior
**Solução:** Veja o histórico e restaure:
```bash
git log --oneline
git checkout CODIGO_DO_COMMIT
```

---

## 🎯 Dicas Importantes

✅ **Faça commits frequentes** - Melhor muitos commits pequenos do que um gigante  
✅ **Mensagens descritivas** - Você vai agradecer depois quando procurar algo  
✅ **Push diário** - Garante backup na nuvem  
✅ **Antes de grandes mudanças** - Sempre faça commit do que está funcionando  

---

## 📞 Próximos Passos

1. [ ] Criar conta no GitHub (se ainda não tem)
2. [ ] Criar repositório `cafe-saporino`
3. [ ] Conectar repositório local ao GitHub
4. [ ] Fazer primeiro push
5. [ ] Testar workflow fazendo uma pequena mudança

**Seu projeto está protegido localmente! Quando conectar ao GitHub, terá proteção tripla! 🛡️**
