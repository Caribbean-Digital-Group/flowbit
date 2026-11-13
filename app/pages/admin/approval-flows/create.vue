<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { createFlow, saveSteps, lastError } = useApprovalFlow()

const name = ref('')
const description = ref('')
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const save = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  if (!name.value.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  isSaving.value = true
  errorMessage.value = null
  try {
    const flow = await createFlow(cid, { name: name.value.trim(), description: description.value.trim() || null, restart_from_first: null })
    if (!flow) { errorMessage.value = lastError.value; return }
    // Punto de partida: un nivel con el jefe directo
    await saveSteps(cid, flow.id, [{
      sequence: 1, name: 'Jefe directo', mode: 'any', quorum: null, informative: false, condition: null, sla_days: null,
      approvers: [{ kind: 'direct_manager', approval_manager_id: null }]
    }])
    await router.push(`/admin/approval-flows/${flow.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="w-full py-4">
    <CardSheet
      title="Nuevo flujo de aprobación"
      subtitle="Después podrás agregar niveles, condiciones y plazos"
      :show-back-button="true"
      :show-edit-button="false"
      :is-editing="true"
      :is-loading="isSaving"
      variant="elevated"
      padding="lg"
      @back="router.push('/admin/approval-flows')"
      @save="save"
      @cancel="router.push('/admin/approval-flows')"
    >
      <p v-if="errorMessage" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{{ errorMessage }}</p>
      <div class="max-w-2xl space-y-5">
        <FormInput v-model="name" label="Nombre" placeholder="Compras por monto" required />
        <FormTextArea v-model="description" label="Descripción" placeholder="Jefe directo; Dirección desde $50,000" :rows="3" />
      </div>
    </CardSheet>
  </div>
</template>
