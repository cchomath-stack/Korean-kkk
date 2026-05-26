'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Home, Search, Loader2, BookOpen, ChevronRight, X } from 'lucide-react';

type TreeChild = { id: number; name: string; order: number; count: number };
type TreeRoot = TreeChild & { children: TreeChild[] };

export default function GrammarBrowsePage() {
    const [tree, setTree] = useState<TreeRoot[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingTree, setLoadingTree] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/grammar/categories');
                if (res.ok) {
                    const data = await res.json();
                    setTree(data.tree || []);
                }
            } finally {
                setLoadingTree(false);
            }
        })();
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q), 400);
        return () => clearTimeout(t);
    }, [q]);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedIds.size > 0) params.set('categoryIds', [...selectedIds].join(','));
            if (debouncedQ) params.set('q', debouncedQ);
            const res = await fetch(`/api/grammar/questions?${params}`);
            if (res.ok) {
                const data = await res.json();
                setQuestions(data.questions || []);
            }
        } finally {
            setLoading(false);
        }
    }, [selectedIds, debouncedQ]);

    useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

    const toggleCategory = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAllInRoot = (root: TreeRoot) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            const all = root.children.every((c) => next.has(c.id));
            for (const c of root.children) {
                if (all) next.delete(c.id);
                else next.add(c.id);
            }
            return next;
        });
    };

    const clearAll = () => setSelectedIds(new Set());

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="h-14 px-6 flex items-center gap-4 border-b bg-white shadow-sm sticky top-0 z-40">
                <Link href="/" className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-sm font-medium">
                    <Home size={16} /> 홈
                </Link>
                <span className="text-slate-300">|</span>
                <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <BookOpen size={16} /> 문법(어법) 문제 찾기
                </h1>
            </header>

            <main className="max-w-7xl mx-auto p-6 flex gap-6">
                {/* 좌측: 카테고리 트리 */}
                <aside className="w-64 shrink-0">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 sticky top-20">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-slate-900 text-sm">카테고리</h2>
                            {selectedIds.size > 0 && (
                                <button onClick={clearAll} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1">
                                    <X size={11} /> 모두 해제
                                </button>
                            )}
                        </div>
                        {loadingTree ? (
                            <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> 로딩...</div>
                        ) : (
                            <div className="space-y-3">
                                {tree.map((root) => {
                                    const childIds = root.children.map((c) => c.id);
                                    const checkedCount = childIds.filter((id) => selectedIds.has(id)).length;
                                    const allChecked = checkedCount === childIds.length && childIds.length > 0;
                                    return (
                                        <div key={root.id}>
                                            <button
                                                onClick={() => selectAllInRoot(root)}
                                                className={`w-full text-left text-[11px] font-black mb-1 px-1 py-0.5 rounded ${allChecked ? 'text-purple-700 bg-purple-50' : 'text-slate-700 hover:bg-slate-100'}`}
                                            >
                                                {root.name} <span className="font-medium text-slate-400">({checkedCount}/{childIds.length})</span>
                                            </button>
                                            <div className="space-y-0.5 pl-1">
                                                {root.children.map((c) => {
                                                    const checked = selectedIds.has(c.id);
                                                    return (
                                                        <label key={c.id}
                                                            className={`flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded cursor-pointer ${
                                                                checked ? 'bg-purple-100 text-purple-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                                            }`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleCategory(c.id)}
                                                                className="accent-purple-600"
                                                            />
                                                            <span className="flex-1">{c.name}</span>
                                                            <span className="text-[10px] text-slate-400">{c.count}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>

                {/* 우측: 검색바 + 결과 */}
                <section className="flex-1 min-w-0">
                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-center gap-2 mb-4">
                        <Search size={16} className="text-slate-400 ml-2" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="본문/태그 키워드 (선택사항) — 카테고리만 선택해도 검색됨"
                            className="flex-1 bg-transparent outline-none text-sm py-1.5 text-slate-900"
                        />
                        {q && <button onClick={() => setQ('')} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>}
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin" size={14} /> 검색 중...
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                            <p className="text-slate-400 text-sm">
                                {selectedIds.size === 0 && !debouncedQ ? '카테고리를 선택하거나 키워드를 입력하세요.' : '검색 결과가 없습니다.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="text-xs text-slate-500 mb-2 font-bold">{questions.length}개 문제</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {questions.map((qn) => (
                                    <Link key={qn.id} href={`/viewer/${qn.passageId || qn.id}`}
                                        className="bg-white rounded-xl border border-slate-200 hover:border-purple-400 hover:shadow-md transition overflow-hidden group">
                                        <div className="aspect-[4/3] bg-slate-50 relative flex items-center justify-center p-2">
                                            <img src={qn.imageUrl} alt="문제" className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform" />
                                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 text-white text-[10px] font-black rounded">
                                                {qn.questionNo ? `${qn.questionNo}번` : `#${qn.id}`}
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {(qn.grammarCategories || []).map((g: any) => (
                                                    <span key={g.category.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                                                        {g.category.name}
                                                    </span>
                                                ))}
                                            </div>
                                            {qn.passage && (
                                                <div className="text-[10px] text-slate-500 font-bold">
                                                    {qn.passage.year}.{qn.passage.month} · {qn.passage.grade}학년 {qn.passage.area && `· ${qn.passage.area}`}
                                                </div>
                                            )}
                                            <p className="text-xs text-slate-500 line-clamp-2 mt-1 italic">
                                                {qn.ocrText?.slice(0, 80)}...
                                            </p>
                                            <div className="mt-2 flex items-center text-purple-600 text-xs font-bold">
                                                자세히 보기 <ChevronRight size={11} className="ml-0.5 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}
