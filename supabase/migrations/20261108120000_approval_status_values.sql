-- ============================================================================
-- Aprobaciones: estados nuevos (TRY-18)
--
-- Va en su propia migración porque `ALTER TYPE ... ADD VALUE` no puede usarse
-- en la misma transacción en que el valor se ocupa. El motor de aprobaciones
-- (20261108120100_approval_engine.sql) ya los usa.
--
--   returned → devuelta al solicitante para corrección
--   expired  → venció sin resolverse (ver approval_settings.expire_after_days)
--
-- `published` se conserva como valor interno y en la interfaz se muestra
-- como «En revisión».
-- ============================================================================

ALTER TYPE public.approval_request_status ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE public.approval_request_status ADD VALUE IF NOT EXISTS 'expired';
