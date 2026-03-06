#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

"${SCRIPT_DIR}/generate-universities-seed.sh" \
  "${ROOT_DIR}/supabase/seeds/universities.csv" \
  "${ROOT_DIR}/supabase/seeds/00_universities.sql"

"${SCRIPT_DIR}/generate-timetable-preset-seed.sh" \
  "${ROOT_DIR}/supabase/seeds/timetable_presets_top_universities.csv" \
  "${ROOT_DIR}/supabase/seeds/10_timetable_presets.sql"
