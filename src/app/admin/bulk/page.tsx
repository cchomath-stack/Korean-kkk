'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
    Upload, FileText, Loader2, Home, ChevronLeft, ChevronRight,
    MousePointer2, Trash2, BookOpen, HelpCircle, RefreshCw, Plus, Link2,
    Save, CheckCircle2, X, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────
type RenderedPage = {
    pageNum: number;
    dataUrl: string;
    width: number;
    height: number;
};

type BoxType = 'PASSAGE' | 'QUESTION';
type DrawMode = 'IDLE' | 'PASSAGE' | 'PASSAGE_EXTEND' | 'QUESTION';

type Box = {
    id: string;
    type: BoxType;
    pageNum: number;
    groupId: string;
    isExtension: boolean;
    x: number; y: number; w: number; h: number;
};

type CardStatus = 'uploading' | 'ready' | 'saving' | 'saved' | 'error';

type QueueCard = {
    id: string;
    type: BoxType;
    pageNum: number;
    groupId: string;
    isExtension: boolean;
    status: CardStatus;
    previewUrl: string;
    imageUrl?: string;
    ocrText?: string;
    error?: string;
    dbId?: number;
};

type PassageMeta = {
    grade?: string;
    year?: string;
    month?: string;
    area?: string;     // 문학 / 독서 / 화작 / 언매
    startNo?: string;
    endNo?: string;
    tags: string[];
};

type QuestionMeta = {
    questionNo?: string;
    answer?: string;
    difficulty?: string; // 상 / 중 / 하
    tags: string[];
    grammarCategoryIds?: number[]; // 문법(어법) 카테고리 다중 선택
};

type GrammarTreeNode = {
    id: number;
    name: string;
    order: number;
    count: number;
    children?: GrammarTreeNode[];
};

const AREAS = ['문학', '독서', '화작', '언매'] as const;
const DIFFS = ['상', '중', '하'] as const;
const GRADES = ['1', '2', '3'] as const;

// ─── Helpers ────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

async function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function cropToBlob(pageDataUrl: string, box: Box): Promise<Blob> {
    const img = await loadImage(pageDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(box.w);
    canvas.height = Math.round(box.h);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d 실패');
    ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob 생성 실패'))), 'image/png');
    });
}

async function uploadCrop(blob: Blob, name: string): Promise<{ imageUrl: string; ocrText: string }> {
    const fd = new FormData();
    fd.append('file', new File([blob], name, { type: 'image/png' }));
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `upload ${res.status}`);
    }
    return await res.json();
}

// ─── Component ───────────────────────────────────────────────────────────
export default function BulkAdminPage() {
    const [pdfName, setPdfName] = useState('');
    const [pages, setPages] = useState<RenderedPage[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [error, setError] = useState('');

    const [drawMode, setDrawMode] = useState<DrawMode>('PASSAGE');
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [cards, setCards] = useState<QueueCard[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const activeGroupIdRef = useRef<string | null>(null);
    useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);

    // OCR 업로드 순차 처리 (CLOVA 동시 호출 시 느려지는 문제 회피)
    const ocrQueueRef = useRef<Promise<void>>(Promise.resolve());

    // 뷰 모드: 박스 그리기 / 데이터 입력
    const [viewMode, setViewMode] = useState<'BOX' | 'INPUT'>('BOX');

    // 현재 PDF 문서 ID (서버 업로드 후 받음)
    const [pdfDocumentId, setPdfDocumentId] = useState<number | null>(null);
    const [recentPdfs, setRecentPdfs] = useState<any[]>([]);

    const [passageMetas, setPassageMetas] = useState<Record<string, PassageMeta>>({});
    const [questionMetas, setQuestionMetas] = useState<Record<string, QuestionMeta>>({});
    const [savedPassageIds, setSavedPassageIds] = useState<Record<string, number>>({});
    const [lastPassageDefault, setLastPassageDefault] = useState<Partial<PassageMeta>>({});

    const [drafting, setDrafting] = useState<Box | null>(null);

    // PDF 페이지 줌 (50% ~ 200%)
    const [zoom, setZoom] = useState(1);


    // 미저장 작업이 있는지 (beforeunload + localStorage 드래프트용)
    const hasUnsaved = useMemo(() => {
        return cards.some((c) => c.status === 'ready' || c.status === 'error');
    }, [cards]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const pdfScrollRef = useRef<HTMLDivElement>(null);

    // Ctrl/⌘ + 휠 → PDF 줌만 조절 (브라우저 전체 줌 차단)
    // BOX 모드일 때 페이지 전체에서 동작 (메뉴/툴바 위에서 휠 돌려도 PDF가 줌됨)
    useEffect(() => {
        if (viewMode !== 'BOX') return;
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const step = e.deltaY > 0 ? -0.1 : 0.1;
                setZoom((z) => Math.max(0.5, Math.min(2, +(z + step).toFixed(2))));
            }
        };
        window.addEventListener('wheel', onWheel, { passive: false });
        return () => window.removeEventListener('wheel', onWheel);
    }, [viewMode]);

    // 새로고침/탭 닫기 경고
    useEffect(() => {
        if (!hasUnsaved) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '저장하지 않은 작업이 있습니다. 정말 떠나시겠습니까?';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [hasUnsaved]);

    // localStorage에 드래프트 자동 저장 (PDF별 키)
    useEffect(() => {
        if (!pdfDocumentId) return;
        if (cards.length === 0 && boxes.length === 0) return;
        const key = `oreum-bulk-draft-${pdfDocumentId}`;
        const draft = {
            boxes,
            cards: cards.map(({ previewUrl, ...rest }) => rest), // blob: URL 제외
            passageMetas,
            questionMetas,
            activeGroupId,
            savedAt: Date.now(),
        };
        try {
            localStorage.setItem(key, JSON.stringify(draft));
        } catch (e) {
            // localStorage 가득 차거나 비활성화된 경우 — 무시
        }
    }, [pdfDocumentId, boxes, cards, passageMetas, questionMetas, activeGroupId]);

    // 최근 PDF 목록 로드
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/admin/pdf');
                if (res.ok) setRecentPdfs(await res.json());
            } catch (e) { console.error('recent pdfs fetch failed', e); }
        })();
    }, []);

    // 문법 카테고리 트리 로드 (입력 화면에서 사용)
    const [grammarTree, setGrammarTree] = useState<GrammarTreeNode[]>([]);
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/grammar/categories');
                if (res.ok) {
                    const data = await res.json();
                    setGrammarTree(data.tree || []);
                }
            } catch (e) { console.error('grammar tree fetch failed', e); }
        })();
    }, []);

    // 최근 PDF에서 클릭으로 복원
    const loadRecentPdf = async (doc: any) => {
        try {
            setError('');
            setLoading(true);
            const res = await fetch(doc.blobUrl);
            if (!res.ok) throw new Error('PDF blob fetch 실패');
            const blob = await res.blob();
            const file = new File([blob], doc.name, { type: 'application/pdf' });
            await handleFile(file, { skipUpload: true, docId: doc.id });
            // restoreSavedFromPdf는 deduped일 때만 자동 호출되니, 직접 호출
            // 단, handleFile 안에서 setPages 후라야 함 — 위에서 await handleFile 마치고 호출 OK
            await restoreSavedFromPdf(doc.id, []);
        } catch (e: any) {
            setError(`불러오기 실패: ${e.message}`);
            setLoading(false);
        }
    };

    // PDF 처리 (file: 사용자가 선택한 파일, opts.skipUpload + opts.docId: 기존 PDF 복원 시)
    const handleFile = useCallback(async (file: File, opts?: { skipUpload?: boolean; docId?: number }) => {
        setError('');
        setLoading(true);
        setPages([]); setBoxes([]); setCards([]);
        setActiveGroupId(null);
        setPassageMetas({}); setQuestionMetas({}); setSavedPassageIds({});
        setProgress(null);
        setPdfName(file.name);
        setPdfDocumentId(opts?.docId ?? null);

        try {
            const buf = await file.arrayBuffer();

            // 서버 업로드 (병렬) — 동일 hash면 기존 PDF 반환
            const uploadPromise = opts?.skipUpload
                ? Promise.resolve(null)
                : (async () => {
                    const fd = new FormData();
                    fd.append('file', file);
                    const res = await fetch('/api/admin/pdf', { method: 'POST', body: fd });
                    if (!res.ok) throw new Error('PDF 서버 업로드 실패');
                    return res.json();
                })();

            const rendered: RenderedPage[] = [];

            // MuPDF로 form/annotation 포함 전체를 평면 비트맵으로 렌더링
            // /public/mupdf 에 둔 mupdf.js를 번들러 우회로 동적 로드
            const mupdf: any = await import(
                /* webpackIgnore: true */
                /* @vite-ignore */
                /* turbopackIgnore: true */
                '/mupdf/mupdf.js' as any
            );
            const doc = (mupdf.Document as any).openDocument(buf, 'application/pdf');
            const total = doc.countPages();
            const mat: any = [2, 0, 0, 2, 0, 0]; // 2x scale
            for (let i = 0; i < total; i++) {
                setProgress({ current: i + 1, total });
                const page: any = doc.loadPage(i);
                const pixmap: any = page.toPixmap(mat, (mupdf as any).ColorSpace.DeviceRGB, false);
                const pngBytes: Uint8Array = pixmap.asPNG();
                const width: number = pixmap.getWidth();
                const height: number = pixmap.getHeight();
                const buffer = new ArrayBuffer(pngBytes.byteLength);
                new Uint8Array(buffer).set(pngBytes);
                const blob = new Blob([buffer], { type: 'image/png' });
                const dataUrl = await new Promise<string>((res, rej) => {
                    const reader = new FileReader();
                    reader.onload = () => res(reader.result as string);
                    reader.onerror = () => rej(new Error('blob → dataURL 실패'));
                    reader.readAsDataURL(blob);
                });
                if (typeof pixmap.destroy === 'function') pixmap.destroy();
                if (typeof page.destroy === 'function') page.destroy();
                rendered.push({ pageNum: i + 1, dataUrl, width, height });
                setPages([...rendered]);
            }
            if (typeof doc.destroy === 'function') doc.destroy();
            setCurrentPage(1);

            const uploaded = await uploadPromise;
            const finalDocId = uploaded?.id ?? opts?.docId ?? null;
            if (uploaded?.id) {
                setPdfDocumentId(uploaded.id);
                if (uploaded.deduped) {
                    // 동일 PDF — 저장된 카드들 자동 복원
                    await restoreSavedFromPdf(uploaded.id, rendered);
                }
            }
            // localStorage 드래프트 복원 시도 (저장 안 된 박스들)
            if (finalDocId) {
                await tryRestoreLocalDraft(finalDocId);
            }
        } catch (e: any) {
            console.error(e);
            setError(`PDF 처리 실패: ${e.message || '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
            setProgress(null);
        }
    }, []);

    // localStorage 드래프트 복원: 저장 안 된 박스들을 다시 띄움
    const tryRestoreLocalDraft = async (docId: number) => {
        try {
            const key = `oreum-bulk-draft-${docId}`;
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const draft = JSON.parse(raw);
            // 미저장 카드만 추리기 (이미 DB에 있는 카드는 restoreSavedFromPdf 가 가져옴)
            const unsavedCards = (draft.cards || []).filter((c: any) => c.status !== 'saved');
            if (unsavedCards.length === 0) {
                localStorage.removeItem(key);
                return;
            }
            const ageMin = Math.round((Date.now() - (draft.savedAt || 0)) / 60000);
            const ok = confirm(
                `이전에 저장하지 않은 작업이 있습니다.\n` +
                `미저장 카드 ${unsavedCards.length}개 (${ageMin}분 전)\n\n` +
                `복원할까요? (취소 = 영구 삭제)`
            );
            if (!ok) {
                localStorage.removeItem(key);
                return;
            }
            // 미저장 카드/박스만 가져와 머지
            const unsavedIds = new Set(unsavedCards.map((c: any) => c.id));
            const unsavedBoxes = (draft.boxes || []).filter((b: any) => unsavedIds.has(b.id));
            // previewUrl 은 blob: URL이 살아있지 않으므로 imageUrl(Vercel Blob)로 대체
            const rehydrated = unsavedCards.map((c: any) => ({
                ...c,
                previewUrl: c.imageUrl || '',
            }));
            setCards((prev) => [...prev, ...rehydrated]);
            setBoxes((prev) => [...prev, ...unsavedBoxes]);
            if (draft.passageMetas) {
                setPassageMetas((prev) => ({ ...prev, ...draft.passageMetas }));
            }
            if (draft.questionMetas) {
                setQuestionMetas((prev) => ({ ...prev, ...draft.questionMetas }));
            }
            if (draft.activeGroupId) {
                setActiveGroupId(draft.activeGroupId);
            }
        } catch (e) {
            console.error('Local draft restore failed', e);
        }
    };

    // 기존 PDF의 저장된 카드들을 큐로 복원 + 페이지 위 회색 박스 표시
    const restoreSavedFromPdf = async (docId: number, _renderedPages: RenderedPage[]) => {
        try {
            const res = await fetch(`/api/admin/pdf/${docId}`);
            if (!res.ok) return;
            const doc = await res.json();
            const restoredBoxes: Box[] = [];
            const restoredCards: QueueCard[] = [];
            const newPassageMetas: Record<string, PassageMeta> = {};
            const newQuestionMetas: Record<string, QuestionMeta> = {};
            const newSavedPassageIds: Record<string, number> = {};

            // 지문들
            for (const p of doc.passages || []) {
                const groupId = `pdf-passage-${p.id}`;
                newSavedPassageIds[groupId] = p.id;
                newPassageMetas[groupId] = {
                    grade: p.grade?.toString(),
                    year: p.year?.toString(),
                    month: p.month?.toString(),
                    area: p.area || undefined,
                    startNo: p.startNo?.toString(),
                    endNo: p.endNo?.toString(),
                    tags: (p.tags || []).map((t: any) => t.tag.name),
                };
                (p.images || []).forEach((img: any, i: number) => {
                    const cardId = `pdf-pi-${img.id}`;
                    restoredCards.push({
                        id: cardId, type: 'PASSAGE', pageNum: img.pageNum ?? 1,
                        groupId, isExtension: i > 0,
                        status: 'saved', previewUrl: img.imageUrl, imageUrl: img.imageUrl,
                        ocrText: img.ocrText || '', dbId: p.id,
                    });
                    if (img.boxX != null && img.boxY != null && img.boxW != null && img.boxH != null) {
                        restoredBoxes.push({
                            id: cardId, type: 'PASSAGE',
                            pageNum: img.pageNum ?? 1, groupId, isExtension: i > 0,
                            x: img.boxX, y: img.boxY, w: img.boxW, h: img.boxH,
                        });
                    }
                });
            }

            // 문제들
            for (const q of doc.questions || []) {
                const groupId = q.passageId ? `pdf-passage-${q.passageId}` : `pdf-question-${q.id}`;
                newQuestionMetas[`pdf-q-${q.id}`] = {
                    questionNo: q.questionNo?.toString(),
                    answer: q.answer || undefined,
                    difficulty: q.difficulty || undefined,
                    tags: (q.tags || []).map((t: any) => t.tag.name),
                    grammarCategoryIds: (q.grammarCategories || []).map((g: any) => g.category?.id ?? g.categoryId),
                };
                const cardId = `pdf-q-${q.id}`;
                restoredCards.push({
                    id: cardId, type: 'QUESTION', pageNum: q.pageNum ?? 1,
                    groupId, isExtension: false,
                    status: 'saved', previewUrl: q.imageUrl, imageUrl: q.imageUrl,
                    ocrText: q.ocrText || '', dbId: q.id,
                });
                if (q.boxX != null && q.boxY != null && q.boxW != null && q.boxH != null) {
                    restoredBoxes.push({
                        id: cardId, type: 'QUESTION',
                        pageNum: q.pageNum ?? 1, groupId, isExtension: false,
                        x: q.boxX, y: q.boxY, w: q.boxW, h: q.boxH,
                    });
                }
            }

            setBoxes((prev) => [...prev, ...restoredBoxes]);
            setCards((prev) => [...prev, ...restoredCards]);
            setPassageMetas((prev) => ({ ...prev, ...newPassageMetas }));
            setQuestionMetas((prev) => ({ ...prev, ...newQuestionMetas }));
            setSavedPassageIds((prev) => ({ ...prev, ...newSavedPassageIds }));
        } catch (e) {
            console.error('Restore failed', e);
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };
    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'application/pdf') handleFile(file);
    };

    const goPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
    const goNext = () => setCurrentPage((p) => Math.min(pages.length, p + 1));

    // 키보드 (박스 모드 전용)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (viewMode !== 'BOX') return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'ArrowRight') goNext();
            if (e.key === '1') setDrawMode('PASSAGE');
            if (e.key === '2') setDrawMode('PASSAGE_EXTEND');
            if (e.key === '3') setDrawMode('QUESTION');
            if (e.key === '0') setDrawMode('IDLE');
            if (e.key === 'Escape') setDrafting(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pages.length, viewMode]);

    const current = pages.find((p) => p.pageNum === currentPage);
    const currentBoxes = useMemo(() => boxes.filter((b) => b.pageNum === currentPage), [boxes, currentPage]);

    // 마우스 → 원본 픽셀 좌표
    const eventToImageCoord = (e: React.MouseEvent): { x: number; y: number } | null => {
        const img = imgRef.current;
        if (!img || !current) return null;
        const rect = img.getBoundingClientRect();
        const sx = current.width / rect.width;
        const sy = current.height / rect.height;
        return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (drawMode === 'IDLE' || !current) return;
        if (e.button !== 0) return;
        const p = eventToImageCoord(e);
        if (!p) return;
        e.preventDefault();
        const id = uid();
        let type: BoxType, groupId: string, isExtension = false;
        const active = activeGroupIdRef.current;
        if (drawMode === 'PASSAGE') {
            type = 'PASSAGE'; groupId = id;
        } else if (drawMode === 'PASSAGE_EXTEND') {
            type = 'PASSAGE';
            if (active) { groupId = active; isExtension = true; }
            else groupId = id;
        } else {
            type = 'QUESTION'; groupId = active ?? id;
        }
        setDrafting({ id, type, pageNum: currentPage, groupId, isExtension, x: p.x, y: p.y, w: 0, h: 0 });
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!drafting) return;
        const p = eventToImageCoord(e);
        if (!p) return;
        setDrafting({ ...drafting, w: p.x - drafting.x, h: p.y - drafting.y });
    };

    const onMouseUp = async () => {
        if (!drafting || !current) return;
        const norm: Box = {
            ...drafting,
            x: drafting.w < 0 ? drafting.x + drafting.w : drafting.x,
            y: drafting.h < 0 ? drafting.y + drafting.h : drafting.y,
            w: Math.abs(drafting.w), h: Math.abs(drafting.h),
        };
        setDrafting(null);
        if (norm.w < 10 || norm.h < 10) return;
        setBoxes((prev) => [...prev, norm]);

        if (norm.type === 'PASSAGE' && !norm.isExtension) {
            setActiveGroupId(norm.groupId);
            // 새 그룹 메타 초기화 (마지막 그룹 디폴트 상속)
            setPassageMetas((prev) => ({
                ...prev,
                [norm.groupId]: {
                    grade: lastPassageDefault.grade,
                    year: lastPassageDefault.year,
                    month: lastPassageDefault.month,
                    area: lastPassageDefault.area,
                    tags: [],
                },
            }));
        }
        if (norm.type === 'QUESTION') {
            setQuestionMetas((prev) => ({ ...prev, [norm.id]: { tags: [] } }));
        }

        ocrQueueRef.current = ocrQueueRef.current.then(() => processBox(norm, current));
    };

    const processBox = async (box: Box, page: RenderedPage) => {
        let blob: Blob;
        try {
            blob = await cropToBlob(page.dataUrl, box);
        } catch (e: any) {
            setCards((prev) => [...prev, {
                id: box.id, type: box.type, pageNum: box.pageNum,
                groupId: box.groupId, isExtension: box.isExtension,
                status: 'error', previewUrl: '', error: e.message,
            }]);
            return;
        }
        const previewUrl = URL.createObjectURL(blob);
        setCards((prev) => [...prev, {
            id: box.id, type: box.type, pageNum: box.pageNum,
            groupId: box.groupId, isExtension: box.isExtension,
            status: 'uploading', previewUrl,
        }]);
        try {
            const { imageUrl, ocrText } = await uploadCrop(blob, `${box.type}-p${box.pageNum}-${box.id}.png`);
            setCards((prev) => prev.map((c) =>
                c.id === box.id ? { ...c, status: 'ready', imageUrl, ocrText } : c));
        } catch (e: any) {
            setCards((prev) => prev.map((c) =>
                c.id === box.id ? { ...c, status: 'error', error: e.message } : c));
        }
    };

    const retryCard = async (cardId: string) => {
        const box = boxes.find((b) => b.id === cardId);
        const page = box && pages.find((p) => p.pageNum === box.pageNum);
        if (!box || !page) return;
        setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: 'uploading', error: undefined } : c)));
        ocrQueueRef.current = ocrQueueRef.current.then(() => processBox(box, page));
    };

    const deleteCard = (cardId: string) => {
        setCards((prev) => {
            const c = prev.find((x) => x.id === cardId);
            if (c?.previewUrl) URL.revokeObjectURL(c.previewUrl);
            return prev.filter((x) => x.id !== cardId);
        });
        setBoxes((prev) => prev.filter((b) => b.id !== cardId));
        if (activeGroupId === cardId) setActiveGroupId(null);
    };

    // 지문 그룹을 위 그룹(가장 가까운 미저장 지문 그룹)에 합침: 단별 추가 효과
    const mergeIntoPrevious = (currentGroupId: string) => {
        const idx = groups.findIndex((g) => g.groupId === currentGroupId);
        if (idx <= 0) return;
        // 가장 가까운 위쪽의 PASSAGE_GROUP 중 미저장인 것 찾기
        let target: typeof groups[number] | null = null;
        for (let i = idx - 1; i >= 0; i--) {
            if (groups[i].kind === 'PASSAGE_GROUP' && !savedPassageIds[groups[i].groupId]) {
                target = groups[i];
                break;
            }
        }
        if (!target) {
            alert('합칠 수 있는 위쪽 지문 그룹이 없습니다.');
            return;
        }
        if (savedPassageIds[currentGroupId]) {
            alert('이미 저장된 지문은 합칠 수 없습니다.');
            return;
        }
        const targetId = target.groupId;

        setCards((prev) => prev.map((c) => {
            if (c.groupId !== currentGroupId) return c;
            if (c.type === 'PASSAGE') return { ...c, groupId: targetId, isExtension: true };
            return { ...c, groupId: targetId };
        }));
        setBoxes((prev) => prev.map((b) => {
            if (b.groupId !== currentGroupId) return b;
            if (b.type === 'PASSAGE') return { ...b, groupId: targetId, isExtension: true };
            return { ...b, groupId: targetId };
        }));
        // 현재 그룹의 메타는 폐기
        setPassageMetas((prev) => {
            const { [currentGroupId]: _drop, ...rest } = prev;
            return rest;
        });
        if (activeGroupId === currentGroupId) setActiveGroupId(targetId);
    };

    const updateCardOcr = (cardId: string, text: string) => {
        setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ocrText: text } : c)));
    };

    // ─── 그룹 정리 ──────────────────────────────────────────────────────
    type Group = {
        groupId: string;
        kind: 'PASSAGE_GROUP' | 'STANDALONE_QUESTION';
        passages: QueueCard[];
        questions: QueueCard[];
        firstSeenIdx: number;
    };
    const groups = useMemo<Group[]>(() => {
        const map = new Map<string, Group>();
        cards.forEach((c, idx) => {
            let g = map.get(c.groupId);
            if (!g) {
                g = {
                    groupId: c.groupId,
                    kind: c.type === 'PASSAGE' ? 'PASSAGE_GROUP' : 'STANDALONE_QUESTION',
                    passages: [], questions: [], firstSeenIdx: idx,
                };
                map.set(c.groupId, g);
            }
            if (c.type === 'PASSAGE') {
                if (!c.isExtension) g.passages.unshift(c);
                else g.passages.push(c);
                g.kind = 'PASSAGE_GROUP';
            } else g.questions.push(c);
        });
        return [...map.values()].sort((a, b) => a.firstSeenIdx - b.firstSeenIdx);
    }, [cards]);
    const activeGroup = groups.find((g) => g.groupId === activeGroupId);

    // ─── 저장 (그룹/문제) ───────────────────────────────────────────────
    const updatePassageMeta = (gid: string, patch: Partial<PassageMeta>) => {
        setPassageMetas((prev) => ({ ...prev, [gid]: { ...(prev[gid] || { tags: [] }), ...patch } }));
    };
    const updateQuestionMeta = (cid: string, patch: Partial<QuestionMeta>) => {
        setQuestionMetas((prev) => ({ ...prev, [cid]: { ...(prev[cid] || { tags: [] }), ...patch } }));
    };

    const savePassageGroup = async (g: Group) => {
        if (g.kind !== 'PASSAGE_GROUP') return;
        const meta = passageMetas[g.groupId] || { tags: [] };
        const notReady = g.passages.find((c) => c.status !== 'ready');
        if (notReady) { alert('지문 이미지가 아직 처리 중입니다.'); return; }

        // 카드 상태 → saving
        setCards((prev) => prev.map((c) => g.passages.find((p) => p.id === c.id) ? { ...c, status: 'saving' } : c));

        try {
            const body = {
                year: meta.year, month: meta.month, grade: meta.grade,
                area: meta.area,
                startNo: meta.startNo, endNo: meta.endNo,
                tags: meta.tags,
                pdfDocumentId,
                images: g.passages.map((c, i) => {
                    const box = boxes.find((b) => b.id === c.id);
                    return {
                        imageUrl: c.imageUrl, ocrText: c.ocrText, order: i,
                        pageNum: c.pageNum,
                        boxX: box?.x, boxY: box?.y, boxW: box?.w, boxH: box?.h,
                    };
                }),
            };
            const res = await fetch('/api/admin/passage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `passage save ${res.status}`);
            }
            const saved = await res.json();
            setCards((prev) => prev.map((c) =>
                g.passages.find((p) => p.id === c.id) ? { ...c, status: 'saved', dbId: saved.id } : c));
            setSavedPassageIds((prev) => ({ ...prev, [g.groupId]: saved.id }));
            setLastPassageDefault({
                grade: meta.grade, year: meta.year, month: meta.month,
                area: meta.area,
            });
        } catch (e: any) {
            console.error(e);
            alert(`지문 저장 실패: ${e.message}`);
            setCards((prev) => prev.map((c) =>
                g.passages.find((p) => p.id === c.id) ? { ...c, status: 'ready' } : c));
        }
    };

    const saveQuestion = async (card: QueueCard) => {
        const meta = questionMetas[card.id] || { tags: [] };
        if (card.status !== 'ready') { alert('문제가 아직 처리 중입니다.'); return; }
        const passageDbId = savedPassageIds[card.groupId];
        const isStandalone = card.id === card.groupId;
        if (!passageDbId && !isStandalone) {
            alert('지문 그룹을 먼저 저장하세요.');
            return;
        }
        setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, status: 'saving' } : c));
        try {
            const box = boxes.find((b) => b.id === card.id);
            const body = {
                passageId: passageDbId ?? null,
                pdfDocumentId,
                imageUrl: card.imageUrl,
                ocrText: card.ocrText,
                questionNo: meta.questionNo,
                answer: meta.answer,
                difficulty: meta.difficulty,
                tags: meta.tags,
                grammarCategoryIds: meta.grammarCategoryIds || [],
                pageNum: card.pageNum,
                boxX: box?.x, boxY: box?.y, boxW: box?.w, boxH: box?.h,
            };
            const res = await fetch('/api/admin/question', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `question save ${res.status}`);
            }
            const saved = await res.json();
            setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, status: 'saved', dbId: saved.id } : c));
        } catch (e: any) {
            console.error(e);
            alert(`문제 저장 실패: ${e.message}`);
            setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, status: 'ready' } : c));
        }
    };

    // ─── 렌더 ───────────────────────────────────────────────────────────
    return (
        <div className="h-screen bg-slate-50 flex flex-col">
            <header className="h-16 px-6 flex items-center justify-between border-b bg-white shrink-0 z-40 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-sm font-medium">
                        <Home size={18} /> 홈
                    </Link>
                    <span className="text-slate-300">|</span>
                    <h1 className="font-bold text-slate-900 text-base">PDF 일괄 입력</h1>
                    {pdfName && (
                        <span className="text-sm text-slate-500 flex items-center gap-1.5">
                            <FileText size={14} /> {pdfName}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {pages.length > 0 && (
                        <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
                            <button onClick={() => setViewMode('BOX')}
                                className={`px-4 py-1.5 text-sm font-bold rounded flex items-center gap-2 transition ${
                                    viewMode === 'BOX' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'
                                }`}>
                                📐 박스 그리기
                                <span className="text-xs text-slate-500">({boxes.length})</span>
                            </button>
                            <button onClick={() => setViewMode('INPUT')}
                                className={`px-4 py-1.5 text-sm font-bold rounded flex items-center gap-2 transition ${
                                    viewMode === 'INPUT' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'
                                }`}>
                                📝 데이터 입력
                                {(() => {
                                    const pending = cards.filter((c) => c.status !== 'saved').length;
                                    const saved = cards.filter((c) => c.status === 'saved').length;
                                    return (
                                        <span className="text-xs">
                                            <span className="text-orange-600 font-semibold">{pending}대기</span>
                                            {saved > 0 && <span className="text-emerald-600 ml-1 font-semibold">{saved}완료</span>}
                                        </span>
                                    );
                                })()}
                            </button>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="application/pdf" onChange={onFileChange} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded hover:bg-teal-700 flex items-center gap-1.5">
                        <Upload size={14} /> {pages.length > 0 ? 'PDF 변경' : 'PDF 업로드'}
                    </button>
                </div>
            </header>

            {error && <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm px-6 py-2">{error}</div>}

            {pages.length === 0 && !loading ? (
                <DropZone
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    recentPdfs={recentPdfs}
                    onLoadRecent={loadRecentPdf}
                />
            ) : viewMode === 'BOX' ? (
                /* ─── BOX 모드 ─── */
                <div className="flex-1 flex min-h-0">
                    {/* Left thumbnails */}
                    <aside className="w-44 border-r bg-white overflow-y-auto p-2 space-y-2 shrink-0">
                        {pages.map((p) => {
                            const cnt = boxes.filter((b) => b.pageNum === p.pageNum).length;
                            const savedCnt = cards.filter((c) => c.pageNum === p.pageNum && c.status === 'saved').length;
                            return (
                                <button key={p.pageNum} onClick={() => setCurrentPage(p.pageNum)}
                                    className={`w-full rounded border-2 overflow-hidden block transition relative ${
                                        p.pageNum === currentPage ? 'border-teal-500 ring-2 ring-teal-200'
                                            : 'border-slate-200 hover:border-slate-400'
                                    }`}>
                                    <img src={p.dataUrl} alt={`p${p.pageNum}`} className="w-full block" />
                                    <div className="text-xs flex justify-between px-1.5 py-1 bg-slate-50 text-slate-600">
                                        <span>p.{p.pageNum}</span>
                                        {cnt > 0 && (
                                            <span className="font-semibold">
                                                <span className="text-teal-700">{cnt}</span>
                                                {savedCnt > 0 && <span className="text-emerald-600"> ✓{savedCnt}</span>}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                        {loading && progress && (
                            <div className="text-xs text-center text-slate-500 py-2 flex items-center justify-center gap-1.5">
                                <Loader2 className="animate-spin" size={12} />{progress.current}/{progress.total}
                            </div>
                        )}
                    </aside>

                    {/* Center: 페이지 (전체 너비 활용) */}
                    <main ref={pdfScrollRef} className="flex-1 overflow-auto bg-slate-100 flex flex-col items-center">
                        <div className="sticky top-0 z-30 w-full px-4 py-3 bg-slate-100/95 backdrop-blur flex flex-col items-center gap-2 shadow-sm">
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border flex-wrap justify-center">
                                <button onClick={goPrev} disabled={currentPage <= 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
                                <span className="text-sm font-medium text-slate-700 w-20 text-center">{currentPage} / {pages.length}</span>
                                <button onClick={goNext} disabled={currentPage >= pages.length} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
                                <div className="w-px h-6 bg-slate-200 mx-2" />
                                <ModeButton active={drawMode === 'PASSAGE'} color="blue" icon={<BookOpen size={14} />} label="새 지문 (1)" onClick={() => setDrawMode('PASSAGE')} />
                                <ModeButton active={drawMode === 'PASSAGE_EXTEND'} color="indigo" icon={<Plus size={14} />} label="지문 이어 (2)" onClick={() => setDrawMode('PASSAGE_EXTEND')} disabled={!activeGroupId} />
                                <ModeButton active={drawMode === 'QUESTION'} color="orange" icon={<HelpCircle size={14} />} label="문제 (3)" onClick={() => setDrawMode('QUESTION')} />
                                <ModeButton active={drawMode === 'IDLE'} color="slate" icon={<MousePointer2 size={14} />} label="보기 (0)" onClick={() => setDrawMode('IDLE')} />
                                <div className="w-px h-6 bg-slate-200 mx-2" />
                                <button
                                    onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
                                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                                    title="축소"
                                >
                                    <ZoomOut size={14} />
                                </button>
                                <span className="text-xs font-bold text-slate-700 w-12 text-center tabular-nums">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
                                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                                    title="확대"
                                >
                                    <ZoomIn size={14} />
                                </button>
                                <button
                                    onClick={() => setZoom(1)}
                                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400"
                                    title="원래대로"
                                >
                                    <RotateCcw size={13} />
                                </button>
                            </div>
                            <div className="text-xs flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border shadow-sm">
                                <Link2 size={12} className={activeGroup ? 'text-teal-600' : 'text-slate-300'} />
                                {activeGroup ? (
                                    <>
                                        <span className="text-slate-500">활성 지문:</span>
                                        <span className="font-semibold text-blue-700">#{activeGroup.groupId.slice(0, 6)} (p.{activeGroup.passages[0]?.pageNum})</span>
                                        {savedPassageIds[activeGroup.groupId] && (
                                            <span className="text-emerald-600 font-semibold">· 저장됨 (DB#{savedPassageIds[activeGroup.groupId]})</span>
                                        )}
                                        <button onClick={() => setActiveGroupId(null)} className="text-slate-400 hover:text-slate-700 ml-1">✕</button>
                                    </>
                                ) : (<span className="text-slate-400">활성 지문 없음 — 문제는 단독 등록</span>)}
                            </div>
                        </div>

                        {current ? (
                            <div
                                className="relative select-none my-4"
                                style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
                            >
                                <img ref={imgRef} src={current.dataUrl} alt={`page-${currentPage}`} className="w-full shadow-lg bg-white block" draggable={false} />
                                <svg
                                    className={`absolute inset-0 w-full h-full ${drawMode === 'IDLE' ? 'cursor-default' : 'cursor-crosshair'}`}
                                    onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                                    onMouseLeave={() => drafting && setDrafting(null)}
                                    viewBox={`0 0 ${current.width} ${current.height}`} preserveAspectRatio="none"
                                >
                                    {currentBoxes.map((b) => {
                                        const card = cards.find((c) => c.id === b.id);
                                        return <BoxRect key={b.id} box={b}
                                            active={b.groupId === activeGroupId && card?.status !== 'saved'}
                                            status={card?.status}
                                            onDelete={deleteCard} />;
                                    })}
                                    {drafting && drafting.pageNum === currentPage && <BoxRect box={drafting} dashed />}
                                </svg>
                            </div>
                        ) : (
                            <div className="text-slate-400 mt-20 flex items-center gap-2"><Loader2 className="animate-spin" size={16} />렌더링 중...</div>
                        )}
                    </main>
                </div>
            ) : (
                /* ─── INPUT 모드 ─── */
                <div className="flex-1 flex min-h-0">
                    {/* Left: 페이지 + 그룹 점프 */}
                    <aside className="w-52 border-r bg-white overflow-y-auto p-2 space-y-2 shrink-0">
                        <div className="text-[10px] font-bold text-slate-500 px-1 mb-1">그룹 ({groups.length})</div>
                        {groups.map((g) => {
                            const sav = !!savedPassageIds[g.groupId] || (g.kind === 'STANDALONE_QUESTION' && g.questions.every((q) => q.status === 'saved'));
                            return (
                                <a key={g.groupId} href={`#group-${g.groupId}`}
                                    className={`block px-2 py-1.5 text-xs rounded transition ${
                                        sav ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                    }`}>
                                    <div className="font-semibold flex items-center gap-1">
                                        {sav && <span>✓</span>}
                                        {g.kind === 'PASSAGE_GROUP' ? `지문 #${g.groupId.slice(0, 6)}` : '단독 문제'}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        p.{g.passages[0]?.pageNum || g.questions[0]?.pageNum}
                                        {g.passages.length > 0 && ` · 지문 ${g.passages.length}`}
                                        {g.questions.length > 0 && ` · 문제 ${g.questions.length}`}
                                    </div>
                                </a>
                            );
                        })}
                        {groups.length === 0 && (
                            <div className="text-xs text-slate-400 text-center mt-4 leading-5">
                                박스를 먼저 그려주세요.
                            </div>
                        )}
                    </aside>

                    {/* Main: 그룹별 카드 그리드 */}
                    <main className="flex-1 overflow-auto bg-slate-50 p-6">
                        {groups.length === 0 ? (
                            <div className="text-center text-slate-400 mt-20">
                                먼저 <button onClick={() => setViewMode('BOX')} className="text-teal-600 underline">박스 그리기</button> 모드에서 박스를 그려주세요.
                            </div>
                        ) : (
                            <div className="space-y-6 max-w-6xl mx-auto">
                                {groups.map((g, idx) => {
                                    // 위에 미저장 PASSAGE_GROUP이 있는지 (합치기 가능 여부)
                                    let canMerge = false;
                                    if (g.kind === 'PASSAGE_GROUP' && !savedPassageIds[g.groupId]) {
                                        for (let i = idx - 1; i >= 0; i--) {
                                            if (groups[i].kind === 'PASSAGE_GROUP' && !savedPassageIds[groups[i].groupId]) {
                                                canMerge = true; break;
                                            }
                                        }
                                    }
                                    return (
                                        <div key={g.groupId} id={`group-${g.groupId}`}>
                                            <GroupInputCard
                                                group={g}
                                                savedPassageId={savedPassageIds[g.groupId]}
                                                passageMeta={passageMetas[g.groupId] || { tags: [] }}
                                                questionMetas={questionMetas}
                                                canMerge={canMerge}
                                                grammarTree={grammarTree}
                                                onDelete={deleteCard}
                                                onRetry={retryCard}
                                                onOcrChange={updateCardOcr}
                                                onPassageMetaChange={(patch) => updatePassageMeta(g.groupId, patch)}
                                                onQuestionMetaChange={updateQuestionMeta}
                                                onSaveGroup={() => savePassageGroup(g)}
                                                onSaveQuestion={(c) => saveQuestion(c)}
                                                onMergeIntoPrevious={() => mergeIntoPrevious(g.groupId)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </main>
                </div>
            )}
        </div>
    );
}

// ─── Subcomponents ───────────────────────────────────────────────────────
function DropZone({
    onDrop, onClick, recentPdfs, onLoadRecent,
}: {
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onClick: () => void;
    recentPdfs: any[];
    onLoadRecent: (doc: any) => void;
}) {
    const [hover, setHover] = useState(false);
    return (
        <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
                onDragOver={(e) => { e.preventDefault(); setHover(true); }}
                onDragLeave={() => setHover(false)}
                onDrop={(e) => { setHover(false); onDrop(e); }}
                onClick={onClick}
                className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition min-h-[300px] ${
                    hover ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-white hover:bg-slate-50'
                }`}
            >
                <Upload size={48} className="text-slate-400 mb-4" />
                <div className="text-lg font-bold text-slate-700">새 PDF 업로드</div>
                <div className="text-sm text-slate-500 mt-1">드래그하거나 클릭해 선택</div>
                <div className="text-xs text-slate-400 mt-2">동일 PDF는 자동 인식되어 작업 이어서 가능</div>
            </div>

            <div className="bg-white border rounded-xl p-4 overflow-auto">
                <div className="text-base font-bold text-slate-900 mb-3 flex items-center justify-between">
                    <span>📚 최근 PDF</span>
                    <span className="text-xs font-normal text-slate-400">({recentPdfs.length})</span>
                </div>
                {recentPdfs.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-8">아직 업로드된 PDF가 없습니다.</div>
                ) : (
                    <ul className="space-y-2">
                        {recentPdfs.map((p) => {
                            const cnt = (p._count?.passages || 0) + (p._count?.questions || 0);
                            return (
                                <li key={p.id}>
                                    <button onClick={() => onLoadRecent(p)}
                                        className="w-full text-left p-3 rounded-lg border hover:border-teal-500 hover:bg-teal-50 transition group">
                                        <div className="font-semibold text-sm text-slate-900 truncate">{p.name}</div>
                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                                            <span>{new Date(p.createdAt).toLocaleString('ko-KR')}</span>
                                            {cnt > 0 ? (
                                                <span className="text-emerald-600 font-semibold">✓ {cnt}건 저장됨</span>
                                            ) : (
                                                <span className="text-slate-400">미저장</span>
                                            )}
                                            {p.pageCount && <span className="text-slate-400">· {p.pageCount}p</span>}
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

function ModeButton({
    active, color, icon, label, onClick, disabled,
}: { active: boolean; color: 'blue' | 'indigo' | 'orange' | 'slate'; icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; }) {
    const colors = {
        blue: 'bg-blue-600 text-white',
        indigo: 'bg-indigo-600 text-white',
        orange: 'bg-orange-500 text-white',
        slate: 'bg-slate-700 text-white',
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition disabled:opacity-30 disabled:cursor-not-allowed ${
                active ? colors[color] : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {icon}{label}
        </button>
    );
}

function BoxRect({ box, dashed, active, status, onDelete }: { box: Box; dashed?: boolean; active?: boolean; status?: CardStatus; onDelete?: (id: string) => void; }) {
    const [hovered, setHovered] = useState(false);
    const isPassage = box.type === 'PASSAGE';
    let stroke: string, fill: string;
    const saved = status === 'saved';
    const uploading = status === 'uploading';
    if (saved) {
        stroke = '#16a34a'; // emerald-600
        fill = 'rgba(22,163,74,0.15)';
    } else if (uploading) {
        stroke = '#94a3b8'; // slate-400
        fill = 'rgba(148,163,184,0.10)';
    } else {
        stroke = isPassage ? (box.isExtension ? '#6366f1' : '#2563eb') : '#f97316';
        fill = isPassage
            ? (box.isExtension ? 'rgba(99,102,241,0.10)' : 'rgba(37,99,235,0.10)')
            : 'rgba(249,115,22,0.10)';
    }
    const x = box.w < 0 ? box.x + box.w : box.x;
    const y = box.h < 0 ? box.y + box.h : box.y;
    const w = Math.abs(box.w);
    const h = Math.abs(box.h);
    const canDelete = !!onDelete && !saved && !uploading && !dashed;
    const r = 22;
    const cx = x + w - r - 4;
    const cy = y + r + 4;
    return (
        <g
            onMouseEnter={() => canDelete && setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <rect
                x={x} y={y}
                width={w} height={h}
                stroke={stroke}
                strokeWidth={active ? 5 : 3}
                strokeDasharray={dashed ? '8 4' : box.isExtension ? '4 3' : undefined}
                fill={fill}
            />
            {hovered && canDelete && (
                <g
                    style={{ cursor: 'pointer' }}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete!(box.id);
                    }}
                >
                    <circle cx={cx} cy={cy} r={r} fill="#dc2626" stroke="white" strokeWidth={2} />
                    <line x1={cx - 8} y1={cy - 8} x2={cx + 8} y2={cy + 8} stroke="white" strokeWidth={3} strokeLinecap="round" />
                    <line x1={cx - 8} y1={cy + 8} x2={cx + 8} y2={cy - 8} stroke="white" strokeWidth={3} strokeLinecap="round" />
                </g>
            )}
        </g>
    );
}

// ─── TagInput ───────────────────────────────────────────────────────────
function TagInput({ tags, onChange, disabled }: { tags: string[]; onChange: (t: string[]) => void; disabled?: boolean; }) {
    const [input, setInput] = useState('');
    const add = (raw: string) => {
        const parts = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        if (parts.length === 0) return;
        const merged = [...tags];
        parts.forEach((p) => { if (!merged.includes(p)) merged.push(p); });
        onChange(merged);
        setInput('');
    };
    const remove = (t: string) => onChange(tags.filter((x) => x !== t));
    return (
        <div className={`border rounded p-2 flex flex-wrap gap-1.5 items-center ${disabled ? 'bg-slate-50' : 'bg-white'}`}>
            {tags.map((t) => (
                <span key={t} className="text-xs bg-teal-100 text-teal-800 rounded-full px-2.5 py-1 flex items-center gap-1">
                    #{t}
                    {!disabled && (
                        <button onClick={() => remove(t)} className="hover:text-teal-950">
                            <X size={12} />
                        </button>
                    )}
                </span>
            ))}
            {!disabled && (
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            if (input.trim()) add(input);
                        } else if (e.key === 'Backspace' && !input && tags.length > 0) {
                            remove(tags[tags.length - 1]);
                        }
                    }}
                    onBlur={() => { if (input.trim()) add(input); }}
                    placeholder={tags.length === 0 ? '태그 입력 후 Enter/콤마' : ''}
                    className="flex-1 min-w-[100px] text-sm px-1 py-1 outline-none bg-transparent text-slate-900"
                />
            )}
        </div>
    );
}

// ─── GroupInputCard (입력 모드용 큰 카드) ─────────────────────────────
function GroupInputCard({
    group, savedPassageId, passageMeta, questionMetas, canMerge, grammarTree,
    onDelete, onRetry, onOcrChange,
    onPassageMetaChange, onQuestionMetaChange,
    onSaveGroup, onSaveQuestion, onMergeIntoPrevious,
}: {
    group: { groupId: string; kind: 'PASSAGE_GROUP' | 'STANDALONE_QUESTION'; passages: QueueCard[]; questions: QueueCard[] };
    savedPassageId?: number;
    passageMeta: PassageMeta;
    questionMetas: Record<string, QuestionMeta>;
    canMerge: boolean;
    grammarTree: GrammarTreeNode[];
    onDelete: (id: string) => void;
    onRetry: (id: string) => void;
    onOcrChange: (id: string, text: string) => void;
    onPassageMetaChange: (patch: Partial<PassageMeta>) => void;
    onQuestionMetaChange: (cid: string, patch: Partial<QuestionMeta>) => void;
    onSaveGroup: () => void;
    onSaveQuestion: (c: QueueCard) => void;
    onMergeIntoPrevious: () => void;
}) {
    const isPassageGroup = group.kind === 'PASSAGE_GROUP';
    const passageSaved = !!savedPassageId;
    const passageSaving = group.passages.some((c) => c.status === 'saving');
    const passageReady = group.passages.length > 0 && group.passages.every((c) => c.status === 'ready' || c.status === 'saved');

    return (
        <div className={`rounded-xl border-2 overflow-hidden bg-white shadow-sm ${
            passageSaved ? 'border-emerald-400' : isPassageGroup ? 'border-blue-300' : 'border-orange-300'
        }`}>
            {/* 헤더 */}
            <div className={`px-5 py-3 border-b flex items-center justify-between ${
                passageSaved ? 'bg-emerald-50' : isPassageGroup ? 'bg-blue-50' : 'bg-orange-50'
            }`}>
                <div className="flex items-center gap-2 font-bold text-slate-900">
                    {passageSaved ? <CheckCircle2 size={16} className="text-emerald-600" /> :
                        isPassageGroup ? <BookOpen size={16} className="text-blue-600" /> :
                        <HelpCircle size={16} className="text-orange-600" />}
                    <span>
                        {isPassageGroup ? `지문 그룹 #${group.groupId.slice(0, 6)}` : '단독 문제'}
                        {passageSaved && <span className="ml-2 text-emerald-700 text-sm">저장됨 (DB#{savedPassageId})</span>}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {canMerge && (
                        <button
                            onClick={() => {
                                if (confirm('이 지문을 위 지문 그룹의 단별 추가 이미지로 합칠까요?')) onMergeIntoPrevious();
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold flex items-center gap-1 border border-indigo-200"
                            title="실수로 새 지문으로 그렸을 때 위 지문에 단별 추가 이미지로 합침"
                        >
                            ↑ 위 지문에 합치기
                        </button>
                    )}
                    <div className="text-sm text-slate-500">
                        {group.passages.length > 0 && `지문 ${group.passages.length}장`}
                        {group.passages.length > 0 && group.questions.length > 0 && ' · '}
                        {group.questions.length > 0 && `문제 ${group.questions.length}개`}
                    </div>
                </div>
            </div>

            {/* 지문 메타 폼 (그룹 단위) */}
            {isPassageGroup && (
                <div className="px-5 py-4 border-b bg-blue-50/30 space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                        <SelectField label="학년" value={passageMeta.grade} onChange={(v) => onPassageMetaChange({ grade: v })} options={GRADES as any} disabled={passageSaved} />
                        <NumField label="연도" value={passageMeta.year} onChange={(v) => onPassageMetaChange({ year: v })} disabled={passageSaved} />
                        <NumField label="월" value={passageMeta.month} onChange={(v) => onPassageMetaChange({ month: v })} disabled={passageSaved} />
                        <SelectField label="영역" value={passageMeta.area} onChange={(v) => onPassageMetaChange({ area: v })} options={AREAS as any} disabled={passageSaved} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <NumField label="시작 번호" value={passageMeta.startNo} onChange={(v) => onPassageMetaChange({ startNo: v })} disabled={passageSaved} />
                        <NumField label="끝 번호" value={passageMeta.endNo} onChange={(v) => onPassageMetaChange({ endNo: v })} disabled={passageSaved} />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">지문 태그</div>
                        <TagInput tags={passageMeta.tags} onChange={(t) => onPassageMetaChange({ tags: t })} disabled={passageSaved} />
                    </div>
                    {!passageSaved && (
                        <button onClick={onSaveGroup} disabled={!passageReady || passageSaving}
                            className="w-full px-4 py-2.5 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {passageSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                            지문 그룹 저장 ({group.passages.length}장)
                        </button>
                    )}
                </div>
            )}

            {/* 지문 카드들 */}
            {group.passages.map((c, i) => (
                <BigImageCard
                    key={c.id} card={c} kind="passage"
                    badge={i === 0 ? '지문 메인' : `지문 단${i + 1}`}
                    onDelete={() => onDelete(c.id)}
                    onRetry={() => onRetry(c.id)}
                    onOcrChange={(t) => onOcrChange(c.id, t)}
                />
            ))}

            {/* 문제 카드들 */}
            {group.questions.map((c) => (
                <BigImageCard
                    key={c.id} card={c} kind="question" badge="문제"
                    questionMeta={questionMetas[c.id] || { tags: [] }}
                    canSaveQuestion={passageSaved || c.id === c.groupId}
                    grammarTree={grammarTree}
                    onDelete={() => onDelete(c.id)}
                    onRetry={() => onRetry(c.id)}
                    onOcrChange={(t) => onOcrChange(c.id, t)}
                    onMetaChange={(patch) => onQuestionMetaChange(c.id, patch)}
                    onSave={() => onSaveQuestion(c)}
                />
            ))}
        </div>
    );
}

// ─── BigImageCard (입력 모드 단일 카드) ────────────────────────────────
function BigImageCard({
    card, badge, kind,
    questionMeta, canSaveQuestion, grammarTree,
    onDelete, onRetry, onOcrChange, onMetaChange, onSave,
}: {
    card: QueueCard;
    badge: string;
    kind: 'passage' | 'question';
    questionMeta?: QuestionMeta;
    canSaveQuestion?: boolean;
    grammarTree?: GrammarTreeNode[];
    onDelete: () => void;
    onRetry: () => void;
    onOcrChange: (text: string) => void;
    onMetaChange?: (patch: Partial<QuestionMeta>) => void;
    onSave?: () => void;
}) {
    const saved = card.status === 'saved';
    const saving = card.status === 'saving';
    const isQuestion = kind === 'question';

    return (
        <div className={`border-t p-5 ${saved ? 'bg-emerald-50/40' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`text-sm font-bold ${isQuestion ? 'text-orange-800' : 'text-blue-800'}`}>
                    {saved && <CheckCircle2 className="inline mr-1 text-emerald-600" size={14} />}
                    {badge} · 페이지 {card.pageNum}
                    {saved && card.dbId && <span className="ml-2 text-emerald-700 font-normal text-xs">DB#{card.dbId}</span>}
                </div>
                <div className="flex items-center gap-1">
                    {card.status === 'error' && (
                        <button onClick={onRetry} className="p-1.5 rounded hover:bg-slate-100" title="재시도">
                            <RefreshCw size={13} />
                        </button>
                    )}
                    {!saved && (
                        <button onClick={onDelete} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600" title="삭제">
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                {/* 좌: 이미지 */}
                <div>
                    {card.previewUrl ? (
                        <img src={card.previewUrl} alt="crop"
                            className="w-full max-h-[60vh] object-contain bg-slate-50 rounded border" />
                    ) : (
                        <div className="text-sm text-red-500">미리보기 생성 실패</div>
                    )}
                </div>

                {/* 우: OCR + 메타 */}
                <div className="flex flex-col gap-3">
                    {card.status === 'uploading' && (
                        <div className="text-sm text-slate-500 flex items-center gap-2 p-3 border rounded bg-slate-50">
                            <Loader2 className="animate-spin" size={14} /> OCR 처리 중...
                        </div>
                    )}
                    {card.status === 'error' && (
                        <div className="text-sm text-red-600 p-3 border border-red-200 rounded bg-red-50">{card.error || '오류'}</div>
                    )}
                    {(card.status === 'ready' || saving || saved) && (
                        <>
                            <div className="flex flex-col flex-1">
                                <div className="text-xs font-semibold text-slate-500 mb-1">OCR 결과 (편집 가능)</div>
                                <textarea
                                    value={card.ocrText || ''}
                                    onChange={(e) => onOcrChange(e.target.value)}
                                    readOnly={saved}
                                    rows={isQuestion ? 8 : 14}
                                    className={`w-full text-sm border rounded p-3 font-mono resize-y focus:outline-none focus:border-teal-500 ${
                                        saved ? 'bg-slate-50 text-slate-600' : 'bg-white text-slate-900'
                                    }`}
                                    placeholder="OCR 결과"
                                />
                            </div>

                            {isQuestion && questionMeta && onMetaChange && onSave && (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <NumField label="번호" value={questionMeta.questionNo} onChange={(v) => onMetaChange({ questionNo: v })} disabled={saved} />
                                        <SelectField label="난이도" value={questionMeta.difficulty} onChange={(v) => onMetaChange({ difficulty: v })} options={DIFFS as any} disabled={saved} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-slate-500 mb-1">정답</div>
                                        <AnswerPicker value={questionMeta.answer} onChange={(v) => onMetaChange({ answer: v })} disabled={saved} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-slate-500 mb-1">문제 태그</div>
                                        <TagInput tags={questionMeta.tags} onChange={(t) => onMetaChange({ tags: t })} disabled={saved} />
                                    </div>
                                    <GrammarPickerInline
                                        tree={grammarTree || []}
                                        selectedIds={questionMeta.grammarCategoryIds || []}
                                        onChange={(ids) => onMetaChange({ grammarCategoryIds: ids })}
                                        disabled={saved}
                                    />
                                    {!saved && (
                                        <button onClick={onSave}
                                            disabled={card.status !== 'ready' || saving || !canSaveQuestion}
                                            title={!canSaveQuestion ? '지문 그룹을 먼저 저장하세요' : ''}
                                            className="w-full px-4 py-2 text-sm font-bold rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                            문제 저장
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Field primitives ──────────────────────────────────────────────────
function NumField({ label, value, onChange, disabled }: { label: string; value?: string; onChange: (v: string) => void; disabled?: boolean; }) {
    return (
        <label className="block">
            <div className="text-xs font-semibold text-slate-600 mb-1">{label}</div>
            <input type="number" value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}
                className={`w-full text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500 ${disabled ? 'bg-slate-50 text-slate-500' : 'bg-white text-slate-900'}`} />
        </label>
    );
}
function SelectField({ label, value, onChange, options, disabled }: { label: string; value?: string; onChange: (v: string) => void; options: readonly string[]; disabled?: boolean; }) {
    return (
        <label className="block">
            <div className="text-xs font-semibold text-slate-600 mb-1">{label}</div>
            <select value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}
                className={`w-full text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-teal-500 ${disabled ? 'bg-slate-50 text-slate-500' : 'bg-white text-slate-900'}`}>
                <option value="">-</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
        </label>
    );
}

function AnswerPicker({ value, onChange, disabled }: { value?: string; onChange: (v: string) => void; disabled?: boolean; }) {
    const ANSWERS = ['①', '②', '③', '④', '⑤'] as const;
    return (
        <div className="flex gap-1.5">
            {ANSWERS.map((a) => {
                const selected = value === a;
                return (
                    <button
                        key={a}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(selected ? '' : a)}
                        className={`flex-1 py-2 text-base font-bold border-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                            selected
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400 hover:bg-teal-50'
                        }`}
                    >
                        {a}
                    </button>
                );
            })}
        </div>
    );
}

// ─── GrammarPickerInline (문법 카테고리 다중 선택) ────────────────────
function GrammarPickerInline({
    tree, selectedIds, onChange, disabled,
}: {
    tree: GrammarTreeNode[];
    selectedIds: number[];
    onChange: (ids: number[]) => void;
    disabled?: boolean;
}) {
    const [enabled, setEnabled] = useState<boolean>(selectedIds.length > 0);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        // 외부에서 선택값이 채워지면 토글 자동 ON
        if (selectedIds.length > 0 && !enabled) setEnabled(true);
    }, [selectedIds.length, enabled]);

    const allLeafById = useMemo(() => {
        const map = new Map<number, { name: string; parentName: string }>();
        for (const root of tree) {
            for (const c of root.children || []) {
                map.set(c.id, { name: c.name, parentName: root.name });
            }
        }
        return map;
    }, [tree]);

    const toggle = (id: number) => {
        if (disabled) return;
        if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
        else onChange([...selectedIds, id]);
    };

    const handleEnabledChange = (next: boolean) => {
        setEnabled(next);
        if (!next) {
            onChange([]);
            setOpen(false);
        } else {
            setOpen(true);
        }
    };

    return (
        <div className="border-t pt-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={enabled}
                    disabled={disabled}
                    onChange={(e) => handleEnabledChange(e.target.checked)}
                    className="accent-purple-600"
                />
                문법(어법) 문제
                {enabled && (
                    <span className="text-[10px] font-medium text-slate-400">
                        {selectedIds.length > 0 ? `· ${selectedIds.length}개 선택` : '· 카테고리 미선택'}
                    </span>
                )}
            </label>

            {enabled && (
                <div className="mt-2">
                    {/* 선택된 칩들 */}
                    <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
                        {selectedIds.map((id) => {
                            const info = allLeafById.get(id);
                            if (!info) return null;
                            return (
                                <span key={id}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                                    {info.parentName} / {info.name}
                                    {!disabled && (
                                        <button onClick={() => toggle(id)} className="text-purple-600 hover:text-purple-900">×</button>
                                    )}
                                </span>
                            );
                        })}
                        {selectedIds.length === 0 && (
                            <span className="text-[11px] text-slate-400">아직 선택된 카테고리 없음</span>
                        )}
                    </div>

                    {!disabled && (
                        <button
                            type="button"
                            onClick={() => setOpen((v) => !v)}
                            className="text-xs px-2 py-1 rounded border border-purple-300 text-purple-700 hover:bg-purple-50 font-bold"
                        >
                            {open ? '카테고리 닫기' : '카테고리 선택'}
                        </button>
                    )}

                    {open && !disabled && (
                        <div className="mt-2 border rounded-lg p-3 bg-slate-50 max-h-64 overflow-y-auto">
                            {tree.length === 0 ? (
                                <div className="text-xs text-slate-400">카테고리가 없습니다. 관리자 페이지에서 추가하세요.</div>
                            ) : (
                                <div className="space-y-3">
                                    {tree.map((root) => (
                                        <div key={root.id}>
                                            <div className="text-[11px] font-black text-slate-700 mb-1">{root.name}</div>
                                            <div className="grid grid-cols-2 gap-1">
                                                {(root.children || []).map((c) => {
                                                    const checked = selectedIds.includes(c.id);
                                                    return (
                                                        <label key={c.id}
                                                            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer ${
                                                                checked ? 'bg-purple-100 text-purple-900 font-bold' : 'hover:bg-white text-slate-700'
                                                            }`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggle(c.id)}
                                                                className="accent-purple-600"
                                                            />
                                                            {c.name}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
