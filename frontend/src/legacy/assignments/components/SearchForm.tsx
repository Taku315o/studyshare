import { useEffect, useState, FormEvent } from 'react';
import { Search } from 'lucide-react';
import supabase from '@/lib/supabase';
import toast from 'react-hot-toast';

type SearchFormProps = {
  onSearch: (filters: SearchFilters) => void;
};

export type SearchFilters = {
  query: string;
  university?: string;
  faculty?: string;
  department?: string;
};

type SelectOption = {
  id: string;
  name: string;
};

/**
 * Form component that captures a search query and notifies the parent component when submitted.
 *
 * @param onSearch - Callback invoked with the trimmed query string and dropdown filters when submitted.
 * @returns JSX element rendering the search input and submit button.
 */
export default function SearchForm({ onSearch }: SearchFormProps) {
  const [query, setQuery] = useState('');
  const [universities, setUniversities] = useState<SelectOption[]>([]);
  const [faculties, setFaculties] = useState<SelectOption[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  useEffect(() => {
    const fetchUniversities = async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('大学一覧の取得に失敗しました:', error);
        toast.error('大学一覧の取得に失敗しました');
        return;
      }

      setUniversities(data ?? []);
    };

    fetchUniversities();
  }, []);

  useEffect(() => {
    const fetchFaculties = async () => {
      if (!selectedUniversityId) {
        setFaculties([]);
        setSelectedFacultyId('');
        setDepartments([]);
        setSelectedDepartmentId('');
        return;
      }

      const { data, error } = await supabase
        .from('faculties')
        .select('id, name')
        .eq('university_id', selectedUniversityId)
        .order('name');

      if (error) {
        console.error('学部一覧の取得に失敗しました:', error);
        toast.error('学部一覧の取得に失敗しました');
        return;
      }

      setFaculties(data ?? []);
      setSelectedFacultyId('');
      setDepartments([]);
      setSelectedDepartmentId('');
    };

    fetchFaculties();
  }, [selectedUniversityId]);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!selectedFacultyId) {
        setDepartments([]);
        setSelectedDepartmentId('');
        return;
      }

      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('faculty_id', selectedFacultyId)
        .order('name');

      if (error) {
        console.error('学科一覧の取得に失敗しました:', error);
        toast.error('学科一覧の取得に失敗しました');
        return;
      }

      setDepartments(data ?? []);
      setSelectedDepartmentId('');
    };

    fetchDepartments();
  }, [selectedFacultyId]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const selectedUniversity = universities.find((item) => item.id === selectedUniversityId)?.name ?? '';
    const selectedFaculty = faculties.find((item) => item.id === selectedFacultyId)?.name ?? '';
    const selectedDepartment = departments.find((item) => item.id === selectedDepartmentId)?.name ?? '';

    onSearch({
      query: query.trim(),
      university: selectedUniversity,
      faculty: selectedFaculty,
      department: selectedDepartment,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-blue-200/70 group-focus-within:text-cyan-400 transition-colors duration-300" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワードで検索..."
          className="w-full pl-12 pr-32 py-4 bg-slate-900/40 border border-white/10 rounded-2xl text-white placeholder-blue-200/50 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-slate-900/60 focus:border-blue-500/30 transition-all duration-300 shadow-lg shadow-black/10"
        />
        <button
          type="submit"
          className="absolute right-2 top-2 bottom-2 px-6 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl border border-white/5 backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
        >
          検索
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-blue-100/80" htmlFor="university-filter">
            大学名
          </label>
          <select
            id="university-filter"
            value={selectedUniversityId}
            onChange={(e) => setSelectedUniversityId(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="">すべての大学</option>
            {universities.map((uni) => (
              <option key={uni.id} value={uni.id}>
                {uni.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-blue-100/80" htmlFor="faculty-filter">
            学部
          </label>
          <select
            id="faculty-filter"
            value={selectedFacultyId}
            onChange={(e) => setSelectedFacultyId(e.target.value)}
            disabled={!selectedUniversityId}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
          >
            <option value="">すべての学部</option>
            {faculties.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>
                {faculty.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-blue-100/80" htmlFor="department-filter">
            学科
          </label>
          <select
            id="department-filter"
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            disabled={!selectedFacultyId}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
          >
            <option value="">すべての学科</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
}
