import type { Database, Tables, TablesInsert, TablesUpdate } from './database.types'

/**
 * Tipos del tablero Kanban y los motivos de pérdida del CRM.
 *
 * `types/database.types.ts` no puede regenerarse desde esta sesión, así que
 * este shim replica las columnas agregadas en la migración
 * `20260916120000_enhance_crm_pipeline_kanban`.
 *
 * Tras correr `npm run db:types` pueden sustituirse por `Tables<'crm_lost_reason'>`,
 * `Tables<'crm_lead'>`, etc., y este archivo puede eliminarse.
 */

export type CrmStageColor =
  | 'slate'
  | 'sky'
  | 'indigo'
  | 'violet'
  | 'fuchsia'
  | 'rose'
  | 'amber'
  | 'emerald'
  | 'teal'

export type CrmLeadPriority = Database['public']['Enums']['crm_lead_priority']
export type CrmActivityType = Database['public']['Enums']['crm_activity_type']

// ── crm_lead_stage ───────────────────────────────────────────────────────────
type CrmStageExtra = {
  color: CrmStageColor
  probability: number | null
  rotting_days: number | null
}

export type CrmLeadStageRow = Tables<'crm_lead_stage'> & CrmStageExtra
export type CrmLeadStageInsert = TablesInsert<'crm_lead_stage'> & Partial<CrmStageExtra>
export type CrmLeadStageUpdate = TablesUpdate<'crm_lead_stage'> & Partial<CrmStageExtra>

// ── crm_lead ─────────────────────────────────────────────────────────────────
type CrmLeadExtra = {
  kanban_sequence: number
  stage_changed_at: string
  lost_reason_id: string | null
  lost_notes: string | null
}

export type CrmLeadRow = Tables<'crm_lead'> & CrmLeadExtra
export type CrmLeadInsert = TablesInsert<'crm_lead'> & Partial<CrmLeadExtra>
export type CrmLeadUpdate = TablesUpdate<'crm_lead'> & Partial<CrmLeadExtra>

// ── crm_lost_reason ──────────────────────────────────────────────────────────
export type CrmLostReasonRow = {
  id: string
  company_id: string
  name: string
  description: string | null
  sequence: number
  active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type CrmLostReasonInsert = Partial<CrmLostReasonRow> & { company_id: string; name: string }
export type CrmLostReasonUpdate = Partial<CrmLostReasonRow>

// ── v_crm_leads ──────────────────────────────────────────────────────────────
export type CrmLeadView = Database['public']['Views']['v_crm_leads']['Row'] & {
  kanban_sequence: number | null
  stage_changed_at: string | null
  lost_reason_id: string | null
  lost_notes: string | null
  stage_color: CrmStageColor | null
  stage_probability: number | null
  stage_rotting_days: number | null
  lost_reason_name: string | null
  next_activity_id: string | null
  next_activity_title: string | null
  next_activity_type: CrmActivityType | null
  next_activity_at: string | null
  days_in_stage: number | null
  is_rotting: boolean | null
}

/**
 * Cliente de Supabase extendido con las columnas y tablas nuevas del CRM,
 * para conservar la inferencia de tipos sin recurrir a `any`.
 */
export type CrmDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Views'> & {
    Tables: Omit<Database['public']['Tables'], 'crm_lead' | 'crm_lead_stage'> & {
      crm_lead: {
        Row: CrmLeadRow
        Insert: CrmLeadInsert
        Update: CrmLeadUpdate
        Relationships: Database['public']['Tables']['crm_lead']['Relationships']
      }
      crm_lead_stage: {
        Row: CrmLeadStageRow
        Insert: CrmLeadStageInsert
        Update: CrmLeadStageUpdate
        Relationships: Database['public']['Tables']['crm_lead_stage']['Relationships']
      }
      crm_lost_reason: {
        Row: CrmLostReasonRow
        Insert: CrmLostReasonInsert
        Update: CrmLostReasonUpdate
        Relationships: []
      }
    }
    Views: Omit<Database['public']['Views'], 'v_crm_leads'> & {
      v_crm_leads: {
        Row: CrmLeadView
        Relationships: Database['public']['Views']['v_crm_leads']['Relationships']
      }
    }
  }
}
