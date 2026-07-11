'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Inbox, Download, Check, CircleDot, Trash2, FileText, Phone } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

type WrongNote = {
    id: number;
    studentName: string;
    studentPhone: string | null;
    studentAcademy: string | null;
    status: string;
    createdAt: string;
    processedAt: string | null;
    examSet: { id: number; title: string | null; subTitle: string | null; grade: number | null };
    _count: { answers: number };
};

export default function WrongNotesAdminPage() {
    const [list, setList] = useState<WrongNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'processed'>('all');
    const [downloading, setDownloading] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        const url = filter === 'all' ? '/api/admin/wrong-note' : `/api/admin/wrong-note?status=${filter}`;
        const res = await fetch(url);
        if (res.ok) setList(await res.json());
        setLoading(false);
    };
    useEffect(() => { load(); }, [filter]);

    const downloadPdf = async (id: number, studentName: string) => {
        setDownloading(id);
        try {
            const res = await fetch(`/api/admin/wrong-note/pdf?id=${id}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(`PDF 생성 실패: ${err.detail || err.error || res.statusText}`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `오답노트_${studentName}_${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } finally {
            setDownloading(null);
        }
    };

    const toggleStatus = async (item: WrongNote) => {
        const next = item.status === 'pending' ? 'processed' : 'pending';
        await fetch('/api/admin/wrong-note', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, status: next }),
        });
        load();
    };

    const handleDelete = async (id: number, studentName: string) => {
        if (!confirm(`${studentName} 학생의 요청을 삭제할까요?`)) return;
        await fetch(`/api/admin/wrong-note?id=${id}`, { method: 'DELETE' });
        load();
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BackButton variant="icon" />
                        <div>
                            <h1 className="text-lg font-black text-slate-900">오답노트 요청</h1>
                            <p className="text-xs font-bold text-slate-400">학생 제출 목록 · 인쇄용 PDF</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {(['all', 'pending', 'processed'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${filter === f ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {f === 'all' ? '전체' : f === 'pending' ? '미처리' : '처리완료'}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
                ) : list.length === 0 ? (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
                        <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="font-black text-slate-400 text-lg mb-1">요청이 없습니다</p>
                        <p className="text-sm text-slate-400 font-medium">학생들이 제출하면 여기에 모입니다.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {list.map(item => (
                            <div key={item.id} className={`bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 ${item.status === 'processed' ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="font-black text-slate-900">{item.studentName}</h3>
                                        {item.studentAcademy && <span className="text-xs text-slate-500 font-bold">{item.studentAcademy}</span>}
                                        {item.examSet.grade && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">고{item.examSet.grade}</span>}
                                        {item.status === 'pending' ? (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black rounded">
                                                <CircleDot className="w-2.5 h-2.5" /> 미처리
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded">
                                                <Check className="w-2.5 h-2.5" /> 처리완료
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-bold flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <FileText className="w-3 h-3" /> {item.examSet.title || '(제목 없음)'}
                                        </span>
                                        {item.studentPhone && (
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3 h-3" /> {item.studentPhone}
                                            </span>
                                        )}
                                        <span className="text-teal-600">{item._count.answers}문제 틀림</span>
                                        <span>{new Date(item.createdAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => downloadPdf(item.id, item.studentName)}
                                    disabled={downloading === item.id}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black"
                                >
                                    {downloading === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                    PDF
                                </button>
                                <button
                                    onClick={() => toggleStatus(item)}
                                    className={`p-2 rounded-xl text-xs font-black ${item.status === 'pending' ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'}`}
                                    title={item.status === 'pending' ? '처리완료로 표시' : '미처리로 되돌리기'}
                                >
                                    {item.status === 'pending' ? <Check className="w-4 h-4" /> : <CircleDot className="w-4 h-4" />}
                                </button>
                                <button onClick={() => handleDelete(item.id, item.studentName)} className="p-2 hover:bg-rose-50 rounded-xl text-rose-300 hover:text-rose-600">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
