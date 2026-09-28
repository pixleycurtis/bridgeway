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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      deal_documents: {
        Row: {
          deal_id: string
          id: string
          kind: string
          sections: Json
          title: string
          updated_at: string
        }
        Insert: {
          deal_id: string
          id?: string
          kind: string
          sections?: Json
          title: string
          updated_at?: string
        }
        Update: {
          deal_id?: string
          id?: string
          kind?: string
          sections?: Json
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
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          kind: string
          name: string
          path: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          kind?: string
          name?: string
          path?: string
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
      deals: {
        Row: {
          address: string
          adjustments: Json
          assumptions: Json
          created_at: string
          created_by: string | null
          firm_id: string
          id: string
          lines: Json
          market: string
          name: string
          stage: string
          target_irr: number
          updated_at: string
        }
        Insert: {
          address?: string
          adjustments?: Json
          assumptions: Json
          created_at?: string
          created_by?: string | null
          firm_id: string
          id?: string
          lines: Json
          market?: string
          name: string
          stage?: string
          target_irr?: number
          updated_at?: string
        }
        Update: {
          address?: string
          adjustments?: Json
          assumptions?: Json
          created_at?: string
          created_by?: string | null
          firm_id?: string
          id?: string
          lines?: Json
          market?: string
          name?: string
          stage?: string
          target_irr?: number
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
          style_profile?: string | null
        }
        Relationships: []
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
