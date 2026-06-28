'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor,
    useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates,
    useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ChevronLeft, GripVertical, Trash2, Loader2, Search, X, FileText, BookOpen, Plus,
} from 'lucide-react';

type RoundItem = {
    id: number;
    kind: 'passage' | 'question';
    order: number;
    passageId: number | null;
    questionId: number | null;
    passage: any | null;
    question: any | null;
};

type Round = {
    id: number;
    title: string;
    subTitle: string | null;
    grade: number | null;
    isPublic: boolean;
    requireAcademyCode: boolean;
    items: RoundItem[];
};

export default function RoundEditPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [round, setRound] = useState<Round | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const res = await fetch(`/api/admin/round?id=${id}&hydrate=1`);
        if (res.ok) setRound(await res.json());
        setLoading(false);
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const updateMeta = async (patch: Partial<Round>) => {
        if (!round) return;
        setSaving(true);
        const res = await fetch('/api/admin/round', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: round.id, ...patch }),
        });
        if (res.ok) {
            const u = await res.json();
            setRound(prev => prev ? { ...prev, ...u } : prev);
        }
        setSaving(false);
    };

    const addItem = async (kind: 'passage' | 'question', passageId?: number, questionId?: number) => {
        if (!round) return;
        await fetch('/api/admin/round/item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId: round.id, kind, passageId, questionId }),
        });
        load();
    };

    const removeItem = async (itemId: number) => {
        await fetch(`/api/admin/round/item?id=${itemId}`, { method: 'DELETE' });
        load();
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !round) return;
        const oldIndex = round.items.findIndex(i => i.id === active.id);
        const newIndex = round.items.findIndex(i => i.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        const newItems = arrayMove(round.items, oldIndex, newIndex).map((it, idx) => ({ ...it, order: idx }));
        setRound(prev => prev ? { ...prev, items: newItems } : prev);
        await fetch('/api/admin/round/item', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roundId: round.id,
                items: newItems.map(i => ({ id: i.id, order: i.order })),
            }),
        });
    }, [round]);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;
    if (!round) return <div className="min-h-screen flex flex-col items-center justify-center"><p className="text-slate-600 font-bold">회차를 찾을 수 없습니다.</p></div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/rounds" className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-black text-slate-900">{round.title}</h1>
                            <p className="text-xs font-bold text-slate-400">문항 {round.items.length}개 {saving && '· 저장 중...'}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
                <aside className="space-y-4 lg:sticky lg:top-24 self-start">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">회차 정보</h2>
                        <div className="space-y-3">
                            <FieldText label="제목" value={round.title} onSave={v => updateMeta({ title: v })} />
                            <FieldText label="소제목" value={round.subTitle ?? ''} onSave={v => updateMeta({ subTitle: v })} />
                            <FieldText label="학년" type="number" value={round.grade?.toString() ?? ''} onSave={v => updateMeta({ grade: v === '' ? null : parseInt(v, 10) as any })} />
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={round.isPublic} onChange={e => updateMeta({ isPublic: e.target.checked })} className="accent-teal-600 w-4 h-4" />
                                학생에게 공개
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={round.requireAcademyCode} onChange={e => updateMeta({ requireAcademyCode: e.target.checked })} className="accent-teal-600 w-4 h-4" />
                                학원 코드 필요
                            </label>
                        </div>
                    </div>
                    <SearchPanel onAdd={addItem} />
                </aside>

                <main>
                    {round.items.length === 0 ? (
                        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
                            <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="font-black text-slate-400 text-lg mb-1">담긴 문항이 없습니다</p>
                            <p className="text-sm text-slate-400 font-medium">좌측 검색에서 문제를 담아주세요</p>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={round.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-3">
                                    {round.items.map((it, idx) => (
                                        <SortableRow key={it.id} item={it} index={idx} onRemove={() => removeItem(it.id)} />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </main>
            </div>
        </div>
    );
}

function FieldText({ label, value, onSave, type = 'text' }: { label: string; value: string; onSave: (v: string) => void; type?: string }) {
    const [local, setLocal] = useState(value);
    useEffect(() => setLocal(value), [value]);
    return (
        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{label}</label>
            <input type={type} value={local} onChange={e => setLocal(e.target.value)} onBlur={() => { if (local !== value) onSave(local); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
        </div>
    );
}

function SearchPanel({ onAdd }: { onAdd: (kind: 'passage' | 'question', passageId?: number, questionId?: number) => void }) {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<{ passages: any[]; questions: any[] } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query), 400);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        if (!debouncedQuery.trim()) { setResults(null); return; }
        let cancelled = false;
        (async () => {
            setLoading(true);
            const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
            if (res.ok && !cancelled) setResults(await res.json());
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-teal-50">
                <div className="flex items-center gap-2 mb-2">
                    <Search className="w-4 h-4 text-teal-600" />
                    <h2 className="text-sm font-black text-slate-700">문제 검색해서 담기</h2>
                </div>
                <div className="relative">
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="본문, #해시태그, 영역..." className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                    <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                    {query && (
                        <button onClick={() => { setQuery(''); setResults(null); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
                {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>}
                {!loading && !results && <div className="px-4 py-8 text-center text-xs text-slate-400 font-bold">검색어를 입력하세요</div>}
                {!loading && results && results.passages.map((p: any) => (
                    <div key={`p-${p.id}`} className="px-4 py-3 border-b border-slate-50 hover:bg-slate-50 flex items-start gap-2">
                        <FileText className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-grow min-w-0">
                            <p className="text-[11px] font-black text-slate-700 truncate">지문 · {p.year}.{p.month} {p.grade}학년</p>
                            <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{p.ocrText?.slice(0, 80) || ''}</p>
                        </div>
                        <button onClick={() => onAdd('passage', p.id)} className="flex items-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-black">
                            <Plus className="w-3 h-3" /> 담기
                        </button>
                    </div>
                ))}
                {!loading && results && results.questions.map((q: any) => (
                    <div key={`q-${q.id}`} className="px-4 py-3 border-b border-slate-50 hover:bg-slate-50 flex items-start gap-2">
                        <img src={q.imageUrl} alt="" className="w-10 h-10 object-cover rounded border border-slate-100 flex-shrink-0" />
                        <div className="flex-grow min-w-0">
                            <p className="text-[11px] font-black text-slate-700 truncate">
                                {q.questionNo ? `${q.questionNo}번` : '문제'} · {q.passage?.year ?? q.year ?? ''}.{q.passage?.month ?? q.month ?? ''}
                            </p>
                            <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{q.ocrText?.slice(0, 80) || ''}</p>
                        </div>
                        <button onClick={() => onAdd('question', undefined, q.id)} className="flex items-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-black">
                            <Plus className="w-3 h-3" /> 담기
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SortableRow({ item, index, onRemove }: { item: RoundItem; index: number; onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    const isPassage = item.kind === 'passage';
    const obj = isPassage ? item.passage : item.question;
    const imgSrc = isPassage
        ? (item.passage?.imageUrl || item.passage?.images?.[0]?.imageUrl)
        : item.question?.imageUrl;

    return (
        <div ref={setNodeRef} style={style} className={`bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 p-3 ${isDragging ? 'shadow-xl ring-2 ring-teal-300' : ''}`}>
            <button type="button" {...attributes} {...listeners} className="p-2 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg touch-none">
                <GripVertical className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 bg-teal-600 text-white rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0">{index + 1}</div>
            {imgSrc ? (
                <img src={imgSrc} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-100 flex-shrink-0" />
            ) : (
                <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-slate-300" />
                </div>
            )}
            <div className="flex-grow min-w-0">
                <p className="text-xs font-black text-slate-800 truncate">
                    {isPassage ? `📄 지문 · ${obj?.year ?? ''}.${obj?.month ?? ''} ${obj?.grade ?? ''}학년 ${obj?.area ?? ''}` : `📝 ${obj?.questionNo ?? ''}번 문제`}
                </p>
                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{obj?.ocrText?.slice(0, 60) || ''}</p>
            </div>
            <button onClick={onRemove} className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}
