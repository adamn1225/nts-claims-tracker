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
      ai_chat_history: {
        Row: {
          claim_id: string | null
          completion_tokens: number | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          model: string | null
          prompt_tokens: number | null
          role: string
          user_id: string
        }
        Insert: {
          claim_id?: string | null
          completion_tokens?: number | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_tokens?: number | null
          role: string
          user_id: string
        }
        Update: {
          claim_id?: string | null
          completion_tokens?: number | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_tokens?: number | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "ai_chat_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          scopes: string[]
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          scopes?: string[]
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          scopes?: string[]
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_updates: {
        Row: {
          body: string | null
          category: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          is_published: boolean
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          is_published?: boolean
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          is_published?: boolean
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          after: Json | null
          before: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          occurred_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          occurred_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_holds: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          hold_type: Database["public"]["Enums"]["carrier_hold_type"]
          id: string
          notes: string | null
          reason: string
          related_claim_id: string | null
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          requested_at: string
          requested_by: string | null
          status: Database["public"]["Enums"]["carrier_hold_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          hold_type: Database["public"]["Enums"]["carrier_hold_type"]
          id?: string
          notes?: string | null
          reason: string
          related_claim_id?: string | null
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["carrier_hold_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          hold_type?: Database["public"]["Enums"]["carrier_hold_type"]
          id?: string
          notes?: string | null
          reason?: string
          related_claim_id?: string | null
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["carrier_hold_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_holds_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_holds_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_holds_related_claim_id_fkey"
            columns: ["related_claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "carrier_holds_related_claim_id_fkey"
            columns: ["related_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_holds_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_holds_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_verifications: {
        Row: {
          company_id: string
          dba_name: string | null
          dot_number: string | null
          fetched_at: string
          id: string
          insurance_carrier: string | null
          insurance_expiry: string | null
          legal_name: string | null
          mc_number: string | null
          notes: string | null
          operating_status: string | null
          raw_response: Json | null
          requested_by: string | null
          source: Database["public"]["Enums"]["carrier_verification_source"]
          status: Database["public"]["Enums"]["carrier_verification_status"]
        }
        Insert: {
          company_id: string
          dba_name?: string | null
          dot_number?: string | null
          fetched_at?: string
          id?: string
          insurance_carrier?: string | null
          insurance_expiry?: string | null
          legal_name?: string | null
          mc_number?: string | null
          notes?: string | null
          operating_status?: string | null
          raw_response?: Json | null
          requested_by?: string | null
          source: Database["public"]["Enums"]["carrier_verification_source"]
          status?: Database["public"]["Enums"]["carrier_verification_status"]
        }
        Update: {
          company_id?: string
          dba_name?: string | null
          dot_number?: string | null
          fetched_at?: string
          id?: string
          insurance_carrier?: string | null
          insurance_expiry?: string | null
          legal_name?: string | null
          mc_number?: string | null
          notes?: string | null
          operating_status?: string | null
          raw_response?: Json | null
          requested_by?: string | null
          source?: Database["public"]["Enums"]["carrier_verification_source"]
          status?: Database["public"]["Enums"]["carrier_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "carrier_verifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_verifications_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_documents: {
        Row: {
          ai_extracted_at: string | null
          ai_extracted_fields: Json | null
          ai_requires_review: boolean
          ai_reviewed_at: string | null
          ai_reviewed_by: string | null
          claim_id: string
          description: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          filename: string
          id: string
          is_required_evidence: boolean
          mime_type: string | null
          party_id: string | null
          size_bytes: number | null
          source: Database["public"]["Enums"]["document_source"]
          storage_bucket: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          ai_extracted_at?: string | null
          ai_extracted_fields?: Json | null
          ai_requires_review?: boolean
          ai_reviewed_at?: string | null
          ai_reviewed_by?: string | null
          claim_id: string
          description?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          filename: string
          id?: string
          is_required_evidence?: boolean
          mime_type?: string | null
          party_id?: string | null
          size_bytes?: number | null
          source?: Database["public"]["Enums"]["document_source"]
          storage_bucket?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          ai_extracted_at?: string | null
          ai_extracted_fields?: Json | null
          ai_requires_review?: boolean
          ai_reviewed_at?: string | null
          ai_reviewed_by?: string | null
          claim_id?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          filename?: string
          id?: string
          is_required_evidence?: boolean
          mime_type?: string | null
          party_id?: string | null
          size_bytes?: number | null
          source?: Database["public"]["Enums"]["document_source"]
          storage_bucket?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_documents_ai_reviewed_by_fkey"
            columns: ["ai_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_documents_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "claim_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_intake_submissions: {
        Row: {
          attachments: Json
          duplicate_of_id: string | null
          id: string
          intake_token_id: string | null
          payload: Json
          promoted_claim_id: string | null
          received_at: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: Database["public"]["Enums"]["claim_intake_source"]
          status: Database["public"]["Enums"]["intake_submission_status"]
          submitter_email: string | null
          submitter_ip: unknown
          submitter_name: string | null
          submitter_phone: string | null
          user_agent: string | null
        }
        Insert: {
          attachments?: Json
          duplicate_of_id?: string | null
          id?: string
          intake_token_id?: string | null
          payload: Json
          promoted_claim_id?: string | null
          received_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source: Database["public"]["Enums"]["claim_intake_source"]
          status?: Database["public"]["Enums"]["intake_submission_status"]
          submitter_email?: string | null
          submitter_ip?: unknown
          submitter_name?: string | null
          submitter_phone?: string | null
          user_agent?: string | null
        }
        Update: {
          attachments?: Json
          duplicate_of_id?: string | null
          id?: string
          intake_token_id?: string | null
          payload?: Json
          promoted_claim_id?: string | null
          received_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["claim_intake_source"]
          status?: Database["public"]["Enums"]["intake_submission_status"]
          submitter_email?: string | null
          submitter_ip?: unknown
          submitter_name?: string | null
          submitter_phone?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_intake_submissions_duplicate_of_id_fkey"
            columns: ["duplicate_of_id"]
            isOneToOne: false
            referencedRelation: "claim_intake_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_intake_submissions_intake_token_id_fkey"
            columns: ["intake_token_id"]
            isOneToOne: false
            referencedRelation: "intake_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_intake_submissions_promoted_claim_id_fkey"
            columns: ["promoted_claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "claim_intake_submissions_promoted_claim_id_fkey"
            columns: ["promoted_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_intake_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_notes: {
        Row: {
          author_id: string | null
          body: string
          claim_id: string
          created_at: string
          id: string
          is_ai_generated: boolean
          is_pinned: boolean
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          claim_id: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean
          is_pinned?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          claim_id?: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean
          is_pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_notes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "claim_notes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_parties: {
        Row: {
          acknowledged_at: string | null
          claim_id: string
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          last_response_at: string | null
          notes: string | null
          role: Database["public"]["Enums"]["claim_party_role"]
        }
        Insert: {
          acknowledged_at?: string | null
          claim_id: string
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_response_at?: string | null
          notes?: string | null
          role: Database["public"]["Enums"]["claim_party_role"]
        }
        Update: {
          acknowledged_at?: string | null
          claim_id?: string
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_response_at?: string | null
          notes?: string | null
          role?: Database["public"]["Enums"]["claim_party_role"]
        }
        Relationships: [
          {
            foreignKeyName: "claim_parties_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "claim_parties_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_parties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_parties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_pins: {
        Row: {
          claim_id: string
          pinned_at: string
          user_id: string
        }
        Insert: {
          claim_id: string
          pinned_at?: string
          user_id: string
        }
        Update: {
          claim_id?: string
          pinned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_pins_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "claim_pins_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_pins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_settlements: {
        Row: {
          amount_concession: number
          amount_denied: number
          amount_direct_payment: number
          amount_paid_to_shipper: number
          amount_recovered_from_carrier: number
          claim_id: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          settled_at: string
          settled_by: string | null
        }
        Insert: {
          amount_concession?: number
          amount_denied?: number
          amount_direct_payment?: number
          amount_paid_to_shipper?: number
          amount_recovered_from_carrier?: number
          claim_id: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          settled_at?: string
          settled_by?: string | null
        }
        Update: {
          amount_concession?: number
          amount_denied?: number
          amount_direct_payment?: number
          amount_paid_to_shipper?: number
          amount_recovered_from_carrier?: number
          claim_id?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          settled_at?: string
          settled_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_settlements_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "claim_settlements_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_settlements_settled_by_fkey"
            columns: ["settled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          claim_id: string
          from_status_id: string | null
          id: string
          note: string | null
          to_status_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          claim_id: string
          from_status_id?: string | null
          id?: string
          note?: string | null
          to_status_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          claim_id?: string
          from_status_id?: string | null
          id?: string
          note?: string | null
          to_status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_status_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "claim_status_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_status_history_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "claim_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_status_history_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "claim_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_statuses: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_closed: boolean
          is_denied: boolean
          is_inbox: boolean
          is_system: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_closed?: boolean
          is_denied?: boolean
          is_inbox?: boolean
          is_system?: boolean
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_closed?: boolean
          is_denied?: boolean
          is_inbox?: boolean
          is_system?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      claim_transactions: {
        Row: {
          amount: number
          claim_id: string
          created_at: string
          currency: string
          from_party_id: string | null
          gl_code: string | null
          id: string
          logged_by: string | null
          notes: string | null
          payment_source: Database["public"]["Enums"]["payment_source"]
          reference_number: string | null
          related_document_id: string | null
          to_party_id: string | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["claim_transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          claim_id: string
          created_at?: string
          currency?: string
          from_party_id?: string | null
          gl_code?: string | null
          id?: string
          logged_by?: string | null
          notes?: string | null
          payment_source?: Database["public"]["Enums"]["payment_source"]
          reference_number?: string | null
          related_document_id?: string | null
          to_party_id?: string | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["claim_transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          claim_id?: string
          created_at?: string
          currency?: string
          from_party_id?: string | null
          gl_code?: string | null
          id?: string
          logged_by?: string | null
          notes?: string | null
          payment_source?: Database["public"]["Enums"]["payment_source"]
          reference_number?: string | null
          related_document_id?: string | null
          to_party_id?: string | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["claim_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_transactions_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "claim_transactions_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_transactions_from_party_id_fkey"
            columns: ["from_party_id"]
            isOneToOne: false
            referencedRelation: "claim_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_transactions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_transactions_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "claim_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_transactions_to_party_id_fkey"
            columns: ["to_party_id"]
            isOneToOne: false
            referencedRelation: "claim_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          acknowledged_at: string | null
          bol_number: string | null
          central_dispatch_order_number: string | null
          claim_number: string
          claim_type: Database["public"]["Enums"]["claim_type"] | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          damage_claim_amount: number | null
          delivery_date: string | null
          destination_city: string | null
          destination_postal_code: string | null
          destination_state: string | null
          filed_at: string | null
          filing_status: Database["public"]["Enums"]["claim_filing_status"]
          freight_type_id: string | null
          id: string
          incident_date: string | null
          intake_source: Database["public"]["Enums"]["claim_intake_source"]
          intake_submission_id: string | null
          internal_description: string | null
          last_activity_at: string
          mcp_verification_id: string | null
          opened_at: string
          origin_city: string | null
          origin_postal_code: string | null
          origin_state: string | null
          owner_id: string | null
          pickup_date: string | null
          resolution: Database["public"]["Enums"]["claim_resolution"] | null
          resolution_notes: string | null
          shipment_value: number | null
          status_id: string
          summary: string | null
          team_member_id: string | null
          tms_order_number: string | null
          trailer_type_id: string | null
          updated_at: string
          value_bucket: Database["public"]["Enums"]["claim_value_bucket"]
          value_bucket_manual: boolean
        }
        Insert: {
          acknowledged_at?: string | null
          bol_number?: string | null
          central_dispatch_order_number?: string | null
          claim_number: string
          claim_type?: Database["public"]["Enums"]["claim_type"] | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          damage_claim_amount?: number | null
          delivery_date?: string | null
          destination_city?: string | null
          destination_postal_code?: string | null
          destination_state?: string | null
          filed_at?: string | null
          filing_status?: Database["public"]["Enums"]["claim_filing_status"]
          freight_type_id?: string | null
          id?: string
          incident_date?: string | null
          intake_source?: Database["public"]["Enums"]["claim_intake_source"]
          intake_submission_id?: string | null
          internal_description?: string | null
          last_activity_at?: string
          mcp_verification_id?: string | null
          opened_at?: string
          origin_city?: string | null
          origin_postal_code?: string | null
          origin_state?: string | null
          owner_id?: string | null
          pickup_date?: string | null
          resolution?: Database["public"]["Enums"]["claim_resolution"] | null
          resolution_notes?: string | null
          shipment_value?: number | null
          status_id: string
          summary?: string | null
          team_member_id?: string | null
          tms_order_number?: string | null
          trailer_type_id?: string | null
          updated_at?: string
          value_bucket?: Database["public"]["Enums"]["claim_value_bucket"]
          value_bucket_manual?: boolean
        }
        Update: {
          acknowledged_at?: string | null
          bol_number?: string | null
          central_dispatch_order_number?: string | null
          claim_number?: string
          claim_type?: Database["public"]["Enums"]["claim_type"] | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          damage_claim_amount?: number | null
          delivery_date?: string | null
          destination_city?: string | null
          destination_postal_code?: string | null
          destination_state?: string | null
          filed_at?: string | null
          filing_status?: Database["public"]["Enums"]["claim_filing_status"]
          freight_type_id?: string | null
          id?: string
          incident_date?: string | null
          intake_source?: Database["public"]["Enums"]["claim_intake_source"]
          intake_submission_id?: string | null
          internal_description?: string | null
          last_activity_at?: string
          mcp_verification_id?: string | null
          opened_at?: string
          origin_city?: string | null
          origin_postal_code?: string | null
          origin_state?: string | null
          owner_id?: string | null
          pickup_date?: string | null
          resolution?: Database["public"]["Enums"]["claim_resolution"] | null
          resolution_notes?: string | null
          shipment_value?: number | null
          status_id?: string
          summary?: string | null
          team_member_id?: string | null
          tms_order_number?: string | null
          trailer_type_id?: string | null
          updated_at?: string
          value_bucket?: Database["public"]["Enums"]["claim_value_bucket"]
          value_bucket_manual?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "claims_broker_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_freight_type_id_fkey"
            columns: ["freight_type_id"]
            isOneToOne: false
            referencedRelation: "freight_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_intake_submission_id_fkey"
            columns: ["intake_submission_id"]
            isOneToOne: false
            referencedRelation: "claim_intake_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_mcp_verification_id_fkey"
            columns: ["mcp_verification_id"]
            isOneToOne: false
            referencedRelation: "carrier_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "claim_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_trailer_type_id_fkey"
            columns: ["trailer_type_id"]
            isOneToOne: false
            referencedRelation: "trailer_types"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          dba_name: string | null
          dot_number: string | null
          external_source: string | null
          has_active_hold: boolean
          id: string
          is_active: boolean
          kinds: Database["public"]["Enums"]["company_kind"][]
          legal_name: string
          mc_number: string | null
          notes: string | null
          postal_code: string | null
          primary_email: string | null
          primary_phone: string | null
          scac: string | null
          state: string | null
          street_1: string | null
          street_2: string | null
          tms_external_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          dba_name?: string | null
          dot_number?: string | null
          external_source?: string | null
          has_active_hold?: boolean
          id?: string
          is_active?: boolean
          kinds?: Database["public"]["Enums"]["company_kind"][]
          legal_name: string
          mc_number?: string | null
          notes?: string | null
          postal_code?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          scac?: string | null
          state?: string | null
          street_1?: string | null
          street_2?: string | null
          tms_external_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          dba_name?: string | null
          dot_number?: string | null
          external_source?: string | null
          has_active_hold?: boolean
          id?: string
          is_active?: boolean
          kinds?: Database["public"]["Enums"]["company_kind"][]
          legal_name?: string
          mc_number?: string | null
          notes?: string | null
          postal_code?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          scac?: string | null
          state?: string | null
          street_1?: string | null
          street_2?: string | null
          tms_external_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_notes: {
        Row: {
          author_id: string | null
          body: string
          company_id: string
          created_at: string
          id: string
          is_pinned: boolean
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          company_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      correspondence_log: {
        Row: {
          ai_action_items: Json | null
          ai_summary: string | null
          body: string | null
          call_duration_seconds: number | null
          call_recording_url: string | null
          cc_addresses: string[] | null
          channel: Database["public"]["Enums"]["correspondence_channel"]
          claim_id: string
          created_at: string
          direction: Database["public"]["Enums"]["correspondence_direction"]
          email_message_id: string | null
          email_thread_id: string | null
          goto_call_id: string | null
          id: string
          logged_by: string | null
          occurred_at: string
          party_id: string | null
          requires_human_review: boolean
          subject: string | null
          to_addresses: string[] | null
        }
        Insert: {
          ai_action_items?: Json | null
          ai_summary?: string | null
          body?: string | null
          call_duration_seconds?: number | null
          call_recording_url?: string | null
          cc_addresses?: string[] | null
          channel: Database["public"]["Enums"]["correspondence_channel"]
          claim_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["correspondence_direction"]
          email_message_id?: string | null
          email_thread_id?: string | null
          goto_call_id?: string | null
          id?: string
          logged_by?: string | null
          occurred_at?: string
          party_id?: string | null
          requires_human_review?: boolean
          subject?: string | null
          to_addresses?: string[] | null
        }
        Update: {
          ai_action_items?: Json | null
          ai_summary?: string | null
          body?: string | null
          call_duration_seconds?: number | null
          call_recording_url?: string | null
          cc_addresses?: string[] | null
          channel?: Database["public"]["Enums"]["correspondence_channel"]
          claim_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["correspondence_direction"]
          email_message_id?: string | null
          email_thread_id?: string | null
          goto_call_id?: string | null
          id?: string
          logged_by?: string | null
          occurred_at?: string
          party_id?: string | null
          requires_human_review?: boolean
          subject?: string | null
          to_addresses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "correspondence_log_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "correspondence_log_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_log_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_log_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "claim_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_config: {
        Row: {
          description: string | null
          is_enabled: boolean
          key: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          schedule: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          is_enabled?: boolean
          key: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          schedule: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          is_enabled?: boolean
          key?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          schedule?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_config: {
        Row: {
          from_email: string
          from_name: string
          id: number
          is_active: boolean
          provider: string
          reply_to_email: string | null
          sendgrid_api_key_enc: string | null
          smtp_host: string | null
          smtp_pass_enc: string | null
          smtp_port: number | null
          smtp_user: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          from_email: string
          from_name?: string
          id?: number
          is_active?: boolean
          provider?: string
          reply_to_email?: string | null
          sendgrid_api_key_enc?: string | null
          smtp_host?: string | null
          smtp_pass_enc?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          from_email?: string
          from_name?: string
          id?: number
          is_active?: boolean
          provider?: string
          reply_to_email?: string | null
          sendgrid_api_key_enc?: string | null
          smtp_host?: string | null
          smtp_pass_enc?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          name: string
          subject: string
          template_type: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          name: string
          subject: string
          template_type: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          name?: string
          subject?: string
          template_type?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          page_url: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          screenshot_url: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          id?: string
          page_url?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          page_url?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
        }
        Relationships: []
      }
      goto_admin_token: {
        Row: {
          access_token_enc: string
          expires_at: string | null
          id: number
          refresh_token_enc: string
          updated_at: string
        }
        Insert: {
          access_token_enc: string
          expires_at?: string | null
          id?: number
          refresh_token_enc: string
          updated_at?: string
        }
        Update: {
          access_token_enc?: string
          expires_at?: string | null
          id?: number
          refresh_token_enc?: string
          updated_at?: string
        }
        Relationships: []
      }
      goto_connections: {
        Row: {
          access_token_enc: string
          created_at: string
          expires_at: string | null
          goto_account_key: string | null
          goto_user_email: string | null
          id: string
          preferred_device_id: string | null
          refresh_token_enc: string
          scopes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc: string
          created_at?: string
          expires_at?: string | null
          goto_account_key?: string | null
          goto_user_email?: string | null
          id?: string
          preferred_device_id?: string | null
          refresh_token_enc: string
          scopes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string
          created_at?: string
          expires_at?: string | null
          goto_account_key?: string | null
          goto_user_email?: string | null
          id?: string
          preferred_device_id?: string | null
          refresh_token_enc?: string
          scopes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goto_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_tokens: {
        Row: {
          assigned_company_id: string | null
          assigned_team_member_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["intake_token_kind"]
          label: string
          last_used_at: string | null
          max_uses: number | null
          token_hash: string
          token_prefix: string
          use_count: number
        }
        Insert: {
          assigned_company_id?: string | null
          assigned_team_member_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["intake_token_kind"]
          label: string
          last_used_at?: string | null
          max_uses?: number | null
          token_hash: string
          token_prefix: string
          use_count?: number
        }
        Update: {
          assigned_company_id?: string | null
          assigned_team_member_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["intake_token_kind"]
          label?: string
          last_used_at?: string | null
          max_uses?: number | null
          token_hash?: string
          token_prefix?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "intake_tokens_assigned_broker_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_tokens_assigned_company_id_fkey"
            columns: ["assigned_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          name: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          id: string
          link: string | null
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          is_active: boolean
          is_remote: boolean
          last_active_at: string | null
          last_name: string | null
          office_location: string | null
          phone: string | null
          preferences: Json
          role: Database["public"]["Enums"]["user_role"]
          team_member_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          is_remote?: boolean
          last_active_at?: string | null
          last_name?: string | null
          office_location?: string | null
          phone?: string | null
          preferences?: Json
          role?: Database["public"]["Enums"]["user_role"]
          team_member_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_remote?: boolean
          last_active_at?: string | null
          last_name?: string | null
          office_location?: string | null
          phone?: string | null
          preferences?: Json
          role?: Database["public"]["Enums"]["user_role"]
          team_member_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_broker_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          default_body: string | null
          default_due_offset: string | null
          default_priority: Database["public"]["Enums"]["task_priority"]
          default_title: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          task_type: Database["public"]["Enums"]["task_type"]
          trigger_on_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_body?: string | null
          default_due_offset?: string | null
          default_priority?: Database["public"]["Enums"]["task_priority"]
          default_title: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          task_type: Database["public"]["Enums"]["task_type"]
          trigger_on_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_body?: string | null
          default_due_offset?: string | null
          default_priority?: Database["public"]["Enums"]["task_priority"]
          default_title?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          task_type?: Database["public"]["Enums"]["task_type"]
          trigger_on_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_trigger_on_status_fkey"
            columns: ["trigger_on_status"]
            isOneToOne: false
            referencedRelation: "claim_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          claim_id: string
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          template_id: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          claim_id: string
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          claim_id?: string
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_financial_summary"
            referencedColumns: ["claim_id"]
          },
          {
            foreignKeyName: "tasks_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          brand: string | null
          created_at: string
          display_name: string | null
          email: string | null
          external_sales_tracker_id: string | null
          external_synced_at: string | null
          first_name: string
          id: string
          is_active: boolean
          job_title: string | null
          last_name: string
          notes: string | null
          office_location: string | null
          phone: string | null
          source: Database["public"]["Enums"]["team_member_source"]
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          external_sales_tracker_id?: string | null
          external_synced_at?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_name: string
          notes?: string | null
          office_location?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["team_member_source"]
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          external_sales_tracker_id?: string | null
          external_synced_at?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_name?: string
          notes?: string | null
          office_location?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["team_member_source"]
          updated_at?: string
        }
        Relationships: []
      }
      trailer_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
        }
        Relationships: []
      }
    }
    Views: {
      claim_financial_summary: {
        Row: {
          claim_id: string | null
          claim_number: string | null
          concession_total: number | null
          damage_claim_amount: number | null
          direct_payment_total: number | null
          outbound_total: number | null
          paid_total: number | null
          recovery_total: number | null
          transaction_count: number | null
          unpaid_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_see_claim: { Args: { target_claim_id: string }; Returns: boolean }
      can_write_claim: { Args: { target_claim_id: string }; Returns: boolean }
      current_user_broker_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_user_team_member_id: { Args: never; Returns: string }
      generate_claim_number: {
        Args: { opened_at_in?: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_manager: { Args: never; Returns: boolean }
      profile_role_unchanged: {
        Args: {
          new_role: Database["public"]["Enums"]["user_role"]
          target_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      audit_action:
        | "insert"
        | "update"
        | "delete"
        | "status_change"
        | "hold_requested"
        | "hold_approved"
        | "hold_released"
        | "document_uploaded"
        | "correspondence_logged"
        | "claim_closed"
        | "claim_reopened"
      carrier_hold_status:
        | "requested"
        | "approved"
        | "active"
        | "released"
        | "denied_approval"
      carrier_hold_type:
        | "do_not_pay"
        | "payment_hold"
        | "dispatch_hold"
        | "monitoring_only"
      carrier_verification_source:
        | "descartes_mcp"
        | "mycarrierpackets"
        | "central_dispatch"
        | "manual"
      carrier_verification_status:
        | "pending"
        | "verified"
        | "flagged"
        | "expired"
        | "failed"
      claim_filing_status:
        | "not_filed"
        | "filed_not_acknowledged"
        | "acknowledged"
        | "closed"
      claim_intake_source:
        | "web_form"
        | "branded_link"
        | "api"
        | "email"
        | "phone"
        | "freightclaims_legacy"
        | "manual"
      claim_party_role:
        | "shipper"
        | "customer"
        | "consignee"
        | "carrier"
        | "factoring"
        | "accounts_payable"
        | "insurer"
        | "broker_of_record"
      claim_resolution:
        | "paid_full"
        | "paid_partial"
        | "denied"
        | "withdrawn"
        | "recovered"
        | "concession"
      claim_transaction_type:
        | "inbound_payment"
        | "outbound_payment"
        | "concession"
        | "adjustment"
        | "recovery"
        | "direct_payment"
      claim_type:
        | "cargo_damage"
        | "concealed_damage"
        | "cargo_shortage"
        | "cargo_loss"
        | "cargo_theft"
        | "refused_shipment"
        | "wrong_delivery"
        | "late_delivery"
        | "service_failure"
        | "overage"
        | "temperature_excursion"
        | "contamination"
        | "billing_dispute"
        | "other"
      claim_value_bucket: "current" | "credit_high_value" | "legal"
      company_kind:
        | "shipper"
        | "carrier"
        | "factoring"
        | "accounts_payable"
        | "insurer"
        | "broker_agency"
        | "other"
      correspondence_channel:
        | "phone"
        | "email"
        | "sms"
        | "letter"
        | "in_person"
        | "system"
      correspondence_direction: "inbound" | "outbound" | "internal"
      document_source:
        | "intake_form"
        | "email_attachment"
        | "manual_upload"
        | "goto_recording"
        | "ai_generated"
        | "system"
      document_type:
        | "bill_of_lading"
        | "proof_of_delivery"
        | "damage_photo"
        | "pickup_photo"
        | "delivery_photo"
        | "video"
        | "repair_estimate"
        | "replacement_invoice"
        | "witness_statement"
        | "presentation_of_loss"
        | "release"
        | "settlement_agreement"
        | "payment_confirmation"
        | "insurance_doc"
        | "claim_form"
        | "correspondence_attachment"
        | "other"
        | "ownership_form"
        | "police_report"
        | "short_pay_notice"
        | "non_pay_notice"
      intake_submission_status:
        | "pending_review"
        | "promoted"
        | "rejected"
        | "duplicate"
      intake_token_kind: "branded_link" | "api"
      payment_source:
        | "carrier"
        | "insurance"
        | "nts"
        | "broker"
        | "shipper"
        | "customer"
        | "factoring"
        | "unknown"
        | "other"
      task_priority: "low" | "normal" | "high" | "critical"
      task_status:
        | "open"
        | "in_progress"
        | "blocked"
        | "completed"
        | "cancelled"
      task_type:
        | "send_acknowledgment"
        | "request_bol"
        | "request_pod"
        | "request_photos"
        | "request_repair_estimate"
        | "request_presentation_of_loss"
        | "request_witness_statement"
        | "follow_up_shipper"
        | "follow_up_customer"
        | "follow_up_carrier"
        | "follow_up_factoring"
        | "follow_up_accounts_payable"
        | "follow_up_insurer"
        | "internal_review"
        | "manager_approval"
        | "place_carrier_hold"
        | "release_carrier_hold"
        | "prepare_settlement"
        | "close_claim"
        | "other"
      team_member_source:
        | "manual"
        | "csv_import"
        | "sales_tracker_sync"
        | "sso_provisioned"
      user_role: "admin" | "manager" | "claims_staff" | "broker"
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
      audit_action: [
        "insert",
        "update",
        "delete",
        "status_change",
        "hold_requested",
        "hold_approved",
        "hold_released",
        "document_uploaded",
        "correspondence_logged",
        "claim_closed",
        "claim_reopened",
      ],
      carrier_hold_status: [
        "requested",
        "approved",
        "active",
        "released",
        "denied_approval",
      ],
      carrier_hold_type: [
        "do_not_pay",
        "payment_hold",
        "dispatch_hold",
        "monitoring_only",
      ],
      carrier_verification_source: [
        "descartes_mcp",
        "mycarrierpackets",
        "central_dispatch",
        "manual",
      ],
      carrier_verification_status: [
        "pending",
        "verified",
        "flagged",
        "expired",
        "failed",
      ],
      claim_filing_status: [
        "not_filed",
        "filed_not_acknowledged",
        "acknowledged",
        "closed",
      ],
      claim_intake_source: [
        "web_form",
        "branded_link",
        "api",
        "email",
        "phone",
        "freightclaims_legacy",
        "manual",
      ],
      claim_party_role: [
        "shipper",
        "customer",
        "consignee",
        "carrier",
        "factoring",
        "accounts_payable",
        "insurer",
        "broker_of_record",
      ],
      claim_resolution: [
        "paid_full",
        "paid_partial",
        "denied",
        "withdrawn",
        "recovered",
        "concession",
      ],
      claim_transaction_type: [
        "inbound_payment",
        "outbound_payment",
        "concession",
        "adjustment",
        "recovery",
        "direct_payment",
      ],
      claim_type: [
        "cargo_damage",
        "concealed_damage",
        "cargo_shortage",
        "cargo_loss",
        "cargo_theft",
        "refused_shipment",
        "wrong_delivery",
        "late_delivery",
        "service_failure",
        "overage",
        "temperature_excursion",
        "contamination",
        "billing_dispute",
        "other",
      ],
      claim_value_bucket: ["current", "credit_high_value", "legal"],
      company_kind: [
        "shipper",
        "carrier",
        "factoring",
        "accounts_payable",
        "insurer",
        "broker_agency",
        "other",
      ],
      correspondence_channel: [
        "phone",
        "email",
        "sms",
        "letter",
        "in_person",
        "system",
      ],
      correspondence_direction: ["inbound", "outbound", "internal"],
      document_source: [
        "intake_form",
        "email_attachment",
        "manual_upload",
        "goto_recording",
        "ai_generated",
        "system",
      ],
      document_type: [
        "bill_of_lading",
        "proof_of_delivery",
        "damage_photo",
        "pickup_photo",
        "delivery_photo",
        "video",
        "repair_estimate",
        "replacement_invoice",
        "witness_statement",
        "presentation_of_loss",
        "release",
        "settlement_agreement",
        "payment_confirmation",
        "insurance_doc",
        "claim_form",
        "correspondence_attachment",
        "other",
        "ownership_form",
        "police_report",
        "short_pay_notice",
        "non_pay_notice",
      ],
      intake_submission_status: [
        "pending_review",
        "promoted",
        "rejected",
        "duplicate",
      ],
      intake_token_kind: ["branded_link", "api"],
      payment_source: [
        "carrier",
        "insurance",
        "nts",
        "broker",
        "shipper",
        "customer",
        "factoring",
        "unknown",
        "other",
      ],
      task_priority: ["low", "normal", "high", "critical"],
      task_status: ["open", "in_progress", "blocked", "completed", "cancelled"],
      task_type: [
        "send_acknowledgment",
        "request_bol",
        "request_pod",
        "request_photos",
        "request_repair_estimate",
        "request_presentation_of_loss",
        "request_witness_statement",
        "follow_up_shipper",
        "follow_up_customer",
        "follow_up_carrier",
        "follow_up_factoring",
        "follow_up_accounts_payable",
        "follow_up_insurer",
        "internal_review",
        "manager_approval",
        "place_carrier_hold",
        "release_carrier_hold",
        "prepare_settlement",
        "close_claim",
        "other",
      ],
      team_member_source: [
        "manual",
        "csv_import",
        "sales_tracker_sync",
        "sso_provisioned",
      ],
      user_role: ["admin", "manager", "claims_staff", "broker"],
    },
  },
} as const
