-- ╔══════════════════════════════════════════════════════════════╗
-- ║  create_expense_tables (TRY-10)                              ║
-- ║  1. expense_category: catálogo de categorías de gasto        ║
-- ║  2. expense: gastos operativos (renta, luz, nómina externa…) ║
-- ║  3. Trigger de integridad multi-tenant y fecha de pago       ║
-- ║  4. RLS: el equipo de la empresa lee y escribe               ║
-- ╚══════════════════════════════════════════════════════════════╝
--
-- Los gastos alimentan el «Estado de resultados» (/admin/reports/profit-loss)
-- junto con los cobros y pagos a proveedores de get_sales_kpis.
-- Regla del reporte (base de caja): solo cuentan los gastos en estado 'paid',
-- en la fecha de pago (paid_at, o expense_date si no se capturó).
-- Documentación: docs/expenses.md

-- ═══════════════════════════════════════════════════════════════════
-- 1. expense_category
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.expense_category (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name        VARCHAR(120) NOT NULL,
    description TEXT,
    color       VARCHAR(20),

    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id),
    updated_by  UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.expense_category IS
    'Catálogo por empresa de categorías de gasto (renta, servicios, publicidad…).';

-- Nombre único entre las categorías activas de la empresa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_category_company_name
    ON public.expense_category(company_id, lower(name))
    WHERE active IS TRUE;

ALTER TABLE public.expense_category ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_expense_category_updated_at ON public.expense_category;
CREATE TRIGGER update_expense_category_updated_at
    BEFORE UPDATE ON public.expense_category
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_expense_category_company ON public.expense_category(company_id);
CREATE INDEX IF NOT EXISTS idx_expense_category_active  ON public.expense_category(active);

-- ═══════════════════════════════════════════════════════════════════
-- 2. expense
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.expense (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    expense_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    description       TEXT NOT NULL CHECK (length(btrim(description)) > 0),
    category_id       UUID REFERENCES public.expense_category(id) ON DELETE SET NULL,
    partner_id        UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    project_id        UUID REFERENCES public.project(id) ON DELETE SET NULL,
    payment_method_id UUID REFERENCES public.payment_method(id) ON DELETE SET NULL,

    -- amount = subtotal sin impuestos; total = amount + tax_amount.
    amount            NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    tax_amount        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    currency          TEXT,
    reference         TEXT,
    notes             TEXT,

    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
    paid_at           DATE,

    active            BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    created_by        UUID REFERENCES auth.users(id),
    updated_by        UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.expense IS
    'Gastos operativos de la empresa. Solo los gastos pagados (status = paid) cuentan en el estado de resultados.';
COMMENT ON COLUMN public.expense.amount IS 'Subtotal sin impuestos.';
COMMENT ON COLUMN public.expense.tax_amount IS 'Impuestos (IVA) del gasto. Total = amount + tax_amount.';
COMMENT ON COLUMN public.expense.reference IS 'Folio, número de factura o comprobante del proveedor.';
COMMENT ON COLUMN public.expense.paid_at IS 'Fecha de pago. Se llena sola con expense_date al marcar el gasto como pagado.';

ALTER TABLE public.expense ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_expense_updated_at ON public.expense;
CREATE TRIGGER update_expense_updated_at
    BEFORE UPDATE ON public.expense
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_expense_company        ON public.expense(company_id);
CREATE INDEX IF NOT EXISTS idx_expense_active         ON public.expense(active);
CREATE INDEX IF NOT EXISTS idx_expense_date           ON public.expense(company_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_category       ON public.expense(category_id);
CREATE INDEX IF NOT EXISTS idx_expense_status         ON public.expense(company_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_partner        ON public.expense(partner_id);
CREATE INDEX IF NOT EXISTS idx_expense_project        ON public.expense(project_id);

CREATE INDEX IF NOT EXISTS idx_expense_search ON public.expense
    USING gin (to_tsvector('spanish', coalesce(description, '') || ' ' || coalesce(reference, '')));

-- ═══════════════════════════════════════════════════════════════════
-- 3. Integridad: las referencias pertenecen a la misma empresa
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.expense_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'No se puede cambiar la empresa de un gasto';
    END IF;

    IF NEW.category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.expense_category c
        WHERE c.id = NEW.category_id AND c.company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'La categoría no pertenece a la empresa';
    END IF;

    IF NEW.project_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.project p
        WHERE p.id = NEW.project_id AND p.company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'El proyecto no pertenece a la empresa';
    END IF;

    IF NEW.payment_method_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.payment_method m
        WHERE m.id = NEW.payment_method_id AND m.company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'El método de pago no pertenece a la empresa';
    END IF;

    IF NEW.partner_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.rel_partner_company r
        WHERE r.partner_id = NEW.partner_id AND r.company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'El proveedor no es un contacto de la empresa';
    END IF;

    -- Fecha de pago: se completa al pagar y se limpia si el gasto deja de estar pagado.
    IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
        NEW.paid_at := NEW.expense_date;
    ELSIF NEW.status <> 'paid' THEN
        NEW.paid_at := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_before_write ON public.expense;
CREATE TRIGGER trg_expense_before_write
    BEFORE INSERT OR UPDATE ON public.expense
    FOR EACH ROW EXECUTE FUNCTION public.expense_before_write();

-- ═══════════════════════════════════════════════════════════════════
-- 4. RLS — el equipo de la empresa (owner/admin/member) lee y escribe.
--    Sin política DELETE: el borrado es lógico (active = false).
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['expense_category', 'expense']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_company', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.user_belongs_to_company(company_id))',
            t || '_select_company', t);

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_company', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_company(company_id))',
            t || '_insert_company', t);

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_company', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
             USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id))',
            t || '_update_company', t);
    END LOOP;
END;
$$;
