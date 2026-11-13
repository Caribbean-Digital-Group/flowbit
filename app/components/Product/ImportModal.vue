<script setup lang="ts">
import { PRODUCT_CSV_TEMPLATE, parseCsv, validateProductRows } from '~/utils/csvImport'
import type { ImportValidation, ProductImportRow } from '~/utils/csvImport'

interface Props {
  modelValue: boolean
  companyId: string | null
  existingSkus?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  existingSkus: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  imported: [count: number]
}>()

const { createProduct } = useProduct()

const fileName = ref('')
const validation = ref<(ImportValidation<ProductImportRow> & { missingColumns: string[] }) | null>(null)
const isImporting = ref(false)
const failed = ref<{ line: number; message: string }[]>([])

const validCount = computed(() => validation.value?.valid.length ?? 0)

const close = () => {
  emit('update:modelValue', false)
  fileName.value = ''
  validation.value = null
  failed.value = []
}

const onFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = file.name
  failed.value = []
  validation.value = validateProductRows(parseCsv(await file.text()), props.existingSkus)
}

const downloadTemplate = () => {
  const blob = new Blob([`﻿${PRODUCT_CSV_TEMPLATE}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-productos.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const runImport = async () => {
  if (!props.companyId || !validation.value) return
  isImporting.value = true
  failed.value = []
  let ok = 0
  try {
    for (const { line, data } of validation.value.valid) {
      const created = await createProduct(props.companyId, {
        name: data.name,
        sku: data.sku,
        product_type: data.product_type,
        sale_price: data.sale_price,
        cost_price: data.cost_price,
        currency: data.currency,
        stock_quantity: data.stock_quantity,
        description: data.description,
        status: 'active'
      })
      if (created) ok++
      else failed.value.push({ line, message: 'No se pudo guardar (revisa permisos o SKU duplicado)' })
    }
  } finally {
    isImporting.value = false
  }
  if (ok > 0) emit('imported', ok)
  if (failed.value.length === 0) close()
  else validation.value = { ...validation.value, valid: [] }
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    @click.self="close"
  >
    <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/50">
      <h2 class="text-xl font-bold text-slate-800">
        Importar productos desde CSV
      </h2>
      <p class="mt-1 text-sm text-slate-500">
        Columnas: nombre (obligatoria), sku, tipo, precio, costo, moneda, stock y descripcion.
        Se revisa todo antes de guardar.
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv,text/csv" class="text-sm text-slate-600" @change="onFile">
        <button type="button" class="text-sm font-medium text-indigo-600 hover:underline" @click="downloadTemplate">
          Descargar plantilla
        </button>
      </div>

      <div v-if="validation" class="mt-5 space-y-3">
        <p v-if="validation.missingColumns.length" class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Falta la columna obligatoria: {{ validation.missingColumns.join(', ') }}.
        </p>
        <template v-else>
          <p class="text-sm text-slate-700">
            <span class="font-semibold text-emerald-600">{{ validCount }} filas listas</span>
            ·
            <span class="font-semibold text-red-600">{{ validation.errors.length }} con errores</span>
            <span v-if="fileName" class="text-slate-400"> ({{ fileName }})</span>
          </p>
          <ul v-if="validation.errors.length || failed.length" class="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <li v-for="e in [...validation.errors, ...failed]" :key="`${e.line}-${e.message}`">
              Fila {{ e.line }}: {{ e.message }}
            </li>
          </ul>
          <p v-if="validation.errors.length" class="text-xs text-slate-500">
            Las filas con errores se omiten; corrígelas en tu archivo y vuelve a importarlas.
          </p>
        </template>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <BtnApp variant="ghost" @click="close">
          Cerrar
        </BtnApp>
        <BtnApp variant="primary" :disabled="isImporting || validCount === 0" @click="runImport">
          {{ isImporting ? 'Importando…' : `Importar ${validCount} productos` }}
        </BtnApp>
      </div>
    </div>
  </div>
</template>
