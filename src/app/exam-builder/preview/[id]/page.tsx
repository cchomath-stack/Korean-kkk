'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Download, Loader2, AlertCircle, Pencil, CheckCircle2 } from 'lucide-react';
import { ExamPaper, type ExamHydrated } from '@/components/ExamPaper';

export default function ExamPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [exam, setExam] = useState<ExamHydrated | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showOriginalNo, setShowOriginalNo] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`/api/admin/exam-set/hydrated?id=${id}`);
                if (res.ok) setExam(await res.json());
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handleDownload = async () => {
        if (!exam) return;
        setDownloading(true);
        try {
            const res = await fetch(`/api/admin/exam-set/pdf?id=${exam.id}&showOriginalNo=${showOriginalNo ? '1' : '0'}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(`PDF 생성 실패: ${err.detail || err.error || res.statusText}`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(exam.title || '시험지').replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            alert(`PDF 다운로드 실패: ${e?.message || e}`);
        } finally {
            setDownloading(false);
        }
    };

    const handleSaveAsExamSet = async () => {
        if (!exam) return;
        // status: draft → saved 로 전환하고 새 draft 자동 생성 (다음 시험지를 위해)
        const res = await fetch('/api/admin/exam-set', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: exam.id, status: 'saved' }),
        });
        if (res.ok) {
            setSaved(true);
            // 새 draft 가 자동 생성되도록 유도
            await fetch('/api/admin/exam-set');
        } else {
            alert('저장 실패');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
                <p className="text-slate-600 font-bold">시험지를 불러올 수 없습니다.</p>
                <Link href="/exam-builder" className="mt-4 text-teal-600 font-bold underline">시험지 만들기로</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-200">
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/exam-builder" className="p-2 hover:bg-slate-100 rounded-xl text-slate-600">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-black text-slate-900">미리보기</h1>
                            <p className="text-xs font-bold text-slate-400">
                                {exam.title || '제목 없음'} · 문항 {countQuestions(exam)}개
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 px-3 py-2 bg-slate-100 rounded-xl cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showOriginalNo}
                                onChange={(e) => setShowOriginalNo(e.target.checked)}
                                className="accent-teal-600"
                            />
                            원본 번호 표시
                        </label>
                        <Link
                            href="/exam-builder"
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                        >
                            <Pencil className="w-4 h-4" />
                            수정
                        </Link>
                        {!saved ? (
                            <button
                                onClick={handleSaveAsExamSet}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-black text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl"
                            >
                                저장(출제완료로)
                            </button>
                        ) : (
                            <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <CheckCircle2 className="w-4 h-4" />
                                저장됨
                            </span>
                        )}
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="flex items-center gap-1.5 px-5 py-2 text-sm font-black text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-xl shadow-lg shadow-teal-200"
                        >
                            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            PDF 다운로드
                        </button>
                    </div>
                </div>
            </header>

            <ExamPaper exam={exam} showOriginalNo={showOriginalNo} />
        </div>
    );
}

function countQuestions(exam: ExamHydrated): number {
    let n = 0;
    for (const it of exam.items) {
        if (it.kind === 'passage' && it.passage?.questions) n += it.passage.questions.length;
        else if (it.kind === 'question') n += 1;
    }
    return n;
}
