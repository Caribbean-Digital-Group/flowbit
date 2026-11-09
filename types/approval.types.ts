import type { Database } from './database.types'

/**
 * Tipos temporales del motor de aprobaciones (TRY-18).
 *
 * `types/database.types.ts` aún no incluye las migraciones
 * `20261108120000` a `20261108120300`. Este shim replica el shape que generará
 * Supabase para mantener TypeScript estricto sin `any`.
 *
 * Tras correr `npm run db:push && npm run db:types` pueden sustituirse por
 * `Tables<'approval_flow'>`, etc., y este archivo puede eliminarse.
 *
 * Solo tipos: las constantes viven en `app/utils/approvals.ts`.
 */

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Audit = {
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type View<Row> = { Row: Row; Relationships: [] }

// ─── Catálogos ──────────────────────────────────────────────────────────────

export type ApprovalRequestStatus =
  | 'draft' | 'published' | 'approved' | 'rejected' | 'cancelled' | 'returned' | 'expired'
export type ApprovalPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ApprovalStepMode = 'any' | 'all' | 'quorum'
export type ApprovalStepStatus = 'waiting' | 'active' | 'approved' | 'rejected' | 'skipped' | 'cancelled'
export type ApprovalApproverStatus =
  | 'pending' | 'approved' | 'rejected' | 'revoked' | 'skipped' | 'reassigned' | 'informed' | 'cancelled'
export type ApprovalApproverKind =
  | 'manager' | 'category_managers' | 'owners' | 'direct_manager' | 'manager_chain' | 'department_manager'
export type ApprovalEscalationAction = 'remind' | 'escalate_manager' | 'escalate_owners' | 'auto_approve' | 'auto_reject'
export type ApprovalFieldType =
  | 'text' | 'textarea' | 'number' | 'money' | 'date' | 'daterange' | 'select' | 'partner' | 'employee' | 'product'
export type ApprovalConditionOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'not_in' | 'contains' | 'empty' | 'not_empty'

export interface ApprovalFieldDefinition {
  key: string
  label: string
  type: ApprovalFieldType
  required?: boolean
  options?: string[]
  help?: string
}

export interface ApprovalConditionRule {
  field: string
  op: ApprovalConditionOp
  value?: string | number | Array<string | number> | null
}

export interface ApprovalCondition {
  match: 'all' | 'any'
  rules: ApprovalConditionRule[]
}

export type ApprovalFieldValues = Record<string, string | number | boolean | null | { from?: string; to?: string }>

// ─── Configuración ──────────────────────────────────────────────────────────

export type ApprovalSettingsRow = Audit & {
  company_id: string
  advanced_enabled: boolean
  restart_from_first: boolean
  prevent_self_approval: boolean
  self_approval_fallback: 'next_level' | 'owners'
  dedupe_consecutive: boolean
  require_reject_reason: boolean
  notify_requester_each_level: boolean
  default_sla_days: number | null
  reminder_every_hours: number
  escalation_action: ApprovalEscalationAction
  expire_after_days: number | null
}

export type ApprovalCategoryRow = Database['public']['Tables']['approval_category']['Row'] & {
  color: string | null
  icon: string | null
  flow_id: string | null
  field_schema: ApprovalFieldDefinition[]
  allow_lines: boolean
  require_attachment: boolean
  confidential: boolean
  critical_fields: string[]
  sla_days: number | null
  auto_approve_max_amount: number | null
  source_kind: string | null
}

export type ApprovalCategoryInsert = Database['public']['Tables']['approval_category']['Insert']
  & Partial<Omit<ApprovalCategoryRow, keyof Database['public']['Tables']['approval_category']['Row']>>
export type ApprovalCategoryUpdate = Partial<ApprovalCategoryRow>

export type ApprovalManagerRow = Database['public']['Tables']['approval_manager']['Row'] & {
  max_amount: number | null
}

export type ApprovalManagerCategoryRow = {
  approval_manager_id: string
  approval_category_id: string
  max_amount: number | null
}

export type ApprovalFlowRow = Audit & {
  id: string
  company_id: string
  name: string
  description: string | null
  restart_from_first: boolean | null
  version: number
  active: boolean
}

export type ApprovalFlowStepRow = Audit & {
  id: string
  company_id: string
  flow_id: string
  sequence: number
  name: string
  mode: ApprovalStepMode
  quorum: number | null
  informative: boolean
  condition: ApprovalCondition | null
  sla_days: number | null
  active: boolean
}

export type ApprovalFlowStepApproverRow = Audit & {
  id: string
  company_id: string
  step_id: string
  kind: ApprovalApproverKind
  approval_manager_id: string | null
  active: boolean
}

export type ApprovalRejectionReasonRow = Audit & {
  id: string
  company_id: string
  name: string
  active: boolean
}

export type ApprovalDelegationRow = Audit & {
  id: string
  company_id: string
  from_partner_id: string
  to_partner_id: string
  category_id: string | null
  starts_on: string | null
  ends_on: string | null
  reason: string | null
  active: boolean
}

// ─── Solicitudes ────────────────────────────────────────────────────────────

type BaseRequestRow = Database['public']['Tables']['approval_request']['Row']

export type ApprovalRequestRow = Omit<BaseRequestRow, 'status'> & {
  status: ApprovalRequestStatus
  priority: ApprovalPriority
  due_date: string | null
  field_values: ApprovalFieldValues
  captured_by_partner_id: string | null
  source_type: string | null
  source_id: string | null
  flow_id: string | null
  flow_version: number | null
  round: number
  returned_from_sequence: number | null
  submitted_at: string | null
  returned_at: string | null
  cancelled_at: string | null
  expired_at: string | null
  resolution_note: string | null
  rejection_reason_id: string | null
  resolved_by_partner_id: string | null
  forced: boolean
  auto_approved: boolean
}

export type ApprovalRequestInsert = Omit<Database['public']['Tables']['approval_request']['Insert'], 'status' | 'request_number'> & {
  /** Lo asigna un trigger por empresa. */
  request_number?: number
  status?: 'draft'
  priority?: ApprovalPriority
  due_date?: string | null
  field_values?: ApprovalFieldValues
  captured_by_partner_id?: string | null
}

export type ApprovalRequestUpdate = Partial<Pick<ApprovalRequestRow,
  'title' | 'category_id' | 'request_date' | 'description' | 'amount' | 'currency' | 'reference'
  | 'assigned_approval_manager_id' | 'priority' | 'due_date' | 'field_values' | 'requesting_partner_id'
  | 'captured_by_partner_id' | 'updated_by'>>

export type ApprovalRequestLineRow = Audit & {
  id: string
  company_id: string
  request_id: string
  sequence: number
  concept: string
  product_id: string | null
  quantity: number
  unit_price: number
  subtotal: number
  active: boolean
}

export type ApprovalRequestLineInsert = Omit<ApprovalRequestLineRow, 'id' | 'subtotal' | keyof Audit | 'active'>
  & Partial<Pick<ApprovalRequestLineRow, 'id' | 'active'>>

export type ApprovalRequestStepRow = {
  id: string
  company_id: string
  request_id: string
  round: number
  sequence: number
  name: string
  mode: ApprovalStepMode
  quorum: number | null
  informative: boolean
  sla_days: number | null
  flow_step_id: string | null
  status: ApprovalStepStatus
  activated_at: string | null
  due_at: string | null
  completed_at: string | null
  escalated_at: string | null
  note: string | null
  ad_hoc: boolean
  added_by_partner_id: string | null
  created_at: string
  updated_at: string
}

export type ApprovalRequestApproverRow = {
  id: string
  company_id: string
  request_id: string
  step_id: string
  partner_id: string
  delegated_from_partner_id: string | null
  resolved_via: string
  status: ApprovalApproverStatus
  decided_at: string | null
  comment: string | null
  last_reminder_at: string | null
  created_at: string
  updated_at: string
}

export type ApprovalRequestEventRow = {
  id: string
  company_id: string
  request_id: string
  seq: number
  event_type: string
  actor_user_id: string | null
  actor_partner_id: string | null
  automatic: boolean
  payload: { [key: string]: Json | undefined }
  ip: string | null
  user_agent: string | null
  created_at: string
  prev_hash: string | null
  hash: string
}

export type ApprovalRequestCommentRow = Audit & {
  id: string
  company_id: string
  request_id: string
  author_partner_id: string
  body: string
  mentions: string[]
  active: boolean
}

export type ApprovalRequestAttachmentRow = Audit & {
  id: string
  company_id: string
  request_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by_partner_id: string | null
  active: boolean
}

export type ApprovalActivityRow = {
  id: string
  company_id: string
  partner_id: string
  request_id: string
  kind: string
  title: string
  scheduled_at: string
  actionable: boolean
  read_at: string | null
  done_at: string | null
  created_at: string
  updated_at: string
}

export interface ApprovalTemplatePayload {
  title?: string
  description?: string | null
  amount?: number | null
  currency?: string
  priority?: ApprovalPriority
  field_values?: ApprovalFieldValues
  lines?: Array<{ concept: string; quantity: number; unit_price: number }>
  assigned_approval_manager_id?: string | null
}

export type ApprovalRequestTemplateRow = Audit & {
  id: string
  company_id: string
  owner_partner_id: string | null
  name: string
  category_id: string
  payload: ApprovalTemplatePayload
  recurrence: 'weekly' | 'monthly' | null
  next_run_on: string | null
  active: boolean
}

// ─── Vistas ─────────────────────────────────────────────────────────────────

type BaseRequestView = Database['public']['Views']['v_approval_requests']['Row']

export type ApprovalRequestViewRow = Omit<BaseRequestView, 'status'> & {
  status: ApprovalRequestStatus | null
  category_color: string | null
  category_confidential: boolean | null
  priority: ApprovalPriority | null
  due_date: string | null
  submitted_at: string | null
  returned_at: string | null
  cancelled_at: string | null
  expired_at: string | null
  resolution_note: string | null
  forced: boolean | null
  auto_approved: boolean | null
  source_type: string | null
  source_id: string | null
  round: number | null
  captured_by_partner_id: string | null
  captured_by_display: string | null
  resolved_by_partner_id: string | null
  resolved_by_display: string | null
  current_sequence: number | null
  current_step_name: string | null
  current_due_at: string | null
  is_overdue: boolean | null
  pending_approvers_display: string | null
  total_levels: number | null
}

export type ApprovalMyPendingRow = {
  approver_id: string
  request_id: string
  company_id: string
  step_id: string
  step_name: string
  sequence: number
  due_at: string | null
  is_overdue: boolean
  delegated_from_partner_id: string | null
  delegated_from_display: string | null
  resolved_via: string
  activated_at: string | null
}

// ─── Respuestas JSON de los RPC ─────────────────────────────────────────────

export interface ApprovalPlanApprover {
  partner_id: string
  name: string | null
  resolved_via: string
  delegated_from?: string | null
  delegated_from_name?: string | null
}

export interface ApprovalPlanStep {
  sequence: number
  name: string
  mode: ApprovalStepMode
  quorum: number | null
  informative: boolean
  sla_days: number | null
  flow_step_id: string | null
  skipped?: boolean
  note?: string | null
  approvers: ApprovalPlanApprover[]
}

export interface ApprovalInsights {
  requester_average: number | null
  requester_approved_count: number
  previous: Array<{ id: string; request_number: number; title: string; status: ApprovalRequestStatus; amount: number | null; currency: string; created_at: string }>
  duplicates: Array<{ id: string; request_number: number; title: string; status: ApprovalRequestStatus }>
  flags: Array<{ code: string; message: string }>
  chain: { ok: boolean; events: number; broken_at_seq?: number; last_hash?: string | null }
}

export interface ApprovalBulkResult {
  id: string
  ok: boolean
  error?: string
}

export interface ApprovalDashboard {
  summary: {
    created: number
    approved: number
    rejected: number
    pending: number
    returned: number
    overdue: number
    amount_approved: number
    avg_resolution_hours: number | null
  }
  by_category: Array<{ category: string; total: number; approved: number; rejected: number; pending: number; amount_approved: number; avg_hours: number | null }>
  approvers: Array<{ partner_id: string; name: string; pending: number; decided: number; avg_response_hours: number | null }>
  by_level: Array<{ step: string; completed: number; avg_hours: number | null }>
  monthly: Array<{ month: string; created: number; approved: number; rejected: number; avg_hours: number | null }>
  by_requester: Array<{ name: string; count: number; amount: number }>
  by_department: Array<{ department: string; count: number; amount: number }>
  compliance: {
    forced: Array<{ id: string; request_number: number; title: string; status: ApprovalRequestStatus; by: string | null; note: string | null; at: string }>
    auto_approved: number
    ad_hoc_steps: number
    reassignments: number
    escalations: number
    active_delegations: Array<{ from: string; to: string; category: string | null; starts_on: string | null; ends_on: string | null }>
    flow_changes: Array<{ flow: string; version: number; updated_at: string }>
  }
}

export interface ApprovalImportReport {
  flows: number
  categories: number
  skipped_approvers: Array<{ flow: string; step: string; manager_email: string | null }>
}

// ─── Base de datos con el shim ──────────────────────────────────────────────

type ApprovalTables = {
  approval_settings: Table<ApprovalSettingsRow, Partial<ApprovalSettingsRow> & { company_id: string }, Partial<ApprovalSettingsRow>>
  approval_category: Table<ApprovalCategoryRow, ApprovalCategoryInsert, ApprovalCategoryUpdate>
  approval_manager: Table<ApprovalManagerRow, Database['public']['Tables']['approval_manager']['Insert'] & { max_amount?: number | null }, Partial<ApprovalManagerRow>>
  approval_manager_category: Table<ApprovalManagerCategoryRow, Omit<ApprovalManagerCategoryRow, 'max_amount'> & { max_amount?: number | null }>
  approval_flow: Table<ApprovalFlowRow, Partial<ApprovalFlowRow> & { company_id: string; name: string }>
  approval_flow_step: Table<ApprovalFlowStepRow, Partial<ApprovalFlowStepRow> & { company_id: string; flow_id: string; name: string }>
  approval_flow_step_approver: Table<ApprovalFlowStepApproverRow, Partial<ApprovalFlowStepApproverRow> & { company_id: string; step_id: string; kind: ApprovalApproverKind }>
  approval_rejection_reason: Table<ApprovalRejectionReasonRow, Partial<ApprovalRejectionReasonRow> & { company_id: string; name: string }>
  approval_delegation: Table<ApprovalDelegationRow, Partial<ApprovalDelegationRow> & { company_id: string; from_partner_id: string; to_partner_id: string }>
  approval_request: Table<ApprovalRequestRow, ApprovalRequestInsert, ApprovalRequestUpdate>
  approval_request_line: Table<ApprovalRequestLineRow, ApprovalRequestLineInsert & Partial<Pick<Audit, 'created_by' | 'updated_by'>>, Partial<ApprovalRequestLineInsert>>
  approval_request_step: Table<ApprovalRequestStepRow, never, never>
  approval_request_approver: Table<ApprovalRequestApproverRow, never, never>
  approval_request_event: Table<ApprovalRequestEventRow, never, never>
  approval_request_comment: Table<ApprovalRequestCommentRow, never, never>
  approval_request_attachment: Table<ApprovalRequestAttachmentRow, Omit<ApprovalRequestAttachmentRow, 'id' | 'active' | keyof Audit> & Partial<Pick<Audit, 'created_by' | 'updated_by'>>, Partial<Pick<ApprovalRequestAttachmentRow, 'active'>>>
  approval_activity: Table<ApprovalActivityRow, never, Partial<Pick<ApprovalActivityRow, 'read_at' | 'done_at'>>>
  approval_request_template: Table<ApprovalRequestTemplateRow, Partial<ApprovalRequestTemplateRow> & { company_id: string; name: string; category_id: string }>
}

type ApprovalViews = {
  v_approval_requests: View<ApprovalRequestViewRow>
  v_approval_my_pending: View<ApprovalMyPendingRow>
}

/**
 * Las definiciones del shim reemplazan a las generadas (Omit) en lugar de
 * intersectarse con ellas: tras `db:types`, `Json & TablaTipada` no admite valores.
 */
export type ApprovalDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Views'> & {
    Tables: Omit<Database['public']['Tables'], keyof ApprovalTables> & ApprovalTables
    Views: Omit<Database['public']['Views'], keyof ApprovalViews> & ApprovalViews
  }
}
