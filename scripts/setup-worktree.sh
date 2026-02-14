#!/usr/bin/env bash
# scripts/setup-worktree.sh
#
# 使い方:
#   1) 通常実行（依存インストール + envコピー + Supabase起動 + 型生成）
#      ./scripts/setup-worktree.sh
#
#   2) オプション確認
#      ./scripts/setup-worktree.sh --help
#
#   3) よく使う例
#      ./scripts/setup-worktree.sh --base-branch dev
#      ./scripts/setup-worktree.sh --force-env --no-gen-types
#      BASE_BRANCH=dev ./scripts/setup-worktree.sh
#
# 注意:
#   --reset-db は破壊的です。BASEブランチのworktreeでのみ実行可能です。
#
# Worktree setup helper:
# - pnpm install (workspace root)
# - copy env files from a "base" worktree (default: main)
# - start Supabase local (optional)
# - supabase db reset (guarded; optional)
# - generate Supabase TS types (optional)

set -euo pipefail

# -------------------------
# Config
# -------------------------

# Env files to copy (relative to repo root)
ENV_FILES_TO_COPY=(
  ".env"
  "frontend/.env.local"
  "backend/.env"
  "backend/.env.development"
  "supabase/.env"
  "supabase/.env.local"
)

SUPABASE_TYPES_OUT="frontend/src/types/supabase.ts"

# Default behavior
FORCE_ENV=0
GEN_TYPES=1
START_SUPABASE=1
RESET_DB=0

# Base branch used to detect "source worktree" for env copy and db-reset safeguard
BASE_BRANCH="${BASE_BRANCH:-main}"

# -------------------------
# Helpers
# -------------------------

log()  { printf "\n[setup] %s\n" "$*"; }
warn() { printf "\n[setup][WARN] %s\n" "$*" >&2; }
die()  { printf "\n[setup][ERROR] %s\n" "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Command not found: $1"
}

usage() {
  cat <<'EOF'
Usage:
  scripts/setup-worktree.sh [options]

Options:
  --base-branch <name>   envコピー元/ガード対象のブランチ（デフォ: main）
  --force-env            既存の env を上書きコピーする（デフォは上書きしない）

  --no-gen-types         Supabase の TypeScript 型生成をスキップ（デフォは実行）
  --no-start-supabase    Supabase の自動起動をしない（デフォは実行）
  --reset-db             supabase db reset を実行（破壊的 / ガード有り）

  -h, --help             ヘルプ表示

Examples:
  scripts/setup-worktree.sh
  scripts/setup-worktree.sh --base-branch dev
  scripts/setup-worktree.sh --force-env --no-gen-types
  BASE_BRANCH=dev scripts/setup-worktree.sh
EOF
}

on_error() {
  local code=$?
  warn "Failed (exit=$code)."
  exit "$code"
}
trap on_error ERR

# -------------------------
# Args
# -------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-branch)
      shift
      [[ $# -gt 0 ]] || die "--base-branch requires a value"
      BASE_BRANCH="$1"
      shift
      ;;
    --force-env)
      FORCE_ENV=1
      shift
      ;;
    --no-gen-types)
      GEN_TYPES=0
      shift
      ;;
    --no-start-supabase)
      START_SUPABASE=0
      shift
      ;;
    --reset-db)
      RESET_DB=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1 (use --help)"
      ;;
  esac
done

# -------------------------
# Detect paths / sanity
# -------------------------

need_cmd git

WORKTREE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "Not inside a git repository."
cd "$WORKTREE_ROOT"

log "Setting up worktree: $(basename "$WORKTREE_ROOT")"
log "Worktree root: $WORKTREE_ROOT"
log "Base branch: $BASE_BRANCH"

# Detect "base" worktree path (the worktree that has refs/heads/<BASE_BRANCH>)
BASE_BRANCH_REF="refs/heads/${BASE_BRANCH}"
BASE_WORKTREE_PATH="$(
  git worktree list --porcelain \
  | awk '
      $1=="worktree"{w=$2}
      $1=="branch" && $2=="'"$BASE_BRANCH_REF"'"{print w}
    ' \
  | head -n 1
)"

if [[ -z "${BASE_WORKTREE_PATH:-}" ]]; then
  warn "Could not auto-detect base worktree path. (No worktree with ${BASE_BRANCH_REF})"
  warn "Env copy will be skipped unless you have ${BASE_BRANCH} checked out as a worktree somewhere."
else
  log "Base worktree detected: $BASE_WORKTREE_PATH"
fi

# -------------------------
# pnpm install
# -------------------------

# Ensure pnpm is available (try corepack if needed)
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    log "pnpm not found. Trying: corepack enable"
    corepack enable >/dev/null 2>&1 || true
  fi
fi
need_cmd pnpm

if [[ ! -f "pnpm-workspace.yaml" ]]; then
  warn "pnpm-workspace.yaml not found at repo root. pnpm install will still run, but monorepo settings may differ."
fi

log "Installing dependencies (pnpm install at workspace root)..."
pnpm install

# -------------------------
# Env copy from base worktree
# -------------------------

copy_env_file() {
  local rel="$1"
  local src="${BASE_WORKTREE_PATH}/${rel}"
  local dst="${WORKTREE_ROOT}/${rel}"

  [[ -f "$src" ]] || return 0

  mkdir -p "$(dirname "$dst")"

  if [[ -f "$dst" && "$FORCE_ENV" -ne 1 ]]; then
    log "Env exists, skip: $rel"
    return 0
  fi

  if [[ "$FORCE_ENV" -eq 1 ]]; then
    log "Copy env (overwrite): $rel"
    cp -f "$src" "$dst"
  else
    log "Copy env (if missing): $rel"
    cp "$src" "$dst"
  fi
}

if [[ -n "${BASE_WORKTREE_PATH:-}" ]]; then
  log "Copying env files from base worktree..."
  for f in "${ENV_FILES_TO_COPY[@]}"; do
    copy_env_file "$f"
  done
else
  warn "Skipping env copy (base worktree not detected)."
fi

# -------------------------
# Supabase: start / reset / types
# -------------------------

need_cmd npx

# Prefer local/installed supabase CLI if available; fallback to npx.
if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD=(supabase)
else
  SUPABASE_CMD=(npx supabase)
fi

supa() {
  "${SUPABASE_CMD[@]}" "$@"
}

is_supabase_running() {
  # status returns non-zero when not running
  supa status >/dev/null 2>&1
}

if [[ "$START_SUPABASE" -eq 1 ]]; then
  if is_supabase_running; then
    log "Supabase already running."
  else
    log "Supabase not running. Starting..."
    supa start
  fi
fi

if [[ "$RESET_DB" -eq 1 ]]; then
  [[ -n "${BASE_WORKTREE_PATH:-}" ]] || die "--reset-db requires detectable base worktree (branch: ${BASE_BRANCH})"

  if [[ "$WORKTREE_ROOT" != "$BASE_WORKTREE_PATH" ]]; then
    die "[SAFEGUARD] db reset allowed only from BASE worktree (${BASE_BRANCH}) at: ${BASE_WORKTREE_PATH}"
  fi

  log "Running: supabase db reset (BASE worktree only)"
  supa db reset
fi

if [[ "$GEN_TYPES" -eq 1 ]]; then
  if ! is_supabase_running; then
    die "Supabase is not running. Run: supabase start (or omit --no-start-supabase)."
  fi

  log "Generating Supabase TypeScript types -> $SUPABASE_TYPES_OUT"
  mkdir -p "$(dirname "$SUPABASE_TYPES_OUT")"
  supa gen types typescript --local --schema public > "$SUPABASE_TYPES_OUT"
fi

log "Environment is ready!"
