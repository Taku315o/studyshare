# StudyShare

StudyShare は大学生向けの課題共有プラットフォームです。Google OAuth を利用した Supabase 認証を備え、ユーザーは課題の回答（テキストと画像）を投稿・閲覧・検索できます。管理者権限を持つユーザーは投稿された課題を削除することも可能です。

---

## アーキテクチャ概要

| 層 | 主な技術 | 役割 |
|----|-----------|------|
| フロントエンド | Next.js (App Router), TypeScript, Tailwind CSS | UI/UX、検索・投稿フォーム、Supabase 認証のフロント統合 |
| バックエンド | Node.js, Express, TypeScript | 課題投稿 API、画像アップロード、管理者向け削除処理 |
| 認証/データ | Supabase Auth, Supabase PostgreSQL, Supabase Storage | ユーザー管理、課題データ保管、画像ストレージ |

---

## リポジトリ構成

```text
studyshare/
├── frontend/           # Next.js アプリ (App Router)
│   ├── src/app/        # ルーティングとページコンポーネント
│   ├── src/components/ # UI コンポーネント
│   ├── src/context/    # 認証コンテキスト
│   └── src/lib/        # API クライアントと Supabase ラッパー
├── backend/            # Express API サーバー
│   ├── src/controllers # ルートハンドラー
│   ├── src/services    # ビジネスロジック層
│   ├── src/middleware  # 認証・バリデーションミドルウェア
│   └── src/lib         # Supabase クライアント設定
└── README.md
```

---

## 必要なツール

- Node.js 18 以上
- npm 9 以上
- Supabase プロジェクト（Auth、PostgreSQL、Storage を利用）

---

## 環境変数

### フロントエンド (`frontend/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001/api
```

### バックエンド (`backend/.env`)

```env
PORT=3001
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

> `SUPABASE_SERVICE_ROLE_KEY` は機密情報のため、クライアントからは絶対に参照しないでください。サーバーサイドのみで使用します。

---

## セットアップ手順

1. **リポジトリのクローン**

   ```bash
   git clone <repository-url>
   cd studyshare
   ```

2. **依存関係のインストール**

   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. **環境変数ファイルの作成**（前述のテンプレートを使用）

4. **Supabase 初期化**
   - Supabase プロジェクトで `users` と `assignments` テーブル、および `search_assignments` RPC を設定してください。
   - ローカル開発用に `backend/src/scripts/seed.ts` を実行するとテストユーザーと課題データを投入できます。

     ```bash
     cd backend
     npm run ts-node src/scripts/seed.ts
     ```

5. **開発サーバーの起動**

   別々のターミナルで以下を実行します。

   ```bash
   # フロントエンド
   cd frontend
   npm run dev

    # バックエンド
   cd backend
   npm run dev
   ```

   - フロントエンド: [http://localhost:3000](http://localhost:3000)
   - バックエンド API: [http://localhost:3001/api](http://localhost:3001/api)

---

## 主な開発フロー

1. Google OAuth でログインすると Supabase セッションが作成され、`AuthProvider` がアプリ全体へ配布します。
2. 課題投稿ページからタイトル・説明・画像を送信すると、画像が Supabase Storage に保存され、課題メタデータがバックエンド API 経由で PostgreSQL に保存されます。
3. トップページでは Supabase RPC `search_assignments` を使用して検索し、結果を表示します。
4. 管理者は UI から課題を削除でき、バックエンドはサービスロールキーを利用して権限チェック後に削除処理を行います。

---

## テスト

- フロントエンド: `cd frontend && npm test`
- バックエンド: 必要に応じて `npm run test` を追加してください（現状は未設定）。

---

## トラブルシューティング

- **Google ログイン後にリダイレクトされない**: Supabase プロジェクトのリダイレクト URL に `http://localhost:3000/auth/callback` を登録してください。
- **画像アップロードが失敗する**: バケット名 `assignments` のパブリックアクセス設定と CORS を確認します。
- **認証 API が 401 を返す**: フロントエンドで `setAuthToken` によるヘッダー設定が正しく行われているか確認してください。

---

## デプロイのヒント

- フロントエンドは Vercel、バックエンドは Render や Fly.io などにデプロイできます。
- 本番環境ではバックエンドに HTTPS を必須とし、`SUPABASE_SERVICE_ROLE_KEY` を安全に保管してください。
- Supabase の Storage バケットはパブリック読み取りに設定し、不要な書き込みを防ぐルールを設定します。

---

## ライセンス

本リポジトリのライセンスについては、必要に応じて追記してください。
