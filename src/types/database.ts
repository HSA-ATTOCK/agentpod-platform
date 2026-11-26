// Generated from the Supabase database (Supabase MCP `generate_typescript_types`).
// Regenerate after every migration instead of editing by hand.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      conversation_items: {
        Row: {
          client_id: string
          conversation_id: string
          created_at: string
          data: Json
          id: string
          position: number
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          conversation_id: string
          created_at?: string
          data: Json
          id?: string
          position?: never
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          conversation_id?: string
          created_at?: string
          data?: Json
          id?: string
          position?: never
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_items_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          cap_cents: number | null
          claude_session_id: string | null
          cost_cents: number
          created_at: string
          created_by: string | null
          id: string
          paused: boolean
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cap_cents?: number | null
          claude_session_id?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          paused?: boolean
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cap_cents?: number | null
          claude_session_id?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          paused?: boolean
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          claude_file_id: string
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          name: string
          size_bytes: number
          task_id: string | null
          workspace_id: string
        }
        Insert: {
          claude_file_id: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name: string
          size_bytes?: number
          task_id?: string | null
          workspace_id: string
        }
        Update: {
          claude_file_id?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          size_bytes?: number
          task_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          access_token_enc: string | null
          access_token_expires_at: string | null
          integration_id: string
          secret_enc: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token_enc?: string | null
          access_token_expires_at?: string | null
          integration_id: string
          secret_enc: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token_enc?: string | null
          access_token_expires_at?: string | null
          integration_id?: string
          secret_enc?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          account_email: string | null
          config: Json
          connected_by: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          provider: string
          scopes: string[]
          status: string
          workspace_id: string
        }
        Insert: {
          account_email?: string | null
          config?: Json
          connected_by?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          provider: string
          scopes?: string[]
          status?: string
          workspace_id: string
        }
        Update: {
          account_email?: string | null
          config?: Json
          connected_by?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          provider?: string
          scopes?: string[]
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string | null
          language: string
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          job_title?: string | null
          language?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          language?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          agents: string[]
          cap_cents: number | null
          conversation_id: string | null
          cost_cents: number
          created_by: string | null
          error: string | null
          finished_at: string | null
          id: string
          request: string
          started_at: string
          status: Database["public"]["Enums"]["task_status"]
          steps: Json
          workflow_id: string | null
          workspace_id: string
        }
        Insert: {
          agents?: string[]
          cap_cents?: number | null
          conversation_id?: string | null
          cost_cents?: number
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          request: string
          started_at?: string
          status?: Database["public"]["Enums"]["task_status"]
          steps?: Json
          workflow_id?: string | null
          workspace_id: string
        }
        Update: {
          agents?: string[]
          cap_cents?: number | null
          conversation_id?: string | null
          cost_cents?: number
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          request?: string
          started_at?: string
          status?: Database["public"]["Enums"]["task_status"]
          steps?: Json
          workflow_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workflow_fk"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_approvals: {
        Row: {
          conversation_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          input: Json
          status: string
          tool_name: string
          tool_use_id: string
          workspace_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          input: Json
          status?: string
          tool_name: string
          tool_use_id: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          input?: Json
          status?: string
          tool_name?: string
          tool_use_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workflows: {
        Row: {
          cap_usd: number
          created_at: string
          created_by: string | null
          day_of_week: number | null
          enabled: boolean
          frequency: string
          id: string
          instruction: string
          last_run_slot: string | null
          name: string
          time_of_day: string | null
          updated_at: string
          webhook_token_hash: string | null
          workspace_id: string
        }
        Insert: {
          cap_usd?: number
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          enabled?: boolean
          frequency?: string
          id?: string
          instruction: string
          last_run_slot?: string | null
          name: string
          time_of_day?: string | null
          updated_at?: string
          webhook_token_hash?: string | null
          workspace_id: string
        }
        Update: {
          cap_usd?: number
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          enabled?: boolean
          frequency?: string
          id?: string
          instruction?: string
          last_run_slot?: string | null
          name?: string
          time_of_day?: string | null
          updated_at?: string
          webhook_token_hash?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          business_context: string
          company_size: string | null
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          logo_url: string | null
          monthly_limit_usd: number
          name: string
          quality: string
          slug: string
          task_cap_usd: number
          timezone: string
          updated_at: string
          spend_alert_level: number
          spend_alert_month: string | null
        }
        Insert: {
          business_context?: string
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          monthly_limit_usd?: number
          name: string
          quality?: string
          slug: string
          task_cap_usd?: number
          timezone?: string
          updated_at?: string
          spend_alert_level?: number
          spend_alert_month?: string | null
        }
        Update: {
          business_context?: string
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          monthly_limit_usd?: number
          name?: string
          quality?: string
          slug?: string
          task_cap_usd?: number
          timezone?: string
          updated_at?: string
          spend_alert_level?: number
          spend_alert_month?: string | null
        }
        Relationships: []
      }
      agent_registry: {
        Row: {
          category: string
          claude_agent_id: string | null
          claude_agent_version: number | null
          description: string
          enabled: boolean
          key: string
          name: string
          sort: number
          updated_at: string
          updated_by: string | null
          effort: string | null
          model: string | null
        }
        Insert: {
          category?: string
          claude_agent_id?: string | null
          claude_agent_version?: number | null
          description?: string
          enabled?: boolean
          key: string
          name: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
          effort?: string | null
          model?: string | null
        }
        Update: {
          category?: string
          claude_agent_id?: string | null
          claude_agent_version?: number | null
          description?: string
          enabled?: boolean
          key?: string
          name?: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
          effort?: string | null
          model?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          target_id: string | null
          target_type: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          content: string
          document_id: string
          id: number
          position: number
          search: unknown
          workspace_id: string
        }
        Insert: {
          content: string
          document_id: string
          id?: never
          position: number
          search?: unknown
          workspace_id: string
        }
        Update: {
          content?: string
          document_id?: string
          id?: never
          position?: number
          search?: unknown
          workspace_id?: string
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          char_count: number
          chunk_count: number
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          char_count?: number
          chunk_count?: number
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          char_count?: number
          chunk_count?: number
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: []
      }
      memory_entries: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          source: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          source?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          source?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      platform_accounts: {
        Row: {
          admins_notified_at: string | null
          created_at: string
          is_admin: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["account_status"]
          status_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admins_notified_at?: string | null
          created_at?: string
          is_admin?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          status_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admins_notified_at?: string | null
          created_at?: string
          is_admin?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          status_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          announcement: string | null
          default_monthly_limit_usd: number
          default_task_cap_usd: number
          id: number
          maintenance_message: string
          maintenance_mode: boolean
          require_approval: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          announcement?: string | null
          default_monthly_limit_usd?: number
          default_task_cap_usd?: number
          id?: number
          maintenance_message?: string
          maintenance_mode?: boolean
          require_approval?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          announcement?: string | null
          default_monthly_limit_usd?: number
          default_task_cap_usd?: number
          id?: number
          maintenance_message?: string
          maintenance_mode?: boolean
          require_approval?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_versions: {
        Row: {
          created_at: string
          created_by: string | null
          file_count: number
          files: Json
          id: string
          note: string | null
          site_id: string
          total_bytes: number
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_count?: number
          files?: Json
          id?: string
          note?: string | null
          site_id: string
          total_bytes?: number
          version: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_count?: number
          files?: Json
          id?: string
          note?: string | null
          site_id?: string
          total_bytes?: number
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_versions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          conversation_id: string | null
          created_at: string
          created_by: string | null
          current_version: number | null
          expires_at: string
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number | null
          expires_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number | null
          expires_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          allowed_agents: string[] | null
          created_at: string
          daily_limit_usd: number | null
          description: string
          features: string[]
          id: string
          is_public: boolean
          key: string
          max_integrations: number | null
          max_previews: number | null
          max_workflows: number | null
          monthly_limit_usd: number
          name: string
          price_label: string
          sort: number
          task_cap_usd: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_agents?: string[] | null
          created_at?: string
          daily_limit_usd?: number | null
          description?: string
          features?: string[]
          id?: string
          is_public?: boolean
          key: string
          max_integrations?: number | null
          max_previews?: number | null
          max_workflows?: number | null
          monthly_limit_usd?: number
          name: string
          price_label?: string
          sort?: number
          task_cap_usd?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_agents?: string[] | null
          created_at?: string
          daily_limit_usd?: number | null
          description?: string
          features?: string[]
          id?: string
          is_public?: boolean
          key?: string
          max_integrations?: number | null
          max_previews?: number | null
          max_workflows?: number | null
          monthly_limit_usd?: number
          name?: string
          price_label?: string
          sort?: number
          task_cap_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      workspace_limits: {
        Row: {
          allowed_agents: string[] | null
          daily_limit_usd: number | null
          monthly_limit_usd: number | null
          note: string | null
          plan_id: string | null
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          allowed_agents?: string[] | null
          daily_limit_usd?: number | null
          monthly_limit_usd?: number | null
          note?: string | null
          plan_id?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          allowed_agents?: string[] | null
          daily_limit_usd?: number | null
          monthly_limit_usd?: number | null
          note?: string | null
          plan_id?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      custom_agents: {
        Row: {
          claude_agent_id: string | null
          claude_agent_version: number | null
          created_at: string
          created_by: string | null
          description: string
          enabled: boolean
          id: string
          instructions: string
          last_run_at: string | null
          max_cost_usd: number
          model: string
          name: string
          runs: number
          updated_at: string
          web_access: boolean
          workspace_id: string
          tools: string[]
        }
        Insert: {
          claude_agent_id?: string | null
          claude_agent_version?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          enabled?: boolean
          id?: string
          instructions: string
          last_run_at?: string | null
          max_cost_usd?: number
          model?: string
          name: string
          runs?: number
          updated_at?: string
          web_access?: boolean
          workspace_id: string
          tools?: string[]
        }
        Update: {
          claude_agent_id?: string | null
          claude_agent_version?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          enabled?: boolean
          id?: string
          instructions?: string
          last_run_at?: string | null
          max_cost_usd?: number
          model?: string
          name?: string
          runs?: number
          updated_at?: string
          web_access?: boolean
          workspace_id?: string
          tools?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { invite_id: string }; Returns: string }
      ensure_workspace: { Args: Record<PropertyKey, never>; Returns: string }
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined }
      transfer_ownership: { Args: { ws: string; new_owner: string }; Returns: undefined }
      my_invites: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          workspace_name: string
          role: Database["public"]["Enums"]["workspace_role"]
          invited_at: string
        }[]
      }
    }
    Enums: {
      account_status: "pending_approval" | "approved" | "rejected" | "suspended" | "deactivated"
      task_status: "running" | "succeeded" | "failed" | "paused" | "needs_approval"
      workspace_role: "owner" | "admin" | "member" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
