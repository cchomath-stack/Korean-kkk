'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Home, BookOpen, HelpCircle, FileText, Tag, BarChart3, Loader2, X as XIcon } from 'lucide-react';

type CoverageRow = {
    id: number;
    questionNo: number | null;
    difficulty: string | null;
    year: number | null;
    month: number | null;
    grade: number | null;
    area: string | null;
};

type Stats = {
    totals: { passages: number; questions: number; pdfs: number; tags: number };
    recentPdfs: any[];
    topTags: { name: string; questions: number; passages: number; total: number }[];
    recentSavedQuestions: any[];
    coverage: CoverageRow[];
};

const AREAS: string[] = ['문학', '독서', '화작', '언매'];
const GRADES: number[] = [1, 2, 3];
const MAX_QNO = 45;

const AREA_COLORS: Record<string, { bg: string; text: string; cell: string; chip: string }> = {
    '문학': { bg: 'bg-teal-500', text: 'text-teal-700', cell: 'bg-teal-500', chip: 'bg-teal-100 text-teal-800 border-teal-300' },
    '독서': { bg: 'bg-blue-500', text: 'text-blue-700', cell: 'bg-blue-500', chip: 'bg-blue-100 text-blue-800 border-blue-300' },
    '화작': { bg: 'bg-orange-500', text: 'text-orange-700', cell: 'bg-orange-500', chip: 'bg-orange-100 text-orange-800 border-orange-300' },
    '언매': { bg: 'bg-purple-500', text: 'text-purple-700', cell: 'bg-purple-500', chip: 'bg-purple-100 text-purple-800 border-purple-300' },
};

export default function StatsPage() {
    const [data, setData] = useState<Stats | null>(null);
    const [error, setError] = useState('');

    // 필터 상태
    const [fGrade, setFGrade] = useState<Set<number>>(new Set());
    const [fYear, setFYear] = useState<Set<number>>(new Set());
    const [fMonth, setFMonth] = useState<Set<number>>(new Set());
    const [fArea, setFArea] = useState<Set<string>>(new Set());

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/admin/stats');
                if (!res.ok) throw new Error('통계 로드 실패');
                setData(await res.json());
            } catch (e: any) { setError(e.message); }
        })();
    }, []);

    // 데이터 기반 옵션들
    const allYears = useMemo(() => {
        if (!data) return [];
        const s = new Set<number>();
        data.coverage.forEach((c) => { if (c.year != null) s.add(c.year); });
        return [...s].sort((a, b) => b - a);
    }, [data]);

    const allMonths = useMemo(() => {
        if (!data) return [];
        const s = new Set<number>();
        data.coverage.forEach((c) => { if (c.month != null) s.add(c.month); });
        return [...s].sort((a, b) => a - b);
    }, [data]);

    // 필터 적용된 coverage
    const filteredCoverage = useMemo(() => {
        if (!data) return [];
        return data.coverage.filter((c) => {
            if (fGrade.size && (c.grade == null || !fGrade.has(c.grade))) return false;
            if (fYear.size && (c.year == null || !fYear.has(c.year))) return false;
            if (fMonth.size && (c.month == null || !fMonth.has(c.month))) return false;
            if (fArea.size && (c.area == null || !fArea.has(c.area))) return false;
            return true;
        });
    }, [data, fGrade, fYear, fMonth, fArea]);

    // (year, month, grade) 행 키 + 그 행의 questionNo→area 맵
    const matrixRows = useMemo(() => {
        const m = new Map<string, { year: number; month: number; grade: number; cells: Map<number, string> }>();
        for (const c of filteredCoverage) {
            if (c.year == null || c.month == null || c.grade == null) continue;
            const key = `${c.year}-${c.month}-${c.grade}`;
            if (!m.has(key)) {
                m.set(key, { year: c.year, month: c.month, grade: c.grade, cells: new Map() });
            }
            if (c.questionNo != null) {
                m.get(key)!.cells.set(c.questionNo, c.area || '');
            }
        }
        return [...m.values()].sort((a, b) =>
            b.year - a.year || b.month - a.month || a.grade - b.grade
        );
    }, [filteredCoverage]);

    // 영역/난이도 분포 (필터링 반영)
    const areaCount = useMemo(() => {
        const m = new Map<string, number>();
        for (const c of filteredCoverage) {
            const k = c.area || '미지정';
            m.set(k, (m.get(k) || 0) + 1);
        }
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }, [filteredCoverage]);

    const diffCount = useMemo(() => {
        const m = new Map<string, number>();
        for (const c of filteredCoverage) {
            const k = c.difficulty || '미지정';
            m.set(k, (m.get(k) || 0) + 1);
        }
        return ['상', '중', '하', '미지정'].map((k) => [k, m.get(k) || 0] as [string, number]).filter((x) => x[1] > 0);
    }, [filteredCoverage]);

    const toggle = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, val: T) => {
        setter((prev) => {
            const next = new Set(prev);
            if (next.has(val)) next.delete(val); else next.add(val);
            return next;
        });
    };

    const clearAll = () => {
        setFGrade(new Set()); setFYear(new Set()); setFMonth(new Set()); setFArea(new Set());
    };

    const hasFilter = fGrade.size + fYear.size + fMonth.size + fArea.size > 0;

    if (error) return <div className="p-8 text-red-600">{error}</div>;
    if (!data) return (
        <div className="p-8 flex items-center gap-2 text-slate-500">
            <Loader2 className="animate-spin" size={16} /> 로딩 중...
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="h-14 px-6 flex items-center gap-4 border-b bg-white shadow-sm sticky top-0 z-40">
                <Link href="/" className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-sm font-medium">
                    <Home size={16} /> 홈
                </Link>
                <span className="text-slate-300">|</span>
                <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <BarChart3 size={16} /> 통계
                </h1>
            </header>

            <main className="max-w-[1400px] mx-auto p-6 space-y-5">
                {/* 총괄 */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon={<BookOpen size={18} />} label="지문" value={data.totals.passages} color="blue" />
                    <StatCard icon={<HelpCircle size={18} />} label="문제" value={data.totals.questions} color="orange" />
                    <StatCard icon={<FileText size={18} />} label="PDF" value={data.totals.pdfs} color="teal" />
                    <StatCard icon={<Tag size={18} />} label="태그" value={data.totals.tags} color="purple" />
                </section>

                {/* 필터 */}
                <section className="bg-white rounded-lg border shadow-sm">
                    <div className="px-4 py-2.5 border-b flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-700">필터 (교집합 AND)</h2>
                        {hasFilter && (
                            <button onClick={clearAll}
                                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
                                <XIcon size={12} /> 모두 해제
                            </button>
                        )}
                    </div>
                    <div className="p-4 space-y-2.5">
                        <FilterRow label="학년">
                            {GRADES.map((g) => (
                                <Chip key={g} active={fGrade.has(g)} onClick={() => toggle(setFGrade, g)}>{g}학년</Chip>
                            ))}
                        </FilterRow>
                        <FilterRow label="영역">
                            {AREAS.map((a) => (
                                <Chip key={a} active={fArea.has(a)} onClick={() => toggle(setFArea, a)}
                                    color={AREA_COLORS[a]?.chip}>
                                    {a}
                                </Chip>
                            ))}
                        </FilterRow>
                        <FilterRow label="연도">
                            {allYears.length === 0 ? <Empty /> : allYears.map((y) => (
                                <Chip key={y} active={fYear.has(y)} onClick={() => toggle(setFYear, y)}>{y}</Chip>
                            ))}
                        </FilterRow>
                        <FilterRow label="월">
                            {allMonths.length === 0 ? <Empty /> : allMonths.map((m) => (
                                <Chip key={m} active={fMonth.has(m)} onClick={() => toggle(setFMonth, m)}>{m}월</Chip>
                            ))}
                        </FilterRow>
                    </div>
                </section>

                {/* 분포 요약 (필터 반영) */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Panel title={`영역 분포 (${filteredCoverage.length}문제)`}>
                        {areaCount.length === 0 ? <Empty /> : (
                            <table className="w-full text-sm">
                                <tbody>
                                    {areaCount.map(([k, v]) => {
                                        const c = AREA_COLORS[k];
                                        const total = filteredCoverage.length || 1;
                                        return (
                                            <tr key={k} className="border-b last:border-0">
                                                <td className="py-1.5 pr-3 font-semibold text-slate-700 w-20">
                                                    <span className={`inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle ${c?.bg || 'bg-slate-300'}`} />
                                                    {k}
                                                </td>
                                                <td className="py-1.5">
                                                    <div className="w-full bg-slate-100 rounded-sm h-2 overflow-hidden">
                                                        <div className={`h-full ${c?.bg || 'bg-slate-400'}`}
                                                            style={{ width: `${(v / total) * 100}%` }} />
                                                    </div>
                                                </td>
                                                <td className="py-1.5 pl-3 font-bold text-slate-700 text-right w-12">{v}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </Panel>

                    <Panel title="난이도 분포">
                        {diffCount.length === 0 ? <Empty /> : (
                            <table className="w-full text-sm">
                                <tbody>
                                    {diffCount.map(([k, v]) => {
                                        const total = filteredCoverage.length || 1;
                                        const c = k === '상' ? 'bg-red-500' : k === '중' ? 'bg-amber-500' : k === '하' ? 'bg-emerald-500' : 'bg-slate-400';
                                        return (
                                            <tr key={k} className="border-b last:border-0">
                                                <td className="py-1.5 pr-3 font-semibold text-slate-700 w-20">
                                                    <span className={`inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle ${c}`} />
                                                    {k}
                                                </td>
                                                <td className="py-1.5">
                                                    <div className="w-full bg-slate-100 rounded-sm h-2 overflow-hidden">
                                                        <div className={`h-full ${c}`} style={{ width: `${(v / total) * 100}%` }} />
                                                    </div>
                                                </td>
                                                <td className="py-1.5 pl-3 font-bold text-slate-700 text-right w-12">{v}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </Panel>
                </section>

                {/* 커버리지 매트릭스 */}
                <section className="bg-white rounded-lg border shadow-sm">
                    <div className="px-4 py-2.5 border-b flex items-center gap-3">
                        <h2 className="text-sm font-bold text-slate-700">커버리지 (입력 O / 미입력 ·)</h2>
                        <span className="text-xs text-slate-400">{matrixRows.length}개 모의고사 · 1~{MAX_QNO}번</span>
                        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
                            {AREAS.map((a) => (
                                <span key={a} className="flex items-center gap-1">
                                    <span className={`w-2.5 h-2.5 rounded-sm ${AREA_COLORS[a].bg}`} /> {a}
                                </span>
                            ))}
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> 영역미정
                            </span>
                        </div>
                    </div>
                    <div className="overflow-auto">
                        {matrixRows.length === 0 ? (
                            <div className="p-10"><Empty /></div>
                        ) : (
                            <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>
                                <thead>
                                    <tr className="bg-slate-50 sticky top-0">
                                        <th className="px-3 py-2 text-left font-bold text-slate-600 sticky left-0 bg-slate-50 border-r border-slate-200 z-10">
                                            모의고사
                                        </th>
                                        <th className="px-2 py-2 text-center font-bold text-slate-600 border-r border-slate-200">
                                            입력
                                        </th>
                                        {Array.from({ length: MAX_QNO }, (_, i) => i + 1).map((n) => (
                                            <th key={n} className="px-1 py-2 text-center font-bold text-slate-500 w-6">
                                                {n}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {matrixRows.map((row) => {
                                        const filled = row.cells.size;
                                        const pct = (filled / MAX_QNO) * 100;
                                        return (
                                            <tr key={`${row.year}-${row.month}-${row.grade}`}
                                                className="border-t border-slate-100 hover:bg-slate-50">
                                                <td className="px-3 py-1.5 font-bold text-slate-800 sticky left-0 bg-white border-r border-slate-200 whitespace-nowrap">
                                                    {row.year}.{String(row.month).padStart(2, '0')} <span className="text-slate-400 font-medium">{row.grade}학년</span>
                                                </td>
                                                <td className="px-2 py-1.5 text-center border-r border-slate-200 whitespace-nowrap">
                                                    <span className={`font-bold ${pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                        {filled}/{MAX_QNO}
                                                    </span>
                                                </td>
                                                {Array.from({ length: MAX_QNO }, (_, i) => i + 1).map((n) => {
                                                    const area = row.cells.get(n);
                                                    const has = area !== undefined;
                                                    const color = has ? (AREA_COLORS[area || '']?.cell || 'bg-slate-300') : '';
                                                    return (
                                                        <td key={n} className="p-0 text-center align-middle"
                                                            title={has ? `${n}번 · ${area || '영역미정'}` : `${n}번 · 미입력`}>
                                                            <div className={`w-6 h-6 mx-auto flex items-center justify-center text-[10px] font-bold ${has ? `${color} text-white` : 'text-slate-200'}`}>
                                                                {has ? 'O' : '·'}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* 인기 태그 + 최근 PDF + 최근 활동 (간략) */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <Panel title="인기 태그 TOP 15">
                        {data.topTags.length === 0 ? <Empty /> : (
                            <div className="space-y-1.5">
                                {data.topTags.map((t) => {
                                    const max = data.topTags[0]?.total || 1;
                                    return (
                                        <div key={t.name} className="flex items-center gap-2 text-xs">
                                            <span className="font-semibold text-teal-700 w-24 truncate">#{t.name}</span>
                                            <div className="flex-1 bg-slate-100 rounded-sm h-1.5 overflow-hidden">
                                                <div className="bg-teal-500 h-full" style={{ width: `${(t.total / max) * 100}%` }} />
                                            </div>
                                            <span className="text-slate-500 font-bold w-8 text-right">{t.total}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Panel>

                    <Panel title="최근 PDF">
                        {data.recentPdfs.length === 0 ? <Empty /> : (
                            <ul className="divide-y text-xs">
                                {data.recentPdfs.map((p: any) => {
                                    const cnt = (p._count?.passages || 0) + (p._count?.questions || 0);
                                    return (
                                        <li key={p.id} className="py-1.5 flex items-center justify-between gap-2">
                                            <span className="font-semibold text-slate-800 truncate flex-1">{p.name}</span>
                                            <span className={`shrink-0 ${cnt > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                                                {cnt > 0 ? `${cnt}건` : '미저장'}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>

                    <Panel title="최근 저장 활동">
                        {data.recentSavedQuestions.length === 0 ? <Empty /> : (
                            <ul className="divide-y text-xs">
                                {data.recentSavedQuestions.map((q: any) => (
                                    <li key={q.id} className="py-1.5 flex items-center justify-between gap-2">
                                        <span className="font-semibold text-slate-700 truncate flex-1">
                                            #{q.id} {q.questionNo ? `${q.questionNo}번` : ''}
                                            {q.passage?.area && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{q.passage.area}</span>}
                                        </span>
                                        <span className="shrink-0 text-slate-400">{new Date(q.createdAt).toLocaleDateString('ko-KR')}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </section>
            </main>
        </div>
    );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'blue' | 'orange' | 'teal' | 'purple' }) {
    const colors = {
        blue: 'border-blue-200 text-blue-700',
        orange: 'border-orange-200 text-orange-700',
        teal: 'border-teal-200 text-teal-700',
        purple: 'border-purple-200 text-purple-700',
    };
    return (
        <div className={`bg-white rounded-lg border ${colors[color]} px-4 py-3 shadow-sm`}>
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">{icon}{label}</div>
            <div className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</div>
        </div>
    );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-lg border shadow-sm">
            <h2 className="px-4 py-2.5 border-b text-sm font-bold text-slate-700">{title}</h2>
            <div className="p-4">{children}</div>
        </div>
    );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 w-12 shrink-0">{label}</span>
            <div className="flex flex-wrap gap-1.5 flex-1">{children}</div>
        </div>
    );
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string; }) {
    const base = 'px-2.5 py-1 rounded text-xs font-semibold border transition';
    if (active) {
        return <button onClick={onClick} className={`${base} ${color || 'bg-slate-900 text-white border-slate-900'}`}>{children}</button>;
    }
    return <button onClick={onClick} className={`${base} bg-white text-slate-600 border-slate-200 hover:border-slate-400`}>{children}</button>;
}

function Empty() {
    return <div className="text-xs text-slate-400 text-center py-3">데이터 없음</div>;
}
