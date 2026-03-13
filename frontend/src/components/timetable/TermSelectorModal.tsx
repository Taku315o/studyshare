'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { TimetableTermOption } from '@/types/timetable';

type TermSelectorModalProps = {
    isOpen: boolean;
    terms: TimetableTermOption[];
    selectedTermId: string | null;
    onSelect: (termId: string) => void;
    onClose: () => void;
};

export default function TermSelectorModal({
    isOpen,
    terms,
    selectedTermId,
    onSelect,
    onClose,
}: TermSelectorModalProps) {
    const availableYears = useMemo(() => {
        const years = [...new Set(terms.map((term) => term.academicYear))];
        return years.sort((a, b) => b - a);
    }, [terms]);

    const currentTerm = useMemo(() => terms.find((t) => t.id === selectedTermId) ?? null, [terms, selectedTermId]);

    const [selectedYear, setSelectedYear] = useState<number>(() => currentTerm?.academicYear ?? availableYears[0] ?? new Date().getFullYear());
    const [pendingTermId, setPendingTermId] = useState<string | null>(selectedTermId);

    const filteredTerms = useMemo(
        () => terms.filter((term) => term.academicYear === selectedYear),
        [terms, selectedYear],
    );

    useEffect(() => {
        if (!isOpen) return;
        const term = terms.find((t) => t.id === selectedTermId) ?? null;
        const year = term?.academicYear ?? availableYears[0] ?? new Date().getFullYear();
        setSelectedYear(year);
        setPendingTermId(selectedTermId);
    }, [isOpen, selectedTermId, terms, availableYears]);

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    const handleYearChange = (year: number) => {
        setSelectedYear(year);
        const termsInYear = terms.filter((t) => t.academicYear === year);
        if (termsInYear.length > 0) {
            setPendingTermId(termsInYear[0].id);
        }
    };

    const handleConfirm = () => {
        if (pendingTermId) {
            onSelect(pendingTermId);
        }
    };

    if (!isOpen || typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
            data-testid="term-selector-modal-overlay"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="年度・学期切替"
                className="w-full max-w-lg rounded-t-2xl border border-white/60 bg-white px-6 pb-6 pt-4 shadow-xl sm:rounded-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100"
                        aria-label="閉じる"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <h3 className="flex-1 text-center text-base font-bold text-slate-900">年度・学期切替</h3>
                    <div className="w-8" />
                </div>

                {/* Description */}
                <div className="mt-4 text-sm text-slate-600">
                    <p>年度や学期が変わったときは、こちらから表示を切り替えましょう💡</p>
                    <p className="mt-1 text-xs text-slate-500">※過去に作成した時間割も引き続きご利用できます</p>
                </div>

                {/* Year Selector */}
                <section className="mt-5">
                    <p className="text-sm font-semibold text-slate-800">年度</p>
                    <select
                        value={selectedYear}
                        onChange={(event) => handleYearChange(Number(event.target.value))}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        data-testid="term-selector-year"
                    >
                        {availableYears.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>
                </section>

                {/* Term Radio List */}
                <section className="mt-5">
                    <p className="text-sm font-semibold text-slate-800">学期</p>
                    <div className="mt-2 space-y-1">
                        {filteredTerms.map((term) => (
                            <label
                                key={term.id}
                                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                            >
                                <input
                                    type="radio"
                                    name="term-selector"
                                    value={term.id}
                                    checked={pendingTermId === term.id}
                                    onChange={() => setPendingTermId(term.id)}
                                    className="h-4 w-4 border-slate-300 text-blue-500 focus:ring-blue-400"
                                />
                                <span className="text-sm text-slate-800">{term.displayName}</span>
                            </label>
                        ))}
                        {filteredTerms.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-slate-500">この年度の学期データがありません</p>
                        ) : null}
                    </div>
                </section>

                {/* Note */}
                <p className="mt-4 text-xs text-slate-500">
                    ※クォーター制の方は、1学期〜4学期の中から該当する学期を選択しましょう
                    <br />
                    （例：第1クォーター → 1学期）
                </p>

                {/* Confirm Button */}
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!pendingTermId}
                    className="mt-5 w-full rounded-xl bg-blue-500 py-3.5 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    変更する
                </button>
            </div>
        </div>,
        document.body,
    );
}
