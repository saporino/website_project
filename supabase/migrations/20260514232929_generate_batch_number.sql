-- Trigger: gera batch_number no formato {company_code}-{NNN} por torrefadora
-- Ex: 750-001, 750-002 para Cafe Original de Patrocinio (company_code=750)

CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE
  v_code TEXT;
  v_next INT;
BEGIN
  IF NEW.batch_number IS NULL OR btrim(NEW.batch_number) = '' THEN
    SELECT company_code::text INTO v_code
    FROM roasting_companies WHERE id = NEW.roasting_company_id;
    IF v_code IS NULL THEN
      SELECT COALESCE(MAX((split_part(batch_number,'-',2))::int),0)+1 INTO v_next
      FROM product_batches WHERE batch_number ~ '^[0-9]+-[0-9]+$';
      NEW.batch_number := to_char(NOW(),'YYYY') || '-' || LPAD(v_next::text,3,'0');
    ELSE
      SELECT COALESCE(MAX((split_part(batch_number,'-',2))::int),0)+1 INTO v_next
      FROM product_batches
      WHERE roasting_company_id = NEW.roasting_company_id
        AND batch_number ~ ('^'||v_code||'-[0-9]+$');
      NEW.batch_number := v_code || '-' || LPAD(v_next::text,3,'0');
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_gen_batch ON product_batches;
CREATE TRIGGER trg_gen_batch
  BEFORE INSERT ON product_batches
  FOR EACH ROW EXECUTE FUNCTION generate_batch_number();
