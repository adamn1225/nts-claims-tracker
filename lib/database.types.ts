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
      ai_chat_history: {
        Row: {
          broker_id: string
          confidence: string | null
          content: string
          conversation_id: string
          created_at: string | null
          customer_id: string | null
          id: string
          is_archived: boolean | null
          mode: string
          page_path: string | null
          role: string
          tag: string | null
          web_search_used: boolean | null
        }
        Insert: {
          broker_id: string
          confidence?: string | null
          content: string
          conversation_id: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_archived?: boolean | null
          mode: string
          page_path?: string | null
          role: string
          tag?: string | null
          web_search_used?: boolean | null
        }
        Update: {
          broker_id?: string
          confidence?: string | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_archived?: boolean | null
          mode?: string
          page_path?: string | null
          role?: string
          tag?: string | null
          web_search_used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_history_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "ai_chat_history_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_history_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          broker_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_reset_at: string | null
          last_used_at: string | null
          last_used_endpoint: string | null
          last_used_ip: string | null
          name: string
          rate_limit_per_hour: number
          requests_count: number
          revoked_at: string | null
          revoked_reason: string | null
          scopes: Json
          token_hash: string
          token_prefix: string
          updated_at: string
        }
        Insert: {
          broker_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_reset_at?: string | null
          last_used_at?: string | null
          last_used_endpoint?: string | null
          last_used_ip?: string | null
          name: string
          rate_limit_per_hour?: number
          requests_count?: number
          revoked_at?: string | null
          revoked_reason?: string | null
          scopes?: Json
          token_hash: string
          token_prefix: string
          updated_at?: string
        }
        Update: {
          broker_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_reset_at?: string | null
          last_used_at?: string | null
          last_used_endpoint?: string | null
          last_used_ip?: string | null
          name?: string
          rate_limit_per_hour?: number
          requests_count?: number
          revoked_at?: string | null
          revoked_reason?: string | null
          scopes?: Json
          token_hash?: string
          token_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "api_tokens_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_tokens_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: boolean
          maintenance_enabled: boolean
          maintenance_ends_at: string | null
          maintenance_message: string | null
          maintenance_show_game: boolean
          maintenance_starts_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          maintenance_enabled?: boolean
          maintenance_ends_at?: string | null
          maintenance_message?: string | null
          maintenance_show_game?: boolean
          maintenance_starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          maintenance_enabled?: boolean
          maintenance_ends_at?: string | null
          maintenance_message?: string | null
          maintenance_show_game?: boolean
          maintenance_starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      app_updates: {
        Row: {
          author_id: string | null
          category: string | null
          content: string
          created_at: string | null
          excerpt: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          action_category: string
          actor_email: string
          actor_id: string
          actor_name: string
          actor_role: string
          changes: Json | null
          created_at: string | null
          details: Json | null
          error_message: string | null
          id: string
          ip_address: unknown
          request_method: string | null
          request_path: string | null
          severity: string | null
          success: boolean | null
          target_broker_email: string | null
          target_broker_id: string | null
          target_broker_name: string | null
          target_customer_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          action_category: string
          actor_email: string
          actor_id: string
          actor_name: string
          actor_role: string
          changes?: Json | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          request_method?: string | null
          request_path?: string | null
          severity?: string | null
          success?: boolean | null
          target_broker_email?: string | null
          target_broker_id?: string | null
          target_broker_name?: string | null
          target_customer_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_category?: string
          actor_email?: string
          actor_id?: string
          actor_name?: string
          actor_role?: string
          changes?: Json | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          request_method?: string | null
          request_path?: string | null
          severity?: string | null
          success?: boolean | null
          target_broker_email?: string | null
          target_broker_id?: string | null
          target_broker_name?: string | null
          target_customer_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_target_broker_id_fkey"
            columns: ["target_broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "audit_logs_target_broker_id_fkey"
            columns: ["target_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_broker_id_fkey"
            columns: ["target_broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_customer_id_fkey"
            columns: ["target_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_call_quality_scores: {
        Row: {
          broker_id: string
          calls_analyzed: number
          last_updated: string
          qualifying_questions_hit: number
        }
        Insert: {
          broker_id: string
          calls_analyzed?: number
          last_updated?: string
          qualifying_questions_hit?: number
        }
        Update: {
          broker_id?: string
          calls_analyzed?: number
          last_updated?: string
          qualifying_questions_hit?: number
        }
        Relationships: [
          {
            foreignKeyName: "broker_call_quality_scores_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: true
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "broker_call_quality_scores_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: true
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_call_quality_scores_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: true
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_permissions: {
        Row: {
          broker_id: string
          can_access_power_dialer: boolean | null
          can_edit_all_customers: boolean | null
          can_edit_all_tasks: boolean | null
          can_edit_office_customers: boolean | null
          can_edit_office_tasks: boolean | null
          can_edit_own_customers: boolean | null
          can_edit_own_tasks: boolean | null
          can_export_data: boolean | null
          can_invite_any_office: boolean | null
          can_invite_brokers: boolean | null
          can_manage_permissions: boolean | null
          can_manage_statuses: boolean | null
          can_manage_users: boolean | null
          can_use_ai_email: boolean | null
          can_view_all_brokers: boolean | null
          can_view_all_customers: boolean | null
          can_view_all_tasks: boolean | null
          can_view_analytics: boolean | null
          can_view_office_brokers: boolean | null
          can_view_office_customers: boolean | null
          can_view_office_tasks: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          broker_id: string
          can_access_power_dialer?: boolean | null
          can_edit_all_customers?: boolean | null
          can_edit_all_tasks?: boolean | null
          can_edit_office_customers?: boolean | null
          can_edit_office_tasks?: boolean | null
          can_edit_own_customers?: boolean | null
          can_edit_own_tasks?: boolean | null
          can_export_data?: boolean | null
          can_invite_any_office?: boolean | null
          can_invite_brokers?: boolean | null
          can_manage_permissions?: boolean | null
          can_manage_statuses?: boolean | null
          can_manage_users?: boolean | null
          can_use_ai_email?: boolean | null
          can_view_all_brokers?: boolean | null
          can_view_all_customers?: boolean | null
          can_view_all_tasks?: boolean | null
          can_view_analytics?: boolean | null
          can_view_office_brokers?: boolean | null
          can_view_office_customers?: boolean | null
          can_view_office_tasks?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          broker_id?: string
          can_access_power_dialer?: boolean | null
          can_edit_all_customers?: boolean | null
          can_edit_all_tasks?: boolean | null
          can_edit_office_customers?: boolean | null
          can_edit_office_tasks?: boolean | null
          can_edit_own_customers?: boolean | null
          can_edit_own_tasks?: boolean | null
          can_export_data?: boolean | null
          can_invite_any_office?: boolean | null
          can_invite_brokers?: boolean | null
          can_manage_permissions?: boolean | null
          can_manage_statuses?: boolean | null
          can_manage_users?: boolean | null
          can_use_ai_email?: boolean | null
          can_view_all_brokers?: boolean | null
          can_view_all_customers?: boolean | null
          can_view_all_tasks?: boolean | null
          can_view_analytics?: boolean | null
          can_view_office_brokers?: boolean | null
          can_view_office_customers?: boolean | null
          can_view_office_tasks?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_permissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: true
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "broker_permissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: true
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_permissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: true
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_portfolio: {
        Row: {
          broker_id: string
          caption: string | null
          created_at: string
          destination: string | null
          equipment_type: string | null
          id: string
          image_path: string
          order_ref: string | null
          origin: string | null
          sort_order: number | null
        }
        Insert: {
          broker_id: string
          caption?: string | null
          created_at?: string
          destination?: string | null
          equipment_type?: string | null
          id?: string
          image_path: string
          order_ref?: string | null
          origin?: string | null
          sort_order?: number | null
        }
        Update: {
          broker_id?: string
          caption?: string | null
          created_at?: string
          destination?: string | null
          equipment_type?: string | null
          id?: string
          image_path?: string
          order_ref?: string | null
          origin?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_portfolio_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "broker_portfolio_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_portfolio_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      brokers: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string
          first_name: string | null
          headline: string | null
          help_docs_viewed: boolean
          id: string
          is_active: boolean
          is_admin: boolean | null
          is_manager: boolean | null
          is_remote: boolean | null
          is_sales_coach: boolean | null
          joined_date: string | null
          landing_config: Json
          landing_config_approved: Json | null
          landing_review_note: string | null
          landing_reviewed_at: string | null
          landing_reviewed_by: string | null
          landing_status: string
          landing_submitted_at: string | null
          last_name: string | null
          linkedin_url: string | null
          office_location: string | null
          phone: string | null
          profile_slug: string | null
          show_in_directory: boolean
          specialties: string[] | null
          territory: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          headline?: string | null
          help_docs_viewed?: boolean
          id?: string
          is_active?: boolean
          is_admin?: boolean | null
          is_manager?: boolean | null
          is_remote?: boolean | null
          is_sales_coach?: boolean | null
          joined_date?: string | null
          landing_config?: Json
          landing_config_approved?: Json | null
          landing_review_note?: string | null
          landing_reviewed_at?: string | null
          landing_reviewed_by?: string | null
          landing_status?: string
          landing_submitted_at?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          office_location?: string | null
          phone?: string | null
          profile_slug?: string | null
          show_in_directory?: boolean
          specialties?: string[] | null
          territory?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          headline?: string | null
          help_docs_viewed?: boolean
          id?: string
          is_active?: boolean
          is_admin?: boolean | null
          is_manager?: boolean | null
          is_remote?: boolean | null
          is_sales_coach?: boolean | null
          joined_date?: string | null
          landing_config?: Json
          landing_config_approved?: Json | null
          landing_review_note?: string | null
          landing_reviewed_at?: string | null
          landing_reviewed_by?: string | null
          landing_status?: string
          landing_submitted_at?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          office_location?: string | null
          phone?: string | null
          profile_slug?: string | null
          show_in_directory?: boolean
          specialties?: string[] | null
          territory?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brokers_landing_reviewed_by_fkey"
            columns: ["landing_reviewed_by"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "brokers_landing_reviewed_by_fkey"
            columns: ["landing_reviewed_by"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brokers_landing_reviewed_by_fkey"
            columns: ["landing_reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      completed_orders: {
        Row: {
          assigned_to: string | null
          broker_balance: string | null
          broker_balance_numeric: number | null
          broker_branch: string | null
          campaign_content: string | null
          campaign_keyword: string | null
          campaign_medium: string | null
          campaign_name: string | null
          campaign_source: string | null
          cargo: string | null
          cargo_value: string | null
          cargo_value_numeric: number | null
          carrier_company_name: string | null
          carrier_pay: string | null
          carrier_pay_numeric: number | null
          created_at: string | null
          customer_type: string | null
          delivered_date: string | null
          destination_city: string | null
          destination_country: string | null
          destination_state: string | null
          destination_zip: string | null
          distance_miles: number | null
          distance_text: string | null
          duration_minutes: number | null
          duration_text: string | null
          equipment_type: string | null
          est_ship_date: string | null
          height_ft: number | null
          height_text: string | null
          id: string
          is_oversize: boolean | null
          is_overweight: boolean | null
          is_superload: boolean | null
          length_ft: number | null
          length_text: string | null
          load_name: string | null
          load_type: string | null
          make: string | null
          margin_amount: number | null
          margin_pct: number | null
          model: string | null
          order_created: string | null
          order_id: string
          order_sent: string | null
          order_signed: string | null
          order_status: string | null
          order_sub_type: string | null
          origin_city: string | null
          origin_country: string | null
          origin_state: string | null
          origin_zip: string | null
          quote_price: string | null
          quote_price_numeric: number | null
          quoted_date: string | null
          rate_per_mile: number | null
          ship_via: string | null
          shipper_email: string | null
          shipper_name: string | null
          shipper_phone: string | null
          trailer_type: string | null
          vehicle_type: string | null
          verified_shipper: boolean | null
          weight_lbs: number | null
          weight_text: string | null
          width_ft: number | null
          width_text: string | null
          year: number | null
        }
        Insert: {
          assigned_to?: string | null
          broker_balance?: string | null
          broker_balance_numeric?: number | null
          broker_branch?: string | null
          campaign_content?: string | null
          campaign_keyword?: string | null
          campaign_medium?: string | null
          campaign_name?: string | null
          campaign_source?: string | null
          cargo?: string | null
          cargo_value?: string | null
          cargo_value_numeric?: number | null
          carrier_company_name?: string | null
          carrier_pay?: string | null
          carrier_pay_numeric?: number | null
          created_at?: string | null
          customer_type?: string | null
          delivered_date?: string | null
          destination_city?: string | null
          destination_country?: string | null
          destination_state?: string | null
          destination_zip?: string | null
          distance_miles?: number | null
          distance_text?: string | null
          duration_minutes?: number | null
          duration_text?: string | null
          equipment_type?: string | null
          est_ship_date?: string | null
          height_ft?: number | null
          height_text?: string | null
          id?: string
          is_oversize?: boolean | null
          is_overweight?: boolean | null
          is_superload?: boolean | null
          length_ft?: number | null
          length_text?: string | null
          load_name?: string | null
          load_type?: string | null
          make?: string | null
          margin_amount?: number | null
          margin_pct?: number | null
          model?: string | null
          order_created?: string | null
          order_id: string
          order_sent?: string | null
          order_signed?: string | null
          order_status?: string | null
          order_sub_type?: string | null
          origin_city?: string | null
          origin_country?: string | null
          origin_state?: string | null
          origin_zip?: string | null
          quote_price?: string | null
          quote_price_numeric?: number | null
          quoted_date?: string | null
          rate_per_mile?: number | null
          ship_via?: string | null
          shipper_email?: string | null
          shipper_name?: string | null
          shipper_phone?: string | null
          trailer_type?: string | null
          vehicle_type?: string | null
          verified_shipper?: boolean | null
          weight_lbs?: number | null
          weight_text?: string | null
          width_ft?: number | null
          width_text?: string | null
          year?: number | null
        }
        Update: {
          assigned_to?: string | null
          broker_balance?: string | null
          broker_balance_numeric?: number | null
          broker_branch?: string | null
          campaign_content?: string | null
          campaign_keyword?: string | null
          campaign_medium?: string | null
          campaign_name?: string | null
          campaign_source?: string | null
          cargo?: string | null
          cargo_value?: string | null
          cargo_value_numeric?: number | null
          carrier_company_name?: string | null
          carrier_pay?: string | null
          carrier_pay_numeric?: number | null
          created_at?: string | null
          customer_type?: string | null
          delivered_date?: string | null
          destination_city?: string | null
          destination_country?: string | null
          destination_state?: string | null
          destination_zip?: string | null
          distance_miles?: number | null
          distance_text?: string | null
          duration_minutes?: number | null
          duration_text?: string | null
          equipment_type?: string | null
          est_ship_date?: string | null
          height_ft?: number | null
          height_text?: string | null
          id?: string
          is_oversize?: boolean | null
          is_overweight?: boolean | null
          is_superload?: boolean | null
          length_ft?: number | null
          length_text?: string | null
          load_name?: string | null
          load_type?: string | null
          make?: string | null
          margin_amount?: number | null
          margin_pct?: number | null
          model?: string | null
          order_created?: string | null
          order_id?: string
          order_sent?: string | null
          order_signed?: string | null
          order_status?: string | null
          order_sub_type?: string | null
          origin_city?: string | null
          origin_country?: string | null
          origin_state?: string | null
          origin_zip?: string | null
          quote_price?: string | null
          quote_price_numeric?: number | null
          quoted_date?: string | null
          rate_per_mile?: number | null
          ship_via?: string | null
          shipper_email?: string | null
          shipper_name?: string | null
          shipper_phone?: string | null
          trailer_type?: string | null
          vehicle_type?: string | null
          verified_shipper?: boolean | null
          weight_lbs?: number | null
          weight_text?: string | null
          width_ft?: number | null
          width_text?: string | null
          year?: number | null
        }
        Relationships: []
      }
      contact_log: {
        Row: {
          broker_id: string
          contact_date: string
          created_at: string | null
          customer_id: string
          duration_seconds: number | null
          id: string
          metadata: Json | null
          notes: string | null
          outcome: string | null
          subject: string
          type: string
        }
        Insert: {
          broker_id: string
          contact_date?: string
          created_at?: string | null
          customer_id: string
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          outcome?: string | null
          subject: string
          type: string
        }
        Update: {
          broker_id?: string
          contact_date?: string
          created_at?: string | null
          customer_id?: string
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          outcome?: string | null
          subject?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_log_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "contact_log_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_log_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      customer_attachments: {
        Row: {
          customer_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          notes: string | null
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          customer_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          customer_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "customer_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_collaborators: {
        Row: {
          access_level: string
          active: boolean | null
          broker_id: string
          created_at: string | null
          customer_id: string
          id: string
          invited_by: string | null
          joined_at: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          access_level?: string
          active?: boolean | null
          broker_id: string
          created_at?: string | null
          customer_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          access_level?: string
          active?: boolean | null
          broker_id?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_collaborators_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "customer_collaborators_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_collaborators_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_collaborators_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "customer_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_statuses: {
        Row: {
          broker_id: string
          color: string
          created_at: string | null
          created_by: string | null
          id: string
          is_system: boolean | null
          name: string
          order: number
          updated_at: string | null
        }
        Insert: {
          broker_id: string
          color?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          order?: number
          updated_at?: string | null
        }
        Update: {
          broker_id?: string
          color?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_statuses_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "customer_statuses_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_statuses_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_statuses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "customer_statuses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_statuses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          address_2: string | null
          broker_id: string | null
          business_name: string | null
          city: string | null
          city_2: string | null
          contact_name: string | null
          created_at: string | null
          customer_id: string
          email: string | null
          email2: string | null
          estimated_value: number | null
          facebook_url: string | null
          first_name: string | null
          first_name2: string | null
          id: string
          import_metadata: Json | null
          import_source: string | null
          imported_by: string | null
          industry: string | null
          instagram_url: string | null
          is_pinned: boolean | null
          job_title: string | null
          job_title2: string | null
          last_contact_date: string | null
          last_name: string | null
          last_name2: string | null
          linkedin_url: string | null
          next_follow_up_date: string | null
          next_follow_up_type: string | null
          notes: string | null
          office_location: string | null
          on_kanban_board: boolean | null
          opportunity_type: string | null
          phone: string | null
          phone_2: string | null
          phone_2_ext: string | null
          phone_3: string | null
          phone_3_ext: string | null
          phone_ext: string | null
          phone2: string | null
          phone2_ext: string | null
          pin_order: number | null
          shipping_frequency: string | null
          state: string | null
          state_2: string | null
          status: string
          status_id: string | null
          tms_account_id: string | null
          twitter_url: string | null
          updated_at: string | null
          url: string | null
          url_1: string | null
          website_url: string | null
          zip: string | null
          zip_2: string | null
        }
        Insert: {
          address?: string | null
          address_2?: string | null
          broker_id?: string | null
          business_name?: string | null
          city?: string | null
          city_2?: string | null
          contact_name?: string | null
          created_at?: string | null
          customer_id?: string
          email?: string | null
          email2?: string | null
          estimated_value?: number | null
          facebook_url?: string | null
          first_name?: string | null
          first_name2?: string | null
          id?: string
          import_metadata?: Json | null
          import_source?: string | null
          imported_by?: string | null
          industry?: string | null
          instagram_url?: string | null
          is_pinned?: boolean | null
          job_title?: string | null
          job_title2?: string | null
          last_contact_date?: string | null
          last_name?: string | null
          last_name2?: string | null
          linkedin_url?: string | null
          next_follow_up_date?: string | null
          next_follow_up_type?: string | null
          notes?: string | null
          office_location?: string | null
          on_kanban_board?: boolean | null
          opportunity_type?: string | null
          phone?: string | null
          phone_2?: string | null
          phone_2_ext?: string | null
          phone_3?: string | null
          phone_3_ext?: string | null
          phone_ext?: string | null
          phone2?: string | null
          phone2_ext?: string | null
          pin_order?: number | null
          shipping_frequency?: string | null
          state?: string | null
          state_2?: string | null
          status?: string
          status_id?: string | null
          tms_account_id?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          url?: string | null
          url_1?: string | null
          website_url?: string | null
          zip?: string | null
          zip_2?: string | null
        }
        Update: {
          address?: string | null
          address_2?: string | null
          broker_id?: string | null
          business_name?: string | null
          city?: string | null
          city_2?: string | null
          contact_name?: string | null
          created_at?: string | null
          customer_id?: string
          email?: string | null
          email2?: string | null
          estimated_value?: number | null
          facebook_url?: string | null
          first_name?: string | null
          first_name2?: string | null
          id?: string
          import_metadata?: Json | null
          import_source?: string | null
          imported_by?: string | null
          industry?: string | null
          instagram_url?: string | null
          is_pinned?: boolean | null
          job_title?: string | null
          job_title2?: string | null
          last_contact_date?: string | null
          last_name?: string | null
          last_name2?: string | null
          linkedin_url?: string | null
          next_follow_up_date?: string | null
          next_follow_up_type?: string | null
          notes?: string | null
          office_location?: string | null
          on_kanban_board?: boolean | null
          opportunity_type?: string | null
          phone?: string | null
          phone_2?: string | null
          phone_2_ext?: string | null
          phone_3?: string | null
          phone_3_ext?: string | null
          phone_ext?: string | null
          phone2?: string | null
          phone2_ext?: string | null
          pin_order?: number | null
          shipping_frequency?: string | null
          state?: string | null
          state_2?: string | null
          status?: string
          status_id?: string | null
          tms_account_id?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          url?: string | null
          url_1?: string | null
          website_url?: string | null
          zip?: string | null
          zip_2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "customers_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "customers_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "customer_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      dialer_ai_preferences: {
        Row: {
          auto_advance_delay_sec: number
          broker_id: string
          manual_advance: boolean
          post_email_draft: boolean
          post_performance: boolean
          post_sms_draft: boolean
          post_suggest_followup: boolean
          post_tips: boolean
          pre_call_brief: boolean
          updated_at: string
        }
        Insert: {
          auto_advance_delay_sec?: number
          broker_id: string
          manual_advance?: boolean
          post_email_draft?: boolean
          post_performance?: boolean
          post_sms_draft?: boolean
          post_suggest_followup?: boolean
          post_tips?: boolean
          pre_call_brief?: boolean
          updated_at?: string
        }
        Update: {
          auto_advance_delay_sec?: number
          broker_id?: string
          manual_advance?: boolean
          post_email_draft?: boolean
          post_performance?: boolean
          post_sms_draft?: boolean
          post_suggest_followup?: boolean
          post_tips?: boolean
          pre_call_brief?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      dialer_call_logs: {
        Row: {
          ai_feedback: Json | null
          broker_id: string
          contact_id: string | null
          contact_snapshot: Json
          created_at: string
          duration_seconds: number | null
          follow_up_at: string | null
          goto_call_id: string | null
          id: string
          notes: string | null
          outcome: string | null
          pre_call_brief: string | null
          session_id: string
        }
        Insert: {
          ai_feedback?: Json | null
          broker_id: string
          contact_id?: string | null
          contact_snapshot: Json
          created_at?: string
          duration_seconds?: number | null
          follow_up_at?: string | null
          goto_call_id?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          pre_call_brief?: string | null
          session_id: string
        }
        Update: {
          ai_feedback?: Json | null
          broker_id?: string
          contact_id?: string | null
          contact_snapshot?: Json
          created_at?: string
          duration_seconds?: number | null
          follow_up_at?: string | null
          goto_call_id?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          pre_call_brief?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialer_call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "dialer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialer_call_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dialer_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dialer_contacts: {
        Row: {
          broker_id: string
          city: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          list_id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          broker_id: string
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          list_id: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          broker_id?: string
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          list_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialer_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "dialer_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      dialer_lists: {
        Row: {
          broker_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          broker_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          broker_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      dialer_sessions: {
        Row: {
          broker_id: string
          contacts_snapshot: Json | null
          ended_at: string | null
          id: string
          list_id: string | null
          mode: string
          started_at: string
          total_calls: number
          total_connected: number
        }
        Insert: {
          broker_id: string
          contacts_snapshot?: Json | null
          ended_at?: string | null
          id?: string
          list_id?: string | null
          mode: string
          started_at?: string
          total_calls?: number
          total_connected?: number
        }
        Update: {
          broker_id?: string
          contacts_snapshot?: Json | null
          ended_at?: string | null
          id?: string
          list_id?: string | null
          mode?: string
          started_at?: string
          total_calls?: number
          total_connected?: number
        }
        Relationships: [
          {
            foreignKeyName: "dialer_sessions_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "dialer_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_config: {
        Row: {
          bcc_emails: string[] | null
          cc_emails: string[] | null
          created_at: string | null
          from_email: string
          from_name: string
          id: string
          mailjet_api_key: string | null
          mailjet_secret_key: string | null
          provider_priority: Json
          sendgrid_api_key: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          bcc_emails?: string[] | null
          cc_emails?: string[] | null
          created_at?: string | null
          from_email: string
          from_name: string
          id?: string
          mailjet_api_key?: string | null
          mailjet_secret_key?: string | null
          provider_priority?: Json
          sendgrid_api_key?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          bcc_emails?: string[] | null
          cc_emails?: string[] | null
          created_at?: string | null
          from_email?: string
          from_name?: string
          id?: string
          mailjet_api_key?: string | null
          mailjet_secret_key?: string | null
          provider_priority?: Json
          sendgrid_api_key?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          broker_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          subject: string
          template_type: string | null
          updated_at: string | null
        }
        Insert: {
          body: string
          broker_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          subject: string
          template_type?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          broker_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          subject?: string
          template_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "email_templates_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          admin_notes: string | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          broker_email: string | null
          broker_id: string | null
          broker_name: string | null
          category: string | null
          created_at: string | null
          id: string
          is_reviewed: boolean | null
          message: string
          page_context: string | null
          rating: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          broker_email?: string | null
          broker_id?: string | null
          broker_name?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_reviewed?: boolean | null
          message: string
          page_context?: string | null
          rating?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          broker_email?: string | null
          broker_id?: string | null
          broker_name?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_reviewed?: boolean | null
          message?: string
          page_context?: string | null
          rating?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      game_high_scores: {
        Row: {
          broker_id: string | null
          created_at: string
          id: string
          initials: string
          score: number
        }
        Insert: {
          broker_id?: string | null
          created_at?: string
          id?: string
          initials: string
          score: number
        }
        Update: {
          broker_id?: string | null
          created_at?: string
          id?: string
          initials?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_high_scores_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "game_high_scores_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_high_scores_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      goto_connections: {
        Row: {
          access_token: string
          account_key: string | null
          created_at: string
          expires_at: string
          goto_user_email: string | null
          goto_user_key: string | null
          id: string
          is_admin_token: boolean
          numeric_account_key: string | null
          preferred_device_id: string | null
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_key?: string | null
          created_at?: string
          expires_at: string
          goto_user_email?: string | null
          goto_user_key?: string | null
          id?: string
          is_admin_token?: boolean
          numeric_account_key?: string | null
          preferred_device_id?: string | null
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_key?: string | null
          created_at?: string
          expires_at?: string
          goto_user_email?: string | null
          goto_user_key?: string | null
          id?: string
          is_admin_token?: boolean
          numeric_account_key?: string | null
          preferred_device_id?: string | null
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lane_templates: {
        Row: {
          broker_id: string
          created_at: string
          destination_zip: string
          height_ft: number
          id: string
          length_ft: number
          make_model: string | null
          name: string
          origin_zip: string
          trailer_id: string
          updated_at: string
          weight_lbs: number
          width_ft: number
        }
        Insert: {
          broker_id: string
          created_at?: string
          destination_zip: string
          height_ft?: number
          id?: string
          length_ft?: number
          make_model?: string | null
          name: string
          origin_zip: string
          trailer_id: string
          updated_at?: string
          weight_lbs?: number
          width_ft?: number
        }
        Update: {
          broker_id?: string
          created_at?: string
          destination_zip?: string
          height_ft?: number
          id?: string
          length_ft?: number
          make_model?: string | null
          name?: string
          origin_zip?: string
          trailer_id?: string
          updated_at?: string
          weight_lbs?: number
          width_ft?: number
        }
        Relationships: [
          {
            foreignKeyName: "lane_templates_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "lane_templates_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lane_templates_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          broker_id: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          is_archived: boolean | null
          is_read: boolean | null
          link_url: string | null
          message: string
          read_at: string | null
          scheduled_for: string | null
          task_id: string | null
          title: string
          type: string
        }
        Insert: {
          broker_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          link_url?: string | null
          message: string
          read_at?: string | null
          scheduled_for?: string | null
          task_id?: string | null
          title: string
          type: string
        }
        Update: {
          broker_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          link_url?: string | null
          message?: string
          read_at?: string | null
          scheduled_for?: string | null
          task_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "notifications_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      nts_support_history: {
        Row: {
          broker_id: string
          confidence: string | null
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_archived: boolean | null
          page_path: string | null
          role: string
          topics: string[] | null
          web_search_used: boolean | null
        }
        Insert: {
          broker_id: string
          confidence?: string | null
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          page_path?: string | null
          role: string
          topics?: string[] | null
          web_search_used?: boolean | null
        }
        Update: {
          broker_id?: string
          confidence?: string | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          page_path?: string | null
          role?: string
          topics?: string[] | null
          web_search_used?: boolean | null
        }
        Relationships: []
      }
      performance_overrides: {
        Row: {
          created_at: string | null
          display_name_override: string | null
          goto_user_email: string
          goto_user_key: string | null
          id: string
          is_excluded: boolean
          notes: string | null
          office_location: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name_override?: string | null
          goto_user_email: string
          goto_user_key?: string | null
          id?: string
          is_excluded?: boolean
          notes?: string | null
          office_location?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name_override?: string | null
          goto_user_email?: string
          goto_user_key?: string | null
          id?: string
          is_excluded?: boolean
          notes?: string | null
          office_location?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      permit_corrections: {
        Row: {
          additional_context: string | null
          broker_email: string | null
          broker_name: string | null
          correction_type: string
          id: string
          reported_at: string
          reported_by_broker_id: string
          reported_cost: string | null
          reported_notes: string | null
          reported_time: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_broker_id: string | null
          state: string
          status: string
        }
        Insert: {
          additional_context?: string | null
          broker_email?: string | null
          broker_name?: string | null
          correction_type: string
          id?: string
          reported_at?: string
          reported_by_broker_id: string
          reported_cost?: string | null
          reported_notes?: string | null
          reported_time?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_broker_id?: string | null
          state: string
          status?: string
        }
        Update: {
          additional_context?: string | null
          broker_email?: string | null
          broker_name?: string | null
          correction_type?: string
          id?: string
          reported_at?: string
          reported_by_broker_id?: string
          reported_cost?: string | null
          reported_notes?: string | null
          reported_time?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_broker_id?: string | null
          state?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "permit_corrections_reported_by_broker_id_fkey"
            columns: ["reported_by_broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "permit_corrections_reported_by_broker_id_fkey"
            columns: ["reported_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_corrections_reported_by_broker_id_fkey"
            columns: ["reported_by_broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_corrections_reviewed_by_broker_id_fkey"
            columns: ["reviewed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "permit_corrections_reviewed_by_broker_id_fkey"
            columns: ["reviewed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_corrections_reviewed_by_broker_id_fkey"
            columns: ["reviewed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      power_dialer_events: {
        Row: {
          call_id: string
          created_at: string
          customer_id: string | null
          customer_phone: string | null
          event_type: string
          id: string
          raw_payload: Json | null
          user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          customer_id?: string | null
          customer_phone?: string | null
          event_type: string
          id?: string
          raw_payload?: Json | null
          user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          customer_id?: string | null
          customer_phone?: string | null
          event_type?: string
          id?: string
          raw_payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "power_dialer_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_group_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          broker_id: string
          group_id: string
          id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          broker_id: string
          group_id: string
          id?: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          broker_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "sales_group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_group_members_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "sales_group_members_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_group_members_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "sales_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_groups: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          group_type: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          group_type?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          group_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "sales_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          accepted_at: string | null
          assignee_id: string
          assigner_id: string
          assignment_type: string
          contribution_notes: string | null
          contribution_value: number | null
          created_at: string | null
          decline_reason: string | null
          declined_at: string | null
          id: string
          is_mandatory: boolean | null
          last_contribution_at: string | null
          status: string
          task_id: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          assignee_id: string
          assigner_id: string
          assignment_type: string
          contribution_notes?: string | null
          contribution_value?: number | null
          created_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          is_mandatory?: boolean | null
          last_contribution_at?: string | null
          status?: string
          task_id: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          assignee_id?: string
          assigner_id?: string
          assignment_type?: string
          contribution_notes?: string | null
          contribution_value?: number | null
          created_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          is_mandatory?: boolean | null
          last_contribution_at?: string | null
          status?: string
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "task_assignments_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_assigner_id_fkey"
            columns: ["assigner_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "task_assignments_assigner_id_fkey"
            columns: ["assigner_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_assigner_id_fkey"
            columns: ["assigner_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          broker_id: string | null
          created_at: string | null
          description: string | null
          due_date_offset: string | null
          due_time: string | null
          id: string
          name: string
          priority: string | null
          reminder_days: number[] | null
          type: string
          updated_at: string | null
        }
        Insert: {
          broker_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date_offset?: string | null
          due_time?: string | null
          id?: string
          name: string
          priority?: string | null
          reminder_days?: number[] | null
          type: string
          updated_at?: string | null
        }
        Update: {
          broker_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date_offset?: string | null
          due_time?: string | null
          id?: string
          name?: string
          priority?: string | null
          reminder_days?: number[] | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "task_templates_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          broker_id: string | null
          completed_at: string | null
          completion_notes: string | null
          completion_outcome: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          description: string | null
          due_date: string
          due_time: string | null
          follow_up_task_id: string | null
          id: string
          last_reminder_sent_date: string | null
          priority: string | null
          reminder_days: number[] | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          requires_acceptance: boolean | null
          status: string
          task_category: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          broker_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_outcome?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date: string
          due_time?: string | null
          follow_up_task_id?: string | null
          id?: string
          last_reminder_sent_date?: string | null
          priority?: string | null
          reminder_days?: number[] | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          requires_acceptance?: boolean | null
          status?: string
          task_category?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          broker_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_outcome?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string
          due_time?: string | null
          follow_up_task_id?: string | null
          id?: string
          last_reminder_sent_date?: string | null
          priority?: string | null
          reminder_days?: number[] | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          requires_acceptance?: boolean | null
          status?: string
          task_category?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "tasks_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_follow_up_task_id_fkey"
            columns: ["follow_up_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_tasks: {
        Row: {
          allow_self_join: boolean | null
          created_at: string | null
          current_value: number | null
          department: string | null
          goal_type: string
          id: string
          is_public: boolean | null
          office_location: string | null
          target_value: number
          task_id: string
          team_scope: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          allow_self_join?: boolean | null
          created_at?: string | null
          current_value?: number | null
          department?: string | null
          goal_type: string
          id?: string
          is_public?: boolean | null
          office_location?: string | null
          target_value: number
          task_id: string
          team_scope: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_self_join?: boolean | null
          created_at?: string | null
          current_value?: number | null
          department?: string | null
          goal_type?: string
          id?: string
          is_public?: boolean | null
          office_location?: string | null
          target_value?: number
          task_id?: string
          team_scope?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_references: {
        Row: {
          broker_id: string
          created_at: string | null
          customer_id: string
          external_id: string
          id: string
          label: string | null
          type: Database["public"]["Enums"]["tms_reference_type"]
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          customer_id: string
          external_id: string
          id?: string
          label?: string | null
          type: Database["public"]["Enums"]["tms_reference_type"]
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          customer_id?: string
          external_id?: string
          id?: string
          label?: string | null
          type?: Database["public"]["Enums"]["tms_reference_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tms_references_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "tms_references_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_references_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_references_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          broker_id: string
          created_at: string | null
          default_view: string | null
          digest_time: string | null
          email_notifications_enabled: boolean | null
          id: string
          imports_column_order: Json | null
          imports_visible_columns: Json | null
          in_app_notifications_enabled: boolean | null
          items_per_page: number | null
          kanban_column_order: Json | null
          kanban_visible_fields: Json | null
          last_digest_sent_date: string | null
          reminder_hours_before: number | null
          show_archived: boolean | null
          timezone: string
          updated_at: string | null
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          default_view?: string | null
          digest_time?: string | null
          email_notifications_enabled?: boolean | null
          id?: string
          imports_column_order?: Json | null
          imports_visible_columns?: Json | null
          in_app_notifications_enabled?: boolean | null
          items_per_page?: number | null
          kanban_column_order?: Json | null
          kanban_visible_fields?: Json | null
          last_digest_sent_date?: string | null
          reminder_hours_before?: number | null
          show_archived?: boolean | null
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          default_view?: string | null
          digest_time?: string | null
          email_notifications_enabled?: boolean | null
          id?: string
          imports_column_order?: Json | null
          imports_visible_columns?: Json | null
          in_app_notifications_enabled?: boolean | null
          items_per_page?: number | null
          kanban_column_order?: Json | null
          kanban_visible_fields?: Json | null
          last_digest_sent_date?: string | null
          reminder_hours_before?: number | null
          show_archived?: boolean | null
          timezone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: true
            referencedRelation: "broker_customer_summary"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "user_preferences_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: true
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: true
            referencedRelation: "public_broker_pages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      audit_logs_readable: {
        Row: {
          action: string | null
          action_category: string | null
          actor_email: string | null
          actor_name: string | null
          actor_role: string | null
          created_at: string | null
          description: string | null
          details: Json | null
          id: string | null
          ip_address: string | null
          severity: string | null
          success: boolean | null
          target_broker_email: string | null
          target_broker_name: string | null
        }
        Insert: {
          action?: string | null
          action_category?: string | null
          actor_email?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          description?: never
          details?: Json | null
          id?: string | null
          ip_address?: never
          severity?: string | null
          success?: boolean | null
          target_broker_email?: string | null
          target_broker_name?: string | null
        }
        Update: {
          action?: string | null
          action_category?: string | null
          actor_email?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          description?: never
          details?: Json | null
          id?: string | null
          ip_address?: never
          severity?: string | null
          success?: boolean | null
          target_broker_email?: string | null
          target_broker_name?: string | null
        }
        Relationships: []
      }
      broker_customer_summary: {
        Row: {
          active_customers: number | null
          broker_id: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          is_admin: boolean | null
          is_manager: boolean | null
          last_name: string | null
          lost_count: number | null
          office_location: string | null
          prospects: number | null
          total_customers: number | null
          win_rate_pct: number | null
          won_count: number | null
        }
        Relationships: []
      }
      cron_job_status: {
        Row: {
          active: boolean | null
          command: string | null
          database: string | null
          jobid: number | null
          jobname: string | null
          nodename: string | null
          nodeport: number | null
          schedule: string | null
          username: string | null
        }
        Insert: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Relationships: []
      }
      office_customer_summary: {
        Row: {
          active_count: number | null
          lost_count: number | null
          office_location: string | null
          prospect_count: number | null
          total_customers: number | null
          win_rate_pct: number | null
          won_count: number | null
        }
        Relationships: []
      }
      public_broker_pages: {
        Row: {
          avatar_url: string | null
          bio: string | null
          first_name: string | null
          headline: string | null
          id: string | null
          landing_config_approved: Json | null
          landing_status: string | null
          last_name: string | null
          linkedin_url: string | null
          office_location: string | null
          phone: string | null
          profile_slug: string | null
          specialties: string[] | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          first_name?: string | null
          headline?: string | null
          id?: string | null
          landing_config_approved?: Json | null
          landing_status?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          office_location?: string | null
          phone?: string | null
          profile_slug?: string | null
          specialties?: string[] | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          first_name?: string | null
          headline?: string | null
          id?: string | null
          landing_config_approved?: Json | null
          landing_status?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          office_location?: string | null
          phone?: string | null
          profile_slug?: string | null
          specialties?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_task_assignment: {
        Args: { assignment_id: string }
        Returns: undefined
      }
      cleanup_old_audit_logs: {
        Args: { retention_days?: number }
        Returns: number
      }
      create_task_reminders: { Args: never; Returns: undefined }
      decline_task_assignment: {
        Args: { assignment_id: string; reason?: string }
        Returns: undefined
      }
      generate_customer_id: { Args: never; Returns: string }
      get_api_url: { Args: never; Returns: string }
      get_my_broker_role: {
        Args: never
        Returns: {
          is_admin_val: boolean
          is_manager_val: boolean
          office_val: string
        }[]
      }
      get_unread_notification_count: { Args: never; Returns: number }
      get_user_statuses: {
        Args: never
        Returns: {
          color: string
          customer_count: number
          id: string
          is_system: boolean
          name: string
          order: number
        }[]
      }
      increment_call_quality_score: {
        Args: {
          p_broker_id: string
          p_calls_analyzed: number
          p_questions_hit: number
        }
        Returns: undefined
      }
      log_team_progress: {
        Args: { p_notes?: string; p_task_id: string; p_value: number }
        Returns: undefined
      }
      mark_overdue_tasks: { Args: never; Returns: undefined }
      set_admin_permissions: { Args: { admin_id: string }; Returns: undefined }
      set_manager_permissions: {
        Args: { manager_id: string }
        Returns: undefined
      }
      trigger_daily_digest_check: { Args: never; Returns: undefined }
      trigger_task_reminder_check: { Args: never; Returns: undefined }
      trigger_task_reminders_check: { Args: never; Returns: undefined }
    }
    Enums: {
      task_type_enum:
        | "internal_reminder"
        | "call"
        | "email"
        | "sms"
        | "meeting"
        | "decision_day"
        | "price_check_in"
        | "rate_reevaluation"
        | "reactivation"
        | "linkedin_connection"
        | "linkedin_message"
        | "video_shoutout"
        | "service_feedback"
        | "follow_up"
        | "other"
      tms_reference_type: "account" | "order" | "quote"
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
      task_type_enum: [
        "internal_reminder",
        "call",
        "email",
        "sms",
        "meeting",
        "decision_day",
        "price_check_in",
        "rate_reevaluation",
        "reactivation",
        "linkedin_connection",
        "linkedin_message",
        "video_shoutout",
        "service_feedback",
        "follow_up",
        "other",
      ],
      tms_reference_type: ["account", "order", "quote"],
    },
  },
} as const
