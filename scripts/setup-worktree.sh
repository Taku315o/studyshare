#!/bin/bash
# scripts/setup-worktree.sh

#config
set -e

ENV_FILES_TO_COPY=(
  ".env"
  "frontend/.env.local"
  "backend/.env"
  "backend/.env.development"
  "supabase/.env"
  "supabase/.env.loclal"
 
)

SUPABASE_TYPES_OUT="frontend/src/types/supabase.ts"


#helper

log()  { printf "\n[setup] %s\n" "$*"; }
warn() { printf "\n[setup][WARN] %s\n" "$*" >&2; }
die()  { printf "\n[setup][ERROR] %s\n" "$*" >&2; exit 1; }


need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Command not found: $1"
}

usage() {
  cat <<'EOF'
Usage:
  scripts/setup-worktree.sh [--force-env] [--gen-types] [--start-supabase] [--reset-db]

Options:
  --force-env       既存の env を上書きコピーする（デフォは上書きしない）
  --gen-types       Supabase の TypeScript 型を生成する（デフォは実行）
  --start-supabase  Supabase が止まってたら起動する（デフォは実行）
  --reset-db        supabase db reset を実行する（破壊的。必要な時だけ）
EOF
}

FORCE_ENV=0
GEN_TYPES=1
START_SUPABASE=1
RESET_DB=0

for arg in "${@:-}"; do
  case "$arg" in
    --force-env)      FORCE_ENV=1 ;;
    --gen-types)      GEN_TYPES=1 ;;
    --start-supabase) START_SUPABASE=1 ;;
    --reset-db)       RESET_DB=1 ;;
    -h|--help)        usage; exit 0 ;;
    *) die "Unknown option: $arg (use --help)" ;;
  esac
done

#detect paths
need_cmd git

WORKTREE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "Not inside a git repository."
cd "$WORKTREE_ROOT"

log "Setting up worktree: $(basename "$WORKTREE_ROOT")"
log "Worktree root: $WORKTREE_ROOT"

# main worktree のパスを自動検出（refs/heads/main が割り当たっている worktree を探す）
MAIN_WORKTREE_PATH="$(
  git worktree list --porcelain \
  | awk '
      $1=="worktree"{w=$2}
      $1=="branch" && $2=="refs/heads/main"{print w}
    ' \
  | head -n 1
)"

if [[ -z "${MAIN_WORKTREE_PATH:-}" ]]; then
  warn "Could not auto-detect main worktree path. (No worktree with refs/heads/main)"
  warn "Env copy will be skipped unless you checkout main somewhere as a worktree."
else
  log "Main worktree detected: $MAIN_WORKTREE_PATH"
fi

#pnpm install

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    log "pnpm not found. Trying: corepack enable"
    corepack enable >/dev/null 2>&1 || true
  fi
fi
need_cmd pnpm

log "Installing dependencies (pnpm install at workspace root)..."
pnpm install

# Env copy from main worktree

copy_env_file() {
  local rel="$1"
  local src="$MAIN_WORKTREE_PATH/$rel"
  local dst="$WORKTREE_ROOT/$rel"

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

if [[ -n "${MAIN_WORKTREE_PATH:-}" ]]; then
  log "Copying env files from main worktree..."
  for f in "${ENV_FILES_TO_COPY[@]}"; do
    copy_env_file "$f"
  done
else
  warn "Skipping env copy (main worktree not detected)."
fi

#Supabase: start / reset / types


# supabase CLI は npx 経由で叩く前提（プロジェクトに依存させない）
need_cmd npx

is_supabase_running() {
  npx supabase status >/dev/null 2>&1
}

if [[ "$START_SUPABASE" -eq 1 ]]; then
  if is_supabase_running; then
    log "Supabase already running."
  else
    log "Supabase not running. Starting..."
    npx supabase start
  fi
fi

MAIN_WORKTREE_PATH="$(git worktree list --porcelain \
  | awk '$1=="worktree"{w=$2} $1=="branch" && $2=="refs/heads/main"{print w}' \
  | head -n1)"

if [[ "$RESET_DB" -eq 1 ]]; then
  if [[ "$WORKTREE_ROOT" != "$MAIN_WORKTREE_PATH" ]]; then
    echo "[SAFEGUARD] db reset allowed only from MAIN worktree."
    exit 1
  fi
  npx supabase db reset
fi


if [[ "$GEN_TYPES" -eq 1 ]]; then
  # --local はローカルの Supabase に接続するので start 済みである必要がある
  if ! is_supabase_running; then
    die "Supabase is not running. Run: npx supabase start (or pass --start-supabase)."
  fi

  log "Generating Supabase TypeScript types -> $SUPABASE_TYPES_OUT"
  mkdir -p "$(dirname "$SUPABASE_TYPES_OUT")"
  npx supabase gen types typescript --local --schema public > "$SUPABASE_TYPES_OUT"
fi

log "Environment is ready!"