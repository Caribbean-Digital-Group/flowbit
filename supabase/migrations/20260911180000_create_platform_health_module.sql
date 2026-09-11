-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Platform Health — latido de la plataforma y anti-suspensión de Supabase ║
-- ║                                                                          ║
-- ║  Los proyectos gratuitos de Supabase Cloud se pausan tras varios días    ║
-- ║  sin actividad. Para el despliegue hospedado (Netlify) basta con una     ║
-- ║  escritura periódica: un cron externo invoca                             ║
-- ║  /api/health/keepalive → platform_health_ping() → esta tabla.            ║
-- ║                                                                          ║
-- ║  1. platform_heartbeat       — una fila por origen de latido             ║
-- ║  2. platform_health_ping()   — registra el latido (RPC de servicio)      ║
-- ║  3. platform_health_status() — lee el último latido sin escribir         ║
-- ║  4. platform_health_check()  — prueba de vida pública (sin datos)        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1. platform_heartbeat
--
-- Tabla de infraestructura, no de negocio: por diseño no lleva
-- company_id (el latido es del despliegue completo, no de un tenant)
-- ni soft-delete ni created_by/updated_by (la escribe un cron, no un
-- usuario). Nunca crece: hay una fila por origen y se actualiza.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.platform_heartbeat (
    source            VARCHAR(40) PRIMARY KEY,

    last_ping_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    previous_ping_at  TIMESTAMPTZ,
    ping_count        BIGINT      NOT NULL DEFAULT 0,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_heartbeat IS
    'Último latido de cada origen (cron) que mantiene activo el proyecto de Supabase.';

-- RLS sin políticas: la tabla es inaccesible vía PostgREST para anon y
-- authenticated. El único acceso es a través de las funciones SECURITY
-- DEFINER de abajo, ejecutables solo por service_role.
ALTER TABLE public.platform_heartbeat ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_platform_heartbeat_updated_at ON public.platform_heartbeat;
CREATE TRIGGER update_platform_heartbeat_updated_at
    BEFORE UPDATE ON public.platform_heartbeat
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- 2. platform_health_ping — registra un latido
--
-- Hace una escritura real (no solo lectura) para que la actividad
-- quede registrada en la base sin lugar a dudas, y devuelve el estado
-- para que el endpoint /health lo pueda reportar.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.platform_health_ping(p_source TEXT DEFAULT 'keepalive')
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source VARCHAR(40) := LEFT(COALESCE(NULLIF(TRIM(p_source), ''), 'keepalive'), 40);
    v_row    public.platform_heartbeat;
BEGIN
    INSERT INTO public.platform_heartbeat AS h (source, last_ping_at, ping_count)
    VALUES (v_source, now(), 1)
    ON CONFLICT (source) DO UPDATE
        SET previous_ping_at = h.last_ping_at,
            last_ping_at     = now(),
            ping_count       = h.ping_count + 1
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
        'status',           'ok',
        'source',           v_row.source,
        'last_ping_at',     v_row.last_ping_at,
        'previous_ping_at', v_row.previous_ping_at,
        'ping_count',       v_row.ping_count,
        'server_time',      now()
    );
END;
$$;

COMMENT ON FUNCTION public.platform_health_ping(TEXT) IS
    'Registra un latido del cron anti-suspensión y devuelve el estado del origen.';

-- ═══════════════════════════════════════════════════════════════════
-- 3. platform_health_status — lectura del último latido
--
-- La usa /health para reportar hace cuánto ocurrió el último latido
-- sin escribir nada.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.platform_health_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.platform_heartbeat;
BEGIN
    SELECT * INTO v_row
    FROM public.platform_heartbeat
    ORDER BY last_ping_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
        'status',       'ok',
        'server_time',  now(),
        'heartbeat',    CASE
            WHEN v_row.source IS NULL THEN NULL
            ELSE jsonb_build_object(
                'source',       v_row.source,
                'last_ping_at', v_row.last_ping_at,
                'ping_count',   v_row.ping_count,
                'age_seconds',  FLOOR(EXTRACT(EPOCH FROM (now() - v_row.last_ping_at)))
            )
        END
    );
END;
$$;

COMMENT ON FUNCTION public.platform_health_status() IS
    'Estado del último latido registrado; solo lectura, para el endpoint /health.';

-- ═══════════════════════════════════════════════════════════════════
-- 4. platform_health_check — prueba de vida pública
--
-- La usa /health para comprobar que Postgres responde. No lee ninguna
-- tabla ni expone dato alguno: solo confirma que la consulta llegó a la
-- base y volvió. Es la única función de este módulo ejecutable por anon,
-- porque el endpoint /health es público y debe funcionar con la clave
-- publicable (con el formato nuevo de claves, la raíz de PostgREST ya
-- solo acepta claves secretas).
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT jsonb_build_object('status', 'ok', 'server_time', now());
$$;

COMMENT ON FUNCTION public.platform_health_check() IS
    'Prueba de vida de la base para el endpoint público /health; no accede a ninguna tabla.';

-- ═══════════════════════════════════════════════════════════════════
-- Permisos
--
-- El GRANT por defecto de PostgreSQL es EXECUTE a PUBLIC, y anon /
-- authenticated heredan de PUBLIC: hay que revocarles explícitamente.
-- Solo el servidor (service_role) puede latir.
-- ═══════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.platform_health_ping(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_health_ping(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_health_ping(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.platform_health_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_health_status() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_health_status() TO service_role;

-- platform_health_check sí es pública: no toca datos y /health se consulta
-- sin sesión. El resto del módulo sigue reservado a service_role.
REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO anon, authenticated, service_role;
