import React from 'react';

// 학생 오답노트 PDF 렌더러 — 시안 HTML 그대로 컴포넌트화 (MEXX / 오름 2종)

export type HydratedAnswer = {
    id: number;
    roundItem: {
        id: number;
        kind: 'passage' | 'question';
        order: number;
        passageId: number | null;
        questionId: number | null;
    };
    passage: any | null;
    question: any | null;
};

export type WrongNoteRequestData = {
    id: number;
    studentName: string;
    school: string | null;
    grade: number | null;
    design: string;
    createdAt: string | Date;
    academy: { id: number; name: string } | null;
    round: { id: number; title: string; subTitle: string | null };
    answers: HydratedAnswer[];
};

type FlatBlock =
    | { type: 'passage'; imageUrl: string; section?: string }
    | { type: 'question'; imageUrl: string; displayNo: number; metaLine: string };

// 답변 평탄화: 지문 → 그 지문에 속한 문제들, 단독 문제 → 그 문제
function flattenAnswers(req: WrongNoteRequestData): FlatBlock[] {
    const blocks: FlatBlock[] = [];
    let displayNo = 1;

    for (const a of req.answers) {
        if (a.roundItem.kind === 'passage' && a.passage) {
            // 지문이 여러 조각(PassageImage[])으로 쪼개져 저장된 경우 모두 출력
            const passageImages: string[] = a.passage.images && a.passage.images.length > 0
                ? a.passage.images.map((im: any) => im.imageUrl).filter(Boolean)
                : (a.passage.imageUrl ? [a.passage.imageUrl] : []);
            let firstImage = true;
            for (const imgUrl of passageImages) {
                blocks.push({
                    type: 'passage',
                    imageUrl: imgUrl,
                    section: firstImage ? passageSectionLabel(a.passage) : undefined,
                });
                firstImage = false;
            }
            // 지문에 속한 문제들 — 모두 출력 (학생이 그 지문의 일부만 틀려도 지문은 통째로 보여줘야 풀이 가능)
            const questions = a.passage.questions || [];
            for (const q of questions) {
                blocks.push({
                    type: 'question',
                    imageUrl: q.imageUrl,
                    displayNo: displayNo++,
                    metaLine: questionMeta(q, a.passage),
                });
            }
        } else if (a.roundItem.kind === 'question' && a.question) {
            blocks.push({
                type: 'question',
                imageUrl: a.question.imageUrl,
                displayNo: displayNo++,
                metaLine: questionMeta(a.question, a.question.passage || null),
            });
        }
    }
    return blocks;
}

function passageSectionLabel(passage: any): string {
    const area = passage.area || '독서';
    return `지문 · ${area}`;
}

function questionMeta(q: any, passage: any | null): string {
    const year = passage?.year ?? q.year;
    const month = passage?.month ?? q.month;
    const grade = passage?.grade ?? q.grade;
    const area = q.area || passage?.area;
    const parts = [
        grade && `고${grade}`,
        year && month && `${year}.${String(month).padStart(2, '0')}`,
        passage ? '학평' : '단독',
        area,
    ].filter(Boolean);
    return parts.join(' · ');
}

function fmtDate(d: string | Date): string {
    const dt = typeof d === 'string' ? new Date(d) : d;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
}

// ====== 메인 컴포넌트 — design 분기 ======
export function WrongNotePaper({ data, logoUrls }: { data: WrongNoteRequestData; logoUrls?: { mexxWhite?: string; mexxNavy?: string } }) {
    if (data.design === 'mexx') return <MexxPaper data={data} logoUrls={logoUrls} />;
    return <OreumPaper data={data} />;
}

// ====== MEXX 디자인 ======
function MexxPaper({ data, logoUrls }: { data: WrongNoteRequestData; logoUrls?: { mexxWhite?: string; mexxNavy?: string } }) {
    const blocks = flattenAnswers(data);
    const totalWrong = data.answers.length;
    const academyName = data.academy?.name || '';
    const schoolGrade = [data.school, data.grade && `${data.grade}학년`].filter(Boolean).join(' ');

    return (
        <div className="wn-root mexx">
            <style>{MEXX_CSS}</style>

            {/* 표지 */}
            <div className="page">
                <div className="header">
                    <div className="logo">{logoUrls?.mexxWhite ? <img src={logoUrls.mexxWhite} alt="MEXX" /> : <span className="logo-text">MEXX</span>}</div>
                    <div className="doc-type">오답노트</div>
                </div>
                <div className="cover">
                    <div>
                        <div className="eyebrow">오답노트</div>
                        <h1>{data.round.title}</h1>
                        {data.round.subTitle && <div className="round-sub">{data.round.subTitle}</div>}
                        <hr />
                        <div className="meta-grid three">
                            <div>
                                <div className="field-label">학생</div>
                                <div className="field-value">{data.studentName}</div>
                                {schoolGrade && <div className="field-value-sub">{schoolGrade}</div>}
                            </div>
                            <div>
                                <div className="field-label">틀린 문제</div>
                                <div className="field-value">{totalWrong} 문제</div>
                            </div>
                            <div>
                                <div className="field-label">발행일</div>
                                <div className="field-value">{fmtDate(data.createdAt)}</div>
                            </div>
                        </div>
                    </div>
                    {academyName && (
                        <div className="academy-block">
                            <hr />
                            <div className="value">{academyName}</div>
                        </div>
                    )}
                </div>
                <FooterMexx logoUrl={logoUrls?.mexxNavy} pageNo={1} pageTotal={'—'} />
            </div>

            {/* 본문 */}
            <div className="page">
                <div className="header">
                    <div className="logo">{logoUrls?.mexxWhite ? <img src={logoUrls.mexxWhite} alt="MEXX" /> : <span className="logo-text">MEXX</span>}</div>
                    <div className="doc-type">오답노트</div>
                </div>
                <div className="content">
                    {blocks.length === 0 && <p className="empty">출력할 항목이 없습니다.</p>}
                    {blocks.map((b, i) => <MexxBlock key={i} block={b} />)}
                </div>
                <FooterMexx logoUrl={logoUrls?.mexxNavy} pageNo={2} pageTotal={'—'} />
            </div>
        </div>
    );
}

function MexxBlock({ block }: { block: FlatBlock }) {
    if (block.type === 'passage') {
        return (
            <div className="mexx-passage-wrap">
                {block.section && (
                    <div className="section-label">
                        <span className="num">{block.section}</span>
                    </div>
                )}
                <div className="divider" />
                <div className="passage-box">
                    <img src={block.imageUrl} alt="passage" />
                </div>
            </div>
        );
    }
    return (
        <div className="question-block">
            <div className="q-head">
                <div className="q-bar" />
                <div className="q-no">{block.displayNo}번</div>
                <div className="q-meta">{block.metaLine}</div>
            </div>
            <div className="q-frame">
                <img src={block.imageUrl} alt={`q-${block.displayNo}`} />
            </div>
        </div>
    );
}

function FooterMexx({ logoUrl, pageNo, pageTotal }: { logoUrl?: string; pageNo: number; pageTotal: number | string }) {
    return (
        <div className="footer">
            <span className="left">
                {logoUrl ? <img src={logoUrl} alt="MEXX" style={{ height: '4mm' }} /> : <span style={{ fontWeight: 700 }}>MEXX</span>}
            </span>
            <span className="right">{pageNo} / {pageTotal}</span>
        </div>
    );
}

// ====== 오름 디자인 ======
function OreumPaper({ data }: { data: WrongNoteRequestData }) {
    const blocks = flattenAnswers(data);
    const totalWrong = data.answers.length;
    const academyName = data.academy?.name || '';
    const schoolGrade = [data.school, data.grade && `${data.grade}학년`].filter(Boolean).join(' ');

    return (
        <div className="wn-root oreum">
            <style>{OREUM_CSS}</style>

            {/* 표지 */}
            <div className="page">
                <div className="header">
                    <div className="logo">
                        <div className="logo-mark">오</div>
                        <div className="logo-text">[오름] 국어</div>
                    </div>
                    <div className="doc-type">오답노트</div>
                </div>
                <div className="cover">
                    <svg className="cover-deco" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 120 L40 50 L70 80 L110 30 L150 70 L200 20 L200 120 Z" fill="#0d9488" />
                    </svg>
                    <div>
                        <span className="eyebrow-pill">오답노트</span>
                        <h1>{data.round.title}</h1>
                        {data.round.subTitle && <div className="round-sub">{data.round.subTitle}</div>}
                        <div className="meta-card">
                            <div className="meta-grid">
                                <div>
                                    <div className="field-label">학생</div>
                                    <div className="field-value">{data.studentName}</div>
                                    {schoolGrade && <div className="field-value-sub">{schoolGrade}</div>}
                                </div>
                                <div>
                                    <div className="field-label">틀린 문제</div>
                                    <div className="field-value">{totalWrong} 문제</div>
                                </div>
                                <div>
                                    <div className="field-label">발행일</div>
                                    <div className="field-value">{fmtDate(data.createdAt)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {academyName && (
                        <div className="academy-block">
                            <hr />
                            <div className="row">
                                <span className="badge">학원</span>
                                <span className="value">{academyName}</span>
                            </div>
                        </div>
                    )}
                </div>
                <FooterOreum pageNo={1} pageTotal={'—'} />
            </div>

            {/* 본문 */}
            <div className="page">
                <div className="header">
                    <div className="logo">
                        <div className="logo-mark">오</div>
                        <div className="logo-text">[오름] 국어</div>
                    </div>
                    <div className="doc-type">오답노트</div>
                </div>
                <div className="content">
                    {blocks.length === 0 && <p className="empty">출력할 항목이 없습니다.</p>}
                    {blocks.map((b, i) => <OreumBlock key={i} block={b} />)}
                </div>
                <FooterOreum pageNo={2} pageTotal={'—'} />
            </div>
        </div>
    );
}

function OreumBlock({ block }: { block: FlatBlock }) {
    if (block.type === 'passage') {
        return (
            <div className="oreum-passage-wrap">
                {block.section && (
                    <div className="section-pill-row">
                        <span className="section-pill">{block.section}</span>
                        <span className="section-line" />
                    </div>
                )}
                <div className="passage-box">
                    <img src={block.imageUrl} alt="passage" />
                </div>
            </div>
        );
    }
    return (
        <div className="question-block">
            <div className="q-head">
                <div className="q-no-circle">{block.displayNo}</div>
                <div className="q-title">{block.displayNo}번 문제</div>
                <div className="q-meta">{block.metaLine}</div>
            </div>
            <div className="q-frame">
                <img src={block.imageUrl} alt={`q-${block.displayNo}`} />
            </div>
        </div>
    );
}

function FooterOreum({ pageNo, pageTotal }: { pageNo: number; pageTotal: number | string }) {
    return (
        <div className="footer">
            <div className="brand">
                <div className="brand-mark">오</div>
                <span>[오름] 국어학원</span>
            </div>
            <div className="page-num"><strong>{pageNo}</strong> / {pageTotal}</div>
        </div>
    );
}

// ====== CSS (시안과 동일) ======
const MEXX_CSS = `
.wn-root.mexx {
    font-family: 'Pretendard', sans-serif;
    color: #14181F;
}
.wn-root.mexx .page {
    width: 210mm; min-height: 297mm;
    background: white;
    display: flex; flex-direction: column;
    page-break-after: always;
}
.wn-root.mexx .header {
    flex-shrink: 0; height: 18mm;
    background: #0E1B30; color: white;
    padding: 0 24mm;
    display: flex; align-items: center; justify-content: space-between;
}
.wn-root.mexx .header .logo img { height: 10mm; width: auto; display: block; }
.wn-root.mexx .header .logo .logo-text { font-weight: 800; font-size: 16pt; letter-spacing: 0.04em; }
.wn-root.mexx .header .doc-type { font-weight: 700; font-size: 11pt; letter-spacing: 0.3em; opacity: 0.85; }
.wn-root.mexx .content { flex: 1; padding: 16mm 24mm; }
.wn-root.mexx .cover { display: flex; flex-direction: column; justify-content: space-between; height: 100%; padding: 30mm 24mm 0; }
.wn-root.mexx .cover .eyebrow { font-size: 10pt; font-weight: 700; letter-spacing: 0.4em; color: #6B6E76; margin-bottom: 14mm; }
.wn-root.mexx .cover h1 { font-weight: 700; font-size: 34pt; line-height: 1.25; color: #0E1B30; margin: 0 0 5mm; letter-spacing: -0.02em; }
.wn-root.mexx .cover .round-sub { font-weight: 500; font-size: 13pt; color: #6B6E76; margin: 0 0 18mm; }
.wn-root.mexx .cover hr { border: 0; border-top: 1px solid #E2E2E2; margin: 0 0 14mm; }
.wn-root.mexx .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm 16mm; margin-bottom: 14mm; }
.wn-root.mexx .meta-grid.three { grid-template-columns: 1.4fr 1fr 1fr; }
.wn-root.mexx .meta-grid .field-label { font-size: 9pt; font-weight: 700; letter-spacing: 0.2em; color: #6B6E76; margin-bottom: 3mm; }
.wn-root.mexx .meta-grid .field-value { font-weight: 700; font-size: 15pt; color: #14181F; }
.wn-root.mexx .meta-grid .field-value-sub { font-weight: 500; font-size: 10.5pt; color: #6B6E76; margin-top: 1.5mm; }
.wn-root.mexx .academy-block { padding-bottom: 16mm; }
.wn-root.mexx .academy-block hr { margin: 0 0 8mm; }
.wn-root.mexx .academy-block .value { font-weight: 700; font-size: 18pt; color: #14181F; letter-spacing: -0.01em; }
.wn-root.mexx .section-label { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4mm; }
.wn-root.mexx .section-label .num { font-size: 11pt; font-weight: 800; letter-spacing: 0.1em; color: #14181F; }
.wn-root.mexx .divider { height: 1px; background: #E2E2E2; margin-bottom: 8mm; }
.wn-root.mexx .passage-box { border: 1px solid #E2E2E2; border-radius: 2px; padding: 4mm; margin-bottom: 10mm; }
.wn-root.mexx .passage-box img { width: 100%; display: block; }
.wn-root.mexx .question-block { margin-bottom: 10mm; }
.wn-root.mexx .q-head { display: flex; align-items: center; gap: 4mm; margin-bottom: 3mm; }
.wn-root.mexx .q-bar { width: 4px; height: 16pt; background: #EA561C; flex-shrink: 0; }
.wn-root.mexx .q-no { font-weight: 800; font-size: 13pt; color: #14181F; }
.wn-root.mexx .q-meta { font-weight: 500; font-size: 9.5pt; color: #6B6E76; margin-left: auto; }
.wn-root.mexx .q-frame { border: 1px solid #E2E2E2; border-radius: 2px; padding: 4mm; }
.wn-root.mexx .q-frame img { width: 100%; display: block; }
.wn-root.mexx .footer { flex-shrink: 0; border-top: 1px solid #E2E2E2; padding: 4mm 24mm; display: flex; justify-content: space-between; align-items: center; font-size: 9pt; font-weight: 600; color: #6B6E76; }
.wn-root.mexx .footer .right { font-weight: 800; color: #14181F; }
.wn-root.mexx .empty { color: #94a3b8; font-weight: 600; text-align: center; padding: 40mm 0; }
`;

const OREUM_CSS = `
.wn-root.oreum { font-family: 'Pretendard', sans-serif; color: #0f172a; }
.wn-root.oreum .page { width: 210mm; min-height: 297mm; background: white; display: flex; flex-direction: column; page-break-after: always; }
.wn-root.oreum .header { flex-shrink: 0; height: 18mm; background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; padding: 0 22mm; display: flex; align-items: center; justify-content: space-between; }
.wn-root.oreum .header .logo { display: flex; align-items: center; gap: 3mm; }
.wn-root.oreum .header .logo-mark { width: 9mm; height: 9mm; background: white; color: #0d9488; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13pt; }
.wn-root.oreum .header .logo-text { font-weight: 800; font-size: 14pt; letter-spacing: -0.01em; }
.wn-root.oreum .header .doc-type { background: rgba(255,255,255,0.15); padding: 1.8mm 4mm; border-radius: 100px; font-weight: 700; font-size: 9.5pt; letter-spacing: 0.1em; }
.wn-root.oreum .content { flex: 1; padding: 14mm 22mm; }
.wn-root.oreum .cover { display: flex; flex-direction: column; justify-content: space-between; height: 100%; padding: 28mm 22mm 0; position: relative; overflow: hidden; }
.wn-root.oreum .cover-deco { position: absolute; bottom: 30mm; right: -10mm; width: 90mm; height: 60mm; opacity: 0.06; pointer-events: none; }
.wn-root.oreum .eyebrow-pill { display: inline-block; background: #f0fdfa; color: #0f766e; border: 1.5px solid #ccfbf1; padding: 1.6mm 4mm; border-radius: 100px; font-size: 9pt; font-weight: 800; letter-spacing: 0.08em; margin-bottom: 12mm; }
.wn-root.oreum .cover h1 { font-weight: 800; font-size: 36pt; line-height: 1.2; color: #0f172a; margin: 0 0 5mm; letter-spacing: -0.025em; }
.wn-root.oreum .cover .round-sub { font-weight: 600; font-size: 13pt; color: #64748b; margin: 0 0 14mm; }
.wn-root.oreum .meta-card { background: white; border: 1px solid #e2e8f0; border-radius: 5mm; padding: 8mm; box-shadow: 0 4px 16px rgba(13,148,136,0.05); margin-bottom: 12mm; }
.wn-root.oreum .meta-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 8mm; }
.wn-root.oreum .meta-grid .field-label { display: flex; align-items: center; gap: 1.8mm; font-size: 9pt; font-weight: 700; color: #0f766e; margin-bottom: 2.5mm; }
.wn-root.oreum .meta-grid .field-label::before { content: ''; width: 5px; height: 5px; background: #14b8a6; border-radius: 50%; }
.wn-root.oreum .meta-grid .field-value { font-weight: 800; font-size: 15pt; color: #0f172a; line-height: 1.25; }
.wn-root.oreum .meta-grid .field-value-sub { font-weight: 500; font-size: 10pt; color: #64748b; margin-top: 1.5mm; }
.wn-root.oreum .academy-block { margin-top: auto; padding-bottom: 18mm; }
.wn-root.oreum .academy-block hr { border: 0; border-top: 1px dashed #e2e8f0; margin: 0 0 6mm; }
.wn-root.oreum .academy-block .row { display: flex; align-items: baseline; gap: 3mm; }
.wn-root.oreum .academy-block .badge { font-size: 9pt; font-weight: 700; color: #0f766e; background: #f0fdfa; padding: 1mm 3mm; border-radius: 100px; }
.wn-root.oreum .academy-block .value { font-weight: 700; font-size: 16pt; color: #0f172a; letter-spacing: -0.01em; }
.wn-root.oreum .section-pill-row { display: flex; align-items: center; gap: 3mm; margin-bottom: 7mm; }
.wn-root.oreum .section-pill { background: #0d9488; color: white; padding: 2mm 5mm; border-radius: 100px; font-weight: 800; font-size: 9.5pt; letter-spacing: 0.05em; box-shadow: 0 4px 10px rgba(13,148,136,0.25); }
.wn-root.oreum .section-line { flex: 1; height: 1px; background: linear-gradient(to right, #e2e8f0 0%, transparent 100%); }
.wn-root.oreum .passage-box { background: white; border: 1px solid #e2e8f0; border-radius: 6mm; padding: 5mm; margin-bottom: 9mm; box-shadow: 0 4px 18px rgba(15,23,42,0.06); }
.wn-root.oreum .passage-box img { width: 100%; display: block; border-radius: 3mm; }
.wn-root.oreum .question-block { margin-bottom: 9mm; }
.wn-root.oreum .q-head { display: flex; align-items: center; gap: 3mm; margin-bottom: 3mm; }
.wn-root.oreum .q-no-circle { width: 11mm; height: 11mm; background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11pt; box-shadow: 0 4px 10px rgba(13,148,136,0.3); flex-shrink: 0; }
.wn-root.oreum .q-title { font-weight: 800; font-size: 13pt; color: #0f172a; }
.wn-root.oreum .q-meta { font-weight: 500; font-size: 9.5pt; color: #64748b; margin-left: auto; }
.wn-root.oreum .q-frame { background: white; border: 1px solid #e2e8f0; border-radius: 6mm; padding: 5mm; box-shadow: 0 4px 18px rgba(15,23,42,0.06); }
.wn-root.oreum .q-frame img { width: 100%; display: block; border-radius: 3mm; }
.wn-root.oreum .footer { flex-shrink: 0; border-top: 1px solid #e2e8f0; padding: 4mm 22mm; display: flex; justify-content: space-between; align-items: center; font-size: 9pt; color: #64748b; }
.wn-root.oreum .footer .brand { display: flex; align-items: center; gap: 2mm; font-weight: 700; }
.wn-root.oreum .footer .brand-mark { width: 5mm; height: 5mm; background: #0d9488; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 8pt; }
.wn-root.oreum .footer .page-num { font-weight: 700; color: #0f172a; }
.wn-root.oreum .footer .page-num strong { color: #0d9488; }
.wn-root.oreum .empty { color: #94a3b8; font-weight: 600; text-align: center; padding: 40mm 0; }
`;
