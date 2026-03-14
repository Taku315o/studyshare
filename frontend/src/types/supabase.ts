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
          canonical_url: string | null
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          instructor: string | null
          is_active: boolean
          language: string | null
          last_seen_at: string | null
          note: string | null
          section: string | null
          source_updated_at: string | null
          syllabus_url: string | null
          term_id: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          instructor?: string | null
          is_active?: boolean
          language?: string | null
          last_seen_at?: string | null
          note?: string | null
          section?: string | null
          source_updated_at?: string | null
          syllabus_url?: string | null
          term_id: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instructor?: string | null
          is_active?: boolean
          language?: string | null
          last_seen_at?: string | null
          note?: string | null
          section?: string | null
          source_updated_at?: string | null
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
      follows: {
        Row: {
          created_at: string
          follower_user_id: string
          following_user_id: string
        }
        Insert: {
          created_at?: string
          follower_user_id: string
          following_user_id: string
        }
        Update: {
          created_at?: string
          follower_user_id?: string
          following_user_id?: string
        }
        Relationships: []
      }
      import_runs: {
        Row: {
          created_at: string
          error_summary: Json
          finished_at: string | null
          id: string
          import_source_id: string
          scope_json: Json
          started_at: string
          stats_json: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_summary?: Json
          finished_at?: string | null
          id?: string
          import_source_id: string
          scope_json?: Json
          started_at?: string
          stats_json?: Json
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_summary?: Json
          finished_at?: string | null
          id?: string
          import_source_id?: string
          scope_json?: Json
          started_at?: string
          stats_json?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_import_source_id_fkey"
            columns: ["import_source_id"]
            isOneToOne: false
            referencedRelation: "import_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sources: {
        Row: {
          base_url: string
          created_at: string
          id: string
          is_active: boolean
          source_code: string
          university_id: string
          updated_at: string
        }
        Insert: {
          base_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          source_code: string
          university_id: string
          updated_at?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          source_code?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_sources_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
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
          parent_comment_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          note_id: string
          parent_comment_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          note_id?: string
          parent_comment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_comments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "note_comments"
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
      notifications: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          type: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id: string
          type: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string
          type?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          author_id: string
          body_md: string | null
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string | null
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
          image_url?: string | null
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
          image_url?: string | null
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
          raw_text: string | null
          room: string | null
          slot_kind: string
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
          raw_text?: string | null
          room?: string | null
          slot_kind?: string
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
          raw_text?: string | null
          room?: string | null
          slot_kind?: string
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
      question_answers: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          parent_answer_id: string | null
          question_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_answer_id?: string | null
          question_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_answer_id?: string | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_parent_answer_id_fkey"
            columns: ["parent_answer_id"]
            isOneToOne: false
            referencedRelation: "question_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          offering_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          offering_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          offering_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_catalog_items: {
        Row: {
          academic_year: number
          content_hash: string
          created_at: string
          external_id: string
          first_seen_at: string
          id: string
          import_source_id: string
          last_seen_at: string
          latest_run_id: string | null
          payload_json: Json
          source_updated_at: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          academic_year: number
          content_hash: string
          created_at?: string
          external_id: string
          first_seen_at?: string
          id?: string
          import_source_id: string
          last_seen_at?: string
          latest_run_id?: string | null
          payload_json: Json
          source_updated_at?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: number
          content_hash?: string
          created_at?: string
          external_id?: string
          first_seen_at?: string
          id?: string
          import_source_id?: string
          last_seen_at?: string
          latest_run_id?: string | null
          payload_json?: Json
          source_updated_at?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_catalog_items_import_source_id_fkey"
            columns: ["import_source_id"]
            isOneToOne: false
            referencedRelation: "import_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_catalog_items_latest_run_id_fkey"
            columns: ["latest_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
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
      source_mappings: {
        Row: {
          confidence: number
          created_at: string
          entity_id: string
          entity_type: string
          external_id: string
          external_source: string
          id: string
          mapping_type: string
          raw_item_id: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          entity_id: string
          entity_type: string
          external_id: string
          external_source: string
          id?: string
          mapping_type?: string
          raw_item_id?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          external_id?: string
          external_source?: string
          id?: string
          mapping_type?: string
          raw_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_mappings_raw_item_id_fkey"
            columns: ["raw_item_id"]
            isOneToOne: false
            referencedRelation: "raw_catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          academic_year: number
          code: string
          created_at: string
          display_name: string
          end_date: string | null
          id: string
          season: Database["public"]["Enums"]["term_season"]
          sort_key: number
          start_date: string | null
          university_id: string
          year: number
        }
        Insert: {
          academic_year: number
          code: string
          created_at?: string
          display_name: string
          end_date?: string | null
          id?: string
          season: Database["public"]["Enums"]["term_season"]
          sort_key: number
          start_date?: string | null
          university_id: string
          year: number
        }
        Update: {
          academic_year?: number
          code?: string
          created_at?: string
          display_name?: string
          end_date?: string | null
          id?: string
          season?: Database["public"]["Enums"]["term_season"]
          sort_key?: number
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
          followers_count: number
          following_count: number
          last_contribution_at: string | null
          notes_count: number
          reviews_count: number
          user_id: string
        }
        Insert: {
          contributions_count?: number | null
          followers_count?: number
          following_count?: number
          last_contribution_at?: string | null
          notes_count?: number
          reviews_count?: number
          user_id: string
        }
        Update: {
          contributions_count?: number | null
          followers_count?: number
          following_count?: number
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
      can_send_message_in_conversation: {
        Args: { _conversation_id: string; _uid: string }
        Returns: boolean
      }
      can_view_footprints: { Args: { _uid: string }; Returns: boolean }
      can_view_note: {
        Args: {
          _note: Database["public"]["Tables"]["notes"]["Row"]
          _uid: string
        }
        Returns: boolean
      }
      can_view_question: {
        Args: {
          _question: Database["public"]["Tables"]["questions"]["Row"]
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
      follow_user: {
        Args: { _following_user_id: string }
        Returns: {
          followers_count: number
          following_count: number
          is_following: boolean
        }[]
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
      get_follow_summary: {
        Args: { _target_user_id: string }
        Returns: {
          followers_count: number
          following_count: number
          is_following: boolean
        }[]
      }
      has_active_entitlement: {
        Args: { _key: string; _uid: string }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_conversation_member: {
        Args: { _conversation_id: string; _uid: string }
        Returns: boolean
      }
      is_current_conversation_member: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      is_enrolled: {
        Args: { _offering_id: string; _uid: string }
        Returns: boolean
      }
      list_follow_profiles: {
        Args: {
          _direction: string
          _limit?: number
          _offset?: number
          _target_user_id: string
        }
        Returns: {
          avatar_url: string | null
          department: string | null
          display_name: string
          faculty: string | null
          followed_at: string
          grade_year: number | null
          university_name: string | null
          user_id: string
        }[]
      }
      is_valid_note_comment_parent: {
        Args: { _note_id: string; _parent_comment_id: string }
        Returns: boolean
      }
      is_valid_question_answer_parent: {
        Args: { _parent_answer_id: string; _question_id: string }
        Returns: boolean
      }
      is_valid_timetable_periods: { Args: { _periods: Json }; Returns: boolean }
      is_valid_timetable_weekdays: {
        Args: { _weekdays: number[] }
        Returns: boolean
      }
      offering_enrollment_count: {
        Args: { _offering_id: string }
        Returns: number
      }
      create_offering_and_enroll: {
        Args: {
          _confirm_distinct?: boolean
          _course_code?: string | null
          _course_title: string
          _day_of_week?: number | null
          _instructor?: string | null
          _period?: number | null
          _room?: string | null
          _term_id: string
        }
        Returns: {
          day_of_week: number | null
          offering_id: string
          period: number | null
          status: Database["public"]["Enums"]["enrollment_status"]
        }[]
      }
      offering_review_stats: {
        Args: { _offering_id: string }
        Returns: {
          avg_rating: number
          rating_1_count: number
          rating_2_count: number
          rating_3_count: number
          rating_4_count: number
          rating_5_count: number
          review_count: number
        }[]
      }
      shared_offering_count: {
        Args: { _a: string; _b: string }
        Returns: number
      }
      search_timetable_offerings: {
        Args: {
          _day_of_week?: number | null
          _limit?: number
          _offset?: number
          _period?: number | null
          _query?: string | null
          _term_id: string
        }
        Returns: {
          course_code: string | null
          course_title: string | null
          created_at: string
          enrollment_count: number
          instructor: string | null
          my_status: Database["public"]["Enums"]["enrollment_status"] | null
          offering_id: string
          room: string | null
          slot_details: Json
          slot_labels: string[] | null
          slot_match: boolean
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      suggest_offering_duplicates: {
        Args: {
          _course_title: string
          _day_of_week?: number | null
          _instructor?: string | null
          _limit?: number
          _period?: number | null
          _term_id: string
        }
        Returns: {
          candidate_kind: string | null
          course_code: string | null
          course_title: string | null
          created_at: string
          enrollment_count: number
          instructor: string | null
          my_status: Database["public"]["Enums"]["enrollment_status"] | null
          offering_id: string
          reasons: string[] | null
          room: string | null
          slot_details: Json
          slot_labels: string[] | null
          slot_match: boolean
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      unfollow_user: {
        Args: { _following_user_id: string }
        Returns: {
          followers_count: number
          following_count: number
          is_following: boolean
        }[]
      }
      user_stats_apply_delta: {
        Args: { _notes_delta: number; _reviews_delta: number; _uid: string }
        Returns: undefined
      }
      user_stats_apply_follow_delta: {
        Args: {
          _followers_delta: number
          _following_delta: number
          _uid: string
        }
        Returns: undefined
      }
      user_university_id: { Args: { _uid: string }; Returns: string }
      upsert_enrollment: {
        Args: {
          _offering_id: string
          _status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Returns: {
          offering_id: string
          previous_status: Database["public"]["Enums"]["enrollment_status"] | null
          status: Database["public"]["Enums"]["enrollment_status"]
          visibility: Database["public"]["Enums"]["enrollment_visibility"]
          was_inserted: boolean
        }[]
      }
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
      term_season:
        | "first_half"
        | "second_half"
        | "quarter_1"
        | "quarter_2"
        | "quarter_3"
        | "quarter_4"
        | "full_year"
        | "intensive"
        | "other"
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
      term_season: [
        "first_half",
        "second_half",
        "quarter_1",
        "quarter_2",
        "quarter_3",
        "quarter_4",
        "full_year",
        "intensive",
        "other",
      ],
    },
  },
} as const
