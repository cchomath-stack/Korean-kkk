'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Download, Loader2, AlertCircle, Pencil, CheckCircle2, Undo2 } from 'lucide-react';
import { ExamPaper, type ExamHydrated, type ExamHydratedItem } from '@/components/ExamPaper';

type OptsPatch = {
    scale?: number;
    align?: 'left' | 'center' | 'right';
    cropTop?: number;
    cropBottom?: number;
    cropLeft?: number;
    cropRight?: number;
};

type Snapshot = {
    itemId: number;
    imageScale: number;
    imageAlign: string;
    cropTop: number;
    cropBottom: number;
    cropLeft: number;
    cropRight: number;
};

export default function ExamPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [exam, setExam] = useState<ExamHydrated | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showOriginalNo, setShowOriginalNo] = useState(true);
    const [savingIndicator, setSavingIndicator] = useState(false);

    // 히스토리 스택: Ctrl+Z 로 이전 상태 복원
    const historyRef = useRef<Snapshot[]>([]);
    // debounced 저장을 위한 pending timer per item
    const saveTimersRef = useRef<Map<number, any>>(new Map());
    // 인라인 편집 시작 시 이전 상태 이미 히스토리에 push했는지 flag
    const pushedThisDragRef = useRef<Set<number>>(new Set());

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/exam-set/hydrated?id=${id}`);
            if (res.ok) setExam(await res.json());
        } finally {
            setLoading(false);
        }
    }, [id]);
    useEffect(() => { load(); }, [load]);

    // Ctrl+Z 글로벌 리스너
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
            if (!isUndo) return;
            // 텍스트 필드 입력 중이면 무시
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
            e.preventDefault();
            handleUndo();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [exam]);

    const snapshotItem = (item: ExamHydratedItem): Snapshot => ({
        itemId: item.id,
        imageScale: item.imageScale ?? 1.0,
        imageAlign: item.imageAlign ?? 'center',
        cropTop: item.cropTop ?? 0,
        cropBottom: item.cropBottom ?? 0,
        cropLeft: item.cropLeft ?? 0,
        cropRight: item.cropRight ?? 0,
    });

    const applyPatchToItem = (item: ExamHydratedItem, patch: OptsPatch): ExamHydratedItem => ({
        ...item,
        imageScale: patch.scale != null ? patch.scale : (item.imageScale ?? 1.0),
        imageAlign: patch.align != null ? patch.align : (item.imageAlign ?? 'center'),
        cropTop: patch.cropTop != null ? patch.cropTop : (item.cropTop ?? 0),
        cropBottom: patch.cropBottom != null ? patch.cropBottom : (item.cropBottom ?? 0),
        cropLeft: patch.cropLeft != null ? patch.cropLeft : (item.cropLeft ?? 0),
        cropRight: patch.cropRight != null ? patch.cropRight : (item.cropRight ?? 0),
    });

    const scheduleSave = (itemId: number) => {
        const existing = saveTimersRef.current.get(itemId);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
            saveItemToServer(itemId);
            saveTimersRef.current.delete(itemId);
        }, 500);
        saveTimersRef.current.set(itemId, t);
    };

    const saveItemToServer = async (itemId: number) => {
        if (!exam) return;
        const item = exam.items.find(i => i.id === itemId);
        if (!item) return;
        setSavingIndicator(true);
        try {
            await fetch('/api/admin/exam-set/item', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    examSetId: exam.id,
                    items: [{
                        id: item.id, order: item.order,
                        imageScale: item.imageScale, imageAlign: item.imageAlign,
                        cropTop: item.cropTop, cropBottom: item.cropBottom,
                        cropLeft: item.cropLeft, cropRight: item.cropRight,
                    }],
                }),
            });
        } finally {
            setSavingIndicator(false);
        }
    };

    const handleInlineChange = (itemId: number, patch: OptsPatch) => {
        setExam(prev => {
            if (!prev) return prev;
            const item = prev.items.find(i => i.id === itemId);
            if (!item) return prev;
            // 이 드래그의 첫 번째 변경이면 이전 상태를 히스토리에 push
            if (!pushedThisDragRef.current.has(itemId)) {
                historyRef.current = [...historyRef.current, snapshotItem(item)].slice(-50);
                pushedThisDragRef.current.add(itemId);
            }
            return {
                ...prev,
                items: prev.items.map(it => it.id === itemId ? applyPatchToItem(it, patch) : it),
            };
        });
    };

    const handleInlineCommit = (itemId: number) => {
        pushedThisDragRef.current.delete(itemId);
        scheduleSave(itemId);
    };

    const handleUndo = () => {
        setExam(prev => {
            if (!prev) return prev;
            const stack = historyRef.current;
            if (stack.length === 0) return prev;
            const last = stack[stack.length - 1];
            historyRef.current = stack.slice(0, -1);
            const updated = {
                ...prev,
                items: prev.items.map(it => it.id === last.itemId ? {
                    ...it,
                    imageScale: last.imageScale,
                    imageAlign: last.imageAlign,
                    cropTop: last.cropTop,
                    cropBottom: last.cropBottom,
                    cropLeft: last.cropLeft,
                    cropRight: last.cropRight,
                } : it),
            };
            // 서버 저장 예약
            setTimeout(() => saveItemToServer(last.itemId), 50);
            return updated;
        });
    };

    const handleDownload = async () => {
        if (!exam) return;
        setDownloading(true);
        try {
            // pending 저장 강제 flush
            const pending = Array.from(saveTimersRef.current.keys());
            for (const itemId of pending) {
                clearTimeout(saveTimersRef.current.get(itemId));
                await saveItemToServer(itemId);
            }
            saveTimersRef.current.clear();

            const res = await fetch(`/api/admin/exam-set/pdf?id=${exam.id}&showOriginalNo=${showOriginalNo ? '1' : '0'}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(`PDF 생성 실패: ${err.detail || err.error || res.statusText}`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(exam.title || '시험지').replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            alert(`PDF 다운로드 실패: ${e?.message || e}`);
        } finally {
            setDownloading(false);
        }
    };

    const handleSaveAsExamSet = async () => {
        if (!exam) return;
        const res = await fetch('/api/admin/exam-set', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: exam.id, status: 'saved' }),
        });
        if (res.ok) {
            setSaved(true);
            await fetch('/api/admin/exam-set');
        } else {
            alert('저장 실패');
        }
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
                <Link href="/exam-builder" className="mt-4 text-teal-600 font-bold underline">시험지 만들기로</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-200">
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/exam-builder" className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-black text-slate-900">미리보기</h1>
                            <p className="text-xs font-bold text-slate-400">
                                {exam.title || '제목 없음'} · 문항 {countQuestions(exam)}개
                                {savingIndicator && <span className="ml-2 text-teal-600">저장 중...</span>}
                                {!savingIndicator && historyRef.current.length > 0 && <span className="ml-2 text-slate-400">Ctrl+Z 가능 ({historyRef.current.length})</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 px-3 py-2 bg-slate-100 rounded-xl cursor-pointer">
                            <input type="checkbox" checked={showOriginalNo} onChange={(e) => setShowOriginalNo(e.target.checked)} className="accent-teal-600" />
                            원본 번호 표시
                        </label>
                        <button
                            onClick={handleUndo}
                            disabled={historyRef.current.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl"
                            title="Ctrl+Z"
                        >
                            <Undo2 className="w-4 h-4" />
                            취소
                        </button>
                        <Link href="/exam-builder" className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl">
                            <Pencil className="w-4 h-4" />
                            수정
                        </Link>
                        {!saved ? (
                            <button onClick={handleSaveAsExamSet} className="flex items-center gap-1.5 px-4 py-2 text-sm font-black text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl">
                                저장(출제완료로)
                            </button>
                        ) : (
                            <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <CheckCircle2 className="w-4 h-4" /> 저장됨
                            </span>
                        )}
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="flex items-center gap-1.5 px-5 py-2 text-sm font-black text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-xl shadow-lg shadow-teal-200"
                        >
                            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            PDF 다운로드
                        </button>
                    </div>
                </div>
            </header>

            <div className="bg-teal-50 border-b border-teal-100 px-6 py-2 text-center text-xs font-bold text-teal-800">
                💡 이미지 위에 마우스 올리면 <b>파란 조절점 8개</b> 나타남 → 드래그하면 크기 조절 · <b>Shift+드래그</b>는 이미지 위에서 자르기 영역 그리기 · <b>마우스 휠</b> = 확대/축소 · <b>Ctrl+Z</b> = 취소
            </div>

            <ExamPaper
                exam={exam}
                showOriginalNo={showOriginalNo}
                onInlineChange={handleInlineChange}
                onInlineCommit={handleInlineCommit}
            />
        </div>
    );
}

function countQuestions(exam: ExamHydrated): number {
    let n = 0;
    for (const it of exam.items) {
        if (it.kind === 'passage' && it.passage?.questions) n += it.passage.questions.length;
        else if (it.kind === 'question') n += 1;
    }
    return n;
}
