'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, ZoomIn, ZoomOut, AlignLeft, AlignCenter, AlignRight, RotateCcw } from 'lucide-react';

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

// 이미지 조정 모달 — exam-builder와 미리보기 페이지에서 공통 사용
export function ImageAdjustModal({ item, examSetId, onClose, onSaved }: {
    item: AdjustableItem;
    examSetId: number;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [scale, setScale] = useState(item.imageScale ?? 1.0);
    const [align, setAlign] = useState<'left' | 'center' | 'right'>((item.imageAlign as any) ?? 'center');
    const [cropTop, setCropTop] = useState(item.cropTop ?? 0);
    const [cropBottom, setCropBottom] = useState(item.cropBottom ?? 0);
    const [cropLeft, setCropLeft] = useState(item.cropLeft ?? 0);
    const [cropRight, setCropRight] = useState(item.cropRight ?? 0);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setScale(item.imageScale ?? 1.0);
        setAlign((item.imageAlign as any) ?? 'center');
        setCropTop(item.cropTop ?? 0);
        setCropBottom(item.cropBottom ?? 0);
        setCropLeft(item.cropLeft ?? 0);
        setCropRight(item.cropRight ?? 0);
    }, [item.id]);

    const isPassage = item.kind === 'passage';
    const imgUrl = isPassage
        ? (item.passage?.imageUrl || item.passage?.images?.[0]?.imageUrl)
        : item.question?.imageUrl;

    const visW = Math.max(0.1, 1 - cropLeft - cropRight);
    const visH = Math.max(0.1, 1 - cropTop - cropBottom);

    const reset = () => {
        setScale(1.0);
        setAlign('center');
        setCropTop(0); setCropBottom(0); setCropLeft(0); setCropRight(0);
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
                        cropTop, cropBottom, cropLeft, cropRight,
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
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">이미지 조정</h3>
                        <p className="text-xs text-slate-500 font-bold">크기 · 정렬 · 자르기 (시험지 출력 시 적용)</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
                    <div className="bg-slate-100 rounded-2xl p-4 flex items-center justify-center min-h-[400px]">
                        <div style={{ width: '100%', display: 'flex', justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }}>
                            <div style={{
                                width: `${Math.round(scale * 100)}%`,
                                overflow: 'hidden',
                                position: 'relative',
                                aspectRatio: `${visW} / ${visH}`,
                                background: 'white',
                                border: '1px solid #cbd5e1',
                            }}>
                                {imgUrl ? (
                                    <img
                                        src={imgUrl}
                                        alt="preview"
                                        style={{
                                            position: 'absolute',
                                            width: `${100 / visW}%`,
                                            left: `${-(cropLeft / visW) * 100}%`,
                                            top: `${-(cropTop / visH) * 100}%`,
                                            display: 'block',
                                        }}
                                    />
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-black text-slate-600">크기 {Math.round(scale * 100)}%</label>
                                <div className="flex gap-1">
                                    <button onClick={() => setScale(s => Math.max(0.3, +(s - 0.05).toFixed(2)))} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ZoomOut className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setScale(s => Math.min(2.0, +(s + 0.05).toFixed(2)))} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ZoomIn className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                            <input type="range" min="30" max="200" step="5" value={Math.round(scale * 100)} onChange={e => setScale(parseInt(e.target.value, 10) / 100)} className="w-full accent-teal-600" />
                        </div>

                        <div>
                            <label className="text-xs font-black text-slate-600 mb-2 block">정렬</label>
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
                            <label className="text-xs font-black text-slate-600 mb-2 block">자르기 (이미지 외곽 %)</label>
                            <div className="space-y-2">
                                <CropRow label="위" value={cropTop} onChange={setCropTop} />
                                <CropRow label="아래" value={cropBottom} onChange={setCropBottom} />
                                <CropRow label="왼쪽" value={cropLeft} onChange={setCropLeft} />
                                <CropRow label="오른쪽" value={cropRight} onChange={setCropRight} />
                            </div>
                        </div>

                        <button onClick={reset} className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-black">
                            <RotateCcw className="w-3 h-3" /> 기본값으로
                        </button>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end gap-2">
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

function CropRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 w-10">{label}</span>
            <input type="range" min="0" max="45" step="1" value={Math.round(value * 100)} onChange={e => onChange(parseInt(e.target.value, 10) / 100)} className="flex-grow accent-teal-600" />
            <span className="text-[10px] font-bold text-slate-700 w-8 text-right">{Math.round(value * 100)}%</span>
        </div>
    );
}
