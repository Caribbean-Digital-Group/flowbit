-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Recursos Humanos — asistencia, ausencias, salarios y nómina             ║
-- ║                                                                          ║
-- ║  Complementa el módulo de Empleados (20261107120000). Todas las tablas   ║
-- ║  referencian `employee` con FK compuesta (company_id, employee_id) para  ║
-- ║  que ninguna fila cruce empresas.                                        ║
-- ║                                                                          ║
-- ║  Acceso:                                                                 ║
-- ║  - Catálogos (horarios, festivos, tipos de ausencia): todo el equipo.    ║
-- ║  - Asistencia, ausencias, solicitudes y saldos: owner/admin, y cada      ║
-- ║    persona los suyos (partner.user_id = auth.uid()).                     ║
-- ║  - Salarios, kioscos y configuración fiscal: solo owner/admin.           ║
-- ║  - Recibos de nómina: owner/admin, y cada persona los suyos una vez      ║
-- ║    aprobada la nómina.                                                   ║
-- ║                                                                          ║
-- ║   1. Helpers                                                             ║
-- ║   2. hr_settings                — ajustes de RR. HH. por empresa         ║
-- ║   3. hr_work_schedule(_line)    — horarios de trabajo                    ║
-- ║   4. hr_holiday                 — días de descanso obligatorio           ║
-- ║   5. hr_attendance / _day       — marcas y resumen diario                ║
-- ║   6. hr_kiosk / pin / attempt   — kiosco de entrada y salida             ║
-- ║   7. hr_leave_type / allocation / request — vacaciones y permisos        ║
-- ║   8. hr_absence                 — inasistencias                          ║
-- ║   9. hr_salary                  — historial de salarios                  ║
-- ║  10. payroll_*                  — configuración fiscal y periodos        ║
-- ║  11. Vistas                                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1. Helpers
-- ═══════════════════════════════════════════════════════════════════

-- ¿El empleado es la persona que tiene la sesión iniciada?
CREATE OR REPLACE FUNCTION public.hr_is_own_employee(p_employee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.employee e
        JOIN public.partner p ON p.id = e.partner_id
        WHERE e.id = p_employee_id
          AND e.active IS TRUE
          AND auth.uid() IS NOT NULL
          AND p.user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.hr_is_own_employee(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_is_own_employee(UUID) TO authenticated;

-- Días de vacaciones por años cumplidos (art. 76 LFT, reforma 2023).
CREATE OR REPLACE FUNCTION public.hr_lft_vacation_days(p_years INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_years < 1 THEN 0
        WHEN p_years <= 5 THEN 10 + p_years * 2
        ELSE 22 + ((p_years - 6) / 5) * 2
    END;
$$;

CREATE OR REPLACE FUNCTION public.hr_sha256(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT encode(sha256(convert_to(p_value, 'UTF8')), 'hex');
$$;

REVOKE ALL ON FUNCTION public.hr_sha256(TEXT) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 2. hr_settings — una fila por empresa
--
-- pin_salt se combina con el NIP del kiosco antes de hashearlo. Nunca se
-- expone: la tabla solo la leen owner/admin y el NIP se valida en el RPC.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hr_settings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    timezone                    VARCHAR(64) NOT NULL DEFAULT 'America/Mexico_City',
    late_tolerance_minutes      INTEGER NOT NULL DEFAULT 10,
    overtime_min_minutes        INTEGER NOT NULL DEFAULT 30,
    overtime_requires_approval  BOOLEAN NOT NULL DEFAULT true,
    kiosk_pin_min_length        INTEGER NOT NULL DEFAULT 4,
    payroll_frequency           VARCHAR(20) NOT NULL DEFAULT 'biweekly',
    pin_salt                    TEXT NOT NULL DEFAULT replace(gen_random_uuid()::TEXT, '-', ''),

    active                      BOOLEAN DEFAULT true,
    created_at                  TIMESTAMPTZ DEFAULT now(),
    updated_at                  TIMESTAMPTZ DEFAULT now(),
    created_by                  UUID REFERENCES auth.users(id),
    updated_by                  UUID REFERENCES auth.users(id),

    CONSTRAINT hr_settings_company_key UNIQUE (company_id),
    CONSTRAINT hr_settings_ranges CHECK (
        late_tolerance_minutes BETWEEN 0 AND 240
        AND overtime_min_minutes BETWEEN 0 AND 240
        AND kiosk_pin_min_length BETWEEN 4 AND 8
    ),
    CONSTRAINT hr_settings_frequency_check CHECK (payroll_frequency IN ('weekly', 'biweekly', 'monthly'))
);

COMMENT ON TABLE public.hr_settings IS 'Ajustes de RR. HH. por empresa: zona horaria, tolerancias, horas extra y kiosco.';

CREATE INDEX IF NOT EXISTS idx_hr_settings_active ON public.hr_settings(active);
ALTER TABLE public.hr_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_settings_updated_at ON public.hr_settings;
CREATE TRIGGER update_hr_settings_updated_at
    BEFORE UPDATE ON public.hr_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- El salt no se edita desde la app: cambiarlo invalidaría todos los NIP.
CREATE OR REPLACE FUNCTION public.hr_settings_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.pin_salt IS DISTINCT FROM OLD.pin_salt OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'pin_salt and company_id cannot change' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hr_settings_guard_trigger ON public.hr_settings;
CREATE TRIGGER hr_settings_guard_trigger
    BEFORE UPDATE ON public.hr_settings
    FOR EACH ROW EXECUTE FUNCTION public.hr_settings_guard();

-- Devuelve los ajustes de la empresa y los crea si no existen.
CREATE OR REPLACE FUNCTION public.hr_settings_for(p_company_id UUID)
RETURNS public.hr_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings public.hr_settings;
BEGIN
    SELECT * INTO v_settings FROM public.hr_settings WHERE company_id = p_company_id;
    IF v_settings.id IS NULL THEN
        INSERT INTO public.hr_settings (company_id)
        VALUES (p_company_id)
        ON CONFLICT (company_id) DO NOTHING;
        SELECT * INTO v_settings FROM public.hr_settings WHERE company_id = p_company_id;
    END IF;
    RETURN v_settings;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_settings_for(UUID) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Horarios de trabajo
--
-- Un horario tiene una línea por día laborable (0 = domingo … 6 = sábado).
-- Un día sin línea es de descanso. Los turnos no cruzan la medianoche.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hr_work_schedule (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id               UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name                     VARCHAR(150) NOT NULL,
    description              TEXT,
    late_tolerance_minutes   INTEGER,

    active                   BOOLEAN DEFAULT true,
    created_at               TIMESTAMPTZ DEFAULT now(),
    updated_at               TIMESTAMPTZ DEFAULT now(),
    created_by               UUID REFERENCES auth.users(id),
    updated_by               UUID REFERENCES auth.users(id),

    CONSTRAINT hr_work_schedule_company_id_key UNIQUE (company_id, id),
    CONSTRAINT hr_work_schedule_tolerance CHECK (late_tolerance_minutes IS NULL OR late_tolerance_minutes BETWEEN 0 AND 240)
);

COMMENT ON TABLE public.hr_work_schedule IS 'Horarios de trabajo. late_tolerance_minutes sustituye la tolerancia de hr_settings si se indica.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_work_schedule_name
    ON public.hr_work_schedule(company_id, lower(name)) WHERE active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_hr_work_schedule_company ON public.hr_work_schedule(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_work_schedule_active  ON public.hr_work_schedule(active);

ALTER TABLE public.hr_work_schedule ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_work_schedule_updated_at ON public.hr_work_schedule;
CREATE TRIGGER update_hr_work_schedule_updated_at
    BEFORE UPDATE ON public.hr_work_schedule
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.hr_work_schedule_line (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    schedule_id    UUID NOT NULL,

    weekday        SMALLINT NOT NULL,
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    break_minutes  INTEGER NOT NULL DEFAULT 0,

    active         BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),
    created_by     UUID REFERENCES auth.users(id),
    updated_by     UUID REFERENCES auth.users(id),

    CONSTRAINT hr_work_schedule_line_schedule_fk
        FOREIGN KEY (company_id, schedule_id)
        REFERENCES public.hr_work_schedule(company_id, id) ON DELETE CASCADE,
    CONSTRAINT hr_work_schedule_line_day_key UNIQUE (schedule_id, weekday),
    CONSTRAINT hr_work_schedule_line_weekday CHECK (weekday BETWEEN 0 AND 6),
    CONSTRAINT hr_work_schedule_line_times CHECK (end_time > start_time),
    CONSTRAINT hr_work_schedule_line_break CHECK (
        break_minutes >= 0
        AND break_minutes < EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    )
);

COMMENT ON TABLE public.hr_work_schedule_line IS 'Jornada de un día de la semana dentro de un horario (0 = domingo).';

CREATE INDEX IF NOT EXISTS idx_hr_work_schedule_line_company  ON public.hr_work_schedule_line(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_work_schedule_line_schedule ON public.hr_work_schedule_line(schedule_id);
CREATE INDEX IF NOT EXISTS idx_hr_work_schedule_line_active   ON public.hr_work_schedule_line(active);

ALTER TABLE public.hr_work_schedule_line ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_work_schedule_line_updated_at ON public.hr_work_schedule_line;
CREATE TRIGGER update_hr_work_schedule_line_updated_at
    BEFORE UPDATE ON public.hr_work_schedule_line
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Horario asignado al empleado. Es dato laboral: lo ve el equipo.
ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS work_schedule_id UUID;
ALTER TABLE public.employee DROP CONSTRAINT IF EXISTS employee_work_schedule_fk;
ALTER TABLE public.employee
    ADD CONSTRAINT employee_work_schedule_fk
    FOREIGN KEY (company_id, work_schedule_id)
    REFERENCES public.hr_work_schedule(company_id, id)
    ON DELETE SET NULL (work_schedule_id);
CREATE INDEX IF NOT EXISTS idx_employee_work_schedule ON public.employee(work_schedule_id);

-- Guarda el horario y reemplaza sus líneas en una sola transacción.
CREATE OR REPLACE FUNCTION public.hr_save_work_schedule(
    p_company_id   UUID,
    p_schedule_id  UUID,
    p_schedule     JSONB,
    p_lines        JSONB
)
RETURNS public.hr_work_schedule
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id   UUID := auth.uid();
    v_schedule  public.hr_work_schedule;
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can manage schedules' USING ERRCODE = '42501';
    END IF;
    IF nullif(trim(coalesce(p_schedule->>'name', '')), '') IS NULL THEN
        RAISE EXCEPTION 'A schedule name is required' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(coalesce(p_lines, '[]'::JSONB)) <> 'array' THEN
        RAISE EXCEPTION 'Lines must be an array' USING ERRCODE = '22023';
    END IF;

    IF p_schedule_id IS NULL THEN
        INSERT INTO public.hr_work_schedule (company_id, name, description, late_tolerance_minutes, created_by, updated_by)
        VALUES (
            p_company_id,
            trim(p_schedule->>'name'),
            nullif(trim(coalesce(p_schedule->>'description', '')), ''),
            nullif(p_schedule->>'late_tolerance_minutes', '')::INTEGER,
            v_user_id, v_user_id
        )
        RETURNING * INTO v_schedule;
    ELSE
        UPDATE public.hr_work_schedule
        SET name = trim(p_schedule->>'name'),
            description = nullif(trim(coalesce(p_schedule->>'description', '')), ''),
            late_tolerance_minutes = nullif(p_schedule->>'late_tolerance_minutes', '')::INTEGER,
            updated_by = v_user_id
        WHERE id = p_schedule_id AND company_id = p_company_id
        RETURNING * INTO v_schedule;

        IF v_schedule.id IS NULL THEN
            RAISE EXCEPTION 'Schedule not found' USING ERRCODE = 'P0002';
        END IF;

        DELETE FROM public.hr_work_schedule_line WHERE schedule_id = v_schedule.id;
    END IF;

    INSERT INTO public.hr_work_schedule_line (
        company_id, schedule_id, weekday, start_time, end_time, break_minutes, created_by, updated_by
    )
    SELECT p_company_id, v_schedule.id, l.weekday, l.start_time, l.end_time, coalesce(l.break_minutes, 0), v_user_id, v_user_id
    FROM jsonb_to_recordset(coalesce(p_lines, '[]'::JSONB))
        AS l(weekday SMALLINT, start_time TIME, end_time TIME, break_minutes INTEGER);

    RETURN v_schedule;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_save_work_schedule(UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_save_work_schedule(UUID, UUID, JSONB, JSONB) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 4. hr_holiday — días de descanso obligatorio (art. 74 LFT) y propios
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hr_holiday (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    holiday_date  DATE NOT NULL,
    name          VARCHAR(150) NOT NULL,
    is_statutory  BOOLEAN NOT NULL DEFAULT false,

    active        BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    created_by    UUID REFERENCES auth.users(id),
    updated_by    UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.hr_holiday IS 'Días no laborables. No generan inasistencias. is_statutory marca los del art. 74 LFT.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_holiday_date
    ON public.hr_holiday(company_id, holiday_date) WHERE active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_hr_holiday_company ON public.hr_holiday(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_holiday_active  ON public.hr_holiday(active);

ALTER TABLE public.hr_holiday ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_holiday_updated_at ON public.hr_holiday;
CREATE TRIGGER update_hr_holiday_updated_at
    BEFORE UPDATE ON public.hr_holiday
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- 5. Asistencia
--
-- hr_attendance guarda cada par entrada/salida. Puede haber varios por día
-- (por ejemplo, salida a comer). hr_attendance_day es el resumen del día y
-- lo mantiene la base: no se escribe desde la app, salvo la aprobación de
-- horas extra por el RPC hr_review_overtime.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hr_kiosk (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name          VARCHAR(150) NOT NULL,
    location      VARCHAR(255),
    token_hash    TEXT NOT NULL,
    last_used_at  TIMESTAMPTZ,

    active        BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    created_by    UUID REFERENCES auth.users(id),
    updated_by    UUID REFERENCES auth.users(id),

    CONSTRAINT hr_kiosk_token_key UNIQUE (token_hash),
    CONSTRAINT hr_kiosk_company_id_key UNIQUE (company_id, id)
);

COMMENT ON TABLE public.hr_kiosk IS 'Dispositivos de marcaje. Se guarda solo el hash del token de la URL.';

CREATE INDEX IF NOT EXISTS idx_hr_kiosk_company ON public.hr_kiosk(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_kiosk_active  ON public.hr_kiosk(active);

ALTER TABLE public.hr_kiosk ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_kiosk_updated_at ON public.hr_kiosk;
CREATE TRIGGER update_hr_kiosk_updated_at
    BEFORE UPDATE ON public.hr_kiosk
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.hr_attendance (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    employee_id        UUID NOT NULL,

    work_date          DATE NOT NULL,
    check_in           TIMESTAMPTZ NOT NULL,
    check_out          TIMESTAMPTZ,
    worked_minutes     INTEGER NOT NULL DEFAULT 0,
    source             VARCHAR(20) NOT NULL DEFAULT 'manual',
    kiosk_id           UUID,
    missing_check_out  BOOLEAN NOT NULL DEFAULT false,
    notes              TEXT,

    active             BOOLEAN DEFAULT true,
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now(),
    created_by         UUID REFERENCES auth.users(id),
    updated_by         UUID REFERENCES auth.users(id),

    CONSTRAINT hr_attendance_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id) ON DELETE CASCADE,
    CONSTRAINT hr_attendance_kiosk_fk
        FOREIGN KEY (company_id, kiosk_id)
        REFERENCES public.hr_kiosk(company_id, id) ON DELETE SET NULL (kiosk_id),
    CONSTRAINT hr_attendance_source_check CHECK (source IN ('kiosk', 'manual')),
    CONSTRAINT hr_attendance_times CHECK (check_out IS NULL OR check_out >= check_in),
    CONSTRAINT hr_attendance_max_length CHECK (check_out IS NULL OR check_out - check_in <= INTERVAL '24 hours')
);

COMMENT ON TABLE public.hr_attendance IS 'Marcas de entrada y salida. work_date y worked_minutes los calcula un trigger.';

-- Solo una entrada abierta por persona.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_attendance_open
    ON public.hr_attendance(employee_id) WHERE check_out IS NULL AND active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_hr_attendance_company  ON public.hr_attendance(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_active   ON public.hr_attendance(active);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee ON public.hr_attendance(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_date     ON public.hr_attendance(company_id, work_date);

ALTER TABLE public.hr_attendance ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_attendance_updated_at ON public.hr_attendance;
CREATE TRIGGER update_hr_attendance_updated_at
    BEFORE UPDATE ON public.hr_attendance
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.hr_attendance_day (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                 UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    employee_id                UUID NOT NULL,

    work_date                  DATE NOT NULL,
    first_check_in             TIMESTAMPTZ,
    last_check_out             TIMESTAMPTZ,
    punches                    INTEGER NOT NULL DEFAULT 0,
    is_open                    BOOLEAN NOT NULL DEFAULT false,
    scheduled_minutes          INTEGER NOT NULL DEFAULT 0,
    worked_minutes             INTEGER NOT NULL DEFAULT 0,
    late_minutes               INTEGER NOT NULL DEFAULT 0,
    overtime_minutes           INTEGER NOT NULL DEFAULT 0,
    overtime_status            VARCHAR(20) NOT NULL DEFAULT 'none',
    overtime_approved_minutes  INTEGER NOT NULL DEFAULT 0,
    is_rest_day                BOOLEAN NOT NULL DEFAULT false,
    is_holiday                 BOOLEAN NOT NULL DEFAULT false,
    missing_check_out          BOOLEAN NOT NULL DEFAULT false,

    active                     BOOLEAN DEFAULT true,
    created_at                 TIMESTAMPTZ DEFAULT now(),
    updated_at                 TIMESTAMPTZ DEFAULT now(),
    created_by                 UUID REFERENCES auth.users(id),
    updated_by                 UUID REFERENCES auth.users(id),

    CONSTRAINT hr_attendance_day_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id) ON DELETE CASCADE,
    CONSTRAINT hr_attendance_day_key UNIQUE (employee_id, work_date),
    CONSTRAINT hr_attendance_day_overtime_status CHECK (overtime_status IN ('none', 'pending', 'approved', 'rejected')),
    CONSTRAINT hr_attendance_day_overtime_range CHECK (overtime_approved_minutes BETWEEN 0 AND overtime_minutes)
);

COMMENT ON TABLE public.hr_attendance_day IS 'Resumen diario de asistencia por persona. Lo mantiene hr_recompute_attendance_day.';

CREATE INDEX IF NOT EXISTS idx_hr_attendance_day_company ON public.hr_attendance_day(company_id, work_date);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_day_active  ON public.hr_attendance_day(active);

ALTER TABLE public.hr_attendance_day ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_attendance_day_updated_at ON public.hr_attendance_day;
CREATE TRIGGER update_hr_attendance_day_updated_at
    BEFORE UPDATE ON public.hr_attendance_day
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recalcula el resumen de un día a partir de sus marcas activas.
CREATE OR REPLACE FUNCTION public.hr_recompute_attendance_day(p_employee_id UUID, p_work_date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_employee   public.employee;
    v_settings   public.hr_settings;
    v_tolerance  INTEGER;
    v_line       public.hr_work_schedule_line;
    v_first      TIMESTAMPTZ;
    v_last       TIMESTAMPTZ;
    v_punches    INTEGER;
    v_gross      INTEGER;
    v_gaps       INTEGER;
    v_open       BOOLEAN;
    v_missing    BOOLEAN;
    v_scheduled  INTEGER := 0;
    v_worked     INTEGER;
    v_late       INTEGER := 0;
    v_overtime   INTEGER := 0;
    v_rest       BOOLEAN := false;
    v_holiday    BOOLEAN;
    v_status     VARCHAR(20);
    v_minutes    INTEGER;
BEGIN
    SELECT * INTO v_employee FROM public.employee WHERE id = p_employee_id;
    IF v_employee.id IS NULL THEN
        RETURN;
    END IF;

    SELECT min(check_in),
           max(check_out),
           count(*)::INTEGER,
           coalesce(sum(worked_minutes), 0)::INTEGER,
           bool_or(check_out IS NULL),
           bool_or(missing_check_out)
    INTO v_first, v_last, v_punches, v_gross, v_open, v_missing
    FROM public.hr_attendance
    WHERE employee_id = p_employee_id AND work_date = p_work_date AND active IS TRUE;

    IF v_punches = 0 THEN
        DELETE FROM public.hr_attendance_day WHERE employee_id = p_employee_id AND work_date = p_work_date;
        RETURN;
    END IF;

    v_settings := public.hr_settings_for(v_employee.company_id);

    -- Minutos entre la salida de una marca y la entrada de la siguiente.
    SELECT coalesce(sum(GREATEST(0, EXTRACT(EPOCH FROM (check_in - prev_out)) / 60)), 0)::INTEGER
    INTO v_gaps
    FROM (
        SELECT check_in, lag(check_out) OVER (ORDER BY check_in) AS prev_out
        FROM public.hr_attendance
        WHERE employee_id = p_employee_id AND work_date = p_work_date AND active IS TRUE
    ) t
    WHERE prev_out IS NOT NULL;

    IF v_employee.work_schedule_id IS NOT NULL THEN
        SELECT l.* INTO v_line
        FROM public.hr_work_schedule_line l
        JOIN public.hr_work_schedule s ON s.id = l.schedule_id AND s.active IS TRUE
        WHERE l.schedule_id = v_employee.work_schedule_id
          AND l.weekday = EXTRACT(DOW FROM p_work_date)::SMALLINT
          AND l.active IS TRUE;

        SELECT coalesce(s.late_tolerance_minutes, v_settings.late_tolerance_minutes)
        INTO v_tolerance
        FROM public.hr_work_schedule s WHERE s.id = v_employee.work_schedule_id;

        v_rest := v_line.id IS NULL;
    END IF;

    v_worked := v_gross;
    IF v_line.id IS NOT NULL THEN
        v_scheduled := (EXTRACT(EPOCH FROM (v_line.end_time - v_line.start_time)) / 60)::INTEGER - v_line.break_minutes;
        -- La comida se descuenta salvo la parte que ya cubren las salidas registradas.
        v_worked := GREATEST(0, v_gross - GREATEST(0, v_line.break_minutes - v_gaps));

        v_minutes := (EXTRACT(EPOCH FROM ((v_first AT TIME ZONE v_settings.timezone)::TIME - v_line.start_time)) / 60)::INTEGER;
        IF v_minutes > coalesce(v_tolerance, 0) THEN
            v_late := v_minutes;
        END IF;

        IF NOT v_open THEN
            v_overtime := GREATEST(0, v_worked - v_scheduled);
            IF v_overtime < v_settings.overtime_min_minutes THEN
                v_overtime := 0;
            END IF;
        END IF;
    END IF;

    v_holiday := EXISTS (
        SELECT 1 FROM public.hr_holiday h
        WHERE h.company_id = v_employee.company_id AND h.holiday_date = p_work_date AND h.active IS TRUE
    );

    v_status := CASE
        WHEN v_overtime = 0 THEN 'none'
        WHEN v_settings.overtime_requires_approval THEN 'pending'
        ELSE 'approved'
    END;

    INSERT INTO public.hr_attendance_day AS d (
        company_id, employee_id, work_date, first_check_in, last_check_out, punches, is_open,
        scheduled_minutes, worked_minutes, late_minutes, overtime_minutes, overtime_status,
        overtime_approved_minutes, is_rest_day, is_holiday, missing_check_out
    )
    VALUES (
        v_employee.company_id, p_employee_id, p_work_date, v_first, v_last, v_punches, v_open,
        v_scheduled, v_worked, v_late, v_overtime, v_status,
        CASE WHEN v_status = 'approved' THEN v_overtime ELSE 0 END,
        v_rest, v_holiday, coalesce(v_missing, false)
    )
    ON CONFLICT (employee_id, work_date) DO UPDATE
    SET first_check_in = EXCLUDED.first_check_in,
        last_check_out = EXCLUDED.last_check_out,
        punches = EXCLUDED.punches,
        is_open = EXCLUDED.is_open,
        scheduled_minutes = EXCLUDED.scheduled_minutes,
        worked_minutes = EXCLUDED.worked_minutes,
        late_minutes = EXCLUDED.late_minutes,
        is_rest_day = EXCLUDED.is_rest_day,
        is_holiday = EXCLUDED.is_holiday,
        missing_check_out = EXCLUDED.missing_check_out,
        overtime_minutes = EXCLUDED.overtime_minutes,
        -- Una revisión previa se respeta mientras las horas extra no cambien.
        overtime_status = CASE
            WHEN d.overtime_minutes = EXCLUDED.overtime_minutes AND d.overtime_status IN ('approved', 'rejected')
                THEN d.overtime_status
            ELSE EXCLUDED.overtime_status
        END,
        overtime_approved_minutes = CASE
            WHEN d.overtime_minutes = EXCLUDED.overtime_minutes AND d.overtime_status IN ('approved', 'rejected')
                THEN d.overtime_approved_minutes
            ELSE EXCLUDED.overtime_approved_minutes
        END;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_recompute_attendance_day(UUID, DATE) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hr_attendance_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tz TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id) THEN
        RAISE EXCEPTION 'The company and employee of an attendance cannot change' USING ERRCODE = '22023';
    END IF;

    v_tz := (public.hr_settings_for(NEW.company_id)).timezone;
    NEW.work_date := (NEW.check_in AT TIME ZONE v_tz)::DATE;
    NEW.worked_minutes := CASE
        WHEN NEW.check_out IS NULL THEN 0
        ELSE (EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 60)::INTEGER
    END;
    IF NEW.check_out IS NOT NULL AND NEW.check_out > NEW.check_in THEN
        NEW.missing_check_out := false;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_attendance_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hr_attendance_before_write_trigger ON public.hr_attendance;
CREATE TRIGGER hr_attendance_before_write_trigger
    BEFORE INSERT OR UPDATE ON public.hr_attendance
    FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_before_write();

CREATE OR REPLACE FUNCTION public.hr_attendance_after_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM public.hr_recompute_attendance_day(NEW.employee_id, NEW.work_date);
    END IF;
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.work_date IS DISTINCT FROM NEW.work_date) THEN
        PERFORM public.hr_recompute_attendance_day(OLD.employee_id, OLD.work_date);
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_attendance_after_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hr_attendance_after_write_trigger ON public.hr_attendance;
CREATE TRIGGER hr_attendance_after_write_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.hr_attendance
    FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_after_write();

-- Aprueba o rechaza las horas extra de un día.
CREATE OR REPLACE FUNCTION public.hr_review_overtime(
    p_day_id    UUID,
    p_approve   BOOLEAN,
    p_minutes   INTEGER DEFAULT NULL
)
RETURNS public.hr_attendance_day
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day public.hr_attendance_day;
BEGIN
    SELECT * INTO v_day FROM public.hr_attendance_day WHERE id = p_day_id;
    IF v_day.id IS NULL THEN
        RAISE EXCEPTION 'Attendance day not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT public.is_company_admin(v_day.company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can review overtime' USING ERRCODE = '42501';
    END IF;
    IF v_day.overtime_minutes = 0 THEN
        RAISE EXCEPTION 'This day has no overtime' USING ERRCODE = '22023';
    END IF;

    UPDATE public.hr_attendance_day
    SET overtime_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        overtime_approved_minutes = CASE
            WHEN p_approve THEN LEAST(v_day.overtime_minutes, GREATEST(0, coalesce(p_minutes, v_day.overtime_minutes)))
            ELSE 0
        END,
        updated_by = auth.uid()
    WHERE id = p_day_id
    RETURNING * INTO v_day;

    RETURN v_day;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_review_overtime(UUID, BOOLEAN, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_review_overtime(UUID, BOOLEAN, INTEGER) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Kiosco
--
-- El kiosco es una página pública (/kiosk/{token}). El token tiene 256 bits
-- y solo se guarda su hash. Cada empleado marca con un NIP numérico que se
-- guarda como sha256(salt de la empresa || NIP): nunca en claro y nunca
-- legible desde la app (hr_kiosk_pin no tiene políticas).
--
-- Tras 5 NIP incorrectos en 5 minutos el kiosco se bloquea 5 minutos.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hr_kiosk_pin (
    employee_id  UUID PRIMARY KEY,
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    pin_hash     TEXT NOT NULL,

    active       BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    created_by   UUID REFERENCES auth.users(id),
    updated_by   UUID REFERENCES auth.users(id),

    CONSTRAINT hr_kiosk_pin_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id) ON DELETE CASCADE,
    CONSTRAINT hr_kiosk_pin_unique UNIQUE (company_id, pin_hash)
);

COMMENT ON TABLE public.hr_kiosk_pin IS 'NIP del kiosco (hash). Sin políticas RLS: solo lo tocan los RPC.';

CREATE INDEX IF NOT EXISTS idx_hr_kiosk_pin_active ON public.hr_kiosk_pin(active);
ALTER TABLE public.hr_kiosk_pin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_kiosk_pin FROM anon, authenticated;

DROP TRIGGER IF EXISTS update_hr_kiosk_pin_updated_at ON public.hr_kiosk_pin;
CREATE TRIGGER update_hr_kiosk_pin_updated_at
    BEFORE UPDATE ON public.hr_kiosk_pin
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bitácora de intentos para el bloqueo. Sin auditoría de usuario: la escribe
-- el kiosco sin sesión.
CREATE TABLE IF NOT EXISTS public.hr_kiosk_attempt (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    kiosk_id    UUID NOT NULL,
    success     BOOLEAN NOT NULL,

    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id),
    updated_by  UUID REFERENCES auth.users(id),

    CONSTRAINT hr_kiosk_attempt_kiosk_fk
        FOREIGN KEY (company_id, kiosk_id)
        REFERENCES public.hr_kiosk(company_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hr_kiosk_attempt_kiosk ON public.hr_kiosk_attempt(kiosk_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hr_kiosk_attempt_company ON public.hr_kiosk_attempt(company_id);
ALTER TABLE public.hr_kiosk_attempt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_kiosk_attempt FROM anon, authenticated;

DROP TRIGGER IF EXISTS update_hr_kiosk_attempt_updated_at ON public.hr_kiosk_attempt;
CREATE TRIGGER update_hr_kiosk_attempt_updated_at
    BEFORE UPDATE ON public.hr_kiosk_attempt
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.hr_new_kiosk_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
    SELECT replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '');
$$;

REVOKE ALL ON FUNCTION public.hr_new_kiosk_token() FROM PUBLIC, anon, authenticated;

-- Crea un kiosco y devuelve el token en claro una sola vez.
CREATE OR REPLACE FUNCTION public.hr_create_kiosk(p_company_id UUID, p_name TEXT, p_location TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token  TEXT := public.hr_new_kiosk_token();
    v_kiosk  public.hr_kiosk;
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can manage kiosks' USING ERRCODE = '42501';
    END IF;
    IF nullif(trim(coalesce(p_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'A kiosk name is required' USING ERRCODE = '22023';
    END IF;

    PERFORM public.hr_settings_for(p_company_id);

    INSERT INTO public.hr_kiosk (company_id, name, location, token_hash, created_by, updated_by)
    VALUES (p_company_id, trim(p_name), nullif(trim(coalesce(p_location, '')), ''), public.hr_sha256(v_token), auth.uid(), auth.uid())
    RETURNING * INTO v_kiosk;

    RETURN jsonb_build_object('id', v_kiosk.id, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.hr_create_kiosk(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_create_kiosk(UUID, TEXT, TEXT) TO authenticated;

-- Invalida la URL anterior y devuelve un token nuevo.
CREATE OR REPLACE FUNCTION public.hr_regenerate_kiosk_token(p_kiosk_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token  TEXT := public.hr_new_kiosk_token();
    v_kiosk  public.hr_kiosk;
BEGIN
    SELECT * INTO v_kiosk FROM public.hr_kiosk WHERE id = p_kiosk_id;
    IF v_kiosk.id IS NULL OR NOT public.is_company_admin(v_kiosk.company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can manage kiosks' USING ERRCODE = '42501';
    END IF;

    UPDATE public.hr_kiosk
    SET token_hash = public.hr_sha256(v_token), updated_by = auth.uid()
    WHERE id = p_kiosk_id;

    RETURN jsonb_build_object('id', v_kiosk.id, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.hr_regenerate_kiosk_token(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_regenerate_kiosk_token(UUID) TO authenticated;

-- Asigna o cambia el NIP de un empleado. NULL lo elimina.
CREATE OR REPLACE FUNCTION public.hr_set_kiosk_pin(p_employee_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_employee  public.employee;
    v_settings  public.hr_settings;
BEGIN
    SELECT * INTO v_employee FROM public.employee WHERE id = p_employee_id AND active IS TRUE;
    IF v_employee.id IS NULL OR NOT public.is_company_admin(v_employee.company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can manage kiosk PINs' USING ERRCODE = '42501';
    END IF;

    IF p_pin IS NULL OR p_pin = '' THEN
        DELETE FROM public.hr_kiosk_pin WHERE employee_id = p_employee_id;
        RETURN true;
    END IF;

    v_settings := public.hr_settings_for(v_employee.company_id);
    IF p_pin !~ '^[0-9]{4,8}$' OR length(p_pin) < v_settings.kiosk_pin_min_length THEN
        RAISE EXCEPTION 'Invalid PIN format' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.hr_kiosk_pin (employee_id, company_id, pin_hash, created_by, updated_by)
    VALUES (p_employee_id, v_employee.company_id, public.hr_sha256(v_settings.pin_salt || ':' || p_pin), auth.uid(), auth.uid())
    ON CONFLICT (employee_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, updated_by = auth.uid(), active = true;

    RETURN true;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'PIN already in use' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.hr_set_kiosk_pin(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_set_kiosk_pin(UUID, TEXT) TO authenticated;

-- Empleados de la empresa que ya tienen NIP (sin exponer el hash).
CREATE OR REPLACE FUNCTION public.hr_kiosk_pin_employees(p_company_id UUID)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RETURN;
    END IF;
    RETURN QUERY SELECT employee_id FROM public.hr_kiosk_pin WHERE company_id = p_company_id AND active IS TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_kiosk_pin_employees(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_kiosk_pin_employees(UUID) TO authenticated;

-- Datos públicos del kiosco para pintar la pantalla.
CREATE OR REPLACE FUNCTION public.kiosk_info(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'kiosk_name', k.name,
        'location', k.location,
        'company_name', c.name,
        'company_logo', c.logo_url,
        'timezone', coalesce(s.timezone, 'America/Mexico_City'),
        'pin_min_length', coalesce(s.kiosk_pin_min_length, 4)
    )
    INTO v_result
    FROM public.hr_kiosk k
    JOIN public.company c ON c.id = k.company_id
    LEFT JOIN public.hr_settings s ON s.company_id = k.company_id
    WHERE k.token_hash = public.hr_sha256(coalesce(p_token, '')) AND k.active IS TRUE;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_info(TEXT) TO anon, authenticated;

-- Marca entrada o salida. Devuelve JSON en lugar de lanzar errores para que
-- el registro del intento fallido no se revierta.
CREATE OR REPLACE FUNCTION public.kiosk_punch(p_token TEXT, p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kiosk     public.hr_kiosk;
    v_settings  public.hr_settings;
    v_employee  public.employee;
    v_name      TEXT;
    v_avatar    TEXT;
    v_open      public.hr_attendance;
    v_last_out  TIMESTAMPTZ;
    v_action    TEXT;
    v_now       TIMESTAMPTZ := now();
    v_today     DATE;
    v_worked    INTEGER;
BEGIN
    SELECT * INTO v_kiosk FROM public.hr_kiosk
    WHERE token_hash = public.hr_sha256(coalesce(p_token, '')) AND active IS TRUE;
    IF v_kiosk.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_kiosk');
    END IF;

    DELETE FROM public.hr_kiosk_attempt WHERE kiosk_id = v_kiosk.id AND created_at < v_now - INTERVAL '1 day';

    IF (
        SELECT count(*) FROM public.hr_kiosk_attempt
        WHERE kiosk_id = v_kiosk.id AND success IS FALSE AND created_at > v_now - INTERVAL '5 minutes'
    ) >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'locked');
    END IF;

    v_settings := public.hr_settings_for(v_kiosk.company_id);

    SELECT e.* INTO v_employee
    FROM public.hr_kiosk_pin kp
    JOIN public.employee e ON e.id = kp.employee_id
    WHERE kp.company_id = v_kiosk.company_id
      AND kp.active IS TRUE
      AND kp.pin_hash = public.hr_sha256(v_settings.pin_salt || ':' || coalesce(p_pin, ''))
      AND e.active IS TRUE
      AND e.status = 'active';

    INSERT INTO public.hr_kiosk_attempt (company_id, kiosk_id, success)
    VALUES (v_kiosk.company_id, v_kiosk.id, v_employee.id IS NOT NULL);

    IF v_employee.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
    END IF;

    SELECT coalesce(nullif(trim(p.display_name), ''), p.name), p.avatar_url
    INTO v_name, v_avatar
    FROM public.partner p WHERE p.id = v_employee.partner_id;

    UPDATE public.hr_kiosk SET last_used_at = v_now WHERE id = v_kiosk.id;

    SELECT * INTO v_open FROM public.hr_attendance
    WHERE employee_id = v_employee.id AND check_out IS NULL AND active IS TRUE;

    SELECT max(check_out) INTO v_last_out FROM public.hr_attendance
    WHERE employee_id = v_employee.id AND active IS TRUE AND check_out IS NOT NULL;

    -- Doble toque: se ignora una segunda marca en menos de un minuto.
    IF (v_open.id IS NOT NULL AND v_open.check_in > v_now - INTERVAL '1 minute')
       OR (v_open.id IS NULL AND v_last_out > v_now - INTERVAL '1 minute') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'duplicate', 'employee_name', v_name);
    END IF;

    IF v_open.id IS NOT NULL AND v_open.check_in > v_now - INTERVAL '20 hours' THEN
        UPDATE public.hr_attendance SET check_out = v_now WHERE id = v_open.id;
        v_action := 'check_out';
    ELSE
        -- Una entrada de hace más de 20 horas se cierra como «sin salida» para revisión.
        IF v_open.id IS NOT NULL THEN
            UPDATE public.hr_attendance
            SET check_out = check_in, missing_check_out = true,
                notes = trim(coalesce(notes, '') || ' Sin salida registrada.')
            WHERE id = v_open.id;
        END IF;

        INSERT INTO public.hr_attendance (company_id, employee_id, check_in, source, kiosk_id, work_date)
        VALUES (v_kiosk.company_id, v_employee.id, v_now, 'kiosk', v_kiosk.id, v_now::DATE);
        v_action := 'check_in';
    END IF;

    v_today := (v_now AT TIME ZONE v_settings.timezone)::DATE;
    SELECT worked_minutes INTO v_worked FROM public.hr_attendance_day
    WHERE employee_id = v_employee.id AND work_date = v_today;

    RETURN jsonb_build_object(
        'ok', true,
        'action', v_action,
        'employee_name', v_name,
        'employee_avatar', v_avatar,
        'at', v_now,
        'worked_minutes_today', coalesce(v_worked, 0)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_punch(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_punch(TEXT, TEXT) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 7. Vacaciones y permisos
--
-- kind define cómo afecta la ausencia a la nómina:
--   vacation      pagada, descuenta saldo y genera prima vacacional
--   paid_leave    permiso con goce de sueldo
--   unpaid_leave  permiso sin goce: descuenta los días
--   sick          incapacidad IMSS: no la paga el patrón y no cotiza
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hr_leave_type (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name             VARCHAR(150) NOT NULL,
    kind             VARCHAR(20) NOT NULL,
    deducts_balance  BOOLEAN NOT NULL DEFAULT false,
    color            VARCHAR(20) NOT NULL DEFAULT 'indigo',
    description      TEXT,

    active           BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    created_by       UUID REFERENCES auth.users(id),
    updated_by       UUID REFERENCES auth.users(id),

    CONSTRAINT hr_leave_type_company_id_key UNIQUE (company_id, id),
    CONSTRAINT hr_leave_type_kind_check CHECK (kind IN ('vacation', 'paid_leave', 'unpaid_leave', 'sick'))
);

COMMENT ON TABLE public.hr_leave_type IS 'Tipos de ausencia: vacaciones, permisos con y sin goce, incapacidades.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_leave_type_name
    ON public.hr_leave_type(company_id, lower(name)) WHERE active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_hr_leave_type_company ON public.hr_leave_type(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_type_active  ON public.hr_leave_type(active);

ALTER TABLE public.hr_leave_type ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_leave_type_updated_at ON public.hr_leave_type;
CREATE TRIGGER update_hr_leave_type_updated_at
    BEFORE UPDATE ON public.hr_leave_type
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.hr_leave_allocation (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    employee_id    UUID NOT NULL,
    leave_type_id  UUID NOT NULL,

    days           DECIMAL(6, 2) NOT NULL,
    service_year   INTEGER,
    valid_from     DATE,
    valid_to       DATE,
    notes          TEXT,

    active         BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),
    created_by     UUID REFERENCES auth.users(id),
    updated_by     UUID REFERENCES auth.users(id),

    CONSTRAINT hr_leave_allocation_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id) ON DELETE CASCADE,
    CONSTRAINT hr_leave_allocation_type_fk
        FOREIGN KEY (company_id, leave_type_id)
        REFERENCES public.hr_leave_type(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT hr_leave_allocation_days CHECK (days <> 0),
    CONSTRAINT hr_leave_allocation_dates CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

COMMENT ON TABLE public.hr_leave_allocation IS 'Días asignados a un empleado. service_year enlaza la asignación anual de vacaciones por antigüedad. Días negativos ajustan el saldo.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_leave_allocation_service_year
    ON public.hr_leave_allocation(employee_id, leave_type_id, service_year)
    WHERE service_year IS NOT NULL AND active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_hr_leave_allocation_company  ON public.hr_leave_allocation(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_allocation_employee ON public.hr_leave_allocation(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_allocation_active   ON public.hr_leave_allocation(active);

ALTER TABLE public.hr_leave_allocation ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_leave_allocation_updated_at ON public.hr_leave_allocation;
CREATE TRIGGER update_hr_leave_allocation_updated_at
    BEFORE UPDATE ON public.hr_leave_allocation
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.hr_leave_request (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    employee_id       UUID NOT NULL,
    leave_type_id     UUID NOT NULL,

    start_date        DATE NOT NULL,
    end_date          DATE NOT NULL,
    half_day          BOOLEAN NOT NULL DEFAULT false,
    days              DECIMAL(6, 2) NOT NULL DEFAULT 0,
    reason            TEXT,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by       UUID REFERENCES auth.users(id),
    reviewed_at       TIMESTAMPTZ,
    review_notes      TEXT,

    active            BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    created_by        UUID REFERENCES auth.users(id),
    updated_by        UUID REFERENCES auth.users(id),

    CONSTRAINT hr_leave_request_company_id_key UNIQUE (company_id, id),
    CONSTRAINT hr_leave_request_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id) ON DELETE CASCADE,
    CONSTRAINT hr_leave_request_type_fk
        FOREIGN KEY (company_id, leave_type_id)
        REFERENCES public.hr_leave_type(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT hr_leave_request_dates CHECK (end_date >= start_date),
    CONSTRAINT hr_leave_request_half_day CHECK (NOT half_day OR start_date = end_date),
    CONSTRAINT hr_leave_request_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

COMMENT ON TABLE public.hr_leave_request IS 'Solicitudes de vacaciones y permisos. days cuenta los días laborables del horario, sin festivos.';

CREATE INDEX IF NOT EXISTS idx_hr_leave_request_company  ON public.hr_leave_request(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_request_employee ON public.hr_leave_request(employee_id, start_date);
CREATE INDEX IF NOT EXISTS idx_hr_leave_request_status   ON public.hr_leave_request(company_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_request_active   ON public.hr_leave_request(active);

ALTER TABLE public.hr_leave_request ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_leave_request_updated_at ON public.hr_leave_request;
CREATE TRIGGER update_hr_leave_request_updated_at
    BEFORE UPDATE ON public.hr_leave_request
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Días laborables del empleado en un rango (según su horario; lunes a viernes si no tiene).
CREATE OR REPLACE FUNCTION public.hr_count_leave_days(
    p_employee_id UUID,
    p_start DATE,
    p_end DATE,
    p_half_day BOOLEAN DEFAULT false
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_employee  public.employee;
    v_days      INTEGER;
BEGIN
    SELECT * INTO v_employee FROM public.employee WHERE id = p_employee_id;

    SELECT count(*)::INTEGER INTO v_days
    FROM generate_series(p_start, p_end, INTERVAL '1 day') AS g(d)
    WHERE NOT EXISTS (
            SELECT 1 FROM public.hr_holiday h
            WHERE h.company_id = v_employee.company_id AND h.holiday_date = g.d::DATE AND h.active IS TRUE
        )
      AND (
        CASE
            WHEN v_employee.work_schedule_id IS NULL THEN EXTRACT(ISODOW FROM g.d) BETWEEN 1 AND 5
            ELSE EXISTS (
                SELECT 1 FROM public.hr_work_schedule_line l
                WHERE l.schedule_id = v_employee.work_schedule_id
                  AND l.weekday = EXTRACT(DOW FROM g.d)::SMALLINT
                  AND l.active IS TRUE
            )
        END
      );

    IF p_half_day AND v_days > 0 THEN
        RETURN 0.5;
    END IF;
    RETURN v_days;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_count_leave_days(UUID, DATE, DATE, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_count_leave_days(UUID, DATE, DATE, BOOLEAN) TO authenticated;

-- Reglas de la solicitud:
-- - La aprobación pasa por hr_review_leave_request (valida saldo y justifica faltas).
-- - Un miembro solo crea solicitudes propias en `pending` y solo puede cancelarlas
--   mientras sigan pendientes.
-- - No se traslapan solicitudes pendientes o aprobadas del mismo empleado.
CREATE OR REPLACE FUNCTION public.hr_leave_request_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin   BOOLEAN := public.is_company_admin(NEW.company_id);
    v_reviewing  BOOLEAN := coalesce(current_setting('hr.reviewing_leave', true), '') = 'on';
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id) THEN
        RAISE EXCEPTION 'The company and employee of a request cannot change' USING ERRCODE = '22023';
    END IF;

    IF NOT v_is_admin THEN
        IF NOT public.hr_is_own_employee(NEW.employee_id) THEN
            RAISE EXCEPTION 'You can only manage your own requests' USING ERRCODE = '42501';
        END IF;
        IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
            RAISE EXCEPTION 'New requests must be pending' USING ERRCODE = '42501';
        END IF;
        IF TG_OP = 'UPDATE' AND NOT (
            OLD.status = 'pending' AND NEW.status = 'cancelled'
            AND NEW.start_date = OLD.start_date AND NEW.end_date = OLD.end_date
            AND NEW.leave_type_id = OLD.leave_type_id AND NEW.half_day = OLD.half_day
        ) THEN
            RAISE EXCEPTION 'You can only cancel a pending request' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status <> 'approved') AND NOT v_reviewing THEN
        RAISE EXCEPTION 'Use hr_review_leave_request to approve' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status IN ('approved', 'rejected', 'cancelled') AND NEW.status = OLD.status
       AND (NEW.start_date <> OLD.start_date OR NEW.end_date <> OLD.end_date
            OR NEW.leave_type_id <> OLD.leave_type_id OR NEW.half_day <> OLD.half_day) THEN
        RAISE EXCEPTION 'A reviewed request cannot change its dates or type' USING ERRCODE = '22023';
    END IF;

    NEW.days := public.hr_count_leave_days(NEW.employee_id, NEW.start_date, NEW.end_date, NEW.half_day);
    IF NEW.days <= 0 AND NEW.status IN ('pending', 'approved') THEN
        RAISE EXCEPTION 'The request has no working days' USING ERRCODE = '22023';
    END IF;

    IF NEW.status IN ('pending', 'approved') AND NEW.active IS TRUE AND EXISTS (
        SELECT 1 FROM public.hr_leave_request r
        WHERE r.employee_id = NEW.employee_id
          AND r.id <> NEW.id
          AND r.active IS TRUE
          AND r.status IN ('pending', 'approved')
          AND daterange(r.start_date, r.end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
    ) THEN
        RAISE EXCEPTION 'The request overlaps another request' USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_leave_request_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hr_leave_request_guard_trigger ON public.hr_leave_request;
CREATE TRIGGER hr_leave_request_guard_trigger
    BEFORE INSERT OR UPDATE ON public.hr_leave_request
    FOR EACH ROW EXECUTE FUNCTION public.hr_leave_request_guard();

-- ═══════════════════════════════════════════════════════════════════
-- 8. hr_absence — inasistencias
--
-- La detección (hr_detect_absences) crea una falta injustificada por cada día
-- laborable sin marcas, sin festivo y sin permiso aprobado. Es idempotente:
-- (employee_id, absence_date) es único, así que una falta descartada
-- (active = false) no se vuelve a crear.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hr_absence (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    employee_id       UUID NOT NULL,

    absence_date      DATE NOT NULL,
    kind              VARCHAR(20) NOT NULL DEFAULT 'unjustified',
    deduct_from_pay   BOOLEAN NOT NULL DEFAULT true,
    leave_request_id  UUID,
    reason            TEXT,

    active            BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    created_by        UUID REFERENCES auth.users(id),
    updated_by        UUID REFERENCES auth.users(id),

    CONSTRAINT hr_absence_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id) ON DELETE CASCADE,
    CONSTRAINT hr_absence_leave_fk
        FOREIGN KEY (company_id, leave_request_id)
        REFERENCES public.hr_leave_request(company_id, id) ON DELETE SET NULL (leave_request_id),
    CONSTRAINT hr_absence_day_key UNIQUE (employee_id, absence_date),
    CONSTRAINT hr_absence_kind_check CHECK (kind IN ('unjustified', 'justified'))
);

COMMENT ON TABLE public.hr_absence IS 'Inasistencias. deduct_from_pay indica si la nómina descuenta el día.';

CREATE INDEX IF NOT EXISTS idx_hr_absence_company ON public.hr_absence(company_id, absence_date);
CREATE INDEX IF NOT EXISTS idx_hr_absence_active  ON public.hr_absence(active);

ALTER TABLE public.hr_absence ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_hr_absence_updated_at ON public.hr_absence;
CREATE TRIGGER update_hr_absence_updated_at
    BEFORE UPDATE ON public.hr_absence
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.hr_detect_absences(p_company_id UUID, p_from DATE, p_to DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings  public.hr_settings;
    v_to        DATE;
    v_count     INTEGER;
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can detect absences' USING ERRCODE = '42501';
    END IF;
    IF p_to - p_from > 366 THEN
        RAISE EXCEPTION 'The range cannot exceed one year' USING ERRCODE = '22023';
    END IF;

    v_settings := public.hr_settings_for(p_company_id);
    -- Solo días cerrados: hoy todavía puede llegar la marca.
    v_to := LEAST(p_to, (now() AT TIME ZONE v_settings.timezone)::DATE - 1);

    INSERT INTO public.hr_absence (company_id, employee_id, absence_date, kind, deduct_from_pay, created_by, updated_by)
    SELECT e.company_id, e.id, g.d::DATE, 'unjustified', true, auth.uid(), auth.uid()
    FROM public.employee e
    CROSS JOIN generate_series(p_from, v_to, INTERVAL '1 day') AS g(d)
    JOIN public.hr_work_schedule_line l
      ON l.schedule_id = e.work_schedule_id
     AND l.weekday = EXTRACT(DOW FROM g.d)::SMALLINT
     AND l.active IS TRUE
    WHERE e.company_id = p_company_id
      AND e.active IS TRUE
      AND e.status = 'active'
      AND (e.hire_date IS NULL OR g.d::DATE >= e.hire_date)
      AND (e.termination_date IS NULL OR g.d::DATE <= e.termination_date)
      AND NOT EXISTS (
          SELECT 1 FROM public.hr_holiday h
          WHERE h.company_id = p_company_id AND h.holiday_date = g.d::DATE AND h.active IS TRUE
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.hr_attendance_day a
          WHERE a.employee_id = e.id AND a.work_date = g.d::DATE
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.hr_leave_request r
          WHERE r.employee_id = e.id AND r.status = 'approved' AND r.active IS TRUE
            AND g.d::DATE BETWEEN r.start_date AND r.end_date
      )
    ON CONFLICT (employee_id, absence_date) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_detect_absences(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_detect_absences(UUID, DATE, DATE) TO authenticated;

-- Una marca registrada después elimina la falta de ese día.
CREATE OR REPLACE FUNCTION public.hr_attendance_day_clears_absence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.hr_absence
    SET active = false, reason = trim(coalesce(reason, '') || ' Se registró asistencia.')
    WHERE employee_id = NEW.employee_id AND absence_date = NEW.work_date
      AND kind = 'unjustified' AND active IS TRUE;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_attendance_day_clears_absence() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hr_attendance_day_clears_absence_trigger ON public.hr_attendance_day;
CREATE TRIGGER hr_attendance_day_clears_absence_trigger
    AFTER INSERT ON public.hr_attendance_day
    FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_day_clears_absence();

-- Aprueba o rechaza una solicitud. Al aprobar valida el saldo y justifica las
-- faltas detectadas en el rango.
CREATE OR REPLACE FUNCTION public.hr_review_leave_request(
    p_request_id  UUID,
    p_approve     BOOLEAN,
    p_notes       TEXT DEFAULT NULL
)
RETURNS public.hr_leave_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request    public.hr_leave_request;
    v_type       public.hr_leave_type;
    v_allocated  DECIMAL;
    v_taken      DECIMAL;
BEGIN
    SELECT * INTO v_request FROM public.hr_leave_request WHERE id = p_request_id AND active IS TRUE;
    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT public.is_company_admin(v_request.company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can review requests' USING ERRCODE = '42501';
    END IF;
    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending requests can be reviewed' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_type FROM public.hr_leave_type WHERE id = v_request.leave_type_id;

    IF p_approve AND v_type.deducts_balance THEN
        SELECT coalesce(sum(days), 0) INTO v_allocated
        FROM public.hr_leave_allocation
        WHERE employee_id = v_request.employee_id AND leave_type_id = v_request.leave_type_id AND active IS TRUE;

        SELECT coalesce(sum(days), 0) INTO v_taken
        FROM public.hr_leave_request
        WHERE employee_id = v_request.employee_id AND leave_type_id = v_request.leave_type_id
          AND status = 'approved' AND active IS TRUE;

        IF v_allocated - v_taken < v_request.days THEN
            RAISE EXCEPTION 'Insufficient balance' USING ERRCODE = '22023';
        END IF;
    END IF;

    PERFORM set_config('hr.reviewing_leave', 'on', true);

    UPDATE public.hr_leave_request
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = nullif(trim(coalesce(p_notes, '')), ''),
        updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO v_request;

    PERFORM set_config('hr.reviewing_leave', 'off', true);

    IF p_approve THEN
        UPDATE public.hr_absence
        SET kind = 'justified',
            deduct_from_pay = false,
            leave_request_id = v_request.id,
            updated_by = auth.uid()
        WHERE employee_id = v_request.employee_id
          AND absence_date BETWEEN v_request.start_date AND v_request.end_date
          AND active IS TRUE;
    END IF;

    RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_review_leave_request(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_review_leave_request(UUID, BOOLEAN, TEXT) TO authenticated;

-- Al cancelar una solicitud aprobada, sus faltas vuelven a ser injustificadas.
CREATE OR REPLACE FUNCTION public.hr_leave_request_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
        UPDATE public.hr_absence
        SET kind = 'unjustified', deduct_from_pay = true, leave_request_id = NULL
        WHERE leave_request_id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_leave_request_after_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hr_leave_request_after_update_trigger ON public.hr_leave_request;
CREATE TRIGGER hr_leave_request_after_update_trigger
    AFTER UPDATE ON public.hr_leave_request
    FOR EACH ROW EXECUTE FUNCTION public.hr_leave_request_after_update();

-- Crea los tipos de ausencia básicos si la empresa no tiene ninguno.
CREATE OR REPLACE FUNCTION public.hr_ensure_defaults(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can configure HR' USING ERRCODE = '42501';
    END IF;

    PERFORM public.hr_settings_for(p_company_id);

    IF NOT EXISTS (SELECT 1 FROM public.hr_leave_type WHERE company_id = p_company_id) THEN
        INSERT INTO public.hr_leave_type (company_id, name, kind, deducts_balance, color, description, created_by, updated_by)
        VALUES
            (p_company_id, 'Vacaciones', 'vacation', true, 'emerald', 'Vacaciones por antigüedad (art. 76 LFT).', auth.uid(), auth.uid()),
            (p_company_id, 'Permiso con goce de sueldo', 'paid_leave', false, 'sky', 'Ausencia autorizada que se paga.', auth.uid(), auth.uid()),
            (p_company_id, 'Permiso sin goce de sueldo', 'unpaid_leave', false, 'amber', 'Ausencia autorizada que no se paga.', auth.uid(), auth.uid()),
            (p_company_id, 'Incapacidad IMSS', 'sick', false, 'rose', 'Incapacidad expedida por el IMSS. La paga el instituto.', auth.uid(), auth.uid());
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_ensure_defaults(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_ensure_defaults(UUID) TO authenticated;

-- Asigna las vacaciones del año de servicio en curso a cada empleado activo
-- que ya cumplió al menos un año. Idempotente por (empleado, tipo, año).
CREATE OR REPLACE FUNCTION public.hr_generate_vacation_allocations(p_company_id UUID, p_as_of DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type_id  UUID;
    v_count    INTEGER;
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can allocate vacations' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_type_id FROM public.hr_leave_type
    WHERE company_id = p_company_id AND kind = 'vacation' AND active IS TRUE
    ORDER BY created_at
    LIMIT 1;

    IF v_type_id IS NULL THEN
        RAISE EXCEPTION 'There is no vacation leave type' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.hr_leave_allocation (
        company_id, employee_id, leave_type_id, days, service_year, valid_from, valid_to, notes, created_by, updated_by
    )
    SELECT
        e.company_id,
        e.id,
        v_type_id,
        coalesce(nullif(ep.vacation_days, 0), public.hr_lft_vacation_days(y.years)),
        y.years,
        (e.hire_date + make_interval(years => y.years))::DATE,
        (e.hire_date + make_interval(years => y.years) + INTERVAL '18 months')::DATE,
        'Asignación automática por antigüedad',
        auth.uid(),
        auth.uid()
    FROM public.employee e
    LEFT JOIN public.employee_private ep ON ep.employee_id = e.id
    CROSS JOIN LATERAL (
        SELECT EXTRACT(YEAR FROM age(p_as_of, e.hire_date))::INTEGER AS years
    ) y
    WHERE e.company_id = p_company_id
      AND e.active IS TRUE
      AND e.status = 'active'
      AND e.hire_date IS NOT NULL
      AND y.years >= 1
    ON CONFLICT (employee_id, leave_type_id, service_year) WHERE service_year IS NOT NULL AND active IS TRUE
    DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_generate_vacation_allocations(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_generate_vacation_allocations(UUID, DATE) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 9. hr_salary — historial de salarios
--
-- El salario vigente (la fila activa más reciente con effective_date <= hoy)
-- se copia a employee_private: monthly_salary, cfdi_contribution_base (SBC)
-- y cfdi_integrated_daily_wage (SDI).
-- ═══════════════════════════════════════════════════════════════════

-- Crédito INFONAVIT del trabajador: dato sensible, junto al resto en employee_private.
ALTER TABLE public.employee_private
    ADD COLUMN IF NOT EXISTS infonavit_credit_number  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS infonavit_discount_type  VARCHAR(20) NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS infonavit_discount_value DECIMAL(12, 4) NOT NULL DEFAULT 0;

ALTER TABLE public.employee_private DROP CONSTRAINT IF EXISTS employee_private_infonavit_check;
ALTER TABLE public.employee_private
    ADD CONSTRAINT employee_private_infonavit_check CHECK (
        infonavit_discount_type IN ('none', 'percentage', 'fixed', 'factor')
        AND infonavit_discount_value >= 0
    );

CREATE TABLE IF NOT EXISTS public.hr_salary (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    employee_id             UUID NOT NULL,

    effective_date          DATE NOT NULL,
    salary_type             VARCHAR(20) NOT NULL DEFAULT 'monthly',
    amount                  DECIMAL(15, 2) NOT NULL,
    daily_salary            DECIMAL(15, 2) NOT NULL DEFAULT 0,
    monthly_salary          DECIMAL(15, 2) NOT NULL DEFAULT 0,
    integrated_daily_wage   DECIMAL(15, 2),
    contribution_base       DECIMAL(15, 2),
    currency                CHAR(3) NOT NULL DEFAULT 'MXN',
    reason                  VARCHAR(20) NOT NULL DEFAULT 'adjustment',
    notes                   TEXT,

    active                  BOOLEAN DEFAULT true,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now(),
    created_by              UUID REFERENCES auth.users(id),
    updated_by              UUID REFERENCES auth.users(id),

    CONSTRAINT hr_salary_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id) ON DELETE CASCADE,
    CONSTRAINT hr_salary_type_check CHECK (salary_type IN ('monthly', 'daily')),
    CONSTRAINT hr_salary_reason_check CHECK (reason IN ('hire', 'raise', 'promotion', 'adjustment', 'minimum_wage', 'other')),
    CONSTRAINT hr_salary_amounts CHECK (
        amount > 0
        AND coalesce(integrated_daily_wage, 0) >= 0
        AND coalesce(contribution_base, 0) >= 0
    )
);

COMMENT ON TABLE public.hr_salary IS 'Historial de salarios. daily_salary y monthly_salary los calcula un trigger (mes de 30 días).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_salary_effective
    ON public.hr_salary(employee_id, effective_date) WHERE active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_hr_salary_company  ON public.hr_salary(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_salary_employee ON public.hr_salary(employee_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_salary_active   ON public.hr_salary(active);

ALTER TABLE public.hr_salary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_salary FROM anon;

DROP TRIGGER IF EXISTS update_hr_salary_updated_at ON public.hr_salary;
CREATE TRIGGER update_hr_salary_updated_at
    BEFORE UPDATE ON public.hr_salary
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.hr_salary_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id) THEN
        RAISE EXCEPTION 'The company and employee of a salary cannot change' USING ERRCODE = '22023';
    END IF;
    IF NEW.salary_type = 'monthly' THEN
        NEW.monthly_salary := NEW.amount;
        NEW.daily_salary := round(NEW.amount / 30, 2);
    ELSE
        NEW.daily_salary := NEW.amount;
        NEW.monthly_salary := round(NEW.amount * 30, 2);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hr_salary_before_write_trigger ON public.hr_salary;
CREATE TRIGGER hr_salary_before_write_trigger
    BEFORE INSERT OR UPDATE ON public.hr_salary
    FOR EACH ROW EXECUTE FUNCTION public.hr_salary_before_write();

CREATE OR REPLACE FUNCTION public.hr_salary_sync_current()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current public.hr_salary;
BEGIN
    SELECT * INTO v_current FROM public.hr_salary
    WHERE employee_id = NEW.employee_id AND active IS TRUE AND effective_date <= CURRENT_DATE
    ORDER BY effective_date DESC
    LIMIT 1;

    IF v_current.id IS NOT NULL THEN
        UPDATE public.employee_private
        SET monthly_salary = v_current.monthly_salary,
            salary_currency = v_current.currency,
            cfdi_contribution_base = coalesce(v_current.contribution_base, cfdi_contribution_base),
            cfdi_integrated_daily_wage = coalesce(v_current.integrated_daily_wage, cfdi_integrated_daily_wage)
        WHERE employee_id = NEW.employee_id;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_salary_sync_current() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hr_salary_sync_current_trigger ON public.hr_salary;
CREATE TRIGGER hr_salary_sync_current_trigger
    AFTER INSERT OR UPDATE ON public.hr_salary
    FOR EACH ROW EXECUTE FUNCTION public.hr_salary_sync_current();

-- ═══════════════════════════════════════════════════════════════════
-- 10. Nómina
--
-- payroll_fiscal_config guarda los parámetros fiscales por empresa y año
-- (UMA, salarios mínimos, tarifa ISR, subsidio, cuotas IMSS, cesantía y
-- vejez, INFONAVIT, ISN). Las tablas viajan como JSONB; su forma la define
-- `PayrollFiscalParams` en app/utils/payroll.ts.
--
-- El cálculo ocurre en la app (motor puro y probado) y se guarda con
-- payroll_save_calculation, que reemplaza los recibos del periodo en una
-- transacción. Una nómina aprobada o pagada queda inmutable.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payroll_fiscal_config (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                     UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    fiscal_year                    INTEGER NOT NULL,
    uma_daily                      DECIMAL(12, 2) NOT NULL,
    minimum_wage_daily             DECIMAL(12, 2) NOT NULL,
    minimum_wage_border_daily      DECIMAL(12, 2) NOT NULL,
    use_border_zone                BOOLEAN NOT NULL DEFAULT false,
    isr_monthly_table              JSONB NOT NULL,
    subsidy_uma_rate               DECIMAL(8, 4) NOT NULL DEFAULT 0,
    subsidy_income_limit           DECIMAL(12, 2) NOT NULL DEFAULT 0,
    imss_rates                     JSONB NOT NULL,
    cesantia_employer_table        JSONB NOT NULL,
    risk_premium_rate              DECIMAL(8, 5) NOT NULL DEFAULT 0.54355,
    infonavit_employer_rate        DECIMAL(8, 4) NOT NULL DEFAULT 5,
    isn_rate                       DECIMAL(8, 4) NOT NULL DEFAULT 0,
    sbc_cap_umas                   DECIMAL(6, 2) NOT NULL DEFAULT 25,
    vacation_premium_rate          DECIMAL(8, 4) NOT NULL DEFAULT 25,
    sunday_premium_rate            DECIMAL(8, 4) NOT NULL DEFAULT 25,
    aguinaldo_days                 INTEGER NOT NULL DEFAULT 15,
    overtime_exempt_umas_weekly    DECIMAL(6, 2) NOT NULL DEFAULT 5,
    vacation_premium_exempt_umas   DECIMAL(6, 2) NOT NULL DEFAULT 15,
    aguinaldo_exempt_umas          DECIMAL(6, 2) NOT NULL DEFAULT 30,
    employer_registration          VARCHAR(20),
    employer_state                 VARCHAR(3),
    notes                          TEXT,

    active                         BOOLEAN DEFAULT true,
    created_at                     TIMESTAMPTZ DEFAULT now(),
    updated_at                     TIMESTAMPTZ DEFAULT now(),
    created_by                     UUID REFERENCES auth.users(id),
    updated_by                     UUID REFERENCES auth.users(id),

    CONSTRAINT payroll_fiscal_config_year CHECK (fiscal_year BETWEEN 2000 AND 2100),
    CONSTRAINT payroll_fiscal_config_json CHECK (
        jsonb_typeof(isr_monthly_table) = 'array'
        AND jsonb_typeof(cesantia_employer_table) = 'array'
        AND jsonb_typeof(imss_rates) = 'object'
    ),
    CONSTRAINT payroll_fiscal_config_amounts CHECK (
        uma_daily > 0 AND minimum_wage_daily > 0 AND minimum_wage_border_daily > 0
        AND subsidy_uma_rate >= 0 AND subsidy_income_limit >= 0
        AND risk_premium_rate BETWEEN 0 AND 15
        AND infonavit_employer_rate >= 0 AND isn_rate BETWEEN 0 AND 10
        AND sbc_cap_umas > 0 AND aguinaldo_days >= 15
        AND vacation_premium_rate >= 25
    )
);

COMMENT ON TABLE public.payroll_fiscal_config IS 'Parámetros fiscales de nómina por empresa y año. Solo owner/admin.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_fiscal_config_year
    ON public.payroll_fiscal_config(company_id, fiscal_year) WHERE active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_payroll_fiscal_config_company ON public.payroll_fiscal_config(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_fiscal_config_active  ON public.payroll_fiscal_config(active);

ALTER TABLE public.payroll_fiscal_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_fiscal_config FROM anon;

DROP TRIGGER IF EXISTS update_payroll_fiscal_config_updated_at ON public.payroll_fiscal_config;
CREATE TRIGGER update_payroll_fiscal_config_updated_at
    BEFORE UPDATE ON public.payroll_fiscal_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.payroll_period (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name                  VARCHAR(150) NOT NULL,
    frequency             VARCHAR(20) NOT NULL DEFAULT 'biweekly',
    start_date            DATE NOT NULL,
    end_date              DATE NOT NULL,
    payment_date          DATE,
    fiscal_year           INTEGER NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'draft',
    employee_count        INTEGER NOT NULL DEFAULT 0,
    total_perceptions     DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_deductions      DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_net             DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_employer_cost   DECIMAL(15, 2) NOT NULL DEFAULT 0,
    calculated_at         TIMESTAMPTZ,
    approved_at           TIMESTAMPTZ,
    approved_by           UUID REFERENCES auth.users(id),
    paid_at               TIMESTAMPTZ,
    notes                 TEXT,

    active                BOOLEAN DEFAULT true,
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now(),
    created_by            UUID REFERENCES auth.users(id),
    updated_by            UUID REFERENCES auth.users(id),

    CONSTRAINT payroll_period_company_id_key UNIQUE (company_id, id),
    CONSTRAINT payroll_period_frequency_check CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    CONSTRAINT payroll_period_status_check CHECK (status IN ('draft', 'calculated', 'approved', 'paid', 'cancelled')),
    CONSTRAINT payroll_period_dates CHECK (end_date >= start_date AND end_date - start_date <= 31)
);

COMMENT ON TABLE public.payroll_period IS 'Periodos de nómina. El estado cambia con payroll_set_period_status; los totales los escribe payroll_save_calculation.';

CREATE INDEX IF NOT EXISTS idx_payroll_period_company ON public.payroll_period(company_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_period_active  ON public.payroll_period(active);

ALTER TABLE public.payroll_period ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_period FROM anon;

DROP TRIGGER IF EXISTS update_payroll_period_updated_at ON public.payroll_period;
CREATE TRIGGER update_payroll_period_updated_at
    BEFORE UPDATE ON public.payroll_period
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.payroll_period_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_internal BOOLEAN := coalesce(current_setting('payroll.internal', true), '') = 'on';
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'draft' THEN
            RAISE EXCEPTION 'New payroll periods must be drafts' USING ERRCODE = '22023';
        END IF;
        NEW.employee_count := 0;
        NEW.total_perceptions := 0;
        NEW.total_deductions := 0;
        NEW.total_net := 0;
        NEW.total_employer_cost := 0;
        RETURN NEW;
    END IF;

    IF v_internal THEN
        RETURN NEW;
    END IF;

    IF NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.employee_count IS DISTINCT FROM OLD.employee_count
       OR NEW.total_perceptions IS DISTINCT FROM OLD.total_perceptions
       OR NEW.total_deductions IS DISTINCT FROM OLD.total_deductions
       OR NEW.total_net IS DISTINCT FROM OLD.total_net
       OR NEW.total_employer_cost IS DISTINCT FROM OLD.total_employer_cost
       OR NEW.calculated_at IS DISTINCT FROM OLD.calculated_at
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
        RAISE EXCEPTION 'Status and totals change only through the payroll RPCs' USING ERRCODE = '42501';
    END IF;

    IF OLD.status IN ('approved', 'paid', 'cancelled') AND (
        NEW.start_date IS DISTINCT FROM OLD.start_date
        OR NEW.end_date IS DISTINCT FROM OLD.end_date
        OR NEW.frequency IS DISTINCT FROM OLD.frequency
        OR NEW.fiscal_year IS DISTINCT FROM OLD.fiscal_year
        OR NEW.active IS DISTINCT FROM OLD.active
    ) THEN
        RAISE EXCEPTION 'An approved, paid or cancelled payroll cannot change' USING ERRCODE = '22023';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payroll_period_guard_trigger ON public.payroll_period;
CREATE TRIGGER payroll_period_guard_trigger
    BEFORE INSERT OR UPDATE ON public.payroll_period
    FOR EACH ROW EXECUTE FUNCTION public.payroll_period_guard();

-- Percepciones y deducciones manuales del periodo (bonos, aguinaldo, préstamos…).
CREATE TABLE IF NOT EXISTS public.payroll_adjustment (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    period_id    UUID NOT NULL,
    employee_id  UUID NOT NULL,

    kind         VARCHAR(20) NOT NULL,
    code         VARCHAR(40) NOT NULL,
    name         VARCHAR(150) NOT NULL,
    amount       DECIMAL(15, 2) NOT NULL,
    is_taxable   BOOLEAN NOT NULL DEFAULT true,
    sat_code     VARCHAR(5),
    notes        TEXT,

    active       BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    created_by   UUID REFERENCES auth.users(id),
    updated_by   UUID REFERENCES auth.users(id),

    CONSTRAINT payroll_adjustment_period_fk
        FOREIGN KEY (company_id, period_id)
        REFERENCES public.payroll_period(company_id, id) ON DELETE CASCADE,
    CONSTRAINT payroll_adjustment_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id) ON DELETE CASCADE,
    CONSTRAINT payroll_adjustment_kind_check CHECK (kind IN ('perception', 'deduction')),
    CONSTRAINT payroll_adjustment_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_payroll_adjustment_company ON public.payroll_adjustment(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustment_period  ON public.payroll_adjustment(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustment_active  ON public.payroll_adjustment(active);

ALTER TABLE public.payroll_adjustment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_adjustment FROM anon;

DROP TRIGGER IF EXISTS update_payroll_adjustment_updated_at ON public.payroll_adjustment;
CREATE TRIGGER update_payroll_adjustment_updated_at
    BEFORE UPDATE ON public.payroll_adjustment
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.payroll_adjustment_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.payroll_period p
        WHERE p.id = NEW.period_id AND p.status NOT IN ('draft', 'calculated')
    ) THEN
        RAISE EXCEPTION 'The payroll period is closed' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.payroll_adjustment_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payroll_adjustment_guard_trigger ON public.payroll_adjustment;
CREATE TRIGGER payroll_adjustment_guard_trigger
    BEFORE INSERT OR UPDATE ON public.payroll_adjustment
    FOR EACH ROW EXECUTE FUNCTION public.payroll_adjustment_guard();

CREATE TABLE IF NOT EXISTS public.payroll_slip (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    period_id               UUID NOT NULL,
    employee_id             UUID NOT NULL,

    daily_salary            DECIMAL(15, 2) NOT NULL DEFAULT 0,
    contribution_base       DECIMAL(15, 2) NOT NULL DEFAULT 0,
    period_days             DECIMAL(6, 2) NOT NULL DEFAULT 0,
    paid_days               DECIMAL(6, 2) NOT NULL DEFAULT 0,
    absence_days            DECIMAL(6, 2) NOT NULL DEFAULT 0,
    vacation_days           DECIMAL(6, 2) NOT NULL DEFAULT 0,
    overtime_double_hours   DECIMAL(8, 2) NOT NULL DEFAULT 0,
    overtime_triple_hours   DECIMAL(8, 2) NOT NULL DEFAULT 0,
    sundays_worked          INTEGER NOT NULL DEFAULT 0,
    rest_days_worked        INTEGER NOT NULL DEFAULT 0,
    total_perceptions       DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_taxable           DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_exempt            DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_deductions        DECIMAL(15, 2) NOT NULL DEFAULT 0,
    net_pay                 DECIMAL(15, 2) NOT NULL DEFAULT 0,
    isr                     DECIMAL(15, 2) NOT NULL DEFAULT 0,
    subsidy                 DECIMAL(15, 2) NOT NULL DEFAULT 0,
    imss_employee           DECIMAL(15, 2) NOT NULL DEFAULT 0,
    imss_employer           DECIMAL(15, 2) NOT NULL DEFAULT 0,
    infonavit_employer      DECIMAL(15, 2) NOT NULL DEFAULT 0,
    isn                     DECIMAL(15, 2) NOT NULL DEFAULT 0,
    employer_cost           DECIMAL(15, 2) NOT NULL DEFAULT 0,

    active                  BOOLEAN DEFAULT true,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now(),
    created_by              UUID REFERENCES auth.users(id),
    updated_by              UUID REFERENCES auth.users(id),

    CONSTRAINT payroll_slip_company_id_key UNIQUE (company_id, id),
    CONSTRAINT payroll_slip_period_fk
        FOREIGN KEY (company_id, period_id)
        REFERENCES public.payroll_period(company_id, id) ON DELETE CASCADE,
    CONSTRAINT payroll_slip_employee_fk
        FOREIGN KEY (company_id, employee_id)
        REFERENCES public.employee(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT payroll_slip_period_employee_key UNIQUE (period_id, employee_id)
);

COMMENT ON TABLE public.payroll_slip IS 'Recibo de nómina por empleado y periodo. Solo lo escribe payroll_save_calculation.';

CREATE INDEX IF NOT EXISTS idx_payroll_slip_company  ON public.payroll_slip(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_slip_employee ON public.payroll_slip(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_slip_active   ON public.payroll_slip(active);

ALTER TABLE public.payroll_slip ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_slip FROM anon;

DROP TRIGGER IF EXISTS update_payroll_slip_updated_at ON public.payroll_slip;
CREATE TRIGGER update_payroll_slip_updated_at
    BEFORE UPDATE ON public.payroll_slip
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Estado del periodo sin pasar por el RLS de payroll_period (que solo lee
-- owner/admin). Lo usa la política de recibos propios.
CREATE OR REPLACE FUNCTION public.payroll_period_status(p_period_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT status FROM public.payroll_period WHERE id = p_period_id;
$$;

REVOKE ALL ON FUNCTION public.payroll_period_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payroll_period_status(UUID) TO authenticated;

-- Encabezado del periodo para el recibo: nombre, fechas y estado, sin los
-- totales de la empresa. Owner/admin lo ven siempre; un empleado, solo si
-- tiene recibo en una nómina aprobada o pagada.
CREATE OR REPLACE FUNCTION public.payroll_period_header(p_period_id UUID)
RETURNS TABLE (name VARCHAR, start_date DATE, end_date DATE, payment_date DATE, status VARCHAR)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT p.name, p.start_date, p.end_date, p.payment_date, p.status
    FROM public.payroll_period p
    WHERE p.id = p_period_id
      AND (
          public.is_company_admin(p.company_id)
          OR (
              p.status IN ('approved', 'paid')
              AND EXISTS (
                  SELECT 1 FROM public.payroll_slip s
                  WHERE s.period_id = p.id AND public.hr_is_own_employee(s.employee_id)
              )
          )
      );
$$;

REVOKE ALL ON FUNCTION public.payroll_period_header(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payroll_period_header(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.payroll_slip_line (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    slip_id          UUID NOT NULL,

    category         VARCHAR(20) NOT NULL,
    code             VARCHAR(40) NOT NULL,
    sat_code         VARCHAR(5),
    name             VARCHAR(150) NOT NULL,
    quantity         DECIMAL(10, 2) NOT NULL DEFAULT 1,
    amount           DECIMAL(15, 2) NOT NULL DEFAULT 0,
    taxable_amount   DECIMAL(15, 2) NOT NULL DEFAULT 0,
    exempt_amount    DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sequence         INTEGER NOT NULL DEFAULT 0,

    active           BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    created_by       UUID REFERENCES auth.users(id),
    updated_by       UUID REFERENCES auth.users(id),

    CONSTRAINT payroll_slip_line_slip_fk
        FOREIGN KEY (company_id, slip_id)
        REFERENCES public.payroll_slip(company_id, id) ON DELETE CASCADE,
    CONSTRAINT payroll_slip_line_category_check CHECK (category IN ('perception', 'deduction', 'employer'))
);

COMMENT ON TABLE public.payroll_slip_line IS 'Conceptos del recibo: percepciones, deducciones y aportaciones patronales, con su clave SAT.';

CREATE INDEX IF NOT EXISTS idx_payroll_slip_line_company ON public.payroll_slip_line(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_slip_line_slip    ON public.payroll_slip_line(slip_id, sequence);
CREATE INDEX IF NOT EXISTS idx_payroll_slip_line_active  ON public.payroll_slip_line(active);

ALTER TABLE public.payroll_slip_line ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_slip_line FROM anon;

DROP TRIGGER IF EXISTS update_payroll_slip_line_updated_at ON public.payroll_slip_line;
CREATE TRIGGER update_payroll_slip_line_updated_at
    BEFORE UPDATE ON public.payroll_slip_line
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reemplaza los recibos del periodo con el cálculo enviado por la app.
CREATE OR REPLACE FUNCTION public.payroll_save_calculation(p_period_id UUID, p_slips JSONB)
RETURNS public.payroll_period
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id  UUID := auth.uid();
    v_period   public.payroll_period;
    v_slip     JSONB;
    v_slip_id  UUID;
BEGIN
    SELECT * INTO v_period FROM public.payroll_period WHERE id = p_period_id AND active IS TRUE FOR UPDATE;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'Payroll period not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT public.is_company_admin(v_period.company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can calculate payroll' USING ERRCODE = '42501';
    END IF;
    IF v_period.status NOT IN ('draft', 'calculated') THEN
        RAISE EXCEPTION 'The payroll period is closed' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(coalesce(p_slips, '[]'::JSONB)) <> 'array' THEN
        RAISE EXCEPTION 'Slips must be an array' USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.payroll_slip WHERE period_id = p_period_id;

    FOR v_slip IN SELECT * FROM jsonb_array_elements(coalesce(p_slips, '[]'::JSONB))
    LOOP
        INSERT INTO public.payroll_slip (
            company_id, period_id, employee_id, daily_salary, contribution_base, period_days, paid_days,
            absence_days, vacation_days, overtime_double_hours, overtime_triple_hours, sundays_worked,
            rest_days_worked, total_perceptions, total_taxable, total_exempt, total_deductions, net_pay,
            isr, subsidy, imss_employee, imss_employer, infonavit_employer, isn, employer_cost,
            created_by, updated_by
        )
        VALUES (
            v_period.company_id, p_period_id, (v_slip->>'employee_id')::UUID,
            coalesce((v_slip->>'daily_salary')::DECIMAL, 0),
            coalesce((v_slip->>'contribution_base')::DECIMAL, 0),
            coalesce((v_slip->>'period_days')::DECIMAL, 0),
            coalesce((v_slip->>'paid_days')::DECIMAL, 0),
            coalesce((v_slip->>'absence_days')::DECIMAL, 0),
            coalesce((v_slip->>'vacation_days')::DECIMAL, 0),
            coalesce((v_slip->>'overtime_double_hours')::DECIMAL, 0),
            coalesce((v_slip->>'overtime_triple_hours')::DECIMAL, 0),
            coalesce((v_slip->>'sundays_worked')::INTEGER, 0),
            coalesce((v_slip->>'rest_days_worked')::INTEGER, 0),
            coalesce((v_slip->>'total_perceptions')::DECIMAL, 0),
            coalesce((v_slip->>'total_taxable')::DECIMAL, 0),
            coalesce((v_slip->>'total_exempt')::DECIMAL, 0),
            coalesce((v_slip->>'total_deductions')::DECIMAL, 0),
            coalesce((v_slip->>'net_pay')::DECIMAL, 0),
            coalesce((v_slip->>'isr')::DECIMAL, 0),
            coalesce((v_slip->>'subsidy')::DECIMAL, 0),
            coalesce((v_slip->>'imss_employee')::DECIMAL, 0),
            coalesce((v_slip->>'imss_employer')::DECIMAL, 0),
            coalesce((v_slip->>'infonavit_employer')::DECIMAL, 0),
            coalesce((v_slip->>'isn')::DECIMAL, 0),
            coalesce((v_slip->>'employer_cost')::DECIMAL, 0),
            v_user_id, v_user_id
        )
        RETURNING id INTO v_slip_id;

        INSERT INTO public.payroll_slip_line (
            company_id, slip_id, category, code, sat_code, name, quantity, amount,
            taxable_amount, exempt_amount, sequence, created_by, updated_by
        )
        SELECT v_period.company_id, v_slip_id,
               l.item->>'category',
               l.item->>'code',
               nullif(l.item->>'sat_code', ''),
               l.item->>'name',
               coalesce((l.item->>'quantity')::DECIMAL, 1),
               coalesce((l.item->>'amount')::DECIMAL, 0),
               coalesce((l.item->>'taxable_amount')::DECIMAL, 0),
               coalesce((l.item->>'exempt_amount')::DECIMAL, 0),
               (l.ord - 1)::INTEGER,
               v_user_id, v_user_id
        FROM jsonb_array_elements(coalesce(v_slip->'lines', '[]'::JSONB)) WITH ORDINALITY AS l(item, ord);
    END LOOP;

    PERFORM set_config('payroll.internal', 'on', true);

    UPDATE public.payroll_period p
    SET status = 'calculated',
        calculated_at = now(),
        updated_by = v_user_id,
        employee_count = t.n,
        total_perceptions = t.perceptions,
        total_deductions = t.deductions,
        total_net = t.net,
        total_employer_cost = t.cost
    FROM (
        SELECT count(*)::INTEGER AS n,
               coalesce(sum(total_perceptions), 0) AS perceptions,
               coalesce(sum(total_deductions), 0) AS deductions,
               coalesce(sum(net_pay), 0) AS net,
               coalesce(sum(employer_cost), 0) AS cost
        FROM public.payroll_slip WHERE period_id = p_period_id
    ) t
    WHERE p.id = p_period_id
    RETURNING p.* INTO v_period;

    PERFORM set_config('payroll.internal', 'off', true);

    RETURN v_period;
END;
$$;

REVOKE ALL ON FUNCTION public.payroll_save_calculation(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payroll_save_calculation(UUID, JSONB) TO authenticated;

-- Transiciones permitidas:
--   calculated → approved → paid
--   approved   → calculated  (reabrir antes de pagar)
--   draft | calculated → cancelled
CREATE OR REPLACE FUNCTION public.payroll_set_period_status(p_period_id UUID, p_status TEXT)
RETURNS public.payroll_period
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period public.payroll_period;
BEGIN
    SELECT * INTO v_period FROM public.payroll_period WHERE id = p_period_id AND active IS TRUE FOR UPDATE;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'Payroll period not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT public.is_company_admin(v_period.company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can change payroll status' USING ERRCODE = '42501';
    END IF;

    IF NOT (
        (v_period.status = 'calculated' AND p_status = 'approved')
        OR (v_period.status = 'approved' AND p_status IN ('paid', 'calculated'))
        OR (v_period.status IN ('draft', 'calculated') AND p_status = 'cancelled')
    ) THEN
        RAISE EXCEPTION 'Invalid payroll status transition' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('payroll.internal', 'on', true);

    UPDATE public.payroll_period
    SET status = p_status,
        approved_at = CASE WHEN p_status = 'approved' THEN now() WHEN p_status = 'calculated' THEN NULL ELSE approved_at END,
        approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() WHEN p_status = 'calculated' THEN NULL ELSE approved_by END,
        paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE paid_at END,
        updated_by = auth.uid()
    WHERE id = p_period_id
    RETURNING * INTO v_period;

    PERFORM set_config('payroll.internal', 'off', true);

    RETURN v_period;
END;
$$;

REVOKE ALL ON FUNCTION public.payroll_set_period_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payroll_set_period_status(UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════

-- Catálogos: lectura para el equipo, escritura para owner/admin.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['hr_work_schedule', 'hr_work_schedule_line', 'hr_holiday', 'hr_leave_type']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_company', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.user_belongs_to_company(company_id))',
            t || '_select_company', t);
    END LOOP;

    FOREACH t IN ARRAY ARRAY['hr_holiday', 'hr_leave_type', 'hr_work_schedule']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_insert', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_company_admin(company_id))',
            t || '_admin_insert', t);
    END LOOP;

    -- Solo owner/admin leen y escriben.
    FOREACH t IN ARRAY ARRAY['hr_settings', 'hr_kiosk', 'hr_salary', 'payroll_fiscal_config', 'payroll_period', 'payroll_adjustment']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_select', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_company_admin(company_id))',
            t || '_admin_select', t);
    END LOOP;

    FOREACH t IN ARRAY ARRAY['hr_settings', 'hr_salary', 'payroll_fiscal_config', 'payroll_period', 'payroll_adjustment',
                             'hr_attendance', 'hr_absence', 'hr_leave_allocation']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_insert', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_company_admin(company_id))',
            t || '_admin_insert', t);
    END LOOP;

    -- Datos de la persona: owner/admin, o la persona misma.
    FOREACH t IN ARRAY ARRAY['hr_attendance', 'hr_attendance_day', 'hr_absence', 'hr_leave_allocation', 'hr_leave_request']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own_or_admin', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
             USING (public.is_company_admin(company_id) OR public.hr_is_own_employee(employee_id))',
            t || '_select_own_or_admin', t);
    END LOOP;

    -- Actualización (incluye el borrado lógico) solo para owner/admin.
    FOREACH t IN ARRAY ARRAY['hr_settings', 'hr_kiosk', 'hr_holiday', 'hr_leave_type', 'hr_work_schedule',
                             'hr_attendance', 'hr_absence', 'hr_leave_allocation', 'hr_salary',
                             'payroll_fiscal_config', 'payroll_period', 'payroll_adjustment']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_update', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
             USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id))',
            t || '_admin_update', t);
    END LOOP;
END;
$$;

-- Solicitudes: owner/admin o la persona misma (el trigger acota qué puede hacer).
DROP POLICY IF EXISTS "hr_leave_request_insert_own_or_admin" ON public.hr_leave_request;
CREATE POLICY "hr_leave_request_insert_own_or_admin" ON public.hr_leave_request
    FOR INSERT TO authenticated
    WITH CHECK (public.is_company_admin(company_id) OR public.hr_is_own_employee(employee_id));

DROP POLICY IF EXISTS "hr_leave_request_update_own_or_admin" ON public.hr_leave_request;
CREATE POLICY "hr_leave_request_update_own_or_admin" ON public.hr_leave_request
    FOR UPDATE TO authenticated
    USING (public.is_company_admin(company_id) OR public.hr_is_own_employee(employee_id))
    WITH CHECK (public.is_company_admin(company_id) OR public.hr_is_own_employee(employee_id));

-- Recibos: owner/admin siempre; la persona, los suyos de nóminas aprobadas o pagadas.
DROP POLICY IF EXISTS "payroll_slip_select" ON public.payroll_slip;
CREATE POLICY "payroll_slip_select" ON public.payroll_slip
    FOR SELECT TO authenticated
    USING (
        public.is_company_admin(company_id)
        OR (
            public.hr_is_own_employee(employee_id)
            AND public.payroll_period_status(period_id) IN ('approved', 'paid')
        )
    );

DROP POLICY IF EXISTS "payroll_slip_line_select" ON public.payroll_slip_line;
CREATE POLICY "payroll_slip_line_select" ON public.payroll_slip_line
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.payroll_slip s WHERE s.id = payroll_slip_line.slip_id));

REVOKE ALL ON public.hr_attendance, public.hr_attendance_day, public.hr_absence,
              public.hr_leave_allocation, public.hr_leave_request, public.hr_settings,
              public.hr_kiosk
    FROM anon;

-- ═══════════════════════════════════════════════════════════════════
-- 11. Vistas (security_invoker: aplican el RLS de las tablas base)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_hr_attendance_days
WITH (security_invoker = true) AS
SELECT
    d.*,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS employee_name,
    e.employee_number,
    e.department_id,
    dep.name AS department_name
FROM public.hr_attendance_day d
JOIN public.employee e ON e.id = d.employee_id
LEFT JOIN public.partner p ON p.id = e.partner_id
LEFT JOIN public.employee_department dep ON dep.id = e.department_id;

CREATE OR REPLACE VIEW public.v_hr_attendances
WITH (security_invoker = true) AS
SELECT
    a.*,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS employee_name,
    e.employee_number,
    k.name AS kiosk_name
FROM public.hr_attendance a
JOIN public.employee e ON e.id = a.employee_id
LEFT JOIN public.partner p ON p.id = e.partner_id
LEFT JOIN public.hr_kiosk k ON k.id = a.kiosk_id;

CREATE OR REPLACE VIEW public.v_hr_leave_requests
WITH (security_invoker = true) AS
SELECT
    r.*,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS employee_name,
    t.name AS leave_type_name,
    t.kind AS leave_kind,
    t.color AS leave_color
FROM public.hr_leave_request r
JOIN public.employee e ON e.id = r.employee_id
LEFT JOIN public.partner p ON p.id = e.partner_id
LEFT JOIN public.hr_leave_type t ON t.id = r.leave_type_id;

CREATE OR REPLACE VIEW public.v_hr_leave_allocations
WITH (security_invoker = true) AS
SELECT
    a.*,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS employee_name,
    t.name AS leave_type_name
FROM public.hr_leave_allocation a
JOIN public.employee e ON e.id = a.employee_id
LEFT JOIN public.partner p ON p.id = e.partner_id
LEFT JOIN public.hr_leave_type t ON t.id = a.leave_type_id;

-- Saldo por empleado y tipo de ausencia que descuenta saldo.
CREATE OR REPLACE VIEW public.v_hr_leave_balances
WITH (security_invoker = true) AS
SELECT
    e.company_id,
    e.id AS employee_id,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS employee_name,
    e.hire_date,
    t.id AS leave_type_id,
    t.name AS leave_type_name,
    coalesce(al.days, 0) AS allocated_days,
    coalesce(rq.taken, 0) AS taken_days,
    coalesce(rq.pending, 0) AS pending_days,
    coalesce(al.days, 0) - coalesce(rq.taken, 0) AS remaining_days
FROM public.employee e
JOIN public.hr_leave_type t ON t.company_id = e.company_id AND t.deducts_balance IS TRUE AND t.active IS TRUE
LEFT JOIN public.partner p ON p.id = e.partner_id
LEFT JOIN LATERAL (
    SELECT sum(a.days) AS days FROM public.hr_leave_allocation a
    WHERE a.employee_id = e.id AND a.leave_type_id = t.id AND a.active IS TRUE
) al ON true
LEFT JOIN LATERAL (
    SELECT sum(r.days) FILTER (WHERE r.status = 'approved') AS taken,
           sum(r.days) FILTER (WHERE r.status = 'pending') AS pending
    FROM public.hr_leave_request r
    WHERE r.employee_id = e.id AND r.leave_type_id = t.id AND r.active IS TRUE
) rq ON true
WHERE e.active IS TRUE
  AND (public.is_company_admin(e.company_id) OR public.hr_is_own_employee(e.id));

CREATE OR REPLACE VIEW public.v_hr_absences
WITH (security_invoker = true) AS
SELECT
    a.*,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS employee_name,
    e.employee_number,
    dep.name AS department_name
FROM public.hr_absence a
JOIN public.employee e ON e.id = a.employee_id
LEFT JOIN public.partner p ON p.id = e.partner_id
LEFT JOIN public.employee_department dep ON dep.id = e.department_id;

CREATE OR REPLACE VIEW public.v_hr_salaries
WITH (security_invoker = true) AS
SELECT
    s.*,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS employee_name,
    e.employee_number,
    e.job_title
FROM public.hr_salary s
JOIN public.employee e ON e.id = s.employee_id
LEFT JOIN public.partner p ON p.id = e.partner_id;

CREATE OR REPLACE VIEW public.v_payroll_slips
WITH (security_invoker = true) AS
SELECT
    s.*,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS employee_name,
    p.vat AS employee_rfc,
    e.employee_number,
    e.job_title,
    dep.name AS department_name,
    pp.name AS period_name,
    pp.start_date AS period_start,
    pp.end_date AS period_end,
    pp.payment_date,
    pp.status AS period_status
FROM public.payroll_slip s
JOIN LATERAL public.payroll_period_header(s.period_id) pp ON true
JOIN public.employee e ON e.id = s.employee_id
LEFT JOIN public.partner p ON p.id = e.partner_id
LEFT JOIN public.employee_department dep ON dep.id = e.department_id;

REVOKE ALL ON public.v_hr_attendance_days, public.v_hr_attendances, public.v_hr_leave_requests,
              public.v_hr_leave_allocations, public.v_hr_leave_balances, public.v_hr_absences,
              public.v_hr_salaries, public.v_payroll_slips
    FROM anon;
GRANT SELECT ON public.v_hr_attendance_days, public.v_hr_attendances, public.v_hr_leave_requests,
                public.v_hr_leave_allocations, public.v_hr_leave_balances, public.v_hr_absences,
                public.v_hr_salaries, public.v_payroll_slips
    TO authenticated;

-- v_employees se recrea para incluir work_schedule_id (e.* se expande al crearla).
CREATE OR REPLACE VIEW public.v_employees
WITH (security_invoker = true) AS
SELECT
    e.id, e.company_id, e.partner_id, e.employee_number, e.job_title, e.department_id,
    e.manager_id, e.work_email, e.work_phone, e.work_location, e.hire_date,
    e.termination_date, e.status, e.active, e.created_at, e.updated_at, e.created_by,
    e.updated_by,
    coalesce(nullif(trim(p.display_name), ''), p.name) AS partner_name,
    p.email      AS partner_email,
    p.phone      AS partner_phone,
    p.mobile     AS partner_mobile,
    p.avatar_url AS partner_avatar_url,
    d.name       AS department_name,
    coalesce(nullif(trim(mp.display_name), ''), mp.name) AS manager_name,
    e.work_schedule_id,
    ws.name      AS work_schedule_name
FROM public.employee e
LEFT JOIN public.partner p              ON p.id = e.partner_id
LEFT JOIN public.employee_department d  ON d.id = e.department_id
LEFT JOIN public.employee m             ON m.id = e.manager_id
LEFT JOIN public.partner mp             ON mp.id = m.partner_id
LEFT JOIN public.hr_work_schedule ws    ON ws.id = e.work_schedule_id;

-- Resumen de asistencia por empleado en un rango. SECURITY INVOKER: cada
-- usuario ve lo que el RLS le permite (owner/admin todo, el resto lo suyo).
CREATE OR REPLACE FUNCTION public.hr_attendance_summary(p_company_id UUID, p_from DATE, p_to DATE)
RETURNS TABLE (
    employee_id                 UUID,
    employee_name               TEXT,
    employee_number             TEXT,
    department_name             TEXT,
    days_worked                 INTEGER,
    worked_minutes              BIGINT,
    scheduled_minutes           BIGINT,
    late_count                  INTEGER,
    late_minutes                BIGINT,
    overtime_minutes            BIGINT,
    overtime_approved_minutes   BIGINT,
    overtime_pending_minutes    BIGINT,
    rest_days_worked            INTEGER,
    sundays_worked              INTEGER,
    holidays_worked             INTEGER,
    missing_check_outs          INTEGER,
    absences_unjustified        INTEGER,
    absences_justified          INTEGER,
    leave_days                  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        e.id,
        coalesce(nullif(trim(p.display_name), ''), p.name)::TEXT,
        e.employee_number::TEXT,
        dep.name::TEXT,
        coalesce(d.days_worked, 0),
        coalesce(d.worked, 0),
        coalesce(d.scheduled, 0),
        coalesce(d.late_count, 0),
        coalesce(d.late, 0),
        coalesce(d.overtime, 0),
        coalesce(d.overtime_approved, 0),
        coalesce(d.overtime_pending, 0),
        coalesce(d.rest_days, 0),
        coalesce(d.sundays, 0),
        coalesce(d.holidays, 0),
        coalesce(d.missing, 0),
        coalesce(ab.unjustified, 0),
        coalesce(ab.justified, 0),
        coalesce(lv.days, 0)
    FROM public.employee e
    LEFT JOIN public.partner p ON p.id = e.partner_id
    LEFT JOIN public.employee_department dep ON dep.id = e.department_id
    LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE a.worked_minutes > 0)::INTEGER AS days_worked,
               sum(a.worked_minutes) AS worked,
               sum(a.scheduled_minutes) AS scheduled,
               count(*) FILTER (WHERE a.late_minutes > 0)::INTEGER AS late_count,
               sum(a.late_minutes) AS late,
               sum(a.overtime_minutes) AS overtime,
               sum(a.overtime_approved_minutes) AS overtime_approved,
               sum(a.overtime_minutes) FILTER (WHERE a.overtime_status = 'pending') AS overtime_pending,
               count(*) FILTER (WHERE a.is_rest_day AND a.worked_minutes > 0)::INTEGER AS rest_days,
               count(*) FILTER (WHERE EXTRACT(DOW FROM a.work_date) = 0 AND a.worked_minutes > 0)::INTEGER AS sundays,
               count(*) FILTER (WHERE a.is_holiday AND a.worked_minutes > 0)::INTEGER AS holidays,
               count(*) FILTER (WHERE a.missing_check_out)::INTEGER AS missing
        FROM public.hr_attendance_day a
        WHERE a.employee_id = e.id AND a.work_date BETWEEN p_from AND p_to
    ) d ON true
    LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE b.kind = 'unjustified')::INTEGER AS unjustified,
               count(*) FILTER (WHERE b.kind = 'justified')::INTEGER AS justified
        FROM public.hr_absence b
        WHERE b.employee_id = e.id AND b.active IS TRUE AND b.absence_date BETWEEN p_from AND p_to
    ) ab ON true
    LEFT JOIN LATERAL (
        SELECT sum(public.hr_count_leave_days(r.employee_id, GREATEST(r.start_date, p_from), LEAST(r.end_date, p_to), r.half_day)) AS days
        FROM public.hr_leave_request r
        WHERE r.employee_id = e.id AND r.status = 'approved' AND r.active IS TRUE
          AND r.start_date <= p_to AND r.end_date >= p_from
    ) lv ON true
    WHERE e.company_id = p_company_id
      AND e.active IS TRUE
      AND (public.is_company_admin(e.company_id) OR public.hr_is_own_employee(e.id))
    ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.hr_attendance_summary(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_attendance_summary(UUID, DATE, DATE) TO authenticated;
