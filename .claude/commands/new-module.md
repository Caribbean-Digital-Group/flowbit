Crea un módulo completo en Flowbit siguiendo el checklist estándar del proyecto.

El módulo a crear es: $ARGUMENTS

Sigue estos pasos en orden. Pide confirmación al usuario antes de ejecutar comandos de base de datos.

---

## Paso 1 — Migración SQL

Crea el archivo de migración con:
```
npm run db:migration:new create_{module}_table
```

El archivo SQL debe seguir exactamente esta estructura estándar:

```sql
CREATE TABLE IF NOT EXISTS public.{module} (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

  -- campos de negocio aquí

  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.{module} ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_{module}_updated_at
  BEFORE UPDATE ON public.{module}
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_{module}_company ON public.{module}(company_id);
CREATE INDEX idx_{module}_active  ON public.{module}(active);
```

Pregunta al usuario qué campos de negocio necesita la tabla antes de escribir el SQL.

---

## Paso 2 — Aplicar migración y regenerar tipos

Pregunta al usuario si está listo para aplicar la migración. Si confirma, ejecuta:
```
npm run db:push && npm run db:types
```

---

## Paso 3 — Composable `use{Module}.ts`

Crea `app/composables/use{Module}.ts` siguiendo el patrón estándar del proyecto:

- Importar tipos desde `~/types/database.types`: `Tables`, `TablesInsert`, `TablesUpdate`
- Obtener cliente con `useSupabase()`
- Obtener usuario con `useSupabaseUser()` para auditoría
- Implementar: `getAll`, `getById`, `create`, `update`, `archive`
- Soft delete con `.update({ active: false })` — nunca `.delete()`
- Filtrar siempre por `company_id`
- Manejar errores con `console.error` y retornar `null` / `[]`

---

## Paso 4 — Formulario `{Module}/Form.vue`

Crea `app/components/{Module}/Form.vue`:

- Bloque `<script lang="ts">` separado que exporte:
  - `interface {Module}FormData` con todos los campos editables
  - `function createEmpty{Module}Form(): {Module}FormData` como factory
- Bloque `<script setup lang="ts">` con:
  - `defineModel<{Module}FormData>()` para v-model bidireccional
  - `const props = withDefaults(defineProps<{ readonly: boolean }>(), { readonly: false })`
- Usar componentes base: `FormInput`, `FormSelect`, `FormTextArea`
- UI en español, código en inglés

---

## Paso 5 — Páginas del módulo

Crea las tres páginas bajo `app/pages/admin/{module}/`:

### `index.vue` — Listado
- `definePageMeta({ layout: 'admin' })`
- Usar componente `Datatable` con columnas relevantes
- Botón de creación que navega a `/admin/{module}/create`
- Acción de fila que navega a `/admin/{module}/[id]`

### `create.vue` — Creación
- `definePageMeta({ layout: 'admin' })`
- Usar `CardSheet` con `isEditing: true` fijo
- Inicializar `formData` con `createEmpty{Module}Form()`
- Al guardar: llamar `use{Module}().create(formData)` y navegar al detalle

### `[id]/index.vue` — Detalle / Edición
- `definePageMeta({ layout: 'admin' })`
- Cargar datos con `use{Module}().getById(id)` en `onMounted`
- Usar `CardSheet` con toggle edición/vista
- Al guardar: llamar `use{Module}().update(id, formData)`
- Opción de archivar en `menuOptions` que llama `use{Module}().archive(id)`

---

## Paso 6 — Sidebar

Agrega la entrada del módulo en `app/layouts/admin.vue` dentro del grupo de navegación correspondiente.

Pregunta al usuario en qué grupo quiere que aparezca:
1. General
2. CRM
3. Ventas/Compras
4. Inventario
5. Proyectos
6. Aprobaciones
7. Sistema

Sigue el mismo patrón SVG inline que usan los otros items del sidebar.

---

## Resumen final

Al terminar, muestra un checklist del estado de cada paso:
- [ ] Migración SQL creada
- [ ] `db:push` y `db:types` ejecutados
- [ ] Composable `use{Module}.ts` creado
- [ ] Formulario `{Module}/Form.vue` creado
- [ ] Página listado `index.vue` creada
- [ ] Página creación `create.vue` creada
- [ ] Página detalle `[id]/index.vue` creada
- [ ] Entrada en sidebar agregada
