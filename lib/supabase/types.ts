// Hand-written Database types mirroring the Supabase schema
// (`supabase/migrations/0001_init.sql` / frontend-integration.md §3).
//
// Regenerate with:
//   npx supabase gen types typescript --project-id <ref> --schema public > lib/supabase/types.ts
// once the `supabase` CLI is wired up. Must stay structurally compatible
// with supabase-js' GenericSchema: Tables/Views/Functions are Record<...>
// with Row/Insert/Update/Relationships keys on table entries.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DocumentStatus =
  | "uploaded"
  | "processing"
  | "processed"
  | "failed"
  | "duplicate";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type DocType =
  | "fuel"
  | "electricity"
  | "refrigerant"
  | "work_hours"
  | null;

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          company_id: string;
          reporting_year: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          company_id: string;
          reporting_year: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          company_id?: string;
          reporting_year?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          project_id: string;
          storage_path: string;
          filename: string;
          content_hash: string | null;
          doc_type: DocType;
          file_size_bytes: number | null;
          status: DocumentStatus;
          warnings: Json | null;
          uploaded_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          storage_path: string;
          filename: string;
          content_hash?: string | null;
          doc_type?: DocType;
          file_size_bytes?: number | null;
          status?: DocumentStatus;
          warnings?: Json | null;
          uploaded_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          storage_path?: string;
          filename?: string;
          content_hash?: string | null;
          doc_type?: DocType;
          file_size_bytes?: number | null;
          status?: DocumentStatus;
          warnings?: Json | null;
          uploaded_at?: string;
          processed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          id: string;
          project_id: string;
          status: JobStatus;
          progress: Json | null;
          warnings: Json | null;
          error: string | null;
          document_ids: string[];
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          status?: JobStatus;
          progress?: Json | null;
          warnings?: Json | null;
          error?: string | null;
          document_ids: string[];
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          status?: JobStatus;
          progress?: Json | null;
          warnings?: Json | null;
          error?: string | null;
          document_ids?: string[];
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      records: {
        Row: {
          id: string;
          project_id: string;
          job_id: string;
          document_id: string;
          source_type: string;
          file_hash: string;
          period_start: string;
          period_end: string;
          status: string;
          record_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          job_id: string;
          document_id: string;
          source_type: string;
          file_hash: string;
          period_start: string;
          period_end: string;
          status: string;
          record_json: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          job_id?: string;
          document_id?: string;
          source_type?: string;
          file_hash?: string;
          period_start?: string;
          period_end?: string;
          status?: string;
          record_json?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      emission_results: {
        Row: {
          id: string;
          record_id: string;
          project_id: string;
          year: number;
          scope: string;
          gas: string | null;
          facility_id: string | null;
          facility_name: string | null;
          source_code: string | null;
          activity_value: number | null;
          activity_unit: string | null;
          emissions_kgco2e: number | null;
          emissions_tco2e: number | null;
          period_start: string | null;
          period_end: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          record_id: string;
          project_id: string;
          year: number;
          scope: string;
          gas?: string | null;
          facility_id?: string | null;
          facility_name?: string | null;
          source_code?: string | null;
          activity_value?: number | null;
          activity_unit?: string | null;
          emissions_kgco2e?: number | null;
          emissions_tco2e?: number | null;
          period_start?: string | null;
          period_end?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          record_id?: string;
          project_id?: string;
          year?: number;
          scope?: string;
          gas?: string | null;
          facility_id?: string | null;
          facility_name?: string | null;
          source_code?: string | null;
          activity_value?: number | null;
          activity_unit?: string | null;
          emissions_kgco2e?: number | null;
          emissions_tco2e?: number | null;
          period_start?: string | null;
          period_end?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      graphs: {
        Row: {
          project_id: string;
          job_id: string;
          graph_json: Json;
          built_at: string;
        };
        Insert: {
          project_id: string;
          job_id: string;
          graph_json: Json;
          built_at?: string;
        };
        Update: {
          project_id?: string;
          job_id?: string;
          graph_json?: Json;
          built_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      document_status: DocumentStatus;
      job_status: JobStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
