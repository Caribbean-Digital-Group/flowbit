export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_activity: {
        Row: {
          actionable: boolean
          company_id: string
          created_at: string
          done_at: string | null
          id: string
          kind: string
          partner_id: string
          read_at: string | null
          request_id: string
          scheduled_at: string
          title: string
          updated_at: string
        }
        Insert: {
          actionable?: boolean
          company_id: string
          created_at?: string
          done_at?: string | null
          id?: string
          kind: string
          partner_id: string
          read_at?: string | null
          request_id: string
          scheduled_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          actionable?: boolean
          company_id?: string
          created_at?: string
          done_at?: string | null
          id?: string
          kind?: string
          partner_id?: string
          read_at?: string | null
          request_id?: string
          scheduled_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_activity_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_activity_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "approval_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_activity_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "v_approval_requests"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      approval_category: {
        Row: {
          active: boolean
          allow_lines: boolean
          archived: boolean
          auto_approve_max_amount: number | null
          color: string | null
          company_id: string
          confidential: boolean
          created_at: string
          created_by: string | null
          critical_fields: string[]
          description: string | null
          field_schema: Json
          flow_id: string | null
          icon: string | null
          id: string
          internal_code: string
          name: string
          require_attachment: boolean
          sla_days: number | null
          source_kind: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          allow_lines?: boolean
          archived?: boolean
          auto_approve_max_amount?: number | null
          color?: string | null
          company_id: string
          confidential?: boolean
          created_at?: string
          created_by?: string | null
          critical_fields?: string[]
          description?: string | null
          field_schema?: Json
          flow_id?: string | null
          icon?: string | null
          id?: string
          internal_code: string
          name: string
          require_attachment?: boolean
          sla_days?: number | null
          source_kind?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          allow_lines?: boolean
          archived?: boolean
          auto_approve_max_amount?: number | null
          color?: string | null
          company_id?: string
          confidential?: boolean
          created_at?: string
          created_by?: string | null
          critical_fields?: string[]
          description?: string | null
          field_schema?: Json
          flow_id?: string | null
          icon?: string | null
          id?: string
          internal_code?: string
          name?: string
          require_attachment?: boolean
          sla_days?: number | null
          source_kind?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_category_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_category_flow_fk"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "approval_flow"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_delegation: {
        Row: {
          active: boolean
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          from_partner_id: string
          id: string
          reason: string | null
          starts_on: string | null
          to_partner_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          from_partner_id: string
          id?: string
          reason?: string | null
          starts_on?: string | null
          to_partner_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          from_partner_id?: string
          id?: string
          reason?: string | null
          starts_on?: string | null
          to_partner_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_delegation_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "approval_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_delegation_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_delegation_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_delegation_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_flow: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          restart_from_first: boolean | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          restart_from_first?: boolean | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          restart_from_first?: boolean | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_flow_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_flow_step: {
        Row: {
          active: boolean
          company_id: string
          condition: Json | null
          created_at: string
          created_by: string | null
          flow_id: string
          id: string
          informative: boolean
          mode: string
          name: string
          quorum: number | null
          sequence: number
          sla_days: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          condition?: Json | null
          created_at?: string
          created_by?: string | null
          flow_id: string
          id?: string
          informative?: boolean
          mode?: string
          name: string
          quorum?: number | null
          sequence?: number
          sla_days?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          condition?: Json | null
          created_at?: string
          created_by?: string | null
          flow_id?: string
          id?: string
          informative?: boolean
          mode?: string
          name?: string
          quorum?: number | null
          sequence?: number
          sla_days?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_flow_step_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_flow_step_flow_fk"
            columns: ["company_id", "flow_id"]
            isOneToOne: false
            referencedRelation: "approval_flow"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      approval_flow_step_approver: {
        Row: {
          active: boolean
          approval_manager_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          step_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          approval_manager_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          step_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          approval_manager_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          step_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_flow_step_approver_approval_manager_id_fkey"
            columns: ["approval_manager_id"]
            isOneToOne: false
            referencedRelation: "approval_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_flow_step_approver_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_flow_step_approver_step_fk"
            columns: ["company_id", "step_id"]
            isOneToOne: false
            referencedRelation: "approval_flow_step"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      approval_manager: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          max_amount: number | null
          notes: string | null
          partner_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_amount?: number | null
          notes?: string | null
          partner_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_amount?: number | null
          notes?: string | null
          partner_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_manager_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_manager_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_manager_category: {
        Row: {
          approval_category_id: string
          approval_manager_id: string
          max_amount: number | null
        }
        Insert: {
          approval_category_id: string
          approval_manager_id: string
          max_amount?: number | null
        }
        Update: {
          approval_category_id?: string
          approval_manager_id?: string
          max_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_manager_category_approval_category_id_fkey"
            columns: ["approval_category_id"]
            isOneToOne: false
            referencedRelation: "approval_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_manager_category_approval_manager_id_fkey"
            columns: ["approval_manager_id"]
            isOneToOne: false
            referencedRelation: "approval_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_rejection_reason: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_rejection_reason_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_request: {
        Row: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          amount?: number | null
          approved_at?: string | null
          assigned_approval_manager_id?: string | null
          auto_approved?: boolean
          cancelled_at?: string | null
          captured_by_partner_id?: string | null
          category_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          expired_at?: string | null
          field_values?: Json
          flow_id?: string | null
          flow_version?: number | null
          forced?: boolean
          id?: string
          priority?: string
          reference?: string | null
          rejected_at?: string | null
          rejection_reason_id?: string | null
          request_date?: string
          request_number: number
          requesting_partner_id: string
          resolution_note?: string | null
          resolved_by_partner_id?: string | null
          returned_at?: string | null
          returned_from_sequence?: number | null
          round?: number
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["approval_request_status"]
          submitted_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          amount?: number | null
          approved_at?: string | null
          assigned_approval_manager_id?: string | null
          auto_approved?: boolean
          cancelled_at?: string | null
          captured_by_partner_id?: string | null
          category_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          expired_at?: string | null
          field_values?: Json
          flow_id?: string | null
          flow_version?: number | null
          forced?: boolean
          id?: string
          priority?: string
          reference?: string | null
          rejected_at?: string | null
          rejection_reason_id?: string | null
          request_date?: string
          request_number?: number
          requesting_partner_id?: string
          resolution_note?: string | null
          resolved_by_partner_id?: string | null
          returned_at?: string | null
          returned_from_sequence?: number | null
          round?: number
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["approval_request_status"]
          submitted_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_assigned_approval_manager_id_fkey"
            columns: ["assigned_approval_manager_id"]
            isOneToOne: false
            referencedRelation: "approval_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_captured_by_partner_id_fkey"
            columns: ["captured_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "approval_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "approval_flow"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_rejection_reason_id_fkey"
            columns: ["rejection_reason_id"]
            isOneToOne: false
            referencedRelation: "approval_rejection_reason"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_requesting_partner_id_fkey"
            columns: ["requesting_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_resolved_by_partner_id_fkey"
            columns: ["resolved_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_request_approver: {
        Row: {
          comment: string | null
          company_id: string
          created_at: string
          decided_at: string | null
          delegated_from_partner_id: string | null
          id: string
          last_reminder_at: string | null
          partner_id: string
          request_id: string
          resolved_via: string
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          company_id: string
          created_at?: string
          decided_at?: string | null
          delegated_from_partner_id?: string | null
          id?: string
          last_reminder_at?: string | null
          partner_id: string
          request_id: string
          resolved_via?: string
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          company_id?: string
          created_at?: string
          decided_at?: string | null
          delegated_from_partner_id?: string | null
          id?: string
          last_reminder_at?: string | null
          partner_id?: string
          request_id?: string
          resolved_via?: string
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_approver_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_approver_delegated_from_partner_id_fkey"
            columns: ["delegated_from_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_approver_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_approver_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "approval_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_approver_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "v_approval_requests"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_approver_step_fk"
            columns: ["company_id", "step_id"]
            isOneToOne: false
            referencedRelation: "approval_request_step"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      approval_request_attachment: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          mime_type: string | null
          request_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          updated_by: string | null
          uploaded_by_partner_id: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          request_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by_partner_id?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          request_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by_partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_attachment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_attachment_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "approval_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_attachment_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "v_approval_requests"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_attachment_uploaded_by_partner_id_fkey"
            columns: ["uploaded_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_request_comment: {
        Row: {
          active: boolean
          author_partner_id: string
          body: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          mentions: string[]
          request_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          author_partner_id: string
          body: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          mentions?: string[]
          request_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          author_partner_id?: string
          body?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mentions?: string[]
          request_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_comment_author_partner_id_fkey"
            columns: ["author_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_comment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_comment_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "approval_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_comment_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "v_approval_requests"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      approval_request_event: {
        Row: {
          actor_partner_id: string | null
          actor_user_id: string | null
          automatic: boolean
          company_id: string
          created_at: string
          event_type: string
          hash: string
          id: string
          ip: string | null
          payload: Json
          prev_hash: string | null
          request_id: string
          seq: number
          user_agent: string | null
        }
        Insert: {
          actor_partner_id?: string | null
          actor_user_id?: string | null
          automatic?: boolean
          company_id: string
          created_at?: string
          event_type: string
          hash: string
          id?: string
          ip?: string | null
          payload?: Json
          prev_hash?: string | null
          request_id: string
          seq: number
          user_agent?: string | null
        }
        Update: {
          actor_partner_id?: string | null
          actor_user_id?: string | null
          automatic?: boolean
          company_id?: string
          created_at?: string
          event_type?: string
          hash?: string
          id?: string
          ip?: string | null
          payload?: Json
          prev_hash?: string | null
          request_id?: string
          seq?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_event_actor_partner_id_fkey"
            columns: ["actor_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_event_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_event_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "approval_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_event_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "v_approval_requests"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      approval_request_line: {
        Row: {
          active: boolean
          company_id: string
          concept: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string | null
          quantity: number
          request_id: string
          sequence: number
          subtotal: number | null
          unit_price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          concept: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          request_id: string
          sequence?: number
          subtotal?: number | null
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          concept?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          request_id?: string
          sequence?: number
          subtotal?: number | null
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_line_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "approval_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_line_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "v_approval_requests"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      approval_request_serial: {
        Row: {
          company_id: string
          last_value: number
        }
        Insert: {
          company_id: string
          last_value?: number
        }
        Update: {
          company_id?: string
          last_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_serial_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_request_step: {
        Row: {
          activated_at: string | null
          ad_hoc: boolean
          added_by_partner_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          due_at: string | null
          escalated_at: string | null
          flow_step_id: string | null
          id: string
          informative: boolean
          mode: string
          name: string
          note: string | null
          quorum: number | null
          request_id: string
          round: number
          sequence: number
          sla_days: number | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          ad_hoc?: boolean
          added_by_partner_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          escalated_at?: string | null
          flow_step_id?: string | null
          id?: string
          informative?: boolean
          mode?: string
          name: string
          note?: string | null
          quorum?: number | null
          request_id: string
          round?: number
          sequence: number
          sla_days?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          ad_hoc?: boolean
          added_by_partner_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          escalated_at?: string | null
          flow_step_id?: string | null
          id?: string
          informative?: boolean
          mode?: string
          name?: string
          note?: string | null
          quorum?: number | null
          request_id?: string
          round?: number
          sequence?: number
          sla_days?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_step_added_by_partner_id_fkey"
            columns: ["added_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_step_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_step_flow_step_id_fkey"
            columns: ["flow_step_id"]
            isOneToOne: false
            referencedRelation: "approval_flow_step"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_step_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "approval_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_step_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "v_approval_requests"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      approval_request_template: {
        Row: {
          active: boolean
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          next_run_on: string | null
          owner_partner_id: string | null
          payload: Json
          recurrence: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          category_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          next_run_on?: string | null
          owner_partner_id?: string | null
          payload?: Json
          recurrence?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          category_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          next_run_on?: string | null
          owner_partner_id?: string | null
          payload?: Json
          recurrence?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_template_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "approval_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_template_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_template_owner_partner_id_fkey"
            columns: ["owner_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_settings: {
        Row: {
          advanced_enabled: boolean
          company_id: string
          created_at: string
          created_by: string | null
          dedupe_consecutive: boolean
          default_sla_days: number | null
          escalation_action: string
          expire_after_days: number | null
          notify_requester_each_level: boolean
          prevent_self_approval: boolean
          reminder_every_hours: number
          require_reject_reason: boolean
          restart_from_first: boolean
          self_approval_fallback: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          advanced_enabled?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          dedupe_consecutive?: boolean
          default_sla_days?: number | null
          escalation_action?: string
          expire_after_days?: number | null
          notify_requester_each_level?: boolean
          prevent_self_approval?: boolean
          reminder_every_hours?: number
          require_reject_reason?: boolean
          restart_from_first?: boolean
          self_approval_fallback?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          advanced_enabled?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          dedupe_consecutive?: boolean
          default_sla_days?: number | null
          escalation_action?: string
          expire_after_days?: number | null
          notify_requester_each_level?: boolean
          prevent_self_approval?: boolean
          reminder_every_hours?: number
          require_reject_reason?: boolean
          restart_from_first?: boolean
          self_approval_fallback?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      company: {
        Row: {
          banner_url: string | null
          city: string | null
          company_size: Database["public"]["Enums"]["company_size"] | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          display_name: string | null
          email: string | null
          fiscal_regime: string | null
          founded_date: string | null
          id: string
          industry: string | null
          is_personal: boolean | null
          lang: string | null
          legal_name: string | null
          legal_representative: string | null
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          settings: Json | null
          slug: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"] | null
          street: string | null
          street2: string | null
          tz: string | null
          updated_at: string | null
          updated_by: string | null
          vat: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          banner_url?: string | null
          city?: string | null
          company_size?: Database["public"]["Enums"]["company_size"] | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          display_name?: string | null
          email?: string | null
          fiscal_regime?: string | null
          founded_date?: string | null
          id?: string
          industry?: string | null
          is_personal?: boolean | null
          lang?: string | null
          legal_name?: string | null
          legal_representative?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          street?: string | null
          street2?: string | null
          tz?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          banner_url?: string | null
          city?: string | null
          company_size?: Database["public"]["Enums"]["company_size"] | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          display_name?: string | null
          email?: string | null
          fiscal_regime?: string | null
          founded_date?: string | null
          id?: string
          industry?: string | null
          is_personal?: boolean | null
          lang?: string | null
          legal_name?: string | null
          legal_representative?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          street?: string | null
          street2?: string | null
          tz?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      crm_activity: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          done_at: string | null
          id: string
          lead_id: string
          notes: string | null
          responsible_partner_id: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["crm_activity_status"]
          title: string
          type: Database["public"]["Enums"]["crm_activity_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          responsible_partner_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["crm_activity_status"]
          title: string
          type?: Database["public"]["Enums"]["crm_activity_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          responsible_partner_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["crm_activity_status"]
          title?: string
          type?: Database["public"]["Enums"]["crm_activity_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activity_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activity_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activity_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_history: {
        Row: {
          created_at: string
          created_by: string | null
          event: Database["public"]["Enums"]["crm_history_event"]
          id: string
          lead_id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event: Database["public"]["Enums"]["crm_history_event"]
          id?: string
          lead_id: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event?: Database["public"]["Enums"]["crm_history_event"]
          id?: string
          lead_id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead: {
        Row: {
          active: boolean
          actual_close_date: string | null
          amount: number | null
          collected_amount: number
          company_id: string
          contact_company: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          expected_close_date: string | null
          id: string
          kanban_sequence: number
          lead_number: number | null
          lost_notes: string | null
          lost_reason_id: string | null
          name: string
          origin: Database["public"]["Enums"]["crm_lead_origin"]
          partner_id: string | null
          priority: Database["public"]["Enums"]["crm_lead_priority"]
          probability: number
          responsible_partner_id: string | null
          stage_changed_at: string
          stage_id: string
          tags: string[]
          updated_at: string
          updated_by: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          won_amount: number
        }
        Insert: {
          active?: boolean
          actual_close_date?: string | null
          amount?: number | null
          collected_amount?: number
          company_id: string
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          kanban_sequence?: number
          lead_number?: number | null
          lost_notes?: string | null
          lost_reason_id?: string | null
          name: string
          origin?: Database["public"]["Enums"]["crm_lead_origin"]
          partner_id?: string | null
          priority?: Database["public"]["Enums"]["crm_lead_priority"]
          probability?: number
          responsible_partner_id?: string | null
          stage_changed_at?: string
          stage_id: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          won_amount?: number
        }
        Update: {
          active?: boolean
          actual_close_date?: string | null
          amount?: number | null
          collected_amount?: number
          company_id?: string
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          kanban_sequence?: number
          lead_number?: number | null
          lost_notes?: string | null
          lost_reason_id?: string | null
          name?: string
          origin?: Database["public"]["Enums"]["crm_lead_origin"]
          partner_id?: string | null
          priority?: Database["public"]["Enums"]["crm_lead_priority"]
          probability?: number
          responsible_partner_id?: string | null
          stage_changed_at?: string
          stage_id?: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          won_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_lost_reason_id_fkey"
            columns: ["lost_reason_id"]
            isOneToOne: false
            referencedRelation: "crm_lost_reason"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_stage"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_order: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_order_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_order_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_order_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_order_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "crm_lead_order_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_stage: {
        Row: {
          active: boolean
          color: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          probability: number | null
          rotting_days: number | null
          sequence: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          color?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          probability?: number | null
          rotting_days?: number | null
          sequence?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          color?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          probability?: number | null
          rotting_days?: number | null
          sequence?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_stage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lost_reason: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          sequence: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          sequence?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          sequence?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lost_reason_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      employee: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          department_id: string | null
          employee_number: string | null
          hire_date: string | null
          id: string
          job_title: string | null
          manager_id: string | null
          partner_id: string
          status: string
          termination_date: string | null
          updated_at: string | null
          updated_by: string | null
          work_email: string | null
          work_location: string | null
          work_phone: string | null
          work_schedule_id: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          employee_number?: string | null
          hire_date?: string | null
          id?: string
          job_title?: string | null
          manager_id?: string | null
          partner_id: string
          status?: string
          termination_date?: string | null
          updated_at?: string | null
          updated_by?: string | null
          work_email?: string | null
          work_location?: string | null
          work_phone?: string | null
          work_schedule_id?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          employee_number?: string | null
          hire_date?: string | null
          id?: string
          job_title?: string | null
          manager_id?: string | null
          partner_id?: string
          status?: string
          termination_date?: string | null
          updated_at?: string | null
          updated_by?: string | null
          work_email?: string | null
          work_location?: string | null
          work_phone?: string | null
          work_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_department_fk"
            columns: ["company_id", "department_id"]
            isOneToOne: false
            referencedRelation: "employee_department"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_manager_fk"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_manager_fk"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_manager_fk"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "employee_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_work_schedule_fk"
            columns: ["company_id", "work_schedule_id"]
            isOneToOne: false
            referencedRelation: "hr_work_schedule"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      employee_department: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          manager_id: string | null
          name: string
          parent_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          manager_id?: string | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_department_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_department_manager_fk"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_department_manager_fk"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_department_manager_fk"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "employee_department_parent_fk"
            columns: ["company_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "employee_department"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      employee_private: {
        Row: {
          active: boolean | null
          bank_account: string | null
          bank_clabe: string | null
          bank_name: string | null
          birth_date: string | null
          birth_place: string | null
          cfdi_contract_type: string | null
          cfdi_contribution_base: number | null
          cfdi_employer_registration: string | null
          cfdi_integrated_daily_wage: number | null
          cfdi_job_risk: string | null
          cfdi_payment_frequency: string | null
          cfdi_payroll_regime: string | null
          cfdi_state: string | null
          cfdi_tax_regime: string | null
          cfdi_tax_zip: string | null
          cfdi_unionized: boolean
          cfdi_workday_type: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          curp: string | null
          dependents_count: number
          education_level: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_id: string
          employee_type: string
          gender: string | null
          hr_notes: string | null
          id: string
          infonavit_credit_number: string | null
          infonavit_discount_type: string
          infonavit_discount_value: number
          marital_status: string | null
          monthly_salary: number | null
          nationality: string | null
          nss: string | null
          salary_currency: string
          termination_reason: string | null
          updated_at: string | null
          updated_by: string | null
          vacation_days: number | null
          weekly_hours: number | null
        }
        Insert: {
          active?: boolean | null
          bank_account?: string | null
          bank_clabe?: string | null
          bank_name?: string | null
          birth_date?: string | null
          birth_place?: string | null
          cfdi_contract_type?: string | null
          cfdi_contribution_base?: number | null
          cfdi_employer_registration?: string | null
          cfdi_integrated_daily_wage?: number | null
          cfdi_job_risk?: string | null
          cfdi_payment_frequency?: string | null
          cfdi_payroll_regime?: string | null
          cfdi_state?: string | null
          cfdi_tax_regime?: string | null
          cfdi_tax_zip?: string | null
          cfdi_unionized?: boolean
          cfdi_workday_type?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          curp?: string | null
          dependents_count?: number
          education_level?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id: string
          employee_type?: string
          gender?: string | null
          hr_notes?: string | null
          id?: string
          infonavit_credit_number?: string | null
          infonavit_discount_type?: string
          infonavit_discount_value?: number
          marital_status?: string | null
          monthly_salary?: number | null
          nationality?: string | null
          nss?: string | null
          salary_currency?: string
          termination_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vacation_days?: number | null
          weekly_hours?: number | null
        }
        Update: {
          active?: boolean | null
          bank_account?: string | null
          bank_clabe?: string | null
          bank_name?: string | null
          birth_date?: string | null
          birth_place?: string | null
          cfdi_contract_type?: string | null
          cfdi_contribution_base?: number | null
          cfdi_employer_registration?: string | null
          cfdi_integrated_daily_wage?: number | null
          cfdi_job_risk?: string | null
          cfdi_payment_frequency?: string | null
          cfdi_payroll_regime?: string | null
          cfdi_state?: string | null
          cfdi_tax_regime?: string | null
          cfdi_tax_zip?: string | null
          cfdi_unionized?: boolean
          cfdi_workday_type?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          curp?: string | null
          dependents_count?: number
          education_level?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string
          employee_type?: string
          gender?: string | null
          hr_notes?: string | null
          id?: string
          infonavit_credit_number?: string | null
          infonavit_discount_type?: string
          infonavit_discount_value?: number
          marital_status?: string | null
          monthly_salary?: number | null
          nationality?: string | null
          nss?: string | null
          salary_currency?: string
          termination_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vacation_days?: number | null
          weekly_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_private_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_private_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_private_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_private_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
        ]
      }
      hr_absence: {
        Row: {
          absence_date: string
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          deduct_from_pay: boolean
          employee_id: string
          id: string
          kind: string
          leave_request_id: string | null
          reason: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          absence_date: string
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          deduct_from_pay?: boolean
          employee_id: string
          id?: string
          kind?: string
          leave_request_id?: string | null
          reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          absence_date?: string
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          deduct_from_pay?: boolean
          employee_id?: string
          id?: string
          kind?: string
          leave_request_id?: string | null
          reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_absence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_absence_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_absence_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_absence_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "hr_absence_leave_fk"
            columns: ["company_id", "leave_request_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_absence_leave_fk"
            columns: ["company_id", "leave_request_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_requests"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      hr_attendance: {
        Row: {
          active: boolean | null
          check_in: string
          check_out: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          id: string
          kiosk_id: string | null
          missing_check_out: boolean
          notes: string | null
          source: string
          updated_at: string | null
          updated_by: string | null
          work_date: string
          worked_minutes: number
        }
        Insert: {
          active?: boolean | null
          check_in: string
          check_out?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          id?: string
          kiosk_id?: string | null
          missing_check_out?: boolean
          notes?: string | null
          source?: string
          updated_at?: string | null
          updated_by?: string | null
          work_date: string
          worked_minutes?: number
        }
        Update: {
          active?: boolean | null
          check_in?: string
          check_out?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          id?: string
          kiosk_id?: string | null
          missing_check_out?: boolean
          notes?: string | null
          source?: string
          updated_at?: string | null
          updated_by?: string | null
          work_date?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_attendance_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_attendance_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_attendance_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "hr_attendance_kiosk_fk"
            columns: ["company_id", "kiosk_id"]
            isOneToOne: false
            referencedRelation: "hr_kiosk"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      hr_attendance_day: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          first_check_in: string | null
          id: string
          is_holiday: boolean
          is_open: boolean
          is_rest_day: boolean
          last_check_out: string | null
          late_minutes: number
          missing_check_out: boolean
          overtime_approved_minutes: number
          overtime_minutes: number
          overtime_status: string
          punches: number
          scheduled_minutes: number
          updated_at: string | null
          updated_by: string | null
          work_date: string
          worked_minutes: number
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          first_check_in?: string | null
          id?: string
          is_holiday?: boolean
          is_open?: boolean
          is_rest_day?: boolean
          last_check_out?: string | null
          late_minutes?: number
          missing_check_out?: boolean
          overtime_approved_minutes?: number
          overtime_minutes?: number
          overtime_status?: string
          punches?: number
          scheduled_minutes?: number
          updated_at?: string | null
          updated_by?: string | null
          work_date: string
          worked_minutes?: number
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          first_check_in?: string | null
          id?: string
          is_holiday?: boolean
          is_open?: boolean
          is_rest_day?: boolean
          last_check_out?: string | null
          late_minutes?: number
          missing_check_out?: boolean
          overtime_approved_minutes?: number
          overtime_minutes?: number
          overtime_status?: string
          punches?: number
          scheduled_minutes?: number
          updated_at?: string | null
          updated_by?: string | null
          work_date?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_attendance_day_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_attendance_day_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_attendance_day_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_attendance_day_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
        ]
      }
      hr_holiday: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          holiday_date: string
          id: string
          is_statutory: boolean
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          holiday_date: string
          id?: string
          is_statutory?: boolean
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          holiday_date?: string
          id?: string
          is_statutory?: boolean
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_holiday_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_kiosk: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          last_used_at: string | null
          location: string | null
          name: string
          token_hash: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          location?: string | null
          name: string
          token_hash: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          location?: string | null
          name?: string
          token_hash?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_kiosk_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_kiosk_attempt: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          kiosk_id: string
          success: boolean
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          kiosk_id: string
          success: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          kiosk_id?: string
          success?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_kiosk_attempt_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_kiosk_attempt_kiosk_fk"
            columns: ["company_id", "kiosk_id"]
            isOneToOne: false
            referencedRelation: "hr_kiosk"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      hr_kiosk_pin: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          pin_hash: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          pin_hash: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          pin_hash?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_kiosk_pin_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_kiosk_pin_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_kiosk_pin_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_kiosk_pin_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
        ]
      }
      hr_leave_allocation: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          days: number
          employee_id: string
          id: string
          leave_type_id: string
          notes: string | null
          service_year: number | null
          updated_at: string | null
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          days: number
          employee_id: string
          id?: string
          leave_type_id: string
          notes?: string | null
          service_year?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          days?: number
          employee_id?: string
          id?: string
          leave_type_id?: string
          notes?: string | null
          service_year?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_allocation_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_allocation_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_leave_allocation_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_leave_allocation_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "hr_leave_allocation_type_fk"
            columns: ["company_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_type"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      hr_leave_request: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          days: number
          employee_id: string
          end_date: string
          half_day: boolean
          id: string
          leave_type_id: string
          reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          days?: number
          employee_id: string
          end_date: string
          half_day?: boolean
          id?: string
          leave_type_id: string
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          days?: number
          employee_id?: string
          end_date?: string
          half_day?: boolean
          id?: string
          leave_type_id?: string
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_request_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_request_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_leave_request_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_leave_request_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "hr_leave_request_type_fk"
            columns: ["company_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_type"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      hr_leave_type: {
        Row: {
          active: boolean | null
          color: string
          company_id: string
          created_at: string | null
          created_by: string | null
          deducts_balance: boolean
          description: string | null
          id: string
          kind: string
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          color?: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          deducts_balance?: boolean
          description?: string | null
          id?: string
          kind: string
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          color?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          deducts_balance?: boolean
          description?: string | null
          id?: string
          kind?: string
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_type_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_salary: {
        Row: {
          active: boolean | null
          amount: number
          company_id: string
          contribution_base: number | null
          created_at: string | null
          created_by: string | null
          currency: string
          daily_salary: number
          effective_date: string
          employee_id: string
          id: string
          integrated_daily_wage: number | null
          monthly_salary: number
          notes: string | null
          reason: string
          salary_type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          company_id: string
          contribution_base?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          daily_salary?: number
          effective_date: string
          employee_id: string
          id?: string
          integrated_daily_wage?: number | null
          monthly_salary?: number
          notes?: string | null
          reason?: string
          salary_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          company_id?: string
          contribution_base?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          daily_salary?: number
          effective_date?: string
          employee_id?: string
          id?: string
          integrated_daily_wage?: number | null
          monthly_salary?: number
          notes?: string | null
          reason?: string
          salary_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_salary_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_salary_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_salary_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_salary_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
        ]
      }
      hr_settings: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          kiosk_pin_min_length: number
          late_tolerance_minutes: number
          overtime_min_minutes: number
          overtime_requires_approval: boolean
          payroll_frequency: string
          pin_salt: string
          timezone: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          kiosk_pin_min_length?: number
          late_tolerance_minutes?: number
          overtime_min_minutes?: number
          overtime_requires_approval?: boolean
          payroll_frequency?: string
          pin_salt?: string
          timezone?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          kiosk_pin_min_length?: number
          late_tolerance_minutes?: number
          overtime_min_minutes?: number
          overtime_requires_approval?: boolean
          payroll_frequency?: string
          pin_salt?: string
          timezone?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_work_schedule: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          late_tolerance_minutes: number | null
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          late_tolerance_minutes?: number | null
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          late_tolerance_minutes?: number | null
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_work_schedule_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_work_schedule_line: {
        Row: {
          active: boolean | null
          break_minutes: number
          company_id: string
          created_at: string | null
          created_by: string | null
          end_time: string
          id: string
          schedule_id: string
          start_time: string
          updated_at: string | null
          updated_by: string | null
          weekday: number
        }
        Insert: {
          active?: boolean | null
          break_minutes?: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          end_time: string
          id?: string
          schedule_id: string
          start_time: string
          updated_at?: string | null
          updated_by?: string | null
          weekday: number
        }
        Update: {
          active?: boolean | null
          break_minutes?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          end_time?: string
          id?: string
          schedule_id?: string
          start_time?: string
          updated_at?: string | null
          updated_by?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_work_schedule_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_work_schedule_line_schedule_fk"
            columns: ["company_id", "schedule_id"]
            isOneToOne: false
            referencedRelation: "hr_work_schedule"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      inventory_settings: {
        Row: {
          active: boolean | null
          auto_restock_tasks: boolean
          company_id: string
          created_at: string | null
          created_by: string | null
          enforce_warehouse_stock: boolean
          id: string
          restock_lead_days: number
          restock_project_id: string | null
          restock_responsible_partner_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          auto_restock_tasks?: boolean
          company_id: string
          created_at?: string | null
          created_by?: string | null
          enforce_warehouse_stock?: boolean
          id?: string
          restock_lead_days?: number
          restock_project_id?: string | null
          restock_responsible_partner_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          auto_restock_tasks?: boolean
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          enforce_warehouse_stock?: boolean
          id?: string
          restock_lead_days?: number
          restock_project_id?: string | null
          restock_responsible_partner_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_settings_restock_project_id_fkey"
            columns: ["restock_project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_settings_restock_project_id_fkey"
            columns: ["restock_project_id"]
            isOneToOne: false
            referencedRelation: "v_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_settings_restock_responsible_partner_id_fkey"
            columns: ["restock_responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      order: {
        Row: {
          amount_discount: number | null
          amount_paid: number
          amount_refunded: number
          amount_tax: number | null
          amount_total: number | null
          amount_untaxed: number | null
          checkout_token: string | null
          company_id: string
          confirmation_date: string | null
          coupon_code: string | null
          coupon_discount: number | null
          created_at: string | null
          created_by: string | null
          created_by_partner_id: string | null
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_date: string | null
          delivery_status: string
          exchange_rate: number | null
          id: string
          is_delivered: boolean | null
          is_invoiced: boolean | null
          is_paid: boolean | null
          name: string | null
          notes: string | null
          order_date: string
          order_state: Database["public"]["Enums"]["order_state"]
          order_type: Database["public"]["Enums"]["order_type"]
          origin: string
          paid_at: string | null
          partner_id: string
          payment_due_date: string | null
          payment_method_id: string | null
          payment_provider: string | null
          payment_status: string | null
          payment_term: string | null
          pos_session_id: string | null
          project_id: string | null
          reference: string | null
          shipping_city: string | null
          shipping_cost: number | null
          shipping_country_code: string | null
          shipping_method_name: string | null
          shipping_state: string | null
          shipping_street: string | null
          shipping_street2: string | null
          shipping_zip: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tax_included: boolean | null
          tax_rate: number | null
          terms: string | null
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          amount_discount?: number | null
          amount_paid?: number
          amount_refunded?: number
          amount_tax?: number | null
          amount_total?: number | null
          amount_untaxed?: number | null
          checkout_token?: string | null
          company_id: string
          confirmation_date?: string | null
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_partner_id?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_date?: string | null
          delivery_status?: string
          exchange_rate?: number | null
          id?: string
          is_delivered?: boolean | null
          is_invoiced?: boolean | null
          is_paid?: boolean | null
          name?: string | null
          notes?: string | null
          order_date?: string
          order_state?: Database["public"]["Enums"]["order_state"]
          order_type?: Database["public"]["Enums"]["order_type"]
          origin?: string
          paid_at?: string | null
          partner_id: string
          payment_due_date?: string | null
          payment_method_id?: string | null
          payment_provider?: string | null
          payment_status?: string | null
          payment_term?: string | null
          pos_session_id?: string | null
          project_id?: string | null
          reference?: string | null
          shipping_city?: string | null
          shipping_cost?: number | null
          shipping_country_code?: string | null
          shipping_method_name?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          shipping_street2?: string | null
          shipping_zip?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tax_included?: boolean | null
          tax_rate?: number | null
          terms?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          amount_discount?: number | null
          amount_paid?: number
          amount_refunded?: number
          amount_tax?: number | null
          amount_total?: number | null
          amount_untaxed?: number | null
          checkout_token?: string | null
          company_id?: string
          confirmation_date?: string | null
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_partner_id?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_date?: string | null
          delivery_status?: string
          exchange_rate?: number | null
          id?: string
          is_delivered?: boolean | null
          is_invoiced?: boolean | null
          is_paid?: boolean | null
          name?: string | null
          notes?: string | null
          order_date?: string
          order_state?: Database["public"]["Enums"]["order_state"]
          order_type?: Database["public"]["Enums"]["order_type"]
          origin?: string
          paid_at?: string | null
          partner_id?: string
          payment_due_date?: string | null
          payment_method_id?: string | null
          payment_provider?: string | null
          payment_status?: string | null
          payment_term?: string | null
          pos_session_id?: string | null
          project_id?: string | null
          reference?: string | null
          shipping_city?: string | null
          shipping_cost?: number | null
          shipping_country_code?: string | null
          shipping_method_name?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          shipping_street2?: string | null
          shipping_zip?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tax_included?: boolean | null
          tax_rate?: number | null
          terms?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_created_by_partner_id_fkey"
            columns: ["created_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line: {
        Row: {
          cost_delivered: number
          created_at: string | null
          description: string
          discount_amount: number | null
          discount_percent: number | null
          id: string
          margin: number | null
          margin_percent: number | null
          order_id: string
          price_include_tax: boolean | null
          product_id: string | null
          quantity: number
          quantity_delivered: number | null
          quantity_invoiced: number | null
          quantity_refunded: number
          quantity_returned: number
          sequence: number | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number | null
          unit_cost: number | null
          unit_price: number
          uom_id: string | null
          updated_at: string | null
        }
        Insert: {
          cost_delivered?: number
          created_at?: string | null
          description: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          margin?: number | null
          margin_percent?: number | null
          order_id: string
          price_include_tax?: boolean | null
          product_id?: string | null
          quantity?: number
          quantity_delivered?: number | null
          quantity_invoiced?: number | null
          quantity_refunded?: number
          quantity_returned?: number
          sequence?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          unit_cost?: number | null
          unit_price?: number
          uom_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cost_delivered?: number
          created_at?: string | null
          description?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          margin?: number | null
          margin_percent?: number | null
          order_id?: string
          price_include_tax?: boolean | null
          product_id?: string | null
          quantity?: number
          quantity_delivered?: number | null
          quantity_invoiced?: number | null
          quantity_refunded?: number
          quantity_returned?: number
          sequence?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          unit_cost?: number | null
          unit_price?: number
          uom_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payment: {
        Row: {
          active: boolean
          amount: number
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          order_id: string
          paid_at: string
          payment_method_id: string | null
          pos_payment_id: string | null
          pos_session_id: string | null
          reference: string | null
          refund_id: string | null
          source: string
          stripe_payment_intent_id: string | null
          updated_at: string | null
          updated_by: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          active?: boolean
          amount: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          paid_at?: string
          payment_method_id?: string | null
          pos_payment_id?: string | null
          pos_session_id?: string | null
          reference?: string | null
          refund_id?: string | null
          source?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          paid_at?: string
          payment_method_id?: string | null
          pos_payment_id?: string | null
          pos_session_id?: string | null
          reference?: string | null
          refund_id?: string | null
          source?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_pos_payment_id_fkey"
            columns: ["pos_payment_id"]
            isOneToOne: true
            referencedRelation: "pos_payment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_pos_payment_id_fkey"
            columns: ["pos_payment_id"]
            isOneToOne: true
            referencedRelation: "v_pos_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "order_refund"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "v_order_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refund: {
        Row: {
          active: boolean
          amount_reimbursed: number
          amount_tax: number
          amount_total: number
          amount_untaxed: number
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_backfill: boolean
          name: string | null
          order_id: string
          picking_id: string | null
          pos_session_id: string | null
          reason: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          amount_reimbursed?: number
          amount_tax?: number
          amount_total?: number
          amount_untaxed?: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_backfill?: boolean
          name?: string | null
          order_id: string
          picking_id?: string | null
          pos_session_id?: string | null
          reason: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          amount_reimbursed?: number
          amount_tax?: number
          amount_total?: number
          amount_untaxed?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_backfill?: boolean
          name?: string | null
          order_id?: string
          picking_id?: string | null
          pos_session_id?: string | null
          reason?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_refund_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_refund_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "picking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "v_pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refund_line: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          order_line_id: string
          product_id: string | null
          quantity: number
          refund_id: string
          restock_quantity: number
          subtotal: number
          tax_amount: number
          total: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          order_line_id: string
          product_id?: string | null
          quantity: number
          refund_id: string
          restock_quantity?: number
          subtotal?: number
          tax_amount?: number
          total?: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          order_line_id?: string
          product_id?: string | null
          quantity?: number
          refund_id?: string
          restock_quantity?: number
          subtotal?: number
          tax_amount?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_refund_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_line_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_line"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_line_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "v_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_line_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "order_refund"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_line_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "v_order_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      partner: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          barcode: string | null
          birthdate: string | null
          city: string | null
          comment: string | null
          company_type: Database["public"]["Enums"]["partner_type"] | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          display_name: string | null
          email: string | null
          function: string | null
          id: string
          is_company: boolean | null
          lang: string | null
          mobile: string | null
          name: string
          parent_id: string | null
          phone: string | null
          ref: string | null
          state: string | null
          street: string | null
          street2: string | null
          title: Database["public"]["Enums"]["partner_title"] | null
          tz: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          vat: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          barcode?: string | null
          birthdate?: string | null
          city?: string | null
          comment?: string | null
          company_type?: Database["public"]["Enums"]["partner_type"] | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          display_name?: string | null
          email?: string | null
          function?: string | null
          id?: string
          is_company?: boolean | null
          lang?: string | null
          mobile?: string | null
          name: string
          parent_id?: string | null
          phone?: string | null
          ref?: string | null
          state?: string | null
          street?: string | null
          street2?: string | null
          title?: Database["public"]["Enums"]["partner_title"] | null
          tz?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          barcode?: string | null
          birthdate?: string | null
          city?: string | null
          comment?: string | null
          company_type?: Database["public"]["Enums"]["partner_type"] | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          display_name?: string | null
          email?: string | null
          function?: string | null
          id?: string
          is_company?: boolean | null
          lang?: string | null
          mobile?: string | null
          name?: string
          parent_id?: string | null
          phone?: string | null
          ref?: string | null
          state?: string | null
          street?: string | null
          street2?: string | null
          title?: Database["public"]["Enums"]["partner_title"] | null
          tz?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_category: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_category_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "partner_category"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_category_rel: {
        Row: {
          category_id: string
          partner_id: string
        }
        Insert: {
          category_id: string
          partner_id: string
        }
        Update: {
          category_id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_category_rel_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "partner_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_category_rel_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method: {
        Row: {
          active: boolean | null
          code: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_cash: boolean | null
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_cash?: boolean | null
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_cash?: boolean | null
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_adjustment: {
        Row: {
          active: boolean | null
          amount: number
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          id: string
          is_taxable: boolean
          kind: string
          name: string
          notes: string | null
          period_id: string
          sat_code: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          id?: string
          is_taxable?: boolean
          kind: string
          name: string
          notes?: string | null
          period_id: string
          sat_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          id?: string
          is_taxable?: boolean
          kind?: string
          name?: string
          notes?: string | null
          period_id?: string
          sat_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustment_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "payroll_adjustment_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "payroll_adjustment_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "payroll_adjustment_period_fk"
            columns: ["company_id", "period_id"]
            isOneToOne: false
            referencedRelation: "payroll_period"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      payroll_fiscal_config: {
        Row: {
          active: boolean | null
          aguinaldo_days: number
          aguinaldo_exempt_umas: number
          cesantia_employer_table: Json
          company_id: string
          created_at: string | null
          created_by: string | null
          employer_registration: string | null
          employer_state: string | null
          fiscal_year: number
          id: string
          imss_rates: Json
          infonavit_employer_rate: number
          isn_rate: number
          isr_monthly_table: Json
          minimum_wage_border_daily: number
          minimum_wage_daily: number
          notes: string | null
          overtime_exempt_umas_weekly: number
          risk_premium_rate: number
          sbc_cap_umas: number
          subsidy_income_limit: number
          subsidy_uma_rate: number
          sunday_premium_rate: number
          uma_daily: number
          updated_at: string | null
          updated_by: string | null
          use_border_zone: boolean
          vacation_premium_exempt_umas: number
          vacation_premium_rate: number
        }
        Insert: {
          active?: boolean | null
          aguinaldo_days?: number
          aguinaldo_exempt_umas?: number
          cesantia_employer_table: Json
          company_id: string
          created_at?: string | null
          created_by?: string | null
          employer_registration?: string | null
          employer_state?: string | null
          fiscal_year: number
          id?: string
          imss_rates: Json
          infonavit_employer_rate?: number
          isn_rate?: number
          isr_monthly_table: Json
          minimum_wage_border_daily: number
          minimum_wage_daily: number
          notes?: string | null
          overtime_exempt_umas_weekly?: number
          risk_premium_rate?: number
          sbc_cap_umas?: number
          subsidy_income_limit?: number
          subsidy_uma_rate?: number
          sunday_premium_rate?: number
          uma_daily: number
          updated_at?: string | null
          updated_by?: string | null
          use_border_zone?: boolean
          vacation_premium_exempt_umas?: number
          vacation_premium_rate?: number
        }
        Update: {
          active?: boolean | null
          aguinaldo_days?: number
          aguinaldo_exempt_umas?: number
          cesantia_employer_table?: Json
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          employer_registration?: string | null
          employer_state?: string | null
          fiscal_year?: number
          id?: string
          imss_rates?: Json
          infonavit_employer_rate?: number
          isn_rate?: number
          isr_monthly_table?: Json
          minimum_wage_border_daily?: number
          minimum_wage_daily?: number
          notes?: string | null
          overtime_exempt_umas_weekly?: number
          risk_premium_rate?: number
          sbc_cap_umas?: number
          subsidy_income_limit?: number
          subsidy_uma_rate?: number
          sunday_premium_rate?: number
          uma_daily?: number
          updated_at?: string | null
          updated_by?: string | null
          use_border_zone?: boolean
          vacation_premium_exempt_umas?: number
          vacation_premium_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_fiscal_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_period: {
        Row: {
          active: boolean | null
          approved_at: string | null
          approved_by: string | null
          calculated_at: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          employee_count: number
          end_date: string
          fiscal_year: number
          frequency: string
          id: string
          name: string
          notes: string | null
          paid_at: string | null
          payment_date: string | null
          start_date: string
          status: string
          total_deductions: number
          total_employer_cost: number
          total_net: number
          total_perceptions: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          employee_count?: number
          end_date: string
          fiscal_year: number
          frequency?: string
          id?: string
          name: string
          notes?: string | null
          paid_at?: string | null
          payment_date?: string | null
          start_date: string
          status?: string
          total_deductions?: number
          total_employer_cost?: number
          total_net?: number
          total_perceptions?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          employee_count?: number
          end_date?: string
          fiscal_year?: number
          frequency?: string
          id?: string
          name?: string
          notes?: string | null
          paid_at?: string | null
          payment_date?: string | null
          start_date?: string
          status?: string
          total_deductions?: number
          total_employer_cost?: number
          total_net?: number
          total_perceptions?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_period_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_slip: {
        Row: {
          absence_days: number
          active: boolean | null
          company_id: string
          contribution_base: number
          created_at: string | null
          created_by: string | null
          daily_salary: number
          employee_id: string
          employer_cost: number
          id: string
          imss_employee: number
          imss_employer: number
          infonavit_employer: number
          isn: number
          isr: number
          net_pay: number
          overtime_double_hours: number
          overtime_triple_hours: number
          paid_days: number
          period_days: number
          period_id: string
          rest_days_worked: number
          subsidy: number
          sundays_worked: number
          total_deductions: number
          total_exempt: number
          total_perceptions: number
          total_taxable: number
          updated_at: string | null
          updated_by: string | null
          vacation_days: number
        }
        Insert: {
          absence_days?: number
          active?: boolean | null
          company_id: string
          contribution_base?: number
          created_at?: string | null
          created_by?: string | null
          daily_salary?: number
          employee_id: string
          employer_cost?: number
          id?: string
          imss_employee?: number
          imss_employer?: number
          infonavit_employer?: number
          isn?: number
          isr?: number
          net_pay?: number
          overtime_double_hours?: number
          overtime_triple_hours?: number
          paid_days?: number
          period_days?: number
          period_id: string
          rest_days_worked?: number
          subsidy?: number
          sundays_worked?: number
          total_deductions?: number
          total_exempt?: number
          total_perceptions?: number
          total_taxable?: number
          updated_at?: string | null
          updated_by?: string | null
          vacation_days?: number
        }
        Update: {
          absence_days?: number
          active?: boolean | null
          company_id?: string
          contribution_base?: number
          created_at?: string | null
          created_by?: string | null
          daily_salary?: number
          employee_id?: string
          employer_cost?: number
          id?: string
          imss_employee?: number
          imss_employer?: number
          infonavit_employer?: number
          isn?: number
          isr?: number
          net_pay?: number
          overtime_double_hours?: number
          overtime_triple_hours?: number
          paid_days?: number
          period_days?: number
          period_id?: string
          rest_days_worked?: number
          subsidy?: number
          sundays_worked?: number
          total_deductions?: number
          total_exempt?: number
          total_perceptions?: number
          total_taxable?: number
          updated_at?: string | null
          updated_by?: string | null
          vacation_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_slip_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_slip_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "payroll_slip_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "payroll_slip_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "payroll_slip_period_fk"
            columns: ["company_id", "period_id"]
            isOneToOne: false
            referencedRelation: "payroll_period"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      payroll_slip_line: {
        Row: {
          active: boolean | null
          amount: number
          category: string
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          exempt_amount: number
          id: string
          name: string
          quantity: number
          sat_code: string | null
          sequence: number
          slip_id: string
          taxable_amount: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          amount?: number
          category: string
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          exempt_amount?: number
          id?: string
          name: string
          quantity?: number
          sat_code?: string | null
          sequence?: number
          slip_id: string
          taxable_amount?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          category?: string
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          exempt_amount?: number
          id?: string
          name?: string
          quantity?: number
          sat_code?: string | null
          sequence?: number
          slip_id?: string
          taxable_amount?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_slip_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_slip_line_slip_fk"
            columns: ["company_id", "slip_id"]
            isOneToOne: false
            referencedRelation: "payroll_slip"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "payroll_slip_line_slip_fk"
            columns: ["company_id", "slip_id"]
            isOneToOne: false
            referencedRelation: "v_payroll_slips"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      picking: {
        Row: {
          active: boolean | null
          backorder_of_id: string | null
          cancelled_at: string | null
          company_id: string
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_partial: boolean | null
          is_return: boolean | null
          name: string | null
          notes: string | null
          order_id: string | null
          origin: Database["public"]["Enums"]["stock_move_origin"] | null
          published_at: string | null
          status: Database["public"]["Enums"]["picking_status"]
          type: Database["public"]["Enums"]["picking_type"]
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          active?: boolean | null
          backorder_of_id?: string | null
          cancelled_at?: string | null
          company_id: string
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_partial?: boolean | null
          is_return?: boolean | null
          name?: string | null
          notes?: string | null
          order_id?: string | null
          origin?: Database["public"]["Enums"]["stock_move_origin"] | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["picking_status"]
          type: Database["public"]["Enums"]["picking_type"]
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          active?: boolean | null
          backorder_of_id?: string | null
          cancelled_at?: string | null
          company_id?: string
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_partial?: boolean | null
          is_return?: boolean | null
          name?: string | null
          notes?: string | null
          order_id?: string | null
          origin?: Database["public"]["Enums"]["stock_move_origin"] | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["picking_status"]
          type?: Database["public"]["Enums"]["picking_type"]
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_backorder_of_id_fkey"
            columns: ["backorder_of_id"]
            isOneToOne: false
            referencedRelation: "picking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_backorder_of_id_fkey"
            columns: ["backorder_of_id"]
            isOneToOne: false
            referencedRelation: "v_pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_line: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          done_quantity: number | null
          id: string
          is_partial: boolean | null
          lot_name: string | null
          picking_id: string
          product_id: string
          quantity: number
          scan_notes: string | null
          scanned_at: string | null
          sequence: number | null
          serial_number: string | null
          tracking_type: Database["public"]["Enums"]["product_tracking"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          done_quantity?: number | null
          id?: string
          is_partial?: boolean | null
          lot_name?: string | null
          picking_id: string
          product_id: string
          quantity?: number
          scan_notes?: string | null
          scanned_at?: string | null
          sequence?: number | null
          serial_number?: string | null
          tracking_type?: Database["public"]["Enums"]["product_tracking"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          done_quantity?: number | null
          id?: string
          is_partial?: boolean | null
          lot_name?: string | null
          picking_id?: string
          product_id?: string
          quantity?: number
          scan_notes?: string | null
          scanned_at?: string | null
          sequence?: number | null
          serial_number?: string | null
          tracking_type?: Database["public"]["Enums"]["product_tracking"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "picking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "v_pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_heartbeat: {
        Row: {
          created_at: string
          last_ping_at: string
          ping_count: number
          previous_ping_at: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_ping_at?: string
          ping_count?: number
          previous_ping_at?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_ping_at?: string
          ping_count?: number
          previous_ping_at?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      pos_cash_movement: {
        Row: {
          active: boolean | null
          amount: number
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["pos_movement_type"]
          reason: string
          session_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["pos_movement_type"]
          reason: string
          session_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["pos_movement_type"]
          reason?: string
          session_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_cash_movement_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_movement_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_cash_movement_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_payment: {
        Row: {
          active: boolean | null
          amount: number
          change_amount: number
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_refund: boolean
          notes: string | null
          order_id: string
          payment_method_id: string
          session_id: string
          tendered: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          change_amount?: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_refund?: boolean
          notes?: string | null
          order_id: string
          payment_method_id: string
          session_id: string
          tendered?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          change_amount?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_refund?: boolean
          notes?: string | null
          order_id?: string
          payment_method_id?: string
          session_id?: string
          tendered?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_payment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "pos_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_register: {
        Row: {
          active: boolean | null
          blind_close: boolean
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          default_partner_id: string | null
          description: string | null
          difference_tolerance: number
          id: string
          max_discount_percent: number
          name: string
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          active?: boolean | null
          blind_close?: boolean
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          default_partner_id?: string | null
          description?: string | null
          difference_tolerance?: number
          id?: string
          max_discount_percent?: number
          name: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          active?: boolean | null
          blind_close?: boolean
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          default_partner_id?: string | null
          description?: string | null
          difference_tolerance?: number
          id?: string
          max_discount_percent?: number
          name?: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_register_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_register_default_partner_id_fkey"
            columns: ["default_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_register_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_session: {
        Row: {
          active: boolean | null
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string | null
          opened_at: string
          opened_by: string | null
          opening_balance: number
          opening_notes: string | null
          register_id: string
          status: Database["public"]["Enums"]["pos_session_status"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          opening_notes?: string | null
          register_id: string
          status?: Database["public"]["Enums"]["pos_session_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          opening_notes?: string | null
          register_id?: string
          status?: Database["public"]["Enums"]["pos_session_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_session_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_session_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pos_register"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_session_count: {
        Row: {
          active: boolean | null
          company_id: string
          counted: number
          created_at: string | null
          created_by: string | null
          difference: number
          expected: number
          id: string
          justification: string | null
          payment_method_id: string
          session_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          counted?: number
          created_at?: string | null
          created_by?: string | null
          difference?: number
          expected?: number
          id?: string
          justification?: string | null
          payment_method_id: string
          session_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          counted?: number
          created_at?: string | null
          created_by?: string | null
          difference?: number
          expected?: number
          id?: string
          justification?: string | null
          payment_method_id?: string
          session_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_session_count_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_session_count_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_session_count_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_session_count_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          attributes: Json | null
          avg_cost: number | null
          barcode: string | null
          can_be_purchased: boolean | null
          can_be_sold: boolean | null
          category_id: string | null
          company_id: string
          cost_price: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          default_supplier_id: string | null
          description: string | null
          display_name: string | null
          featured: boolean | null
          height: number | null
          id: string
          image_url: string | null
          images: Json | null
          internal_ref: string | null
          is_published: boolean | null
          is_stockable: boolean | null
          lead_time: number | null
          length: number | null
          list_price: number | null
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          name: string
          notes: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          purchase_uom_id: string | null
          sale_price: number | null
          short_description: string | null
          sku: string | null
          slug: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock_max: number | null
          stock_min: number | null
          stock_quantity: number | null
          supplier_sku: string | null
          tags: string[] | null
          tax_included: boolean | null
          tax_rate: number | null
          tracking: Database["public"]["Enums"]["product_tracking"] | null
          uom_id: string | null
          updated_at: string | null
          updated_by: string | null
          volume: number | null
          weight: number | null
          weight_unit: string | null
          width: number | null
        }
        Insert: {
          attributes?: Json | null
          avg_cost?: number | null
          barcode?: string | null
          can_be_purchased?: boolean | null
          can_be_sold?: boolean | null
          category_id?: string | null
          company_id: string
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          default_supplier_id?: string | null
          description?: string | null
          display_name?: string | null
          featured?: boolean | null
          height?: number | null
          id?: string
          image_url?: string | null
          images?: Json | null
          internal_ref?: string | null
          is_published?: boolean | null
          is_stockable?: boolean | null
          lead_time?: number | null
          length?: number | null
          list_price?: number | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          name: string
          notes?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          purchase_uom_id?: string | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock_max?: number | null
          stock_min?: number | null
          stock_quantity?: number | null
          supplier_sku?: string | null
          tags?: string[] | null
          tax_included?: boolean | null
          tax_rate?: number | null
          tracking?: Database["public"]["Enums"]["product_tracking"] | null
          uom_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          volume?: number | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
        }
        Update: {
          attributes?: Json | null
          avg_cost?: number | null
          barcode?: string | null
          can_be_purchased?: boolean | null
          can_be_sold?: boolean | null
          category_id?: string | null
          company_id?: string
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          default_supplier_id?: string | null
          description?: string | null
          display_name?: string | null
          featured?: boolean | null
          height?: number | null
          id?: string
          image_url?: string | null
          images?: Json | null
          internal_ref?: string | null
          is_published?: boolean | null
          is_stockable?: boolean | null
          lead_time?: number | null
          length?: number | null
          list_price?: number | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          name?: string
          notes?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          purchase_uom_id?: string | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock_max?: number | null
          stock_min?: number | null
          stock_quantity?: number | null
          supplier_sku?: string | null
          tags?: string[] | null
          tax_included?: boolean | null
          tax_rate?: number | null
          tracking?: Database["public"]["Enums"]["product_tracking"] | null
          uom_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          volume?: number | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
        ]
      }
      product_category: {
        Row: {
          color: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_category"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricelist: {
        Row: {
          code: string | null
          company_id: string
          created_at: string | null
          currency: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string | null
          currency?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string | null
          currency?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricelist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricelist_item: {
        Row: {
          created_at: string | null
          discount_percent: number | null
          end_date: string | null
          id: string
          min_quantity: number | null
          price: number
          pricelist_id: string
          product_id: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discount_percent?: number | null
          end_date?: string | null
          id?: string
          min_quantity?: number | null
          price: number
          pricelist_id: string
          product_id: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discount_percent?: number | null
          end_date?: string | null
          id?: string
          min_quantity?: number | null
          price?: number
          pricelist_id?: string
          product_id?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricelist_item_pricelist_id_fkey"
            columns: ["pricelist_id"]
            isOneToOne: false
            referencedRelation: "product_pricelist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricelist_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricelist_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricelist_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricelist_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_uom: {
        Row: {
          category: string | null
          code: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          ratio: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          ratio?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          ratio?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_uom_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      project: {
        Row: {
          active: boolean | null
          budget_actual: number | null
          budget_estimated: number | null
          code: string | null
          color: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date_actual: string | null
          end_date_estimated: string | null
          id: string
          income_amount: number
          is_public: boolean
          name: string
          notes: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          progress: number | null
          project_type_id: string | null
          requisition_amount: number
          responsible_partner_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          budget_actual?: number | null
          budget_estimated?: number | null
          code?: string | null
          color?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date_actual?: string | null
          end_date_estimated?: string | null
          id?: string
          income_amount?: number
          is_public?: boolean
          name: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number | null
          project_type_id?: string | null
          requisition_amount?: number
          responsible_partner_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          budget_actual?: number | null
          budget_estimated?: number | null
          code?: string | null
          color?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date_actual?: string | null
          end_date_estimated?: string | null
          id?: string
          income_amount?: number
          is_public?: boolean
          name?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number | null
          project_type_id?: string | null
          requisition_amount?: number
          responsible_partner_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task: {
        Row: {
          active: boolean | null
          actual_cost: number | null
          actual_hours: number | null
          code: string | null
          company_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          estimated_hours: number | null
          id: string
          name: string
          notes: string | null
          order_index: number | null
          priority: Database["public"]["Enums"]["project_priority"]
          progress: number | null
          project_id: string
          responsible_partner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_task_status"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          actual_cost?: number | null
          actual_hours?: number | null
          code?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          estimated_hours?: number | null
          id?: string
          name: string
          notes?: string | null
          order_index?: number | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number | null
          project_id: string
          responsible_partner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_task_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          actual_cost?: number | null
          actual_hours?: number | null
          code?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          estimated_hours?: number | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number | null
          project_id?: string
          responsible_partner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_task_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_task_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      project_type: {
        Row: {
          active: boolean | null
          code: string
          color: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          color?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          color?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_type_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_partner_company: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string | null
          id: string
          invitation_status:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          is_default: boolean | null
          partner_id: string
          permissions: Json | null
          relationship_type: Database["public"]["Enums"]["partner_relationship_type"]
          role: Database["public"]["Enums"]["partner_company_role"] | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          partner_id: string
          permissions?: Json | null
          relationship_type?: Database["public"]["Enums"]["partner_relationship_type"]
          role?: Database["public"]["Enums"]["partner_company_role"] | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          partner_id?: string
          permissions?: Json | null
          relationship_type?: Database["public"]["Enums"]["partner_relationship_type"]
          role?: Database["public"]["Enums"]["partner_company_role"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_partner_company_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_partner_company_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_partner_company_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_move: {
        Row: {
          avg_cost_after: number
          balance_after: number
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          lot_name: string | null
          move_type: Database["public"]["Enums"]["stock_move_type"]
          notes: string | null
          occurred_at: string
          order_id: string | null
          origin: Database["public"]["Enums"]["stock_move_origin"]
          picking_id: string | null
          picking_line_id: string | null
          product_id: string
          quantity: number
          reference: string | null
          serial_number: string | null
          signed_quantity: number
          total_cost: number
          unit_cost: number
          warehouse_id: string | null
        }
        Insert: {
          avg_cost_after?: number
          balance_after?: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lot_name?: string | null
          move_type: Database["public"]["Enums"]["stock_move_type"]
          notes?: string | null
          occurred_at?: string
          order_id?: string | null
          origin?: Database["public"]["Enums"]["stock_move_origin"]
          picking_id?: string | null
          picking_line_id?: string | null
          product_id: string
          quantity: number
          reference?: string | null
          serial_number?: string | null
          signed_quantity: number
          total_cost?: number
          unit_cost?: number
          warehouse_id?: string | null
        }
        Update: {
          avg_cost_after?: number
          balance_after?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lot_name?: string | null
          move_type?: Database["public"]["Enums"]["stock_move_type"]
          notes?: string | null
          occurred_at?: string
          order_id?: string | null
          origin?: Database["public"]["Enums"]["stock_move_origin"]
          picking_id?: string | null
          picking_line_id?: string | null
          product_id?: string
          quantity?: number
          reference?: string | null
          serial_number?: string | null
          signed_quantity?: number
          total_cost?: number
          unit_cost?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_move_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_move_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "picking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "v_pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_picking_line_id_fkey"
            columns: ["picking_line_id"]
            isOneToOne: false
            referencedRelation: "picking_line"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_picking_line_id_fkey"
            columns: ["picking_line_id"]
            isOneToOne: false
            referencedRelation: "v_picking_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_quant: {
        Row: {
          company_id: string
          product_id: string
          quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          company_id: string
          product_id: string
          quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_quant_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_analytics_daily: {
        Row: {
          bounce_sessions: number
          company_id: string
          converted_sessions: number
          created_at: string | null
          day: string
          funnel_add_to_cart: number
          funnel_begin_checkout: number
          funnel_purchase: number
          funnel_view_item: number
          id: string
          new_visitors: number
          orders: number
          page_views: number
          refund_amount: number
          refunds: number
          revenue: number
          sessions: number
          total_session_seconds: number
          updated_at: string | null
          visitors: number
        }
        Insert: {
          bounce_sessions?: number
          company_id: string
          converted_sessions?: number
          created_at?: string | null
          day: string
          funnel_add_to_cart?: number
          funnel_begin_checkout?: number
          funnel_purchase?: number
          funnel_view_item?: number
          id?: string
          new_visitors?: number
          orders?: number
          page_views?: number
          refund_amount?: number
          refunds?: number
          revenue?: number
          sessions?: number
          total_session_seconds?: number
          updated_at?: string | null
          visitors?: number
        }
        Update: {
          bounce_sessions?: number
          company_id?: string
          converted_sessions?: number
          created_at?: string | null
          day?: string
          funnel_add_to_cart?: number
          funnel_begin_checkout?: number
          funnel_purchase?: number
          funnel_view_item?: number
          id?: string
          new_visitors?: number
          orders?: number
          page_views?: number
          refund_amount?: number
          refunds?: number
          revenue?: number
          sessions?: number
          total_session_seconds?: number
          updated_at?: string | null
          visitors?: number
        }
        Relationships: [
          {
            foreignKeyName: "storefront_analytics_daily_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_analytics_daily_dim: {
        Row: {
          company_id: string
          created_at: string | null
          day: string
          dim: string
          dim_key: string
          dim_label: string | null
          hits: number
          id: string
          uniques: number
          value: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          day: string
          dim: string
          dim_key: string
          dim_label?: string | null
          hits?: number
          id?: string
          uniques?: number
          value?: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          day?: string
          dim?: string
          dim_key?: string
          dim_label?: string | null
          hits?: number
          id?: string
          uniques?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "storefront_analytics_daily_dim_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_analytics_job_run: {
        Row: {
          created_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          rows_processed: number | null
          started_at: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          rows_processed?: number | null
          started_at?: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          rows_processed?: number | null
          started_at?: string
        }
        Relationships: []
      }
      storefront_coupon: {
        Row: {
          active: boolean | null
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          min_purchase: number | null
          starts_at: string | null
          updated_at: string | null
          updated_by: string | null
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          active?: boolean | null
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value: number
          expires_at?: string | null
          id?: string
          min_purchase?: number | null
          starts_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          active?: boolean | null
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          min_purchase?: number | null
          starts_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_coupon_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_event: {
        Row: {
          anonymous_id: string | null
          browser: string | null
          checkout_token: string | null
          client_ts: string | null
          company_id: string
          country: string | null
          created_at: string | null
          currency: string | null
          device_type: string | null
          event_category: string
          event_name: string
          id: string
          items: Json | null
          language: string | null
          order_id: string | null
          os: string | null
          page_path: string | null
          page_title: string | null
          properties: Json
          referrer: string | null
          server_ts: string
          session_id: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          value: number | null
          viewport: string | null
        }
        Insert: {
          anonymous_id?: string | null
          browser?: string | null
          checkout_token?: string | null
          client_ts?: string | null
          company_id: string
          country?: string | null
          created_at?: string | null
          currency?: string | null
          device_type?: string | null
          event_category?: string
          event_name: string
          id: string
          items?: Json | null
          language?: string | null
          order_id?: string | null
          os?: string | null
          page_path?: string | null
          page_title?: string | null
          properties?: Json
          referrer?: string | null
          server_ts?: string
          session_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          value?: number | null
          viewport?: string | null
        }
        Update: {
          anonymous_id?: string | null
          browser?: string | null
          checkout_token?: string | null
          client_ts?: string | null
          company_id?: string
          country?: string | null
          created_at?: string | null
          currency?: string | null
          device_type?: string | null
          event_category?: string
          event_name?: string
          id?: string
          items?: Json | null
          language?: string | null
          order_id?: string | null
          os?: string | null
          page_path?: string | null
          page_title?: string | null
          properties?: Json
          referrer?: string | null
          server_ts?: string
          session_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          value?: number | null
          viewport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_event_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_event_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_event_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "storefront_event_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_session: {
        Row: {
          anonymous_id: string | null
          browser: string | null
          company_id: string
          converted: boolean
          country: string | null
          created_at: string | null
          device_type: string | null
          duration_seconds: number
          entry_path: string | null
          events_count: number
          exit_path: string | null
          id: string
          is_bounce: boolean
          is_new_visitor: boolean
          last_seen_at: string
          order_count: number
          os: string | null
          page_views: number
          referrer: string | null
          revenue: number
          session_id: string
          started_at: string
          updated_at: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          anonymous_id?: string | null
          browser?: string | null
          company_id: string
          converted?: boolean
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number
          entry_path?: string | null
          events_count?: number
          exit_path?: string | null
          id?: string
          is_bounce?: boolean
          is_new_visitor?: boolean
          last_seen_at: string
          order_count?: number
          os?: string | null
          page_views?: number
          referrer?: string | null
          revenue?: number
          session_id: string
          started_at: string
          updated_at?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          anonymous_id?: string | null
          browser?: string | null
          company_id?: string
          converted?: boolean
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number
          entry_path?: string | null
          events_count?: number
          exit_path?: string | null
          id?: string
          is_bounce?: boolean
          is_new_visitor?: boolean
          last_seen_at?: string
          order_count?: number
          os?: string | null
          page_views?: number
          referrer?: string | null
          revenue?: number
          session_id?: string
          started_at?: string
          updated_at?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_session_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_settings: {
        Row: {
          about_text: string | null
          active: boolean | null
          announcement: string | null
          announcement_link: string | null
          benefits: Json | null
          card_style: string | null
          color_accent: string | null
          color_primary: string | null
          color_secondary: string | null
          company_id: string
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          featured_limit: number
          font_pairing: string
          hero_cta_label: string | null
          hero_layout: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          is_active: boolean
          palette: string
          policy_privacy: string | null
          policy_returns: string | null
          policy_shipping: string | null
          policy_terms: string | null
          radius_style: string | null
          show_benefits: boolean
          show_categories: boolean
          show_featured: boolean
          show_out_of_stock: boolean
          show_story: boolean
          stripe_enabled: boolean
          stripe_publishable_key: string | null
          stripe_secret_key: string | null
          stripe_webhook_secret: string | null
          theme: string
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          about_text?: string | null
          active?: boolean | null
          announcement?: string | null
          announcement_link?: string | null
          benefits?: Json | null
          card_style?: string | null
          color_accent?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          company_id: string
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          featured_limit?: number
          font_pairing?: string
          hero_cta_label?: string | null
          hero_layout?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean
          palette?: string
          policy_privacy?: string | null
          policy_returns?: string | null
          policy_shipping?: string | null
          policy_terms?: string | null
          radius_style?: string | null
          show_benefits?: boolean
          show_categories?: boolean
          show_featured?: boolean
          show_out_of_stock?: boolean
          show_story?: boolean
          stripe_enabled?: boolean
          stripe_publishable_key?: string | null
          stripe_secret_key?: string | null
          stripe_webhook_secret?: string | null
          theme?: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          about_text?: string | null
          active?: boolean | null
          announcement?: string | null
          announcement_link?: string | null
          benefits?: Json | null
          card_style?: string | null
          color_accent?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          company_id?: string
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          featured_limit?: number
          font_pairing?: string
          hero_cta_label?: string | null
          hero_layout?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean
          palette?: string
          policy_privacy?: string | null
          policy_returns?: string | null
          policy_shipping?: string | null
          policy_terms?: string | null
          radius_style?: string | null
          show_benefits?: boolean
          show_categories?: boolean
          show_featured?: boolean
          show_out_of_stock?: boolean
          show_story?: boolean
          stripe_enabled?: boolean
          stripe_publishable_key?: string | null
          stripe_secret_key?: string | null
          stripe_webhook_secret?: string | null
          theme?: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_settings_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_shipping_method: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          delivery_estimate: string | null
          description: string | null
          display_order: number | null
          id: string
          name: string
          price: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          delivery_estimate?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          price?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          delivery_estimate?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          price?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_shipping_method_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse: {
        Row: {
          active: boolean | null
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      website_author: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          bio: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          display_name: string
          id: string
          is_public: boolean
          partner_id: string | null
          role_title: string | null
          slug: string | null
          social_links: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          display_name: string
          id?: string
          is_public?: boolean
          partner_id?: string | null
          role_title?: string | null
          slug?: string | null
          social_links?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          display_name?: string
          id?: string
          is_public?: boolean
          partner_id?: string | null
          role_title?: string | null
          slug?: string | null
          social_links?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_author_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_author_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      website_category: {
        Row: {
          active: boolean | null
          color: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_featured: boolean
          name: string
          parent_id: string | null
          slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_featured?: boolean
          name: string
          parent_id?: string | null
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          color?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_featured?: boolean
          name?: string
          parent_id?: string | null
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_category_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_category_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "website_category"
            referencedColumns: ["id"]
          },
        ]
      }
      website_comment: {
        Row: {
          active: boolean | null
          author_email: string | null
          author_name: string
          author_user_id: string | null
          body: string
          company_id: string
          created_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          status: string
          updated_at: string | null
          updated_by: string | null
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          active?: boolean | null
          author_email?: string | null
          author_name: string
          author_user_id?: string | null
          body: string
          company_id: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          active?: boolean | null
          author_email?: string | null
          author_name?: string
          author_user_id?: string | null
          body?: string
          company_id?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_comment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_comment_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "website_comment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_comment_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "website_post"
            referencedColumns: ["id"]
          },
        ]
      }
      website_contact_submission: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          crm_lead_id: string | null
          email: string | null
          id: string
          message: string
          name: string
          page_id: string | null
          payload: Json
          phone: string | null
          source_url: string | null
          status: string
          subject: string | null
          updated_at: string | null
          updated_by: string | null
          visitor_id: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          crm_lead_id?: string | null
          email?: string | null
          id?: string
          message: string
          name: string
          page_id?: string | null
          payload?: Json
          phone?: string | null
          source_url?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
          updated_by?: string | null
          visitor_id?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          crm_lead_id?: string | null
          email?: string | null
          id?: string
          message?: string
          name?: string
          page_id?: string | null
          payload?: Json
          phone?: string | null
          source_url?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
          updated_by?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_contact_submission_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_contact_submission_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_contact_submission_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_contact_submission_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_page"
            referencedColumns: ["id"]
          },
        ]
      }
      website_gallery: {
        Row: {
          active: boolean | null
          company_id: string
          cover_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          layout: string
          name: string
          slug: string | null
          status: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          layout?: string
          name: string
          slug?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          layout?: string
          name?: string
          slug?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_gallery_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      website_gallery_item: {
        Row: {
          active: boolean | null
          alt_text: string | null
          caption: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          display_order: number
          gallery_id: string
          id: string
          image_url: string
          media_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          alt_text?: string | null
          caption?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          gallery_id: string
          id?: string
          image_url: string
          media_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          alt_text?: string | null
          caption?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          gallery_id?: string
          id?: string
          image_url?: string
          media_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_gallery_item_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_gallery_item_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "website_gallery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_gallery_item_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "website_media"
            referencedColumns: ["id"]
          },
        ]
      }
      website_media: {
        Row: {
          active: boolean | null
          alt_text: string | null
          bucket: string
          company_id: string
          created_at: string | null
          created_by: string | null
          file_name: string | null
          folder: string
          height: number | null
          id: string
          mime_type: string | null
          path: string
          public_url: string
          size_bytes: number | null
          title: string | null
          updated_at: string | null
          updated_by: string | null
          width: number | null
        }
        Insert: {
          active?: boolean | null
          alt_text?: string | null
          bucket?: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          folder?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          path: string
          public_url: string
          size_bytes?: number | null
          title?: string | null
          updated_at?: string | null
          updated_by?: string | null
          width?: number | null
        }
        Update: {
          active?: boolean | null
          alt_text?: string | null
          bucket?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          folder?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          path?: string
          public_url?: string
          size_bytes?: number | null
          title?: string | null
          updated_at?: string | null
          updated_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "website_media_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      website_menu: {
        Row: {
          active: boolean | null
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_menu_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      website_menu_item: {
        Row: {
          active: boolean | null
          category_id: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          display_order: number
          gallery_id: string | null
          id: string
          is_visible: boolean
          label: string
          link_type: string
          menu_id: string
          open_in_new_tab: boolean
          page_id: string | null
          parent_id: string | null
          post_id: string | null
          updated_at: string | null
          updated_by: string | null
          url: string | null
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          gallery_id?: string | null
          id?: string
          is_visible?: boolean
          label: string
          link_type?: string
          menu_id: string
          open_in_new_tab?: boolean
          page_id?: string | null
          parent_id?: string | null
          post_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          gallery_id?: string | null
          id?: string
          is_visible?: boolean
          label?: string
          link_type?: string
          menu_id?: string
          open_in_new_tab?: boolean
          page_id?: string | null
          parent_id?: string | null
          post_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_menu_item_category_fk"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "website_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_menu_item_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_menu_item_gallery_fk"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "website_gallery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_menu_item_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "website_menu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_menu_item_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_page"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_menu_item_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "website_menu_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_menu_item_post_fk"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "website_post"
            referencedColumns: ["id"]
          },
        ]
      }
      website_page: {
        Row: {
          active: boolean | null
          canonical_url: string | null
          company_id: string
          content: Json
          content_version: number
          created_at: string | null
          created_by: string | null
          display_order: number
          excerpt: string | null
          id: string
          is_home: boolean
          layout: string
          noindex: boolean
          og_image_url: string | null
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          show_in_search: boolean
          show_title: boolean
          slug: string | null
          status: string
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          canonical_url?: string | null
          company_id: string
          content?: Json
          content_version?: number
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          excerpt?: string | null
          id?: string
          is_home?: boolean
          layout?: string
          noindex?: boolean
          og_image_url?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          show_in_search?: boolean
          show_title?: boolean
          slug?: string | null
          status?: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          canonical_url?: string | null
          company_id?: string
          content?: Json
          content_version?: number
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          excerpt?: string | null
          id?: string
          is_home?: boolean
          layout?: string
          noindex?: boolean
          og_image_url?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          show_in_search?: boolean
          show_title?: boolean
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_page_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      website_page_revision: {
        Row: {
          company_id: string
          content: Json
          created_at: string | null
          created_by: string | null
          id: string
          page_id: string
          revision_no: number
          title: string
        }
        Insert: {
          company_id: string
          content: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          page_id: string
          revision_no: number
          title: string
        }
        Update: {
          company_id?: string
          content?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          page_id?: string
          revision_no?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_page_revision_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_page_revision_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_page"
            referencedColumns: ["id"]
          },
        ]
      }
      website_post: {
        Row: {
          active: boolean | null
          allow_comments: boolean
          author_id: string | null
          body: Json
          body_html: string
          body_text: string
          canonical_url: string | null
          category_id: string | null
          clap_count: number
          comment_count: number
          company_id: string
          cover_alt: string | null
          cover_url: string | null
          created_at: string | null
          created_by: string | null
          excerpt: string | null
          id: string
          is_featured: boolean
          is_pinned: boolean
          noindex: boolean
          og_image_url: string | null
          published_at: string | null
          reading_minutes: number
          related_post_ids: string[]
          search_vector: unknown
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
          view_count: number
          word_count: number
        }
        Insert: {
          active?: boolean | null
          allow_comments?: boolean
          author_id?: string | null
          body?: Json
          body_html?: string
          body_text?: string
          canonical_url?: string | null
          category_id?: string | null
          clap_count?: number
          comment_count?: number
          company_id: string
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          id?: string
          is_featured?: boolean
          is_pinned?: boolean
          noindex?: boolean
          og_image_url?: string | null
          published_at?: string | null
          reading_minutes?: number
          related_post_ids?: string[]
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          view_count?: number
          word_count?: number
        }
        Update: {
          active?: boolean | null
          allow_comments?: boolean
          author_id?: string | null
          body?: Json
          body_html?: string
          body_text?: string
          canonical_url?: string | null
          category_id?: string | null
          clap_count?: number
          comment_count?: number
          company_id?: string
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          id?: string
          is_featured?: boolean
          is_pinned?: boolean
          noindex?: boolean
          og_image_url?: string | null
          published_at?: string | null
          reading_minutes?: number
          related_post_ids?: string[]
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          view_count?: number
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "website_post_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "website_author"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_post_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "website_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_post_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      website_post_revision: {
        Row: {
          body: Json
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          post_id: string
          revision_no: number
          title: string
        }
        Insert: {
          body: Json
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          post_id: string
          revision_no: number
          title: string
        }
        Update: {
          body?: Json
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          post_id?: string
          revision_no?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_post_revision_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_post_revision_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "website_post"
            referencedColumns: ["id"]
          },
        ]
      }
      website_post_tag: {
        Row: {
          company_id: string
          created_at: string | null
          post_id: string
          tag_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          post_id: string
          tag_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_post_tag_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_post_tag_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "website_post"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_post_tag_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "website_tag"
            referencedColumns: ["id"]
          },
        ]
      }
      website_post_view: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          post_id: string
          view_date: string
          visitor_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          post_id: string
          view_date?: string
          visitor_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          post_id?: string
          view_date?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_post_view_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_post_view_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "website_post"
            referencedColumns: ["id"]
          },
        ]
      }
      website_reaction: {
        Row: {
          company_id: string
          count: number
          created_at: string | null
          id: string
          post_id: string
          updated_at: string | null
          visitor_id: string
        }
        Insert: {
          company_id: string
          count?: number
          created_at?: string | null
          id?: string
          post_id: string
          updated_at?: string | null
          visitor_id: string
        }
        Update: {
          company_id?: string
          count?: number
          created_at?: string | null
          id?: string
          post_id?: string
          updated_at?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_reaction_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_reaction_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "website_post"
            referencedColumns: ["id"]
          },
        ]
      }
      website_redirect: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          from_path: string
          hits: number
          id: string
          is_automatic: boolean
          status_code: number
          to_path: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          from_path: string
          hits?: number
          id?: string
          is_automatic?: boolean
          status_code?: number
          to_path: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          from_path?: string
          hits?: number
          id?: string
          is_automatic?: boolean
          status_code?: number
          to_path?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_redirect_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      website_settings: {
        Row: {
          active: boolean | null
          announcement: string | null
          announcement_link: string | null
          auto_convert_submissions: boolean
          blog_description: string | null
          blog_enabled: boolean
          blog_title: string | null
          color_accent: string | null
          color_primary: string | null
          color_secondary: string | null
          comments_auto_approve: boolean
          comments_enabled: boolean
          company_id: string
          contact_address: string | null
          contact_email: string | null
          contact_hours: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          custom_domain: string | null
          favicon_url: string | null
          font_pairing: string
          footer_layout: string
          footer_text: string | null
          gallery_enabled: boolean
          header_layout: string
          id: string
          is_active: boolean
          lang: string
          logo_url: string | null
          map_embed_url: string | null
          members_can_publish: boolean
          noindex: boolean
          not_found_text: string | null
          not_found_title: string | null
          og_image_url: string | null
          palette: string
          posts_per_page: number
          radius_style: string | null
          reactions_enabled: boolean
          seo_description: string | null
          seo_title: string | null
          show_powered_by: boolean
          show_storefront_link: boolean
          site_name: string | null
          social_links: Json
          storefront_link_label: string | null
          tagline: string | null
          theme: string
          updated_at: string | null
          updated_by: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          active?: boolean | null
          announcement?: string | null
          announcement_link?: string | null
          auto_convert_submissions?: boolean
          blog_description?: string | null
          blog_enabled?: boolean
          blog_title?: string | null
          color_accent?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          comments_auto_approve?: boolean
          comments_enabled?: boolean
          company_id: string
          contact_address?: string | null
          contact_email?: string | null
          contact_hours?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_domain?: string | null
          favicon_url?: string | null
          font_pairing?: string
          footer_layout?: string
          footer_text?: string | null
          gallery_enabled?: boolean
          header_layout?: string
          id?: string
          is_active?: boolean
          lang?: string
          logo_url?: string | null
          map_embed_url?: string | null
          members_can_publish?: boolean
          noindex?: boolean
          not_found_text?: string | null
          not_found_title?: string | null
          og_image_url?: string | null
          palette?: string
          posts_per_page?: number
          radius_style?: string | null
          reactions_enabled?: boolean
          seo_description?: string | null
          seo_title?: string | null
          show_powered_by?: boolean
          show_storefront_link?: boolean
          site_name?: string | null
          social_links?: Json
          storefront_link_label?: string | null
          tagline?: string | null
          theme?: string
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          active?: boolean | null
          announcement?: string | null
          announcement_link?: string | null
          auto_convert_submissions?: boolean
          blog_description?: string | null
          blog_enabled?: boolean
          blog_title?: string | null
          color_accent?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          comments_auto_approve?: boolean
          comments_enabled?: boolean
          company_id?: string
          contact_address?: string | null
          contact_email?: string | null
          contact_hours?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_domain?: string | null
          favicon_url?: string | null
          font_pairing?: string
          footer_layout?: string
          footer_text?: string | null
          gallery_enabled?: boolean
          header_layout?: string
          id?: string
          is_active?: boolean
          lang?: string
          logo_url?: string | null
          map_embed_url?: string | null
          members_can_publish?: boolean
          noindex?: boolean
          not_found_text?: string | null
          not_found_title?: string | null
          og_image_url?: string | null
          palette?: string
          posts_per_page?: number
          radius_style?: string | null
          reactions_enabled?: boolean
          seo_description?: string | null
          seo_title?: string | null
          show_powered_by?: boolean
          show_storefront_link?: boolean
          site_name?: string | null
          social_links?: Json
          storefront_link_label?: string | null
          tagline?: string | null
          theme?: string
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      website_tag: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_tag_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_approval_my_pending: {
        Row: {
          activated_at: string | null
          approver_id: string | null
          company_id: string | null
          delegated_from_display: string | null
          delegated_from_partner_id: string | null
          due_at: string | null
          is_overdue: boolean | null
          request_id: string | null
          resolved_via: string | null
          sequence: number | null
          step_id: string | null
          step_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_approver_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_approver_delegated_from_partner_id_fkey"
            columns: ["delegated_from_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_approver_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "approval_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_approver_request_fk"
            columns: ["company_id", "request_id"]
            isOneToOne: false
            referencedRelation: "v_approval_requests"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "approval_request_approver_step_fk"
            columns: ["company_id", "step_id"]
            isOneToOne: false
            referencedRelation: "approval_request_step"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      v_approval_requests: {
        Row: {
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          assigned_approver_display: string | null
          auto_approved: boolean | null
          cancelled_at: string | null
          captured_by_display: string | null
          captured_by_partner_id: string | null
          category_code: string | null
          category_color: string | null
          category_confidential: boolean | null
          category_id: string | null
          category_name: string | null
          company_id: string | null
          created_at: string | null
          currency: string | null
          current_due_at: string | null
          current_sequence: number | null
          current_step_name: string | null
          description: string | null
          due_date: string | null
          expired_at: string | null
          forced: boolean | null
          id: string | null
          is_overdue: boolean | null
          pending_approvers_display: string | null
          priority: string | null
          reference: string | null
          rejected_at: string | null
          request_date: string | null
          request_number: number | null
          requesting_partner_display: string | null
          requesting_partner_id: string | null
          resolution_note: string | null
          resolved_by_display: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          round: number | null
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"] | null
          submitted_at: string | null
          title: string | null
          total_levels: number | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_assigned_approval_manager_id_fkey"
            columns: ["assigned_approval_manager_id"]
            isOneToOne: false
            referencedRelation: "approval_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_captured_by_partner_id_fkey"
            columns: ["captured_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "approval_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_requesting_partner_id_fkey"
            columns: ["requesting_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_resolved_by_partner_id_fkey"
            columns: ["resolved_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_crm_activities: {
        Row: {
          active: boolean | null
          company_id: string | null
          computed_status: string | null
          created_at: string | null
          created_by: string | null
          done_at: string | null
          id: string | null
          lead_company_id: string | null
          lead_id: string | null
          lead_name: string | null
          lead_number: number | null
          notes: string | null
          responsible_display_name: string | null
          responsible_name: string | null
          responsible_partner_id: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["crm_activity_status"] | null
          title: string | null
          type: Database["public"]["Enums"]["crm_activity_type"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activity_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activity_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activity_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_company_id_fkey"
            columns: ["lead_company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      v_crm_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_display_name: string | null
          event: Database["public"]["Enums"]["crm_history_event"] | null
          id: string | null
          lead_company_id: string | null
          lead_id: string | null
          lead_name: string | null
          new_value: string | null
          notes: string | null
          old_value: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_company_id_fkey"
            columns: ["lead_company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      v_crm_leads: {
        Row: {
          active: boolean | null
          actual_close_date: string | null
          amount: number | null
          collected_amount: number | null
          company_id: string | null
          contact_company: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          days_in_stage: number | null
          description: string | null
          expected_close_date: string | null
          id: string | null
          is_lost: boolean | null
          is_rotting: boolean | null
          is_won: boolean | null
          kanban_sequence: number | null
          lead_number: number | null
          lost_notes: string | null
          lost_reason_id: string | null
          lost_reason_name: string | null
          name: string | null
          next_activity_at: string | null
          next_activity_id: string | null
          next_activity_title: string | null
          next_activity_type:
            | Database["public"]["Enums"]["crm_activity_type"]
            | null
          open_activity_count: number | null
          order_count: number | null
          orders_total: number | null
          origin: Database["public"]["Enums"]["crm_lead_origin"] | null
          overdue_activity_count: number | null
          partner_display_name: string | null
          partner_id: string | null
          partner_name: string | null
          priority: Database["public"]["Enums"]["crm_lead_priority"] | null
          probability: number | null
          responsible_display_name: string | null
          responsible_name: string | null
          responsible_partner_id: string | null
          stage_changed_at: string | null
          stage_color: string | null
          stage_id: string | null
          stage_name: string | null
          stage_probability: number | null
          stage_rotting_days: number | null
          stage_sequence: number | null
          tags: string[] | null
          updated_at: string | null
          updated_by: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          won_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_lost_reason_id_fkey"
            columns: ["lost_reason_id"]
            isOneToOne: false
            referencedRelation: "crm_lost_reason"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_stage"
            referencedColumns: ["id"]
          },
        ]
      }
      v_employees: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          department_name: string | null
          employee_number: string | null
          hire_date: string | null
          id: string | null
          job_title: string | null
          manager_id: string | null
          manager_name: string | null
          partner_avatar_url: string | null
          partner_email: string | null
          partner_id: string | null
          partner_mobile: string | null
          partner_name: string | null
          partner_phone: string | null
          status: string | null
          termination_date: string | null
          updated_at: string | null
          updated_by: string | null
          work_email: string | null
          work_location: string | null
          work_phone: string | null
          work_schedule_id: string | null
          work_schedule_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_department_fk"
            columns: ["company_id", "department_id"]
            isOneToOne: false
            referencedRelation: "employee_department"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_manager_fk"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_manager_fk"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employee_manager_fk"
            columns: ["company_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "employee_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_work_schedule_fk"
            columns: ["company_id", "work_schedule_id"]
            isOneToOne: false
            referencedRelation: "hr_work_schedule"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      v_hr_absences: {
        Row: {
          absence_date: string | null
          active: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          deduct_from_pay: boolean | null
          department_name: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          id: string | null
          kind: string | null
          leave_request_id: string | null
          reason: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_absence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_absence_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_absence_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_absence_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "hr_absence_leave_fk"
            columns: ["company_id", "leave_request_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_request"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_absence_leave_fk"
            columns: ["company_id", "leave_request_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_requests"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      v_hr_attendance_days: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          department_name: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          first_check_in: string | null
          id: string | null
          is_holiday: boolean | null
          is_open: boolean | null
          is_rest_day: boolean | null
          last_check_out: string | null
          late_minutes: number | null
          missing_check_out: boolean | null
          overtime_approved_minutes: number | null
          overtime_minutes: number | null
          overtime_status: string | null
          punches: number | null
          scheduled_minutes: number | null
          updated_at: string | null
          updated_by: string | null
          work_date: string | null
          worked_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_attendance_day_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_attendance_day_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_attendance_day_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_attendance_day_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
        ]
      }
      v_hr_attendances: {
        Row: {
          active: boolean | null
          check_in: string | null
          check_out: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          id: string | null
          kiosk_id: string | null
          kiosk_name: string | null
          missing_check_out: boolean | null
          notes: string | null
          source: string | null
          updated_at: string | null
          updated_by: string | null
          work_date: string | null
          worked_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_attendance_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_attendance_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_attendance_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "hr_attendance_kiosk_fk"
            columns: ["company_id", "kiosk_id"]
            isOneToOne: false
            referencedRelation: "hr_kiosk"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      v_hr_leave_allocations: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          days: number | null
          employee_id: string | null
          employee_name: string | null
          id: string | null
          leave_type_id: string | null
          leave_type_name: string | null
          notes: string | null
          service_year: number | null
          updated_at: string | null
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_allocation_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_allocation_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_leave_allocation_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_leave_allocation_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "hr_leave_allocation_type_fk"
            columns: ["company_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_type"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      v_hr_leave_balances: {
        Row: {
          allocated_days: number | null
          company_id: string | null
          employee_id: string | null
          employee_name: string | null
          hire_date: string | null
          leave_type_id: string | null
          leave_type_name: string | null
          pending_days: number | null
          remaining_days: number | null
          taken_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      v_hr_leave_requests: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          days: number | null
          employee_id: string | null
          employee_name: string | null
          end_date: string | null
          half_day: boolean | null
          id: string | null
          leave_color: string | null
          leave_kind: string | null
          leave_type_id: string | null
          leave_type_name: string | null
          reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_request_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_request_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_leave_request_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_leave_request_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "hr_leave_request_type_fk"
            columns: ["company_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_type"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      v_hr_salaries: {
        Row: {
          active: boolean | null
          amount: number | null
          company_id: string | null
          contribution_base: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          daily_salary: number | null
          effective_date: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          id: string | null
          integrated_daily_wage: number | null
          job_title: string | null
          monthly_salary: number | null
          notes: string | null
          reason: string | null
          salary_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_salary_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_salary_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_salary_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "hr_salary_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
        ]
      }
      v_low_stock_products: {
        Row: {
          company_id: string | null
          company_name: string | null
          default_supplier_id: string | null
          id: string | null
          name: string | null
          quantity_needed: number | null
          sku: string | null
          stock_max: number | null
          stock_min: number | null
          stock_quantity: number | null
          supplier_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_attribution: {
        Row: {
          analytics_session_id: string | null
          company_id: string | null
          entry_path: string | null
          lead_id: string | null
          order_id: string | null
          origin: string | null
          referrer: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_order_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_order_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_lines: {
        Row: {
          company_id: string | null
          cost_delivered: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string | null
          margin: number | null
          margin_percent: number | null
          margin_real: number | null
          order_id: string | null
          order_name: string | null
          order_state: Database["public"]["Enums"]["order_state"] | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          partner_id: string | null
          price_include_tax: boolean | null
          product_barcode: string | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          quantity: number | null
          quantity_delivered: number | null
          quantity_invoiced: number | null
          quantity_pending: number | null
          quantity_refunded: number | null
          quantity_returned: number | null
          sequence: number | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number | null
          unit_cost: number | null
          unit_price: number | null
          uom_code: string | null
          uom_id: string | null
          uom_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_payments: {
        Row: {
          active: boolean | null
          amount: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          id: string | null
          notes: string | null
          order_id: string | null
          order_name: string | null
          order_origin: string | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          paid_at: string | null
          partner_id: string | null
          partner_name: string | null
          payment_method_id: string | null
          payment_method_name: string | null
          pos_payment_id: string | null
          pos_session_id: string | null
          pos_session_name: string | null
          reference: string | null
          refund_id: string | null
          refund_name: string | null
          source: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
          updated_by: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_pos_payment_id_fkey"
            columns: ["pos_payment_id"]
            isOneToOne: true
            referencedRelation: "pos_payment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_pos_payment_id_fkey"
            columns: ["pos_payment_id"]
            isOneToOne: true
            referencedRelation: "v_pos_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "order_refund"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "v_order_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_refunds: {
        Row: {
          active: boolean | null
          amount_reimbursed: number | null
          amount_tax: number | null
          amount_total: number | null
          amount_untaxed: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          id: string | null
          is_backfill: boolean | null
          name: string | null
          order_id: string | null
          order_name: string | null
          order_origin: string | null
          partner_id: string | null
          partner_name: string | null
          picking_id: string | null
          picking_name: string | null
          pos_session_id: string | null
          reason: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_refund_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "picking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "v_pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_orders: {
        Row: {
          amount_discount: number | null
          amount_paid: number | null
          amount_refunded: number | null
          amount_tax: number | null
          amount_total: number | null
          amount_untaxed: number | null
          balance_due: number | null
          checkout_token: string | null
          company_currency: string | null
          company_id: string | null
          company_name: string | null
          confirmation_date: string | null
          coupon_code: string | null
          coupon_discount: number | null
          created_at: string | null
          created_by: string | null
          created_by_partner_id: string | null
          created_by_partner_name: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_date: string | null
          delivery_status: string | null
          exchange_rate: number | null
          id: string | null
          is_delivered: boolean | null
          is_invoiced: boolean | null
          is_paid: boolean | null
          line_count: number | null
          name: string | null
          notes: string | null
          order_date: string | null
          order_state: Database["public"]["Enums"]["order_state"] | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          origin: string | null
          paid_at: string | null
          partner_email: string | null
          partner_id: string | null
          partner_name: string | null
          partner_vat: string | null
          payment_due_date: string | null
          payment_method_id: string | null
          payment_method_name: string | null
          payment_provider: string | null
          payment_status: string | null
          payment_term: string | null
          pos_session_id: string | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          reference: string | null
          shipping_city: string | null
          shipping_cost: number | null
          shipping_country_code: string | null
          shipping_method_name: string | null
          shipping_state: string | null
          shipping_street: string | null
          shipping_street2: string | null
          shipping_zip: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tax_included: boolean | null
          tax_rate: number | null
          terms: string | null
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_created_by_partner_id_fkey"
            columns: ["created_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      v_partner_companies: {
        Row: {
          accepted_at: string | null
          company_display_name: string | null
          company_id: string | null
          company_is_personal: boolean | null
          company_logo: string | null
          company_name: string | null
          company_status: Database["public"]["Enums"]["company_status"] | null
          invitation_status:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          is_active: boolean | null
          is_default: boolean | null
          partner_email: string | null
          partner_id: string | null
          partner_name: string | null
          relationship_id: string | null
          relationship_type:
            | Database["public"]["Enums"]["partner_relationship_type"]
            | null
          role: Database["public"]["Enums"]["partner_company_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_partner_company_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_partner_company_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_payroll_slips: {
        Row: {
          absence_days: number | null
          active: boolean | null
          company_id: string | null
          contribution_base: number | null
          created_at: string | null
          created_by: string | null
          daily_salary: number | null
          department_name: string | null
          employee_id: string | null
          employee_name: string | null
          employee_number: string | null
          employee_rfc: string | null
          employer_cost: number | null
          id: string | null
          imss_employee: number | null
          imss_employer: number | null
          infonavit_employer: number | null
          isn: number | null
          isr: number | null
          job_title: string | null
          net_pay: number | null
          overtime_double_hours: number | null
          overtime_triple_hours: number | null
          paid_days: number | null
          payment_date: string | null
          period_days: number | null
          period_end: string | null
          period_id: string | null
          period_name: string | null
          period_start: string | null
          period_status: string | null
          rest_days_worked: number | null
          subsidy: number | null
          sundays_worked: number | null
          total_deductions: number | null
          total_exempt: number | null
          total_perceptions: number | null
          total_taxable: number | null
          updated_at: string | null
          updated_by: string | null
          vacation_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_slip_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_slip_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employee"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "payroll_slip_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "payroll_slip_employee_fk"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "v_hr_leave_balances"
            referencedColumns: ["company_id", "employee_id"]
          },
          {
            foreignKeyName: "payroll_slip_period_fk"
            columns: ["company_id", "period_id"]
            isOneToOne: false
            referencedRelation: "payroll_period"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      v_picking_lines: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          done_quantity: number | null
          id: string | null
          is_partial: boolean | null
          lot_name: string | null
          order_id: string | null
          order_name: string | null
          picking_id: string | null
          picking_name: string | null
          picking_status: Database["public"]["Enums"]["picking_status"] | null
          picking_type: Database["public"]["Enums"]["picking_type"] | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          quantity: number | null
          scan_notes: string | null
          scanned_at: string | null
          sequence: number | null
          serial_number: string | null
          tracking_type: Database["public"]["Enums"]["product_tracking"] | null
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "picking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "v_pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pickings: {
        Row: {
          active: boolean | null
          cancelled_at: string | null
          company_id: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_partial: boolean | null
          is_return: boolean | null
          line_count: number | null
          move_value: number | null
          name: string | null
          notes: string | null
          order_id: string | null
          order_name: string | null
          order_state: Database["public"]["Enums"]["order_state"] | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          origin: Database["public"]["Enums"]["stock_move_origin"] | null
          published_at: string | null
          status: Database["public"]["Enums"]["picking_status"] | null
          total_quantity: number | null
          type: Database["public"]["Enums"]["picking_type"] | null
          updated_at: string | null
          updated_by: string | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pos_payments: {
        Row: {
          active: boolean | null
          amount: number | null
          change_amount: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_refund: boolean | null
          notes: string | null
          order_id: string | null
          order_name: string | null
          partner_id: string | null
          partner_name: string | null
          payment_method_id: string | null
          payment_method_is_cash: boolean | null
          payment_method_name: string | null
          register_id: string | null
          session_id: string | null
          session_name: string | null
          tendered: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "pos_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_session_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pos_register"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pos_sessions: {
        Row: {
          active: boolean | null
          blind_close: boolean | null
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          closing_notes: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          difference_tolerance: number | null
          id: string | null
          name: string | null
          opened_at: string | null
          opened_by: string | null
          opened_by_name: string | null
          opening_balance: number | null
          opening_notes: string | null
          refunds_total: number | null
          register_code: string | null
          register_id: string | null
          register_name: string | null
          sales_count: number | null
          sales_total: number | null
          status: Database["public"]["Enums"]["pos_session_status"] | null
          total_difference: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_session_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_session_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pos_register"
            referencedColumns: ["id"]
          },
        ]
      }
      v_product_stock: {
        Row: {
          active: boolean | null
          barcode: string | null
          category_id: string | null
          category_name: string | null
          company_id: string | null
          cost_price: number | null
          created_at: string | null
          id: string | null
          is_stockable: boolean | null
          last_move_at: string | null
          name: string | null
          product_type: Database["public"]["Enums"]["product_type"] | null
          retail_value: number | null
          sale_price: number | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock_max: number | null
          stock_min: number | null
          stock_quantity: number | null
          stock_status: string | null
          stock_value: number | null
          suggested_restock: number | null
          tracking: Database["public"]["Enums"]["product_tracking"] | null
          unit_cost: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      v_products: {
        Row: {
          attributes: Json | null
          barcode: string | null
          can_be_purchased: boolean | null
          can_be_sold: boolean | null
          category_id: string | null
          category_name: string | null
          company_id: string | null
          company_name: string | null
          cost_price: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          default_supplier_id: string | null
          description: string | null
          display_name: string | null
          featured: boolean | null
          height: number | null
          id: string | null
          image_url: string | null
          images: Json | null
          internal_ref: string | null
          is_published: boolean | null
          is_stockable: boolean | null
          lead_time: number | null
          length: number | null
          list_price: number | null
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          name: string | null
          notes: string | null
          product_type: Database["public"]["Enums"]["product_type"] | null
          purchase_uom_code: string | null
          purchase_uom_id: string | null
          purchase_uom_name: string | null
          sale_price: number | null
          short_description: string | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock_max: number | null
          stock_min: number | null
          stock_quantity: number | null
          supplier_name: string | null
          supplier_sku: string | null
          tags: string[] | null
          tax_included: boolean | null
          tax_rate: number | null
          tracking: Database["public"]["Enums"]["product_tracking"] | null
          uom_code: string | null
          uom_id: string | null
          uom_name: string | null
          updated_at: string | null
          updated_by: string | null
          volume: number | null
          weight: number | null
          weight_unit: string | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_tasks: {
        Row: {
          active: boolean | null
          actual_cost: number | null
          actual_hours: number | null
          code: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          days_until_due: number | null
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          estimated_hours: number | null
          id: string | null
          is_overdue: boolean | null
          name: string | null
          notes: string | null
          order_index: number | null
          priority: Database["public"]["Enums"]["project_priority"] | null
          progress: number | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          project_status: Database["public"]["Enums"]["project_status"] | null
          responsible_avatar_url: string | null
          responsible_display_name: string | null
          responsible_email: string | null
          responsible_name: string | null
          responsible_partner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_task_status"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_task_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_projects: {
        Row: {
          active: boolean | null
          budget_actual: number | null
          budget_estimated: number | null
          code: string | null
          color: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          days_remaining: number | null
          description: string | null
          end_date_actual: string | null
          end_date_estimated: string | null
          id: string | null
          income_amount: number | null
          is_overdue: boolean | null
          is_public: boolean | null
          name: string | null
          notes: string | null
          overdue_task_count: number | null
          priority: Database["public"]["Enums"]["project_priority"] | null
          progress: number | null
          project_type_code: string | null
          project_type_color: string | null
          project_type_id: string | null
          project_type_name: string | null
          requisition_amount: number | null
          responsible_avatar_url: string | null
          responsible_display_name: string | null
          responsible_email: string | null
          responsible_name: string | null
          responsible_partner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          task_cancelled_count: number | null
          task_completed_count: number | null
          task_count: number | null
          task_in_progress_count: number | null
          task_pending_count: number | null
          total_actual_hours: number | null
          total_estimated_hours: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_purchases_by_supplier: {
        Row: {
          company_id: string | null
          first_order_date: string | null
          last_order_date: string | null
          order_count: number | null
          partner_id: string | null
          supplier_name: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_revenue_ledger: {
        Row: {
          amount: number | null
          amount_net: number | null
          channel: string | null
          company_id: string | null
          document_id: string | null
          kind: string | null
          occurred_at: string | null
          order_id: string | null
          order_name: string | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          partner_id: string | null
          payment_method_id: string | null
          product_id: string | null
          quantity: number | null
          source: string | null
        }
        Relationships: []
      }
      v_sales_by_partner: {
        Row: {
          company_id: string | null
          first_order_date: string | null
          last_order_date: string | null
          order_count: number | null
          partner_id: string | null
          partner_name: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_availability: {
        Row: {
          available: number | null
          company_id: string | null
          on_hand: number | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          reserved: number | null
          tracking: Database["public"]["Enums"]["product_tracking"] | null
          updated_at: string | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_quant_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quant_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_moves: {
        Row: {
          avg_cost_after: number | null
          balance_after: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          lot_name: string | null
          move_type: Database["public"]["Enums"]["stock_move_type"] | null
          notes: string | null
          occurred_at: string | null
          order_id: string | null
          order_name: string | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          origin: Database["public"]["Enums"]["stock_move_origin"] | null
          picking_id: string | null
          picking_line_id: string | null
          picking_name: string | null
          picking_type: Database["public"]["Enums"]["picking_type"] | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          product_uom_id: string | null
          quantity: number | null
          reference: string | null
          serial_number: string | null
          signed_quantity: number | null
          total_cost: number | null
          unit_cost: number | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_uom_id_fkey"
            columns: ["product_uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_attribution"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_move_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "picking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "v_pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_picking_line_id_fkey"
            columns: ["picking_line_id"]
            isOneToOne: false
            referencedRelation: "picking_line"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_picking_line_id_fkey"
            columns: ["picking_line_id"]
            isOneToOne: false
            referencedRelation: "v_picking_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_move_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _convert_website_submission_to_lead: {
        Args: { p_submission_id: string; p_user_id?: string }
        Returns: Json
      }
      _prepare_order_delivery: { Args: { p_order_id: string }; Returns: Json }
      add_order_line: {
        Args: {
          p_description?: string
          p_discount_percent?: number
          p_order_id: string
          p_product_id?: string
          p_quantity?: number
          p_tax_rate?: number
          p_unit_cost?: number
          p_unit_price?: number
        }
        Returns: string
      }
      add_pos_cash_movement: {
        Args: {
          p_amount: number
          p_movement_type: Database["public"]["Enums"]["pos_movement_type"]
          p_reason: string
          p_session_id: string
        }
        Returns: string
      }
      apply_picking_inventory: {
        Args: { p_picking_id: string }
        Returns: boolean
      }
      apply_picking_to_order: {
        Args: { p_picking_id: string }
        Returns: undefined
      }
      approval_activate_next: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      approval_add_approver: {
        Args: {
          p_parallel?: boolean
          p_partner_id: string
          p_reason: string
          p_request_id: string
        }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_add_business_days: {
        Args: { p_company_id: string; p_days: number; p_from: string }
        Returns: string
      }
      approval_add_comment: {
        Args: { p_body: string; p_mentions?: string[]; p_request_id: string }
        Returns: {
          active: boolean
          author_partner_id: string
          body: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          mentions: string[]
          request_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request_comment"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_advance: { Args: { p_request_id: string }; Returns: undefined }
      approval_amount_limit: {
        Args: {
          p_category_id: string
          p_company_id: string
          p_partner_id: string
        }
        Returns: number
      }
      approval_approve_request: {
        Args: { p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_assert_owner_or_admin: {
        Args: {
          p_request: Database["public"]["Tables"]["approval_request"]["Row"]
        }
        Returns: undefined
      }
      approval_build_context: {
        Args: {
          p_amount: number
          p_category_id: string
          p_company_id: string
          p_field_values: Json
          p_priority: string
          p_request_id?: string
          p_requester_partner_id: string
        }
        Returns: Json
      }
      approval_bulk_decide: {
        Args: {
          p_comment?: string
          p_decision: string
          p_reason_id?: string
          p_request_ids: string[]
        }
        Returns: Json
      }
      approval_can_edit: { Args: { p_request_id: string }; Returns: boolean }
      approval_can_view: { Args: { p_request_id: string }; Returns: boolean }
      approval_cancel_request: {
        Args: { p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_cancel_with_reason: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_close_actions: {
        Args: { p_partner_id?: string; p_request_id: string }
        Returns: undefined
      }
      approval_covers_amount: {
        Args: {
          p_amount: number
          p_category_id: string
          p_company_id: string
          p_partner_id: string
        }
        Returns: boolean
      }
      approval_create_for_leave: {
        Args: { p_leave_id: string }
        Returns: string
      }
      approval_dashboard: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      approval_decide: {
        Args: {
          p_comment?: string
          p_decision: string
          p_reason_id?: string
          p_request_id: string
        }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_delegate_of: {
        Args: {
          p_category_id: string
          p_company_id: string
          p_on?: string
          p_partner_id: string
        }
        Returns: string
      }
      approval_department_manager_of: {
        Args: { p_company_id: string; p_partner_id: string }
        Returns: string
      }
      approval_department_of: {
        Args: { p_company_id: string; p_partner_id: string }
        Returns: string
      }
      approval_escalate_for_amount: {
        Args: {
          p_amount: number
          p_category_id: string
          p_company_id: string
          p_from_partner_id: string
        }
        Returns: string
      }
      approval_eval_condition: {
        Args: { p_condition: Json; p_ctx: Json }
        Returns: boolean
      }
      approval_eval_rule: {
        Args: { p_ctx: Json; p_rule: Json }
        Returns: boolean
      }
      approval_export_config: { Args: { p_company_id: string }; Returns: Json }
      approval_finalize: {
        Args: {
          p_auto?: boolean
          p_automatic?: boolean
          p_forced?: boolean
          p_note?: string
          p_reason_id?: string
          p_request_id: string
          p_status: Database["public"]["Enums"]["approval_request_status"]
        }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_force_resolve: {
        Args: { p_decision: string; p_reason: string; p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_get_settings: {
        Args: { p_company_id: string }
        Returns: {
          advanced_enabled: boolean
          company_id: string
          created_at: string
          created_by: string | null
          dedupe_consecutive: boolean
          default_sla_days: number | null
          escalation_action: string
          expire_after_days: number | null
          notify_requester_each_level: boolean
          prevent_self_approval: boolean
          reminder_every_hours: number
          require_reject_reason: boolean
          restart_from_first: boolean
          self_approval_fallback: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_import_config: {
        Args: { p_company_id: string; p_config: Json }
        Returns: Json
      }
      approval_is_eligible: {
        Args: {
          p_category_id?: string
          p_company_id: string
          p_partner_id: string
        }
        Returns: boolean
      }
      approval_is_owner: {
        Args: { p_company_id: string; p_partner_id: string }
        Returns: boolean
      }
      approval_is_registered: {
        Args: {
          p_category_id?: string
          p_company_id: string
          p_partner_id: string
        }
        Returns: boolean
      }
      approval_load_demo: { Args: { p_company_id: string }; Returns: Json }
      approval_log: {
        Args: {
          p_automatic?: boolean
          p_event_type: string
          p_payload?: Json
          p_request_id: string
        }
        Returns: undefined
      }
      approval_manager_of: {
        Args: { p_company_id: string; p_partner_id: string }
        Returns: string
      }
      approval_mark_activities_read: {
        Args: { p_activity_ids?: string[]; p_company_id?: string }
        Returns: number
      }
      approval_materialize_plan: {
        Args: {
          p_plan: Json
          p_request_id: string
          p_round: number
          p_skip_below_sequence?: number
        }
        Returns: undefined
      }
      approval_notify: {
        Args: {
          p_actionable?: boolean
          p_kind: string
          p_partner_id: string
          p_request_id: string
          p_scheduled_at?: string
          p_title: string
        }
        Returns: undefined
      }
      approval_on_resolved: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      approval_owner_partners: {
        Args: { p_company_id: string }
        Returns: string[]
      }
      approval_partner_can_view: {
        Args: { p_partner_id: string; p_request_id: string }
        Returns: boolean
      }
      approval_partner_name: { Args: { p_partner_id: string }; Returns: string }
      approval_plan_with_names: { Args: { p_plan: Json }; Returns: Json }
      approval_preview_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      approval_process_sla: { Args: { p_company_id?: string }; Returns: Json }
      approval_publish_request: {
        Args: { p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_reassign: {
        Args: {
          p_approver_id: string
          p_reason: string
          p_to_partner_id: string
        }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_reject_request: {
        Args: { p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_request_insights: {
        Args: { p_request_id: string }
        Returns: Json
      }
      approval_request_label: {
        Args: { p_request_id: string }
        Returns: string
      }
      approval_reset_request_to_draft: {
        Args: { p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_resolve_plan: {
        Args: {
          p_assigned_manager_id: string
          p_category_id: string
          p_company_id: string
          p_ctx: Json
          p_requester_partner_id: string
        }
        Returns: Json
      }
      approval_return_request: {
        Args: { p_comment: string; p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_revoke_decision: {
        Args: { p_reason: string; p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_row_visible: {
        Args: {
          p_captured_by_partner_id: string
          p_category_id: string
          p_company_id: string
          p_request_id: string
          p_requester_partner_id: string
        }
        Returns: boolean
      }
      approval_row_visible_to: {
        Args: {
          p_captured_by_partner_id: string
          p_category_id: string
          p_company_id: string
          p_partner_id: string
          p_request_id: string
          p_requester_partner_id: string
        }
        Returns: boolean
      }
      approval_run_sla_now: { Args: { p_company_id: string }; Returns: Json }
      approval_simulate: {
        Args: {
          p_amount?: number
          p_assigned_manager_id?: string
          p_category_id: string
          p_company_id: string
          p_field_values?: Json
          p_priority?: string
          p_requester_partner_id: string
        }
        Returns: Json
      }
      approval_step_outcome: { Args: { p_step_id: string }; Returns: string }
      approval_storage_can_access: {
        Args: { p_name: string }
        Returns: boolean
      }
      approval_submit_internal: {
        Args: { p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_submit_request: {
        Args: { p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_try_numeric: { Args: { p_value: string }; Returns: number }
      approval_update_submitted: {
        Args: { p_changes: Json; p_request_id: string }
        Returns: {
          active: boolean
          amount: number | null
          approved_at: string | null
          assigned_approval_manager_id: string | null
          auto_approved: boolean
          cancelled_at: string | null
          captured_by_partner_id: string | null
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          expired_at: string | null
          field_values: Json
          flow_id: string | null
          flow_version: number | null
          forced: boolean
          id: string
          priority: string
          reference: string | null
          rejected_at: string | null
          rejection_reason_id: string | null
          request_date: string
          request_number: number
          requesting_partner_id: string
          resolution_note: string | null
          resolved_by_partner_id: string | null
          returned_at: string | null
          returned_from_sequence: number | null
          round: number
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["approval_request_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "approval_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approval_verify_event_chain: {
        Args: { p_request_id: string }
        Returns: Json
      }
      approver_can_act_on_category: {
        Args: { p_category_id: string; p_manager_id: string }
        Returns: boolean
      }
      assert_category_available_for_request: {
        Args: { p_category_id: string }
        Returns: undefined
      }
      assert_manager_assignable_for_request: {
        Args: {
          p_category_id: string
          p_company_id: string
          p_manager_id: string
        }
        Returns: undefined
      }
      assert_stock_available: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_warehouse_id: string
        }
        Returns: undefined
      }
      assert_user_is_assigned_approver: {
        Args: { p_request: Record<string, unknown> }
        Returns: undefined
      }
      auto_link_order_to_lead: { Args: { p_order_id: string }; Returns: string }
      build_picking_lines: {
        Args: {
          p_is_return?: boolean
          p_picking_id: string
          p_product_id: string
          p_quantity: number
          p_sequence?: number
        }
        Returns: number
      }
      cancel_order: { Args: { p_order_id: string }; Returns: boolean }
      close_pos_session: {
        Args: { p_counts?: Json; p_notes?: string; p_session_id: string }
        Returns: Json
      }
      close_restock_task: { Args: { p_product_id: string }; Returns: number }
      condone_order_balance: {
        Args: { p_order_id: string; p_reason: string }
        Returns: boolean
      }
      convert_website_submission_to_lead: {
        Args: { p_submission_id: string }
        Returns: Json
      }
      create_order: {
        Args: {
          p_company_id: string
          p_currency?: string
          p_order_type: Database["public"]["Enums"]["order_type"]
          p_partner_id: string
          p_tax_rate?: number
        }
        Returns: string
      }
      create_partner_for_company: {
        Args: { p_company_id: string; p_partner: Json }
        Returns: {
          active: boolean | null
          avatar_url: string | null
          barcode: string | null
          birthdate: string | null
          city: string | null
          comment: string | null
          company_type: Database["public"]["Enums"]["partner_type"] | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          display_name: string | null
          email: string | null
          function: string | null
          id: string
          is_company: boolean | null
          lang: string | null
          mobile: string | null
          name: string
          parent_id: string | null
          phone: string | null
          ref: string | null
          state: string | null
          street: string | null
          street2: string | null
          title: Database["public"]["Enums"]["partner_title"] | null
          tz: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          vat: string | null
          website: string | null
          zip: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partner"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_quotation_from_lead: { Args: { p_lead_id: string }; Returns: Json }
      create_stock_adjustment: {
        Args: {
          p_new_quantity: number
          p_product_id: string
          p_reason: string
          p_unit_cost?: number
          p_warehouse_id?: string
        }
        Returns: Json
      }
      current_user_partner_row_id: { Args: never; Returns: string }
      derive_stock_origin: {
        Args: {
          p_is_return: boolean
          p_order_id: string
          p_type: Database["public"]["Enums"]["picking_type"]
        }
        Returns: Database["public"]["Enums"]["stock_move_origin"]
      }
      ensure_restock_task: { Args: { p_product_id: string }; Returns: string }
      generate_restock_tasks: { Args: { p_company_id: string }; Returns: Json }
      get_active_websites: { Args: never; Returns: Json }
      get_available_stock: {
        Args: {
          p_exclude_order_id?: string
          p_product_id: string
          p_warehouse_id?: string
        }
        Returns: number
      }
      get_company_members: {
        Args: {
          p_company_id: string
          p_relationship_type?: Database["public"]["Enums"]["partner_relationship_type"]
        }
        Returns: {
          accepted_at: string
          company_id: string
          created_at: string
          invitation_status: string
          invited_at: string
          invited_by_email: string
          invited_by_name: string
          invited_by_partner_id: string
          is_active: boolean
          is_default: boolean
          partner_avatar_url: string
          partner_display_name: string
          partner_email: string
          partner_id: string
          partner_name: string
          partner_user_id: string
          relationship_id: string
          relationship_type: string
          role: string
        }[]
      }
      get_inventory_summary: { Args: { p_company_id: string }; Returns: Json }
      get_my_invitations: {
        Args: never
        Returns: {
          company_display_name: string
          company_id: string
          company_is_personal: boolean
          company_logo_url: string
          company_name: string
          invitation_status: string
          invited_at: string
          invited_by_email: string
          invited_by_name: string
          invited_by_partner_id: string
          relationship_id: string
          role: string
        }[]
      }
      get_or_create_default_warehouse: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_or_create_restock_project: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_order_delivery_shortages: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_partner_companies: {
        Args: { p_partner_id: string }
        Returns: {
          company_id: string
          invitation_status: string
          is_default: boolean
          role: string
        }[]
      }
      get_pos_session_summary: { Args: { p_session_id: string }; Returns: Json }
      get_product_stock_card: {
        Args: { p_limit?: number; p_product_id: string }
        Returns: Json
      }
      get_public_project_view: { Args: { p_project_id: string }; Returns: Json }
      get_reserved_stock: {
        Args: {
          p_exclude_order_id?: string
          p_product_id: string
          p_warehouse_id?: string
        }
        Returns: number
      }
      get_sales_kpis: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      get_storefront: { Args: { p_slug: string }; Returns: Json }
      get_storefront_active_visitors: {
        Args: { p_company_id: string }
        Returns: number
      }
      get_storefront_checkout_info: { Args: { p_slug: string }; Returns: Json }
      get_storefront_my_orders: { Args: { p_slug: string }; Returns: Json }
      get_storefront_order: {
        Args: { p_email: string; p_order_ref: string; p_slug: string }
        Returns: Json
      }
      get_storefront_product: {
        Args: { p_product_slug: string; p_slug: string }
        Returns: Json
      }
      get_storefront_products: {
        Args: {
          p_category_id?: string
          p_max_price?: number
          p_min_price?: number
          p_only_in_stock?: boolean
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_slug: string
          p_sort?: string
        }
        Returns: Json
      }
      get_storefront_stripe_config: { Args: { p_slug: string }; Returns: Json }
      get_storefront_stripe_order: {
        Args: { p_email: string; p_order_ref: string; p_slug: string }
        Returns: Json
      }
      get_warehouse_stock: { Args: { p_warehouse_id: string }; Returns: Json }
      get_website: {
        Args: { p_preview?: boolean; p_slug: string }
        Returns: Json
      }
      get_website_admin_stats: { Args: { p_company_id: string }; Returns: Json }
      get_website_galleries: {
        Args: { p_preview?: boolean; p_slug: string }
        Returns: Json
      }
      get_website_gallery: {
        Args: { p_gallery_slug: string; p_preview?: boolean; p_slug: string }
        Returns: Json
      }
      get_website_page: {
        Args: { p_page_slug?: string; p_preview?: boolean; p_slug: string }
        Returns: Json
      }
      get_website_post: {
        Args: { p_post_slug: string; p_preview?: boolean; p_slug: string }
        Returns: Json
      }
      get_website_posts: {
        Args: {
          p_author?: string
          p_category?: string
          p_exclude_id?: string
          p_featured_only?: boolean
          p_page?: number
          p_page_size?: number
          p_preview?: boolean
          p_search?: string
          p_slug: string
          p_sort?: string
          p_tag?: string
        }
        Returns: Json
      }
      get_website_sitemap: { Args: { p_slug: string }; Returns: Json }
      get_website_taxonomy: {
        Args: { p_preview?: boolean; p_slug: string }
        Returns: Json
      }
      hr_apply_leave_review: {
        Args: { p_approve: boolean; p_notes?: string; p_request_id: string }
        Returns: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          days: number
          employee_id: string
          end_date: string
          half_day: boolean
          id: string
          leave_type_id: string
          reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "hr_leave_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_attendance_summary: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: {
          absences_justified: number
          absences_unjustified: number
          days_worked: number
          department_name: string
          employee_id: string
          employee_name: string
          employee_number: string
          holidays_worked: number
          late_count: number
          late_minutes: number
          leave_days: number
          missing_check_outs: number
          overtime_approved_minutes: number
          overtime_minutes: number
          overtime_pending_minutes: number
          rest_days_worked: number
          scheduled_minutes: number
          sundays_worked: number
          worked_minutes: number
        }[]
      }
      hr_count_leave_days: {
        Args: {
          p_employee_id: string
          p_end: string
          p_half_day?: boolean
          p_start: string
        }
        Returns: number
      }
      hr_create_kiosk: {
        Args: { p_company_id: string; p_location?: string; p_name: string }
        Returns: Json
      }
      hr_detect_absences: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: number
      }
      hr_ensure_defaults: { Args: { p_company_id: string }; Returns: undefined }
      hr_generate_vacation_allocations: {
        Args: { p_as_of?: string; p_company_id: string }
        Returns: number
      }
      hr_is_own_employee: { Args: { p_employee_id: string }; Returns: boolean }
      hr_kiosk_pin_employees: {
        Args: { p_company_id: string }
        Returns: string[]
      }
      hr_lft_vacation_days: { Args: { p_years: number }; Returns: number }
      hr_new_kiosk_token: { Args: never; Returns: string }
      hr_recompute_attendance_day: {
        Args: { p_employee_id: string; p_work_date: string }
        Returns: undefined
      }
      hr_regenerate_kiosk_token: { Args: { p_kiosk_id: string }; Returns: Json }
      hr_review_leave_request: {
        Args: { p_approve: boolean; p_notes?: string; p_request_id: string }
        Returns: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          days: number
          employee_id: string
          end_date: string
          half_day: boolean
          id: string
          leave_type_id: string
          reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "hr_leave_request"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_review_overtime: {
        Args: { p_approve: boolean; p_day_id: string; p_minutes?: number }
        Returns: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          first_check_in: string | null
          id: string
          is_holiday: boolean
          is_open: boolean
          is_rest_day: boolean
          last_check_out: string | null
          late_minutes: number
          missing_check_out: boolean
          overtime_approved_minutes: number
          overtime_minutes: number
          overtime_status: string
          punches: number
          scheduled_minutes: number
          updated_at: string | null
          updated_by: string | null
          work_date: string
          worked_minutes: number
        }
        SetofOptions: {
          from: "*"
          to: "hr_attendance_day"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_save_work_schedule: {
        Args: {
          p_company_id: string
          p_lines: Json
          p_schedule: Json
          p_schedule_id: string
        }
        Returns: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          late_tolerance_minutes: number | null
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "hr_work_schedule"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_set_kiosk_pin: {
        Args: { p_employee_id: string; p_pin: string }
        Returns: boolean
      }
      hr_settings_for: {
        Args: { p_company_id: string }
        Returns: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          kiosk_pin_min_length: number
          late_tolerance_minutes: number
          overtime_min_minutes: number
          overtime_requires_approval: boolean
          payroll_frequency: string
          pin_salt: string
          timezone: string
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "hr_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hr_sha256: { Args: { p_value: string }; Returns: string }
      ingest_storefront_events: {
        Args: { p_context?: Json; p_events: Json; p_slug: string }
        Returns: Json
      }
      initialize_website: { Args: { p_company_id: string }; Returns: Json }
      invite_partner_by_email: {
        Args: {
          p_company_id: string
          p_email: string
          p_role?: Database["public"]["Enums"]["partner_company_role"]
        }
        Returns: string
      }
      invite_partner_to_company: {
        Args: {
          p_company_id: string
          p_invited_by?: string
          p_partner_id: string
          p_role?: Database["public"]["Enums"]["partner_company_role"]
        }
        Returns: string
      }
      is_active_approver_for_company: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      is_company_admin: { Args: { p_company_id: string }; Returns: boolean }
      is_company_member: { Args: { p_company_id: string }; Returns: boolean }
      is_invited_to_company: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      is_own_partner: { Args: { p_partner_id: string }; Returns: boolean }
      kiosk_info: { Args: { p_token: string }; Returns: Json }
      kiosk_punch: { Args: { p_pin: string; p_token: string }; Returns: Json }
      mark_lead_won: { Args: { p_lead_id: string }; Returns: undefined }
      mark_storefront_order_paid: {
        Args: {
          p_amount: number
          p_currency: string
          p_order_id: string
          p_payment_intent: string
          p_session_id: string
        }
        Returns: Json
      }
      open_pos_session: {
        Args: {
          p_notes?: string
          p_opening_balance?: number
          p_register_id: string
        }
        Returns: string
      }
      order_line_pending_quantity: {
        Args: {
          p_delivered: number
          p_quantity: number
          p_refunded: number
          p_returned: number
        }
        Returns: number
      }
      partner_shares_company_with_user: {
        Args: { p_partner_id: string }
        Returns: boolean
      }
      payroll_period_header: {
        Args: { p_period_id: string }
        Returns: {
          end_date: string
          name: string
          payment_date: string
          start_date: string
          status: string
        }[]
      }
      payroll_period_status: { Args: { p_period_id: string }; Returns: string }
      payroll_save_calculation: {
        Args: { p_period_id: string; p_slips: Json }
        Returns: {
          active: boolean | null
          approved_at: string | null
          approved_by: string | null
          calculated_at: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          employee_count: number
          end_date: string
          fiscal_year: number
          frequency: string
          id: string
          name: string
          notes: string | null
          paid_at: string | null
          payment_date: string | null
          start_date: string
          status: string
          total_deductions: number
          total_employer_cost: number
          total_net: number
          total_perceptions: number
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payroll_period"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      payroll_set_period_status: {
        Args: { p_period_id: string; p_status: string }
        Returns: {
          active: boolean | null
          approved_at: string | null
          approved_by: string | null
          calculated_at: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          employee_count: number
          end_date: string
          fiscal_year: number
          frequency: string
          id: string
          name: string
          notes: string | null
          paid_at: string | null
          payment_date: string | null
          start_date: string
          status: string
          total_deductions: number
          total_employer_cost: number
          total_net: number
          total_perceptions: number
          updated_at: string | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payroll_period"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      place_storefront_order: {
        Args: {
          p_checkout_token: string
          p_coupon_code?: string
          p_customer: Json
          p_items: Json
          p_notes?: string
          p_payment_method_id?: string
          p_payment_provider?: string
          p_shipping_method_id: string
          p_slug: string
        }
        Returns: Json
      }
      platform_health_check: { Args: never; Returns: Json }
      platform_health_ping: { Args: { p_source?: string }; Returns: Json }
      platform_health_status: { Args: never; Returns: Json }
      post_order: { Args: { p_order_id: string }; Returns: boolean }
      prepare_order_delivery: { Args: { p_order_id: string }; Returns: Json }
      preview_order_stock_shortages: {
        Args: { p_order_id: string }
        Returns: {
          available: number
          product_id: string
          product_name: string
          requested: number
        }[]
      }
      react_website_post: {
        Args: {
          p_count?: number
          p_post_slug: string
          p_slug: string
          p_visitor_id: string
        }
        Returns: Json
      }
      recompute_order_delivery: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      recompute_order_payment: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      recompute_project_metrics: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      recompute_project_order_amounts: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      record_stock_move: {
        Args: {
          p_company_id: string
          p_lot_name?: string
          p_move_type: Database["public"]["Enums"]["stock_move_type"]
          p_notes?: string
          p_occurred_at?: string
          p_order_id?: string
          p_origin?: Database["public"]["Enums"]["stock_move_origin"]
          p_picking_id?: string
          p_picking_line_id?: string
          p_product_id: string
          p_quantity: number
          p_reference?: string
          p_serial_number?: string
          p_unit_cost?: number
          p_warehouse_id?: string
        }
        Returns: string
      }
      record_storefront_stripe_session: {
        Args: { p_order_id: string; p_session_id: string }
        Returns: Json
      }
      register_employee: {
        Args: {
          p_company_id: string
          p_employee?: Json
          p_partner?: Json
          p_partner_id?: string
        }
        Returns: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          department_id: string | null
          employee_number: string | null
          hire_date: string | null
          id: string
          job_title: string | null
          manager_id: string | null
          partner_id: string
          status: string
          termination_date: string | null
          updated_at: string | null
          updated_by: string | null
          work_email: string | null
          work_location: string | null
          work_phone: string | null
          work_schedule_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "employee"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_order_payment: {
        Args: {
          p_amount: number
          p_notes?: string
          p_order_id: string
          p_paid_at?: string
          p_payment_method_id: string
          p_reference?: string
        }
        Returns: Json
      }
      register_order_refund: {
        Args: {
          p_lines: Json
          p_order_id: string
          p_pos_session_id?: string
          p_reason: string
          p_refund_amount?: number
          p_refund_method_id?: string
          p_restock?: boolean
        }
        Returns: Json
      }
      register_pos_refund: {
        Args: {
          p_lines: Json
          p_order_id: string
          p_payment_method_id: string
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      register_pos_sale: {
        Args: {
          p_lines: Json
          p_notes?: string
          p_partner_id: string
          p_payments: Json
          p_session_id: string
        }
        Returns: Json
      }
      register_website_post_view: {
        Args: { p_post_slug: string; p_slug: string; p_visitor_id: string }
        Returns: Json
      }
      remove_company_member: { Args: { p_rel_id: string }; Returns: boolean }
      resolve_order_warehouse: { Args: { p_order_id: string }; Returns: string }
      resolve_picking_origin: {
        Args: { p_picking_id: string }
        Returns: Database["public"]["Enums"]["stock_move_origin"]
      }
      resolve_storefront_company: { Args: { p_slug: string }; Returns: string }
      resolve_website_company: {
        Args: { p_preview?: boolean; p_slug: string }
        Returns: string
      }
      respond_to_invitation: {
        Args: { p_accept: boolean; p_rel_id: string }
        Returns: boolean
      }
      run_storefront_analytics_jobs: { Args: never; Returns: Json }
      search_website: {
        Args: { p_limit?: number; p_q: string; p_slug: string }
        Returns: Json
      }
      seed_crm_lost_reasons: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      seed_crm_stages: { Args: { p_company_id: string }; Returns: undefined }
      seed_product_uoms: { Args: { p_company_id: string }; Returns: undefined }
      set_picking_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["picking_status"]
          p_picking_id: string
        }
        Returns: boolean
      }
      set_project_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["project_status"]
          p_project_id: string
        }
        Returns: boolean
      }
      set_project_task_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["project_task_status"]
          p_task_id: string
        }
        Returns: boolean
      }
      set_website_post_tags: {
        Args: { p_post_id: string; p_tag_names: string[] }
        Returns: Json
      }
      storefront_analytics_cleanup: {
        Args: { p_keep_days?: number }
        Returns: Json
      }
      storefront_analytics_forget_visitor: {
        Args: { p_anonymous_id: string; p_company_id: string }
        Returns: Json
      }
      storefront_analytics_rollup: {
        Args: { p_days?: number }
        Returns: number
      }
      storefront_analytics_sessionize: {
        Args: { p_lookback?: string }
        Returns: number
      }
      storefront_display_price: {
        Args: { p_price: number; p_tax_included: boolean; p_tax_rate: number }
        Returns: number
      }
      storefront_product_card: { Args: { p_product_id: string }; Returns: Json }
      submit_website_comment: {
        Args: {
          p_author_email: string
          p_author_name: string
          p_body: string
          p_honeypot?: string
          p_parent_id?: string
          p_post_slug: string
          p_slug: string
          p_visitor_id?: string
        }
        Returns: Json
      }
      submit_website_contact: {
        Args: {
          p_email: string
          p_honeypot?: string
          p_message: string
          p_name: string
          p_page_id?: string
          p_payload?: Json
          p_phone: string
          p_slug: string
          p_source_url?: string
          p_subject: string
          p_visitor_id?: string
        }
        Returns: Json
      }
      sync_lead_revenue: { Args: { p_lead_id: string }; Returns: undefined }
      sync_order_to_draft_picking: {
        Args: { p_is_return?: boolean; p_order_id: string }
        Returns: string
      }
      transfer_stock: {
        Args: {
          p_from_warehouse_id: string
          p_lot_name?: string
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_serial_number?: string
          p_to_warehouse_id: string
        }
        Returns: Json
      }
      update_member_role: {
        Args: {
          p_rel_id: string
          p_role: Database["public"]["Enums"]["partner_company_role"]
        }
        Returns: boolean
      }
      update_partner_for_company: {
        Args: { p_partner_id: string; p_updates: Json }
        Returns: {
          active: boolean | null
          avatar_url: string | null
          barcode: string | null
          birthdate: string | null
          city: string | null
          comment: string | null
          company_type: Database["public"]["Enums"]["partner_type"] | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          display_name: string | null
          email: string | null
          function: string | null
          id: string
          is_company: boolean | null
          lang: string | null
          mobile: string | null
          name: string
          parent_id: string | null
          phone: string | null
          ref: string | null
          state: string | null
          street: string | null
          street2: string | null
          title: Database["public"]["Enums"]["partner_title"] | null
          tz: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          vat: string | null
          website: string | null
          zip: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partner"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_belongs_to_company: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      validate_storefront_coupon: {
        Args: { p_code: string; p_slug: string; p_subtotal: number }
        Returns: Json
      }
      void_order_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: boolean
      }
      website_author_json: { Args: { p_author_id: string }; Returns: Json }
      website_can_preview: { Args: { p_company_id: string }; Returns: boolean }
      website_media_path_company: { Args: { p_name: string }; Returns: string }
      website_menu_json: {
        Args: {
          p_code: string
          p_company_id: string
          p_company_slug: string
          p_preview: boolean
        }
        Returns: Json
      }
      website_post_card: { Args: { p_post_id: string }; Returns: Json }
      website_site_json: { Args: { p_company_id: string }; Returns: Json }
      website_slugify: { Args: { p_text: string }; Returns: string }
    }
    Enums: {
      approval_request_status:
        | "draft"
        | "published"
        | "approved"
        | "rejected"
        | "cancelled"
        | "returned"
        | "expired"
      company_size: "micro" | "small" | "medium" | "large" | "enterprise"
      company_status:
        | "active"
        | "inactive"
        | "suspended"
        | "pending_verification"
      crm_activity_status: "pending" | "done" | "overdue"
      crm_activity_type:
        | "call"
        | "meeting"
        | "email"
        | "demo"
        | "followup"
        | "task"
      crm_history_event:
        | "created"
        | "stage_changed"
        | "responsible_changed"
        | "order_linked"
        | "order_unlinked"
        | "priority_changed"
        | "closed_won"
        | "closed_lost"
        | "reopened"
      crm_lead_origin:
        | "web"
        | "referral"
        | "campaign"
        | "call"
        | "email"
        | "event"
        | "other"
      crm_lead_priority: "low" | "medium" | "high"
      invitation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      order_state: "draft" | "posted" | "cancel"
      order_type: "purchase" | "sale"
      partner_company_role: "owner" | "admin" | "member" | "viewer" | "guest"
      partner_relationship_type: "team" | "partner"
      partner_title: "mr" | "mrs" | "ms" | "dr" | "prof" | "other"
      partner_type: "person" | "company"
      picking_status: "borrador" | "publicado" | "confirmado" | "cancelado"
      picking_type: "entrada" | "salida"
      pos_movement_type: "in" | "out"
      pos_session_status: "open" | "closed"
      product_status:
        | "active"
        | "inactive"
        | "discontinued"
        | "out_of_stock"
        | "coming_soon"
      product_tracking: "none" | "lot" | "serial"
      product_type: "product" | "service" | "others"
      project_priority: "low" | "medium" | "high" | "urgent"
      project_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "paused"
        | "cancelled"
      project_task_status: "pending" | "in_progress" | "completed" | "cancelled"
      stock_move_origin:
        | "initial"
        | "purchase"
        | "sale"
        | "pos"
        | "storefront"
        | "return_in"
        | "return_out"
        | "adjustment"
        | "manual"
        | "transfer"
      stock_move_type: "in" | "out"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_request_status: [
        "draft",
        "published",
        "approved",
        "rejected",
        "cancelled",
        "returned",
        "expired",
      ],
      company_size: ["micro", "small", "medium", "large", "enterprise"],
      company_status: [
        "active",
        "inactive",
        "suspended",
        "pending_verification",
      ],
      crm_activity_status: ["pending", "done", "overdue"],
      crm_activity_type: [
        "call",
        "meeting",
        "email",
        "demo",
        "followup",
        "task",
      ],
      crm_history_event: [
        "created",
        "stage_changed",
        "responsible_changed",
        "order_linked",
        "order_unlinked",
        "priority_changed",
        "closed_won",
        "closed_lost",
        "reopened",
      ],
      crm_lead_origin: [
        "web",
        "referral",
        "campaign",
        "call",
        "email",
        "event",
        "other",
      ],
      crm_lead_priority: ["low", "medium", "high"],
      invitation_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      order_state: ["draft", "posted", "cancel"],
      order_type: ["purchase", "sale"],
      partner_company_role: ["owner", "admin", "member", "viewer", "guest"],
      partner_relationship_type: ["team", "partner"],
      partner_title: ["mr", "mrs", "ms", "dr", "prof", "other"],
      partner_type: ["person", "company"],
      picking_status: ["borrador", "publicado", "confirmado", "cancelado"],
      picking_type: ["entrada", "salida"],
      pos_movement_type: ["in", "out"],
      pos_session_status: ["open", "closed"],
      product_status: [
        "active",
        "inactive",
        "discontinued",
        "out_of_stock",
        "coming_soon",
      ],
      product_tracking: ["none", "lot", "serial"],
      product_type: ["product", "service", "others"],
      project_priority: ["low", "medium", "high", "urgent"],
      project_status: [
        "pending",
        "in_progress",
        "completed",
        "paused",
        "cancelled",
      ],
      project_task_status: ["pending", "in_progress", "completed", "cancelled"],
      stock_move_origin: [
        "initial",
        "purchase",
        "sale",
        "pos",
        "storefront",
        "return_in",
        "return_out",
        "adjustment",
        "manual",
        "transfer",
      ],
      stock_move_type: ["in", "out"],
    },
  },
} as const
