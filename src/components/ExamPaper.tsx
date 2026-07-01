import React from 'react';

// 시험지 본문 렌더러 — 슬롯 기반 페이지 자동 분할.
// 1 항목 = 1 슬롯. 1 페이지 = 좌·우 2 슬롯. 항목 N개면 페이지 ceil(N/2)개 자동 생성.
// 미리보기 페이지와 Puppeteer PDF 생성 시 동일하게 사용됨.

export type ExamHydratedItem = {
    id: number;
    kind: 'passage' | 'question';
    sectionLabel: string | null;
    order: number;
    imageScale?: number;
    imageAlign?: string;
    cropTop?: number;
    cropBottom?: number;
    cropLeft?: number;
    cropRight?: number;
    passage: any | null;
    question: any | null;
};

export type ExamHydrated = {
    id: number;
    title: string | null;
    subTitle: string | null;
    academyName: string | null;
    grade: number | null;
    durationMin: number | null;
    totalScore: number | null;
    items: ExamHydratedItem[];
};

type ImgOpts = {
    scale: number;
    align: 'left' | 'center' | 'right';
    cropTop: number;
    cropBottom: number;
    cropLeft: number;
    cropRight: number;
};

type Slot =
    | { type: 'passage'; itemId: number; imageUrl: string; opts: ImgOpts; sectionLabel: string | null }
    | { type: 'question'; itemId: number; imageUrl: string; opts: ImgOpts; displayNo: number; originalNo: number | null; sectionLabel: string | null };

function itemOpts(it: ExamHydratedItem): ImgOpts {
    return {
        scale: typeof it.imageScale === 'number' ? it.imageScale : 1.0,
        align: (it.imageAlign === 'left' || it.imageAlign === 'right') ? it.imageAlign : 'center',
        cropTop: typeof it.cropTop === 'number' ? it.cropTop : 0,
        cropBottom: typeof it.cropBottom === 'number' ? it.cropBottom : 0,
        cropLeft: typeof it.cropLeft === 'number' ? it.cropLeft : 0,
        cropRight: typeof it.cropRight === 'number' ? it.cropRight : 0,
    };
}

// 항목들을 슬롯 배열로 평탄화. 지문 세트 = 지문 1슬롯 + 문제 각 1슬롯.
function flattenSlots(exam: ExamHydrated, opts: { showOriginalNo: boolean }): Slot[] {
    const slots: Slot[] = [];
    let displayNo = 1;
    let currentLabel: string | null = null;

    for (const it of exam.items) {
        const o = itemOpts(it);
        const labelText = it.sectionLabel?.trim() || null;
        if (labelText) currentLabel = labelText;

        if (it.kind === 'passage' && it.passage) {
            const passageImages: string[] = it.passage.images && it.passage.images.length > 0
                ? it.passage.images.map((im: any) => im.imageUrl).filter(Boolean)
                : (it.passage.imageUrl ? [it.passage.imageUrl] : []);
            for (const imgUrl of passageImages) {
                slots.push({
                    type: 'passage',
                    itemId: it.id,
                    imageUrl: imgUrl,
                    opts: o,
                    sectionLabel: currentLabel,
                });
                currentLabel = null; // section 라벨은 첫 슬롯에만
            }
            const questions = it.passage.questions || [];
            for (const q of questions) {
                slots.push({
                    type: 'question',
                    itemId: it.id,
                    imageUrl: q.imageUrl,
                    opts: o,
                    displayNo: displayNo++,
                    originalNo: opts.showOriginalNo ? (q.questionNo ?? null) : null,
                    sectionLabel: currentLabel,
                });
                currentLabel = null;
            }
        } else if (it.kind === 'question' && it.question) {
            const q = it.question;
            slots.push({
                type: 'question',
                itemId: it.id,
                imageUrl: q.imageUrl,
                opts: o,
                displayNo: displayNo++,
                originalNo: opts.showOriginalNo ? (q.questionNo ?? null) : null,
                sectionLabel: currentLabel,
            });
            currentLabel = null;
        }
    }
    return slots;
}

type ExamPaperProps = {
    exam: ExamHydrated;
    showOriginalNo?: boolean;
    onAdjustItem?: (itemId: number) => void;
    // 인라인 편집 모드 (미리보기 화면 전용)
    onInlineChange?: (itemId: number, patch: Partial<ImgOpts>) => void;
    onInlineCommit?: (itemId: number) => void; // mouseup 시 서버 저장 시점
};

export function ExamPaper({ exam, showOriginalNo = true, onAdjustItem, onInlineChange, onInlineCommit }: ExamPaperProps) {
    const slots = flattenSlots(exam, { showOriginalNo });

    // 슬롯을 2개씩 그룹핑 → 각 페이지
    const pages: (Slot | null)[][] = [];
    for (let i = 0; i < slots.length; i += 2) {
        pages.push([slots[i], slots[i + 1] ?? null]);
    }
    if (pages.length === 0) pages.push([null, null]);

    return (
        <div className="exam-paper-root">
            <style>{EXAM_PAPER_CSS}</style>

            {pages.map((pair, pIdx) => (
                <div key={pIdx} className="exam-page">
                    {/* 헤더 */}
                    <header className="exam-header">
                        <div className="exam-header-left">
                            {exam.subTitle && <span className="exam-header-sub">{exam.subTitle}</span>}
                        </div>
                        <h1 className="exam-header-title">{exam.title || '시험지'}</h1>
                        <div className="exam-header-right">
                            <span className="exam-page-no">{pIdx + 1}</span>
                        </div>
                    </header>

                    {/* 본문 = 좌·우 두 슬롯 */}
                    <main className="exam-body">
                        <div className="exam-slot exam-slot-left">
                            {pair[0] && <SlotRender slot={pair[0]} onAdjustItem={onAdjustItem} onInlineChange={onInlineChange} onInlineCommit={onInlineCommit} />}
                        </div>
                        <div className="exam-slot exam-slot-right">
                            {pair[1] && <SlotRender slot={pair[1]} onAdjustItem={onAdjustItem} onInlineChange={onInlineChange} onInlineCommit={onInlineCommit} />}
                        </div>
                    </main>

                    {/* 푸터 */}
                    <footer className="exam-footer">
                        <span className="exam-page-badge">
                            <span className="pn">{pIdx + 1}</span>
                            <span className="pt">/ {pages.length}</span>
                        </span>
                        <span className="exam-copyright">
                            본 자료의 무단 복제·배포·전송을 금지하며, 위반 시 민·형사상 책임이 발생할 수 있습니다.
                        </span>
                    </footer>
                </div>
            ))}

            {/* 정답표 (선택) */}
            {hasAnswers(exam) && (
                <div className="exam-page">
                    <header className="exam-header">
                        <div className="exam-header-left"><span className="exam-header-sub">정답표</span></div>
                        <h1 className="exam-header-title">{exam.title || '시험지'}</h1>
                        <div className="exam-header-right"><span className="exam-page-no">A</span></div>
                    </header>
                    <main className="exam-answer-body">
                        <div className="exam-answer-grid">
                            {collectAnswers(exam).map(a => (
                                <div key={a.no} className="exam-answer-cell">
                                    <span className="exam-answer-no">{a.no}.</span>
                                    <span className="exam-answer-val">{a.answer || '-'}</span>
                                </div>
                            ))}
                        </div>
                    </main>
                    <footer className="exam-footer">
                        <span className="exam-page-badge">
                            <span className="pn">정답</span>
                        </span>
                        <span className="exam-copyright">
                            본 자료의 무단 복제·배포·전송을 금지하며, 위반 시 민·형사상 책임이 발생할 수 있습니다.
                        </span>
                    </footer>
                </div>
            )}
        </div>
    );
}

function SlotRender({
    slot, onAdjustItem, onInlineChange, onInlineCommit,
}: {
    slot: Slot;
    onAdjustItem?: (itemId: number) => void;
    onInlineChange?: (itemId: number, patch: Partial<ImgOpts>) => void;
    onInlineCommit?: (itemId: number) => void;
}) {
    const editable = !!onInlineChange;
    const imgWrapRef = React.useRef<HTMLDivElement>(null);
    const [dragMode, setDragMode] = React.useState<null | 'scale' | 'crop'>(null);
    const [cropRect, setCropRect] = React.useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    const [shiftHeld, setShiftHeld] = React.useState(false);
    const [natSize, setNatSize] = React.useState<{ w: number; h: number } | null>(null);

    React.useEffect(() => {
        if (!editable) return;
        const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
        const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
        };
    }, [editable]);

    // 이미지 body 드래그는 아무 동작 안 함 (자르기는 오직 Shift + 핸들 드래그로만)
    const onImgMouseDown = (_e: React.MouseEvent) => {
        // no-op
    };

    // 리사이즈 (Shift 없음): 좌상단 앵커, 마우스 x 위치가 새 폭 결정
    const onScaleStart = (e: React.MouseEvent) => {
        if (!editable || !onInlineChange) return;
        e.preventDefault();
        e.stopPropagation();
        const wrap = imgWrapRef.current;
        if (!wrap) return;
        const slotEl = wrap.parentElement;
        if (!slotEl) return;
        const slotRect = slotEl.getBoundingClientRect();
        const anchorX = wrap.getBoundingClientRect().left;
        setDragMode('scale');

        const move = (ev: MouseEvent) => {
            const newWidthPx = Math.max(20, ev.clientX - anchorX);
            const nextScale = clamp(newWidthPx / slotRect.width, 0.3, 2.0);
            onInlineChange(slot.itemId, { scale: nextScale });
        };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            setDragMode(null);
            onInlineCommit?.(slot.itemId);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    // 자르기 (Shift + 핸들 드래그): 핸들 방향의 crop 값을 조절
    // dirX: -1 (좌측 핸들), 0 (가운데), +1 (우측 핸들)
    // dirY: -1 (위쪽 핸들), 0 (가운데), +1 (아래쪽 핸들)
    const onCropStart = (e: React.MouseEvent, dirX: number, dirY: number) => {
        if (!editable || !onInlineChange) return;
        e.preventDefault();
        e.stopPropagation();
        const wrap = imgWrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startCropLeft = slot.opts.cropLeft;
        const startCropRight = slot.opts.cropRight;
        const startCropTop = slot.opts.cropTop;
        const startCropBottom = slot.opts.cropBottom;
        const visW0 = Math.max(0.05, 1 - startCropLeft - startCropRight);
        const visH0 = Math.max(0.05, 1 - startCropTop - startCropBottom);
        setDragMode('crop');

        const move = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const patch: any = {};
            if (dirX === -1) {
                // 좌측 핸들: 오른쪽으로 드래그 = cropLeft 증가
                patch.cropLeft = clamp01(startCropLeft + (dx / rect.width) * visW0);
            } else if (dirX === 1) {
                // 우측 핸들: 왼쪽으로 드래그 = cropRight 증가
                patch.cropRight = clamp01(startCropRight + (-dx / rect.width) * visW0);
            }
            if (dirY === -1) {
                // 위쪽 핸들: 아래로 드래그 = cropTop 증가
                patch.cropTop = clamp01(startCropTop + (dy / rect.height) * visH0);
            } else if (dirY === 1) {
                // 아래쪽 핸들: 위로 드래그 = cropBottom 증가
                patch.cropBottom = clamp01(startCropBottom + (-dy / rect.height) * visH0);
            }
            onInlineChange(slot.itemId, patch);
        };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            setDragMode(null);
            onInlineCommit?.(slot.itemId);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    const onImgWheel = (e: React.WheelEvent) => {
        if (!editable) return;
        if (!onInlineChange) return;
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.95 : 1.05;
        const next = clamp(slot.opts.scale * factor, 0.3, 2.0);
        onInlineChange(slot.itemId, { scale: next });
        // 마지막 wheel 후 짧은 지연 뒤 commit — SlotRender 밖에서 debounce 처리 (미리보기 페이지)
        onInlineCommit?.(slot.itemId);
    };

    // 이미지 크기 = slot 폭 대비 imageScale × 100 %. 좌상단부터 배치가 기본.
    const widthPct = Math.round(slot.opts.scale * 100);
    const visW = Math.max(0.1, 1 - slot.opts.cropLeft - slot.opts.cropRight);
    const visH = Math.max(0.1, 1 - slot.opts.cropTop - slot.opts.cropBottom);
    const noCrop = slot.opts.cropTop === 0 && slot.opts.cropBottom === 0
        && slot.opts.cropLeft === 0 && slot.opts.cropRight === 0;
    const alignItems = slot.opts.align === 'right' ? 'flex-end'
        : slot.opts.align === 'center' ? 'center'
        : 'flex-start';

    const isPassage = slot.type === 'passage';

    // wrap의 최종 폭/세로 비율은 원본 이미지 비율(natW/natH)에 crop 비율을 곱한 값이어야 정확.
    // natSize가 아직 없으면 기본은 자연 비율(no aspect-ratio) 또는 crop만 반영(visW/visH — 근사).
    const wrapStyle: React.CSSProperties = {
        width: `${widthPct}%`,
        position: 'relative',
        ...(noCrop ? {} : { overflow: 'hidden' }),
        ...(editable ? { cursor: shiftHeld ? 'crosshair' : 'default' } : {}),
    };
    if (natSize) {
        wrapStyle.aspectRatio = `${natSize.w * visW} / ${natSize.h * visH}`;
    } else if (!noCrop) {
        wrapStyle.aspectRatio = `${visW} / ${visH}`;
    }
    const imgStyle: React.CSSProperties = noCrop
        ? { width: '100%', height: 'auto', display: 'block', pointerEvents: 'none', userSelect: 'none' }
        : {
            position: 'absolute',
            width: `${100 / visW}%`,
            left: `${-(slot.opts.cropLeft / visW) * 100}%`,
            top: `${-(slot.opts.cropTop / visH) * 100}%`,
            height: 'auto',
            display: 'block',
            pointerEvents: 'none',
            userSelect: 'none',
        };

    return (
        <div className={`exam-slot-inner ${editable ? 'editable' : ''} ${shiftHeld ? 'shift-held' : ''}`} style={{ alignItems }}>
            {slot.sectionLabel && (
                <div className="exam-section-row" style={{ alignSelf: 'stretch' }}>
                    <span className="exam-section-tag">{slot.sectionLabel}</span>
                </div>
            )}
            {!isPassage && (
                <div className="exam-question-no-row" style={{ alignSelf: 'stretch' }}>
                    <span className="exam-question-no">{slot.displayNo}.</span>
                    {slot.originalNo != null && (
                        <span className="exam-question-original-no">[원본 {slot.originalNo}번]</span>
                    )}
                </div>
            )}
            <div
                ref={imgWrapRef}
                className={`exam-image-wrap ${isPassage ? 'passage' : 'question'} ${editable ? 'exam-editable-img' : ''}`}
                style={wrapStyle}
                onMouseDown={editable ? onImgMouseDown : undefined}
                onWheel={editable ? onImgWheel : undefined}
            >
                <img
                    src={slot.imageUrl}
                    alt={isPassage ? 'passage' : `q-${slot.displayNo}`}
                    style={imgStyle}
                    draggable={false}
                    onLoad={(e) => {
                        const el = e.currentTarget;
                        if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                            setNatSize({ w: el.naturalWidth, h: el.naturalHeight });
                        }
                    }}
                />
                {editable && <EditHandles shiftHeld={shiftHeld} onScaleStart={onScaleStart} onCropStart={onCropStart} />}
                {dragMode === 'crop' && cropRect && (
                    <div
                        className="exam-crop-rect"
                        style={{
                            left: Math.min(cropRect.x1, cropRect.x2),
                            top: Math.min(cropRect.y1, cropRect.y2),
                            width: Math.abs(cropRect.x2 - cropRect.x1),
                            height: Math.abs(cropRect.y2 - cropRect.y1),
                        }}
                    />
                )}
            </div>
            {onAdjustItem && !editable && (
                <button
                    type="button"
                    className="exam-adjust-btn"
                    onClick={(e) => { e.stopPropagation(); onAdjustItem(slot.itemId); }}
                    title="이미지 조정"
                >
                    ✏️ 이미지 조정
                </button>
            )}
        </div>
    );
}

const HANDLE_DEFS: { pos: string; dirX: number; dirY: number }[] = [
    { pos: 'tl', dirX: -1, dirY: -1 },
    { pos: 'tr', dirX: 1, dirY: -1 },
    { pos: 'bl', dirX: -1, dirY: 1 },
    { pos: 'br', dirX: 1, dirY: 1 },
    { pos: 'tm', dirX: 0, dirY: -1 },
    { pos: 'bm', dirX: 0, dirY: 1 },
    { pos: 'lm', dirX: -1, dirY: 0 },
    { pos: 'rm', dirX: 1, dirY: 0 },
];

function EditHandles({
    shiftHeld, onScaleStart, onCropStart,
}: {
    shiftHeld: boolean;
    onScaleStart: (e: React.MouseEvent) => void;
    onCropStart: (e: React.MouseEvent, dirX: number, dirY: number) => void;
}) {
    return (
        <>
            {HANDLE_DEFS.map(h => (
                <div
                    key={h.pos}
                    className={`exam-handle exam-handle-${h.pos} ${shiftHeld ? 'crop-mode' : ''}`}
                    // shiftHeld state 대신 실제 mousedown 이벤트의 shiftKey를 사용 —
                    // 상태 반영 타이밍보다 안전.
                    onMouseDown={(e) => e.shiftKey ? onCropStart(e, h.dirX, h.dirY) : onScaleStart(e)}
                />
            ))}
        </>
    );
}

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}
function clamp01(v: number): number {
    if (!isFinite(v)) return 0;
    return Math.max(0, Math.min(0.45, v));
}

function ImgWithOpts({ src, alt, opts }: { src: string; alt: string; opts: ImgOpts }) {
    const visW = Math.max(0.1, 1 - opts.cropLeft - opts.cropRight);
    const visH = Math.max(0.1, 1 - opts.cropTop - opts.cropBottom);
    const widthPct = Math.round(opts.scale * 100);
    const noCrop = opts.cropTop === 0 && opts.cropBottom === 0 && opts.cropLeft === 0 && opts.cropRight === 0;
    const alignJC = opts.align === 'left' ? 'flex-start' : opts.align === 'right' ? 'flex-end' : 'center';

    if (noCrop) {
        return (
            <div style={{ display: 'flex', justifyContent: alignJC, width: '100%' }}>
                <img src={src} alt={alt} style={{ width: `${widthPct}%`, height: 'auto', display: 'block' }} />
            </div>
        );
    }
    return (
        <div style={{ display: 'flex', justifyContent: alignJC, width: '100%' }}>
            <div style={{
                width: `${widthPct}%`,
                overflow: 'hidden',
                position: 'relative',
                aspectRatio: `${visW} / ${visH}`,
            }}>
                <img
                    src={src}
                    alt={alt}
                    style={{
                        position: 'absolute',
                        width: `${100 / visW}%`,
                        left: `${-(opts.cropLeft / visW) * 100}%`,
                        top: `${-(opts.cropTop / visH) * 100}%`,
                        height: 'auto',
                        display: 'block',
                    }}
                />
            </div>
        </div>
    );
}

function hasAnswers(exam: ExamHydrated): boolean {
    return collectAnswers(exam).some(a => a.answer);
}

function collectAnswers(exam: ExamHydrated): { no: number; answer: string | null }[] {
    const out: { no: number; answer: string | null }[] = [];
    let no = 1;
    for (const it of exam.items) {
        if (it.kind === 'passage' && it.passage?.questions) {
            for (const q of it.passage.questions) out.push({ no: no++, answer: q.answer || null });
        } else if (it.kind === 'question' && it.question) {
            out.push({ no: no++, answer: it.question.answer || null });
        }
    }
    return out;
}

// ExamItem 옵션은 미리보기·PDF 공통. flattenSlots에서 사용.
export { flattenSlots as flattenExam };

const EXAM_PAPER_CSS = `
.exam-paper-root {
    font-family: 'Nanum Myeongjo', 'Batang', 'Times New Roman', serif;
    color: #111827;
    line-height: 1.55;
}

@media print {
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .exam-adjust-btn { display: none !important; }
}

.exam-page {
    width: 210mm;
    height: 297mm;
    padding: 12mm 14mm;
    box-sizing: border-box;
    background: white;
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.exam-page:last-child { page-break-after: auto; }

/* 헤더 */
.exam-header {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding-bottom: 4mm;
    border-bottom: 1.5px solid #1f2937;
    margin-bottom: 6mm;
}
.exam-header-left {
    text-align: left;
    font-family: 'Nanum Gothic', 'Malgun Gothic', sans-serif;
    font-size: 9pt;
    color: #6b7280;
    font-weight: 600;
}
.exam-header-title {
    text-align: center;
    font-family: 'Nanum Gothic', 'Malgun Gothic', sans-serif;
    font-size: 15pt;
    font-weight: 800;
    margin: 0;
    letter-spacing: 0.5px;
    color: #0f172a;
}
.exam-header-right {
    text-align: right;
}
.exam-page-no {
    display: inline-block;
    background: #0f172a;
    color: white;
    font-family: 'Nanum Gothic', sans-serif;
    font-size: 10pt;
    font-weight: 800;
    padding: 1mm 4mm;
    border-radius: 2px;
}

/* 본문 = 좌·우 두 슬롯, 세로 구분선 */
.exam-body {
    flex: 1 1 0;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1px 1fr;
    gap: 0;
    overflow: hidden;
}
.exam-body::before {
    content: '';
    grid-column: 2;
    grid-row: 1;
    background: #1f2937;
    justify-self: center;
    width: 1.2px;
    height: 100%;
}
.exam-slot {
    padding: 0 5mm;
    overflow: visible; /* 조절점 핸들이 wrap 경계 밖(padding 영역)에 위치하므로 clip 금지 */
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.exam-slot-left { grid-column: 1; grid-row: 1; }
.exam-slot-right { grid-column: 3; grid-row: 1; }

.exam-slot-inner {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start; /* 좌상단 기본 */
    justify-content: flex-start;
    gap: 3mm;
}

.exam-image-wrap {
    display: block;
    max-width: 100%;
}
.exam-image-wrap.passage {
    border: 1.2px solid #1f2937;
    padding: 2mm;
    background: white;
    box-sizing: border-box;
}
.exam-image-wrap.question {
    /* 문제는 border 없음 (원본 이미지에 이미 박스가 포함된 경우가 대부분) */
}

.exam-section-row {
    margin-bottom: 3mm;
    padding-bottom: 2mm;
    border-bottom: 1.2px solid #1f2937;
}
.exam-section-tag {
    display: inline-block;
    background: #4c1d95;
    color: white;
    font-family: 'Nanum Gothic', sans-serif;
    font-size: 10pt;
    font-weight: 800;
    padding: 1.5mm 4mm;
    border-radius: 20mm;
    letter-spacing: 0.4px;
}

.exam-question-no-row {
    display: flex;
    align-items: baseline;
    gap: 3mm;
}
.exam-question-no {
    font-family: 'Nanum Gothic', sans-serif;
    font-weight: 800;
    font-size: 12pt;
    color: #0f172a;
}
.exam-question-original-no {
    font-family: 'Nanum Gothic', sans-serif;
    font-size: 8pt;
    color: #94a3b8;
    font-weight: 500;
}

/* 정답표 페이지 */
.exam-answer-body {
    flex: 1 1 0;
    min-height: 0;
    padding: 4mm 0;
    overflow: hidden;
}
.exam-answer-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 3mm 6mm;
    font-family: 'Nanum Gothic', sans-serif;
    font-size: 11pt;
}
.exam-answer-cell {
    display: flex;
    align-items: baseline;
    gap: 2mm;
    padding: 1.5mm 2mm;
    border-bottom: 1px dashed #cbd5e1;
}
.exam-answer-no { font-weight: 800; color: #0f172a; min-width: 6mm; }
.exam-answer-val { font-weight: 600; color: #4c1d95; }

/* 푸터 */
.exam-footer {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 4mm;
    padding-top: 4mm;
    border-top: 1px solid #e2e8f0;
    margin-top: 4mm;
}
.exam-page-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2mm;
    padding: 1mm 4mm;
    border: 1px solid #1f2937;
    font-family: 'Nanum Gothic', sans-serif;
    font-size: 9pt;
    font-weight: 800;
    color: #0f172a;
    border-radius: 1mm;
    background: white;
}
.exam-page-badge .pn { font-size: 11pt; }
.exam-page-badge .pt { color: #6b7280; font-size: 9pt; }
.exam-copyright {
    font-family: 'Nanum Gothic', sans-serif;
    font-size: 7.5pt;
    color: #94a3b8;
    text-align: right;
}

/* 인라인 편집 모드 시각 표시 (한글 그림 편집 스타일) */
.exam-editable-img {
    position: relative;
    user-select: none;
    transition: outline 0.15s;
    outline: 1.5px solid transparent;
    outline-offset: 2px;
}
.exam-slot-inner.editable .exam-editable-img { cursor: default; }
.exam-slot-inner.editable .exam-editable-img:hover {
    outline: 1.5px solid rgba(59,130,246,0.5);
}

/* 8방향 핸들 — 리사이즈 모드 (한글식 파란 사각점) */
.exam-handle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: #2563eb;
    border: 1.5px solid white;
    box-shadow: 0 0 3px rgba(0,0,0,0.35);
    opacity: 0;
    transition: opacity 0.15s, background 0.1s, border-color 0.1s;
    z-index: 15;
    pointer-events: auto;
}
.exam-slot-inner.editable .exam-editable-img:hover .exam-handle,
.exam-slot-inner.editable .exam-editable-img:active .exam-handle {
    opacity: 1;
}
/* Shift 눌린 상태에서는 hover 없이도 항상 마커 노출 */
.exam-slot-inner.editable.shift-held .exam-handle {
    opacity: 1;
}
.exam-handle-tl { left: 0; top: 0; transform: translate(-50%, -50%); cursor: nwse-resize; }
.exam-handle-tr { right: 0; top: 0; transform: translate(50%, -50%); cursor: nesw-resize; }
.exam-handle-bl { left: 0; bottom: 0; transform: translate(-50%, 50%); cursor: nesw-resize; }
.exam-handle-br { right: 0; bottom: 0; transform: translate(50%, 50%); cursor: nwse-resize; }
.exam-handle-tm { left: 50%; top: 0; transform: translate(-50%, -50%); cursor: ns-resize; }
.exam-handle-bm { left: 50%; bottom: 0; transform: translate(-50%, 50%); cursor: ns-resize; }
.exam-handle-lm { left: 0; top: 50%; transform: translate(-50%, -50%); cursor: ew-resize; }
.exam-handle-rm { right: 0; top: 50%; transform: translate(50%, -50%); cursor: ew-resize; }

/* Shift 눌린 상태 — 자르기 마커 (검은 L/T 모양, 크게) */
.exam-handle.crop-mode {
    background: transparent;
    border: none;
    box-shadow: none;
    width: 22px;
    height: 22px;
    cursor: crosshair;
}
.exam-handle.crop-mode::before,
.exam-handle.crop-mode::after {
    content: '';
    position: absolute;
    background: #000;
    box-shadow: 0 0 2px rgba(255,255,255,0.9);
}
/* 코너: 두꺼운 L자 (수평 + 수직 막대) */
.exam-handle-tl.crop-mode::before { top: 0; left: 0; width: 20px; height: 4px; }
.exam-handle-tl.crop-mode::after  { top: 0; left: 0; width: 4px; height: 20px; }
.exam-handle-tr.crop-mode::before { top: 0; right: 0; width: 20px; height: 4px; }
.exam-handle-tr.crop-mode::after  { top: 0; right: 0; width: 4px; height: 20px; }
.exam-handle-bl.crop-mode::before { bottom: 0; left: 0; width: 20px; height: 4px; }
.exam-handle-bl.crop-mode::after  { bottom: 0; left: 0; width: 4px; height: 20px; }
.exam-handle-br.crop-mode::before { bottom: 0; right: 0; width: 20px; height: 4px; }
.exam-handle-br.crop-mode::after  { bottom: 0; right: 0; width: 4px; height: 20px; }
/* 변 중간: 두꺼운 T자 */
.exam-handle-tm.crop-mode::before { top: 0; left: 50%; width: 22px; height: 4px; transform: translateX(-50%); }
.exam-handle-tm.crop-mode::after  { top: 0; left: 50%; width: 4px; height: 14px; transform: translateX(-50%); }
.exam-handle-bm.crop-mode::before { bottom: 0; left: 50%; width: 22px; height: 4px; transform: translateX(-50%); }
.exam-handle-bm.crop-mode::after  { bottom: 0; left: 50%; width: 4px; height: 14px; transform: translateX(-50%); }
.exam-handle-lm.crop-mode::before { left: 0; top: 50%; width: 4px; height: 22px; transform: translateY(-50%); }
.exam-handle-lm.crop-mode::after  { left: 0; top: 50%; width: 14px; height: 4px; transform: translateY(-50%); }
.exam-handle-rm.crop-mode::before { right: 0; top: 50%; width: 4px; height: 22px; transform: translateY(-50%); }
.exam-handle-rm.crop-mode::after  { right: 0; top: 50%; width: 14px; height: 4px; transform: translateY(-50%); }

.exam-crop-rect {
    position: absolute;
    border: 2px dashed #0d9488;
    background: rgba(13,148,136,0.12);
    pointer-events: none;
    z-index: 20;
}

/* 이미지 조정 버튼 (화면 미리보기 전용) */
.exam-adjust-btn {
    position: absolute;
    top: 2mm;
    right: 2mm;
    z-index: 10;
    background: rgba(13,148,136,0.95);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 9pt;
    font-weight: 700;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-family: 'Nanum Gothic', sans-serif;
}
.exam-slot-inner:hover .exam-adjust-btn { opacity: 1; }
.exam-adjust-btn:hover { background: rgba(15,118,110,1); }

@media screen {
    .exam-paper-root {
        background: #e2e8f0;
        padding: 20px;
    }
    .exam-page {
        margin: 0 auto 20px auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    }
}
`;
