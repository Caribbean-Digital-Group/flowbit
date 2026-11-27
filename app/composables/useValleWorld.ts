import type { ValleAgendaItem, ValleDepartment, VallePayrollPeriod, ValleWorldData } from '~/utils/valle/summary'
import { emptyWorldData } from '~/utils/valle/summary'
import type { LocationId } from '~/utils/valle/types'
import { presetRange, previousRange } from '~/utils/dashboard'
import { expenseTotal } from '~/utils/expenses'
import { PAYROLL_STATUS_LABELS } from '~/utils/payroll'
import { localDateKey } from '~/utils/dates'

const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Datos del mundo de Valle Bit para la empresa en uso.
 *
 * No hay consultas propias: reutiliza los composables del panel, así que cada
 * persona ve exactamente lo que su rol ya le permite ver en `/admin` (mismo RLS).
 * Los marcadores se cargan al entrar; Gremio, Tesorería y Tablón, al visitarlos.
 */
export const useValleWorld = () => {
  const authStore = useAuthStore()
  const { getSalesKpis } = useSalesReport()
  const { getSnapshot } = useDashboard()
  const { getPaidInRange } = useExpense()
  const { getSuggestions } = useRestock()
  const { getAll: getEmployees } = useEmployee()
  const { getPeriods } = usePayroll()
  const { getAssignedTasksForPartner } = useProjectTask()
  const { getOpenActivities } = useApprovalActivity()
  const { getActivitiesByCompany } = useCrmActivity()

  const data = ref<ValleWorldData>(emptyWorldData())
  const isLoading = ref(false)
  let requestId = 0

  const sumExpenses = (rows: { amount: number; tax_amount: number }[]): number =>
    rows.reduce((sum, row) => sum + expenseTotal(row.amount, row.tax_amount), 0)

  /** Marcadores y datos generales del mes en curso. */
  const load = async (companyId: string | null): Promise<void> => {
    const current = ++requestId
    const currency = (authStore.selectedCompany?.currency ?? 'MXN').toUpperCase()
    data.value = emptyWorldData(currency)
    if (!companyId) return

    isLoading.value = true
    const range = presetRange('this_month')
    const previous = previousRange('this_month', range)

    try {
      const [kpis, previousKpis, expenses, previousExpenses, snapshotResult, restock] = await Promise.all([
        getSalesKpis(companyId, range.from, range.to),
        getSalesKpis(companyId, previous.from, previous.to),
        getPaidInRange(companyId, range.from, range.to),
        getPaidInRange(companyId, previous.from, previous.to),
        getSnapshot(companyId, { range, comparison: previous, today: localDateKey(), timeZone: browserTimeZone() }),
        getSuggestions(companyId)
      ])
      if (current !== requestId) return

      data.value = {
        ...data.value,
        currency: (kpis?.totals.currency ?? snapshotResult.snapshot?.company_currency ?? currency).toUpperCase(),
        kpis,
        previousKpis,
        expensesPaid: sumExpenses(expenses),
        previousExpensesPaid: sumExpenses(previousExpenses),
        snapshot: snapshotResult.snapshot,
        lowStock: restock.length
      }
    } catch (error) {
      console.error('Error loading Valle Bit world:', error)
    } finally {
      if (current === requestId) isLoading.value = false
    }
  }

  const loadDepartments = async (companyId: string): Promise<ValleDepartment[]> => {
    const employees = await getEmployees(companyId)
    const groups = new Map<string, string[]>()
    for (const employee of employees) {
      if (employee.active === false) continue
      const department = employee.department_name ?? 'Sin departamento'
      const members = groups.get(department) ?? []
      members.push(employee.partner_name ?? 'Sin nombre')
      groups.set(department, members)
    }
    return [...groups.entries()]
      .map(([name, members]) => ({ name, members: members.sort((a, b) => a.localeCompare(b, 'es')) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  const loadPayroll = async (companyId: string): Promise<VallePayrollPeriod[]> => {
    const periods = await getPeriods(companyId)
    return [...periods]
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .slice(0, 12)
      .map(period => ({
        id: period.id,
        name: period.name,
        statusLabel: PAYROLL_STATUS_LABELS[period.status] ?? period.status,
        totalNet: Number(period.total_net) || 0
      }))
  }

  /** Misma composición que `/admin/agenda`: tareas propias, avisos de aprobación y seguimientos de CRM. */
  const loadAgenda = async (companyId: string): Promise<ValleAgendaItem[]> => {
    const partnerId = authStore.partner?.id
    if (!partnerId) return []
    const [tasks, approvals, activities] = await Promise.all([
      getAssignedTasksForPartner(partnerId, companyId),
      getOpenActivities(companyId, partnerId),
      getActivitiesByCompany(companyId)
    ])
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const items: (ValleAgendaItem & { at: number })[] = []

    for (const task of tasks) {
      if (!task.id || task.status === 'completed' || task.status === 'cancelled') continue
      items.push({
        id: task.id,
        kind: 'task',
        title: task.name ?? 'Tarea sin título',
        subtitle: task.project_name ?? 'Proyecto',
        route: `/admin/tasks/${task.id}`,
        overdue: Boolean(task.is_overdue),
        at: new Date(task.due_date ?? task.created_at ?? Date.now()).getTime()
      })
    }
    for (const activity of approvals) {
      const at = new Date(activity.scheduled_at).getTime()
      items.push({
        id: activity.id,
        kind: 'approval',
        title: activity.title,
        subtitle: activity.actionable ? 'Aprobación por decidir' : 'Aviso de aprobación',
        route: `/admin/approval-requests/${activity.request_id}`,
        overdue: activity.actionable && at < startOfToday.getTime(),
        at
      })
    }
    for (const activity of activities) {
      if (!activity.id || !activity.lead_id || activity.status === 'done') continue
      items.push({
        id: activity.id,
        kind: 'activity',
        title: activity.title ?? 'Actividad CRM',
        subtitle: activity.lead_name ?? 'Lead',
        route: `/admin/crm/leads/${activity.lead_id}`,
        overdue: activity.status === 'overdue',
        at: new Date(activity.scheduled_at ?? activity.created_at ?? Date.now()).getTime()
      })
    }

    return items
      .sort((a, b) => (Number.isNaN(a.at) ? Infinity : a.at) - (Number.isNaN(b.at) ? Infinity : b.at))
      .map(({ at: _at, ...item }) => item)
  }

  /** Carga, una vez por empresa, lo que solo se necesita dentro de un edificio. */
  const loadLocation = async (id: LocationId, companyId: string | null): Promise<void> => {
    if (!companyId) return
    const current = requestId
    try {
      if (id === 'gremio' && data.value.departments === null) {
        const departments = await loadDepartments(companyId)
        if (current === requestId) data.value = { ...data.value, departments }
      }
      if (id === 'tesoreria' && data.value.payrollPeriods === null) {
        const payrollPeriods = await loadPayroll(companyId)
        if (current === requestId) data.value = { ...data.value, payrollPeriods }
      }
      if (id === 'tablon' && data.value.agenda === null) {
        const agenda = await loadAgenda(companyId)
        if (current === requestId) data.value = { ...data.value, agenda }
      }
    } catch (error) {
      console.error('Error loading Valle Bit location:', error)
    }
  }

  return { data, isLoading, load, loadLocation }
}
