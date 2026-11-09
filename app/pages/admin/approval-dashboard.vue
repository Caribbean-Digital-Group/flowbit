<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { StatItem } from '~/components/StatGrid.vue'
import type { ApprovalDashboard } from '~/types/approval.types'
import { approvalStatusLabel, buildCsv, downloadText, formatDateTimeMx, formatHours, formatMoneyMx } from '~/utils/approvals'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getDashboard, lastError } = useApprovalSettings()

const today = new Date()
const from = ref(new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10))
const to = ref(today.toISOString().slice(0, 10))
const data = ref<ApprovalDashboard | null>(null)
const isLoading = ref(false)

const load = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try {
    data.value = await getDashboard(cid, from.value, to.value)
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, from, to], load, { immediate: true })

const stats = computed<StatItem[]>(() => {
  const s = data.value?.summary
  if (!s) return []
  const decided = s.approved + s.rejected
  return [
    { label: 'Pendientes ahora', value: s.pending, change: s.overdue ? `${s.overdue} vencidas` : 'Ninguna vencida', trend: s.overdue ? 'down' : 'neutral' },
    { label: 'Tiempo promedio de resolución', value: formatHours(s.avg_resolution_hours) },
    { label: 'Tasa de aprobación', value: decided ? `${Math.round((s.approved / decided) * 100)} %` : '—', change: `${s.approved} aprobadas · ${s.rejected} rechazadas`, trend: 'neutral' },
    { label: 'Monto aprobado', value: formatMoneyMx(s.amount_approved) }
  ]
})

const monthly = computed(() => data.value?.monthly ?? [])
const monthlyMax = computed(() => Math.max(1, ...monthly.value.map(m => Math.max(m.created, m.approved + m.rejected))))
const monthName = (ym: string): string =>
  new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(new Date(`${ym}-15T12:00:00`))

const exportApprovers = (): void => {
  if (!data.value) return
  downloadText('aprobaciones-aprobadores.csv', buildCsv(data.value.approvers, [
    { label: 'Aprobador', value: r => r.name },
    { label: 'Pendientes', value: r => r.pending },
    { label: 'Decididas en el periodo', value: r => r.decided },
    { label: 'Respuesta promedio (h)', value: r => r.avg_response_hours }
  ]))
}

const exportCategories = (): void => {
  if (!data.value) return
  downloadText('aprobaciones-categorias.csv', buildCsv(data.value.by_category, [
    { label: 'Categoría', value: r => r.category },
    { label: 'Total', value: r => r.total },
    { label: 'Aprobadas', value: r => r.approved },
    { label: 'Rechazadas', value: r => r.rejected },
    { label: 'Pendientes', value: r => r.pending },
    { label: 'Monto aprobado', value: r => r.amount_approved },
    { label: 'Horas promedio', value: r => r.avg_hours }
  ]))
}

const card = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50'
const th = 'py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
</script>

<template>
  <div class="w-full space-y-6 py-4">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Tablero de aprobaciones</h1>
        <p class="text-sm text-slate-500">Tiempos, cuellos de botella, gasto y cumplimiento.</p>
      </div>
      <div class="flex gap-3">
        <FormInput v-model="from" label="Desde" type="date" size="sm" />
        <FormInput v-model="to" label="Hasta" type="date" size="sm" />
      </div>
    </div>

    <p v-if="lastError" class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{{ lastError }}</p>

    <StatGrid :stats="stats" :columns="4" :loading="isLoading" />

    <template v-if="data">
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section :class="card">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-bold text-slate-800">Cuellos de botella</h2>
            <BtnApp variant="ghost" size="sm" label="CSV" @click="exportApprovers" />
          </div>
          <table class="w-full text-sm">
            <thead><tr><th :class="th">Aprobador</th><th :class="th">Pendientes</th><th :class="th">Decididas</th><th :class="th">Respuesta</th></tr></thead>
            <tbody>
              <tr v-for="a in data.approvers" :key="a.partner_id" class="border-t border-slate-100">
                <td class="py-2">{{ a.name }}</td>
                <td class="py-2" :class="a.pending > 5 ? 'font-bold text-red-600' : ''">{{ a.pending }}</td>
                <td class="py-2">{{ a.decided }}</td>
                <td class="py-2">{{ formatHours(a.avg_response_hours) }}</td>
              </tr>
              <tr v-if="!data.approvers.length"><td colspan="4" class="py-3 text-slate-500">Sin datos.</td></tr>
            </tbody>
          </table>
        </section>

        <section :class="card">
          <h2 class="mb-3 font-bold text-slate-800">Dónde se detienen (tiempo por nivel)</h2>
          <table class="w-full text-sm">
            <thead><tr><th :class="th">Nivel</th><th :class="th">Completados</th><th :class="th">Promedio</th></tr></thead>
            <tbody>
              <tr v-for="l in data.by_level" :key="l.step" class="border-t border-slate-100">
                <td class="py-2">{{ l.step }}</td><td class="py-2">{{ l.completed }}</td><td class="py-2">{{ formatHours(l.avg_hours) }}</td>
              </tr>
              <tr v-if="!data.by_level.length"><td colspan="3" class="py-3 text-slate-500">Sin datos.</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <section :class="card">
        <h2 class="mb-3 font-bold text-slate-800">Tendencia mensual</h2>
        <div v-if="monthly.length" class="flex h-48 items-end gap-3 overflow-x-auto">
          <div v-for="m in monthly" :key="m.month" class="flex min-w-[3.5rem] flex-1 flex-col items-center gap-1">
            <div class="flex h-36 w-full items-end justify-center gap-1" :title="`${m.created} creadas · ${m.approved} aprobadas · ${m.rejected} rechazadas · ciclo ${formatHours(m.avg_hours)}`">
              <span class="w-3 rounded-t bg-slate-300" :style="{ height: `${(m.created / monthlyMax) * 100}%` }" />
              <span class="w-3 rounded-t bg-emerald-500" :style="{ height: `${(m.approved / monthlyMax) * 100}%` }" />
              <span class="w-3 rounded-t bg-red-400" :style="{ height: `${(m.rejected / monthlyMax) * 100}%` }" />
            </div>
            <span class="text-xs text-slate-500">{{ monthName(m.month) }}</span>
          </div>
        </div>
        <div v-if="monthly.length" class="mt-3 flex gap-4 text-xs text-slate-500">
          <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded bg-slate-300" />Creadas</span>
          <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded bg-emerald-500" />Aprobadas</span>
          <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded bg-red-400" />Rechazadas</span>
        </div>
        <p v-if="!monthly.length" class="text-sm text-slate-500">Sin datos en el periodo.</p>
      </section>

      <section :class="card">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-bold text-slate-800">Por categoría</h2>
          <BtnApp variant="ghost" size="sm" label="CSV" @click="exportCategories" />
        </div>
        <table class="w-full text-sm">
          <thead><tr><th :class="th">Categoría</th><th :class="th">Total</th><th :class="th">Aprobadas</th><th :class="th">Rechazadas</th><th :class="th">Pendientes</th><th :class="th">Monto aprobado</th><th :class="th">Ciclo</th></tr></thead>
          <tbody>
            <tr v-for="c in data.by_category" :key="c.category" class="border-t border-slate-100">
              <td class="py-2">{{ c.category }}</td><td class="py-2">{{ c.total }}</td><td class="py-2">{{ c.approved }}</td>
              <td class="py-2">{{ c.rejected }}</td><td class="py-2">{{ c.pending }}</td>
              <td class="py-2">{{ formatMoneyMx(c.amount_approved) }}</td><td class="py-2">{{ formatHours(c.avg_hours) }}</td>
            </tr>
            <tr v-if="!data.by_category.length"><td colspan="7" class="py-3 text-slate-500">Sin datos.</td></tr>
          </tbody>
        </table>
      </section>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section :class="card">
          <h2 class="mb-3 font-bold text-slate-800">Gasto aprobado por solicitante</h2>
          <ul class="space-y-2 text-sm">
            <li v-for="r in data.by_requester" :key="r.name" class="flex justify-between"><span>{{ r.name }} <span class="text-slate-400">({{ r.count }})</span></span><span class="font-semibold">{{ formatMoneyMx(r.amount) }}</span></li>
            <li v-if="!data.by_requester.length" class="text-slate-500">Sin datos.</li>
          </ul>
        </section>
        <section :class="card">
          <h2 class="mb-3 font-bold text-slate-800">Gasto aprobado por departamento</h2>
          <ul class="space-y-2 text-sm">
            <li v-for="d in data.by_department" :key="d.department" class="flex justify-between"><span>{{ d.department }} <span class="text-slate-400">({{ d.count }})</span></span><span class="font-semibold">{{ formatMoneyMx(d.amount) }}</span></li>
            <li v-if="!data.by_department.length" class="text-slate-500">Sin datos.</li>
          </ul>
        </section>
      </div>

      <section :class="card">
        <h2 class="mb-1 font-bold text-slate-800">Cumplimiento</h2>
        <p class="mb-4 text-sm text-slate-500">Lo que se resolvió fuera de la regla en el periodo.</p>
        <div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div class="rounded-xl bg-slate-50 px-4 py-3"><p class="text-xs text-slate-500">Forzadas</p><p class="text-xl font-bold">{{ data.compliance.forced.length }}</p></div>
          <div class="rounded-xl bg-slate-50 px-4 py-3"><p class="text-xs text-slate-500">Aprobadas automáticamente</p><p class="text-xl font-bold">{{ data.compliance.auto_approved }}</p></div>
          <div class="rounded-xl bg-slate-50 px-4 py-3"><p class="text-xs text-slate-500">Niveles agregados</p><p class="text-xl font-bold">{{ data.compliance.ad_hoc_steps }}</p></div>
          <div class="rounded-xl bg-slate-50 px-4 py-3"><p class="text-xs text-slate-500">Reasignaciones / escalamientos</p><p class="text-xl font-bold">{{ data.compliance.reassignments }} / {{ data.compliance.escalations }}</p></div>
        </div>
        <h3 class="mb-2 text-sm font-semibold text-slate-700">Resoluciones forzadas</h3>
        <ul class="mb-4 space-y-1 text-sm">
          <li v-for="f in data.compliance.forced" :key="f.id">
            <NuxtLink :to="`/admin/approval-requests/${f.id}`" class="text-indigo-700 hover:underline">#{{ f.request_number }} {{ f.title }}</NuxtLink>
            · {{ approvalStatusLabel(f.status) }} por {{ f.by ?? '—' }} · {{ formatDateTimeMx(f.at) }} · «{{ f.note }}»
          </li>
          <li v-if="!data.compliance.forced.length" class="text-slate-500">Ninguna.</li>
        </ul>
        <h3 class="mb-2 text-sm font-semibold text-slate-700">Delegaciones activas</h3>
        <ul class="mb-4 space-y-1 text-sm">
          <li v-for="(d, i) in data.compliance.active_delegations" :key="i">{{ d.from }} → {{ d.to }} · {{ d.category ?? 'todas' }} · {{ d.ends_on ? `hasta ${d.ends_on}` : 'permanente' }}</li>
          <li v-if="!data.compliance.active_delegations.length" class="text-slate-500">Ninguna.</li>
        </ul>
        <h3 class="mb-2 text-sm font-semibold text-slate-700">Cambios de flujos</h3>
        <ul class="space-y-1 text-sm">
          <li v-for="(c, i) in data.compliance.flow_changes" :key="i">{{ c.flow }} · versión {{ c.version }} · {{ formatDateTimeMx(c.updated_at) }}</li>
          <li v-if="!data.compliance.flow_changes.length" class="text-slate-500">Ninguno.</li>
        </ul>
      </section>
    </template>
  </div>
</template>
