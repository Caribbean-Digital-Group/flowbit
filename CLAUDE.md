# Flowbit — CLAUDE.md

Flowbit es un SaaS multi-tenant de gestión empresarial (ERP ligero) de código abierto.
Desarrollado por **Caribbean Digital Group**.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Nuxt 4 (`compatibilityVersion: 4`) |
| UI | Vue 3.5+, Composition API |
| Lenguaje | TypeScript estricto |
| Estilos | Tailwind CSS v4 (plugin Vite, sin `@apply`) |
| Base de datos | Supabase — PostgreSQL + Auth + RLS |
| Estado global | Pinia (`useAuthStore`) |
| Tipos DB | `types/database.types.ts` — generados, nunca editar manualmente |

---

## Estructura de directorios

```
flowbit/
├── app/
│   ├── assets/css/main.css       # Tailwind entry point
│   ├── components/
│   │   ├── Form/                 # Input.vue, Select.vue, TextArea.vue
│   │   ├── {Module}/Form.vue     # Formulario de cada módulo
│   │   ├── Datatable.vue         # Tabla reutilizable para listados
│   │   ├── CardSheet.vue         # Shell de detalle/edición
│   │   ├── BtnApp.vue            # Botón principal
│   │   ├── BtnDelete.vue         # Botón destructivo
│   │   ├── BadgeApp.vue          # Badge de estado
│   │   ├── Avatar.vue
│   │   └── StatGrid.vue
│   ├── composables/              # use{Entity}.ts — acceso a Supabase
│   ├── layouts/
│   │   ├── admin.vue             # Layout del panel (sidebar + notificaciones)
│   │   ├── default.vue
│   │   └── public.vue
│   ├── middleware/               # Guards de navegación (vacío, a implementar)
│   ├── pages/
│   │   ├── index.vue             # Landing / login
│   │   ├── reset-password.vue
│   │   ├── public/projects/[id].vue  # Vista pública de proyecto compartido
│   │   └── admin/               # Panel administrativo (ver módulos abajo)
│   ├── plugins/                  # (vacío, a implementar)
│   ├── stores/auth.ts            # Pinia store — sesión, partner, company
│   └── utils/                    # Funciones utilitarias puras (vacío)
├── supabase/
│   ├── config.toml
│   └── migrations/               # SQL cronológico — nunca editar el pasado
├── types/
│   └── database.types.ts         # Auto-generado por Supabase CLI
├── nuxt.config.ts
├── package.json
└── tsconfig.json
```

---

## Módulos activos

| Módulo | Ruta admin | Composable(s) |
|---|---|---|
| Dashboard | `/admin` | — |
| Partners | `/admin/partners` | `usePartner` |
| Products | `/admin/products` | `useProduct` |
| Orders | `/admin/orders` | `useOrder`, `useOrderLine` |
| Pickings | `/admin/pickings` | `usePicking`, `usePickingLine` |
| Warehouses | `/admin/warehouses` | `useWarehouse` |
| Projects | `/admin/projects` | `useProject`, `useProjectTask`, `useProjectType` |
| Tasks | `/admin/tasks` | `useProjectTask` |
| Approval Requests | `/admin/approval-requests` | `useApprovalRequest` |
| Approval Categories | `/admin/approval-categories` | `useApprovalCategory` |
| Approval Managers | `/admin/approval-managers` | `useApprovalManager` |
| Team | `/admin/team` | `useMembership` |
| Profile | `/admin/profile` | — |
| Settings | `/admin/settings` | — |

Cada módulo con CRUD completo sigue el patrón de rutas:
```
pages/admin/{module}/
├── index.vue       # Listado (Datatable)
├── create.vue      # Creación (CardSheet + Form)
└── [id]/index.vue  # Detalle / edición (CardSheet + Form)
```

---

## Convenciones de código

### Idioma
- **Código fuente** (variables, funciones, tipos, archivos): inglés
- **UI/UX** (labels, placeholders, mensajes, tooltips): español
- **Locale** para fechas y moneda: `es-MX`
- **Documentación y comentarios de contexto**: español

### TypeScript
- Siempre estricto; nunca usar `any`
- Usar tipos generados de `~/types/database.types` (`Tables<'entity'>`, `TablesInsert<'entity'>`, `TablesUpdate<'entity'>`)
- Props siempre con `interface Props` + `withDefaults(defineProps<Props>(), {...})`
- Emits siempre tipados: `defineEmits<{ 'event-name': [payload: Type] }>()`
- `const` sobre `let`, nunca `var`
- Sin `console.log` en código productivo; solo `console.error` en manejo de errores

### Componentes Vue
- Siempre `<script setup lang="ts">` — nunca Options API
- Orden del bloque en un componente:
  1. `<script lang="ts">` — interfaces exportables (si aplica)
  2. `<script setup lang="ts">` — imports, `definePageMeta`, props, emits, estado, composables, métodos, watchers
  3. `<template>`
  4. `<style scoped>` — solo cuando Tailwind no es suficiente
- Todas las páginas del panel deben declarar: `definePageMeta({ layout: 'admin' })`

### Formularios de módulo (`{Module}/Form.vue`)
- Exportar `{Module}FormData` en bloque `<script lang="ts">` separado
- Exportar `createEmpty{Module}Form()` como factory de inicialización
- Usar `defineModel<FormData>()` para v-model bidireccional
- Prop `readonly: boolean` para alternar vista / edición

---

## Componentes base de UI

### Listados → `Datatable`
```vue
<Datatable
  title="Título"
  description="Descripción"
  :data="items"
  :columns="columns"
  :selectable="true"
  :creatable="true"
  create-label="Nuevo Item"
  @create="handleCreate"
>
  <template #actions="{ row }">...</template>
  <template #bulkActions="{ selected }">...</template>
</Datatable>
```

### Detalle / Edición → `CardSheet`
```vue
<CardSheet
  :title="item.name"
  :subtitle="item.email"
  :is-editing="isEditing"
  :is-loading="isLoading"
  :menu-options="menuOptions"
  @back="handleBack"
  @edit="handleEdit"
  @save="handleSave"
  @cancel="handleCancel"
>
  <ModuleForm v-model="formData" :readonly="!isEditing" />
</CardSheet>
```

### Otros componentes
- `BtnApp` — variantes: `primary`, `secondary`, `ghost`, `danger`
- `BadgeApp` — variantes: `primary`, `success`, `warning`, `danger`
- `BtnDelete` — acciones destructivas
- `FormInput`, `FormSelect`, `FormTextArea` — inputs de formulario
- SVG inline para iconos (sin librería externa)

### Paleta de diseño
- Gradiente principal: `from-indigo-500 via-violet-600 to-fuchsia-600`
- Cards: `rounded-2xl shadow-lg shadow-slate-200/50`
- Botones: `rounded-xl`
- Texto principal: `text-slate-800`, secundario: `text-slate-500`

---

## Composables — patrón estándar

Archivo: `app/composables/use{Entity}.ts`

```ts
import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

export const useEntity = () => {
  const supabase = useSupabase()

  const getAll = async (): Promise<Tables<'entity'>[]> => {
    const { data, error } = await supabase.from('entity').select('*').order('name')
    if (error) { console.error('Error fetching entities:', error); return [] }
    return data ?? []
  }

  const create = async (entity: TablesInsert<'entity'>): Promise<Tables<'entity'> | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('entity')
      .insert({ ...entity, created_by: user?.id, updated_by: user?.id })
      .select().single()
    if (error) { console.error('Error creating entity:', error); return null }
    return data
  }

  const archive = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('entity').update({ active: false }).eq('id', id)
    if (error) { console.error('Error archiving entity:', error); return false }
    return true
  }

  return { getAll, create, archive }
}
```

Reglas clave:
- Obtener cliente via `useSupabase()` (singleton)
- Obtener usuario via `useSupabaseUser()` para auditoría (`created_by`, `updated_by`)
- Manejar errores con `console.error` y retornar `null` / `[]` — no lanzar excepciones
- Soft-delete: `.update({ active: false })` — nunca `.delete()`
- Filtrar siempre por `company_id` (multi-tenant)

---

## Base de datos — Supabase

### Crear una migración
```bash
npm run db:migration:new nombre_descriptivo
```

### Estructura estándar de tabla
```sql
CREATE TABLE IF NOT EXISTS public.entity (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

  -- campos de negocio

  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.entity ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_entity_updated_at
  BEFORE UPDATE ON public.entity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_entity_company ON public.entity(company_id);
CREATE INDEX idx_entity_active  ON public.entity(active);
```

### Reglas obligatorias
- `company_id` — FK a `company` en toda tabla de negocio (multi-tenant)
- RLS habilitado en **todas** las tablas
- Campos de auditoría: `created_at`, `updated_at`, `created_by`, `updated_by`
- Soft delete: `active BOOLEAN DEFAULT true`
- PKs: UUID con `gen_random_uuid()`
- Trigger `update_updated_at_column()` siempre presente
- Full-text search con config `spanish`

### Después de migrar
```bash
npm run db:migration:up   # Aplicar
npm run db:types          # Regenerar tipos TypeScript
```

---

## Autenticación y multi-tenancy

- Auth gestionado por Supabase Auth (email + password)
- `useAuthStore` (Pinia) mantiene: `user`, `session`, `partner`, `companies[]`, `selectedCompanyId`
- `partner` — registro de persona vinculado al `user.id` de Supabase
- El `selectedCompanyId` persiste en `localStorage` con la clave `flowbit:selected-company-id`
- Todos los datos de negocio están scoped por `company_id`
- Membresías de equipo: tabla `partner_company_relationship` (roles: `owner`, `admin`, `member`)
- Invitaciones: flujo asincrónico via `useMembership`

---

## Scripts de desarrollo

```bash
npm run dev                   # Servidor de desarrollo (http://localhost:3000)
npm run build                 # Build de producción
npm run preview               # Preview del build

npm run db:start              # Levantar Supabase local
npm run db:stop               # Detener Supabase local
npm run db:reset              # Resetear DB local
npm run db:migration:new      # Nueva migración
npm run db:migration:up       # Aplicar migraciones
npm run db:types              # Regenerar types/database.types.ts
npm run db:push               # Push de migraciones a Supabase cloud
```

Variables de entorno requeridas (`.env.local`):
```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
NUXT_PUBLIC_SITE_URL=
```

---

## Checklist para nuevo módulo

1. `supabase/migrations/YYYYMMDD_create_{module}_table.sql`
2. `npm run db:migration:up && npm run db:types`
3. `app/composables/use{Module}.ts`
4. `app/components/{Module}/Form.vue`
5. `app/pages/admin/{module}/index.vue` (listado)
6. `app/pages/admin/{module}/create.vue` (creación)
7. `app/pages/admin/{module}/[id]/index.vue` (detalle/edición)
8. Agregar entrada en el sidebar de `app/layouts/admin.vue`

---

## Convenciones de commits y branches

### Commits — Conventional Commits (inglés)
```
feat(partners): add partner search by category
fix(orders): correct total calculation on discount
refactor(composables): extract pagination logic
docs(readme): update installation instructions
chore(deps): update supabase-js to v2.92
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `style`, `chore`, `test`, `perf`

### Branches
- `main` — producción estable
- `develop` — integración de features
- `feat/{nombre}` — nuevas funcionalidades
- `fix/{nombre}` — correcciones
- `refactor/{nombre}` — refactorizaciones

---

## Archivos sensibles — NO commitear

- `.env`, `.env.local`, `.env.production`
- `supabase/.env`
- Cualquier archivo con claves API o secretos
