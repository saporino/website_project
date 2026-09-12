// Coffee LiVRE — "Venda no Coffee LiVRE".
//
// Duas coisas numa página: a vitrine comercial dos planos e o pedido de
// entrada. Não há cobrança e não há aprovação automática — o pedido nasce
// como interesse e um humano decide.
//
// A honestidade dos preços está na tela: eles são valores de estudo e a
// página diz isso. Marketplace que anuncia tarifa e depois muda perde o
// vendedor no primeiro mês.
import { useEffect, useState } from 'react';
import { navegar, rota } from './config';
import { listarPlanos, enviarCandidatura, type Plano } from './catalogo';
import { reais } from './visual';

const TIPOS: [string, string][] = [
  ['produtor', 'Produtor'],
  ['fazenda', 'Fazenda'],
  ['cooperativa', 'Cooperativa'],
  ['torrefacao', 'Torrefação'],
  ['empacotador', 'Empacotador'],
  ['marca', 'Marca de café'],
  ['distribuidor', 'Distribuidor'],
];

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function PaginaVender() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    listarPlanos().then(p => {
      setPlanos(p);
      // O plano sem custo fixo é o padrão: é por onde quase todo vendedor
      // novo entra, e pré-selecionar o caro parece armadilha.
      setEscolhido(p.find(x => x.mensalidade_cents === 0)?.id ?? p[0]?.id ?? null);
    });
  }, []);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    const f = new FormData(e.currentTarget);
    const texto = (k: string) => String(f.get(k) ?? '').trim() || undefined;
    const nfe = f.get('emite_nfe');
    const falha = await enviarCandidatura({
      nome_marca: String(f.get('nome_marca') ?? '').trim(),
      responsavel: String(f.get('responsavel') ?? '').trim(),
      email: String(f.get('email') ?? '').trim(),
      tipo: String(f.get('tipo') ?? 'torrefacao'),
      cnpj: texto('cnpj'),
      razao_social: texto('razao_social'),
      telefone: texto('telefone'),
      cidade: texto('cidade'),
      uf: texto('uf'),
      tipos_de_cafe: texto('tipos_de_cafe'),
      volume_mensal: texto('volume_mensal'),
      prazo_expedicao: texto('prazo_expedicao'),
      emite_nfe: nfe === 'sim' ? true : nfe === 'nao' ? false : null,
      mensagem: texto('mensagem'),
      plan_id: escolhido,
    });
    setEnviando(false);
    if (falha) { setErro('Não foi possível enviar agora. Tente de novo em instantes.'); return; }
    setEnviado(true);
    window.scrollTo(0, 0);
  }

  if (enviado) {
    return (
      <main className="wrap pag">
        <div className="nao-achou">
          <h1>Pedido recebido</h1>
          <p>
            Sua marca entrou na fila de análise. Vamos olhar o cadastro e responder pelo e-mail que
            você informou. Nenhum pedido é aprovado automaticamente: a curadoria é o que protege
            quem já está dentro.
          </p>
          <a href={rota()} onClick={ev => { ev.preventDefault(); navegar(''); }}>Voltar para a home</a>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap pag">
      <div className="pag-topo">
        <p className="migalha">
          <a href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Início</a> › Vender
        </p>
        <h1>Venda no Coffee LiVRE</h1>
        <p>
          Sua loja oficial para compradores de todo o Brasil. Você entende de café; o Coffee LiVRE
          entende de vender.
        </p>
      </div>

      <section className="planos">
        {planos.map(p => (
          <button
            type="button"
            key={p.id}
            className={`plano${escolhido === p.id ? ' on' : ''}`}
            onClick={() => setEscolhido(p.id)}
            aria-pressed={escolhido === p.id}
          >
            <b>{p.nome}</b>
            <span className="plano-preco">
              {p.mensalidade_cents === 0 ? 'Sem custo fixo' : <>R$ {reais(p.mensalidade_cents)}<small>/mês</small></>}
            </span>
            {p.chamada && <span className="plano-chamada">{p.chamada}</span>}
            <ul>
              {p.destaques.map(d => <li key={d}>{d}</li>)}
            </ul>
          </button>
        ))}
      </section>

      <p className="planos-nota">
        Valores em estudo e sem cobrança nesta fase de apresentação. A comissão por venda é definida
        antes da abertura da plataforma e vai no contrato, não numa página que muda sozinha.
      </p>

      <section className="formulario">
        <h2>Conte sobre a sua marca</h2>
        <p className="formulario-sub">
          Levamos até cinco dias úteis para responder. Campos com <b>*</b> são obrigatórios.
        </p>

        <form onSubmit={enviar}>
          <div className="campos">
            <label className="campo campo-largo">
              <span>Nome da marca ou loja *</span>
              <input name="nome_marca" required maxLength={80} placeholder="Como o comprador vai te conhecer" />
            </label>

            <label className="campo">
              <span>Tipo de negócio *</span>
              <select name="tipo" defaultValue="torrefacao">
                {TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>

            <label className="campo">
              <span>CNPJ</span>
              <input name="cnpj" maxLength={20} placeholder="00.000.000/0000-00" inputMode="numeric" />
            </label>

            <label className="campo campo-largo">
              <span>Razão social</span>
              <input name="razao_social" maxLength={120} />
            </label>

            <label className="campo">
              <span>Responsável *</span>
              <input name="responsavel" required maxLength={80} />
            </label>

            <label className="campo">
              <span>E-mail *</span>
              <input name="email" type="email" required maxLength={120} />
            </label>

            <label className="campo">
              <span>Celular</span>
              <input name="telefone" type="tel" maxLength={20} placeholder="(00) 00000-0000" />
            </label>

            <label className="campo">
              <span>Cidade</span>
              <input name="cidade" maxLength={60} />
            </label>

            <label className="campo campo-curto">
              <span>UF</span>
              <select name="uf" defaultValue="">
                <option value="">—</option>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>

            <label className="campo campo-largo">
              <span>Que cafés você vende?</span>
              <input name="tipos_de_cafe" maxLength={160} placeholder="Ex.: tradicional moído, grãos especiais, cápsulas" />
            </label>

            <label className="campo">
              <span>Volume por mês, aproximado</span>
              <input name="volume_mensal" maxLength={60} placeholder="Ex.: 500 kg" />
            </label>

            <label className="campo">
              <span>Prazo para despachar</span>
              <input name="prazo_expedicao" maxLength={60} placeholder="Ex.: 1 dia útil" />
            </label>

            <fieldset className="campo">
              <span>Emite NF-e?</span>
              <div className="escolha">
                <label><input type="radio" name="emite_nfe" value="sim" /> Sim</label>
                <label><input type="radio" name="emite_nfe" value="nao" /> Ainda não</label>
              </div>
            </fieldset>

            <label className="campo campo-largo">
              <span>Quer contar mais alguma coisa?</span>
              <textarea name="mensagem" rows={3} maxLength={600} placeholder="Sua história, o que te diferencia, o que você precisa" />
            </label>
          </div>

          {erro && <p className="formulario-erro" role="alert">{erro}</p>}

          <button type="submit" className="enviar" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Quero vender no Coffee LiVRE'}
          </button>
          <p className="formulario-nota">
            Ao enviar, seus dados ficam com a equipe do Coffee LiVRE apenas para a análise do
            cadastro. Nenhuma cobrança é feita nesta etapa.
          </p>
        </form>
      </section>
    </main>
  );
}
