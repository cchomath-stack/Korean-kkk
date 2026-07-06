'use client';

import React, { useRef, useState } from 'react';
import { Crop, Upload, Loader2, X, Check } from 'lucide-react';

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
    const wrapRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // 사각형 좌표 (0~1 상대)
    const [rect, setRect] = useState<{ u1: number; v1: number; u2: number; v2: number } | null>(null);
    const drawingRef = useRef(false);
    const startRef = useRef<{ x: number; y: number } | null>(null);

    const relCoords = (e: React.MouseEvent | MouseEvent) => {
        const wrap = wrapRef.current;
        const img = imgRef.current;
        if (!wrap || !img) return { x: 0, y: 0 };
        const wrapRect = wrap.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        // 이미지가 wrap 내부에서 object-contain으로 놓였을 때 실제 이미지 영역 안의 상대 좌표를 (0~1)로
        const x = ((e as MouseEvent).clientX - imgRect.left) / imgRect.width;
        const y = ((e as MouseEvent).clientY - imgRect.top) / imgRect.height;
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
                                {rect && imgRef.current && (
                                    <div
                                        className="absolute border-2 border-teal-500 bg-teal-500/20"
                                        style={{
                                            left: `${imgRef.current.offsetLeft + rect.u1 * imgRef.current.clientWidth}px`,
                                            top: `${imgRef.current.offsetTop + rect.v1 * imgRef.current.clientHeight}px`,
                                            width: `${(rect.u2 - rect.u1) * imgRef.current.clientWidth}px`,
                                            height: `${(rect.v2 - rect.v1) * imgRef.current.clientHeight}px`,
                                            pointerEvents: 'none',
                                        }}
                                    />
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500 font-medium">새 이미지 파일(PNG/JPG/WEBP)을 선택하세요. 기존 이미지는 대체됩니다.</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-[10px] font-black text-slate-500 mb-1">현재</div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={imageUrl} alt="" className="w-full bg-slate-100 rounded-lg object-contain max-h-[40vh]" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="text-[10px] font-black text-slate-500 mb-1">새 파일</div>
                                    <label className="flex-1 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 p-6">
                                        <Upload size={24} className="text-slate-400 mb-2" />
                                        <span className="text-xs font-bold text-slate-500">클릭해서 파일 선택</span>
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
                        {mode === 'crop' ? '드래그해서 사각형 그리기 → 저장' : '파일 선택 즉시 교체됨'}
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
