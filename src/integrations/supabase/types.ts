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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      deal_actuals: {
        Row: {
          created_at: string
          deal_id: string
          expenses: number
          firm_id: string
          id: string
          notes: string | null
          other_income: number
          period: string
          revenue: number
        }
        Insert: {
          created_at?: string
          deal_id: string
          expenses?: number
          firm_id: string
          id?: string
          notes?: string | null
          other_income?: number
          period: string
          revenue?: number
        }
        Update: {
          created_at?: string
          deal_id?: string
          expenses?: number
          firm_id?: string
          id?: string
          notes?: string | null
          other_income?: number
          period?: string
          revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_actuals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_actuals_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_dd_items: {
        Row: {
          assigned_role: string | null
          category: string
          created_at: string
          created_by: string | null
          deal_id: string
          file_path: string | null
          firm_id: string
          id: string
          impact: Json | null
          label: string
          received: boolean
          shared_with: string[]
        }
        Insert: {
          assigned_role?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          file_path?: string | null
          firm_id: string
          id?: string
          impact?: Json | null
          label: string
          received?: boolean
          shared_with?: string[]
        }
        Update: {
          assigned_role?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          file_path?: string | null
          firm_id?: string
          id?: string
          impact?: Json | null
          label?: string
          received?: boolean
          shared_with?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "deal_dd_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_dd_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_documents: {
        Row: {
          deal_id: string
          id: string
          kind: string
          sections: Json
          shared_with: string[]
          title: string
          updated_at: string
        }
        Insert: {
          deal_id: string
          id?: string
          kind: string
          sections?: Json
          shared_with?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          deal_id?: string
          id?: string
          kind?: string
          sections?: Json
          shared_with?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_files: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          kind: string
          name: string
          path: string
          shared_with: string[]
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          kind: string
          name: string
          path: string
          shared_with?: string[]
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          kind?: string
          name?: string
          path?: string
          shared_with?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_lender_quotes: {
        Row: {
          amort_years: number | null
          created_at: string
          deal_id: string
          dscr_test: number | null
          fee_bps: number | null
          firm_id: string
          id: string
          io_years: number | null
          lender: string
          loan_amount: number | null
          notes: string | null
          program: string | null
          rate: number | null
          recourse: string | null
          status: string
        }
        Insert: {
          amort_years?: number | null
          created_at?: string
          deal_id: string
          dscr_test?: number | null
          fee_bps?: number | null
          firm_id: string
          id?: string
          io_years?: number | null
          lender: string
          loan_amount?: number | null
          notes?: string | null
          program?: string | null
          rate?: number | null
          recourse?: string | null
          status?: string
        }
        Update: {
          amort_years?: number | null
          created_at?: string
          deal_id?: string
          dscr_test?: number | null
          fee_bps?: number | null
          firm_id?: string
          id?: string
          io_years?: number | null
          lender?: string
          loan_amount?: number | null
          notes?: string | null
          program?: string | null
          rate?: number | null
          recourse?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_lender_quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_lender_quotes_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_parties: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          email: string
          expires_at: string
          id: string
          last_seen_at: string | null
          revoked_at: string | null
          role: string
          token_hash: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          email: string
          expires_at?: string
          id?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          role?: string
          token_hash?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          email?: string
          expires_at?: string
          id?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          role?: string
          token_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_parties_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_party_events: {
        Row: {
          created_at: string
          deal_id: string
          detail: string | null
          id: string
          kind: string
          party_id: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          detail?: string | null
          id?: string
          kind: string
          party_id?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          detail?: string | null
          id?: string
          kind?: string
          party_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_party_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_party_events_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "deal_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_shares: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          email: string
          id: string
          party: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          email: string
          id?: string
          party?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          email?: string
          id?: string
          party?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_shares_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_tasks: {
        Row: {
          assigned_role: string | null
          assignee: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          done: boolean
          due_date: string | null
          firm_id: string
          id: string
          kind: string
          shared_with: string[]
          title: string
        }
        Insert: {
          assigned_role?: string | null
          assignee?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          done?: boolean
          due_date?: string | null
          firm_id: string
          id?: string
          kind?: string
          shared_with?: string[]
          title: string
        }
        Update: {
          assigned_role?: string | null
          assignee?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          done?: boolean
          due_date?: string | null
          firm_id?: string
          id?: string
          kind?: string
          shared_with?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_assignee_fkey"
            columns: ["assignee"]
            isOneToOne: false
            referencedRelation: "firm_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_title_items: {
        Row: {
          assigned_role: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          detail: string | null
          due_date: string | null
          file_path: string | null
          firm_id: string
          id: string
          impact: Json | null
          item: string
          section: string
          shared_with: string[]
          status: string
        }
        Insert: {
          assigned_role?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          detail?: string | null
          due_date?: string | null
          file_path?: string | null
          firm_id: string
          id?: string
          impact?: Json | null
          item: string
          section?: string
          shared_with?: string[]
          status?: string
        }
        Update: {
          assigned_role?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          detail?: string | null
          due_date?: string | null
          file_path?: string | null
          firm_id?: string
          id?: string
          impact?: Json | null
          item?: string
          section?: string
          shared_with?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_title_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_title_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          address: string
          adjustments: Json
          asking_price: number | null
          assumptions: Json
          created_at: string
          created_by: string | null
          final_price: number | null
          firm_id: string
          id: string
          lines: Json
          market: string
          model: Json
          name: string
          pass_reason: string | null
          property_type: string
          stage: string
          stage_history: Json
          target_irr: number
          team: string[]
          updated_at: string
        }
        Insert: {
          address?: string
          adjustments?: Json
          asking_price?: number | null
          assumptions: Json
          created_at?: string
          created_by?: string | null
          final_price?: number | null
          firm_id: string
          id?: string
          lines: Json
          market?: string
          model?: Json
          name: string
          pass_reason?: string | null
          property_type?: string
          stage?: string
          stage_history?: Json
          target_irr?: number
          team?: string[]
          updated_at?: string
        }
        Update: {
          address?: string
          adjustments?: Json
          asking_price?: number | null
          assumptions?: Json
          created_at?: string
          created_by?: string | null
          final_price?: number | null
          firm_id?: string
          id?: string
          lines?: Json
          market?: string
          model?: Json
          name?: string
          pass_reason?: string | null
          property_type?: string
          stage?: string
          stage_history?: Json
          target_irr?: number
          team?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_defaults: {
        Row: {
          created_at: string
          defaults: Json
          firm_id: string
          id: string
          market: string
          property_type: string
        }
        Insert: {
          created_at?: string
          defaults?: Json
          firm_id: string
          id?: string
          market?: string
          property_type?: string
        }
        Update: {
          created_at?: string
          defaults?: Json
          firm_id?: string
          id?: string
          market?: string
          property_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_defaults_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_invites: {
        Row: {
          created_at: string
          email: string
          firm_id: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["firm_role"]
        }
        Insert: {
          created_at?: string
          email: string
          firm_id: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["firm_role"]
        }
        Update: {
          created_at?: string
          email?: string
          firm_id?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["firm_role"]
        }
        Relationships: [
          {
            foreignKeyName: "firm_invites_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_members: {
        Row: {
          created_at: string
          email: string
          firm_id: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["firm_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          firm_id: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["firm_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          firm_id?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["firm_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_members_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          address: string | null
          brand_color: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          doc_font: string
          domain: string | null
          id: string
          logo_path: string | null
          name: string
          settings: Json
          style_profile: string | null
        }
        Insert: {
          address?: string | null
          brand_color?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          doc_font?: string
          domain?: string | null
          id?: string
          logo_path?: string | null
          name: string
          settings?: Json
          style_profile?: string | null
        }
        Update: {
          address?: string | null
          brand_color?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          doc_font?: string
          domain?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          settings?: Json
          style_profile?: string | null
        }
        Relationships: []
      }
      item_comments: {
        Row: {
          audience: string
          author_name: string
          author_party: string | null
          author_user: string | null
          body: string
          created_at: string
          deal_id: string
          id: string
          item_id: string
          item_type: string
        }
        Insert: {
          audience: string
          author_name?: string
          author_party?: string | null
          author_user?: string | null
          body: string
          created_at?: string
          deal_id: string
          id?: string
          item_id: string
          item_type: string
        }
        Update: {
          audience?: string
          author_name?: string
          author_party?: string | null
          author_user?: string | null
          body?: string
          created_at?: string
          deal_id?: string
          id?: string
          item_id?: string
          item_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_comments_author_party_fkey"
            columns: ["author_party"]
            isOneToOne: false
            referencedRelation: "deal_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      style_samples: {
        Row: {
          created_at: string
          excerpt: string
          firm_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          excerpt?: string
          firm_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          excerpt?: string
          firm_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "style_samples_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      underwrite_templates: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          firm_id: string
          id: string
          model_type: string
          name: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          firm_id: string
          id?: string
          model_type: string
          name: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          firm_id?: string
          id?: string
          model_type?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "underwrite_templates_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_deal: { Args: { _deal: string }; Returns: boolean }
      can_view_deal: { Args: { _deal: string }; Returns: boolean }
      can_view_firm: { Args: { _firm: string }; Returns: boolean }
      ensure_membership: { Args: never; Returns: Json }
      is_firm_admin: { Args: { _firm: string }; Returns: boolean }
      is_firm_member: { Args: { _firm: string }; Returns: boolean }
      my_firm_id: { Args: never; Returns: string }
      set_style_profile: { Args: { _profile: string }; Returns: undefined }
    }
    Enums: {
      firm_role: "admin" | "analyst" | "broker" | "property_manager" | "legal"
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
      firm_role: ["admin", "analyst", "broker", "property_manager", "legal"],
    },
  },
} as const
