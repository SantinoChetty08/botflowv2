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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      channels: {
        Row: {
          access_token: string | null
          config: Json | null
          created_at: string
          id: string
          meta_app_id: string | null
          name: string
          phone_number: string
          phone_number_id: string | null
          provider: string | null
          status: string | null
          tenant_id: string
          updated_at: string
          verify_token: string | null
          waba_id: string | null
          webhook_url: string | null
        }
        Insert: {
          access_token?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          meta_app_id?: string | null
          name: string
          phone_number: string
          phone_number_id?: string | null
          provider?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string
          verify_token?: string | null
          waba_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          access_token?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          meta_app_id?: string | null
          name?: string
          phone_number?: string
          phone_number_id?: string | null
          provider?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
          verify_token?: string | null
          waba_id?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sessions: {
        Row: {
          channel_id: string
          created_at: string
          current_node_id: string | null
          flow_id: string | null
          id: string
          last_activity_at: string
          sender_phone: string
          session_data: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          current_node_id?: string | null
          flow_id?: string | null
          id?: string
          last_activity_at?: string
          sender_phone: string
          session_data?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          current_node_id?: string | null
          flow_id?: string | null
          id?: string
          last_activity_at?: string
          sender_phone?: string
          session_data?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          flow_data: Json
          flow_id: string
          id: string
          published_by: string | null
          version: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          flow_data?: Json
          flow_id: string
          id?: string
          published_by?: string | null
          version: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          flow_data?: Json
          flow_id?: string
          id?: string
          published_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "flow_versions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          channel_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          flow_data: Json | null
          id: string
          name: string
          status: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version: number | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          flow_data?: Json | null
          id?: string
          name: string
          status?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          flow_data?: Json | null
          id?: string
          name?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flows_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_messages: {
        Row: {
          channel_id: string
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          message_type: string
          payload: Json
          processed_at: string | null
          sender_phone: string
          status: string
          tenant_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          message_type?: string
          payload?: Json
          processed_at?: string | null
          sender_phone: string
          status?: string
          tenant_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          message_type?: string
          payload?: Json
          processed_at?: string | null
          sender_phone?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          api_key: string | null
          api_secret: string | null
          created_at: string
          created_by: string | null
          hoducc_endpoint: string | null
          id: string
          is_active: boolean | null
          max_channels: number | null
          max_flows: number | null
          name: string
          slug: string
          updated_at: string
          whatsapp_numbers: string[] | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          created_by?: string | null
          hoducc_endpoint?: string | null
          id?: string
          is_active?: boolean | null
          max_channels?: number | null
          max_flows?: number | null
          name: string
          slug: string
          updated_at?: string
          whatsapp_numbers?: string[] | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          created_by?: string | null
          hoducc_endpoint?: string | null
          id?: string
          is_active?: boolean | null
          max_channels?: number | null
          max_flows?: number | null
          name?: string
          slug?: string
          updated_at?: string
          whatsapp_numbers?: string[] | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "viewer"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "manager", "viewer"],
    },
  },
} as const
