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
      chat_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: Json
          role: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_splits: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          is_self: boolean
          liquidado: boolean
          membro: string
          percentual: number
          transaction_id: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_self?: boolean
          liquidado?: boolean
          membro: string
          percentual: number
          transaction_id: string
          user_id?: string
          valor: number
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_self?: boolean
          liquidado?: boolean
          membro?: string
          percentual?: number
          transaction_id?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "split_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          id: string
          nome: string
          prazo: string
          user_id: string
          valor_atual: number
          valor_objetivo: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          prazo: string
          user_id?: string
          valor_atual?: number
          valor_objetivo: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          prazo?: string
          user_id?: string
          valor_atual?: number
          valor_objetivo?: number
        }
        Relationships: []
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_self: boolean
          nome: string
          percentual_padrao: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_self?: boolean
          nome: string
          percentual_padrao?: number | null
          user_id?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_self?: boolean
          nome?: string
          percentual_padrao?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "split_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          moeda: string
          nome: string | null
          notificacoes: boolean
          objetivos: string | null
          onboarded: boolean
          partilha: string | null
          receita_mensal: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          moeda?: string
          nome?: string | null
          notificacoes?: boolean
          objetivos?: string | null
          onboarded?: boolean
          partilha?: string | null
          receita_mensal?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          moeda?: string
          nome?: string | null
          notificacoes?: boolean
          objetivos?: string | null
          onboarded?: boolean
          partilha?: string | null
          receita_mensal?: number | null
        }
        Relationships: []
      }
      split_groups: {
        Row: {
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          origem: string
          pago_por: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string
          pago_por?: string | null
          tipo: string
          user_id?: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string
          pago_por?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      uploaded_documents: {
        Row: {
          categoria_sugerida: string | null
          created_at: string
          data_extraida: string | null
          empresa: string | null
          estado: string
          id: string
          nome_arquivo: string
          tipo_despesa: string | null
          transaction_id: string | null
          user_id: string
          valor_extraido: number | null
        }
        Insert: {
          categoria_sugerida?: string | null
          created_at?: string
          data_extraida?: string | null
          empresa?: string | null
          estado?: string
          id?: string
          nome_arquivo: string
          tipo_despesa?: string | null
          transaction_id?: string | null
          user_id?: string
          valor_extraido?: number | null
        }
        Update: {
          categoria_sugerida?: string | null
          created_at?: string
          data_extraida?: string | null
          empresa?: string | null
          estado?: string
          id?: string
          nome_arquivo?: string
          tipo_despesa?: string | null
          transaction_id?: string | null
          user_id?: string
          valor_extraido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
