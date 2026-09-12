// Seller Central — minha loja.
//
// Dois blocos que não se misturam: os DADOS da loja, que o vendedor edita,
// e a SITUAÇÃO da loja, que só a plataforma muda. Juntar os dois num
// formulário convidaria o vendedor a achar que um botão "ativar" deveria
// estar ali — e ele não está, nem aqui nem no banco.
import { useState } from 'react';
import { navegar, rota } from '../config';
import { salvarLoja } from './dados';
import type { LojaDoVendedor } from './sessao';
import type { Avisar } from './SellerCentral';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

// Tons de apoio para a capa. Nenhum é o vermelho da Saporino nem o da
// COFICO: a loja do vendedor é dele, dentro de uma marca que não é deles.
const CORES = ['#2F4B3A', '#6E4A2A', '#264D4A', '#A2472A', '#35506B', '#5A3524', '#4E6B2E', '#8A5A2B'];

export default function MinhaLoja({ loja, avisar, aoSalvar }: {
  loja: LojaDoVendedor;
  avisar: Avisar;
  aoSalvar: () => void;
}) {
  const [nome, setNome] = useState(loja.nome);
  const [chamada, setChamada] = useState(loja.chamada ?? '');
  const [especialidade, setEspecialidade] = useState(loja.especialidade ?? '');
  const [cidade, setCidade] = useState(loja.cidade ?? '');
  const [uf, setUf] = useState(loja.uf ?? '');
  const [historia, setHistoria] = useState(loja.historia ?? '');
  const [cor, setCor] = useState(loja.cor ?? CORES[0]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) { setErro('A loja precisa de um nome.'); return; }
    setSalvando(true);
    setErro(null);
    try {
      await salvarLoja(loja.id, { nome, chamada, especialidade, cidade, uf, historia, cor });
      avisar({ tipo: 'ok', texto: 'Dados da loja salvos.' });
      aoSalvar();
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

  return (
    <div className="sc-pilha">
      <div className="sc-titulo sc-titulo-com-acao">
        <div>
          <h1>Minha loja</h1>
          <p className="sc-sub">Como sua marca aparece para o comprador.</p>
        </div>
        {loja.ativa && (
          <a href={rota(`loja/${loja.slug}`)} className="sc-botao" onClick={e => { e.preventDefault(); navegar(`loja/${loja.slug}`); }}>
            Ver minha loja
          </a>
        )}
      </div>

      <section className={`sc-cartao sc-alerta ${loja.ativa ? 'ok' : 'aviso'}`}>
        <b>{loja.ativa ? 'Loja aprovada e no ar' : 'Loja aguardando aprovação'}</b>
        <p>
          {loja.ativa
            ? 'Seus produtos publicados aparecem na vitrine do Coffee LiVRE.'
            : 'A aprovação é feita pela equipe do Coffee LiVRE. Você pode editar os dados e cadastrar produtos enquanto isso; eles aparecem assim que a loja for aprovada.'}
        </p>
      </section>

      <div className="sc-loja-grade">
        <form className="sc-cartao" onSubmit={salvar}>
          <h2>Dados da loja</h2>
          <div className="sc-grade-campos">
            <label className="sc-campo largo">
              <span>Nome da loja *</span>
              <input value={nome} onChange={e => setNome(e.target.value)} maxLength={80} />
            </label>
            <label className="sc-campo largo">
              <span>Chamada</span>
              <input value={chamada} onChange={e => setChamada(e.target.value)} maxLength={120}
                     placeholder="Uma frase: o que sua loja tem de diferente" />
            </label>
            <label className="sc-campo">
              <span>Especialidade</span>
              <input value={especialidade} onChange={e => setEspecialidade(e.target.value)} maxLength={80}
                     placeholder="Ex.: especiais do Sul de Minas" />
            </label>
            <label className="sc-campo">
              <span>Cidade</span>
              <input value={cidade} onChange={e => setCidade(e.target.value)} maxLength={60} />
            </label>
            <label className="sc-campo curto">
              <span>UF</span>
              <select value={uf} onChange={e => setUf(e.target.value)}>
                <option value="">—</option>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className="sc-campo largo">
              <span>História</span>
              <textarea rows={5} value={historia} onChange={e => setHistoria(e.target.value)} maxLength={1500}
                        placeholder="Quem torra, de onde vem o café, desde quando" />
            </label>
            <div className="sc-campo largo">
              <span>Cor da capa</span>
              <div className="sc-cores" role="radiogroup" aria-label="Cor da capa">
                {CORES.map(c => (
                  <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={c}
                          className={cor === c ? 'on' : ''} style={{ background: c }} onClick={() => setCor(c)} />
                ))}
              </div>
            </div>
          </div>
          <p className="sc-ajuda">Envio de logo e foto de capa entra quando o armazenamento de imagens do vendedor estiver pronto.</p>
          {erro && <p className="sc-erro" role="alert">{erro}</p>}
          <div className="sc-rodape-editor">
            <span className="sc-espaco" />
            <button type="submit" className="sc-botao sc-botao-principal" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar dados'}
            </button>
          </div>
        </form>

        {/* Prévia no mesmo desenho da vitrine: o vendedor vê a loja como o
            comprador vai ver, antes de salvar. */}
        <aside className="sc-cartao sc-previa-loja" aria-label="Prévia">
          <small className="sc-sub">Prévia</small>
          <div className="sc-previa-capa" style={{ background: `linear-gradient(120deg,${cor},#3A2318)` }} />
          <div className="sc-previa-av" style={{ color: cor }}>{iniciais || '—'}</div>
          <b>{nome || 'Nome da loja'}</b>
          <span>{especialidade || [cidade, uf].filter(Boolean).join(' · ') || 'Especialidade'}</span>
          {chamada && <p>{chamada}</p>}
        </aside>
      </div>
    </div>
  );
}
