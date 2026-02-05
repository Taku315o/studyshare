import { useState, FormEvent } from 'react';
import { Search } from 'lucide-react';

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-blue-200/70 group-focus-within:text-cyan-400 transition-colors duration-300" />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ノートを検索..."
        className="w-full pl-12 pr-32 py-4 bg-slate-900/40 border border-white/10 rounded-2xl text-white placeholder-blue-200/50 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-slate-900/60 focus:border-blue-500/30 transition-all duration-300 shadow-lg shadow-black/10"
      />
      <button
        type="submit"
        className="absolute right-2 top-2 bottom-2 px-6 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl border border-white/5 backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
      >
        検索
      </button>
    </form>
  );
}