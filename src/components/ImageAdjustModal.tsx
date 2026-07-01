'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlignLeft, AlignCenter, AlignRight, RotateCcw } from 'lucide-react';

export type AdjustableItem = {
    id: number;
    order: number;
    kind: 'passage' | 'question';
    imageScale: number;
    imageAlign: string;
    cropTop: number;
    cropBottom: number;
    cropLeft: number;
    cropRight: number;
    croppedImageUrl?: string | null;
    passage?: any | null;
    question?: any | null;
};

function getInitialImgUrl(item: AdjustableItem): string | null {
    if (item.croppedImageUrl) return item.croppedImageUrl;
    if (item.kind === 'passage') {
        return item.passage?.imageUrl || item.passage?.images?.[0]?.imageUrl || null;
    }
    return item.question?.imageUrl || null;
}

// exam-builder 카드 → [이미지 조정] 버튼 → 이 모달.
// 이미지 위에 드래그로 사각형 → 그 영역만 남기고 서버가 실제 파일을 잘라 교체 (즉시 저장).
// 크기·정렬은 슬라이더/토글 조작 시 500ms debounce 후 자동 저장.
export function ImageAdjustModal({ item, examSetId, onClose, onSaved }: {
    item: AdjustableItem;
    examSetId: number;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [imgUrl, setImgUrl] = useState<string | null>(getInitialImgUrl(item));
    const [scale, setScale] = useState(item.imageScale ?? 1.0);
    const [align, setAlign] = useState<'left' | 'center' | 'right'>((item.imageAlign as any) ?? 'center');
    const [cropping, setCropping] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [savingMeta, setSavingMeta] = useState(false);

    const wrapRef = useRef<HTMLDivElement>(null);
    const latestRect = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    const wrapSize = useRef<{ w: number; h: number } | null>(null);
    const [dragRect, setDragRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

    useEffect(() => {
        setImgUrl(getInitialImgUrl(item));
        setScale(item.imageScale ?? 1.0);
        setAlign((item.imageAlign as any) ?? 'center');
    }, [item.id, item.croppedImageUrl]);

    // 크기·정렬 자동 저장 (debounced)
    const saveMetaTimer = useRef<any>(null);
    const scheduleMetaSave = (nextScale: number, nextAlign: 'left' | 'center' | 'right') => {
        if (saveMetaTimer.current) clearTimeout(saveMetaTimer.current);
        saveMetaTimer.current = setTimeout(async () => {
            setSavingMeta(true);
            try {
                await fetch('/api/admin/exam-set/item', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        examSetId,
                        items: [{ id: item.id, imageScale: nextScale, imageAlign: nextAlign }],
                    }),
                });
                onSaved();
            } finally {
                setSavingMeta(false);
            }
        }, 500);
    };

    const onScaleChange = (v: number) => {
        setScale(v);
        scheduleMetaSave(v, align);
    };
    const onAlignChange = (a: 'left' | 'center' | 'right') => {
        setAlign(a);
        scheduleMetaSave(scale, a);
    };

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        wrapSize.current = { w: rect.width, h: rect.height };
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
        const initial = { x1: startX, y1: startY, x2: startX, y2: startY };
        latestRect.current = initial;
        setDragRect(initial);

        const move = (ev: MouseEvent) => {
            const nx = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
            const ny = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
            const next = { x1: startX, y1: startY, x2: nx, y2: ny };
            latestRect.current = next;
            setDragRect(next);
        };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            setDragRect(null);
            const cr = latestRect.current;
            const wr = wrapSize.current;
            latestRect.current = null;
            wrapSize.current = null;
            if (!cr || !wr) return;
            const left = Math.min(cr.x1, cr.x2), right = Math.max(cr.x1, cr.x2);
            const top = Math.min(cr.y1, cr.y2), bottom = Math.max(cr.y1, cr.y2);
            if (right - left < 8 || bottom - top < 8) return;

            const u1 = left / wr.w, u2 = right / wr.w;
            const v1 = top / wr.h, v2 = bottom / wr.h;
            // 자르기 후 화면 크기 유지: 잘라낸 사각형 폭 비율만큼 imageScale 축소
            const newImageScale = Math.max(0.05, Math.min(4.0, scale * (u2 - u1)));
            doCropAndReplace(u1, v1, u2, v2, newImageScale);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    const doCropAndReplace = async (u1: number, v1: number, u2: number, v2: number, newImageScale: number) => {
        if (!imgUrl) return;
        setCropping(true);
        try {
            const res = await fetch('/api/admin/exam-set/item/crop-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, examSetId, sourceUrl: imgUrl, u1, v1, u2, v2, newImageScale }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(`자르기 실패: ${err.detail || err.error || res.statusText}`);
                return;
            }
            const data = await res.json();
            setImgUrl(data.url);
            setScale(newImageScale);
            onSaved(); // 부모(exam-builder)가 새 URL 반영하도록 즉시 새로고침
        } catch (e: any) {
            alert(`자르기 실패: ${e?.message || String(e)}`);
        } finally {
            setCropping(false);
        }
    };

    const resetToOriginal = async () => {
        if (!confirm('원본 이미지로 되돌리고 크기·정렬도 초기화할까요?')) return;
        setResetting(true);
        try {
            await fetch(`/api/admin/exam-set/item/crop-image?itemId=${item.id}`, { method: 'DELETE' });
            await fetch('/api/admin/exam-set/item', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    examSetId,
                    items: [{
                        id: item.id,
                        imageScale: 1.0,
                        imageAlign: 'left',
                        cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0,
                    }],
                }),
            });
            setImgUrl(item.kind === 'passage'
                ? (item.passage?.imageUrl || item.passage?.images?.[0]?.imageUrl || null)
                : (item.question?.imageUrl || null));
            setScale(1.0);
            setAlign('left');
            onSaved();
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">이미지 조정</h3>
                        <p className="text-xs text-slate-500 font-bold">
                            드래그로 사각형 그리면 <b>그 영역만 남음 (즉시 저장됨)</b>. 크기·정렬 조작도 자동 저장.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {(cropping || savingMeta || resetting) && (
                            <span className="text-xs text-teal-600 font-bold flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> 저장 중...
                            </span>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 flex-1 overflow-hidden">
                    <div className="bg-slate-100 rounded-2xl p-4 flex items-center justify-center min-h-[420px] overflow-auto">
                        {imgUrl ? (
                            <div
                                ref={wrapRef}
                                onMouseDown={onMouseDown}
                                style={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    cursor: 'crosshair',
                                    userSelect: 'none',
                                    maxWidth: '100%',
                                    maxHeight: '70vh',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                }}
                            >
                                <img
                                    src={imgUrl}
                                    alt="edit"
                                    draggable={false}
                                    style={{
                                        display: 'block',
                                        maxWidth: '100%',
                                        maxHeight: '70vh',
                                        pointerEvents: 'none',
                                        userSelect: 'none',
                                    }}
                                />
                                {dragRect && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: Math.min(dragRect.x1, dragRect.x2),
                                            top: Math.min(dragRect.y1, dragRect.y2),
                                            width: Math.abs(dragRect.x2 - dragRect.x1),
                                            height: Math.abs(dragRect.y2 - dragRect.y1),
                                            border: '2.5px dashed #0d9488',
                                            background: 'rgba(13,148,136,0.15)',
                                            pointerEvents: 'none',
                                        }}
                                    >
                                        <span style={{
                                            background: '#0d9488',
                                            color: 'white',
                                            fontSize: 11,
                                            fontWeight: 800,
                                            padding: '2px 6px',
                                            display: 'inline-block',
                                            margin: '-1px 0 0 -1px',
                                            whiteSpace: 'nowrap',
                                        }}>이 영역만 남깁니다</span>
                                    </div>
                                )}
                                {cropping && (
                                    <div style={{
                                        position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <div style={{ background: 'white', padding: '6px 14px', borderRadius: 999, fontWeight: 800, fontSize: 12 }}>
                                            자르는 중...
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-slate-400 font-bold">이미지 없음</p>
                        )}
                    </div>

                    <div className="space-y-5 overflow-y-auto pr-1">
                        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-[11px] text-teal-800 font-bold leading-relaxed">
                            💡 이미지 위 드래그 → 사각형이 그려지고, 놓으면 그 영역만 남습니다.<br />
                            <strong>자동 저장</strong>이라 저장 버튼 안 눌러도 돼요.
                        </div>

                        <div>
                            <label className="text-xs font-black text-slate-600 mb-2 block">
                                이미지 폭 (단 대비 %) — {Math.round(scale * 100)}%
                            </label>
                            <input
                                type="range"
                                min="5" max="200" step="5"
                                value={Math.round(scale * 100)}
                                onChange={e => onScaleChange(parseInt(e.target.value, 10) / 100)}
                                className="w-full accent-teal-600"
                            />
                            <p className="text-[10px] text-slate-500 font-medium mt-1">
                                시험지 한 단(좌/우 중 하나) 폭에서 이 이미지가 몇 %를 차지할지. 100%면 단 가득.
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-black text-slate-600 mb-2 block">단 안에서 위치</label>
                            <div className="grid grid-cols-3 gap-1">
                                {(['left', 'center', 'right'] as const).map(a => (
                                    <button
                                        key={a}
                                        onClick={() => onAlignChange(a)}
                                        className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold ${align === a ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        {a === 'left' ? <AlignLeft className="w-3 h-3" /> : a === 'right' ? <AlignRight className="w-3 h-3" /> : <AlignCenter className="w-3 h-3" />}
                                        {a === 'left' ? '왼쪽' : a === 'right' ? '오른쪽' : '가운데'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={resetToOriginal}
                            disabled={resetting}
                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-black disabled:opacity-50"
                        >
                            <RotateCcw className="w-3 h-3" />
                            {resetting ? '복구 중...' : '원본 이미지로 복구 (크기·정렬도 초기화)'}
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex justify-end flex-shrink-0">
                    <button onClick={onClose} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-black">
                        완료
                    </button>
                </div>
            </div>
        </div>
    );
}
