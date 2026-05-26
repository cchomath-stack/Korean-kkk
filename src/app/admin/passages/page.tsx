'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
    Home, BookOpen, Search, Loader2, Edit2, Trash2, ChevronLeft, ChevronRight, Save, X
} from 'lucide-react';

const AREAS = ['문학', '독서', '화작', '언매'];

type Passage = {
    id: number;
    ocrText: string | null;
    year: number | null;
    month: number | null;
    grade: number | null;
    area: string | null;
    source: string | null;
    startNo: number | null;
    endNo: number | null;
    questionRange: string | null;
    imageUrl: string | null;
    tags: { tag: { id: number; name: string } }[];
    _count: { questions: number; images: number };
    createdAt: string;
};

export default function PassagesAdminPage() {
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [items, setItems] = useState<Passage[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [editId, setEditId] = useState<number | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q), 350);
        return () => clearTimeout(t);
    }, [q]);

    const fetchList = useCallback(async (qParam: string, pageParam: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/passages?q=${encodeURIComponent(qParam)}&page=${pageParam}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.items);
                setTotalPages(data.totalPages);
                setTotal(data.total);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchList(debouncedQ, page);
    }, [debouncedQ, page, fetchList]);

    const handleDelete = async (id: number) => {
        if (!confirm('이 지문과 연관된 모든 문제가 함께 삭제됩니다. 계속할까요?')) return;
        const res = await fetch(`/api/admin/passage?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            fetchList(debouncedQ, page);
        } else {
            alert('삭제 실패');
        }
    };

    const handleSaved = () => {
        setEditId(null);
        fetchList(debouncedQ, page);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="h-14 px-6 flex items-center gap-4 border-b bg-white shadow-sm sticky top-0 z-40">
                <Link href="/" className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-sm font-medium">
                    <Home size={16} /> 홈
                </Link>
                <span className="text-slate-300">|</span>
                <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <BookOpen size={16} /> 지문 관리
                </h1>
                <span className="text-xs text-slate-400 font-medium">총 {total}건</span>
                <div className="ml-auto flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 w-80">
                    <Search size={14} className="text-slate-400" />
                    <input
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setPage(1); }}
                        placeholder="OCR 본문 / 영역 / 출처 / 태그 검색"
                        className="bg-transparent outline-none text-sm flex-1 text-slate-900"
                    />
                    {q && <button onClick={() => setQ('')} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>}
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-500 py-10 justify-center">
                        <Loader2 className="animate-spin" size={16} /> 불러오는 중...
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                        검색 결과가 없습니다.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((p) => (
                            editId === p.id
                                ? <PassageEditCard key={p.id} passage={p} onCancel={() => setEditId(null)} onSaved={handleSaved} />
                                : <PassageRow key={p.id} passage={p} onEdit={() => setEditId(p.id)} onDelete={() => handleDelete(p.id)} />
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                            className="px-3 py-1.5 text-sm font-bold rounded border bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
                            <ChevronLeft size={14} /> 이전
                        </button>
                        <span className="text-sm font-bold text-slate-600 px-3">
                            {page} / {totalPages}
                        </span>
                        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                            className="px-3 py-1.5 text-sm font-bold rounded border bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
                            다음 <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

function PassageRow({ passage, onEdit, onDelete }: { passage: Passage; onEdit: () => void; onDelete: () => void }) {
    const label = [
        passage.year && passage.month ? `${passage.year}.${String(passage.month).padStart(2, '0')}` : null,
        passage.grade ? `${passage.grade}학년` : null,
        passage.area,
        passage.questionRange ? `${passage.questionRange}번` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 shadow-sm hover:shadow-md transition">
            {passage.imageUrl && (
                <img src={passage.imageUrl} alt="" className="w-16 h-20 object-cover rounded border border-slate-200 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-400">#{passage.id}</span>
                    <span className="text-sm font-bold text-slate-800">{label || '메타 미입력'}</span>
                    <span className="text-xs text-slate-400">· 문제 {passage._count.questions} · 이미지 {passage._count.images}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 italic mb-2">
                    {passage.ocrText ? `"${passage.ocrText.slice(0, 200)}"` : '(OCR 본문 없음)'}
                </p>
                <div className="flex flex-wrap gap-1">
                    {passage.tags.map((pt) => (
                        <span key={pt.tag.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                            #{pt.tag.name}
                        </span>
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
                <Link href={`/viewer/${passage.id}`}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700">
                    보기
                </Link>
                <button onClick={onEdit}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1 justify-center">
                    <Edit2 size={12} /> 수정
                </button>
                <button onClick={onDelete}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1 justify-center">
                    <Trash2 size={12} /> 삭제
                </button>
            </div>
        </div>
    );
}

function PassageEditCard({ passage, onCancel, onSaved }: { passage: Passage; onCancel: () => void; onSaved: () => void }) {
    const [form, setForm] = useState({
        year: passage.year?.toString() || '',
        month: passage.month?.toString() || '',
        grade: passage.grade?.toString() || '',
        area: passage.area || '',
        source: passage.source || '',
        startNo: passage.startNo?.toString() || '',
        endNo: passage.endNo?.toString() || '',
        ocrText: passage.ocrText || '',
    });
    const [tags, setTags] = useState<string[]>(passage.tags.map((pt) => pt.tag.name));
    const [tagInput, setTagInput] = useState('');
    const [saving, setSaving] = useState(false);

    const addTag = () => {
        const v = tagInput.trim();
        if (!v) return;
        if (!tags.includes(v)) setTags([...tags, v]);
        setTagInput('');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/passage', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: passage.id, ...form, tags }),
            });
            if (res.ok) {
                onSaved();
            } else {
                const data = await res.json().catch(() => ({}));
                alert('수정 실패: ' + (data.error || res.status));
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border-2 border-teal-400 p-5 shadow-md">
            <div className="flex items-center gap-2 mb-4">
                <Edit2 size={14} className="text-teal-600" />
                <h3 className="font-bold text-slate-800 text-sm">지문 #{passage.id} 수정</h3>
                <button onClick={onCancel} className="ml-auto text-slate-400 hover:text-slate-700"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <Field label="연도">
                    <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                </Field>
                <Field label="월">
                    <input type="number" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                </Field>
                <Field label="학년">
                    <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900 bg-white">
                        <option value="">-</option>
                        <option value="1">1학년</option>
                        <option value="2">2학년</option>
                        <option value="3">3학년</option>
                    </select>
                </Field>
                <Field label="영역">
                    <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900 bg-white">
                        <option value="">-</option>
                        {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                </Field>
                <Field label="시작 번호">
                    <input type="number" value={form.startNo} onChange={(e) => setForm({ ...form, startNo: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                </Field>
                <Field label="끝 번호">
                    <input type="number" value={form.endNo} onChange={(e) => setForm({ ...form, endNo: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                </Field>
                <Field label="출처">
                    <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900" placeholder="평가원/교육청..." />
                </Field>
            </div>

            <Field label="OCR 본문">
                <textarea value={form.ocrText} onChange={(e) => setForm({ ...form, ocrText: e.target.value })}
                    rows={4}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900 font-sans resize-y" />
            </Field>

            <Field label="태그">
                <div className="flex flex-wrap items-center gap-1.5">
                    {tags.map((t) => (
                        <span key={t} className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-300 flex items-center gap-1">
                            #{t}
                            <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-teal-600 hover:text-teal-900">×</button>
                        </span>
                    ))}
                    <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                        onBlur={addTag}
                        placeholder="Enter 또는 콤마로 추가"
                        className="text-sm border border-slate-200 rounded px-2 py-0.5 flex-1 min-w-32 text-slate-900" />
                </div>
            </Field>

            <div className="flex justify-end gap-2 mt-4">
                <button onClick={onCancel}
                    className="px-3 py-1.5 text-sm font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700">
                    취소
                </button>
                <button onClick={handleSave} disabled={saving}
                    className="px-4 py-1.5 text-sm font-bold rounded bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    저장
                </button>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
            {children}
        </div>
    );
}
