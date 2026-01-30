<script setup lang="ts">
import type { MenuOption } from '~/components/CardSheet.vue'

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

// Datos del partner (normalmente vendrían de una API)
const partner = reactive({
  // Información básica
  name: 'Acme Corporation',
  display_name: 'Acme Corp',
  email: 'contacto@acme.com',
  phone: '+52 55 1234 5678',
  mobile: '+52 55 8765 4321',
  website: 'https://www.acme.com',
  
  // Dirección
  street: 'Av. Insurgentes Sur 1234',
  street2: 'Piso 5, Oficina 501',
  city: 'Ciudad de México',
  state: 'CDMX',
  zip: '03100',
  country_code: 'MX',
  
  // Información adicional
  company_type: 'company',
  is_company: true,
  parent_id: null,
  vat: 'ACM850101ABC',
  function: 'Proveedor Principal',
  credit_limit: 50000,
  comment: 'Cliente preferente desde 2020',
  
  // Metadata
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
    console.log('Datos guardados:', partner)
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
      :title="partner.name"
      :subtitle="partner.email"
      :show-back-button="true"
      :show-options-button="true"
      :show-edit-button="true"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="partner.created_by"
      :created-at="formatDate(partner.created_at)"
      :updated-by="partner.updated_by"
      :updated-at="formatDate(partner.updated_at)"
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
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT #status: Badge de estado junto al título                        -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <template #status>
        <BadgeApp 
          :label="partner.company_type === 'company' ? 'Empresa' : 'Persona'" 
          variant="primary" 
        />
      </template>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT #headerActions: Acciones adicionales en el header (opcional)    -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <template #headerActions>
        <BtnApp variant="ghost" size="sm" @click="handleCustomAction">
          <template #iconLeft>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </template>
        </BtnApp>
      </template>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT DEFAULT: Contenido principal del card                           -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- ─────────────────────────────────────────────────────────────────── -->
        <!-- INFORMACIÓN BÁSICA                                                  -->
        <!-- ─────────────────────────────────────────────────────────────────── -->
        <div class="space-y-6">
          <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
            Información Básica
          </h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <FormInput
                v-model="partner.name"
                label="Nombre"
                placeholder="Nombre del partner"
                :readonly="!isEditing"
                required
                size="md"
              />
            </div>
            
            <div class="sm:col-span-2">
              <FormInput
                v-model="partner.display_name"
                label="Nombre para mostrar"
                placeholder="Nombre comercial o alias"
                :readonly="!isEditing"
                size="md"
              />
            </div>
            
            <FormInput
              v-model="partner.email"
              type="email"
              label="Email"
              placeholder="correo@ejemplo.com"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="partner.phone"
              type="tel"
              label="Teléfono"
              placeholder="+52 55 1234 5678"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="partner.mobile"
              type="tel"
              label="Móvil"
              placeholder="+52 55 8765 4321"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="partner.website"
              type="url"
              label="Sitio Web"
              placeholder="https://www.ejemplo.com"
              :readonly="!isEditing"
              size="md"
            />
          </div>
        </div>

        <!-- ─────────────────────────────────────────────────────────────────── -->
        <!-- INFORMACIÓN ADICIONAL                                               -->
        <!-- ─────────────────────────────────────────────────────────────────── -->
        <div class="space-y-6">
          <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
            Información Adicional
          </h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              v-model="partner.vat"
              label="RFC / NIT / RUT"
              placeholder="Identificación fiscal"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="partner.function"
              label="Cargo / Función"
              placeholder="Ej: Proveedor, Cliente"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="partner.credit_limit"
              type="number"
              label="Límite de Crédito"
              placeholder="0.00"
              :readonly="!isEditing"
              size="md"
            />
            
            <div class="sm:col-span-2">
              <FormInput
                v-model="partner.comment"
                label="Comentarios"
                placeholder="Notas adicionales sobre el partner"
                :readonly="!isEditing"
                size="md"
              />
            </div>
          </div>
          
          <!-- Dirección -->
          <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
            Dirección
          </h4>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <FormInput
                v-model="partner.street"
                label="Calle"
                placeholder="Av. Principal 123"
                :readonly="!isEditing"
                size="md"
              />
            </div>
            
            <div class="sm:col-span-2">
              <FormInput
                v-model="partner.street2"
                label="Calle 2"
                placeholder="Piso, oficina, interior"
                :readonly="!isEditing"
                size="md"
              />
            </div>
            
            <FormInput
              v-model="partner.city"
              label="Ciudad"
              placeholder="Ciudad"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="partner.state"
              label="Estado / Provincia"
              placeholder="Estado"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="partner.zip"
              label="Código Postal"
              placeholder="12345"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="partner.country_code"
              label="País"
              placeholder="MX"
              :readonly="!isEditing"
              size="md"
            />
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT #sections: Secciones adicionales después del contenido main     -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <template #sections>
        <div class="border-t border-slate-200 pt-6">
          <h3 class="text-lg font-semibold text-slate-800 mb-4">Sección Adicional</h3>
          <p class="text-slate-600">
            Este slot es útil para agregar secciones adicionales como tablas relacionadas,
            gráficos, o cualquier contenido extra.
          </p>
        </div>
      </template>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOTS OPCIONALES PARA PERSONALIZAR:                                  -->
      <!--                                                                      -->
      <!-- #backButton   → Reemplaza el botón de retroceso completo             -->
      <!-- #title        → Reemplaza el área de título/subtítulo                -->
      <!-- #options      → Reemplaza el botón de opciones (3 puntos)            -->
      <!--                 NOTA: Si pasas menuOptions como prop, se muestra     -->
      <!--                 un dropdown con las opciones. El slot #options       -->
      <!--                 permite reemplazar todo el comportamiento.           -->
      <!-- #editButton   → Reemplaza el botón de editar                         -->
      <!-- #saveButtons  → Reemplaza los botones guardar/cancelar               -->
      <!-- #footer       → Reemplaza el footer completo                         -->
      <!-- #createdBy    → Personaliza solo el valor de "creado por"            -->
      <!-- #createdAt    → Personaliza solo el valor de "creado el"             -->
      <!-- #updatedBy    → Personaliza solo el valor de "actualizado por"       -->
      <!-- #updatedAt    → Personaliza solo el valor de "actualizado el"        -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- EJEMPLO DE USO DE menuOptions:                                       -->
      <!--                                                                      -->
      <!-- const menuOptions: MenuOption[] = [                                  -->
      <!--   {                                                                  -->
      <!--     id: 'duplicate',                                                 -->
      <!--     label: 'Duplicar',                                               -->
      <!--     icon: 'M8 16H6a2...',  // Path SVG del icono                     -->
      <!--     action: () => handleDuplicate(),                                 -->
      <!--     variant: 'default'     // 'default'|'danger'|'warning'|'success' -->
      <!--   },                                                                 -->
      <!--   {                                                                  -->
      <!--     id: 'delete',                                                    -->
      <!--     label: 'Eliminar',                                               -->
      <!--     action: () => handleDelete(),                                    -->
      <!--     variant: 'danger',                                               -->
      <!--     divider: true          // Muestra línea separadora antes         -->
      <!--   }                                                                  -->
      <!-- ]                                                                    -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
    </CardSheet>
  </div>
</template>

