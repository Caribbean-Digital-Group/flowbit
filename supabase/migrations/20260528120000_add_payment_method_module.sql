-- ╔══════════════════════════════════════════════════════════════╗
-- ║  add_payment_method_module                                   ║
-- ║  1. Crea tabla payment_method (catálogo por empresa)         ║
-- ║  2. Agrega payment_method_id y payment_status a la orden     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── 1. payment_method ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_method (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name        VARCHAR(160) NOT NULL,
  code        VARCHAR(64),
  description TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id)
);

ALTER TABLE public.payment_method ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_payment_method_updated_at
  BEFORE UPDATE ON public.payment_method
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_payment_method_company ON public.payment_method(company_id);
CREATE INDEX idx_payment_method_active  ON public.payment_method(active);

CREATE POLICY "payment_method_select_company" ON public.payment_method
  FOR SELECT USING (public.user_belongs_to_company(company_id));

CREATE POLICY "payment_method_admin_all" ON public.payment_method
  FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- ── 2. Nuevas columnas en public.order ─────────────────────────
ALTER TABLE public."order"
  ADD COLUMN IF NOT EXISTS payment_method_id UUID
    REFERENCES public.payment_method(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'condoned', 'overdue'));

-- Migrar is_paid existente al nuevo payment_status
UPDATE public."order"
  SET payment_status = 'paid'
  WHERE is_paid = true AND payment_status = 'unpaid';

CREATE INDEX IF NOT EXISTS idx_order_payment_method ON public."order"(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_order_payment_status ON public."order"(payment_status);
