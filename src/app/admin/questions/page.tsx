'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Home, Loader2, ChevronLeft, ChevronRight, Save, X, Search, FileText, Filter,
    ArrowUpDown, Edit2, ImageIcon,
} from 'lucide-react';
import { QuestionImageEditor } from '@/components/QuestionImageEditor';

type Q = {
    id: number;
    imageUrl: string;
    questionNo: number | null;
    sourceKey: string | null;
    imageNo: number | null;
    answer: string | null;
    difficulty: string | null;
    ocrText: string | null;
    createdAt: string;
    passage: {
        id: number;
        year: number | null;
        month: number | null;
        grade: number | null;
        area: string | null;
        questionRange: string | null;
    } | null;
    grammarCategories: {
        category: {
            id: number;
            name: string;
            parent: { id: number; name: string } | null;
        };
    }[];
};

function QuestionsAdminInner() {
    const router = useRouter();
    const sp = useSearchParams();

    const sort = sp.get('sort') || 'recent';
    const filter = sp.get('filter') || 'all';
    const grammar = sp.get('grammar') || '';
    const passageId = sp.get('passage') || '';
    const q = sp.get('q') || '';
    const page = parseInt(sp.get('page') || '1', 10);

    const [items, setItems] = useState<Q[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Q | null>(null);
    const [qLocal, setQLocal] = useState(q);
    const [debouncedQ, setDebouncedQ] = useState(q);
    const [categoryName, setCategoryName] = useState<string | null>(null);

    // qLocal debounce
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(qLocal), 350);
        return () => clearTimeout(t);
    }, [qLocal]);

    // debouncedQ 바뀌면 URL의 q도 갱신 (page=1로 리셋)
    useEffect(() => {
        if (debouncedQ === q) return;
        updateParam({ q: debouncedQ, page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQ]);

    const updateParam = (patch: Record<string, string | number | null>) => {
        const params = new URLSearchParams(sp.toString());
        for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '' || v === undefined) params.delete(k);
            else params.set(k, String(v));
        }
        router.replace(`/admin/questions?${params.toString()}`);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                sort, filter, page: String(page),
                ...(grammar && { grammar }),
                ...(passageId && { passage: passageId }),
                ...(q && { q }),
            });
            const res = await fetch(`/api/admin/questions/list?${params}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.items);
                setTotal(data.total);
                setTotalPages(data.totalPages);
            }
        } finally {
            setLoading(false);
        }
    }, [sort, filter, grammar, passageId, q, page]);

    useEffect(() => { load(); }, [load]);

    // 카테고리 필터가 걸린 경우 이름 표시
    useEffect(() => {
        if (!grammar) { setCategoryName(null); return; }
        fetch('/api/grammar/categories').then(r => r.json()).then(data => {
            const tree = data.tree || [];
            for (const root of tree) {
                if (root.id === parseInt(grammar, 10)) { setCategoryName(root.name); return; }
                for (const child of root.children || []) {
                    if (child.id === parseInt(grammar, 10)) {
                        setCategoryName(`${root.name} / ${child.name}`);
                        return;
                    }
                }
            }
        });
    }, [grammar]);

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="h-14 px-6 flex items-center gap-4 border-b bg-white shadow-sm sticky top-0 z-40">
                <Link href="/" className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-sm font-medium">
                    <Home size={16} /> 홈
                </Link>
                <span className="text-slate-300">|</span>
                <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <FileText size={16} /> 문제 관리
                </h1>
                <span className="text-xs text-slate-400 font-medium">총 {total}건</span>
                <div className="ml-auto flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 w-72">
                    <Search size={14} className="text-slate-400" />
                    <input
                        value={qLocal}
                        onChange={(e) => setQLocal(e.target.value)}
                        placeholder="모고키워드 (m0123...) / OCR"
                        className="bg-transparent outline-none text-sm flex-1 text-slate-900"
                    />
                    {qLocal && <button onClick={() => setQLocal('')} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>}
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">
                {/* 필터/정렬 바 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <ArrowUpDown size={14} className="text-slate-500" />
                        <label className="text-xs font-black text-slate-600">정렬</label>
                        <select
                            value={sort}
                            onChange={(e) => updateParam({ sort: e.target.value, page: 1 })}
                            className="px-2 py-1 text-xs font-bold border border-slate-200 rounded bg-white"
                        >
                            <option value="recent">입력순 (최신)</option>
                            <option value="imageNo">이미지번호↑</option>
                            <option value="sourceKey">모고키워드↑</option>
                            <option value="passage">지문순</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-slate-500" />
                        <label className="text-xs font-black text-slate-600">필터</label>
                        <select
                            value={filter}
                            onChange={(e) => updateParam({ filter: e.target.value, page: 1 })}
                            className="px-2 py-1 text-xs font-bold border border-slate-200 rounded bg-white"
                        >
                            <option value="all">전체</option>
                            <option value="mock">모고 문제만 (키워드 있음)</option>
                        </select>
                    </div>
                    {categoryName && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 rounded-full">
                            <span className="text-xs font-black">카테고리:</span>
                            <span className="text-xs font-bold">{categoryName}</span>
                            <button onClick={() => updateParam({ grammar: null, page: 1 })} className="text-teal-700 hover:text-teal-900">
                                <X size={12} />
                            </button>
                        </div>
                    )}
                    {passageId && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-700 rounded-full">
                            <span className="text-xs font-black">지문:</span>
                            <span className="text-xs font-bold">#{passageId}</span>
                            <button onClick={() => updateParam({ passage: null, page: 1 })} className="text-purple-700 hover:text-purple-900">
                                <X size={12} />
                            </button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 text-slate-500 py-16 justify-center">
                        <Loader2 className="animate-spin" size={16} /> 불러오는 중...
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200 font-bold">
                        결과가 없습니다.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((it) => (
                            <QuestionCard
                                key={it.id}
                                q={it}
                                onEdit={() => setEditing(it)}
                            />
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                        <button
                            disabled={page <= 1}
                            onClick={() => updateParam({ page: page - 1 })}
                            className="px-3 py-1.5 text-sm font-bold rounded border bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
                        >
                            <ChevronLeft size={14} /> 이전
                        </button>
                        <span className="text-sm font-bold text-slate-600 px-3">
                            {page} / {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => updateParam({ page: page + 1 })}
                            className="px-3 py-1.5 text-sm font-bold rounded border bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
                        >
                            다음 <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </main>

            {editing && (
                <QuestionEditModal
                    initial={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load(); }}
                />
            )}
        </div>
    );
}

export default function QuestionsAdminPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={24} /></div>}>
            <QuestionsAdminInner />
        </Suspense>
    );
}

function QuestionCard({ q, onEdit }: { q: Q; onEdit: () => void }) {
    const passageLabel = q.passage
        ? [
            q.passage.year && q.passage.month ? `${q.passage.year}.${String(q.passage.month).padStart(2, '0')}` : null,
            q.passage.grade ? `고${q.passage.grade}` : null,
            q.passage.area,
        ].filter(Boolean).join(' · ')
        : '단독 문제';
    const categoryLabels = q.grammarCategories
        .map(gc => gc.category.parent ? `${gc.category.parent.name} / ${gc.category.name}` : gc.category.name)
        .slice(0, 3);
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm hover:shadow-lg transition group">
            <div className="aspect-[4/3] bg-slate-50 rounded-lg overflow-hidden mb-2 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.imageUrl} alt={`Q${q.id}`} className="w-full h-full object-contain" />
                {q.sourceKey && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur text-white text-[10px] font-black rounded font-mono">
                        {q.sourceKey}
                    </div>
                )}
                {q.imageNo != null && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-teal-600 text-white text-[10px] font-black rounded">
                        #{q.imageNo}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-1">
                <span>DB#{q.id}</span>
                <span>·</span>
                <span>{passageLabel}</span>
                {q.difficulty && <span className={`px-1.5 py-0.5 rounded ${q.difficulty === '상' ? 'bg-red-50 text-red-500' : q.difficulty === '하' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600'}`}>{q.difficulty}</span>}
            </div>
            {categoryLabels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {categoryLabels.map((c, i) => (
                        <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">{c}</span>
                    ))}
                </div>
            )}
            <div className="flex gap-1.5">
                <Link
                    href={q.passage ? `/viewer/${q.passage.id}` : `/viewer/${q.id}`}
                    className="flex-1 text-center px-2 py-1.5 text-xs font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                    보기
                </Link>
                <button
                    onClick={onEdit}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold rounded bg-teal-600 text-white hover:bg-teal-700"
                >
                    <Edit2 size={11} /> 편집
                </button>
            </div>
        </div>
    );
}

// ============ 편집 모달 ============
export function QuestionEditModal({
    initial, onClose, onSaved,
}: {
    initial: Q;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [form, setForm] = useState({
        sourceKey: initial.sourceKey || '',
        imageNo: initial.imageNo?.toString() || '',
        answer: initial.answer || '',
        difficulty: initial.difficulty || '',
        ocrText: initial.ocrText || '',
    });
    const [saving, setSaving] = useState(false);
    const [imageUrl, setImageUrl] = useState<string>(initial.imageUrl || '');
    const [imageEditorOpen, setImageEditorOpen] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            // sourceKey 마지막 2자리에서 questionNo 자동 추출
            const trimmedKey = form.sourceKey.trim();
            const keyMatch = /^m\d{2}\d{2}\d{2}(\d{2})$/.exec(trimmedKey);
            const derivedQuestionNo = keyMatch ? keyMatch[1] : (initial.questionNo?.toString() || '');

            const res = await fetch('/api/admin/question', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: initial.id,
                    sourceKey: trimmedKey,
                    imageNo: form.imageNo,
                    questionNo: derivedQuestionNo,
                    answer: form.answer,
                    difficulty: form.difficulty,
                    ocrText: form.ocrText,
                }),
            });
            if (res.ok) onSaved();
            else {
                const e = await res.json().catch(() => ({}));
                alert('저장 실패: ' + (e.detail || e.error || res.status));
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Edit2 size={16} className="text-teal-600" />
                    <h2 className="font-black text-slate-900">문제 #{initial.id} 편집</h2>
                    <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700"><X size={18} /></button>
                </div>

                {/* 이미지 미리보기 + 편집 */}
                <div className="mb-4 bg-slate-50 rounded-lg p-2 border border-slate-200 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="" className="w-full max-h-64 object-contain" />
                    <button
                        type="button"
                        onClick={() => setImageEditorOpen(true)}
                        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white/95 border border-slate-200 rounded shadow hover:bg-slate-100 text-xs font-black text-slate-700"
                    >
                        <ImageIcon size={12} /> 이미지 편집
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">모고입력키워드</label>
                                <input
                                    value={form.sourceKey}
                                    onChange={(e) => setForm({ ...form, sourceKey: e.target.value })}
                                    placeholder="m01231117"
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono text-slate-900"
                                />
                                <p className="text-[9px] text-slate-400 mt-1 font-medium">예: 고1 23년 11월 17번 → m01231117</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">이미지 문제번호</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={999}
                                    value={form.imageNo}
                                    onChange={(e) => setForm({ ...form, imageNo: e.target.value })}
                                    placeholder="1~999"
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">난이도</label>
                                <select
                                    value={form.difficulty}
                                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900"
                                >
                                    <option value="">-</option>
                                    <option value="상">상</option>
                                    <option value="중">중</option>
                                    <option value="하">하</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">정답</label>
                                <input
                                    value={form.answer}
                                    onChange={(e) => setForm({ ...form, answer: e.target.value })}
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
                                />
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">OCR 본문</label>
                            <textarea
                                value={form.ocrText}
                                onChange={(e) => setForm({ ...form, ocrText: e.target.value })}
                                rows={3}
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900 resize-y"
                            />
                        </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700">
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-1.5 text-sm font-bold rounded bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        저장
                    </button>
                </div>
            </div>
            {imageEditorOpen && (
                <QuestionImageEditor
                    questionId={initial.id}
                    imageUrl={imageUrl}
                    onChanged={(newUrl) => {
                        setImageUrl(newUrl);
                        setImageEditorOpen(false);
                        onSaved();
                    }}
                    onClose={() => setImageEditorOpen(false)}
                />
            )}
        </div>
    );
}
