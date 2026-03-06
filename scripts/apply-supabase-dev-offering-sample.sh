#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: DATABASE_URL=<postgres-url> $0 [--dry-run]" >&2
  echo "   or: $0 [--dry-run] <postgres-url>" >&2
  exit 1
}

DRY_RUN=false
DATABASE_URL_ARG=""

for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN=true
  elif [[ -z "$DATABASE_URL_ARG" ]]; then
    DATABASE_URL_ARG="$arg"
  else
    usage
  fi
done

DATABASE_URL_ARG="${DATABASE_URL_ARG:-${DATABASE_URL:-}}"
if [[ -z "${DATABASE_URL_ARG}" ]]; then
  usage
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[dry-run] would apply ${ROOT_DIR}/supabase/seeds/dev/20_offering_sample.sql to ${DATABASE_URL_ARG}"
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but was not found in PATH." >&2
  exit 1
fi

psql "${DATABASE_URL_ARG}" -v ON_ERROR_STOP=1 -f "${ROOT_DIR}/supabase/seeds/dev/20_offering_sample.sql"
