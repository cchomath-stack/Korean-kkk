'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, Loader2, Building2, ChevronLeft, Copy, Check } from 'lucide-react';

type Academy = {
    id: number;
    name: string;
    code: string;
    defaultDesign: string;
    logoUrl: string | null;
    createdAt: string;
};

export default function AcademiesPage() {
    const [list, setList] = useState<Academy[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Academy | null>(null);
    const [showForm, setShowForm] = useState(false);

    const load = async () => {
        setLoading(true);
        const res = await fetch('/api/admin/academy');
        if (res.ok) setList(await res.json());
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`"${name}" 학원을 삭제할까요? (학원의 오답노트 요청도 학원 정보가 사라집니다)`)) return;
        await fetch(`/api/admin/academy?id=${id}`, { method: 'DELETE' });
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
                            <h1 className="text-lg font-black text-slate-900">학원 관리</h1>
                            <p className="text-xs font-bold text-slate-400">오답노트 발급 학원 마스터</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setEditing(null); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-black hover:bg-teal-700"
                    >
                        <Plus className="w-4 h-4" />
                        학원 추가
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
                ) : list.length === 0 ? (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
                        <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="font-black text-slate-400 text-lg mb-3">등록된 학원이 없습니다</p>
                        <button
                            onClick={() => { setEditing(null); setShowForm(true); }}
                            className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-black hover:bg-teal-700"
                        >첫 학원 추가하기</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {list.map(a => (
                            <AcademyCard key={a.id} academy={a} onEdit={() => { setEditing(a); setShowForm(true); }} onDelete={() => handleDelete(a.id, a.name)} />
                        ))}
                    </div>
                )}
            </main>

            {showForm && (
                <AcademyFormModal
                    initial={editing}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); load(); }}
                />
            )}
        </div>
    );
}

function AcademyCard({ academy, onEdit, onDelete }: { academy: Academy; onEdit: () => void; onDelete: () => void }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-teal-500" />
                        <h3 className="font-black text-slate-900">{academy.name}</h3>
                    </div>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-black rounded ${academy.defaultDesign === 'mexx' ? 'bg-slate-900 text-white' : 'bg-teal-50 text-teal-700'}`}>
                    {academy.defaultDesign === 'mexx' ? 'MEXX 디자인' : '오름 디자인'}
                </span>
            </div>
            <div className="mb-4 flex items-center gap-2">
                <code className="flex-grow px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-700">
                    {academy.code}
                </code>
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(academy.code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600"
                    title="코드 복사"
                >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>
            <div className="flex gap-2">
                <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black">
                    <Edit2 className="w-3 h-3" /> 수정
                </button>
                <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black">
                    <Trash2 className="w-3 h-3" /> 삭제
                </button>
            </div>
        </div>
    );
}

function AcademyFormModal({ initial, onClose, onSaved }: { initial: Academy | null; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(initial?.name ?? '');
    const [code, setCode] = useState(initial?.code ?? '');
    const [defaultDesign, setDefaultDesign] = useState(initial?.defaultDesign ?? 'oreum');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/academy', {
                method: initial ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: initial?.id, name, code, defaultDesign }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || '저장 실패');
                return;
            }
            onSaved();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4" onClick={onClose}>
            <form onSubmit={submit} className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-black text-slate-900 mb-6">{initial ? '학원 수정' : '학원 추가'}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5">학원 이름</label>
                        <input value={name} onChange={e => setName(e.target.value)} required placeholder="김가경국어연구소" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5">학원 코드 (학생이 입력)</label>
                        <input value={code} onChange={e => setCode(e.target.value)} required placeholder="OREUM-2026" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5">기본 디자인</label>
                        <div className="flex gap-2">
                            <label className={`flex-1 cursor-pointer px-4 py-3 rounded-xl border-2 text-center text-sm font-black ${defaultDesign === 'oreum' ? 'bg-teal-50 border-teal-400 text-teal-700' : 'border-slate-200 text-slate-500'}`}>
                                <input type="radio" name="design" value="oreum" checked={defaultDesign === 'oreum'} onChange={() => setDefaultDesign('oreum')} className="hidden" />
                                🌿 오름
                            </label>
                            <label className={`flex-1 cursor-pointer px-4 py-3 rounded-xl border-2 text-center text-sm font-black ${defaultDesign === 'mexx' ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-500'}`}>
                                <input type="radio" name="design" value="mexx" checked={defaultDesign === 'mexx'} onChange={() => setDefaultDesign('mexx')} className="hidden" />
                                ▪ MEXX
                            </label>
                        </div>
                    </div>
                </div>
                {error && <p className="mt-4 text-xs text-rose-600 font-bold">{error}</p>}
                <div className="flex gap-2 mt-6">
                    <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-black hover:bg-slate-200">취소</button>
                    <button type="submit" disabled={busy} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-black hover:bg-teal-700 disabled:bg-slate-300 flex items-center justify-center gap-1.5">
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                        저장
                    </button>
                </div>
            </form>
        </div>
    );
}
