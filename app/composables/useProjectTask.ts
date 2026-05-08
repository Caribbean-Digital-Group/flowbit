import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type ProjectTask = Tables<'project_task'>
type ProjectTaskInsert = TablesInsert<'project_task'>
type ProjectTaskUpdate = TablesUpdate<'project_task'>
type ProjectTaskView = Database['public']['Views']['v_project_tasks']['Row']
type ProjectTaskStatus = Database['public']['Enums']['project_task_status']

export interface TaskMetrics {
  total: number
  pending: number
  inProgress: number
  completed: number
  cancelled: number
  overdue: number
  totalEstimatedHours: number
  totalActualHours: number
  totalEstimatedCost: number
  totalActualCost: number
  completionRate: number
}

export const useProjectTask = () => {
  const supabase = useSupabase()

  const getTasksByProject = async (
    projectId: string,
    options?: { active?: boolean; status?: ProjectTaskStatus }
  ): Promise<ProjectTaskView[]> => {
    if (!projectId) return []

    let query = supabase
      .from('v_project_tasks')
      .select('*')
      .eq('project_id', projectId)

    if (options?.active !== undefined) {
      query = query.eq('active', options.active)
    } else {
      query = query.eq('active', true)
    }

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    const { data, error } = await query.order('order_index').order('created_at')

    if (error) {
      console.error('Error fetching tasks by project:', error)
      return []
    }

    return data ?? []
  }

  const getTaskViewById = async (
    id: string,
    companyId: string
  ): Promise<ProjectTaskView | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('v_project_tasks')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching task view:', error)
      return null
    }

    return data
  }

  const getTasksByCompany = async (
    companyId: string,
    options?: { active?: boolean; status?: ProjectTaskStatus }
  ): Promise<ProjectTaskView[]> => {
    if (!companyId) return []

    let query = supabase
      .from('v_project_tasks')
      .select('*')
      .eq('company_id', companyId)

    if (options?.active !== undefined) {
      query = query.eq('active', options.active)
    } else {
      query = query.eq('active', true)
    }

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    const { data, error } = await query.order('due_date', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Error fetching tasks by company:', error)
      return []
    }

    return data ?? []
  }

  const getTaskById = async (
    id: string,
    companyId: string
  ): Promise<ProjectTask | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('project_task')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching task:', error)
      return null
    }

    return data
  }

  const createTask = async (
    companyId: string,
    payload: Omit<ProjectTaskInsert, 'company_id'>
  ): Promise<ProjectTask | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('project_task')
      .insert({
        ...payload,
        company_id: companyId,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating task:', error)
      return null
    }

    return data
  }

  const updateTask = async (
    id: string,
    companyId: string,
    updates: ProjectTaskUpdate
  ): Promise<ProjectTask | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('project_task')
      .update({ ...updates, updated_by: user?.id })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating task:', error)
      return null
    }

    return data
  }

  const archiveTask = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('project_task')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      console.error('Error archiving task:', error)
      return false
    }

    return true
  }

  const deleteTask = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('project_task')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting task:', error)
      return false
    }

    return true
  }

  const setTaskStatus = async (
    taskId: string,
    status: ProjectTaskStatus
  ): Promise<boolean> => {
    const { data, error } = await supabase.rpc('set_project_task_status', {
      p_task_id: taskId,
      p_new_status: status
    })

    if (error) {
      console.error('Error setting task status:', error)
      return false
    }

    return Boolean(data)
  }

  const computeAggregatedMetrics = (tasks: ProjectTaskView[]): TaskMetrics => {
    const metrics: TaskMetrics = {
      total: tasks.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      totalEstimatedCost: 0,
      totalActualCost: 0,
      completionRate: 0
    }

    if (tasks.length === 0) return metrics

    for (const task of tasks) {
      if (task.status === 'pending') metrics.pending += 1
      if (task.status === 'in_progress') metrics.inProgress += 1
      if (task.status === 'completed') metrics.completed += 1
      if (task.status === 'cancelled') metrics.cancelled += 1
      if (task.is_overdue) metrics.overdue += 1

      metrics.totalEstimatedHours += Number(task.estimated_hours ?? 0)
      metrics.totalActualHours += Number(task.actual_hours ?? 0)
      metrics.totalEstimatedCost += Number(task.estimated_cost ?? 0)
      metrics.totalActualCost += Number(task.actual_cost ?? 0)
    }

    const tracked = metrics.total - metrics.cancelled
    metrics.completionRate = tracked > 0
      ? Math.round((metrics.completed / tracked) * 100)
      : 0

    return metrics
  }

  return {
    getTasksByProject,
    getTasksByCompany,
    getTaskViewById,
    getTaskById,
    createTask,
    updateTask,
    archiveTask,
    deleteTask,
    setTaskStatus,
    computeAggregatedMetrics
  }
}
