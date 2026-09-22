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
      configuracoes: {
        Row: {
          chave: string
          descricao: string | null
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          descricao?: string | null
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          descricao?: string | null
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      lojas: {
        Row: {
          ativa: boolean
          cnpj: string | null
          codigo: string
          codigo_sankhya: string | null
          created_at: string
          email_contato: string | null
          id: string
          nome: string
          rede: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          cnpj?: string | null
          codigo: string
          codigo_sankhya?: string | null
          created_at?: string
          email_contato?: string | null
          id?: string
          nome: string
          rede?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          cnpj?: string | null
          codigo?: string
          codigo_sankhya?: string | null
          created_at?: string
          email_contato?: string | null
          id?: string
          nome?: string
          rede?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          assunto: string
          canal: string
          corpo: string
          created_at: string
          destinatario: string
          enviado_em: string | null
          erro: string | null
          id: string
          protocolo_id: string | null
          status: string
        }
        Insert: {
          assunto: string
          canal?: string
          corpo: string
          created_at?: string
          destinatario: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          protocolo_id?: string | null
          status?: string
        }
        Update: {
          assunto?: string
          canal?: string
          corpo?: string
          created_at?: string
          destinatario?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          protocolo_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      protocolo_eventos: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          created_at: string
          descricao: string
          id: string
          protocolo_id: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          descricao: string
          id?: string
          protocolo_id: string
          tipo: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          descricao?: string
          id?: string
          protocolo_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_eventos_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolo_fotos: {
        Row: {
          created_at: string
          expurgada: boolean
          expurgada_em: string | null
          id: string
          item_id: string | null
          protocolo_id: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          created_at?: string
          expurgada?: boolean
          expurgada_em?: string | null
          id?: string
          item_id?: string | null
          protocolo_id: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo?: string
        }
        Update: {
          created_at?: string
          expurgada?: boolean
          expurgada_em?: string | null
          id?: string
          item_id?: string | null
          protocolo_id?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_fotos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "protocolo_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolo_fotos_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolo_itens: {
        Row: {
          codigo_produto: string | null
          created_at: string
          descricao: string
          id: string
          lote: string | null
          motivo: string | null
          protocolo_id: string
          quantidade: number
          quantidade_aceita: number | null
          unidade: string | null
          validade: string | null
          valor_unitario: number
        }
        Insert: {
          codigo_produto?: string | null
          created_at?: string
          descricao: string
          id?: string
          lote?: string | null
          motivo?: string | null
          protocolo_id: string
          quantidade?: number
          quantidade_aceita?: number | null
          unidade?: string | null
          validade?: string | null
          valor_unitario?: number
        }
        Update: {
          codigo_produto?: string | null
          created_at?: string
          descricao?: string
          id?: string
          lote?: string | null
          motivo?: string | null
          protocolo_id?: string
          quantidade?: number
          quantidade_aceita?: number | null
          unidade?: string | null
          validade?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_itens_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolos: {
        Row: {
          canhoto_confirmado_em: string | null
          canhoto_confirmado_por: string | null
          canhoto_path: string | null
          cliente_email: string
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          data_compra: string | null
          decidido_em: string | null
          decidido_por: string | null
          descricao: string | null
          encerrado_em: string | null
          id: string
          loja_codigo: string | null
          loja_id: string | null
          loja_nome: string
          motivo: string
          nf_devolucao: string | null
          nota_fiscal: string | null
          numero: string
          parecer: string | null
          pedido: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["protocolo_status"]
          updated_at: string
          valor_total: number
        }
        Insert: {
          canhoto_confirmado_em?: string | null
          canhoto_confirmado_por?: string | null
          canhoto_path?: string | null
          cliente_email: string
          cliente_nome: string
          cliente_telefone?: string | null
          created_at?: string
          data_compra?: string | null
          decidido_em?: string | null
          decidido_por?: string | null
          descricao?: string | null
          encerrado_em?: string | null
          id?: string
          loja_codigo?: string | null
          loja_id?: string | null
          loja_nome: string
          motivo: string
          nf_devolucao?: string | null
          nota_fiscal?: string | null
          numero: string
          parecer?: string | null
          pedido?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["protocolo_status"]
          updated_at?: string
          valor_total?: number
        }
        Update: {
          canhoto_confirmado_em?: string | null
          canhoto_confirmado_por?: string | null
          canhoto_path?: string | null
          cliente_email?: string
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          data_compra?: string | null
          decidido_em?: string | null
          decidido_por?: string | null
          descricao?: string | null
          encerrado_em?: string | null
          id?: string
          loja_codigo?: string | null
          loja_id?: string | null
          loja_nome?: string
          motivo?: string
          nf_devolucao?: string | null
          nota_fiscal?: string | null
          numero?: string
          parecer?: string | null
          pedido?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["protocolo_status"]
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "protocolos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      sankhya_cache: {
        Row: {
          chave: string
          created_at: string
          expira_em: string
          payload: Json
        }
        Insert: {
          chave: string
          created_at?: string
          expira_em: string
          payload: Json
        }
        Update: {
          chave?: string
          created_at?: string
          expira_em?: string
          payload?: Json
        }
        Relationships: []
      }
      user_lojas: {
        Row: {
          created_at: string
          id: string
          loja_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lojas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      is_equipe: { Args: { _user_id: string }; Returns: boolean }
      usuario_tem_acesso_loja: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "analista" | "loja"
      protocolo_status:
        | "aberto"
        | "em_analise"
        | "aguardando_cliente"
        | "aceito_total"
        | "aceito_parcial"
        | "recusado"
        | "aguardando_nf"
        | "coletado"
        | "encerrado"
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
      app_role: ["admin", "analista", "loja"],
      protocolo_status: [
        "aberto",
        "em_analise",
        "aguardando_cliente",
        "aceito_total",
        "aceito_parcial",
        "recusado",
        "aguardando_nf",
        "coletado",
        "encerrado",
      ],
    },
  },
} as const
