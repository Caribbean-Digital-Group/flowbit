# Importación masiva CSV

Permite cargar muchos registros desde un archivo CSV con validación previa y reporte de errores por fila.

## Estado

| Módulo | Estado |
|---|---|
| Productos (`/admin/products` → «Importar CSV») | Disponible |
| Contactos | Pendiente (seguimiento en Linear): se crean por RPC con membresía a la empresa |

## Flujo

1. El usuario descarga la plantilla o usa su propio archivo.
2. `parseCsv` lee el archivo (comillas, saltos de línea en campos, BOM, delimitador `,` `;` o tabulador).
3. `validateProductRows` valida cada fila y devuelve filas válidas y errores con el **número de fila de la hoja** (la cabecera es la 1).
4. La vista previa muestra cuántas filas están listas y cuáles tienen error. Las filas con error se omiten.
5. Al confirmar, cada fila válida se crea con `useProduct().createProduct` (scoped por `company_id`, con auditoría).

## Columnas de productos

`nombre` (obligatoria), `sku`, `tipo` (producto/servicio/otro), `precio`, `costo`, `moneda` (3 letras, por defecto MXN), `stock`, `descripcion`. Las cabeceras en español o inglés son equivalentes.

## Reglas de validación

- Nombre obligatorio; tipo, números (≥ 0) y moneda con formato válido.
- SKU único: se rechaza si se repite en el archivo o ya existe en la empresa.
- Los importes aceptan `1,234.50`, `12,5` y `$ 99`.

## Código

- Lógica pura y probada: `app/utils/csvImport.ts`, `tests/utils/csvImport.test.ts`.
- UI: `app/components/Product/ImportModal.vue`.
- Limitación: la creación es fila a fila (sin transacción); si una falla, se reporta y las demás se guardan.
