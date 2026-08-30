// Páginas legais PRÓPRIAS da COFICO (LGPD + Termos), servidas dentro do site
// coficobrasil.com.br via hash (#privacidade / #termos) — mesmo padrão de view do #loja.
// Controlador = V. Medeiros de Santi Ltda (marca COFICO Brasil). Conteúdo reflete um
// site INSTITUCIONAL/VITRINE: NÃO há checkout/venda/pagamento no site, então não se
// coletam dados de cartão/compra — só contato/lead e navegação. Não copiar o texto da
// Saporino (marketplaces/compra) que não se aplica aqui.
import { useEffect } from 'react';
import { COFICO } from './config';
import CoficoFooter from './CoficoFooter';

const ATUALIZADO = '30 de agosto de 2026';
const RAZAO = 'V. Medeiros de Santi Ltda';

function goHome() {
  if (typeof window !== 'undefined') {
    window.location.hash = '';
    window.scrollTo(0, 0);
  }
}

function PolicyShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <a href="#topo" onClick={goHome} className="font-semibold text-neutral-900 hover:text-cofico-ink transition-colors">
            COFICO <span className="text-cofico-ink">Brasil</span>
          </a>
          <a href="#topo" onClick={goHome} className="text-sm text-neutral-500 hover:text-cofico-ink transition-colors">
            ← Voltar ao site
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 pt-10 pb-16">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">{title}</h1>
        <p className="text-sm text-neutral-500 mb-8"><strong>Última atualização:</strong> {ATUALIZADO}</p>
        <div className="text-neutral-700 leading-relaxed space-y-4">{children}</div>
      </main>
      <CoficoFooter />
    </div>
  );
}

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mt-8 mb-3">{children}</h2>
);
const Li = ({ children }: { children: React.ReactNode }) => <li className="mb-1">{children}</li>;
const Mail = () => (
  <a href={`mailto:${COFICO.email}`} className="text-cofico-ink hover:underline">{COFICO.email}</a>
);

export function CoficoPrivacidade() {
  useEffect(() => { document.title = 'Política de Privacidade — COFICO Brasil'; }, []);
  return (
    <PolicyShell title="Política de Privacidade">
      <p>
        Esta Política de Privacidade descreve como a {RAZAO} (CNPJ {COFICO.cnpj}), que opera a
        marca <strong>COFICO Brasil</strong> ("COFICO", "nós"), coleta, usa, compartilha e protege
        dados pessoais de visitantes, parceiros e potenciais clientes do site{' '}
        <a href="https://www.coficobrasil.com.br" className="text-cofico-ink hover:underline">www.coficobrasil.com.br</a>{' '}
        ("Site"), em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — "LGPD").
      </p>
      <p>
        O Site é <strong>institucional</strong>: apresenta nossos serviços de desenvolvimento
        comercial, armazenagem e distribuição, além de uma vitrine informativa de marcas.
        <strong> Não realizamos vendas, cobranças ou pagamentos pelo Site</strong> — portanto não
        coletamos aqui dados de cartão, conta bancária ou de compra.
      </p>

      <H2>1. Quem é o controlador</H2>
      <p>
        A {RAZAO}, inscrita no CNPJ nº {COFICO.cnpj}, é a controladora dos dados pessoais tratados
        por meio do Site. Para assuntos de privacidade e proteção de dados, incluindo o exercício
        de direitos do titular, o canal é o e-mail <Mail /> (que também atende como contato do
        Encarregado/DPO).
      </p>

      <H2>2. Definições</H2>
      <ul className="list-disc pl-6">
        <Li><strong>Dados pessoais:</strong> informação que identifique ou possa identificar uma pessoa natural (ex.: nome, e-mail, telefone).</Li>
        <Li><strong>Tratamento:</strong> qualquer operação com dados pessoais (coleta, uso, armazenamento, compartilhamento, eliminação).</Li>
        <Li><strong>Titular:</strong> a pessoa natural a quem os dados se referem.</Li>
        <Li><strong>LGPD:</strong> Lei nº 13.709/2018, que regula o tratamento de dados pessoais no Brasil.</Li>
      </ul>

      <H2>3. Quais dados coletamos</H2>
      <p><strong>3.1 Dados que você nos fornece.</strong> Ao entrar em contato por formulário, e-mail, WhatsApp ou ao manifestar interesse em distribuir uma marca conosco, podemos coletar: nome, empresa/razão social, e-mail, telefone e o conteúdo da sua mensagem.</p>
      <p><strong>3.2 Dados coletados automaticamente.</strong> Ao navegar no Site, podemos registrar dados técnicos como endereço IP, tipo de dispositivo e navegador, páginas visitadas e data/hora de acesso, por meio de cookies e tecnologias semelhantes (ver Seção 5).</p>
      <p><strong>3.3 Não coletamos</strong> dados sensíveis nem dados de pagamento por meio do Site.</p>

      <H2>4. Para que usamos e bases legais</H2>
      <ul className="list-disc pl-6">
        <Li>Responder a contatos e conduzir tratativas comerciais de distribuição/representação — <em>execução de contrato e diligências pré-contratuais</em> e <em>legítimo interesse</em> (Art. 7º, V e IX da LGPD).</Li>
        <Li>Operar, medir e melhorar o Site e sua segurança — <em>legítimo interesse</em>.</Li>
        <Li>Cumprir obrigações legais e regulatórias — <em>cumprimento de obrigação legal</em>.</Li>
        <Li>Enviar comunicações que você tenha solicitado — <em>consentimento</em>, revogável a qualquer momento.</Li>
      </ul>

      <H2>5. Cookies e analytics</H2>
      <p>
        Usamos cookies <strong>essenciais</strong> (necessários ao funcionamento do Site) e, mediante
        seu consentimento, cookies de <strong>medição/analytics</strong> para entender o uso do Site e
        melhorá-lo. Você pode gerenciar o consentimento pelo aviso de cookies exibido no Site e, a
        qualquer momento, bloquear ou apagar cookies nas configurações do seu navegador — parte das
        funcionalidades pode ser afetada.
      </p>

      <H2>6. Compartilhamento</H2>
      <p>Não vendemos dados pessoais. Podemos compartilhá-los com:</p>
      <ul className="list-disc pl-6">
        <Li>provedores de infraestrutura, hospedagem e ferramentas que operam o Site, sob obrigação de confidencialidade e apenas conforme nossas instruções;</Li>
        <Li>empresas parceiras/representadas, quando necessário para dar seguimento à sua solicitação comercial;</Li>
        <Li>autoridades públicas, quando exigido por lei ou ordem judicial.</Li>
      </ul>

      <H2>7. Armazenamento, segurança e retenção</H2>
      <p>Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados. Mantemos os dados apenas pelo tempo necessário às finalidades acima ou ao cumprimento de obrigações legais; findo esse prazo, são eliminados ou anonimizados. Alguns provedores podem processar dados fora do Brasil, sempre com salvaguardas compatíveis com a LGPD.</p>

      <H2>8. Seus direitos (LGPD)</H2>
      <p>Você pode, a qualquer tempo, solicitar: confirmação da existência de tratamento; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; informação sobre compartilhamento; e revogação do consentimento. Para exercê-los, escreva para <Mail />.</p>

      <H2>9. Alterações</H2>
      <p>Esta Política pode ser atualizada. A versão vigente é sempre a publicada nesta página, com a data de "Última atualização" acima.</p>

      <H2>10. Contato</H2>
      <p>Dúvidas sobre privacidade: <Mail /> · Telefone/WhatsApp: {COFICO.phone}.</p>
    </PolicyShell>
  );
}

export function CoficoTermos() {
  useEffect(() => { document.title = 'Termos de Uso — COFICO Brasil'; }, []);
  return (
    <PolicyShell title="Termos de Uso">
      <p>
        Estes Termos de Uso regem o acesso e a navegação no site{' '}
        <a href="https://www.coficobrasil.com.br" className="text-cofico-ink hover:underline">www.coficobrasil.com.br</a>{' '}
        ("Site"), operado pela {RAZAO} (CNPJ {COFICO.cnpj}), sob a marca <strong>COFICO Brasil</strong>.
        Ao navegar no Site, você concorda com estes Termos.
      </p>

      <H2>1. Objeto e natureza do Site</H2>
      <p>
        O Site é <strong>institucional e informativo</strong>. Apresenta os serviços da COFICO
        (desenvolvimento comercial, armazenagem, inteligência comercial, distribuição, marketing de
        apoio e tecnologia) e uma <strong>vitrine de marcas</strong>. Os produtos exibidos têm caráter
        <strong> meramente informativo</strong>: <strong>não há carrinho, checkout, preço ao público,
        pagamento ou venda pelo Site</strong>. A comercialização ocorre por nossos canais próprios
        (representantes/atendimento), sujeita a cadastro, condições comerciais e aprovação.
      </p>

      <H2>2. Uso permitido</H2>
      <p>Você concorda em usar o Site de forma lícita e a não: (a) violar direitos de terceiros ou da COFICO; (b) tentar acessar áreas restritas sem autorização; (c) interferir na segurança ou no funcionamento do Site; (d) reproduzir conteúdo sem autorização.</p>

      <H2>3. Propriedade intelectual</H2>
      <p>A marca COFICO, o layout, os textos e demais elementos do Site são protegidos por direitos de propriedade intelectual. As marcas de terceiros (produtos representados) pertencem aos seus respectivos titulares e são exibidas com finalidade informativa. Nenhum conteúdo pode ser copiado ou usado comercialmente sem autorização prévia.</p>

      <H2>4. Vitrine sem venda</H2>
      <p>As informações de produtos (nomes, descrições, imagens) podem mudar sem aviso e não constituem oferta. Disponibilidade, condições e preços são tratados exclusivamente pelos canais comerciais da COFICO mediante cadastro.</p>

      <H2>5. Links e serviços de terceiros</H2>
      <p>O Site pode conter links para sites externos (ex.: redes sociais, mapas). Não somos responsáveis pelo conteúdo ou pelas práticas de privacidade desses terceiros.</p>

      <H2>6. Limitação de responsabilidade</H2>
      <p>O Site é fornecido "no estado em que se encontra". Empregamos esforços razoáveis para manter as informações corretas e o Site disponível, mas não garantimos ausência de erros ou interrupções. Na máxima extensão permitida pela lei, a COFICO não responde por danos decorrentes do uso ou da indisponibilidade do Site.</p>

      <H2>7. Privacidade</H2>
      <p>O tratamento de dados pessoais segue a nossa <a href="#privacidade" className="text-cofico-ink hover:underline">Política de Privacidade</a>.</p>

      <H2>8. Alterações</H2>
      <p>Podemos atualizar estes Termos a qualquer momento. A versão vigente é a publicada nesta página, com a data de "Última atualização" acima.</p>

      <H2>9. Legislação e foro</H2>
      <p>Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de São Paulo/SP para dirimir controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

      <H2>10. Contato</H2>
      <p>Fale conosco: <Mail /> · Telefone/WhatsApp: {COFICO.phone}.</p>
    </PolicyShell>
  );
}
