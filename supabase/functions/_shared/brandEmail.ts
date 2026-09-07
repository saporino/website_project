// Identidade visual e textos dos e-mails de autenticação, por marca.
//
// O sistema atende duas lojas no MESMO projeto de autenticação. Quem se cadastra
// na COFICO tem que receber um e-mail com a cara da COFICO — receber um e-mail
// "Café Saporino" depois de se cadastrar em coficobrasil.com.br parece golpe, e
// cliente que desconfia não confirma o cadastro.
//
// A marca sai do endereço para onde a pessoa volta depois de clicar (redirect_to),
// que é o domínio de onde ela veio. É o mesmo critério que decide a empresa
// faturadora do pedido em src/lib/sellerCompany.ts — um critério só, dois lugares.

export type Marca = "CS" | "CO";

export type Identidade = {
  marca: Marca;
  nome: string;
  remetente: string;
  cor: string;      // fundo do cabeçalho e do botão
  sac: string;
  rodape: string;
};

const IDENTIDADES: Record<Marca, Identidade> = {
  CS: {
    marca: "CS",
    nome: "CAFÉ SAPORINO",
    remetente: "Café Saporino <nao-responda@cafesaporino.com.br>",
    cor: "#8B2214",
    sac: "sac@cafesaporino.com.br",
    rodape: "Café Saporino Ltda · mensagem automática enviada por nao-responda@cafesaporino.com.br",
  },
  CO: {
    // cofico.dark (#B81C1C), não o #FF3131: vermelho puro sobre branco reprova
    // contraste, e e-mail não tem como testar acessibilidade depois de enviado.
    marca: "CO",
    nome: "COFICO BRASIL",
    remetente: "COFICO Brasil <nao-responda@coficobrasil.com.br>",
    cor: "#B81C1C",
    sac: "sac@coficobrasil.com.br",
    rodape: "COFICO Brasil · mensagem automática enviada por nao-responda@coficobrasil.com.br",
  },
};

/**
 * Marca a partir do endereço de retorno.
 * Domínio desconhecido cai na Saporino, que é a loja principal: e-mail com a marca
 * errada é ruim, e-mail nenhum é pior.
 */
export function marcaPorUrl(url: string | null | undefined): Marca {
  try {
    const host = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "coficobrasil.com.br") return "CO";
  } catch { /* url ausente ou malformada: cai no padrão */ }
  return "CS";
}

export function identidade(marca: Marca): Identidade {
  return IDENTIDADES[marca];
}

/**
 * Marca a partir do prefixo da empresa faturadora (`companies.order_prefix`).
 * É o caminho usado depois que o pedido existe: aí a empresa já está gravada
 * nele, e não se olha mais o domínio de onde a compra veio.
 */
export function marcaPorPrefixo(prefixo: string | null | undefined): Marca {
  return prefixo === "CO" ? "CO" : "CS";
}

export const p = (t: string) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#3f3a38">${t}</p>`;
export const nota = (t: string) => `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#8a8078">${t}</p>`;

/** Escapa texto que veio do cliente antes de entrar no HTML do e-mail. */
export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/**
 * Moldura comum. HTML simples com estilo embutido, que é o que sobrevive em
 * cliente de e-mail. Sem o endereço técnico no rodapé de propósito: URL crua com
 * domínio de infraestrutura tem cara de golpe.
 */
export function moldura(id: Identidade, titulo: string, corpo: string, botao: { texto: string; link: string } | null): string {
  return `
<div style="margin:0;padding:24px 12px;background:#f8f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #eee7e5;border-radius:14px;overflow:hidden">
    <div style="background:${id.cor};padding:20px 28px">
      <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.3px">${id.nome}</span>
    </div>
    <div style="padding:28px">
      <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#1a1a1a">${titulo}</h1>
      ${corpo}
      ${botao ? `
      <div style="margin:24px 0 8px">
        <a href="${botao.link}"
           style="display:inline-block;background:${id.cor};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px">${botao.texto}</a>
      </div>` : ""}
    </div>
    <div style="padding:16px 28px;background:#faf8f7;border-top:1px solid #eee7e5">
      <p style="margin:0;font-size:11px;color:#a99f9b;text-align:center">${id.rodape}</p>
    </div>
  </div>
</div>`.trim();
}

/** Código de 6 dígitos em destaque, para os casos sem link. */
function codigo(cor: string, token: string): string {
  return `<div style="margin:22px 0 8px;font-size:28px;font-weight:700;letter-spacing:6px;color:${cor}">${token}</div>`;
}

export type Montado = { assunto: string; html: string };

/**
 * Monta assunto e corpo para cada tipo de e-mail de autenticação.
 * Tipo desconhecido devolve null — quem chama decide o que fazer, em vez de
 * mandar um e-mail genérico que ninguém entende.
 */
export function montarEmail(
  tipo: string,
  id: Identidade,
  link: string,
  token: string,
): Montado | null {
  switch (tipo) {
    case "signup":
      return {
        assunto: `Confirme seu cadastro — ${tituloCurto(id)}`,
        html: moldura(id, "Confirme seu cadastro",
          p(`Olá! Falta um passo para concluir seu cadastro.`) +
          p("Clique no botão abaixo para confirmar seu e-mail.") +
          nota("Se não foi você que se cadastrou, é só ignorar esta mensagem."),
          { texto: "Confirmar meu e-mail", link }),
      };

    case "invite":
      return {
        assunto: `Você foi convidado — ${tituloCurto(id)}`,
        html: moldura(id, "Você foi convidado",
          p("Criaram uma conta para você. Use o botão abaixo para definir sua senha e entrar.") +
          nota("Se você não esperava este convite, pode ignorar esta mensagem."),
          { texto: "Criar minha senha", link }),
      };

    case "magiclink":
      return {
        assunto: `Seu link de acesso — ${tituloCurto(id)}`,
        html: moldura(id, "Seu link de acesso",
          p("Use o botão abaixo para entrar na sua conta.") +
          nota("O link vale por uma hora e só pode ser usado uma vez. Se não foi você que pediu, ignore esta mensagem."),
          { texto: "Entrar na minha conta", link }),
      };

    case "recovery":
      return {
        assunto: `Redefinir sua senha — ${tituloCurto(id)}`,
        html: moldura(id, "Redefinir sua senha",
          p("Recebemos um pedido para redefinir a senha da sua conta.") +
          p("Clique no botão abaixo para criar uma nova.") +
          nota("O link vale por uma hora. Se não foi você que pediu, ignore esta mensagem: sua senha continua a mesma."),
          { texto: "Criar nova senha", link }),
      };

    case "email_change":
    case "email_change_new":
    case "email_change_current":
      return {
        assunto: `Confirme seu novo e-mail — ${tituloCurto(id)}`,
        html: moldura(id, "Confirme seu novo e-mail",
          p("Você pediu para trocar o e-mail da sua conta.") +
          p("Confirme o endereço para concluir a mudança.") +
          nota("Enquanto você não confirmar, o e-mail antigo continua valendo. Se não foi você, ignore esta mensagem."),
          { texto: "Confirmar novo e-mail", link }),
      };

    case "reauthentication":
      return {
        assunto: `Seu código de confirmação — ${tituloCurto(id)}`,
        html: moldura(id, "Seu código de confirmação",
          p("Digite o código abaixo na tela para concluir a operação.") +
          codigo(id.cor, token) +
          nota("O código vale por poucos minutos. Se não foi você que pediu, ignore esta mensagem e troque sua senha."),
          null),
      };

    default:
      return null;
  }
}

/** "Café Saporino" / "COFICO Brasil" — o nome do cabeçalho não serve para assunto. */
function tituloCurto(id: Identidade): string {
  return id.marca === "CO" ? "COFICO Brasil" : "Café Saporino";
}
