'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Eye, Trash2, Loader2, Inbox, Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

type SavedExam = {
    id: number;
    title: string | null;
    subTitle: string | null;
    academyName: string | null;
    grade: number | null;
    durationMin: number | null;
    totalScore: number | null;
    isStudentPublic: boolean;
    studentAccessSlug: string | null;
    wrongNoteDesign: string;
    updatedAt: string;
    createdAt: string;
    _count: { items: number };
};

export default function SavedExamsPage() {
    const [exams, setExams] = useState<SavedExam[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/exam-set?status=saved');
            if (res.ok) setExams(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('이 시험지를 삭제할까요? (담긴 문항 목록도 함께 삭제됩니다)')) return;
        const res = await fetch(`/api/admin/exam-set?id=${id}`, { method: 'DELETE' });
        if (res.ok) load();
    };

    const updateExam = async (id: number, patch: Partial<SavedExam>) => {
        const res = await fetch('/api/admin/exam-set', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...patch }),
        });
        if (res.ok) {
            const updated = await res.json();
            setExams(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
        }
    };

    const publicUrl = (slug: string | null) =>
        slug && typeof window !== 'undefined' ? `${window.location.origin}/student/exam/${slug}` : '';

    const handleCopy = async (id: number, slug: string | null) => {
        const url = publicUrl(slug);
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch {
            alert(url);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <BackButton variant="icon" fallback="/exam-builder" />
                        <div>
                            <h1 className="text-lg font-black text-slate-900">저장된 시험지</h1>
                            <p className="text-xs font-bold text-slate-400">출제 완료된 시험지 {exams.length}개</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                    </div>
                ) : exams.length === 0 ? (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
                        <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="font-black text-slate-400 text-lg mb-1">저장된 시험지가 없습니다</p>
                        <p className="text-sm text-slate-400 font-medium">미리보기에서 "저장(출제완료로)"를 눌러야 여기 모입니다.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {exams.map(exam => (
                            <div key={exam.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="w-4 h-4 text-teal-500" />
                                            <h3 className="font-black text-slate-900 truncate">
                                                {exam.title || '제목 없음'}
                                            </h3>
                                        </div>
                                        {exam.subTitle && (
                                            <p className="text-xs text-slate-500 font-medium line-clamp-1 ml-6">
                                                {exam.subTitle}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                        {new Date(exam.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <div className="flex gap-1.5 flex-wrap mb-4 ml-6">
                                    <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold rounded">
                                        {exam._count.items}개 항목
                                    </span>
                                    {exam.grade && (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                                            고{exam.grade}
                                        </span>
                                    )}
                                    {exam.durationMin && (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                                            {exam.durationMin}분
                                        </span>
                                    )}
                                    {exam.totalScore && (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                                            {exam.totalScore}점
                                        </span>
                                    )}
                                    {exam.academyName && (
                                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded">
                                            {exam.academyName}
                                        </span>
                                    )}
                                    {exam.isStudentPublic && (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded flex items-center gap-1">
                                            <Share2 className="w-2.5 h-2.5" /> 학생 공개
                                        </span>
                                    )}
                                </div>

                                {/* 학생 공개 오답노트 섹션 */}
                                <div className="ml-6 mb-4 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                                        <input
                                            type="checkbox"
                                            checked={exam.isStudentPublic}
                                            onChange={(e) => updateExam(exam.id, { isStudentPublic: e.target.checked })}
                                            className="w-4 h-4 accent-teal-600"
                                        />
                                        <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                                            <Share2 className="w-3 h-3" /> 학생 공개 링크 (오답노트)
                                        </span>
                                    </label>
                                    {exam.isStudentPublic && exam.studentAccessSlug ? (
                                        <>
                                            <div className="flex items-center gap-1 mb-2">
                                                <input
                                                    type="text"
                                                    value={publicUrl(exam.studentAccessSlug)}
                                                    readOnly
                                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                                    className="flex-1 min-w-0 px-2 py-1.5 text-[10px] font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-400"
                                                />
                                                <button
                                                    onClick={() => handleCopy(exam.id, exam.studentAccessSlug)}
                                                    className="px-2 py-1.5 bg-teal-600 text-white rounded-lg text-[10px] font-black hover:bg-teal-700 flex items-center gap-1 shrink-0"
                                                    title="복사"
                                                >
                                                    {copiedId === exam.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                </button>
                                                <a
                                                    href={publicUrl(exam.studentAccessSlug)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 shrink-0"
                                                    title="새 탭"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-[10px] font-black text-slate-500">디자인:</label>
                                                <select
                                                    value={exam.wrongNoteDesign}
                                                    onChange={(e) => updateExam(exam.id, { wrongNoteDesign: e.target.value })}
                                                    className="flex-1 px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-400"
                                                >
                                                    <option value="oreum">오름 (청록)</option>
                                                    <option value="mexx">MEXX (네이비)</option>
                                                </select>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-[10px] text-slate-500 leading-relaxed">
                                            체크하면 학생용 URL이 생성됩니다.
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2 ml-6">
                                    <Link
                                        href={`/exam-builder/preview/${exam.id}`}
                                        className="flex-grow flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        보기 / 다운로드
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(exam.id)}
                                        className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl"
                                        title="삭제"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
