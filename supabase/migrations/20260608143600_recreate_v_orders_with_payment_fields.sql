-- ╔══════════════════════════════════════════════════════════════╗
-- ║  recreate_v_orders_with_payment_fields                        ║
-- ║  La vista v_orders se creó con SELECT o.* antes de agregar    ║
-- ║  payment_method_id y payment_status (20260528120000). En      ║
-- ║  PostgreSQL, o.* se "congela" a las columnas existentes al     ║
-- ║  momento de crear la vista, por lo que esas columnas nuevas   ║
-- ║  nunca se exponían. La recreamos para re-expandir o.*.        ║
-- ╚══════════════════════════════════════════════════════════════╝

DROP VIEW IF EXISTS public.v_orders CASCADE;

CREATE VIEW public.v_orders AS
SELECT
  o.*,
  p.name AS partner_name,
  p.email AS partner_email,
  p.vat AS partner_vat,
  cbp.name AS created_by_partner_name,
  c.name AS company_name,
  c.currency AS company_currency,
  pr.name AS project_name,
  pr.code AS project_code,
  (SELECT COUNT(*) FROM public.order_line ol WHERE ol.order_id = o.id) AS line_count
FROM public.order o
LEFT JOIN public.partner p ON p.id = o.partner_id
LEFT JOIN public.partner cbp ON cbp.id = o.created_by_partner_id
LEFT JOIN public.company c ON c.id = o.company_id
LEFT JOIN public.project pr ON pr.id = o.project_id;

COMMENT ON VIEW public.v_orders IS 'Órdenes con socio, empresa, proyecto resuelto, método/estado de pago y conteo de líneas';
