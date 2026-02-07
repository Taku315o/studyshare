'use client'; // クライアントサイドで実行されることを示すNext.jsのディレクティブ
//アプリケーションのトップページ（/）のコンポーネント。ヘッダー、ヒーローセクション、検索フォーム(SearchForm)、課題一覧(AssignmentList)を表示
import { useState } from 'react'; // Reactのフック。状態管理に使用
import AssignmentList from '@/components/AssignmentList'; // 課題一覧を表示するコンポーネント
import SearchForm, { SearchFilters } from '@/components/SearchForm'; // 検索フォームを表示するコンポーネント
import Hero from '@/components/Hero';
import Header from '@/components/Header';
/**
 * Renders the StudyShare landing page with authentication-aware actions, search, and assignment listings.
 *
 * @returns JSX element representing the home screen.
 */
export default function HomePage() {
  // 検索条件の状態を管理するためのuseStateフック
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    university: '',
    faculty: '',
    department: '',
  });

  // 検索処理を行う関数
  //onSearchとして、この関数をSearchFormコンポーネントに渡して、queryを受け取る。searchformではqueryの更新をしている。
  //で、その後、親に渡されたqueryがassignmentに渡されて、検索結果を表示する
  const handleSearch = (nextFilters: SearchFilters) => {
    setFilters(nextFilters); // 検索条件を更新
  };

  // JSXを返す
  return (
    <div className="container mx-auto px-4 py-8">{/* これがないと配置がおかしくなる */}
    <Header />
      <main> {/* メインコンテンツ */}
        <Hero />
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-4">ノートを検索</h2> {/* 検索セクションのタイトル */}
          {/* SearchForm に onSearch って名前で関数を渡してる */}
          <SearchForm onSearch={handleSearch} /> 
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">
            {/* 検索条件がある場合は検索結果のタイトル、ない場合は「最近の課題」を表示 */}
            {filters.query
              ? `"${filters.query}" の検索結果`
              : filters.university || filters.faculty || filters.department
              ? '絞り込み結果'
              : '最近のノート'}
          </h2>
          <AssignmentList filters={filters} /> {/* 課題一覧コンポーネント。検索条件を渡す */}
        </div>
      </main>
    </div>
  );
}
