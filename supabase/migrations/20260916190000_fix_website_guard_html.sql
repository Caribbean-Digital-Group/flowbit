-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  fix_website_guard_html                                                    ║
-- ║                                                                            ║
-- ║  website_guard_html() se comparte entre website_page y website_post y      ║
-- ║  usaba `CASE ... THEN NEW.body_html ELSE NEW.content::text`. PL/pgSQL      ║
-- ║  resuelve todos los campos de NEW al preparar la expresión, así que al     ║
-- ║  insertar una página (sin body_html) fallaba con                           ║
-- ║  «record "new" has no field "body_html"» y initialize_website revertía.    ║
-- ║  Se lee el registro como JSONB para tolerar ambas tablas.                  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.website_guard_html()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_row  JSONB := to_jsonb(NEW);
    v_text TEXT;
BEGIN
    -- Posts: HTML ya renderizado. Páginas: el JSON de secciones como texto.
    v_text := COALESCE(v_row ->> 'body_html', v_row ->> 'content', '');

    IF v_text ~* '<\s*script' OR v_text ~* '(href|src|url)\W{0,4}\s*(javascript|vbscript)\s*:' THEN
        RAISE EXCEPTION 'website_unsafe_html'
            USING HINT = 'El contenido incluye código no permitido (<script> o enlaces javascript:).';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.website_guard_html() FROM PUBLIC, anon;
