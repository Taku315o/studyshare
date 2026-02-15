'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AssignmentList from '@/components/AssignmentList';
import SearchForm, { SearchFilters } from '@/components/SearchForm';
import Hero from '@/components/Hero';
import Header from '@/components/Header';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    university: '',
    faculty: '',
    department: '',
  });

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/home');
    }
  }, [isLoading, user, router]);

  const handleSearch = (nextFilters: SearchFilters) => {
    setFilters(nextFilters);
  };

  if (!isLoading && user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Header />
      <main>
        <Hero />

        <div className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">ノートを検索</h2>
          <SearchForm onSearch={handleSearch} />
        </div>

        <div>
          <h2 className="mb-4 text-xl font-semibold">
            {filters.query
              ? `"${filters.query}" の検索結果`
              : filters.university || filters.faculty || filters.department
                ? '絞り込み結果'
                : '最近のノート'}
          </h2>
          <AssignmentList filters={filters} />
        </div>
      </main>
    </div>
  );
}
