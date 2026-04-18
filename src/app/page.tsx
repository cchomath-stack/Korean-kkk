'use client';

import React, { useState, useEffect } from 'react';
import { Search, BookOpen, FileText, ChevronRight, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function LandingPage() {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'CONTENT' | 'INFO'>('CONTENT');
  const [results, setResults] = useState<{ passages: any[], questions: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      handleSearch(debouncedQuery);
    } else {
      setResults(null);
    }
  }, [debouncedQuery]);

  const handleSearch = async (q: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&mode=${searchMode}`);
      const data = await response.json();
      if (response.ok) {
        setResults(data);
      }
    } catch (error) {
      console.error('Search Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative">
      {/* Top Navigation / Admin Links */}
      <nav className="absolute top-0 right-0 p-6 z-50 flex gap-6">
        <Link href="/admin" className="text-sm font-bold text-slate-800 hover:text-teal-600 transition-colors">
          관리자페이지(데이터관리)
        </Link>
        <Link href="/admin/users" className="text-sm font-bold text-slate-800 hover:text-teal-600 transition-colors">
          관리자페이지(회원관리)
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[75vh] flex flex-col items-center justify-center pt-32 pb-20 px-6 overflow-hidden bg-white">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-50 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10 text-center w-full">
          <div className="mb-12 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="relative mb-6">
              <img
                src="/logo.png"
                alt="오름국어"
                className="w-full max-w-[420px] h-auto mix-blend-multiply transition-all"
              />
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">
                모의고사 문항 검색기
              </h1>
              <div className="flex flex-col gap-1.5">
                <p className="text-slate-500 font-bold text-xl flex items-center justify-center gap-2">
                  <span className="w-8 h-[2px] bg-teal-100"></span>
                  제작자 : 초성민
                  <span className="w-8 h-[2px] bg-teal-100"></span>
                </p>
                <p className="text-teal-600 font-black tracking-[0.3em] text-sm opacity-90 uppercase">
                  부제 : 음수사원하세요
                </p>
              </div>
            </div>
          </div>

          {/* Dual Search Mode Switcher */}
          <div className="flex justify-center gap-1 mb-8 p-1.5 bg-slate-100 rounded-2xl w-fit mx-auto border border-slate-200 shadow-sm">
            <button
              onClick={() => setSearchMode('CONTENT')}
              className={cn(
                "px-8 py-3 rounded-xl text-base font-bold transition-all flex items-center gap-2",
                searchMode === 'CONTENT'
                  ? "bg-white text-teal-600 shadow-md"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              <FileText className="w-5 h-5" />
              지문/문제 검색하기
            </button>
            <button
              onClick={() => setSearchMode('INFO')}
              className={cn(
                "px-8 py-3 rounded-xl text-base font-bold transition-all flex items-center gap-2",
                searchMode === 'INFO'
                  ? "bg-white text-teal-600 shadow-md"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              <Info className="w-5 h-5" />
              문항 정보 검색하기
            </button>
          </div>

          {/* Premium Search Bar */}
          <div className="relative max-w-2xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
            <div className="relative bg-white rounded-2xl shadow-xl flex items-center p-2.5">
              <div className="pl-5 pr-3 text-slate-300">
                <Search className="w-7 h-7" />
              </div>
              <input
                type="text"
                placeholder={searchMode === 'CONTENT'
                  ? "지문 내용이나 문제 속 텍스트를 검색하세요."
                  : "해시태그, 시행처, 학년 등을 검색하세요."
                }
                className="flex-grow py-5 px-2 outline-none text-slate-700 text-xl font-medium"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                onClick={() => handleSearch(query)}
                className="bg-teal-600 text-white px-10 py-5 rounded-xl font-black text-lg hover:bg-teal-700 transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '찾기'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        {results ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Passage Results */}
            {results.passages.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                  연관 지문
                  <span className="h-[1px] flex-grow bg-slate-200" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {results.passages.map((p) => (
                    <Link key={p.id} href={`/viewer/${p.id}`} className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-teal-50 rounded-2xl text-teal-500 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-slate-400">{p.year}.{p.month} {p.grade}학년</span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-800 mb-2 truncate">
                        {p.source || '공통'} {p.questionRange}번 지문
                      </h4>
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-6 italic">
                        "{p.ocrText}"
                      </p>
                      <div className="flex items-center text-teal-600 text-sm font-bold">
                        뷰어로 이동
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Question Results */}
            {results.questions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                  연관 문항
                  <span className="h-[1px] flex-grow bg-slate-200" />
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {results.questions.map((q) => (
                    <Link key={q.id} href={`/viewer/${q.passageId || q.id}`} className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all flex flex-col overflow-hidden">
                      <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden flex items-center justify-center p-4">
                        <img src={q.imageUrl} alt="Question" className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute top-4 right-4 px-3 py-1 bg-black/70 backdrop-blur-md text-white text-xs font-black rounded-lg shadow-xl">
                          {q.questionNo}번
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                            q.difficulty === '상' ? "bg-red-50 text-red-500" : q.difficulty === '하' ? "bg-green-50 text-green-500" : "bg-teal-50 text-teal-500"
                          )}>
                            난도 {q.difficulty || '중'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {q.passage?.year} {q.passage?.month}월 / {q.passage?.grade}학년
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-4 min-h-[22px]">
                          {q.keywords?.split(',').map((tag: string) => (
                            <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold border border-slate-200">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 italic mb-6 leading-relaxed">
                          "{q.ocrText?.slice(0, 100)}..."
                        </p>
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                          <span className="text-[11px] font-bold text-teal-600 group-hover:underline">문제 자세히 보기</span>
                          <ChevronRight className="w-4 h-4 text-teal-600 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {results.passages.length === 0 && results.questions.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[40px] border border-slate-100">
                <Info className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">검색 결과가 없습니다</h3>
                <p className="text-slate-400">다른 키워드를 입력해보세요.</p>
              </div>
            )}
          </div>
        ) : query.length > 0 && query.length < 2 ? (
          <div className="text-center py-20">
            <p className="text-slate-400">최소 2글자 이상 입력해주세요.</p>
          </div>
        ) : null}
      </section>

      {/* Bottom Footer */}
      <footer className="py-8 text-center border-t border-slate-100">
        <p className="text-[10px] text-slate-300 font-bold tracking-widest uppercase">© 2024 Oreum Korean. All rights reserved.</p>
      </footer>
    </div>
  );
}
