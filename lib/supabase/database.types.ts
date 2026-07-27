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
      admin_users: {
        Row: {
          email: string
          id: string
          name: string
        }
        Insert: {
          email: string
          id: string
          name: string
        }
        Update: {
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      app_error_log: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          area: string
          client_id: string | null
          context: Json
          digest: string | null
          environment: string | null
          error_name: string | null
          fingerprint: string
          id: string
          message: string
          occurred_at: string
          release: string | null
          request_id: string | null
          request_method: string | null
          request_path: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          route_path: string | null
          severity: string
          source: string
          stack: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          area: string
          client_id?: string | null
          context?: Json
          digest?: string | null
          environment?: string | null
          error_name?: string | null
          fingerprint: string
          id?: string
          message: string
          occurred_at?: string
          release?: string | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          route_path?: string | null
          severity?: string
          source: string
          stack?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          area?: string
          client_id?: string | null
          context?: Json
          digest?: string | null
          environment?: string | null
          error_name?: string | null
          fingerprint?: string
          id?: string
          message?: string
          occurred_at?: string
          release?: string | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          route_path?: string | null
          severity?: string
          source?: string
          stack?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          branding_primary: string
          branding_secondary: string
          credits_per_hour: number
          expiry_reminders_enabled: boolean
          id: number
          logo_path: string | null
          notify_on_upload: boolean
          paypal_client_id_hint: string | null
          paypal_config_version: number | null
          paypal_credentials_updated_at: string | null
          paypal_enabled: boolean
          paypal_mode: string
          paypal_verified_at: string | null
          sender_name: string
          sign_off_name: string
          updated_at: string
        }
        Insert: {
          branding_primary?: string
          branding_secondary?: string
          credits_per_hour?: number
          expiry_reminders_enabled?: boolean
          id?: number
          logo_path?: string | null
          notify_on_upload?: boolean
          paypal_client_id_hint?: string | null
          paypal_config_version?: number | null
          paypal_credentials_updated_at?: string | null
          paypal_enabled?: boolean
          paypal_mode?: string
          paypal_verified_at?: string | null
          sender_name?: string
          sign_off_name?: string
          updated_at?: string
        }
        Update: {
          branding_primary?: string
          branding_secondary?: string
          credits_per_hour?: number
          expiry_reminders_enabled?: boolean
          id?: number
          logo_path?: string | null
          notify_on_upload?: boolean
          paypal_client_id_hint?: string | null
          paypal_config_version?: number | null
          paypal_credentials_updated_at?: string | null
          paypal_enabled?: boolean
          paypal_mode?: string
          paypal_verified_at?: string | null
          sender_name?: string
          sign_off_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_paypal_config_version_fkey"
            columns: ["paypal_config_version"]
            isOneToOne: false
            referencedRelation: "paypal_runtime_credential_versions"
            referencedColumns: ["config_version"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          id: string
          name: string
          role?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          hours_balance: number
          id: string
          name: string
          site_address: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          hours_balance?: number
          id?: string
          name: string
          site_address?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          hours_balance?: number
          id?: string
          name?: string
          site_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contractors: {
        Row: {
          active: boolean
          address: string | null
          category: string
          company_name: string
          contact_name: string
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          notes: string | null
          phone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          category: string
          company_name: string
          contact_name: string
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: string
          notes?: string | null
          phone: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          category?: string
          company_name?: string
          contact_name?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          active: boolean
          client_id: string
          deleted_at: string | null
          document_category: string
          expiry_date: string | null
          file_size_bytes: number | null
          filename: string
          id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          active?: boolean
          client_id: string
          deleted_at?: string | null
          document_category: string
          expiry_date?: string | null
          file_size_bytes?: number | null
          filename: string
          id?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          active?: boolean
          client_id?: string
          deleted_at?: string | null
          document_category?: string
          expiry_date?: string | null
          file_size_bytes?: number | null
          filename?: string
          id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempt_count: number
          client_id: string | null
          created_at: string
          first_attempt_at: string | null
          id: string
          idempotency_key: string | null
          last_attempt_at: string | null
          last_error: string | null
          last_error_kind: string | null
          max_attempts: number
          notification_type: string
          payload: Json
          provider: string
          provider_message_id: string | null
          recipient: string | null
          related_id: string | null
          related_type: string | null
          resend_allowed: boolean
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          client_id?: string | null
          created_at?: string
          first_attempt_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          last_error_kind?: string | null
          max_attempts?: number
          notification_type: string
          payload?: Json
          provider?: string
          provider_message_id?: string | null
          recipient?: string | null
          related_id?: string | null
          related_type?: string | null
          resend_allowed?: boolean
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          client_id?: string | null
          created_at?: string
          first_attempt_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          last_error_kind?: string | null
          max_attempts?: number
          notification_type?: string
          payload?: Json
          provider?: string
          provider_message_id?: string | null
          recipient?: string | null
          related_id?: string | null
          related_type?: string | null
          resend_allowed?: boolean
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      field_media: {
        Row: {
          created_at: string
          deleted_at: string | null
          field_id: string
          id: string
          media_type: string
          storage_path: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          field_id: string
          id?: string
          media_type: string
          storage_path: string
          submission_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          field_id?: string
          id?: string
          media_type?: string
          storage_path?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_media_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_assignments: {
        Row: {
          assigned_by: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          due_date: string | null
          id: string
          instructions: string | null
          last_reminder_sent: string | null
          recurrence_generated_at: string | null
          recurrence_rule: Json | null
          status: string
          template_id: string
          template_version_id: string
        }
        Insert: {
          assigned_by?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          last_reminder_sent?: string | null
          recurrence_generated_at?: string | null
          recurrence_rule?: Json | null
          status?: string
          template_id: string
          template_version_id: string
        }
        Update: {
          assigned_by?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          last_reminder_sent?: string | null
          recurrence_generated_at?: string | null
          recurrence_rule?: Json | null
          status?: string
          template_id?: string
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          answers_json: Json
          assignment_id: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          draft_report_json: Json | null
          id: string
          report_storage_path: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          template_version_id: string
        }
        Insert: {
          answers_json: Json
          assignment_id?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          draft_report_json?: Json | null
          id?: string
          report_storage_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          template_version_id: string
        }
        Update: {
          answers_json?: Json
          assignment_id?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          draft_report_json?: Json | null
          id?: string
          report_storage_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "form_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_published: boolean | null
          name: string
          owner_id: string | null
          owner_type: string | null
          parent_template_id: string | null
          template_type: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_published?: boolean | null
          name: string
          owner_id?: string | null
          owner_type?: string | null
          parent_template_id?: string | null
          template_type: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_published?: boolean | null
          name?: string
          owner_id?: string | null
          owner_type?: string | null
          parent_template_id?: string | null
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hours_transactions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          gbp_amount: number | null
          hours_amount: number
          id: string
          notes: string | null
          paypal_order_id: string | null
          transaction_type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          gbp_amount?: number | null
          hours_amount: number
          id?: string
          notes?: string | null
          paypal_order_id?: string | null
          transaction_type: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          gbp_amount?: number | null
          hours_amount?: number
          id?: string
          notes?: string | null
          paypal_order_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hours_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_sent: {
        Row: {
          alert_window: number | null
          client_id: string
          document_id: string | null
          id: string
          notification_type: string
          sent_at: string
        }
        Insert: {
          alert_window?: number | null
          client_id: string
          document_id?: string | null
          id?: string
          notification_type: string
          sent_at?: string
        }
        Update: {
          alert_window?: number | null
          client_id?: string
          document_id?: string | null
          id?: string
          notification_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_sent_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sent_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      paypal_pending_checkouts: {
        Row: {
          client_id: string
          config_version: number
          created_at: string
          credited_at: string | null
          order_id: string
          package_id: string
          paypal_mode: string
        }
        Insert: {
          client_id: string
          config_version: number
          created_at?: string
          credited_at?: string | null
          order_id: string
          package_id: string
          paypal_mode: string
        }
        Update: {
          client_id?: string
          config_version?: number
          created_at?: string
          credited_at?: string | null
          order_id?: string
          package_id?: string
          paypal_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "paypal_pending_checkouts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paypal_pending_checkouts_config_version_fkey"
            columns: ["config_version"]
            isOneToOne: false
            referencedRelation: "paypal_runtime_credential_versions"
            referencedColumns: ["config_version"]
          },
        ]
      }
      paypal_runtime_credential_versions: {
        Row: {
          config_version: number
          created_at: string
          paypal_mode: string
          vault_secret_name: string
        }
        Insert: {
          config_version: number
          created_at?: string
          paypal_mode: string
          vault_secret_name: string
        }
        Update: {
          config_version?: number
          created_at?: string
          paypal_mode?: string
          vault_secret_name?: string
        }
        Relationships: []
      }
      proposal_signatures: {
        Row: {
          created_at: string
          document_hash: string
          id: string
          ip_address: unknown
          proposal_id: string
          signature_image: string
          signed_at: string
          signer_email: string
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          document_hash: string
          id?: string
          ip_address: unknown
          proposal_id: string
          signature_image: string
          signed_at?: string
          signer_email: string
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          document_hash?: string
          id?: string
          ip_address?: unknown
          proposal_id?: string
          signature_image?: string
          signed_at?: string
          signer_email?: string
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_signatures_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_id: string
          contract_pdf_path: string | null
          created_at: string
          created_by: string | null
          id: string
          proposal_pdf_path: string | null
          sent_at: string | null
          services_json: Json
          signed_at: string | null
          signed_document_hash: string | null
          signed_pdf_path: string | null
          signing_document_hash: string | null
          signing_token: string | null
          signing_token_expires_at: string | null
          signing_token_used: boolean
          signwell_contract_doc_id: string | null
          signwell_proposal_doc_id: string | null
          status: string
          total_price: number | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          client_id: string
          contract_pdf_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          proposal_pdf_path?: string | null
          sent_at?: string | null
          services_json: Json
          signed_at?: string | null
          signed_document_hash?: string | null
          signed_pdf_path?: string | null
          signing_document_hash?: string | null
          signing_token?: string | null
          signing_token_expires_at?: string | null
          signing_token_used?: boolean
          signwell_contract_doc_id?: string | null
          signwell_proposal_doc_id?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          client_id?: string
          contract_pdf_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          proposal_pdf_path?: string | null
          sent_at?: string | null
          services_json?: Json
          signed_at?: string | null
          signed_document_hash?: string | null
          signed_pdf_path?: string | null
          signing_document_hash?: string | null
          signing_token?: string | null
          signing_token_expires_at?: string | null
          signing_token_used?: boolean
          signwell_contract_doc_id?: string | null
          signwell_proposal_doc_id?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_hits: {
        Row: {
          bucket_key: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          unit: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          unit?: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          unit?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      template_versions: {
        Row: {
          created_by: string | null
          id: string
          published_at: string | null
          schema_json: Json
          template_id: string
          version_number: number
        }
        Insert: {
          created_by?: string | null
          id?: string
          published_at?: string | null
          schema_json: Json
          template_id: string
          version_number: number
        }
        Update: {
          created_by?: string | null
          id?: string
          published_at?: string | null
          schema_json?: Json
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_errors: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_message: string
          id: string
          payload: Json | null
          resolved: boolean | null
          workflow_name: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_message: string
          id?: string
          payload?: Json | null
          resolved?: boolean | null
          workflow_name: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_message?: string
          id?: string
          payload?: Json | null
          resolved?: boolean | null
          workflow_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_client_credits: {
        Args: {
          p_adjustment: number
          p_client_id: string
          p_description: string
        }
        Returns: number
      }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      cleanup_app_error_log: {
        Args: {
          p_resolved_retention_days?: number
          p_unresolved_retention_days?: number
        }
        Returns: number
      }
      cleanup_email_outbox: {
        Args: {
          p_failed_retention_days?: number
          p_payload_retention_days?: number
          p_sent_retention_days?: number
        }
        Returns: number
      }
      cleanup_paypal_runtime_records: {
        Args: { p_retention_days?: number }
        Returns: {
          checkouts_deleted: number
          versions_deleted: number
        }[]
      }
      create_admin_template_with_initial_version: {
        Args: { p_name: string; p_template_type: string }
        Returns: string
      }
      create_customer_template_with_initial_version: {
        Args: { p_client_id: string; p_name: string }
        Returns: string
      }
      credit_hours_from_paypal: {
        Args: {
          p_client_id: string
          p_gbp: number
          p_hours: number
          p_order_id: string
        }
        Returns: undefined
      }
      get_paypal_checkout_runtime_config: {
        Args: { p_order_id: string }
        Returns: {
          config_version: number
          mapped: boolean
          paypal_client_id: string
          paypal_client_secret: string
          paypal_mode: string
          pending_client_id: string
          pending_package_id: string
        }[]
      }
      get_paypal_runtime_credentials: {
        Args: never
        Returns: {
          client_id: string
          client_secret: string
          configured: boolean
          enabled: boolean
          paypal_mode: string
          revision: string
        }[]
      }
      mark_paypal_pending_checkout_credited: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      record_paypal_pending_checkout: {
        Args: {
          p_client_id: string
          p_config_version: number
          p_order_id: string
          p_package_id: string
          p_paypal_mode: string
        }
        Returns: undefined
      }
      redeem_proposal_signature: {
        Args: {
          p_expected_document_hash: string
          p_expected_pdf_path: string
          p_ip_address: unknown
          p_signature_image: string
          p_signed_at: string
          p_signed_document_hash: string
          p_signed_pdf_path: string
          p_signer_email: string
          p_signer_name: string
          p_token_hash: string
          p_user_agent: string
        }
        Returns: {
          client_id: string
          proposal_id: string
          proposal_pdf_path: string
          services_json: Json
          signing_document_hash: string
        }[]
      }
      set_paypal_payments_enabled: {
        Args: { p_enabled: boolean }
        Returns: {
          client_id_hint: string
          enabled: boolean
          paypal_mode: string
          verified_at: string
        }[]
      }
      set_paypal_runtime_credentials: {
        Args: { p_client_id: string; p_client_secret: string; p_mode: string }
        Returns: {
          client_id_hint: string
          enabled: boolean
          paypal_mode: string
          verified_at: string
        }[]
      }
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
