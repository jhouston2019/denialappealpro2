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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_decisions: {
        Row: {
          ai_response: Json | null
          confidence: number | null
          cost_usd: number | null
          decision_type: string
          fallback_used: boolean | null
          id: string
          input_prompt: string | null
          model: string | null
          report_id: string | null
          temperature: number | null
          timestamp: string | null
          tokens_used: number | null
        }
        Insert: {
          ai_response?: Json | null
          confidence?: number | null
          cost_usd?: number | null
          decision_type: string
          fallback_used?: boolean | null
          id?: string
          input_prompt?: string | null
          model?: string | null
          report_id?: string | null
          temperature?: number | null
          timestamp?: string | null
          tokens_used?: number | null
        }
        Update: {
          ai_response?: Json | null
          confidence?: number | null
          cost_usd?: number | null
          decision_type?: string
          fallback_used?: boolean | null
          id?: string
          input_prompt?: string | null
          model?: string | null
          report_id?: string | null
          temperature?: number | null
          timestamp?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_decisions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          confidence_score: number | null
          engine_name: string
          event_type: string
          id: string
          input_data: Json | null
          metadata: Json | null
          output_data: Json | null
          processing_time_ms: number | null
          report_id: string | null
          timestamp: string | null
        }
        Insert: {
          confidence_score?: number | null
          engine_name: string
          event_type: string
          id?: string
          input_data?: Json | null
          metadata?: Json | null
          output_data?: Json | null
          processing_time_ms?: number | null
          report_id?: string | null
          timestamp?: string | null
        }
        Update: {
          confidence_score?: number | null
          engine_name?: string
          event_type?: string
          id?: string
          input_data?: Json | null
          metadata?: Json | null
          output_data?: Json | null
          processing_time_ms?: number | null
          report_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      code_requirements: {
        Row: {
          code_reference: string
          created_at: string | null
          estimated_cost: number | null
          estimated_quantity: number | null
          id: string
          jurisdiction: string
          required_item: string
          requirement: string
          severity: string | null
          trigger_trade: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          code_reference: string
          created_at?: string | null
          estimated_cost?: number | null
          estimated_quantity?: number | null
          id?: string
          jurisdiction: string
          required_item: string
          requirement: string
          severity?: string | null
          trigger_trade: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          code_reference?: string
          created_at?: string | null
          estimated_cost?: number | null
          estimated_quantity?: number | null
          id?: string
          jurisdiction?: string
          required_item?: string
          requirement?: string
          severity?: string | null
          trigger_trade?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      labor_rates: {
        Row: {
          avg_rate: number
          created_at: string | null
          effective_date: string
          id: string
          last_updated: string | null
          max_rate: number
          metadata: Json | null
          min_rate: number
          region: string
          source: string | null
          trade: string
          unit: string | null
        }
        Insert: {
          avg_rate: number
          created_at?: string | null
          effective_date: string
          id?: string
          last_updated?: string | null
          max_rate: number
          metadata?: Json | null
          min_rate: number
          region: string
          source?: string | null
          trade: string
          unit?: string | null
        }
        Update: {
          avg_rate?: number
          created_at?: string | null
          effective_date?: string
          id?: string
          last_updated?: string | null
          max_rate?: number
          metadata?: Json | null
          min_rate?: number
          region?: string
          source?: string | null
          trade?: string
          unit?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          metadata: Json | null
          payment_type: string
          plan_id: string | null
          refunded_amount: number | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          payment_type: string
          plan_id?: string | null
          refunded_amount?: number | null
          status: string
          stripe_customer_id?: string | null
          stripe_payment_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          payment_type?: string
          plan_id?: string | null
          refunded_amount?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plan_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pricing_database: {
        Row: {
          base_price: number
          created_at: string | null
          description: string
          effective_date: string
          id: string
          item_code: string | null
          last_updated: string | null
          metadata: Json | null
          price_source: string
          region: string
          trade_code: string
          unit: string
        }
        Insert: {
          base_price: number
          created_at?: string | null
          description: string
          effective_date: string
          id?: string
          item_code?: string | null
          last_updated?: string | null
          metadata?: Json | null
          price_source: string
          region: string
          trade_code: string
          unit: string
        }
        Update: {
          base_price?: number
          created_at?: string | null
          description?: string
          effective_date?: string
          id?: string
          item_code?: string | null
          last_updated?: string | null
          metadata?: Json | null
          price_source?: string
          region?: string
          trade_code?: string
          unit?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          role: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          tier: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          role?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tier?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          role?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_plan_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      recovery_metrics: {
        Row: {
          carrier: string | null
          claim_type: string | null
          created_at: string | null
          estimate_id: string | null
          guarantee_triggered: boolean | null
          id: string
          original_estimate_value: number | null
          reconstructed_value: number | null
          recovery_value: number
          refund_amount: number | null
          refund_issued: boolean | null
          report_id: string | null
          state: string | null
          stripe_refund_id: string | null
          user_id: string
        }
        Insert: {
          carrier?: string | null
          claim_type?: string | null
          created_at?: string | null
          estimate_id?: string | null
          guarantee_triggered?: boolean | null
          id?: string
          original_estimate_value?: number | null
          reconstructed_value?: number | null
          recovery_value: number
          refund_amount?: number | null
          refund_issued?: boolean | null
          report_id?: string | null
          state?: string | null
          stripe_refund_id?: string | null
          user_id: string
        }
        Update: {
          carrier?: string | null
          claim_type?: string | null
          created_at?: string | null
          estimate_id?: string | null
          guarantee_triggered?: boolean | null
          id?: string
          original_estimate_value?: number | null
          reconstructed_value?: number | null
          recovery_value?: number
          refund_amount?: number | null
          refund_issued?: boolean | null
          report_id?: string | null
          state?: string | null
          stripe_refund_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_metrics_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plan_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      regional_multipliers: {
        Row: {
          city: string | null
          created_at: string | null
          effective_date: string
          id: string
          last_updated: string | null
          multiplier: number
          region: string
          state: string
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          effective_date: string
          id?: string
          last_updated?: string | null
          multiplier: number
          region: string
          state: string
        }
        Update: {
          city?: string | null
          created_at?: string | null
          effective_date?: string
          id?: string
          last_updated?: string | null
          multiplier?: number
          region?: string
          state?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          carrier_tactics_count: number | null
          created_at: string | null
          damage_type: string | null
          depreciation_score: number | null
          estimate_name: string
          estimate_type: string | null
          expires_at: string | null
          format_detected: string | null
          id: string
          labor_score: number | null
          overall_score: number | null
          paid_single_use: boolean | null
          pricing_variance: number | null
          processing_time_ms: number | null
          region: string | null
          result_json: Json
          team_id: string | null
          user_id: string
        }
        Insert: {
          carrier_tactics_count?: number | null
          created_at?: string | null
          damage_type?: string | null
          depreciation_score?: number | null
          estimate_name: string
          estimate_type?: string | null
          expires_at?: string | null
          format_detected?: string | null
          id?: string
          labor_score?: number | null
          overall_score?: number | null
          paid_single_use?: boolean | null
          pricing_variance?: number | null
          processing_time_ms?: number | null
          region?: string | null
          result_json: Json
          team_id?: string | null
          user_id: string
        }
        Update: {
          carrier_tactics_count?: number | null
          created_at?: string | null
          damage_type?: string | null
          depreciation_score?: number | null
          estimate_name?: string
          estimate_type?: string | null
          expires_at?: string | null
          format_detected?: string | null
          id?: string
          labor_score?: number | null
          overall_score?: number | null
          paid_single_use?: boolean | null
          pricing_variance?: number | null
          processing_time_ms?: number | null
          region?: string | null
          result_json?: Json
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          ai_analysis_json: Json | null
          ai_comparison_json: Json | null
          ai_summary_json: Json | null
          carrier_estimate_url: string | null
          contractor_estimate_url: string | null
          created_at: string
          id: string
          insured_name: string | null
          letter_text: string | null
          letter_type: string | null
          pdf_report_url: string | null
          user_id: string
        }
        Insert: {
          ai_analysis_json?: Json | null
          ai_comparison_json?: Json | null
          ai_summary_json?: Json | null
          carrier_estimate_url?: string | null
          contractor_estimate_url?: string | null
          created_at?: string
          id?: string
          insured_name?: string | null
          letter_text?: string | null
          letter_type?: string | null
          pdf_report_url?: string | null
          user_id: string
        }
        Update: {
          ai_analysis_json?: Json | null
          ai_comparison_json?: Json | null
          ai_summary_json?: Json | null
          carrier_estimate_url?: string | null
          contractor_estimate_url?: string | null
          created_at?: string
          id?: string
          insured_name?: string | null
          letter_text?: string | null
          letter_type?: string | null
          pdf_report_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          plan_name: string
          plan_type: string
          price: number
          reviews_per_month: number | null
          stripe_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          plan_name: string
          plan_type: string
          price: number
          reviews_per_month?: number | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          plan_name?: string
          plan_type?: string
          price?: number
          reviews_per_month?: number | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          overage_price: number
          owner_id: string
          plan_type: string
          review_limit: number
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          overage_price: number
          owner_id: string
          plan_type: string
          review_limit: number
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          overage_price?: number
          owner_id?: string
          plan_type?: string
          review_limit?: number
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          created_at: string | null
          id: string
          month_year: string
          overage_count: number | null
          review_count: number | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          month_year: string
          overage_count?: number | null
          review_count?: number | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          month_year?: string
          overage_count?: number | null
          review_count?: number | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_review_usage: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          created_at: string | null
          id: string
          is_active: boolean | null
          plan_id: string | null
          reviews_limit: number | null
          reviews_used: number | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          plan_id?: string | null
          reviews_limit?: number | null
          reviews_used?: number | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          plan_id?: string | null
          reviews_limit?: number | null
          reviews_used?: number | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_review_usage_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_review_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plan_overview"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          plan_type: string | null
          provider_address: string | null
          provider_fax: string | null
          provider_name: string | null
          provider_npi: string | null
          provider_phone: string | null
          role: string | null
          signer_credentials: string | null
          signer_name: string | null
          signer_phone: string | null
          signer_title: string | null
          stripe_customer_id: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          plan_type?: string | null
          provider_address?: string | null
          provider_fax?: string | null
          provider_name?: string | null
          provider_npi?: string | null
          provider_phone?: string | null
          role?: string | null
          signer_credentials?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          signer_title?: string | null
          stripe_customer_id?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          plan_type?: string | null
          provider_address?: string | null
          provider_fax?: string | null
          provider_name?: string | null
          provider_npi?: string | null
          provider_phone?: string | null
          role?: string | null
          signer_credentials?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          signer_title?: string | null
          stripe_customer_id?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_plan_overview"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      recovery_performance: {
        Row: {
          avg_recovery: number | null
          carrier: string | null
          claim_type: string | null
          guarantee_rate: number | null
          guarantees_triggered: number | null
          refunds_issued: number | null
          total_claims: number | null
          total_recovery: number | null
        }
        Relationships: []
      }
      user_plan_overview: {
        Row: {
          billing_period_end: string | null
          email: string | null
          is_active: boolean | null
          plan_name: string | null
          price: number | null
          reviews_limit: number | null
          reviews_remaining: string | null
          reviews_used: number | null
          total_recovery_value: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_create_review: { Args: { p_user_id: string }; Returns: Json }
      can_user_create_review: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      get_all_code_requirements: {
        Args: { jurisdiction_param?: string }
        Returns: {
          code_reference: string
          estimated_cost: number
          required_item: string
          requirement: string
          trigger_trade: string
        }[]
      }
      get_code_requirements_for_trade: {
        Args: { jurisdiction_param?: string; trade_param: string }
        Returns: {
          code_reference: string
          estimated_cost: number
          required_item: string
          requirement: string
          severity: string
        }[]
      }
      get_labor_rate: {
        Args: { p_region: string; p_trade: string }
        Returns: {
          avg_rate: number
          max_rate: number
          min_rate: number
          source: string
        }[]
      }
      get_pricing_data: {
        Args: { p_region: string; p_trade_code: string; p_unit?: string }
        Returns: {
          adjusted_price: number
          base_price: number
          description: string
          item_code: string
          price_source: string
          unit: string
        }[]
      }
      get_recovery_summary: {
        Args: { user_id_param: string }
        Returns: {
          average_recovery: number
          guarantees_triggered: number
          refunds_issued: number
          total_recovery: number
          total_reviews: number
        }[]
      }
      get_team_usage: {
        Args: { p_team_id: string }
        Returns: {
          overage_count: number
          overage_price: number
          review_count: number
          review_limit: number
        }[]
      }
      get_user_plan_usage: {
        Args: { user_id_param: string }
        Returns: {
          billing_period_end: string
          is_active: boolean
          plan_name: string
          reviews_limit: number
          reviews_remaining: number
          reviews_used: number
        }[]
      }
      get_user_total_recovery: {
        Args: { user_id_param: string }
        Returns: number
      }
      increment_review_usage: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      increment_team_usage: { Args: { p_team_id: string }; Returns: undefined }
      reset_monthly_usage: { Args: never; Returns: number }
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
    Enums: {},
  },
} as const
