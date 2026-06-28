'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, BookOpen, Lock, Unlock, ChevronRight, Building2 } from 'lucide-react';

type Round = {
    id: number;
    title: string;
    subTitle: string | null;
    grade: number | null;
    requireAcademyCode: boolean;
    _count: { items: number };
};

type Academy = { id: number; name: string; defaultDesign: string };

export default function StudentLandingPage() {
    const [rounds, setRounds] = useState<Round[]>([]);
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const [rRes, aRes] = await Promise.all([
                fetch('/api/student/round'),
                fetch('/api/student/academy'),
            ]);
            if (rRes.ok) setRounds(await rRes.json());
            if (aRes.ok) setAcademies(await aRes.json());
            setLoading(false);
        })();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-white">
            <header className="px-6 pt-10 pb-6 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-black mb-3">
                    오답노트
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                    내 오답노트 신청
                </h1>
                <p className="text-sm text-slate-500 font-medium mt-2">
                    회차를 고르고 틀린 문제를 체크해주세요. 학원에서 받아 보실 수 있습니다.
                </p>
            </header>

            <main className="max-w-2xl mx-auto px-6 pb-20">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
                ) : rounds.length === 0 ? (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
                        <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="font-black text-slate-400 text-lg mb-1">현재 공개된 회차가 없습니다</p>
                        <p className="text-sm text-slate-400 font-medium">학원에 문의하세요.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">회차 선택</p>
                        {rounds.map(r => (
                            <Link
                                key={r.id}
                                href={`/student/round/${r.id}`}
                                className="block bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-teal-300 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <BookOpen className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="font-black text-slate-900 truncate">{r.title}</h3>
                                            {r.grade && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">고{r.grade}</span>}
                                            {r.requireAcademyCode ? (
                                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded">
                                                    <Lock className="w-2.5 h-2.5" /> 코드
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">
                                                    <Unlock className="w-2.5 h-2.5" /> 공개
                                                </span>
                                            )}
                                        </div>
                                        {r.subTitle && <p className="text-xs text-slate-500 font-medium truncate">{r.subTitle}</p>}
                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">문제 {r._count.items}개</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {academies.length > 0 && (
                    <div className="mt-12 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                            <Building2 className="w-3 h-3" />
                            서비스 학원
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                            {academies.map(a => a.name).join(' · ')}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
