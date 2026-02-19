<script setup lang="ts">
import type { MenuOption } from '~/components/CardSheet.vue'
import type { PartnerFormData } from '~/components/Partner/Form.vue'

definePageMeta({
  layout: 'admin'
})

const route = useRoute()
const router = useRouter()
const { id } = route.params

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO REACTIVO
// ═══════════════════════════════════════════════════════════════════════════
const isEditing = ref(false)
const isLoading = ref(false)

// Datos del formulario (normalmente vendrían de una API)
const partnerForm = ref<PartnerFormData>({
  name: 'Acme Corporation',
  display_name: 'Acme Corp',
  email: 'contacto@acme.com',
  phone: '+52 55 1234 5678',
  mobile: '+52 55 8765 4321',
  website: 'https://www.acme.com',
  street: 'Av. Insurgentes Sur 1234',
  street2: 'Piso 5, Oficina 501',
  city: 'Ciudad de México',
  state: 'CDMX',
  zip: '03100',
  country_code: 'MX',
  vat: 'ACM850101ABC',
  function: 'Proveedor Principal',
  credit_limit: 50000,
  comment: 'Cliente preferente desde 2020'
})

// Metadata del registro (no editables desde el formulario)
const partnerMeta = reactive({
  company_type: 'company',
  is_company: true,
  parent_id: null as number | null,
  created_at: '2026-01-15T10:30:00Z',
  updated_at: '2026-01-28T15:45:00Z',
  created_by: 'Juan Pérez',
  updated_by: 'María García'
})

// ═══════════════════════════════════════════════════════════════════════════
// OPCIONES DEL MENÚ DROPDOWN
// ═══════════════════════════════════════════════════════════════════════════
const menuOptions: MenuOption[] = [
  {
    id: 'duplicate',
    label: 'Duplicar',
    icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
    action: () => handleDuplicate()
  },
  {
    id: 'export',
    label: 'Exportar PDF',
    icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    action: () => handleExportPDF()
  },
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => handleArchive(),
    variant: 'warning'
  },
  {
    id: 'delete',
    label: 'Eliminar',
    icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    action: () => handleDelete(),
    variant: 'danger',
    divider: true
  }
]

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evento @back - Se dispara al hacer click en el botón de retroceso
 */
const handleBack = () => {
  console.log('Evento: @back')
  router.push('/admin/partners')
}

/**
 * Evento @options - Se dispara al hacer click en el botón de opciones (3 puntos)
 * Nota: Este evento solo se dispara si NO se pasan menuOptions al componente
 */
const handleOptions = () => {
  console.log('Evento: @options (sin menuOptions)')
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS DE OPCIONES DEL MENÚ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Duplicar el registro actual
 */
const handleDuplicate = () => {
  console.log('Acción: Duplicar partner', id)
  // Implementar lógica de duplicación
}

/**
 * Exportar el registro a PDF
 */
const handleExportPDF = () => {
  console.log('Acción: Exportar PDF', id)
  // Implementar lógica de exportación
}

/**
 * Archivar el registro
 */
const handleArchive = () => {
  console.log('Acción: Archivar partner', id)
  // Implementar lógica de archivado
}

/**
 * Eliminar el registro
 */
const handleDelete = () => {
  console.log('Acción: Eliminar partner', id)
  // Implementar lógica de eliminación con confirmación
}

/**
 * Evento @edit - Se dispara al hacer click en el botón "Editar"
 */
const handleEdit = () => {
  console.log('Evento: @edit')
  isEditing.value = true
}

/**
 * Evento @save - Se dispara al hacer click en el botón "Guardar" (modo edición)
 */
const handleSave = async () => {
  console.log('Evento: @save')
  isLoading.value = true
  
  try {
    // Simular guardado
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('Datos guardados:', partnerForm.value)
    isEditing.value = false
  } catch (error) {
    console.error('Error al guardar:', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * Evento @cancel - Se dispara al hacer click en el botón "Cancelar" (modo edición)
 */
const handleCancel = () => {
  console.log('Evento: @cancel')
  isEditing.value = false
  // Aquí podrías revertir los cambios no guardados
}

/**
 * Acción personalizada (ejemplo de uso del slot #headerActions)
 */
const handleCustomAction = () => {
  console.log('Acción personalizada ejecutada')
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formatea una fecha ISO a formato legible
 */
const formatDate = (dateString: string): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>
<template>
  <div>
    <!-- 
      ╔═══════════════════════════════════════════════════════════════════════════╗
      ║                    EJEMPLO COMPLETO DE CardSheet                           ║
      ╠═══════════════════════════════════════════════════════════════════════════╣
      ║  Props disponibles:                                                        ║
      ║  - title: string           → Título principal                              ║
      ║  - subtitle: string        → Subtítulo                                     ║
      ║  - showBackButton: boolean → Mostrar botón atrás (default: true)           ║
      ║  - showOptionsButton: bool → Mostrar botón opciones (default: true)        ║
      ║  - showEditButton: boolean → Mostrar botón editar (default: true)          ║
      ║  - showFooter: boolean     → Mostrar footer (default: true)                ║
      ║  - isEditing: boolean      → Estado de edición (default: false)            ║
      ║  - isLoading: boolean      → Estado de carga (default: false)              ║
      ║  - createdBy: string       → Usuario que creó                              ║
      ║  - createdAt: string       → Fecha de creación                             ║
      ║  - updatedBy: string       → Usuario que actualizó                         ║
      ║  - updatedAt: string       → Fecha de actualización                        ║
      ║  - variant: string         → 'elevated' | 'flat' | 'outlined'              ║
      ║  - padding: string         → 'sm' | 'md' | 'lg' | 'xl'                     ║
      ║  - fullHeight: boolean     → Ocupar altura completa (default: false)       ║
      ║  - menuOptions: MenuOption[] → Array de opciones para dropdown             ║
      ╠═══════════════════════════════════════════════════════════════════════════╣
      ║  Eventos disponibles:                                                      ║
      ║  - @back    → Click en botón atrás                                         ║
      ║  - @options → Click en botón opciones                                      ║
      ║  - @edit    → Click en botón editar                                        ║
      ║  - @save    → Click en botón guardar (modo edición)                        ║
      ║  - @cancel  → Click en botón cancelar (modo edición)                       ║
      ╚═══════════════════════════════════════════════════════════════════════════╝
    -->
    <CardSheet
      :title="partnerForm.name"
      :subtitle="partnerForm.email"
      :show-back-button="true"
      :show-options-button="true"
      :show-edit-button="true"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="partnerMeta.created_by"
      :created-at="formatDate(partnerMeta.created_at)"
      :updated-by="partnerMeta.updated_by"
      :updated-at="formatDate(partnerMeta.updated_at)"
      :menu-options="menuOptions"
      variant="elevated"
      padding="lg"
      :full-height="false"
      @back="handleBack"
      @options="handleOptions"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancel"
    >
      <template #status>
        <BadgeApp 
          :label="partnerMeta.company_type === 'company' ? 'Empresa' : 'Persona'" 
          variant="primary" 
        />
      </template>

      <template #headerActions>
        <BtnApp variant="ghost" size="sm" @click="handleCustomAction">
          <template #iconLeft>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </template>
        </BtnApp>
      </template>

      <PartnerForm v-model="partnerForm" :readonly="!isEditing" />

      <template #sections>
        <div class="border-t border-slate-200 pt-6">
          <h3 class="text-lg font-semibold text-slate-800 mb-4">Sección Adicional</h3>
          <p class="text-slate-600">
            Este slot es útil para agregar secciones adicionales como tablas relacionadas,
            gráficos, o cualquier contenido extra.
          </p>
        </div>
      </template>
    </CardSheet>
  </div>
</template>

