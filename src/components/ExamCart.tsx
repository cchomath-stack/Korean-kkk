'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ShoppingBag, X, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type ExamItem = {
    id: number;
    kind: 'passage' | 'question';
    passageId: number | null;
    questionId: number | null;
    order: number;
};

type ExamSet = {
    id: number;
    title: string | null;
    items: ExamItem[];
};

type CartContextValue = {
    exam: ExamSet | null;
    loading: boolean;
    isAdmin: boolean;
    refresh: () => Promise<void>;
    addPassage: (passageId: number) => Promise<{ ok: boolean; alreadyExists?: boolean; error?: string }>;
    addQuestion: (questionId: number) => Promise<{ ok: boolean; alreadyExists?: boolean; error?: string }>;
    removeItem: (itemId: number) => Promise<void>;
    hasPassage: (passageId: number) => boolean;
    hasQuestion: (questionId: number) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useExamCart() {
    const ctx = useContext(CartContext);
    if (!ctx) {
        throw new Error('useExamCart must be used within <ExamCartProvider>');
    }
    return ctx;
}

export function ExamCartProvider({ children }: { children: React.ReactNode }) {
    const [exam, setExam] = useState<ExamSet | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const meRes = await fetch('/api/auth/me');
            if (!meRes.ok) {
                setIsAdmin(false);
                setExam(null);
                return;
            }
            const meData = await meRes.json();
            const admin = meData?.user?.role === 'ADMIN';
            setIsAdmin(admin);
            if (!admin) {
                setExam(null);
                return;
            }
            const res = await fetch('/api/admin/exam-set');
            if (res.ok) {
                setExam(await res.json());
            }
        } catch (e) {
            console.error('Cart refresh error', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const addPassage = useCallback(async (passageId: number) => {
        if (!exam) return { ok: false, error: 'no exam' };
        try {
            const res = await fetch('/api/admin/exam-set/item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examSetId: exam.id, kind: 'passage', passageId }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { ok: false, error: err.error || '담기 실패' };
            }
            const data = await res.json();
            await refresh();
            return { ok: true, alreadyExists: !!data.alreadyExists };
        } catch (e: any) {
            return { ok: false, error: e?.message || '담기 실패' };
        }
    }, [exam, refresh]);

    const addQuestion = useCallback(async (questionId: number) => {
        if (!exam) return { ok: false, error: 'no exam' };
        try {
            const res = await fetch('/api/admin/exam-set/item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examSetId: exam.id, kind: 'question', questionId }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { ok: false, error: err.error || '담기 실패' };
            }
            const data = await res.json();
            await refresh();
            return { ok: true, alreadyExists: !!data.alreadyExists };
        } catch (e: any) {
            return { ok: false, error: e?.message || '담기 실패' };
        }
    }, [exam, refresh]);

    const removeItem = useCallback(async (itemId: number) => {
        await fetch(`/api/admin/exam-set/item?id=${itemId}`, { method: 'DELETE' });
        await refresh();
    }, [refresh]);

    const hasPassage = useCallback((passageId: number) => {
        return !!exam?.items.some(it => it.kind === 'passage' && it.passageId === passageId);
    }, [exam]);

    const hasQuestion = useCallback((questionId: number) => {
        return !!exam?.items.some(it => it.kind === 'question' && it.questionId === questionId);
    }, [exam]);

    return (
        <CartContext.Provider value={{ exam, loading, isAdmin, refresh, addPassage, addQuestion, removeItem, hasPassage, hasQuestion }}>
            {children}
            <FloatingCartBar />
        </CartContext.Provider>
    );
}

function FloatingCartBar() {
    const { exam, isAdmin, loading } = useExamCart();
    const pathname = usePathname();

    // exam-builder 페이지 자체에서는 숨김
    if (loading || !isAdmin || !exam) return null;
    if (pathname?.startsWith('/exam-builder')) return null;

    const count = exam.items.length;

    return (
        <div className="fixed top-4 left-4 z-[60] pointer-events-none">
            <Link
                href="/exam-builder"
                className={`pointer-events-auto group flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border transition-all duration-200 ${
                    count > 0
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-teal-500/30 shadow-teal-500/30 hover:scale-105'
                        : 'bg-white/90 backdrop-blur text-slate-500 border-slate-200 hover:bg-white'
                }`}
            >
                <div className="relative">
                    <ShoppingBag className="w-5 h-5" strokeWidth={2.5} />
                    {count > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] bg-amber-400 text-slate-900 rounded-full text-[11px] font-black flex items-center justify-center px-1 ring-2 ring-white">
                            {count}
                        </span>
                    )}
                </div>
                <div className="text-sm font-black tracking-tight">
                    {count > 0 ? (
                        <>담은 문항 <span className="text-amber-200">{count}</span>개 · 출제하기 →</>
                    ) : (
                        <>시험지 만들기</>
                    )}
                </div>
                {count > 0 && <Sparkles className="w-4 h-4 text-amber-200 group-hover:rotate-12 transition-transform" />}
            </Link>
        </div>
    );
}

// 검색 결과 카드 / 갤러리 카드에 붙일 담기 버튼
// kind="passage" 일 때는 "세트로 / 문제만" 선택 다이얼로그를 띄움
type AddToCartButtonProps = {
    kind: 'passage' | 'question';
    passageId?: number;
    questionId?: number;
    hasPassageQuestions?: boolean; // passage에 딸린 문제가 있는지 (질문 데이터의 보조 정보)
    compact?: boolean;
};

export function AddToCartButton({ kind, passageId, questionId, hasPassageQuestions, compact }: AddToCartButtonProps) {
    const { isAdmin, addPassage, addQuestion, hasPassage, hasQuestion, removeItem, exam } = useExamCart();
    const [showChoice, setShowChoice] = useState(false);
    const [busy, setBusy] = useState(false);

    if (!isAdmin) return null;

    const alreadyInCart = kind === 'passage'
        ? (passageId != null && hasPassage(passageId))
        : (questionId != null && hasQuestion(questionId));

    const handleRemove = async () => {
        if (!exam) return;
        const target = exam.items.find(it =>
            kind === 'passage' ? (it.kind === 'passage' && it.passageId === passageId)
                              : (it.kind === 'question' && it.questionId === questionId)
        );
        if (target) await removeItem(target.id);
    };

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        if (alreadyInCart) {
            await handleRemove();
            return;
        }
        // 지문이 있는 문제(passageId가 있는 question)는 세트 vs 문제만 선택
        if (kind === 'question' && hasPassageQuestions) {
            setShowChoice(true);
            return;
        }
        // 단순 담기
        setBusy(true);
        if (kind === 'passage' && passageId != null) {
            await addPassage(passageId);
        } else if (kind === 'question' && questionId != null) {
            await addQuestion(questionId);
        }
        setBusy(false);
    };

    return (
        <>
            <button
                onClick={handleClick}
                disabled={busy}
                className={`flex items-center gap-1.5 ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} rounded-xl font-black transition-all border ${
                    alreadyInCart
                        ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-600 hover:text-white hover:border-teal-600'
                } ${busy ? 'opacity-50' : ''}`}
                title={alreadyInCart ? '시험지에서 빼기' : '시험지에 담기'}
            >
                {alreadyInCart ? (
                    <>
                        <X className="w-3.5 h-3.5" />
                        담김
                    </>
                ) : (
                    <>
                        <ShoppingBag className="w-3.5 h-3.5" />
                        담기
                    </>
                )}
            </button>

            {showChoice && passageId != null && questionId != null && (
                <ChoiceDialog
                    onClose={() => setShowChoice(false)}
                    onChooseSet={async () => {
                        setBusy(true);
                        setShowChoice(false);
                        await addPassage(passageId);
                        setBusy(false);
                    }}
                    onChooseQuestion={async () => {
                        setBusy(true);
                        setShowChoice(false);
                        await addQuestion(questionId);
                        setBusy(false);
                    }}
                />
            )}
        </>
    );
}

function ChoiceDialog({ onClose, onChooseSet, onChooseQuestion }: {
    onClose: () => void;
    onChooseSet: () => void;
    onChooseQuestion: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-black text-slate-900 mb-2">담기 방식 선택</h3>
                <p className="text-sm text-slate-500 font-medium mb-6">이 문제는 지문이 있는 문항입니다. 어떻게 담을까요?</p>
                <div className="grid grid-cols-1 gap-3">
                    <button
                        onClick={onChooseSet}
                        className="w-full text-left px-5 py-4 rounded-2xl border-2 border-teal-200 bg-teal-50 hover:bg-teal-100 transition-all group"
                    >
                        <div className="font-black text-teal-800 mb-1">📄 지문 세트로 담기</div>
                        <div className="text-xs text-teal-700 font-medium">지문과 그 지문에 속한 모든 문제를 함께 담습니다 (권장)</div>
                    </button>
                    <button
                        onClick={onChooseQuestion}
                        className="w-full text-left px-5 py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all group"
                    >
                        <div className="font-black text-slate-800 mb-1">📝 이 문제만 담기</div>
                        <div className="text-xs text-slate-600 font-medium">지문 없이 이 문제만 담습니다</div>
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="w-full mt-4 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-bold"
                >
                    취소
                </button>
            </div>
        </div>
    );
}
