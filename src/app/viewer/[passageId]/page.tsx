'use client';

import React, { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { ChevronLeft, Info, Search, BookOpen, Tag, HelpCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function ViewerPage() {
    const params = useParams();
    const passageId = params.passageId as string;

    const [passage, setPassage] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPassage = async () => {
            try {
                const res = await fetch(`/api/passage?id=${encodeURIComponent(passageId)}`);
                if (res.ok) {
                    const data = await res.json();
                    setPassage(data);
                }
            } catch (e) {
                console.error('Fetch error', e);
            } finally {
                setLoading(false);
            }
        };
        fetchPassage();
    }, [passageId]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold">지문을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (!passage) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <AlertTriangle className="w-16 h-16 text-amber-400 mb-4" />
                <h2 className="text-2xl font-black text-slate-800 mb-2">지문을 찾을 수 없습니다.</h2>
                <Link href="/" className="text-teal-600 font-bold underline">메인으로 돌아가기</Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="font-bold text-slate-900 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-teal-500" />
                            {passage.year}년 {passage.month}월 {passage.office || '학평'} - {passage.grade}학년
                        </h1>
                        <p className="text-xs text-slate-500 font-medium tracking-tight">문항 범위: {passage.questionRange || '전체'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-black hover:bg-teal-700 transition-all shadow-lg shadow-teal-100">
                        <Search className="w-4 h-4" />
                        다른 문제 검색
                    </Link>
                </div>
            </header>

            {/* Main Content (Split View) */}
            <main className="flex flex-1 overflow-hidden">
                {/* Left: Passage Area */}
                <section className="w-1/2 h-full overflow-y-auto border-r border-slate-200 bg-white p-10 custom-scrollbar">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <span className="px-4 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-200">지문 (Passage)</span>
                        </div>

                        {passage.imageUrl ? (
                            <div className="shadow-2xl shadow-teal-100/50 rounded-3xl overflow-hidden border border-slate-100 bg-white p-2">
                                <img
                                    src={passage.imageUrl}
                                    alt="Passage"
                                    className="w-full h-auto object-contain rounded-2xl"
                                />
                            </div>
                        ) : (
                            <div className="aspect-[3/4] flex flex-col items-center justify-center bg-slate-50 rounded-[40px] border-4 border-dashed border-slate-100 p-12 text-center">
                                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6">
                                    <BookOpen className="w-10 h-10 text-slate-200" />
                                </div>
                                <h3 className="text-xl font-black text-slate-400 mb-2">지문 없는 문항</h3>
                                <p className="text-sm text-slate-300 font-bold leading-relaxed">
                                    이 시험 세트는 지문 이미지 없이<br />문제들로만 구성되어 있습니다.
                                </p>
                            </div>
                        )}

                        {passage.ocrText && passage.ocrText !== '(지문 없음)' && (
                            <div className="mt-12 p-8 bg-slate-50/50 rounded-[32px] border border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">텍스트 추출 결과</h4>
                                <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                                    {passage.ocrText}
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Right: Questions Area */}
                <section className="w-1/2 h-full overflow-y-auto bg-slate-50 p-10 custom-scrollbar">
                    <div className="max-w-3xl mx-auto space-y-16">
                        <div className="flex items-center justify-between mb-2">
                            <span className="px-4 py-1.5 bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-teal-100">문항 리스트 (Questions)</span>
                            <span className="text-xs font-bold text-slate-400">총 {passage.questions?.length || 0}개 문항</span>
                        </div>

                        {passage.questions && passage.questions.length > 0 ? (
                            passage.questions.map((q: any) => (
                                <div key={q.id} className="bg-white rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden group hover:border-teal-200 transition-all duration-300">
                                    <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center px-10">
                                        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                            <span className="w-10 h-10 bg-teal-600 text-white rounded-2xl flex items-center justify-center text-lg">{q.questionNo}</span>
                                            번 문제
                                        </h3>
                                        <div className="flex gap-2">
                                            <span className={cn(
                                                "text-[11px] px-3 py-1 rounded-xl font-black uppercase border",
                                                q.difficulty === '상' ? "bg-red-50 text-red-600 border-red-100" :
                                                    q.difficulty === '중' ? "bg-teal-50 text-teal-600 border-teal-100" : "bg-green-50 text-green-600 border-green-100"
                                            )}>
                                                난이도 {q.difficulty || '중'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-10">
                                        <div className="mb-10 rounded-3xl overflow-hidden border border-slate-100 bg-white p-2 shadow-inner">
                                            <img src={q.imageUrl} alt={`Question ${q.questionNo}`} className="w-full h-auto rounded-2xl" />
                                        </div>

                                        <div className="grid grid-cols-1 gap-6">
                                            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 bg-white rounded-2xl shadow-sm flex-shrink-0 flex items-center justify-center">
                                                        <HelpCircle className="w-5 h-5 text-teal-500" />
                                                    </div>
                                                    <div className="flex-grow">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">정답 정보</p>
                                                        <p className="text-lg font-black text-slate-800">{q.answer || '미등록'}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 bg-white rounded-2xl shadow-sm flex-shrink-0 flex items-center justify-center">
                                                        <Tag className="w-5 h-5 text-teal-500" />
                                                    </div>
                                                    <div className="flex-grow">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">연관 키워드</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {q.keywords ? q.keywords.split(',').map((tag: string, idx: number) => (
                                                                <span key={idx} className="text-xs bg-white text-teal-700 px-3 py-1 rounded-xl font-bold border border-teal-100 shadow-sm">
                                                                    #{tag.trim()}
                                                                </span>
                                                            )) : <span className="text-xs text-slate-300 font-bold italic">태그 없음</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border border-slate-200 border-dashed">
                                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
                                    <Info className="w-10 h-10 text-slate-200" />
                                </div>
                                <h3 className="text-xl font-black text-slate-400">등록된 문제가 없습니다.</h3>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 20px;
                    border: 3px solid transparent;
                    background-clip: content-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                    background-clip: content-box;
                }
            `}</style>
        </div>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
