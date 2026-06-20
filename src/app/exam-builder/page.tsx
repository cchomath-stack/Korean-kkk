'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ChevronLeft, GripVertical, Trash2, FileText, BookOpen,
    Eye, Save, FileDown, Loader2, AlertCircle, X,
} from 'lucide-react';

type HydratedItem = {
    id: number;
    kind: 'passage' | 'question';
    passageId: number | null;
    questionId: number | null;
    sectionLabel: string | null;
    order: number;
    passage: any | null;
    question: any | null;
};

type HydratedExam = {
    id: number;
    title: string | null;
    subTitle: string | null;
    academyName: string | null;
    grade: number | null;
    durationMin: number | null;
    totalScore: number | null;
    status: string;
    items: HydratedItem[];
};

export default function ExamBuilderPage() {
    const router = useRouter();
    const [exam, setExam] = useState<HydratedExam | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingMeta, setSavingMeta] = useState(false);
    const [issuing, setIssuing] = useState(false);

    const fetchExam = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/exam-set/hydrated');
            if (res.ok) {
                setExam(await res.json());
            } else if (res.status === 403) {
                alert('관리자 권한이 필요합니다.');
                router.push('/');
            }
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { fetchExam(); }, [fetchExam]);

    const updateMeta = useCallback(async (patch: Partial<HydratedExam>) => {
        if (!exam) return;
        setSavingMeta(true);
        try {
            const res = await fetch('/api/admin/exam-set', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: exam.id, ...patch }),
            });
            if (res.ok) {
                const updated = await res.json();
                setExam(prev => prev ? { ...prev, ...updated } : prev);
            }
        } finally {
            setSavingMeta(false);
        }
    }, [exam]);

    const removeItem = useCallback(async (itemId: number) => {
        await fetch(`/api/admin/exam-set/item?id=${itemId}`, { method: 'DELETE' });
        fetchExam();
    }, [fetchExam]);

    const updateItemLabel = useCallback(async (itemId: number, label: string) => {
        if (!exam) return;
        await fetch('/api/admin/exam-set/item', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                examSetId: exam.id,
                items: [{ id: itemId, order: exam.items.find(i => i.id === itemId)?.order ?? 0, sectionLabel: label }],
            }),
        });
        setExam(prev => prev ? {
            ...prev,
            items: prev.items.map(i => i.id === itemId ? { ...i, sectionLabel: label || null } : i),
        } : prev);
    }, [exam]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !exam) return;
        const oldIndex = exam.items.findIndex(i => i.id === active.id);
        const newIndex = exam.items.findIndex(i => i.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        const newItems = arrayMove(exam.items, oldIndex, newIndex).map((it, idx) => ({ ...it, order: idx }));
        setExam(prev => prev ? { ...prev, items: newItems } : prev);
        await fetch('/api/admin/exam-set/item', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                examSetId: exam.id,
                items: newItems.map(it => ({ id: it.id, order: it.order })),
            }),
        });
    }, [exam]);

    const handleIssue = async () => {
        if (!exam || exam.items.length === 0) return;
        setIssuing(true);
        // 미리보기 페이지로 이동 (PDF 생성/다운로드는 거기서)
        router.push(`/exam-builder/preview/${exam.id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
                <p className="text-slate-600 font-bold">시험지를 불러올 수 없습니다.</p>
                <Link href="/" className="mt-4 text-teal-600 font-bold underline">메인으로</Link>
            </div>
        );
    }

    const itemCount = exam.items.length;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-black text-slate-900">시험지 만들기</h1>
                            <p className="text-xs font-bold text-slate-400">담은 문항 {itemCount}개</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/exam-builder/saved"
                            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                        >
                            저장된 시험지
                        </Link>
                        <button
                            onClick={handleIssue}
                            disabled={itemCount === 0 || issuing}
                            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-teal-200"
                        >
                            {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                            미리보기 / 출제하기
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
                {/* Left: Meta */}
                <aside className="space-y-4 lg:sticky lg:top-24 self-start">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">시험지 정보</h2>
                        <div className="space-y-3">
                            <MetaField
                                label="제목"
                                value={exam.title || ''}
                                placeholder="제목도 넣을 수 있어요"
                                onSave={(v) => updateMeta({ title: v })}
                                big
                            />
                            <MetaField
                                label="소제목"
                                value={exam.subTitle || ''}
                                placeholder="고1 2025년 3월 - 교육청 모의평가"
                                onSave={(v) => updateMeta({ subTitle: v })}
                            />
                            <MetaField
                                label="학원명"
                                value={exam.academyName || ''}
                                placeholder="국어닷 학원"
                                onSave={(v) => updateMeta({ academyName: v })}
                            />
                            <div className="grid grid-cols-3 gap-2">
                                <MetaNumberField
                                    label="학년"
                                    value={exam.grade}
                                    placeholder="고1"
                                    onSave={(v) => updateMeta({ grade: v as any })}
                                />
                                <MetaNumberField
                                    label="시간(분)"
                                    value={exam.durationMin}
                                    placeholder="80"
                                    onSave={(v) => updateMeta({ durationMin: v as any })}
                                />
                                <MetaNumberField
                                    label="총점"
                                    value={exam.totalScore}
                                    placeholder="100"
                                    onSave={(v) => updateMeta({ totalScore: v as any })}
                                />
                            </div>
                        </div>
                        {savingMeta && (
                            <p className="text-[10px] text-teal-600 font-bold mt-3 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> 저장 중...
                            </p>
                        )}
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                        <p className="text-xs font-bold text-amber-900 leading-relaxed">
                            <strong>💡 사용법</strong><br />
                            카드를 위아래로 <strong>드래그</strong>해서 순서를 바꾸세요. 좌측에 라벨(예: "기출 문제")을 적으면 시험지에 보라색 태그로 표시됩니다.
                        </p>
                    </div>
                </aside>

                {/* Right: Items */}
                <main>
                    {itemCount === 0 ? (
                        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
                            <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="font-black text-slate-400 text-lg mb-1">담은 문항이 없습니다</p>
                            <p className="text-sm text-slate-400 font-medium mb-6">검색 페이지나 데이터 관리에서 문항을 담아주세요.</p>
                            <div className="flex justify-center gap-3">
                                <Link href="/" className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-black hover:bg-teal-700">검색으로</Link>
                                <Link href="/admin" className="px-5 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-black hover:bg-slate-200">데이터 관리</Link>
                            </div>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={exam.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-4">
                                    {exam.items.map((item, idx) => (
                                        <SortableItem
                                            key={item.id}
                                            item={item}
                                            index={idx}
                                            onRemove={() => removeItem(item.id)}
                                            onLabelChange={(lbl) => updateItemLabel(item.id, lbl)}
                                        />
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

function MetaField({ label, value, placeholder, onSave, big }: {
    label: string;
    value: string;
    placeholder: string;
    onSave: (v: string) => void;
    big?: boolean;
}) {
    const [local, setLocal] = useState(value);
    useEffect(() => { setLocal(value); }, [value]);
    return (
        <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
            <input
                type="text"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={() => { if (local !== value) onSave(local); }}
                placeholder={placeholder}
                className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition ${big ? 'text-base font-bold' : 'text-sm'}`}
            />
        </div>
    );
}

function MetaNumberField({ label, value, placeholder, onSave }: {
    label: string;
    value: number | null;
    placeholder: string;
    onSave: (v: number | null) => void;
}) {
    const [local, setLocal] = useState(value?.toString() ?? '');
    useEffect(() => { setLocal(value?.toString() ?? ''); }, [value]);
    return (
        <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
            <input
                type="number"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={() => {
                    const cur = value?.toString() ?? '';
                    if (local !== cur) onSave(local === '' ? null : parseInt(local, 10));
                }}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition text-sm"
            />
        </div>
    );
}

function SortableItem({ item, index, onRemove, onLabelChange }: {
    item: HydratedItem;
    index: number;
    onRemove: () => void;
    onLabelChange: (label: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [label, setLabel] = useState(item.sectionLabel ?? '');
    useEffect(() => { setLabel(item.sectionLabel ?? ''); }, [item.sectionLabel]);

    const isPassageSet = item.kind === 'passage';
    const passage = item.passage;
    const question = item.question;

    return (
        <div ref={setNodeRef} style={style} className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden ${isDragging ? 'shadow-2xl ring-2 ring-teal-300' : ''}`}>
            {/* Card header */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="p-2 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg touch-none"
                    aria-label="드래그하여 순서 변경"
                >
                    <GripVertical className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 bg-teal-600 text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-teal-200">
                    {index + 1}
                </div>
                <div className="flex-grow flex items-center gap-2">
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        onBlur={() => { if (label !== (item.sectionLabel ?? '')) onLabelChange(label); }}
                        placeholder="기출 문제 / 변형 문제 1 ... (선택)"
                        className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition w-56"
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {isPassageSet ? `📄 지문 세트${passage?.questions?.length ? ` · ${passage.questions.length}문제` : ''}` : '📝 단독 문제'}
                    </span>
                </div>
                <button
                    onClick={onRemove}
                    className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="빼기"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Card body — preview */}
            <div className="p-5">
                {isPassageSet && passage ? (
                    <PassageSetPreview passage={passage} />
                ) : question ? (
                    <QuestionPreview question={question} />
                ) : (
                    <p className="text-xs text-rose-500 font-bold">⚠️ 원본 데이터를 찾을 수 없습니다 (삭제된 문항일 수 있음)</p>
                )}
            </div>
        </div>
    );
}

function PassageSetPreview({ passage }: { passage: any }) {
    const passageImg = passage.imageUrl || passage.images?.[0]?.imageUrl;
    const questions = passage.questions || [];
    return (
        <div className="grid grid-cols-[140px_1fr] gap-4">
            <div className="aspect-[3/4] bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex items-center justify-center">
                {passageImg ? (
                    <img src={passageImg} alt="passage" className="max-w-full max-h-full object-contain" />
                ) : (
                    <FileText className="w-8 h-8 text-slate-300" />
                )}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">지문</p>
                <p className="text-sm font-black text-slate-800 mb-2 line-clamp-2">
                    {passage.source || ''} {passage.year}년 {passage.month}월 {passage.grade}학년 {passage.area || ''}
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-3 italic mb-3">{passage.ocrText || ''}</p>
                <div className="flex flex-wrap gap-1">
                    {questions.slice(0, 8).map((q: any) => (
                        <span key={q.id} className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md font-bold border border-teal-100">
                            {q.questionNo}번
                        </span>
                    ))}
                    {questions.length > 8 && (
                        <span className="text-[10px] text-slate-400 font-bold">+{questions.length - 8}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

function QuestionPreview({ question }: { question: any }) {
    const meta = [
        question.year && `${question.year}년`,
        question.month && `${question.month}월`,
        question.grade && `${question.grade}학년`,
        question.area,
    ].filter(Boolean).join(' ');
    return (
        <div className="grid grid-cols-[140px_1fr] gap-4">
            <div className="aspect-[3/4] bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex items-center justify-center">
                <img src={question.imageUrl} alt="question" className="max-w-full max-h-full object-contain" />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">단독 문제</p>
                <p className="text-sm font-black text-slate-800 mb-2">
                    {question.questionNo ? `${question.questionNo}번` : '번호 없음'} {meta && `· ${meta}`}
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-3 italic">{question.ocrText?.slice(0, 160) || ''}</p>
            </div>
        </div>
    );
}
