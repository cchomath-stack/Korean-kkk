'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Crop, Upload, Loader2, X, Check, ClipboardPaste } from 'lucide-react';

// 문항 이미지 편집 — 사각형 그려서 자르거나(서버 sharp), 새 파일로 통째 교체.
// 시험지 만들기의 ImageAdjustModal과 같은 rectangle-drawing UX.
export function QuestionImageEditor({
    questionId,
    imageUrl,
    onChanged,
    onClose,
}: {
    questionId: number;
    imageUrl: string;
    onChanged: (newUrl: string) => void;
    onClose: () => void;
}) {
    const [mode, setMode] = useState<'crop' | 'replace'>('crop');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [flashPasted, setFlashPasted] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // 사각형 좌표 (0~1 상대)
    const [rect, setRect] = useState<{ u1: number; v1: number; u2: number; v2: number } | null>(null);
    const drawingRef = useRef(false);
    const startRef = useRef<{ x: number; y: number } | null>(null);

    // 이미지가 object-contain으로 letterbox 됐을 때 실제 이미지 콘텐츠 영역 계산
    // (엘리먼트 영역과 실제 이미지가 그려진 영역이 다를 수 있음)
    const contentBounds = () => {
        const img = imgRef.current;
        if (!img) return null;
        const rect = img.getBoundingClientRect();
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (!nw || !nh) {
            // 자연 크기 아직 모름 → 엘리먼트 그대로
            return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, offsetInElX: 0, offsetInElY: 0 };
        }
        const scale = Math.min(rect.width / nw, rect.height / nh);
        const displayW = nw * scale;
        const displayH = nh * scale;
        const offsetInElX = (rect.width - displayW) / 2;   // element 내에서 콘텐츠 시작 x
        const offsetInElY = (rect.height - displayH) / 2;
        return {
            left: rect.left + offsetInElX,
            top: rect.top + offsetInElY,
            width: displayW,
            height: displayH,
            offsetInElX,
            offsetInElY,
        };
    };

    const relCoords = (e: React.MouseEvent | MouseEvent) => {
        const b = contentBounds();
        if (!b) return { x: 0, y: 0 };
        const x = ((e as MouseEvent).clientX - b.left) / b.width;
        const y = ((e as MouseEvent).clientY - b.top) / b.height;
        return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (mode !== 'crop') return;
        e.preventDefault();
        const p = relCoords(e);
        startRef.current = p;
        drawingRef.current = true;
        setRect({ u1: p.x, v1: p.y, u2: p.x, v2: p.y });
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };
    const onMouseMove = (e: MouseEvent) => {
        if (!drawingRef.current || !startRef.current) return;
        const p = relCoords(e);
        const s = startRef.current;
        setRect({
            u1: Math.min(s.x, p.x),
            v1: Math.min(s.y, p.y),
            u2: Math.max(s.x, p.x),
            v2: Math.max(s.y, p.y),
        });
    };
    const onMouseUp = () => {
        drawingRef.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };

    const doCrop = async () => {
        if (!rect) return;
        if (rect.u2 - rect.u1 < 0.02 || rect.v2 - rect.v1 < 0.02) {
            setErr('자르기 영역이 너무 작아요. 더 크게 그려주세요.');
            return;
        }
        setBusy(true);
        setErr(null);
        try {
            const res = await fetch('/api/admin/question/crop-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId,
                    sourceUrl: imageUrl,
                    u1: rect.u1, v1: rect.v1, u2: rect.u2, v2: rect.v2,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErr(data?.detail || data?.error || '자르기 실패');
                return;
            }
            onChanged(data.url);
        } catch (e: any) {
            setErr('네트워크 오류: ' + (e?.message || ''));
        } finally {
            setBusy(false);
        }
    };

    const doReplace = async (file: File) => {
        setBusy(true);
        setErr(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('questionId', String(questionId));
            const res = await fetch('/api/admin/question/replace-image', {
                method: 'POST',
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) {
                setErr(data?.detail || data?.error || '교체 실패');
                return;
            }
            onChanged(data.url);
        } catch (e: any) {
            setErr('네트워크 오류: ' + (e?.message || ''));
        } finally {
            setBusy(false);
        }
    };

    // 클립보드 붙여넣기 (Ctrl/⌘ + V) — 모달 열려 있는 동안 문서 전역에서 캡처
    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            if (busy) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const it of Array.from(items)) {
                if (it.kind === 'file' && it.type.startsWith('image/')) {
                    const f = it.getAsFile();
                    if (f) {
                        e.preventDefault();
                        // '다시 올리기' 탭으로 자동 전환하고 시각 피드백
                        setMode('replace');
                        setFlashPasted(true);
                        setTimeout(() => setFlashPasted(false), 800);
                        doReplace(f);
                        return;
                    }
                }
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [busy]);

    // 드래그 앤 드롭
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };
    const onDragLeave = () => setIsDragOver(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const f = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
        if (!f) {
            setErr('이미지 파일만 놓을 수 있어요.');
            return;
        }
        doReplace(f);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                <div className="px-5 py-4 border-b flex items-center gap-3">
                    <h2 className="font-black text-slate-900">문항 #{questionId} 이미지 편집</h2>
                    <div className="ml-4 flex bg-slate-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setMode('crop')}
                            className={`px-3 py-1 rounded text-xs font-black flex items-center gap-1 ${mode === 'crop' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                        >
                            <Crop size={12} /> 자르기
                        </button>
                        <button
                            onClick={() => setMode('replace')}
                            className={`px-3 py-1 rounded text-xs font-black flex items-center gap-1 ${mode === 'replace' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                        >
                            <Upload size={12} /> 다시 올리기
                        </button>
                    </div>
                    <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-900"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-auto p-5">
                    {mode === 'crop' ? (
                        <>
                            <p className="text-xs text-slate-500 mb-3 font-medium">이미지 위에서 <strong>드래그해서 사각형</strong>을 그리면 그 영역만 남깁니다. 다시 그리면 새 영역으로 갱신됩니다.</p>
                            <div
                                ref={wrapRef}
                                onMouseDown={onMouseDown}
                                className="relative bg-slate-100 rounded-lg overflow-hidden select-none"
                                style={{ cursor: mode === 'crop' ? 'crosshair' : 'default' }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    ref={imgRef}
                                    src={imageUrl}
                                    alt=""
                                    draggable={false}
                                    className="w-full h-auto max-h-[60vh] object-contain block pointer-events-none"
                                />
                                {rect && imgRef.current && (() => {
                                    // 이미지가 letterbox 됐을 때 실제 콘텐츠 영역 기준으로 오버레이 위치 계산
                                    const img = imgRef.current;
                                    const nw = img.naturalWidth || img.clientWidth;
                                    const nh = img.naturalHeight || img.clientHeight;
                                    const scale = Math.min(img.clientWidth / nw, img.clientHeight / nh);
                                    const displayW = nw * scale;
                                    const displayH = nh * scale;
                                    const offX = (img.clientWidth - displayW) / 2;
                                    const offY = (img.clientHeight - displayH) / 2;
                                    return (
                                        <div
                                            className="absolute border-2 border-teal-500 bg-teal-500/20"
                                            style={{
                                                left: `${img.offsetLeft + offX + rect.u1 * displayW}px`,
                                                top: `${img.offsetTop + offY + rect.v1 * displayH}px`,
                                                width: `${(rect.u2 - rect.u1) * displayW}px`,
                                                height: `${(rect.v2 - rect.v1) * displayH}px`,
                                                pointerEvents: 'none',
                                            }}
                                        />
                                    );
                                })()}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500 font-medium">
                                새 이미지 파일(PNG/JPG/WEBP)을 <strong>클릭</strong>·<strong>드래그</strong>·<strong>Ctrl+V</strong> 로 넣으세요. 기존 이미지는 대체됩니다.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-[10px] font-black text-slate-500 mb-1">현재</div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={imageUrl} alt="" className="w-full bg-slate-100 rounded-lg object-contain max-h-[40vh]" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="text-[10px] font-black text-slate-500 mb-1">새 파일</div>
                                    <label
                                        onDragOver={onDragOver}
                                        onDragLeave={onDragLeave}
                                        onDrop={onDrop}
                                        className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer p-6 transition-all ${
                                            isDragOver
                                                ? 'border-teal-500 bg-teal-50 scale-[1.02]'
                                                : flashPasted
                                                ? 'border-amber-500 bg-amber-50'
                                                : 'border-slate-300 hover:border-teal-400 hover:bg-teal-50'
                                        }`}
                                    >
                                        {busy ? (
                                            <>
                                                <Loader2 size={24} className="text-teal-500 animate-spin mb-2" />
                                                <span className="text-xs font-bold text-teal-600">업로드 중…</span>
                                            </>
                                        ) : flashPasted ? (
                                            <>
                                                <ClipboardPaste size={24} className="text-amber-500 mb-2" />
                                                <span className="text-xs font-bold text-amber-700">붙여넣기 감지!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={24} className="text-slate-400 mb-2" />
                                                <span className="text-xs font-bold text-slate-500">
                                                    {isDragOver ? '여기에 놓기' : '클릭 · 드래그 · Ctrl+V'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 mt-1">PNG · JPG · WEBP</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) doReplace(f);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {err && (
                        <div className="mt-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded">
                            {err}
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t bg-slate-50 flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 mr-auto">
                        {mode === 'crop' ? '드래그해서 사각형 그리기 → 저장' : '클릭 · 드래그 · Ctrl+V 붙여넣기 즉시 교체'}
                    </span>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700">
                        닫기
                    </button>
                    {mode === 'crop' && (
                        <button
                            onClick={doCrop}
                            disabled={busy || !rect}
                            className="px-4 py-2 text-sm font-black rounded bg-teal-600 text-white hover:bg-teal-700 disabled:bg-slate-300 flex items-center gap-1.5"
                        >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            자르기 저장
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
