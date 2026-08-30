import { defineConfig } from 'vitest/config';

// Fase 0 — fundação mínima de testes. Só lógica pura por enquanto
// (environment 'node', sem jsdom). Testes de integração de banco
// (comissão/estoque/numeração) exigem Postgres efêmero e ficam para um bloco futuro.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
  },
});
