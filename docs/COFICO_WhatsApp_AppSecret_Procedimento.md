# App Secret da Meta — como configurar sem o valor vazar

> O App Secret de staging **ainda é sintético**, gerado por mim para testar a lógica.
> Assinatura real da Meta vai bater **401** enquanto ele não for trocado.
> **Não regenerar nem alterar o App Secret na Meta** — este procedimento só o **lê** e copia.

## Por que ele é diferente do token de verificação

| | Verify token | App Secret |
|---|---|---|
| Quem cria | **nós** | **a Meta** |
| Para que serve | a Meta confirma, uma vez, que a URL é nossa | assinar **cada evento**, para provarmos que veio dela |
| Situação hoje | pronto, novo, testado | **sintético — precisa ser o real** |

Se o App Secret estiver errado, a verificação da URL **passa** (ela usa o outro segredo) e
**toda mensagem é recusada com 401**. Depois de muitas falhas seguidas, a Meta **desativa a
inscrição** do webhook. Por isso a troca vem antes de cadastrar na Meta, nunca depois.

## Onde achar

Painel da Meta → app **COFICO RepCo** (`2903886426647377`) → **Configurações → Básico** →
campo **Chave Secreta do App** → botão **Mostrar** (pede sua senha do Facebook).

É um texto de 32 caracteres hexadecimais. Copie com Ctrl+C e **não cole em lugar nenhum**
além do passo abaixo — nem no chat comigo, nem em bloco de notas, nem em e-mail.

## Como gravar sem o valor aparecer

O jeito errado é digitar o valor na linha de comando: ele fica no **histórico do terminal**,
em texto puro, para sempre. Os dois caminhos abaixo evitam isso.

### Caminho 1 — colar num prompt que não ecoa (recomendado)

No PowerShell, dentro da pasta do projeto:

```bash
$s = Read-Host "Cole o App Secret" -AsSecureString
$v = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
npx supabase secrets set --project-ref mzfnhljphcjpqtuesjci WHATSAPP_COFICO_APP_SECRET=$v
Remove-Variable s, v
```

O `Read-Host -AsSecureString` **não mostra o que você digita** e o valor não entra no
histórico. A última linha apaga a variável da memória da sessão.

### Caminho 2 — por arquivo, se preferir ver o que colou

```bash
npx supabase secrets set --project-ref mzfnhljphcjpqtuesjci --env-file .secret-temp
```

Antes, crie `.secret-temp` com **uma linha só**:

```
WHATSAPP_COFICO_APP_SECRET=o_valor_colado_aqui
```

E **apague o arquivo logo depois**:

```bash
Remove-Item .secret-temp
```

`.secret-temp` foi acrescentado ao `.gitignore`, então ele não entra em commit por acidente.
Ainda assim, apague o arquivo: um segredo em disco é um segredo a mais para vazar.

## Depois de gravar

Me avise. Eu confiro **sem ver o valor** — comparando só o *digest* que o Supabase publica — e
rodo a bancada de novo contra a URL de staging:

```bash
npx supabase secrets list --project-ref mzfnhljphcjpqtuesjci
```

O que isso prova e o que **não** prova:

- **Prova** que o segredo mudou (o digest muda) e que a função continua recusando assinatura
  errada com 401.
- **Não prova** que o valor é o certo. Isso só se confirma quando a **Meta** mandar o primeiro
  evento real e ele for aceito. Até lá, a verdade está no painel dela, não aqui.

É por isso que o primeiro evento de teste é o marco: se ele entrar como `processado`, o App
Secret está certo. Se vier `401`, está errado — e nesse caso basta repetir este procedimento,
sem mexer em nada na Meta.

## Uma ressalva que vale decidir antes

O App Secret é **do aplicativo**, não do ambiente: é o mesmo para teste e para produção. Ao
gravá-lo no staging, o staging passa a guardar um segredo de verdade.

Duas saídas, e a escolha é sua:

1. **Seguir assim** — aceitável enquanto só você tem acesso ao projeto de staging.
2. **Girar o App Secret na Meta** quando formos para produção, para que o valor que esteve no
   staging deixe de valer. **Não faço isso sem sua autorização**, porque girar invalida
   imediatamente qualquer integração que já esteja usando o valor antigo.
