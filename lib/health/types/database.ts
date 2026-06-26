// Hand-written to match supabase/schema.sql.
// Once you have the Supabase CLI set up you can replace this with:
//   npx supabase gen types typescript --project-id <id> > lib/health/types/database.ts

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          updated_at?: string;
        };
      };

      doses: {
        Row: {
          id: string;
          user_id: string;
          date: string;           // "YYYY-MM-DD"
          dose_mg: number;
          injection_site: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          dose_mg: number;
          injection_site?: string | null;
          notes?: string | null;
        };
        Update: {
          date?: string;
          dose_mg?: number;
          injection_site?: string | null;
          notes?: string | null;
        };
      };

      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          type: string;
          duration_min: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          type: string;
          duration_min?: number | null;
          notes?: string | null;
        };
        Update: {
          date?: string;
          type?: string;
          duration_min?: number | null;
          notes?: string | null;
        };
      };

      exercises: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          name: string;
          order_index: number;
          muscles: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          name: string;
          order_index?: number;
          muscles?: string[] | null;
        };
        Update: {
          name?: string;
          order_index?: number;
          muscles?: string[] | null;
        };
      };

      sets: {
        Row: {
          id: string;
          exercise_id: string;
          user_id: string;
          set_number: number;
          reps_actual: number | null;
          weight_actual: number | null;
          rpe: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exercise_id: string;
          user_id: string;
          set_number: number;
          reps_actual?: number | null;
          weight_actual?: number | null;
          rpe?: number | null;
          notes?: string | null;
        };
        Update: {
          reps_actual?: number | null;
          weight_actual?: number | null;
          rpe?: number | null;
          notes?: string | null;
        };
      };

      apple_health_metrics: {
        Row: {
          id: string;
          user_id: string;
          timestamp: string;
          metric_name: string;
          value: number;
          unit: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          timestamp: string;
          metric_name: string;
          value: number;
          unit: string;
          source?: string;
        };
        Update: {
          value?: number;
          unit?: string;
          source?: string;
        };
      };

      apple_health_workouts: {
        Row: {
          id: string;
          user_id: string;
          timestamp: string;
          workout_type: string;
          duration_sec: number | null;
          distance_m: number | null;
          calories: number | null;
          source: string | null;
          raw_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          timestamp: string;
          workout_type: string;
          duration_sec?: number | null;
          distance_m?: number | null;
          calories?: number | null;
          source?: string | null;
          raw_data?: Record<string, unknown> | null;
        };
        Update: {
          workout_type?: string;
          duration_sec?: number | null;
          distance_m?: number | null;
          calories?: number | null;
          source?: string | null;
          raw_data?: Record<string, unknown> | null;
        };
      };

      medications: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          dose: string;
          schedule: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          dose: string;
          schedule?: string;
          active?: boolean;
        };
        Update: {
          name?: string;
          dose?: string;
          schedule?: string;
          active?: boolean;
        };
      };

      withings_tokens: {
        Row: {
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scope: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scope?: string | null;
        };
        Update: {
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
          scope?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
