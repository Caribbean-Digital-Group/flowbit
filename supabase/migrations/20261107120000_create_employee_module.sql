-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Empleados — expediente laboral sobre el modelo de Contactos             ║
-- ║                                                                          ║
-- ║  Un empleado no es una persona nueva: es un `partner` que trabaja para   ║
-- ║  una empresa. Nombre, correo, teléfonos, dirección y RFC siguen viviendo ║
-- ║  en `partner`; aquí solo se guarda lo que depende de la empresa.         ║
-- ║                                                                          ║
-- ║  1. employee_department  — catálogo de departamentos                     ║
-- ║  2. employee             — datos laborales, visibles para el equipo      ║
-- ║  3. employee_private     — datos sensibles, solo owner/admin             ║
-- ║  4. employee_guard       — invariantes entre empresa y contacto          ║
-- ║  5. RLS                                                                  ║
-- ║  6. register_employee()  — alta atómica o reactivación                   ║
-- ║  7. v_employees          — listado con los datos del contacto            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1. employee_department
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.employee_department (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name        VARCHAR(150) NOT NULL,
    parent_id   UUID,
    manager_id  UUID, -- FK a employee, se agrega al crear esa tabla

    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id),
    updated_by  UUID REFERENCES auth.users(id),

    -- Destino de las FK compuestas: garantizan que las referencias no crucen empresas.
    CONSTRAINT employee_department_company_id_key UNIQUE (company_id, id),
    CONSTRAINT employee_department_parent_fk
        FOREIGN KEY (company_id, parent_id)
        REFERENCES public.employee_department(company_id, id)
        ON DELETE SET NULL (parent_id),
    CONSTRAINT employee_department_not_own_parent CHECK (parent_id <> id)
);

COMMENT ON TABLE public.employee_department IS
    'Departamentos de la empresa, jerárquicos por parent_id.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_department_name
    ON public.employee_department(company_id, lower(name))
    WHERE active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_employee_department_company ON public.employee_department(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_department_active  ON public.employee_department(active);

ALTER TABLE public.employee_department ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_employee_department_updated_at ON public.employee_department;
CREATE TRIGGER update_employee_department_updated_at
    BEFORE UPDATE ON public.employee_department
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- 2. employee — datos laborales
--
-- Lo lee todo el equipo, así que aquí no va nada sensible. El motivo de
-- baja, por ejemplo, vive en employee_private.
--
-- `status` es la situación laboral (la persona trabaja o ya no).
-- `active` es el borrado lógico: quita la marca de empleado por completo.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.employee (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    partner_id        UUID NOT NULL REFERENCES public.partner(id) ON DELETE RESTRICT,

    employee_number   VARCHAR(50),
    job_title         VARCHAR(255),
    department_id     UUID,
    manager_id        UUID,
    work_email        VARCHAR(255),
    work_phone        VARCHAR(50),
    work_location     VARCHAR(255),
    hire_date         DATE,
    termination_date  DATE,
    status            VARCHAR(20) NOT NULL DEFAULT 'active',

    active            BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    created_by        UUID REFERENCES auth.users(id),
    updated_by        UUID REFERENCES auth.users(id),

    CONSTRAINT employee_company_partner_key UNIQUE (company_id, partner_id),
    CONSTRAINT employee_company_id_key UNIQUE (company_id, id),
    CONSTRAINT employee_department_fk
        FOREIGN KEY (company_id, department_id)
        REFERENCES public.employee_department(company_id, id)
        ON DELETE SET NULL (department_id),
    CONSTRAINT employee_manager_fk
        FOREIGN KEY (company_id, manager_id)
        REFERENCES public.employee(company_id, id)
        ON DELETE SET NULL (manager_id),
    CONSTRAINT employee_status_check CHECK (status IN ('active', 'terminated')),
    CONSTRAINT employee_not_own_manager CHECK (manager_id <> id),
    CONSTRAINT employee_terminated_has_date
        CHECK (status <> 'terminated' OR termination_date IS NOT NULL),
    CONSTRAINT employee_termination_after_hire
        CHECK (termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date)
);

COMMENT ON TABLE public.employee IS
    'Contacto marcado como empleado de una empresa. Visible para todo el equipo; los datos sensibles van en employee_private.';
COMMENT ON COLUMN public.employee.status IS
    'Situación laboral: active o terminated. No confundir con active, que es el borrado lógico.';

ALTER TABLE public.employee_department
    DROP CONSTRAINT IF EXISTS employee_department_manager_fk;
ALTER TABLE public.employee_department
    ADD CONSTRAINT employee_department_manager_fk
    FOREIGN KEY (company_id, manager_id)
    REFERENCES public.employee(company_id, id)
    ON DELETE SET NULL (manager_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_number
    ON public.employee(company_id, lower(employee_number))
    WHERE employee_number IS NOT NULL AND active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_employee_company    ON public.employee(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_active     ON public.employee(active);
CREATE INDEX IF NOT EXISTS idx_employee_partner    ON public.employee(partner_id);
CREATE INDEX IF NOT EXISTS idx_employee_department ON public.employee(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_manager    ON public.employee(manager_id);

ALTER TABLE public.employee ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_employee_updated_at ON public.employee;
CREATE TRIGGER update_employee_updated_at
    BEFORE UPDATE ON public.employee
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- 3. employee_private — datos sensibles
--
-- Tabla aparte porque RLS filtra por fila y no por columna. Agrupa la
-- información privada, los ajustes de RR. HH. y los datos del CFDI de
-- nómina, y siempre existe una fila por empleado (la crea
-- register_employee).
--
-- birth_date vive aquí y no en partner.birthdate a propósito: partner se
-- puede leer fuera de la empresa y aquí la lectura está restringida.
--
-- Los campos cfdi_* guardan claves de los catálogos del SAT. No llevan
-- CHECK para que un cambio de catálogo no requiera una migración. Las
-- opciones viven en app/utils/employee.ts.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.employee_private (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    employee_id                 UUID NOT NULL,

    -- Información privada
    birth_date                  DATE,
    curp                        VARCHAR(18),
    nss                         VARCHAR(11),
    marital_status              VARCHAR(20),
    gender                      VARCHAR(20),
    nationality                 VARCHAR(100),
    birth_place                 VARCHAR(150),
    dependents_count            INTEGER NOT NULL DEFAULT 0,
    education_level             VARCHAR(20),
    emergency_contact_name      VARCHAR(255),
    emergency_contact_phone     VARCHAR(50),
    bank_name                   VARCHAR(100),
    bank_clabe                  VARCHAR(18),
    bank_account                VARCHAR(30),

    -- Ajustes de RR. HH.
    employee_type               VARCHAR(20) NOT NULL DEFAULT 'employee',
    monthly_salary              DECIMAL(15, 2),
    salary_currency             CHAR(3) NOT NULL DEFAULT 'MXN',
    weekly_hours                DECIMAL(5, 2),
    vacation_days               INTEGER,
    termination_reason          TEXT,
    hr_notes                    TEXT,

    -- CFDI de nómina
    cfdi_tax_regime             VARCHAR(3) DEFAULT '605',
    cfdi_tax_zip                VARCHAR(5),
    cfdi_contract_type          VARCHAR(2),
    cfdi_workday_type           VARCHAR(2),
    cfdi_payroll_regime         VARCHAR(2),
    cfdi_payment_frequency      VARCHAR(2),
    cfdi_job_risk               VARCHAR(2),
    cfdi_unionized              BOOLEAN NOT NULL DEFAULT false,
    cfdi_employer_registration  VARCHAR(20),
    cfdi_contribution_base      DECIMAL(15, 2), -- SBC
    cfdi_integrated_daily_wage  DECIMAL(15, 2), -- SDI
    cfdi_state                  VARCHAR(3),

    active                      BOOLEAN DEFAULT true,
    created_at                  TIMESTAMPTZ DEFAULT now(),
    updated_at                  TIMESTAMPTZ DEFAULT now(),
    created_by                  UUID REFERENCES auth.users(id),
    updated_by                  UUID REFERENCES auth.users(id),

    CONSTRAINT employee_private_employee_key UNIQUE (employee_id),
    CONSTRAINT employee_private_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id)
        ON DELETE CASCADE,

    CONSTRAINT employee_private_curp_format
        CHECK (curp IS NULL OR curp ~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{6}[HMX][A-Z]{5}[A-Z0-9][0-9]$'),
    CONSTRAINT employee_private_nss_format     CHECK (nss IS NULL OR nss ~ '^[0-9]{11}$'),
    CONSTRAINT employee_private_clabe_format   CHECK (bank_clabe IS NULL OR bank_clabe ~ '^[0-9]{18}$'),
    CONSTRAINT employee_private_zip_format     CHECK (cfdi_tax_zip IS NULL OR cfdi_tax_zip ~ '^[0-9]{5}$'),
    CONSTRAINT employee_private_marital_check
        CHECK (marital_status IS NULL OR marital_status IN ('single', 'married', 'free_union', 'divorced', 'widowed')),
    CONSTRAINT employee_private_gender_check
        CHECK (gender IS NULL OR gender IN ('female', 'male', 'other')),
    CONSTRAINT employee_private_education_check
        CHECK (education_level IS NULL OR education_level IN (
            'none', 'primary', 'secondary', 'high_school', 'technical', 'bachelor', 'master', 'doctorate'
        )),
    CONSTRAINT employee_private_type_check
        CHECK (employee_type IN ('employee', 'contractor', 'intern', 'temporary')),
    CONSTRAINT employee_private_amounts_check CHECK (
        dependents_count >= 0
        AND coalesce(monthly_salary, 0) >= 0
        AND coalesce(weekly_hours, 0) BETWEEN 0 AND 168
        AND coalesce(vacation_days, 0) >= 0
        AND coalesce(cfdi_contribution_base, 0) >= 0
        AND coalesce(cfdi_integrated_daily_wage, 0) >= 0
    )
);

COMMENT ON TABLE public.employee_private IS
    'Datos sensibles del empleado: privados, RR. HH. y CFDI de nómina. Solo owner y admin.';

CREATE INDEX IF NOT EXISTS idx_employee_private_company ON public.employee_private(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_private_active  ON public.employee_private(active);

ALTER TABLE public.employee_private ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_employee_private_updated_at ON public.employee_private;
CREATE TRIGGER update_employee_private_updated_at
    BEFORE UPDATE ON public.employee_private
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- 4. employee_guard
--
-- Un admin de una empresa no debe poder apuntar un expediente al contacto
-- de otra empresa, ni convertir en empleado a una persona moral. Empresa y
-- contacto no cambian una vez creado el expediente.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.employee_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.company_id IS DISTINCT FROM OLD.company_id
           OR NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
            RAISE EXCEPTION 'The company and contact of an employee cannot change'
                USING ERRCODE = '22023';
        END IF;
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.rel_partner_company r
        WHERE r.partner_id = NEW.partner_id
          AND r.company_id = NEW.company_id
          AND r.is_active = true
    ) THEN
        RAISE EXCEPTION 'The contact does not belong to this company'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.partner p
        WHERE p.id = NEW.partner_id AND p.company_type = 'company'
    ) THEN
        RAISE EXCEPTION 'Only people can be employees'
            USING ERRCODE = '22023';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.employee_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS employee_guard_trigger ON public.employee;
CREATE TRIGGER employee_guard_trigger
    BEFORE INSERT OR UPDATE ON public.employee
    FOR EACH ROW EXECUTE FUNCTION public.employee_guard();

-- ═══════════════════════════════════════════════════════════════════
-- 5. RLS
--
-- employee y employee_private no tienen política de INSERT: el alta pasa
-- por register_employee para crear ambas filas en la misma transacción.
-- Tampoco hay política de DELETE: el borrado es lógico.
-- ═══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "employee_department_select_company" ON public.employee_department;
CREATE POLICY "employee_department_select_company" ON public.employee_department
    FOR SELECT TO authenticated
    USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "employee_department_admin_insert" ON public.employee_department;
CREATE POLICY "employee_department_admin_insert" ON public.employee_department
    FOR INSERT TO authenticated
    WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS "employee_department_admin_update" ON public.employee_department;
CREATE POLICY "employee_department_admin_update" ON public.employee_department
    FOR UPDATE TO authenticated
    USING (public.is_company_admin(company_id))
    WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS "employee_select_company" ON public.employee;
CREATE POLICY "employee_select_company" ON public.employee
    FOR SELECT TO authenticated
    USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "employee_admin_update" ON public.employee;
CREATE POLICY "employee_admin_update" ON public.employee
    FOR UPDATE TO authenticated
    USING (public.is_company_admin(company_id))
    WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS "employee_private_admin_select" ON public.employee_private;
CREATE POLICY "employee_private_admin_select" ON public.employee_private
    FOR SELECT TO authenticated
    USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS "employee_private_admin_update" ON public.employee_private;
CREATE POLICY "employee_private_admin_update" ON public.employee_private
    FOR UPDATE TO authenticated
    USING (public.is_company_admin(company_id))
    WITH CHECK (public.is_company_admin(company_id));

REVOKE ALL ON public.employee_private FROM anon;

-- ═══════════════════════════════════════════════════════════════════
-- 6. register_employee
--
-- Marca como empleado a un contacto existente (p_partner_id) o crea el
-- contacto en la misma transacción (p_partner). Si el contacto tuvo un
-- expediente archivado lo reactiva, y así conserva su historial.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.register_employee(
    p_company_id  UUID,
    p_partner_id  UUID DEFAULT NULL,
    p_partner     JSONB DEFAULT NULL,
    p_employee    JSONB DEFAULT '{}'::JSONB
)
RETURNS public.employee
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id    UUID := auth.uid();
    v_partner    public.partner;
    v_existing   public.employee;
    v_employee   public.employee;
    v_data       JSONB := coalesce(p_employee, '{}'::JSONB);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can register employees'
            USING ERRCODE = '42501';
    END IF;

    IF p_partner_id IS NOT NULL THEN
        SELECT * INTO v_partner FROM public.partner WHERE id = p_partner_id;
        IF v_partner.id IS NULL THEN
            RAISE EXCEPTION 'Partner not found' USING ERRCODE = 'P0002';
        END IF;
    ELSIF nullif(trim(coalesce(p_partner->>'name', '')), '') IS NOT NULL THEN
        v_partner := public.create_partner_for_company(p_company_id, p_partner);
    ELSE
        RAISE EXCEPTION 'A contact or a name is required' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_existing
    FROM public.employee
    WHERE company_id = p_company_id AND partner_id = v_partner.id;

    IF v_existing.id IS NOT NULL AND v_existing.active IS TRUE THEN
        RAISE EXCEPTION 'This contact is already an employee of the company'
            USING ERRCODE = '23505';
    END IF;

    IF v_existing.id IS NOT NULL THEN
        UPDATE public.employee
        SET active = true,
            status = 'active',
            termination_date = NULL,
            updated_by = v_user_id
        WHERE id = v_existing.id
        RETURNING * INTO v_employee;

        UPDATE public.employee_private
        SET active = true, updated_by = v_user_id
        WHERE employee_id = v_existing.id;

        RETURN v_employee;
    END IF;

    INSERT INTO public.employee (
        company_id, partner_id, employee_number, job_title, department_id, manager_id,
        work_email, work_phone, work_location, hire_date, created_by, updated_by
    )
    VALUES (
        p_company_id,
        v_partner.id,
        nullif(v_data->>'employee_number', ''),
        coalesce(nullif(v_data->>'job_title', ''), v_partner.function),
        nullif(v_data->>'department_id', '')::UUID,
        nullif(v_data->>'manager_id', '')::UUID,
        nullif(v_data->>'work_email', ''),
        nullif(v_data->>'work_phone', ''),
        nullif(v_data->>'work_location', ''),
        nullif(v_data->>'hire_date', '')::DATE,
        v_user_id,
        v_user_id
    )
    RETURNING * INTO v_employee;

    INSERT INTO public.employee_private (company_id, employee_id, created_by, updated_by)
    VALUES (p_company_id, v_employee.id, v_user_id, v_user_id);

    RETURN v_employee;
END;
$$;

REVOKE ALL ON FUNCTION public.register_employee(UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_employee(UUID, UUID, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION public.register_employee IS
    'Da de alta o reactiva un empleado. Solo owner/admin de la empresa.';

-- ═══════════════════════════════════════════════════════════════════
-- 7. v_employees
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_employees
WITH (security_invoker = true) AS
SELECT
    e.*,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS partner_name,
    p.email      AS partner_email,
    p.phone      AS partner_phone,
    p.mobile     AS partner_mobile,
    p.avatar_url AS partner_avatar_url,
    d.name       AS department_name,
    coalesce(nullif(trim(mp.display_name), ''), mp.name) AS manager_name
FROM public.employee e
LEFT JOIN public.partner p              ON p.id = e.partner_id
LEFT JOIN public.employee_department d  ON d.id = e.department_id
LEFT JOIN public.employee m             ON m.id = e.manager_id
LEFT JOIN public.partner mp             ON mp.id = m.partner_id;

REVOKE ALL ON public.v_employees FROM anon;
GRANT SELECT ON public.v_employees TO authenticated;

COMMENT ON VIEW public.v_employees IS
    'Empleados con el nombre y contacto de su partner, departamento y jefe. Aplica el RLS de las tablas base.';
