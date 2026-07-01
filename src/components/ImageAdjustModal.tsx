'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { X, Loader2, AlignLeft, AlignCenter, AlignRight, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

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
    passage?: any | null;
    question?: any | null;
};

// 인스타식 이미지 자르기 모달. react-easy-crop 사용.
// - 이미지 위에서 드래그 = 위치 이동 (자르기 영역 이동)
// - 마우스 휠 또는 슬라이더 = 줌
// - 결과는 croppedAreaPercentages (백분율 0~100) → 우리 cropTop/Bottom/Left/Right (0~1 비율)로 변환
// - imageScale, imageAlign은 별개 (시험지 단 안에서의 표시 옵션)
export function ImageAdjustModal({ item, examSetId, onClose, onSaved }: {
    item: AdjustableItem;
    examSetId: number;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isPassage = item.kind === 'passage';
    const imgUrl: string | undefined = isPassage
        ? (item.passage?.imageUrl || item.passage?.images?.[0]?.imageUrl)
        : item.question?.imageUrl;

    // === 자르기 상태 ===
    // Cropper는 자체 crop, zoom 을 관리. 초기값을 기존 crop 비율에서 역산.
    // 우리 저장 형식: cropTop/Bottom/Left/Right (0~1, 이미지 외곽에서 자른 비율)
    // → cropper의 croppedArea (백분율 x, y, width, height)와 대응.
    const initialCroppedArea: Area = {
        x: (item.cropLeft ?? 0) * 100,
        y: (item.cropTop ?? 0) * 100,
        width: Math.max(1, (1 - (item.cropLeft ?? 0) - (item.cropRight ?? 0)) * 100),
        height: Math.max(1, (1 - (item.cropTop ?? 0) - (item.cropBottom ?? 0)) * 100),
    };

    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedPct, setCroppedPct] = useState<Area>(initialCroppedArea);

    // === 시험지 단 안에서 표시 옵션 (자르기와 별개) ===
    const [scale, setScale] = useState(item.imageScale ?? 1.0);
    const [align, setAlign] = useState<'left' | 'center' | 'right'>((item.imageAlign as any) ?? 'center');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setScale(item.imageScale ?? 1.0);
        setAlign((item.imageAlign as any) ?? 'center');
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    }, [item.id]);

    const onCropComplete = useCallback((_croppedAreaPixels: Area, croppedAreaPercentages: Area) => {
        setCroppedPct(croppedAreaPercentages);
    }, []);

    const cropTop = Math.max(0, croppedPct.y) / 100;
    const cropLeft = Math.max(0, croppedPct.x) / 100;
    const cropBottom = Math.max(0, 100 - croppedPct.y - croppedPct.height) / 100;
    const cropRight = Math.max(0, 100 - croppedPct.x - croppedPct.width) / 100;

    const reset = () => {
        setScale(1.0);
        setAlign('center');
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        // Cropper가 다시 전체 영역을 잡도록 유도 — crop / zoom 리셋 시 자동으로 onCropComplete 재호출됨
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/exam-set/item', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    examSetId,
                    items: [{
                        id: item.id, order: item.order,
                        imageScale: scale, imageAlign: align,
                        cropTop: clamp01(cropTop),
                        cropBottom: clamp01(cropBottom),
                        cropLeft: clamp01(cropLeft),
                        cropRight: clamp01(cropRight),
                    }],
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(`저장 실패: ${err.detail || err.error || res.statusText}`);
                return;
            }
            onSaved();
        } catch (e: any) {
            alert(`저장 중 오류: ${e?.message || String(e)}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">이미지 조정</h3>
                        <p className="text-xs text-slate-500 font-bold">드래그로 위치 이동 · 마우스 휠 / 슬라이더로 확대·축소</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 flex-1 overflow-hidden">
                    {/* Cropper */}
                    <div className="relative bg-slate-800 rounded-2xl overflow-hidden" style={{ minHeight: 420 }}>
                        {imgUrl ? (
                            <Cropper
                                image={imgUrl}
                                crop={crop}
                                zoom={zoom}
                                aspect={undefined}
                                minZoom={0.5}
                                maxZoom={4}
                                zoomSpeed={0.5}
                                initialCroppedAreaPercentages={initialCroppedArea}
                                restrictPosition={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                                objectFit="contain"
                                showGrid={true}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">이미지 없음</div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="space-y-5 overflow-y-auto pr-1">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-black text-slate-600">줌 {zoom.toFixed(2)}×</label>
                                <div className="flex gap-1">
                                    <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ZoomOut className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setZoom(z => Math.min(4, +(z + 0.1).toFixed(2)))} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ZoomIn className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                            <input type="range" min="0.5" max="4" step="0.05" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} className="w-full accent-teal-600" />
                        </div>

                        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-[11px] text-teal-800 font-bold leading-relaxed">
                            💡 <strong>이미지 위에서 드래그</strong>하면 자르기 위치가 바뀝니다.<br />
                            마우스 <strong>휠</strong>을 굴리면 확대·축소.
                        </div>

                        <div>
                            <label className="text-xs font-black text-slate-600 mb-2 block">시험지 안에서 위치</label>
                            <div className="grid grid-cols-3 gap-1">
                                {(['left', 'center', 'right'] as const).map(a => (
                                    <button key={a} onClick={() => setAlign(a)} className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold ${align === a ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                        {a === 'left' ? <AlignLeft className="w-3 h-3" /> : a === 'right' ? <AlignRight className="w-3 h-3" /> : <AlignCenter className="w-3 h-3" />}
                                        {a === 'left' ? '왼쪽' : a === 'right' ? '오른쪽' : '가운데'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-black text-slate-600">시험지 단에서 크기 {Math.round(scale * 100)}%</label>
                            </div>
                            <input type="range" min="30" max="200" step="5" value={Math.round(scale * 100)} onChange={e => setScale(parseInt(e.target.value, 10) / 100)} className="w-full accent-teal-600" />
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 text-[10px] text-slate-500 font-bold leading-relaxed">
                            <div>잘라낸 영역: 위 {Math.round(cropTop * 100)}% · 아래 {Math.round(cropBottom * 100)}%</div>
                            <div>왼쪽 {Math.round(cropLeft * 100)}% · 오른쪽 {Math.round(cropRight * 100)}%</div>
                        </div>

                        <button onClick={reset} className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-black">
                            <RotateCcw className="w-3 h-3" /> 기본값으로
                        </button>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end gap-2 flex-shrink-0">
                    <button onClick={onClose} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-black hover:bg-slate-200">취소</button>
                    <button onClick={save} disabled={saving} className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-black hover:bg-teal-700 disabled:bg-slate-300 flex items-center gap-1.5">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
}

function clamp01(v: number): number {
    if (!isFinite(v)) return 0;
    return Math.max(0, Math.min(0.45, v));
}
