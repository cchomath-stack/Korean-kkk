import React from 'react';

// HWPX 시안에 맞춰 만든 시험지 본문 렌더러.
// 미리보기 페이지와 Puppeteer PDF 생성 시 동일하게 사용됨.

export type ExamHydratedItem = {
    id: number;
    kind: 'passage' | 'question';
    sectionLabel: string | null;
    order: number;
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

// 한 항목(지문 세트 또는 단독 문제)을 평탄화해서 PDF 블록 단위로 변환
type ImgOpts = {
    scale: number;
    align: 'left' | 'center' | 'right';
    cropTop: number;
    cropBottom: number;
    cropLeft: number;
    cropRight: number;
};
type FlatBlock =
    | { type: 'section'; label: string; subTitle: string | null }
    | { type: 'passage'; imageUrl: string; spanFull: boolean; opts: ImgOpts }
    | { type: 'question'; imageUrl: string; displayNo: number; originalNo: number | null; long: boolean; opts: ImgOpts };

function itemOpts(it: any): ImgOpts {
    return {
        scale: typeof it.imageScale === 'number' ? it.imageScale : 1.0,
        align: (it.imageAlign === 'left' || it.imageAlign === 'right') ? it.imageAlign : 'center',
        cropTop: typeof it.cropTop === 'number' ? it.cropTop : 0,
        cropBottom: typeof it.cropBottom === 'number' ? it.cropBottom : 0,
        cropLeft: typeof it.cropLeft === 'number' ? it.cropLeft : 0,
        cropRight: typeof it.cropRight === 'number' ? it.cropRight : 0,
    };
}

export function flattenExam(exam: ExamHydrated, opts: { showOriginalNo: boolean }): FlatBlock[] {
    const blocks: FlatBlock[] = [];
    let displayNo = 1;
    let lastLabel: string | null = null;

    for (const it of exam.items) {
        const o = itemOpts(it);
        const labelText = it.sectionLabel?.trim() || null;
        if (labelText && labelText !== lastLabel) {
            blocks.push({ type: 'section', label: labelText, subTitle: passageSubTitle(it.passage) });
            lastLabel = labelText;
        }

        if (it.kind === 'passage' && it.passage) {
            const passageImages: string[] = it.passage.images && it.passage.images.length > 0
                ? it.passage.images.map((im: any) => im.imageUrl).filter(Boolean)
                : (it.passage.imageUrl ? [it.passage.imageUrl] : []);
            for (const imgUrl of passageImages) {
                blocks.push({ type: 'passage', imageUrl: imgUrl, spanFull: false, opts: o });
            }
            const questions = it.passage.questions || [];
            for (const q of questions) {
                blocks.push({
                    type: 'question',
                    imageUrl: q.imageUrl,
                    displayNo: displayNo++,
                    originalNo: opts.showOriginalNo ? (q.questionNo ?? null) : null,
                    long: false,
                    opts: o,
                });
            }
        } else if (it.kind === 'question' && it.question) {
            const q = it.question;
            blocks.push({
                type: 'question',
                imageUrl: q.imageUrl,
                displayNo: displayNo++,
                originalNo: opts.showOriginalNo ? (q.questionNo ?? null) : null,
                long: false,
                opts: o,
            });
        }
    }
    return blocks;
}

function passageSubTitle(passage: any | null): string | null {
    if (!passage) return null;
    const parts = [
        passage.year && `${passage.year}년`,
        passage.month && `${passage.month}월`,
        passage.grade && `고${passage.grade}`,
        passage.source,
        passage.area,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
}

function estimateLong(q: any): boolean {
    // boxH / boxW 기반으로 "긴 문제" 판단 (한 단 80% 이상 차지할 것으로 예상되면 long)
    // 단 폭: A4 (210mm) - 좌우여백 20mm - 단 사이 8mm 가정 → 약 91mm 한 단
    // 단 높이: A4 (297mm) - 상하여백 60mm = 약 237mm
    // 이미지가 단폭에 맞게 스케일됐을 때 height/width 비율로 추정
    if (q.boxH && q.boxW && q.boxW > 0) {
        const ratio = q.boxH / q.boxW;
        // 한 단 폭 91mm 기준, 이미지 세로 길이 = 91 * ratio (mm)
        const estHeightMm = 91 * ratio;
        return estHeightMm > 237 * 0.55; // 한 단의 55% 이상 → 긴 문제로 본다 (보수적으로)
    }
    return false;
}

type ExamPaperProps = {
    exam: ExamHydrated;
    showOriginalNo?: boolean;
};

// HTML/CSS로 시험지 렌더링.
// Puppeteer에 그대로 전달해 PDF로 변환할 수 있도록 print 친화적인 CSS 사용.
export function ExamPaper({ exam, showOriginalNo = true }: ExamPaperProps) {
    const blocks = flattenExam(exam, { showOriginalNo });

    return (
        <div className="exam-paper-root">
            <style>{EXAM_PAPER_CSS}</style>

            <div className="exam-page">
                {/* 최초 헤더 (큰 제목) */}
                <header className="exam-header-large">
                    <p className="exam-subtitle">{exam.subTitle || '소제목도 넣을 수 있어요'}</p>
                    <h1 className="exam-title">{exam.title || '제목도 넣을 수 있어요'}</h1>
                </header>

                {/* 본문 (2단) */}
                <main className="exam-body">
                    {blocks.map((b, idx) => (
                        <ExamBlock key={idx} block={b} />
                    ))}
                </main>

                {/* 푸터 */}
                <footer className="exam-footer">
                    <p className="exam-copyright">
                        본 자료의 무단 복제·배포·전송을 금지하며, 위반 시 민·형사상 책임이 발생할 수 있습니다.
                    </p>
                </footer>
            </div>

            {/* 정답표 (페이지 분할) */}
            {hasAnswers(exam) && (
                <div className="exam-page exam-page-answer">
                    <header className="exam-header-small">
                        <div className="exam-header-small-left">
                            <span className="exam-section-tag">정답표</span>
                            <span className="exam-section-subtitle">Answer Key</span>
                        </div>
                        <div className="exam-header-small-right">
                            {exam.academyName || ''}
                        </div>
                    </header>
                    <main className="exam-answer-grid">
                        {collectAnswers(exam).map(a => (
                            <div key={a.no} className="exam-answer-cell">
                                <span className="exam-answer-no">{a.no}.</span>
                                <span className="exam-answer-val">{a.answer || '-'}</span>
                            </div>
                        ))}
                    </main>
                    <footer className="exam-footer">
                        <p className="exam-copyright">
                            본 자료의 무단 복제·배포·전송을 금지하며, 위반 시 민·형사상 책임이 발생할 수 있습니다.
                        </p>
                    </footer>
                </div>
            )}
        </div>
    );
}

function alignToFlex(a: 'left' | 'center' | 'right'): string {
    return a === 'left' ? 'flex-start' : a === 'right' ? 'flex-end' : 'center';
}

function ImgWithOpts({ src, alt, opts }: { src: string; alt: string; opts: ImgOpts }) {
    const visW = Math.max(0.1, 1 - opts.cropLeft - opts.cropRight);
    const visH = Math.max(0.1, 1 - opts.cropTop - opts.cropBottom);
    const widthPct = Math.round(opts.scale * 100);
    const noCrop = opts.cropTop === 0 && opts.cropBottom === 0 && opts.cropLeft === 0 && opts.cropRight === 0;

    if (noCrop) {
        return (
            <div style={{ display: 'flex', justifyContent: alignToFlex(opts.align), width: '100%' }}>
                <img src={src} alt={alt} style={{ width: `${widthPct}%`, height: 'auto', display: 'block' }} />
            </div>
        );
    }

    // 자르기 적용: wrapper에 overflow:hidden + 내부 이미지를 크게 잡고 음수 위치로 이동
    return (
        <div style={{ display: 'flex', justifyContent: alignToFlex(opts.align), width: '100%' }}>
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

function ExamBlock({ block }: { block: FlatBlock }) {
    if (block.type === 'section') {
        return (
            <div className="exam-block exam-block-section">
                <div className="exam-section-row">
                    <span className="exam-section-tag">{block.label}</span>
                    {block.subTitle && <span className="exam-section-subtitle">{block.subTitle}</span>}
                </div>
            </div>
        );
    }
    if (block.type === 'passage') {
        return (
            <div className={`exam-block exam-block-passage ${block.spanFull ? 'span-full' : ''}`}>
                <div className="exam-passage-box">
                    <ImgWithOpts src={block.imageUrl} alt="passage" opts={block.opts} />
                </div>
            </div>
        );
    }
    // question
    return (
        <div className={`exam-block exam-block-question ${block.long ? 'long' : ''}`}>
            <div className="exam-question-no-row">
                <span className="exam-question-no">{block.displayNo}.</span>
                {block.originalNo != null && (
                    <span className="exam-question-original-no">[원본 {block.originalNo}번]</span>
                )}
            </div>
            <ImgWithOpts src={block.imageUrl} alt={`q-${block.displayNo}`} opts={block.opts} />
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
            for (const q of it.passage.questions) {
                out.push({ no: no++, answer: q.answer || null });
            }
        } else if (it.kind === 'question' && it.question) {
            out.push({ no: no++, answer: it.question.answer || null });
        }
    }
    return out;
}

// HWPX 시안에 맞춘 인쇄용 CSS
// A4 / 2단 / 나눔명조(본문) / 나눔고딕(헤더/태그) / 보라색 태그
const EXAM_PAPER_CSS = `
.exam-paper-root {
    font-family: 'Nanum Myeongjo', 'Batang', 'Times New Roman', serif;
    color: #111827;
    line-height: 1.55;
}

@media print {
    @page {
        size: A4;
        margin: 0;
    }
    html, body {
        margin: 0;
        padding: 0;
    }
}

.exam-page {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 14mm 16mm 14mm;
    box-sizing: border-box;
    background: white;
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
}

.exam-page:last-child {
    page-break-after: auto;
}

/* 큰 헤더 (페이지 1만) */
.exam-header-large {
    text-align: center;
    margin-bottom: 4mm;
}
.exam-header-large .exam-subtitle {
    font-family: 'Nanum Gothic', 'Malgun Gothic', sans-serif;
    font-size: 11pt;
    color: #1f2937;
    margin: 0 0 3mm 0;
    font-weight: 500;
    letter-spacing: 0.3px;
}
.exam-header-large .exam-title {
    font-family: 'Nanum Gothic', 'Malgun Gothic', sans-serif;
    font-size: 22pt;
    font-weight: 800;
    margin: 0 0 5mm 0;
    letter-spacing: 1.5px;
    color: #0f172a;
}

/* 작은 헤더 (정답표 페이지) */
.exam-header-small {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 3mm;
    border-bottom: 1.5px solid #1f2937;
    margin-bottom: 6mm;
}
.exam-header-small-left {
    display: flex;
    align-items: center;
    gap: 4mm;
}
.exam-header-small-right {
    font-family: 'Nanum Gothic', sans-serif;
    font-size: 9.5pt;
    color: #4b5563;
    text-align: right;
    max-width: 80mm;
}

/* 섹션 태그 (보라색 둥근 알약) */
.exam-section-row {
    display: flex;
    align-items: center;
    gap: 4mm;
    padding-bottom: 2mm;
    border-bottom: 1.5px solid #1f2937;
    margin-bottom: 4mm;
}
.exam-section-tag {
    display: inline-block;
    background: #4c1d95;
    color: white;
    font-family: 'Nanum Gothic', 'Malgun Gothic', sans-serif;
    font-size: 10.5pt;
    font-weight: 800;
    padding: 1.5mm 5mm;
    border-radius: 20mm;
    letter-spacing: 0.5px;
}
.exam-section-subtitle {
    font-family: 'Nanum Gothic', 'Malgun Gothic', sans-serif;
    font-size: 10pt;
    font-weight: 500;
    color: #1f2937;
}

/* 본문 (2단) */
.exam-body {
    column-count: 2;
    column-gap: 8mm;
    column-rule: 1px solid #1f2937;
    column-fill: auto;
    flex-grow: 1;
    font-size: 10.5pt;
    line-height: 1.55;
}

.exam-block {
    break-inside: avoid;
    page-break-inside: avoid;
    -webkit-column-break-inside: avoid;
    margin-bottom: 5mm;
}

/* 섹션 라벨(보라 태그)만 양 단 가로지름. 지문/문제는 모두 한 단 안에 통째로. */
.exam-block-section {
    column-span: all;
}

.exam-passage-box {
    border: 1.2px solid #1f2937;
    padding: 4mm;
    background: white;
}
.exam-passage-box img {
    width: 100%;
    height: auto;
    display: block;
}

.exam-block-question {
    break-inside: avoid;
    page-break-inside: avoid;
    -webkit-column-break-inside: avoid;
}
.exam-question-no-row {
    display: flex;
    align-items: baseline;
    gap: 3mm;
    margin-bottom: 2mm;
}
.exam-question-no {
    font-family: 'Nanum Gothic', 'Malgun Gothic', sans-serif;
    font-weight: 800;
    font-size: 11.5pt;
    color: #0f172a;
}
.exam-question-original-no {
    font-family: 'Nanum Gothic', sans-serif;
    font-size: 8pt;
    color: #94a3b8;
    font-weight: 500;
}
.exam-block-question img {
    width: 100%;
    height: auto;
    display: block;
}

/* 정답표 */
.exam-answer-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 3mm 6mm;
    font-family: 'Nanum Gothic', 'Malgun Gothic', sans-serif;
    font-size: 11pt;
    flex-grow: 1;
    align-content: start;
}
.exam-answer-cell {
    display: flex;
    align-items: baseline;
    gap: 2mm;
    padding: 1.5mm 2mm;
    border-bottom: 1px dashed #cbd5e1;
}
.exam-answer-no {
    font-weight: 800;
    color: #0f172a;
    min-width: 6mm;
}
.exam-answer-val {
    font-weight: 600;
    color: #4c1d95;
}

/* 푸터 */
.exam-footer {
    text-align: center;
    padding-top: 4mm;
    border-top: 1px solid #e2e8f0;
    margin-top: 4mm;
}
.exam-copyright {
    font-family: 'Nanum Gothic', sans-serif;
    font-size: 7.5pt;
    color: #94a3b8;
    margin: 0;
}

/* Screen-only preview tweaks */
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
