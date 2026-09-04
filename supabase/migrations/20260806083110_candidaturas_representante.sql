-- Tarefa 2 — candidaturas de representante (formulário público "Seja um Representante").
-- Público INSERE (formulário do site); admin lê/gerencia. Aplicado via exec_migration (05/08/2026).
CREATE TABLE IF NOT EXISTS public.candidaturas_representante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  whatsapp text,
  cidade_regiao text,
  experiencia text,          -- menos de 1 ano | 1 a 3 anos | 3 a 5 anos | mais de 5 anos
  carteira_ativa boolean,
  clientes_aprox text,
  canais text[],             -- Supermercado | Padaria | Food Service | Atacado | Mercearia | Outro
  situacao_cadastral text,   -- CPF com CORE ativo | CNPJ regular
  marcas_atuais text,
  ciente_condicoes boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','aprovado','rejeitado')),
  obs_admin text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cand_rep_status ON public.candidaturas_representante(status, created_at DESC);

ALTER TABLE public.candidaturas_representante ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cand_rep_insert_public ON public.candidaturas_representante;
CREATE POLICY cand_rep_insert_public ON public.candidaturas_representante FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS cand_rep_admin_all ON public.candidaturas_representante;
CREATE POLICY cand_rep_admin_all ON public.candidaturas_representante FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
