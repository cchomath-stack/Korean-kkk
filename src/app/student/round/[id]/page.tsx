'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Loader2, AlertCircle, Send, CheckCircle2, Lock, Building2, FileText } from 'lucide-react';

type StudentRoundItem = {
    id: number;
    kind: 'passage' | 'question';
    order: number;
    passage: any | null;
    question: any | null;
};

type StudentRound = {
    id: number;
    title: string;
    subTitle: string | null;
    grade: number | null;
    requireAcademyCode: boolean;
    items: StudentRoundItem[];
};

type Academy = { id: number; name: string; defaultDesign: string };

export default function StudentRoundPage() {
    const params = useParams();
    const id = params.id as string;
    const [round, setRound] = useState<StudentRound | null>(null);
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [loading, setLoading] = useState(true);

    // 학생 정보
    const [studentName, setStudentName] = useState('');
    const [school, setSchool] = useState('');
    const [grade, setGrade] = useState('');
    const [academyCode, setAcademyCode] = useState('');
    const [academyId, setAcademyId] = useState('');
    const [academyVerified, setAcademyVerified] = useState<Academy | null>(null);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    // 체크된 문항
    const [checked, setChecked] = useState<Set<number>>(new Set());

    // 제출
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const [r, a] = await Promise.all([
                fetch(`/api/student/round?id=${id}`),
                fetch('/api/student/academy'),
            ]);
            if (r.ok) setRound(await r.json());
            if (a.ok) setAcademies(await a.json());
            setLoading(false);
        })();
    }, [id]);

    const verifyCode = async () => {
        setVerifyError(null);
        if (!academyCode.trim()) return;
        const res = await fetch('/api/student/academy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: academyCode.trim() }),
        });
        if (res.ok) {
            const data = await res.json();
            setAcademyVerified(data);
        } else {
            const err = await res.json().catch(() => ({}));
            setVerifyError(err.error || '코드 확인 실패');
            setAcademyVerified(null);
        }
    };

    const toggleItem = (itemId: number) => {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const canSubmit = useMemo(() => {
        if (!round) return false;
        if (!studentName.trim()) return false;
        if (checked.size === 0) return false;
        if (round.requireAcademyCode && !academyVerified) return false;
        if (!round.requireAcademyCode && !academyId) return false;
        return true;
    }, [round, studentName, checked, academyVerified, academyId]);

    const handleSubmit = async () => {
        if (!round || !canSubmit) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch('/api/student/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roundId: round.id,
                    studentName,
                    school,
                    grade,
                    academyCode: round.requireAcademyCode ? academyCode : undefined,
                    academyId: !round.requireAcademyCode ? parseInt(academyId, 10) : undefined,
                    wrongItemIds: Array.from(checked),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setSubmitError(err.error || '제출 실패');
                return;
            }
            setDone(true);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-teal-50"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;
    if (!round) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
            <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
            <p className="text-slate-600 font-bold">회차를 찾을 수 없습니다.</p>
            <Link href="/student" className="mt-4 text-teal-600 font-bold underline">목록으로</Link>
        </div>
    );

    if (done) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white p-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">제출 완료!</h1>
            <p className="text-slate-500 font-medium text-center mb-6">
                오답노트가 곧 학원에 전달됩니다.<br />
                학원에서 인쇄된 노트를 받으실 수 있어요.
            </p>
            <Link href="/student" className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black">처음으로</Link>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link href="/student" className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-grow min-w-0">
                        <h1 className="text-base font-black text-slate-900 truncate">{round.title}</h1>
                        <p className="text-[11px] text-slate-400 font-bold">
                            {round.subTitle ? `${round.subTitle} · ` : ''}{round.items.length}문제 중 {checked.size}개 체크
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6">
                {/* 학생 정보 카드 */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">학생 정보</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input label="이름 *" value={studentName} onChange={setStudentName} placeholder="홍길동" />
                        <Input label="학교" value={school} onChange={setSchool} placeholder="○○고등학교" />
                        <Input label="학년" type="number" value={grade} onChange={setGrade} placeholder="1 / 2 / 3" />
                        {round.requireAcademyCode ? (
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                                    <Lock className="w-3 h-3 inline mr-1" /> 학원 코드 *
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        value={academyCode}
                                        onChange={e => { setAcademyCode(e.target.value); setAcademyVerified(null); }}
                                        placeholder="학원에서 받은 코드"
                                        className="flex-grow px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none"
                                    />
                                    <button onClick={verifyCode} disabled={!academyCode.trim()} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-black">
                                        확인
                                    </button>
                                </div>
                                {academyVerified && (
                                    <p className="mt-2 text-xs font-bold text-emerald-700 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> {academyVerified.name}
                                    </p>
                                )}
                                {verifyError && <p className="mt-2 text-xs font-bold text-rose-600">{verifyError}</p>}
                            </div>
                        ) : (
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                                    <Building2 className="w-3 h-3 inline mr-1" /> 학원 *
                                </label>
                                <select value={academyId} onChange={e => setAcademyId(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none">
                                    <option value="">선택해주세요</option>
                                    {academies.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* 문항 그리드 */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">틀린 문제 체크 ({checked.size}/{round.items.length})</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {round.items.map((it, idx) => (
                            <ItemTile key={it.id} item={it} index={idx} checked={checked.has(it.id)} onToggle={() => toggleItem(it.id)} />
                        ))}
                    </div>
                </div>
            </main>

            {/* 고정 제출 바 */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl z-50">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <div className="flex-grow">
                        <p className="text-sm font-black text-slate-900">{checked.size} 문제 체크됨</p>
                        {submitError && <p className="text-xs font-bold text-rose-600">{submitError}</p>}
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || submitting}
                        className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl font-black shadow-lg shadow-teal-200"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        제출하기
                    </button>
                </div>
            </div>
        </div>
    );
}

function Input({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
    return (
        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
        </div>
    );
}

function ItemTile({ item, index, checked, onToggle }: { item: StudentRoundItem; index: number; checked: boolean; onToggle: () => void }) {
    const isPassage = item.kind === 'passage';
    const obj = isPassage ? item.passage : item.question;
    const imgSrc = isPassage
        ? (item.passage?.imageUrl || item.passage?.images?.[0]?.imageUrl)
        : item.question?.imageUrl;
    const label = isPassage
        ? `지문 ${item.passage?.questionRange || ''}`
        : `${item.question?.questionNo ?? '?'}번`;

    return (
        <button
            onClick={onToggle}
            className={`relative bg-slate-50 rounded-xl overflow-hidden border-2 transition-all ${checked ? 'border-teal-500 ring-2 ring-teal-200' : 'border-transparent hover:border-slate-300'}`}
        >
            <div className="aspect-[3/4] bg-white relative">
                {imgSrc ? (
                    <img src={imgSrc} alt={label} className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-slate-200" />
                    </div>
                )}
                {checked && (
                    <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center">
                        <div className="w-12 h-12 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-lg">
                            <CheckCircle2 className="w-7 h-7" />
                        </div>
                    </div>
                )}
            </div>
            <div className="px-2 py-1.5 bg-white border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-600">{label}</span>
                <span className="text-[9px] text-slate-400 font-bold">#{index + 1}</span>
            </div>
        </button>
    );
}
