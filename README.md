# ☕ Café Saporino - Website

Site oficial da Café Saporino com sistema de e-commerce, assinaturas e painel administrativo.

## 🚀 Tecnologias

- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Pagamentos**: Mercado Pago
- **Deploy**: Vercel

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no [Supabase](https://supabase.com)
- Conta no [Mercado Pago](https://www.mercadopago.com.br/developers) (para pagamentos)

## ⚙️ Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` e preencha com suas credenciais:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
VITE_MERCADO_PAGO_PUBLIC_KEY=sua_public_key_aqui
```

### 3. Configurar Supabase

**Importante**: Você precisa aplicar as migrations para criar o banco de dados.

Consulte o arquivo `implementation_plan.md` na pasta `.gemini/antigravity/brain/` para instruções detalhadas de configuração do Supabase.

Resumo rápido:
1. Crie um projeto no Supabase
2. Aplique as migrations da pasta `supabase/migrations/`
3. Crie um usuário admin
4. Insira produtos de exemplo

### 4. Executar localmente

```bash
npm run dev
```

O site estará disponível em: `http://localhost:5173`

## 📦 Build para Produção

```bash
npm run build
```

Os arquivos gerados estarão na pasta `dist/`.

## 🌐 Deploy

O projeto está configurado para deploy automático no Vercel.

1. Conecte seu repositório no Vercel
2. Configure as variáveis de ambiente
3. Deploy automático!

## 📁 Estrutura do Projeto

```
website_project/
├── src/
│   ├── components/      # Componentes React
│   ├── contexts/        # Context providers (Auth, Cart)
│   ├── lib/            # Configurações (Supabase)
│   ├── pages/          # Páginas da aplicação
│   └── App.tsx         # Componente principal
├── supabase/
│   └── migrations/     # Scripts SQL do banco
├── public/             # Arquivos estáticos
└── package.json
```

## 🔐 Usuário Admin

Após configurar o Supabase, crie um usuário admin executando:

```sql
UPDATE user_profiles
SET is_admin = true
WHERE id = 'SEU_USER_ID';
```

## 📞 Suporte

Para dúvidas sobre a configuração, consulte o arquivo `implementation_plan.md`.

## 📝 Licença

© 2024 Café Saporino. Todos os direitos reservados.
