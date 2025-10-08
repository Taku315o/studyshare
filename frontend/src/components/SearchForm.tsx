// studyshare/frontend/src/components/SearchForm.tsx
// 課題検索フォームのUIとロジックを定義するコンポーネントファイル
import { useState, FormEvent } from 'react';
//SearchFormで入力された文字(query)が、onSearch関数の引数として親コンポーネント(page.tsx)に渡される。
//onSearchは親から子へpropsとして渡された関数で、実行されるとhandleSearchが動作してクエリを更新する
//onSearchっていうpropsを渡してくれって要求してる
type SearchFormProps = {
  onSearch: (query: string) => void;
};

/**
 * Form component that captures a search query and notifies the parent component when submitted.
 *
 * @param onSearch - Callback invoked with the trimmed query string when the form is submitted.
 * @returns JSX element rendering the search input and submit button.
 */
export default function SearchForm({ onSearch }: SearchFormProps) {
  const [query, setQuery] = useState('');
//
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };
    // フォームの送信時にクエリをトリムして検索
  return (
    <form onSubmit={handleSubmit} className="mb-6 flex">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="キーワードで検索..."
        className="flex-1 px-4 py-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        type="submit"
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r"
      >
        検索
      </button>
    </form>
  );
}