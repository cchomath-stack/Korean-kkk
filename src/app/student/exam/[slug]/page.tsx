'use client';

import { useState, useEffect, use } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

type ExamItem = {
    id: number;
    kind: 'passage' | 'question';
    order: number;
    imageUrl: string | null;
    passage: any | null;
    question: any | null;
};

type ExamData = {
    id: number;
    title: string | null;
    subTitle: string | null;
    grade: number | null;
    academyName: string | null;
    items: ExamItem[];
};

export default function StudentExamPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [exam, setExam] = useState<ExamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [studentName, setStudentName] = useState('');
    const [studentPhone, setStudentPhone] = useState('');
    const [studentAcademy, setStudentAcademy] = useState('');
    const [wrongIds, setWrongIds] = useState<Set<number>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/student/exam/${slug}`);
                const data = await res.json();
                if (!res.ok) {
                    setError(data?.error || '시험지를 불러오지 못했습니다.');
                } else {
                    setExam(data);
                }
            } catch (e: any) {
                setError('네트워크 오류: ' + (e?.message || ''));
            } finally {
                setLoading(false);
            }
        })();
    }, [slug]);

    // 문항(question)만 체크 대상. passage 자체는 체크 대상이 아님.
    // 지문 세트 안의 개별 문제는 examItem이 kind=passage 하나뿐이라 지문 전체를 체크.
    // → 학생 UX: 카드 = 각 ExamItem 1개. 지문 카드에는 "이 지문에서 틀린 문제" 체크박스가 있고
    //   단독 문제 카드에는 "이 문제 틀림" 체크박스.

    const toggle = (id: number) => {
        setWrongIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!studentName.trim()) return alert('이름을 입력해주세요.');
        if (wrongIds.size === 0) return alert('틀린 문제를 1개 이상 체크해주세요.');
        setSubmitting(true);
        try {
            const res = await fetch(`/api/student/exam/${slug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentName: studentName.trim(),
                    studentPhone: studentPhone.trim(),
                    studentAcademy: studentAcademy.trim(),
                    wrongItemIds: Array.from(wrongIds),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data?.error || '제출 실패');
                return;
            }
            setSubmitted(true);
        } catch (e: any) {
            alert('네트워크 오류: ' + (e?.message || ''));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }
    if (error || !exam) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-10 max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-lg font-black text-slate-800 mb-2">시험지를 찾을 수 없습니다</h1>
                    <p className="text-sm text-slate-500 font-medium">{error || '링크가 잘못됐거나 공개가 꺼져 있어요.'}</p>
                </div>
            </div>
        );
    }
    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-10 max-w-md text-center">
                    <CheckCircle2 className="w-14 h-14 text-teal-500 mx-auto mb-4" />
                    <h1 className="text-xl font-black text-slate-800 mb-2">제출 완료!</h1>
                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        학원 선생님이 확인한 뒤<br />오답노트를 준비해서 전달해 드릴 거예요.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* 헤더 */}
            <header className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-8 px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">오답노트 요청</div>
                    <h1 className="text-2xl md:text-3xl font-black mb-1">{exam.title || '시험지'}</h1>
                    {exam.subTitle && <p className="text-sm md:text-base opacity-90 font-medium">{exam.subTitle}</p>}
                    {exam.academyName && <p className="text-xs opacity-70 font-bold mt-2">{exam.academyName}</p>}
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
                {/* 학생 정보 폼 */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">나의 정보</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-black text-slate-600 mb-1">이름 *</label>
                            <input
                                type="text"
                                value={studentName}
                                onChange={e => setStudentName(e.target.value)}
                                placeholder="홍길동"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-400 text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-600 mb-1">전화번호 (선택)</label>
                            <input
                                type="tel"
                                value={studentPhone}
                                onChange={e => setStudentPhone(e.target.value)}
                                placeholder="010-1234-5678"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-400 text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-600 mb-1">학원(반) (선택)</label>
                            <input
                                type="text"
                                value={studentAcademy}
                                onChange={e => setStudentAcademy(e.target.value)}
                                placeholder="예: 국어닷 학원 심화반"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-400 text-sm font-medium"
                            />
                        </div>
                    </div>
                </div>

                {/* 문항 체크 */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-2">틀린 문제 체크</h2>
                    <p className="text-xs text-slate-500 mb-4 font-medium">틀린 문제를 <strong>모두</strong> 눌러주세요. 지문 세트 카드를 체크하면 그 지문에 딸린 모든 문제를 오답노트에 담아드립니다.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {exam.items.map((it, idx) => {
                            const checked = wrongIds.has(it.id);
                            const label = it.kind === 'passage' ? `지문 ${idx + 1}` : `문제 ${idx + 1}`;
                            return (
                                <button
                                    key={it.id}
                                    onClick={() => toggle(it.id)}
                                    className={`relative rounded-2xl border-2 transition-all overflow-hidden bg-white text-left ${
                                        checked
                                            ? 'border-teal-500 ring-2 ring-teal-200'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="aspect-[3/4] bg-slate-50 flex items-center justify-center overflow-hidden">
                                        {it.imageUrl ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={it.imageUrl} alt={label} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-slate-300 text-xs font-bold">이미지 없음</span>
                                        )}
                                    </div>
                                    <div className={`px-2 py-1.5 text-[11px] font-black ${checked ? 'bg-teal-500 text-white' : 'bg-white text-slate-600'}`}>
                                        {checked ? '✓ ' : ''}{label}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </main>

            {/* 제출 바 */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <div className="flex-1 text-sm">
                        <span className="font-black text-slate-800">{wrongIds.size}</span>
                        <span className="font-medium text-slate-500"> 문제 체크됨</span>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || wrongIds.size === 0 || !studentName.trim()}
                        className="px-6 py-3 bg-teal-600 text-white rounded-2xl text-sm font-black hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        오답노트 요청 제출
                    </button>
                </div>
            </div>
        </div>
    );
}
