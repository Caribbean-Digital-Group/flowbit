# CRM — Leads, pipeline y tablero Kanban

Seguimiento de oportunidades de venta desde el primer contacto hasta el cierre.

## Rutas

| Ruta | Vista | Descripción |
|---|---|---|
| `/admin/crm/kanban` | Tablero | Columnas por etapa con arrastrar y soltar, indicadores y filtros |
| `/admin/crm/leads` | Lista | Datatable con exportación; comparte selector de vista con el tablero |
| `/admin/crm/leads/create` | Alta | Acepta `?stage_id=` para preseleccionar etapa |
| `/admin/crm/leads/[id]` | Detalle | Acepta `?activity=new` para abrir el formulario de actividad |
| `/admin/crm/stages` | Etapas | Franja «Flujo del pipeline» para reordenar arrastrando |
| `/admin/crm/lost-reasons` | Motivos de pérdida | Catálogo + gráfica de motivos más frecuentes |

## Modelo de datos

| Tabla / vista | Uso |
|---|---|
| `crm_lead_stage` | Etapas. `color` (token de paleta), `probability` (se asigna al lead al entrar; `NULL` = conservar), `rotting_days` (umbral de estancamiento) |
| `crm_lead` | Leads. `kanban_sequence` (orden en la columna, admite fracciones), `stage_changed_at`, `lost_reason_id`, `lost_notes` |
| `crm_lost_reason` | Catálogo por empresa de motivos de pérdida |
| `crm_activity` | Actividades de seguimiento |
| `crm_history` | Historial append-only escrito por triggers; el cierre perdido guarda el motivo en `notes` |
| `v_crm_leads` | Lead + etapa + contacto + `next_activity_*`, `days_in_stage`, `is_rotting`, `lost_reason_name` |

Migración: `20260916120000_enhance_crm_pipeline_kanban.sql`.

### Reglas en base de datos (triggers)

- **Cambio de etapa** (`handle_crm_lead_stage_change`): actualiza `stage_changed_at`, fija/limpia `actual_close_date`, aplica la probabilidad de la etapa si el mismo `UPDATE` no la cambió y limpia el motivo de pérdida al salir de una etapa perdida.
- **Validación multi-tenant** (`validate_crm_lead_refs`): etapa y motivo de pérdida deben pertenecer a la empresa del lead. En `INSERT`, `kanban_sequence = 0` coloca la tarjeta al inicio de su columna.
- **Número consecutivo** (`assign_crm_lead_number`): usa un advisory lock por empresa para evitar duplicados en inserciones concurrentes.

### Seguridad

- Las vistas `v_crm_leads`, `v_crm_activities` y `v_crm_history` usan `security_invoker = true`, de modo que respetan el RLS de las tablas base. Antes se ejecutaban con los privilegios del dueño y permitían leer leads de otras empresas.
- `seed_crm_stages` y `seed_crm_lost_reasons` validan `user_belongs_to_company` y no son ejecutables por `anon`.

## Tablero Kanban

Componentes en `app/components/CrmKanban/`:

| Componente | Responsabilidad |
|---|---|
| `Column.vue` | Encabezado con total, ponderado y participación; zona de soltado con marcador; alta rápida; plegado |
| `Card.vue` | Tarjeta del lead; menú con «Mover a etapa…», ganar, perder, reabrir, programar y archivar |
| `LostDialog.vue` | Captura del motivo de pérdida (también lo usa el detalle del lead) |

Comportamiento:

- **Orden**: al soltar, la posición es el punto medio entre las vecinas (`computeKanbanSequence` en `app/utils/crm.ts`). Si dos vecinas comparten valor se renumera la columna.
- **Actualización optimista** con reversión si falla y aviso con **Deshacer**.
- **Accesibilidad**: tarjetas enfocables (Enter abre), menú «Mover a etapa…» como alternativa al arrastre (táctil y teclado), región `aria-live`, atajo `/` para buscar.
- **Preferencias por navegador** (`localStorage`, prefijo `flowbit:crm-kanban:`): columnas plegadas por empresa, vista compacta y «Solo abiertos». Las etapas perdidas inician plegadas.
- La paleta de colores vive en `CRM_STAGE_PALETTE` con clases literales para que Tailwind v4 las detecte.

## Tipos

`types/crm.types.ts` es un shim temporal con las columnas nuevas y el tipo `CrmDatabase`; los composables CRM castean el cliente a `SupabaseClient<CrmDatabase>`. Tras `npm run db:types` puede eliminarse y volver a `Tables<'crm_lead'>`, etc.

## Pasos manuales

```bash
npm run db:push    # aplica 20260916120000_enhance_crm_pipeline_kanban.sql
npm run db:types   # regenera types/database.types.ts
```
