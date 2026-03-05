export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          direct_key: string | null
          id: string
          kind: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direct_key?: string | null
          id?: string
          kind: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direct_key?: string | null
          id?: string
          kind?: string
        }
        Relationships: []
      }
      course_offerings: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          instructor: string | null
          language: string | null
          note: string | null
          section: string | null
          syllabus_url: string | null
          term_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          instructor?: string | null
          language?: string | null
          note?: string | null
          section?: string | null
          syllabus_url?: string | null
          term_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instructor?: string | null
          language?: string | null
          note?: string | null
          section?: string | null
          syllabus_url?: string | null
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_offerings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_offerings_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          course_code: string | null
          created_at: string
          created_by: string | null
          credits: number | null
          description: string | null
          id: string
          name: string
          university_id: string
          updated_at: string
        }
        Insert: {
          course_code?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number | null
          description?: string | null
          id?: string
          name: string
          university_id: string
          updated_at?: string
        }
        Update: {
          course_code?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number | null
          description?: string | null
          id?: string
          name?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          offering_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
          visibility: Database["public"]["Enums"]["enrollment_visibility"]
        }
        Insert: {
          created_at?: string
          offering_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
          visibility?: Database["public"]["Enums"]["enrollment_visibility"]
        }
        Update: {
          created_at?: string
          offering_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id?: string
          visibility?: Database["public"]["Enums"]["enrollment_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          description: string | null
          key: string
        }
        Insert: {
          description?: string | null
          key: string
        }
        Update: {
          description?: string | null
          key?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      note_assets: {
        Row: {
          bytes: number | null
          created_at: string
          id: string
          mime: string | null
          note_id: string
          storage_path: string
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          id?: string
          mime?: string | null
          note_id: string
          storage_path: string
        }
        Update: {
          bytes?: number | null
          created_at?: string
          id?: string
          mime?: string | null
          note_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_assets_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          note_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          note_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_comments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_reactions: {
        Row: {
          created_at: string
          kind: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kind?: string
          note_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_reactions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          body_md: string | null
          created_at: string
          deleted_at: string | null
          id: string
          offering_id: string
          search_tsv: unknown
          tags: string[]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["note_visibility"]
          week: number | null
        }
        Insert: {
          author_id: string
          body_md?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          offering_id: string
          search_tsv?: unknown
          tags?: string[]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
          week?: number | null
        }
        Update: {
          author_id?: string
          body_md?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          offering_id?: string
          search_tsv?: unknown
          tags?: string[]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      offering_slots: {
        Row: {
          campus: string | null
          created_at: string
          day_of_week: number | null
          end_time: string | null
          id: string
          offering_id: string
          period: number | null
          room: string | null
          start_time: string | null
        }
        Insert: {
          campus?: string | null
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          offering_id: string
          period?: number | null
          room?: string | null
          start_time?: string | null
        }
        Update: {
          campus?: string | null
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          offering_id?: string
          period?: number | null
          room?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offering_slots_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          created_at: string
          id: string
          viewed_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          viewed_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          viewed_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      profile_timetable_settings: {
        Row: {
          periods: Json
          preset_id: string | null
          updated_at: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          periods: Json
          preset_id?: string | null
          updated_at?: string
          user_id: string
          weekdays: number[]
        }
        Update: {
          periods?: Json
          preset_id?: string | null
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "profile_timetable_settings_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "timetable_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_dm: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          department: string | null
          display_name: string
          dm_scope: Database["public"]["Enums"]["dm_scope"]
          enrollment_visibility_default: Database["public"]["Enums"]["enrollment_visibility"]
          faculty: string | null
          gender: Database["public"]["Enums"]["gender"]
          grade_year: number | null
          handle: string | null
          university_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_dm?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          display_name: string
          dm_scope?: Database["public"]["Enums"]["dm_scope"]
          enrollment_visibility_default?: Database["public"]["Enums"]["enrollment_visibility"]
          faculty?: string | null
          gender?: Database["public"]["Enums"]["gender"]
          grade_year?: number | null
          handle?: string | null
          university_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_dm?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          display_name?: string
          dm_scope?: Database["public"]["Enums"]["dm_scope"]
          enrollment_visibility_default?: Database["public"]["Enums"]["enrollment_visibility"]
          faculty?: string | null
          gender?: Database["public"]["Enums"]["gender"]
          grade_year?: number | null
          handle?: string | null
          university_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
        }
        Relationships: []
      }
      reviews: {
        Row: {
          attendance: Database["public"]["Enums"]["review_attendance"]
          author_id: string
          comment: string | null
          content: Database["public"]["Enums"]["review_content"]
          created_at: string
          deleted_at: string | null
          difficulty: Database["public"]["Enums"]["review_difficulty"]
          grading: Database["public"]["Enums"]["review_grading"]
          id: string
          offering_id: string
          rating_overall: number
          updated_at: string
        }
        Insert: {
          attendance?: Database["public"]["Enums"]["review_attendance"]
          author_id: string
          comment?: string | null
          content?: Database["public"]["Enums"]["review_content"]
          created_at?: string
          deleted_at?: string | null
          difficulty?: Database["public"]["Enums"]["review_difficulty"]
          grading?: Database["public"]["Enums"]["review_grading"]
          id?: string
          offering_id: string
          rating_overall: number
          updated_at?: string
        }
        Update: {
          attendance?: Database["public"]["Enums"]["review_attendance"]
          author_id?: string
          comment?: string | null
          content?: Database["public"]["Enums"]["review_content"]
          created_at?: string
          deleted_at?: string | null
          difficulty?: Database["public"]["Enums"]["review_difficulty"]
          grading?: Database["public"]["Enums"]["review_grading"]
          id?: string
          offering_id?: string
          rating_overall?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          provider: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      timetable_presets: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          periods: Json
          university_id: string | null
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          periods: Json
          university_id?: string | null
          updated_at?: string
          weekdays: number[]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          periods?: Json
          university_id?: string | null
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "timetable_presets_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          season: Database["public"]["Enums"]["term_season"]
          start_date: string | null
          university_id: string
          year: number
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          season: Database["public"]["Enums"]["term_season"]
          start_date?: string | null
          university_id: string
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          season?: Database["public"]["Enums"]["term_season"]
          start_date?: string | null
          university_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "terms_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          active: boolean
          created_at: string
          entitlement_key: string
          expires_at: string | null
          granted_by: string | null
          source: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          entitlement_key: string
          expires_at?: string | null
          granted_by?: string | null
          source?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          entitlement_key?: string
          expires_at?: string | null
          granted_by?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlements_entitlement_key_fkey"
            columns: ["entitlement_key"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["key"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          contributions_count: number | null
          last_contribution_at: string | null
          notes_count: number
          reviews_count: number
          user_id: string
        }
        Insert: {
          contributions_count?: number | null
          last_contribution_at?: string | null
          notes_count?: number
          reviews_count?: number
          user_id: string
        }
        Update: {
          contributions_count?: number | null
          last_contribution_at?: string | null
          notes_count?: number
          reviews_count?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_dm: {
        Args: { _recipient: string; _sender: string }
        Returns: boolean
      }
      can_send_message: { Args: { _uid: string }; Returns: boolean }
      can_view_footprints: { Args: { _uid: string }; Returns: boolean }
      can_view_note: {
        Args: {
          _note: Database["public"]["Tables"]["notes"]["Row"]
          _uid: string
        }
        Returns: boolean
      }
      can_view_review: {
        Args: {
          _review: Database["public"]["Tables"]["reviews"]["Row"]
          _uid: string
        }
        Returns: boolean
      }
      connection_accepted: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      create_direct_conversation: {
        Args: { _other_user_id: string }
        Returns: string
      }
      find_match_candidates: {
        Args: { _limit?: number; _min_shared?: number }
        Returns: {
          avatar_url: string
          department: string
          display_name: string
          faculty: string
          matched_user_id: string
          shared_offering_count: number
        }[]
      }
      has_active_entitlement: {
        Args: { _key: string; _uid: string }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_enrolled: {
        Args: { _offering_id: string; _uid: string }
        Returns: boolean
      }
      shared_offering_count: {
        Args: { _a: string; _b: string }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      user_stats_apply_delta: {
        Args: { _notes_delta: number; _reviews_delta: number; _uid: string }
        Returns: undefined
      }
      user_university_id: { Args: { _uid: string }; Returns: string }
      update_visibility_settings: {
        Args: {
          new_visibility: Database["public"]["Enums"]["enrollment_visibility"]
        }
        Returns: undefined
      }
    }
    Enums: {
      connection_status: "requested" | "accepted" | "rejected" | "blocked"
      dm_scope: "any" | "shared_offering" | "connections"
      enrollment_status: "enrolled" | "planned" | "dropped"
      enrollment_visibility: "private" | "match_only" | "public"
      gender: "male" | "female" | "other" | "unspecified"
      note_visibility: "public" | "university" | "offering_only" | "private"
      report_target_type: "user" | "note" | "review" | "message"
      review_attendance: "none" | "sometimes" | "often" | "always" | "unknown"
      review_content: "poor" | "ok" | "good" | "excellent" | "unknown"
      review_difficulty:
        | "very_easy"
        | "easy"
        | "normal"
        | "hard"
        | "very_hard"
        | "unknown"
      review_grading: "test_only" | "report_only" | "both" | "other" | "unknown"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "incomplete"
      term_season: "first_half" | "second_half"
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
      connection_status: ["requested", "accepted", "rejected", "blocked"],
      dm_scope: ["any", "shared_offering", "connections"],
      enrollment_status: ["enrolled", "planned", "dropped"],
      enrollment_visibility: ["private", "match_only", "public"],
      gender: ["male", "female", "other", "unspecified"],
      note_visibility: ["public", "university", "offering_only", "private"],
      report_target_type: ["user", "note", "review", "message"],
      review_attendance: ["none", "sometimes", "often", "always", "unknown"],
      review_content: ["poor", "ok", "good", "excellent", "unknown"],
      review_difficulty: [
        "very_easy",
        "easy",
        "normal",
        "hard",
        "very_hard",
        "unknown",
      ],
      review_grading: ["test_only", "report_only", "both", "other", "unknown"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "incomplete",
      ],
      term_season: ["first_half", "second_half"],
    },
  },
} as const
