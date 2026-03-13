## 2026-03-13 Migration Cleanup

This archive note tracks fix-only migrations that were folded into earlier
feature migrations during the pre-release migration cleanup.

Absorbed into `supabase/migrations/20260223120000_relax_dm_gate_for_mvp.sql`:
- `20260224130000_fix_conversation_members_policy_recursion.sql`
- `20260226110000_harden_conversation_membership_helper.sql`

Absorbed into `supabase/migrations/20260302110000_add_note_comment_threading_and_question_answers.sql`:
- `20260303103000_fix_thread_policy_recursion.sql`

Absorbed into `supabase/migrations/20260307113000_add_timetable_add_flow_rpcs.sql`:
- `20260308172403_fix_upsert_enrollment_ambiguity.sql`
- `20260308183217_fix_upsert_enrollment_conflict_target.sql`

These files were removed from the active migration chain to keep the chain
feature-oriented instead of fix-on-fix oriented. Existing databases should be
rebaselined before trusting the edited migration history as source of truth.

Removed from the active chain as compatibility-only or no-op history:
- `20260217110000_change_term_season_to_semesters.sql`
- `20260217125838_offering_seed.sql`
- `20260304104000_seed_timetable_presets_top_universities.sql`
