-- COFICO Frota + Documentos. Aditivo. Admin-only (RLS is_admin).
-- Veículos (utilitário/VUC/van/toco/truck/carreta/bitrem/moto), manutenção e documentos;
-- documentos do motorista (CNH, exame toxicológico, aptidão, MOPP, etc.).

-- VEÍCULOS
CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  tipo text NOT NULL DEFAULT 'utilitario',   -- utilitario|vuc|van|toco|truck|carreta|bitrem|moto|outro
  placa text,
  renavam text,
  marca text, modelo text, ano int, cor text,
  km_atual numeric,
  crlv_validade date,
  seguradora text, apolice text, seguro_validade date,
  licenciamento_validade date,
  tacografo_validade date,
  antt_rntrc text,
  oleo_ultima_data date, oleo_ultimo_km numeric, oleo_proximo_km numeric,
  status text NOT NULL DEFAULT 'ativo',       -- ativo|manutencao|inativo
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fleet_company ON public.fleet_vehicles(company_id);

-- MANUTENÇÃO (log): troca de óleo, revisão, pneu, etc.
CREATE TABLE IF NOT EXISTS public.fleet_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'revisao',       -- troca_oleo|revisao|pneu|freio|eletrica|outro
  data date, km numeric, custo numeric, obs text,
  doc_path text, doc_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fleet_maint_vehicle ON public.fleet_maintenance(vehicle_id);

-- DOCUMENTOS DO VEÍCULO (arquivos): CRLV, apólice, laudo, etc.
CREATE TABLE IF NOT EXISTS public.fleet_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outro',         -- crlv|seguro|licenciamento|tacografo|antt|laudo|outro
  validade date, doc_path text, doc_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fleet_docs_vehicle ON public.fleet_documents(vehicle_id);

-- DOCUMENTOS DO MOTORISTA (arquivos + validade): CNH, exame toxicológico (obrig. C/D/E),
-- exame médico/aptidão, MOPP (carga perigosa), CPF, comprovante, ANTT, etc.
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outro',         -- cnh|exame_toxicologico|exame_medico|mopp|cpf|comprovante_residencia|antt|outro
  numero text, validade date, doc_path text, doc_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_docs_driver ON public.driver_documents(driver_id);

-- RLS admin-only nas 4
ALTER TABLE public.fleet_vehicles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_maintenance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fleet_v_admin ON public.fleet_vehicles;
CREATE POLICY fleet_v_admin ON public.fleet_vehicles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS fleet_m_admin ON public.fleet_maintenance;
CREATE POLICY fleet_m_admin ON public.fleet_maintenance FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS fleet_d_admin ON public.fleet_documents;
CREATE POLICY fleet_d_admin ON public.fleet_documents FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS driver_d_admin ON public.driver_documents;
CREATE POLICY driver_d_admin ON public.driver_documents FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
