'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, BookCheck, ChevronLeft, ChevronRight, Lock, Unlock, Eye, EyeOff, Trash2 } from 'lucide-react';

type Round = {
    id: number;
    title: string;
    subTitle: string | null;
    grade: number | null;
    isPublic: boolean;
    requireAcademyCode: boolean;
    createdAt: string;
    _count: { items: number; wrongNoteRequests: number };
};

export default function RoundsPage() {
    const [list, setList] = useState<Round[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const load = async () => {
        setLoading(true);
        const res = await fetch('/api/admin/round');
        if (res.ok) setList(await res.json());
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const handleDelete = async (id: number, title: string) => {
        if (!confirm(`회차 "${title}"를 삭제할까요? (담긴 문항 + 학생 제출 요청 모두 삭제됩니다)`)) return;
        await fetch(`/api/admin/round?id=${id}`, { method: 'DELETE' });
        load();
    };

    const togglePublic = async (round: Round) => {
        await fetch('/api/admin/round', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: round.id, isPublic: !round.isPublic }),
        });
        load();
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-black text-slate-900">회차 관리</h1>
                            <p className="text-xs font-bold text-slate-400">학생용 오답노트 회차(문제 풀)</p>
                        </div>
                    </div>
                    <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-black hover:bg-teal-700">
                        <Plus className="w-4 h-4" /> 회차 추가
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
                ) : list.length === 0 ? (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
                        <BookCheck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="font-black text-slate-400 text-lg mb-3">등록된 회차가 없습니다</p>
                        <button onClick={() => setShowForm(true)} className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-black hover:bg-teal-700">첫 회차 추가하기</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {list.map(r => (
                            <div key={r.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-black text-slate-900 truncate">{r.title}</h3>
                                        {r.grade && <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">고{r.grade}</span>}
                                        {r.isPublic ? (
                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">공개</span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded">비공개</span>
                                        )}
                                        {r.requireAcademyCode ? (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded">
                                                <Lock className="w-2.5 h-2.5" /> 코드 필요
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] font-bold rounded">
                                                <Unlock className="w-2.5 h-2.5" /> 공개
                                            </span>
                                        )}
                                    </div>
                                    {r.subTitle && <p className="text-xs text-slate-500 font-medium mb-1">{r.subTitle}</p>}
                                    <p className="text-[11px] text-slate-400 font-bold">
                                        문제 {r._count.items}개 · 학생 제출 {r._count.wrongNoteRequests}건
                                    </p>
                                </div>
                                <button onClick={() => togglePublic(r)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500" title={r.isPublic ? '비공개로' : '공개로'}>
                                    {r.isPublic ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <Link href={`/admin/rounds/${r.id}`} className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-black hover:bg-teal-700">
                                    편집 <ChevronRight className="w-3 h-3" />
                                </Link>
                                <button onClick={() => handleDelete(r.id, r.title)} className="p-2 hover:bg-rose-50 rounded-xl text-rose-300 hover:text-rose-600">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showForm && (
                <RoundFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
            )}
        </div>
    );
}

function RoundFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [title, setTitle] = useState('');
    const [subTitle, setSubTitle] = useState('');
    const [grade, setGrade] = useState('');
    const [requireAcademyCode, setRequireAcademyCode] = useState(true);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch('/api/admin/round', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, subTitle, grade, requireAcademyCode }),
        });
        setBusy(false);
        if (res.ok) onSaved();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4" onClick={onClose}>
            <form onSubmit={submit} className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-black text-slate-900 mb-6">회차 추가</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5">회차 이름</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="2026 6월 모의평가 1회" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5">소제목 (선택)</label>
                        <input value={subTitle} onChange={e => setSubTitle(e.target.value)} placeholder="독서 · 문학 영역" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5">대상 학년</label>
                        <input type="number" value={grade} onChange={e => setGrade(e.target.value)} placeholder="1 / 2 / 3" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={requireAcademyCode} onChange={e => setRequireAcademyCode(e.target.checked)} className="accent-teal-600 w-4 h-4" />
                        <span className="text-sm font-bold text-slate-700">학원 코드 필요 (체크 해제 시 누구나 풀 수 있음)</span>
                    </label>
                </div>
                <div className="flex gap-2 mt-6">
                    <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-black hover:bg-slate-200">취소</button>
                    <button type="submit" disabled={busy} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-black hover:bg-teal-700 disabled:bg-slate-300 flex items-center justify-center gap-1.5">
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                        만들기
                    </button>
                </div>
            </form>
        </div>
    );
}
