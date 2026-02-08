#!/bin/bash
# scripts/setup-worktree.sh

set -e

echo "🚀 Setting up worktree: $(basename "$PWD")"

cd "$WORKTREE_PATH"  

# 1. pnpmのインストールチェックと実行
if ! command -v pnpm &> /dev/null; then
    echo "pnpm is not installed. Please install it first."
    exit 1
fi

echo "Installing dependencies with pnpm..."
# --frozen-lockfile を付けないことで、必要に応じてlockファイルを更新しつつ
# ハードリンクによる高速インストールを行います
pnpm install

# 2. 環境変数のセットアップ
if [ -f .env.example ]; then
    if [ ! -f .env ]; then
        echo "📄 Creating .env from .env.example..."
        cp .env.example .env
    fi
fi

# 3. Supabase / Next.js 等の生成物がある場合
# ここにプロジェクト固有の生成コマンドを書く
# 例: pnpm supabase gen types typescript --local > src/types/supabase.ts

echo "✅ Environment is ready!"