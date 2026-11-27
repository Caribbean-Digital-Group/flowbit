-- ============================================================================
-- Valle Bit (TRY-77): avatar del usuario en la vista de juego
--
-- El avatar es de la persona, no de la empresa: se ve igual en todas las
-- empresas a las que pertenece. Por eso esta tabla no lleva `company_id` y su
-- llave es `user_id`; es la única tabla del módulo fuera del esquema
-- multi-tenant. No guarda datos de negocio, solo la apariencia del personaje.
--
-- Tampoco lleva `active` ni `created_by`/`updated_by`: hay una fila por usuario,
-- la escribe solo su dueño y se reemplaza al guardar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.valle_avatar (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    config     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- El cliente valida cada opción contra su catálogo; aquí solo se acota la forma.
    CONSTRAINT valle_avatar_config_is_object CHECK (jsonb_typeof(config) = 'object'),
    CONSTRAINT valle_avatar_config_size CHECK (pg_column_size(config) <= 2048)
);

COMMENT ON TABLE public.valle_avatar IS
    'Apariencia del avatar de cada usuario en Valle Bit (TRY-77). Una fila por usuario, sin company_id';

ALTER TABLE public.valle_avatar ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_valle_avatar_updated_at ON public.valle_avatar;
CREATE TRIGGER update_valle_avatar_updated_at
    BEFORE UPDATE ON public.valle_avatar
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cada quien lee y escribe únicamente su propio avatar.
DROP POLICY IF EXISTS valle_avatar_select_own ON public.valle_avatar;
CREATE POLICY valle_avatar_select_own ON public.valle_avatar
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS valle_avatar_insert_own ON public.valle_avatar;
CREATE POLICY valle_avatar_insert_own ON public.valle_avatar
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS valle_avatar_update_own ON public.valle_avatar;
CREATE POLICY valle_avatar_update_own ON public.valle_avatar
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.valle_avatar FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.valle_avatar TO authenticated;
GRANT ALL ON public.valle_avatar TO service_role;
