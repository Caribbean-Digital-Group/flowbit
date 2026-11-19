-- Stubs mínimos de Supabase para validar migraciones en la CI (TRY-48).
--
-- Supabase Cloud ya trae los roles, el esquema `auth` y el esquema `storage`.
-- Un PostgreSQL limpio no, así que este script crea solo lo que las migraciones
-- de `supabase/migrations/` usan. No replica el comportamiento de Supabase: sirve
-- para detectar errores de sintaxis, referencias rotas y orden de dependencias.
--
-- Si una migración nueva usa otra pieza de Supabase (por ejemplo `auth.jwt()`),
-- agrégala aquí con la firma real de Supabase.

\set ON_ERROR_STOP on

-- Roles de la API de Supabase
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Igual que en Supabase: las funciones de `extensions` se resuelven sin prefijo.
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET search_path TO "$user", public, extensions', current_database());
END
$$;
SET search_path TO "$user", public, extensions;

GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;

-- ── auth ────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email              TEXT,
    phone              TEXT,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    raw_app_meta_data  JSONB DEFAULT '{}'::jsonb,
    email_confirmed_at TIMESTAMPTZ,
    last_sign_in_at    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now()
);

-- Mismas firmas que Supabase: leen los claims del JWT de la sesión.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE AS $$
    SELECT nullif(
        coalesce(
            current_setting('request.jwt.claim.sub', true),
            current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
        ), ''
    )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT nullif(
        coalesce(
            current_setting('request.jwt.claim.role', true),
            current_setting('request.jwt.claims', true)::jsonb ->> 'role'
        ), ''
    )::text
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
LANGUAGE sql STABLE AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;

-- ── storage ─────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS storage.buckets (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL UNIQUE,
    owner              UUID,
    public             BOOLEAN DEFAULT false,
    file_size_limit    BIGINT,
    allowed_mime_types TEXT[],
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id  TEXT REFERENCES storage.buckets(id),
    name       TEXT,
    owner      UUID,
    metadata   JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    _parts TEXT[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[1:array_length(_parts, 1) - 1];
END
$$;
