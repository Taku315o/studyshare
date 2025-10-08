//page.tsx
'use client'; // クライアントサイドで実行されることを示すNext.jsのディレクティブ
//アプリケーションのトップページ（/）のコンポーネント。ヘッダー、ヒーローセクション、検索フォーム(SearchForm)、課題一覧(AssignmentList)を表示
import { useState } from 'react'; // Reactのフック。状態管理に使用
import Link from 'next/link'; // Next.jsのコンポーネント。クライアントサイドでのページ遷移に使用
import { useAuth } from '@/context/AuthContext'; // 認証関連のカスタムフック
import AssignmentList from '@/components/AssignmentList'; // 課題一覧を表示するコンポーネント
import SearchForm from '@/components/SearchForm'; // 検索フォームを表示するコンポーネント
import Hero from '@/components/Hero';

/**
 * Renders the StudyShare landing page with authentication-aware actions, search, and assignment listings.
 *
 * @returns JSX element representing the home screen.
 */
export default function HomePage() {
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();
  // 検索クエリの状態を管理するためのuseStateフック
  const [searchQuery, setSearchQuery] = useState('');

  // 検索処理を行う関数
  //onSearchとして、この関数をSearchFormコンポーネントに渡して、queryを受け取る。searchformではqueryの更新をしている。
  //で、その後、親に渡されたqueryがassignmentに渡されて、検索結果を表示する
  const handleSearch = (query: string) => {
    setSearchQuery(query); // 検索クエリを更新
  };

  // JSXを返す
  return (
    <div className="container mx-auto px-4 py-8"> {/* 全体を囲むコンテナ */}
      <header className="flex justify-between items-center mb-10 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-lg shadow"> {/* ヘッダー */}
        <h1 className="text-2xl font-bold">StudyShare</h1> {/* アプリケーションのタイトル */}
        <div>
          {/* ローディング状態の表示 */}
          {isLoading ? (
            <div>読み込み中...</div>
          ) : // ユーザーが存在する場合の表示
          user ? (
            <div className="flex items-center gap-4">
              {/* 課題投稿ページへのリンク */}
              <Link
                href="/assignments/new"
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                課題を投稿
              </Link>
              {/* ログアウトボタン */}
              <button
                onClick={() => signOut()}
                className="text-gray-600 hover:text-gray-800"
              >
                ログアウト
              </button>
            </div>
          ) : (
            // ユーザーが存在しない場合の表示
            // Googleログインボタン
            <button
              onClick={() => signInWithGoogle()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Googleでログイン
            </button>
          )}
        </div>
      </header>

      <main> {/* メインコンテンツ */}
        <Hero />
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-4">課題を検索</h2> {/* 検索セクションのタイトル */}
          {/* SearchForm に onSearch って名前で関数を渡してる */}
          <SearchForm onSearch={handleSearch} /> 
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">
            {/* 検索クエリがある場合は検索結果のタイトル、ない場合は「最近の課題」を表示 */}
            {searchQuery ? `"${searchQuery}" の検索結果` : '最近の課題'}
          </h2>
          <AssignmentList query={searchQuery} /> {/* 課題一覧コンポーネント。検索クエリを渡す */}
        </div>
      </main>
    </div>
  );
}