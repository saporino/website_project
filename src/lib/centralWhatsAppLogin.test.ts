import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Guarda de um defeito que custou caro na tela, sem aparecer em nenhum teste:
//
// a central de WhatsApp usava o AuthModal com o contexto padrão, que é o da LOJA. Esse
// contexto derruba administrador de propósito — `supabase.auth.signOut()` — para empurrar
// o botão "Admin". Quem entrava como admin era desconectado no mesmo instante e voltava
// para a tela de login, sem explicação nenhuma.
//
// É uma armadilha para qualquer ferramenta interna que reuse o modal. Estes testes são de
// código-fonte porque o defeito mora na LIGAÇÃO entre dois componentes, não dentro de um.

const ler = (p: string) => readFileSync(resolve(p), 'utf8');

describe('login da central de WhatsApp', () => {
  it('a central NÃO usa o login da loja', () => {
    const central = ler('src/pages/CentralWhatsApp.tsx');
    // Nada de `[^>]*` aqui: a seta de `() => setLogin(false)` tem um '>' e cortaria a busca.
    expect(central).toContain('<AuthModal');
    expect(central).toContain('loginContext="central"');
  });

  it('o contexto "central" existe e não derruba administrador', () => {
    const modal = ler('src/components/AuthModal.tsx');
    expect(modal).toContain("'central'");
    const i = modal.indexOf('const handleCentralLogin');
    expect(i, 'handleCentralLogin não existe').toBeGreaterThan(0);
    const corpo = modal.slice(i, modal.indexOf('const handleRepLogin'));
    expect(corpo, 'o login da central não pode desconectar ninguém').not.toContain('signOut');
    expect(corpo, 'o login da central não pode redirecionar').not.toContain('pushState');
    expect(corpo).toContain('onClose()');
  });

  it('o login da LOJA continua derrubando admin, como é a regra de lá', () => {
    // Não é defeito: a loja empurra o admin para o botão próprio. O que era defeito
    // é uma ferramenta interna herdar essa regra sem querer.
    const modal = ler('src/components/AuthModal.tsx');
    const i = modal.indexOf('const handleLoginSubmit');
    const corpo = modal.slice(i, modal.indexOf('const handleAdminLogin'));
    expect(corpo).toContain('signOut');
  });
});
