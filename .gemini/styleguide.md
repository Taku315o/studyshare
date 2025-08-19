# StudyShare - Style Guide (TypeScript / Next.js / Node)

## General principles
- **Simplicity & Readability**: 読みやすさを常に意識し、技巧に走りすぎないコードを心がける。
- **Function Size**: 1つの関数は、妥当な範囲で80行未満に収める。
- **Type Safety**:
  - モジュール外に公開する関数やコンポーネントのpropsには、必ず明示的な型定義を行う。
  - `any` の使用は原則禁止。ジェネリクスや `unknown` と型ガードを適切に利用する。

## Naming Conventions
- **Components (React)**: `PascalCase` (例: `AssignmentForm.tsx`)
- **Functions / Variables**: `camelCase` (例: `handleSearch`)
- **Types / Interfaces**: `PascalCase` (例: `type FormData = ...`)
- **API Endpoints (Backend)**: kebab-case (例: `/api/assignments/search`)

---
## Frontend (Next.js / React)

- **Framework**: Next.js App Router を使用する。コンポーネントは `'use client'` を用いたクライアントコンポーネントを基本とする。
- **Component Design**: コンポーネントは責務に応じて小さく分割し、再利用性を高める（例: `AssignmentList`, `SearchForm`, `Hero`）。
- **Data Fetching**: データ取得は Supabase のクライアントライブラリ (`@supabase/supabase-js`) を使用する。動的なデータは `useEffect` と `useState` を組み合わせて取得する。
- **State Management**: アプリケーション全体の認証状態は `AuthContext` で管理する。
- **Styling**: Tailwind CSS のユーティリティファーストでスタイリングする。共通の色やスペーシングは、将来的に `tailwind.config.ts` の `theme` で一元管理することを推奨する。

---
## Backend (Node / Express)

- **Input Validation**: APIエンドポイントで受け取るリクエストボディやクエリパラメータは、必ずバリデーションを行う。現状は手動チェックだが、将来的には `zod` などのライブラリ導入を検討する。
- **Architecture**: Controller -> Service の責務分離を行う。
  - **Controller**: HTTPリクエストの受付とレスポンスの返却に専念する（例: `assignmentController.ts`）。
  - **Service**: ビジネスロジックとデータベースアクセスを担当する（例: `assignmentService.ts`）。
- **Error Handling**: 各コントローラーの `try...catch` でエラーを捕捉する。将来的には、エラーレスポンスを統一するための Express の中央エラーハンドリングミドルウェアの導入を検討する。

---
## Security
- **Authentication**: フロントエンドで取得した Supabase のJWTを `Authorization: Bearer <token>` ヘッダーでバックエンドに渡し、バックエンドの `authenticate` ミドルウェアで検証する。
- **Database**: Supabase の RLS (Row Level Security) を活用し、各操作（SELECT, INSERT, UPDATE, DELETE）に対して適切なポリシーを設定する。
- **Logging**: ログに認証情報、トークン、個人情報（PII）を含めない。

---
## Tests & CI
- **Frontend**: Jest と React Testing Library (`@testing-library/react`) を用いてコンポーネントのテストを作成する。
- **Backend**: (現状未実装) APIエンドポイントのテストには Jest と `supertest` の導入を推奨する。
- **Linting**: ESLint を使用し、`npm run lint` コマンドで静的解析を実行する。

## Formatting
- **ESLint**: Next.js の推奨設定 (`next/core-web-vitals`, `next/typescript`) を基本とする。
- **Import Order**: `import/order` などのルールを導入し、`ビルトイン -> 外部ライブラリ -> 内部モジュール` の順に整列させることを推奨する。