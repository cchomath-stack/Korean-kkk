'use client';

import React from 'react';
import Link from 'next/link';
import {
    Home, BookOpen, Search, Upload, MousePointer2, Plus, HelpCircle,
    FileText, Tag, X as XIcon, ChevronRight, Lightbulb, AlertCircle, Save,
    Link2, ArrowRight,
} from 'lucide-react';

export default function HelpPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            <header className="h-14 px-6 flex items-center gap-4 border-b bg-white shadow-sm sticky top-0 z-40">
                <Link href="/" className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-sm font-medium">
                    <Home size={16} /> 홈
                </Link>
                <span className="text-slate-300">|</span>
                <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <HelpCircle size={16} /> 사용 설명서
                </h1>
                <nav className="ml-auto flex gap-4 text-xs font-bold text-slate-500">
                    <a href="#bulk" className="hover:text-teal-600">PDF 일괄입력</a>
                    <a href="#types" className="hover:text-teal-600">문제 입력 유형</a>
                    <a href="#search" className="hover:text-teal-600">검색</a>
                </nav>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-12">
                {/* INTRO */}
                <section className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-2xl p-8 border border-teal-100">
                    <h2 className="text-2xl font-black text-slate-900 mb-2">오름국어 사용 설명서</h2>
                    <p className="text-slate-600 leading-relaxed">
                        모의고사 PDF에서 지문/문제를 박스로 잘라 OCR로 본문을 추출하고, 메타정보를 입력하여
                        검색 가능한 데이터베이스로 만드는 시스템입니다. 아래 세 가지를 알면 다 사용하실 수 있어요.
                    </p>
                    <div className="grid grid-cols-3 gap-3 mt-6">
                        <a href="#bulk" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 transition shadow-sm">
                            <Upload className="w-5 h-5 text-teal-600 mb-2" />
                            <div className="font-bold text-sm text-slate-900">PDF 일괄입력</div>
                            <div className="text-xs text-slate-500">박스→OCR→저장</div>
                        </a>
                        <a href="#types" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 transition shadow-sm">
                            <FileText className="w-5 h-5 text-blue-600 mb-2" />
                            <div className="font-bold text-sm text-slate-900">문제 입력 유형</div>
                            <div className="text-xs text-slate-500">지문+문제 / 단독</div>
                        </a>
                        <a href="#search" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 transition shadow-sm">
                            <Search className="w-5 h-5 text-orange-600 mb-2" />
                            <div className="font-bold text-sm text-slate-900">검색</div>
                            <div className="text-xs text-slate-500">키워드 / #태그</div>
                        </a>
                    </div>
                </section>

                {/* SECTION 1 — PDF BULK */}
                <section id="bulk" className="space-y-6 scroll-mt-20">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-teal-600 text-white font-black flex items-center justify-center">1</span>
                        <h2 className="text-2xl font-black text-slate-900">PDF 일괄입력</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                        모의고사 PDF 한 부를 업로드하면 페이지별로 변환되고, 각 페이지에서 지문/문제 영역을 박스로
                        그리면 자동으로 잘라서 OCR을 돌립니다. 그 다음 데이터 입력 모드로 넘어가서 영역/연도/문항번호 등을
                        채우고 저장하면 됩니다.
                    </p>

                    {/* Step 1: Upload */}
                    <Step n={1} title="PDF 업로드" icon={<Upload className="w-5 h-5" />}>
                        <p>관리자페이지 → PDF 일괄입력 → 드래그 앤 드롭 또는 클릭으로 PDF 파일을 올립니다.</p>
                        <Tip>같은 PDF를 다시 올리면 (SHA-256 해시로) 자동 감지해서 기존 작업을 이어서 할 수 있어요.</Tip>
                    </Step>

                    {/* Step 2: Box modes */}
                    <Step n={2} title="박스 그리기 모드" icon={<MousePointer2 className="w-5 h-5" />}>
                        <p>상단 툴바에서 모드를 선택한 뒤, 페이지 위에서 마우스를 드래그해 영역을 표시합니다.</p>
                        <div className="grid grid-cols-3 gap-3 mt-3">
                            <ModeChip color="blue" label="새 지문" desc="새 지문 박스 (그룹 시작)" />
                            <ModeChip color="indigo" label="지문 이어" desc="활성 지문에 단별 추가" />
                            <ModeChip color="orange" label="문제" desc="활성 지문에 자동 연결" />
                        </div>
                    </Step>

                    {/* Visual example */}
                    <ExampleBoxOnPage />

                    {/* Step 3: After boxes */}
                    <Step n={3} title="자동 OCR 처리" icon={<Save className="w-5 h-5" />}>
                        <p>박스를 그리는 즉시 잘린 이미지가 Vercel Blob에 업로드되고 CLOVA OCR로 본문 텍스트가 추출됩니다.</p>
                        <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                            <li><span className="font-bold text-slate-500">회색</span> = 업로드/OCR 처리 중</li>
                            <li><span className="font-bold text-blue-700">파랑/주황</span> = 처리 완료, 저장 대기</li>
                            <li><span className="font-bold text-emerald-700">초록</span> = DB 저장 완료</li>
                        </ul>
                    </Step>

                    {/* Step 4: Input mode */}
                    <Step n={4} title="데이터 입력 모드" icon={<FileText className="w-5 h-5" />}>
                        <p>상단 우측의 <Badge>데이터 입력</Badge> 버튼을 누르면 큰 카드 화면으로 전환됩니다.</p>
                        <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                            <li><b>지문 카드</b> — 학년/연도/월/영역(문학·독서·화작·언매)/시작·끝번호/태그</li>
                            <li><b>문제 카드</b> — 문항번호/정답(①~⑤)/난이도(상·중·하)/태그</li>
                            <li>하나 입력하면 다음 카드에도 같은 메타가 자동 채워져서 빠르게 진행할 수 있어요.</li>
                        </ul>
                    </Step>

                    {/* Step 5: Save */}
                    <Step n={5} title="저장" icon={<Save className="w-5 h-5" />}>
                        <p>각 그룹 카드 우측 상단의 <Badge color="teal">전체 저장</Badge> 버튼으로 지문 + 그 그룹의 모든 문제를 한 번에 저장합니다.</p>
                        <Tip>저장된 카드는 초록색으로 바뀌고, 박스에서도 X 버튼이 사라져 실수로 못 지웁니다.</Tip>
                    </Step>

                    {/* Box delete */}
                    <Callout icon={<XIcon className="w-5 h-5" />} title="박스 삭제 / 다시 그리기">
                        잘못 그린 박스는 마우스를 올리면 우상단에 빨간 ×버튼이 떠요. 누르면 박스 + 카드가 함께 지워져서 다시 그릴 수 있어요.
                        (저장된 박스는 안 지워집니다 — DB 보호)
                    </Callout>

                    {/* Merge */}
                    <Callout icon={<Link2 className="w-5 h-5" />} title="실수로 같은 지문을 두 번 그렸을 때">
                        지문이 좌·우 단으로 나뉘어 있는 걸 모르고 별도 그룹으로 그렸다면, 데이터 입력 모드에서 두 번째 그룹 헤더의
                        <Badge color="indigo"> ↑ 위 지문에 합치기</Badge> 버튼을 누르세요. 위 지문의 단별 추가 이미지로 흡수됩니다.
                    </Callout>
                </section>

                {/* SECTION 2 — TYPES */}
                <section id="types" className="space-y-6 scroll-mt-20">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center">2</span>
                        <h2 className="text-2xl font-black text-slate-900">문제 입력 유형 (지문 / 단독)</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                        모의고사 문항은 <b>지문에 딸린 문제</b>와 <b>단독 문제</b> (지문 없이 푸는 문법/화작 단답형 등) 두 가지가 있어요.
                        시스템이 자동으로 분기 처리합니다.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TypeCard
                            color="blue"
                            title="지문 + 문제 (PASSAGE GROUP)"
                            steps={[
                                '"새 지문" 모드로 지문 영역 1개 그리기',
                                '(필요시) "지문 이어" 모드로 같은 지문의 다른 단 추가',
                                '"문제" 모드로 그 지문에 딸린 문제들 모두 그리기',
                            ]}
                            note="문제 박스는 활성 지문 그룹에 자동으로 attach 됩니다. 헤더의 칩에 [활성 지문] 표시가 떠요."
                        />
                        <TypeCard
                            color="orange"
                            title="단독 문제 (STANDALONE QUESTION)"
                            steps={[
                                '활성 지문이 없는 상태에서 "문제" 모드로 박스 그리기',
                                '문제 카드만 만들어지고 지문 없이 저장됩니다',
                                '여러 단독 문제가 한 STANDALONE 그룹으로 묶임',
                            ]}
                            note="화작/언매 문제처럼 지문 없이 푸는 단답형 문항에 적합합니다."
                        />
                    </div>

                    <Callout icon={<Lightbulb className="w-5 h-5" />} title="진행 팁">
                        한 페이지를 끝낼 때마다 <b>저장 → 다음 페이지</b>로 넘어가는 게 안전해요. 한꺼번에 너무 많이 그리면
                        OCR 큐가 쌓여서 느려질 수 있고, 실수도 찾기 어려워집니다.
                    </Callout>
                </section>

                {/* SECTION 3 — SEARCH */}
                <section id="search" className="space-y-6 scroll-mt-20">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-orange-600 text-white font-black flex items-center justify-center">3</span>
                        <h2 className="text-2xl font-black text-slate-900">검색 방법</h2>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                        홈 화면 검색바에서 키워드를 입력하면 OCR 본문, 영역, 해시태그, 난이도, 문제번호까지
                        한 번에 검색합니다. 여러 키워드를 넣으면 모두 일치(AND)하는 결과만 나옵니다.
                    </p>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Search className="w-4 h-4" /> 검색되는 필드
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <FieldRow label="OCR 본문" desc="지문/문제 안의 글자 (자동 추출됨)" />
                            <FieldRow label="영역" desc="문학 / 독서 / 화작 / 언매" />
                            <FieldRow label="해시태그" desc="#비문학 #논리적사고 등 직접 추가한 태그" />
                            <FieldRow label="난이도" desc="상 / 중 / 하" />
                            <FieldRow label="문항번호 범위" desc="지문이 다루는 문제 번호 (예: 4~7)" />
                            <FieldRow label="단별 이미지 OCR" desc="여러 단으로 나뉜 지문의 각 단 본문" />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Tag className="w-4 h-4" /> 검색 예시
                        </h3>
                        <div className="space-y-3">
                            <ExampleQuery q="이집트" desc="OCR 본문에 '이집트'가 들어간 모든 지문/문제" />
                            <ExampleQuery q="#문학 #2024" desc="문학 영역이면서 #2024 태그가 붙은 결과만 (AND)" />
                            <ExampleQuery q="블록체인 #비문학" desc="OCR 본문에 '블록체인' + #비문학 태그" />
                            <ExampleQuery q="상 화작" desc="난이도 상 + 화작 영역" />
                        </div>
                    </div>

                    <Callout icon={<AlertCircle className="w-5 h-5" />} title="검색 규칙">
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>키워드는 <b>공백 또는 콤마</b>로 구분</li>
                            <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">#</code> 접두사는 자동으로 제거 (있어도 없어도 동일)</li>
                            <li>여러 키워드는 모두 일치해야 함 (AND 검색)</li>
                            <li>입력 후 0.5초 자동 검색 (Enter나 버튼 클릭도 가능)</li>
                            <li>최대 10개 키워드, 200자 제한</li>
                        </ul>
                    </Callout>
                </section>

                <div className="text-center text-xs text-slate-400 py-8">
                    추가 질문은 관리자에게 문의하세요.
                </div>
            </main>
        </div>
    );
}

// ──────────────── Subcomponents ────────────────

function Step({ n, title, icon, children }: { n: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 font-bold text-sm flex items-center justify-center">
                    {n}
                </span>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    {icon} {title}
                </h3>
            </div>
            <div className="text-sm text-slate-600 leading-relaxed pl-10 space-y-2">{children}</div>
        </div>
    );
}

function ModeChip({ color, label, desc }: { color: 'blue' | 'indigo' | 'orange'; label: string; desc: string }) {
    const c = {
        blue: 'border-blue-300 bg-blue-50 text-blue-800',
        indigo: 'border-indigo-300 bg-indigo-50 text-indigo-800',
        orange: 'border-orange-300 bg-orange-50 text-orange-800',
    }[color];
    return (
        <div className={`border-2 rounded-lg p-3 ${c}`}>
            <div className="font-black text-sm">{label}</div>
            <div className="text-[11px] mt-1 opacity-80">{desc}</div>
        </div>
    );
}

function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: 'slate' | 'teal' | 'indigo' }) {
    const c = {
        slate: 'bg-slate-100 text-slate-700 border-slate-200',
        teal: 'bg-teal-100 text-teal-800 border-teal-300',
        indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    }[color];
    return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border ${c}`}>{children}</span>;
}

function Tip({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded text-xs text-amber-900 mt-2 flex gap-2">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{children}</span>
        </div>
    );
}

function Callout({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-6">
            <h3 className="font-black flex items-center gap-2 mb-2">
                {icon} {title}
            </h3>
            <div className="text-sm leading-relaxed text-slate-300">{children}</div>
        </div>
    );
}

function TypeCard({ color, title, steps, note }: { color: 'blue' | 'orange'; title: string; steps: string[]; note: string }) {
    const c = {
        blue: 'border-blue-300 bg-blue-50',
        orange: 'border-orange-300 bg-orange-50',
    }[color];
    return (
        <div className={`border-2 rounded-2xl p-5 ${c}`}>
            <h3 className="font-black text-slate-900 mb-3">{title}</h3>
            <ol className="space-y-2 text-sm text-slate-700 mb-3">
                {steps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                        <span className="font-bold text-slate-500 shrink-0">{i + 1}.</span>
                        <span>{s}</span>
                    </li>
                ))}
            </ol>
            <div className="text-xs text-slate-600 italic border-t border-slate-300/50 pt-2">{note}</div>
        </div>
    );
}

function FieldRow({ label, desc }: { label: string; desc: string }) {
    return (
        <div className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
            <div>
                <div className="font-bold text-slate-800">{label}</div>
                <div className="text-xs text-slate-500">{desc}</div>
            </div>
        </div>
    );
}

function ExampleQuery({ q, desc }: { q: string; desc: string }) {
    return (
        <div className="flex items-center gap-3">
            <code className="bg-slate-900 text-emerald-300 px-3 py-1.5 rounded-lg text-sm font-mono shrink-0 min-w-[180px]">
                {q}
            </code>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-600">{desc}</span>
        </div>
    );
}

// PDF 페이지에 박스 그린 예시 — 2025학년도 9월 모의평가 2페이지 모방
function ExampleBoxOnPage() {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> 박스 그리기 예시
            </h3>
            <p className="text-xs text-slate-500 mb-4">
                실제 모의고사 페이지 위에서 이런 식으로 박스를 그리면 됩니다. (예: 2025학년도 9월 모의평가 국어 2쪽, 4~7번 지문)
            </p>
            <div className="bg-slate-50 rounded-xl p-3 overflow-auto">
                <svg viewBox="0 0 600 760" className="w-full max-w-md mx-auto" style={{ background: '#fefefe' }}>
                    {/* page header */}
                    <text x="30" y="35" fontSize="22" fontWeight="900" fill="#1e293b">2</text>
                    <text x="500" y="35" fontSize="22" fontWeight="900" fill="#1e293b" textAnchor="end">국어 영역</text>
                    <line x1="30" y1="50" x2="570" y2="50" stroke="#cbd5e1" strokeWidth="1" />

                    {/* left column: passage area mocked as text lines */}
                    <text x="30" y="80" fontSize="11" fill="#64748b" fontWeight="700">[4~7] 다음 글을 읽고 물음에 답하시오.</text>
                    {Array.from({ length: 28 }).map((_, i) => (
                        <line key={i} x1="40" y1={105 + i * 14} x2="280" y2={105 + i * 14} stroke="#e2e8f0" strokeWidth="1" />
                    ))}

                    {/* right column: continuation + questions */}
                    {Array.from({ length: 8 }).map((_, i) => (
                        <line key={`r1-${i}`} x1="320" y1={80 + i * 14} x2="560" y2={80 + i * 14} stroke="#e2e8f0" strokeWidth="1" />
                    ))}
                    <text x="320" y="220" fontSize="11" fill="#64748b" fontWeight="700">4. 윗글을 통해 알 수 있는 내용은?</text>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <line key={`q-${i}`} x1="335" y1={240 + i * 14} x2="560" y2={240 + i * 14} stroke="#e2e8f0" strokeWidth="1" />
                    ))}
                    <text x="320" y="350" fontSize="11" fill="#64748b" fontWeight="700">5. ㉠, ㉡에 대한 이해로 적절한 것은?</text>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <line key={`q2-${i}`} x1="335" y1={370 + i * 14} x2="560" y2={370 + i * 14} stroke="#e2e8f0" strokeWidth="1" />
                    ))}
                    <text x="320" y="480" fontSize="11" fill="#64748b" fontWeight="700">6. &lt;보기&gt;를 이해한 내용은?</text>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <line key={`q3-${i}`} x1="335" y1={500 + i * 14} x2="560" y2={500 + i * 14} stroke="#e2e8f0" strokeWidth="1" />
                    ))}
                    <text x="320" y="610" fontSize="11" fill="#64748b" fontWeight="700">7. ⓐ와 문맥상 의미가 가까운 것은?</text>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <line key={`q4-${i}`} x1="335" y1={630 + i * 14} x2="560" y2={630 + i * 14} stroke="#e2e8f0" strokeWidth="1" />
                    ))}

                    {/* PASSAGE box (left column) */}
                    <rect x="35" y="95" width="250" height="500" stroke="#2563eb" strokeWidth="3"
                        fill="rgba(37,99,235,0.08)" />
                    <rect x="35" y="95" width="80" height="20" fill="#2563eb" />
                    <text x="42" y="110" fontSize="11" fontWeight="900" fill="white">새 지문</text>

                    {/* PASSAGE EXTEND box (right top) */}
                    <rect x="318" y="75" width="244" height="130" stroke="#6366f1" strokeWidth="3"
                        strokeDasharray="6 3" fill="rgba(99,102,241,0.08)" />
                    <rect x="318" y="75" width="100" height="20" fill="#6366f1" />
                    <text x="325" y="90" fontSize="11" fontWeight="900" fill="white">지문 이어</text>

                    {/* QUESTION boxes (4, 5, 6, 7) */}
                    {[
                        { y: 215, h: 115, n: 4 },
                        { y: 345, h: 115, n: 5 },
                        { y: 475, h: 115, n: 6 },
                        { y: 605, h: 75, n: 7 },
                    ].map((q) => (
                        <g key={q.n}>
                            <rect x="318" y={q.y} width="244" height={q.h} stroke="#f97316" strokeWidth="3"
                                fill="rgba(249,115,22,0.08)" />
                            <rect x="318" y={q.y} width="60" height="20" fill="#f97316" />
                            <text x="325" y={q.y + 15} fontSize="11" fontWeight="900" fill="white">문제 {q.n}</text>
                        </g>
                    ))}
                </svg>
            </div>
            <div className="mt-4 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-600 inline-block rounded-sm" /> <b>새 지문</b> = 좌측에 1번 그리면 그룹 시작
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-indigo-500 inline-block rounded-sm" style={{ borderStyle: 'dashed', border: '1px dashed #6366f1' }} /> <b>지문 이어</b> = 우측 상단의 같은 지문의 단 추가
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-orange-500 inline-block rounded-sm" /> <b>문제</b> = 4~7번 각 문항을 따로 박스
                </div>
                <div className="text-slate-400 italic mt-2">
                    → 결과: 1개의 지문(2개 단별 이미지) + 4개의 문제가 자동으로 묶여 저장됨
                </div>
            </div>
        </div>
    );
}
