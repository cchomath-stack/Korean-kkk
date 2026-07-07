'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Save, Scissors, Type, Home, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddToCartButton } from '@/components/ExamCart';
import { QuestionImageEditor } from '@/components/QuestionImageEditor';

export default function AdminPage() {
    const [stage, setStage] = useState<'PASSAGE' | 'QUESTION'>('PASSAGE');
    const [savedPassageId, setSavedPassageId] = useState<number | null>(null);
    const [noPassage, setNoPassage] = useState(false);

    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [ocrResult, setOcrResult] = useState<{ imageUrl: string; ocrText: string } | null>(null);

    const [passageMetadata, setPassageMetadata] = useState({
        year: new Date().getFullYear(),
        month: 1,
        grade: 3,
        office: '평가원', // 교육청 / 평가원 / 사설
        startNo: '',
        endNo: '',
        expectedQuestions: 0,
    });

    const [questionMetadata, setQuestionMetadata] = useState({
        questionNo: '',
        keywords: [] as string[],
        answer: '',
        difficulty: '중',
    });

    const [tagInput, setTagInput] = useState('');
    const [gallery, setGallery] = useState<any[]>([]);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(1);
    const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);

    // 포커스 제어를 위한 Refs
    const qNoRef = useRef<HTMLInputElement>(null);
    const ansRef = useRef<HTMLInputElement>(null);
    const kwRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const insertSpecialChar = (char: string) => {
        if (!ocrResult || !textareaRef.current) return;
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = ocrResult.ocrText.substring(0, start) + char + ocrResult.ocrText.substring(end);
        setOcrResult({ ...ocrResult, ocrText: newText });
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + char.length, start + char.length);
        }, 0);
    };

    // 갤러리 상태 (무한스크롤 + 연도/영역/문법카테고리 필터)
    const [yearFilter, setYearFilter] = useState('');
    const [debouncedYear, setDebouncedYear] = useState('');
    const [areaFilter, setAreaFilter] = useState<string>(''); // '' | 문법 | 독서 | 문학 | 화작 | 언매
    const [gcFilter, setGcFilter] = useState<Set<number>>(new Set()); // 선택된 grammar category ids
    const [galleryCursor, setGalleryCursor] = useState<number | null>(null);
    const [galleryHasMore, setGalleryHasMore] = useState(false);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [grammarTree, setGrammarTree] = useState<any[]>([]);

    // 연도 필터 debounce
    useEffect(() => {
        const t = setTimeout(() => setDebouncedYear(yearFilter.trim()), 350);
        return () => clearTimeout(t);
    }, [yearFilter]);

    // 갤러리 로드 (커서 기반 — append, 또는 처음부터 다시)
    const fetchGalleryPage = useCallback(async (cursor: number | null, replace: boolean) => {
        setGalleryLoading(true);
        try {
            const params = new URLSearchParams();
            if (cursor) params.set('cursor', String(cursor));
            if (debouncedYear) params.set('year', debouncedYear);
            if (areaFilter) params.set('area', areaFilter);
            if (gcFilter.size > 0) params.set('categoryIds', [...gcFilter].join(','));
            const res = await fetch(`/api/admin/gallery?${params}`);
            if (!res.ok) return;
            const data = await res.json();
            setGallery((prev) => replace ? data.items : [...prev, ...data.items]);
            setGalleryCursor(data.nextCursor);
            setGalleryHasMore(data.hasMore);
        } catch (e) {
            console.error('Gallery fetch error', e);
        } finally {
            setGalleryLoading(false);
        }
    }, [debouncedYear, areaFilter, gcFilter]);

    // 필터 바뀌면 처음부터 다시 로드
    useEffect(() => {
        setGallery([]);
        setGalleryCursor(null);
        fetchGalleryPage(null, true);
    }, [debouncedYear, areaFilter, gcFilter, fetchGalleryPage]);

    // 문법 카테고리 트리 로드 (갤러리 카드의 문법 체크 모달용)
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/grammar/categories');
                if (res.ok) {
                    const data = await res.json();
                    setGrammarTree(data.tree || []);
                }
            } catch (e) { /* ignore */ }
        })();
    }, []);

    // 호환용 fetchGallery (저장 후 처음부터 reload)
    const fetchGallery = useCallback(() => {
        setGallery([]);
        setGalleryCursor(null);
        fetchGalleryPage(null, true);
    }, [fetchGalleryPage]);

    // 우측 슬라이드 수정 패널
    const [editPanelFor, setEditPanelFor] = useState<any | null>(null);
    const openEditPanel = (item: any) => setEditPanelFor(item);
    const closeEditPanel = () => setEditPanelFor(null);
    // 패널에서 저장 성공 시 갤러리 리스트의 해당 항목만 부분 갱신 (스크롤 유지)
    const updateGalleryItem = (updated: any) => {
        setGallery((prev) => prev.map((g) => g.id === updated.id ? { ...g, ...updated } : g));
        // 패널 내용도 동기화
        setEditPanelFor((cur: any) => cur && cur.id === updated.id ? { ...cur, ...updated } : cur);
    };

    // 갤러리 카드에서 문법 체크 모달 (단일)
    const [grammarModalFor, setGrammarModalFor] = useState<{ id: number; selected: number[] } | null>(null);
    const openGrammarModal = (item: any) => {
        const selected: number[] = (item.grammarCategories || []).map((g: any) => g.category?.id ?? g.categoryId);
        setGrammarModalFor({ id: item.id, selected });
    };
    const saveGrammarSelection = async (questionId: number, categoryIds: number[]) => {
        try {
            const res = await fetch('/api/admin/question', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: questionId, grammarCategoryIds: categoryIds }),
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                alert('저장 실패: ' + (e.error || res.status));
                return;
            }
            setGrammarModalFor(null);
            fetchGallery();
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        }
    };

    // ─── 일괄 선택 상태 ──────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [lastClickedId, setLastClickedId] = useState<number | null>(null);
    const [bulkGrammarOpen, setBulkGrammarOpen] = useState(false);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

    // 연도 필터 바뀌면 선택 자동 해제
    useEffect(() => {
        setSelectedIds(new Set());
        setLastClickedId(null);
    }, [debouncedYear]);

    // 카드 클릭 토글 (Shift = 범위 선택)
    const toggleSelect = useCallback((id: number, shift: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (shift && lastClickedId != null && gallery.length > 0) {
                // 범위 선택
                const ids = gallery.map((g) => g.id);
                const a = ids.indexOf(lastClickedId);
                const b = ids.indexOf(id);
                if (a >= 0 && b >= 0) {
                    const [lo, hi] = a < b ? [a, b] : [b, a];
                    const shouldAdd = !next.has(id);
                    for (let i = lo; i <= hi; i++) {
                        if (shouldAdd) next.add(ids[i]);
                        else next.delete(ids[i]);
                    }
                }
            } else {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            }
            return next;
        });
        setLastClickedId(id);
    }, [lastClickedId, gallery]);

    // 키보드 단축키: Ctrl+A 전체선택, Esc 해제
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                setSelectedIds(new Set(gallery.map((g) => g.id)));
            } else if (e.key === 'Escape') {
                if (bulkGrammarOpen || bulkDeleteOpen || grammarModalFor) return; // 모달은 ESC 처리 양보
                setSelectedIds(new Set());
                setLastClickedId(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [gallery, bulkGrammarOpen, bulkDeleteOpen, grammarModalFor]);

    // 일괄: 문법 추가 (merge)
    const bulkAssignGrammar = async (categoryIds: number[]) => {
        if (selectedIds.size === 0 || categoryIds.length === 0) return;
        try {
            const res = await fetch('/api/admin/question/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionIds: [...selectedIds], categoryIds }),
            });
            const data = await res.json();
            if (!res.ok) { alert('일괄 처리 실패: ' + (data.error || res.status)); return; }
            alert(`${data.questionsAffected}개 문항에 ${data.categoriesAssigned}개 카테고리 적용 완료\n(신규 ${data.newConnections}건, 기존 ${data.alreadyExisted}건)`);
            setBulkGrammarOpen(false);
            setSelectedIds(new Set());
            fetchGallery();
        } catch (e: any) {
            alert('실패: ' + e.message);
        }
    };

    // 드래그 안내 띠 (영구 dismiss)
    const DRAG_HINT_KEY = 'oreum-drag-hint-dismissed';
    const [showDragHint, setShowDragHint] = useState(false);
    useEffect(() => {
        try {
            if (!localStorage.getItem(DRAG_HINT_KEY)) setShowDragHint(true);
        } catch { /* SSR / disabled */ }
    }, []);
    const dismissDragHint = () => {
        setShowDragHint(false);
        try { localStorage.setItem(DRAG_HINT_KEY, '1'); } catch { /* ignore */ }
    };

    // ─── 드래그 선택 ─────────────────────────────────
    // 갤러리 섹션(그리드 좌/우 여백 포함) 어디서든 드래그 시작 가능.
    // 단 버튼/체크박스/입력 등 인터랙티브 요소 위에서는 제외.
    // 5px 이상 움직여야 드래그 모드 진입 (그냥 클릭은 기존 동작 유지).
    const sectionRef = useRef<HTMLElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<{
        startX: number; startY: number;
        mode: 'replace' | 'add' | 'toggle';
        baseline: Set<number>;
        thresholdMet: boolean;
    } | null>(null);
    const [dragRect, setDragRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    const DRAG_THRESHOLD = 5;

    const handleSectionMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const t = e.target as HTMLElement;
        if (t.closest('button, input, a, textarea, [data-no-drag]')) return;
        const sec = sectionRef.current;
        if (!sec) return;
        const rect = sec.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
        const mode: 'replace' | 'add' | 'toggle' = e.shiftKey ? 'add' : (e.ctrlKey || e.metaKey) ? 'toggle' : 'replace';
        dragStateRef.current = { startX, startY, mode, baseline: new Set(selectedIds), thresholdMet: false };
    };

    // 글로벌 mouse 이벤트 — 항상 등록 (dragStateRef 체크로 처리 분기)
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const sec = sectionRef.current;
            const st = dragStateRef.current;
            if (!sec || !st) return;
            const rect = sec.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (!st.thresholdMet) {
                const dx = Math.abs(x - st.startX);
                const dy = Math.abs(y - st.startY);
                if (dx + dy < DRAG_THRESHOLD) return;
                st.thresholdMet = true;
            }
            const x1 = Math.min(st.startX, x);
            const y1 = Math.min(st.startY, y);
            const x2 = Math.max(st.startX, x);
            const y2 = Math.max(st.startY, y);
            setDragRect({ x1, y1, x2, y2 });

            // 교차 카드 ID (섹션 좌표 기준)
            const inRect = new Set<number>();
            const cards = sec.querySelectorAll('[data-card-id]');
            cards.forEach((cd) => {
                const r = (cd as HTMLElement).getBoundingClientRect();
                const cx1 = r.left - rect.left;
                const cy1 = r.top - rect.top;
                const cx2 = r.right - rect.left;
                const cy2 = r.bottom - rect.top;
                if (cx1 < x2 && cx2 > x1 && cy1 < y2 && cy2 > y1) {
                    const id = parseInt(cd.getAttribute('data-card-id') || '', 10);
                    if (!Number.isNaN(id)) inRect.add(id);
                }
            });

            let next: Set<number>;
            if (st.mode === 'replace') {
                next = inRect;
            } else if (st.mode === 'add') {
                next = new Set([...st.baseline, ...inRect]);
            } else {
                next = new Set(st.baseline);
                for (const id of inRect) {
                    if (st.baseline.has(id)) next.delete(id);
                    else next.add(id);
                }
            }
            setSelectedIds(next);
        };
        const onUp = () => {
            dragStateRef.current = null;
            setDragRect(null);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    // 일괄: 삭제
    const bulkDelete = async () => {
        if (selectedIds.size === 0) return;
        try {
            const res = await fetch('/api/admin/question/bulk', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionIds: [...selectedIds] }),
            });
            const data = await res.json();
            if (!res.ok) { alert('일괄 삭제 실패: ' + (data.error || res.status)); return; }
            alert(`${data.deleted}개 문항 삭제 완료`);
            setBulkDeleteOpen(false);
            setSelectedIds(new Set());
            fetchGallery();
        } catch (e: any) {
            alert('실패: ' + e.message);
        }
    };

    // 문항 수 자동 계산
    useEffect(() => {
        const start = parseInt(passageMetadata.startNo);
        const end = parseInt(passageMetadata.endNo);
        if (!isNaN(start) && !isNaN(end) && end >= start) {
            setPassageMetadata(prev => ({ ...prev, expectedQuestions: end - start + 1 }));
        }
    }, [passageMetadata.startNo, passageMetadata.endNo]);

    const handleKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
        }
    };

    const handleFinalKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            addTag();
        }
    };

    const handleBack = () => {
        if (stage === 'QUESTION') {
            if (currentQuestionIdx > 1) {
                setCurrentQuestionIdx(prev => prev - 1);
            } else {
                setStage('PASSAGE');
            }
        }
    };

    const addTag = () => {
        if (!tagInput.trim()) return;
        const newTag = tagInput.trim().startsWith('#') ? tagInput.trim() : `#${tagInput.trim()}`;
        if (!questionMetadata.keywords.includes(newTag)) {
            setQuestionMetadata(prev => ({
                ...prev,
                keywords: [...prev.keywords, newTag]
            }));
        }
        setTagInput('');
    };

    const removeTag = (tagToRemove: string) => {
        setQuestionMetadata(prev => ({
            ...prev,
            keywords: prev.keywords.filter(t => t !== tagToRemove)
        }));
    };

    const moveToQuestion = (idx: number) => {
        if (idx < 1 || idx > passageMetadata.expectedQuestions) return;

        setCurrentQuestionIdx(idx);
        const startNo = parseInt(passageMetadata.startNo);
        const targetQNo = !isNaN(startNo) ? (startNo + idx - 1) : null;

        // 해당 번호의 문항이 갤러리에 있는지 확인 (수정 모드 전환)
        const existing = gallery.find(item =>
            item.passageId === savedPassageId &&
            item.questionNo === targetQNo
        );

        if (existing) {
            setEditingQuestionId(existing.id);
            setOcrResult({ imageUrl: existing.imageUrl, ocrText: existing.ocrText || '' });
            setQuestionMetadata({
                questionNo: existing.questionNo.toString(),
                keywords: existing.keywords ? existing.keywords.split(',') : [],
                answer: existing.answer || '',
                difficulty: existing.difficulty || '중'
            });
        } else {
            setEditingQuestionId(null);
            setOcrResult(null);
            setQuestionMetadata({
                questionNo: targetQNo?.toString() || '',
                keywords: [],
                answer: '',
                difficulty: '중'
            });
        }
    };

    const autoUpload = async (targetFile: File) => {
        setLoading(true);
        setOcrProgress(0);
        const formData = new FormData();
        formData.append('file', targetFile);

        try {
            const uploadRes = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
            });

            const uploadData = await uploadRes.json();
            const ocrText = uploadData.ocrText || '';

            if (uploadRes.ok) {
                setOcrResult({ imageUrl: uploadData.imageUrl, ocrText });
                if (stage === 'QUESTION' && !questionMetadata.questionNo) {
                    const baseNo = parseInt(passageMetadata.startNo);
                    if (!isNaN(baseNo)) {
                        setQuestionMetadata(prev => ({ ...prev, questionNo: (baseNo + currentQuestionIdx - 1).toString() }));
                    }
                }
            } else {
                alert(uploadData.error || '업로드 실패');
            }
        } catch (error) {
            console.error('Upload/OCR Error:', error);
            alert('처리 도중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
            setOcrProgress(0);
        }
    };

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const pastedFile = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
                        setFile(pastedFile);
                        autoUpload(pastedFile);
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [stage, currentQuestionIdx, passageMetadata.startNo]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        await autoUpload(file);
    };

    const handleNoPassage = () => {
        if (noPassage) {
            setNoPassage(false);
            setOcrResult(null);
        } else {
            setNoPassage(true);
            setSavedPassageId(null);
            setStage('PASSAGE');
            // 세부 문항 정보를 입력하기 위한 지문(컨테이너) 정보를 먼저 입력받는 상태로 유도
            setOcrResult({ imageUrl: '', ocrText: '(지문 없음)' });
        }
    };

    const handleSavePassage = async () => {
        if (!ocrResult) return;

        setLoading(true);
        try {
            const isEditing = savedPassageId !== null;
            const range = `${passageMetadata.startNo}~${passageMetadata.endNo}`;
            const response = await fetch('/api/admin/passage', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: savedPassageId, // PUT일 때 필요
                    imageUrl: ocrResult.imageUrl || null,
                    ocrText: ocrResult.ocrText,
                    ...passageMetadata,
                    questionRange: range,
                    source: '기타'
                }),
            });

            if (response.ok) {
                const passage = await response.json();
                setSavedPassageId(passage.id);
                setStage('QUESTION');
                // 만약 현재 번호가 없으면 1번으로, 있으면 유지 (수정 시 배려)
                if (!questionMetadata.questionNo) {
                    moveToQuestion(1);
                }
                fetchGallery();
                alert(`시험 정보 ${isEditing ? '수정' : '저장'} 완료!`);
            } else {
                const data = await response.json();
                alert(`${data.error || '저장 실패'}\n\n상세: ${data.details || '알 수 없는 오류'}`);
            }
        } catch (error: any) {
            console.error('Save Error:', error);
            alert(`저장 도중 오류가 발생했습니다.\n\n오류: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuestion = async () => {
        if (!ocrResult) return;
        if (stage === 'QUESTION' && !noPassage && !savedPassageId) {
            alert('지문 정보가 없습니다.');
            return;
        }

        setLoading(true);
        try {
            const isEditing = editingQuestionId !== null;
            const url = isEditing ? '/api/admin/question' : '/api/admin/question';
            const method = isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingQuestionId, // PUT일 때 필요
                    passageId: savedPassageId,
                    imageUrl: ocrResult.imageUrl,
                    ocrText: ocrResult.ocrText,
                    ...questionMetadata,
                    keywords: questionMetadata.keywords.join(','),
                }),
            });

            if (response.ok) {
                alert(`${currentQuestionIdx}번 문항 ${isEditing ? '수정' : '저장'} 성공!`);
                fetchGallery();

                if (currentQuestionIdx < passageMetadata.expectedQuestions) {
                    moveToQuestion(currentQuestionIdx + 1);
                } else {
                    alert('축하합니다! 모든 문항 입력이 완료되었습니다.');
                    resetForm();
                }
            } else {
                const data = await response.json();
                alert(`${data.error || '저장 실패'}\n\n상세: ${data.details || '알 수 없는 오류'}`);
            }
        } catch (error: any) {
            console.error('Save Question Error:', error);
            alert('저장 도중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteQuestion = async (id: number) => {
        if (!confirm('문항을 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/question?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('문항이 삭제되었습니다.');
                fetchGallery();
            }
        } catch (e) {
            alert('삭제 실패');
        }
    };

    const handleDeletePassage = async (id: number) => {
        if (!confirm('지문을 삭제하시겠습니까? 관련 모든 문항이 함께 삭제됩니다.')) return;
        try {
            const res = await fetch(`/api/admin/passage?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('지문과 관련 문항이 삭제되었습니다.');
                fetchGallery();
            }
        } catch (e) {
            alert('삭제 실패');
        }
    };

    const handleResumePassage = (item: any) => {
        const p = item.passage;
        if (!p) {
            alert('이어서 입력할 수 없는 문항입니다.');
            return;
        }

        setSavedPassageId(p.id);
        const isNoPassage = !p.imageUrl && p.ocrText === '(지문 없음)';
        setNoPassage(isNoPassage);
        setStage('QUESTION');
        setPassageMetadata({
            year: p.year,
            month: p.month,
            grade: p.grade,
            office: p.office || '평가원',
            startNo: p.startNo || '',
            endNo: p.endNo || '',
            expectedQuestions: p.expectedQuestions || 0,
        });

        // 클릭한 문항의 인덱스로 즉시 이동
        const startNo = parseInt(p.startNo || '0');
        const qNo = item.questionNo;
        const targetIdx = (!isNaN(startNo) && qNo >= startNo) ? (qNo - startNo + 1) : 1;

        setCurrentQuestionIdx(targetIdx);
        setEditingQuestionId(item.id);
        setOcrResult({ imageUrl: item.imageUrl, ocrText: item.ocrText || '' });
        setQuestionMetadata({
            questionNo: item.questionNo.toString(),
            keywords: item.keywords ? item.keywords.split(',') : [],
            answer: item.answer || '',
            difficulty: item.difficulty || '중'
        });
    };

    const resetForm = () => {
        setStage('PASSAGE');
        setSavedPassageId(null);
        setEditingQuestionId(null);
        setNoPassage(false);
        setOcrResult(null);
        setFile(null);
        setCurrentQuestionIdx(1);
        setPassageMetadata(prev => ({
            ...prev,
            startNo: '',
            endNo: '',
            expectedQuestions: 0
        }));
        setQuestionMetadata({
            questionNo: '',
            keywords: [],
            answer: '',
            difficulty: '중',
        });
        setTagInput('');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 leading-tight">Admin Dashboard</h1>
                        <p className="text-slate-600 font-medium">
                            {stage === 'PASSAGE' ? (noPassage ? '단독 문제 정보 입력' : '지문 입력 단계') : `문제 입력 단계 (${currentQuestionIdx} / ${passageMetadata.expectedQuestions})`}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/"
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Home className="w-4 h-4" />
                            메인으로
                        </Link>
                        <button
                            onClick={resetForm}
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition-colors shadow-sm"
                        >
                            새로 고침
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 업로드 섹션 */}
                    <section className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                <Upload className="w-5 h-5 text-teal-500" />
                                {stage === 'PASSAGE' ? (noPassage ? '문제 이미지' : '지문 이미지') : `문제 이미지`}
                            </h2>
                            {stage === 'PASSAGE' && (
                                <button
                                    onClick={handleNoPassage}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                        noPassage ? "bg-teal-600 text-white" : "bg-teal-50 text-teal-600 hover:bg-teal-100"
                                    )}
                                >
                                    <Scissors className="w-4 h-4" />
                                    {noPassage ? '단독 문제 모드' : '지문 없이 문제만 등록'}
                                </button>
                            )}
                        </div>

                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative group">
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                                accept="image/*"
                            />
                            <FileText className="w-12 h-12 text-slate-300 mb-3 group-hover:text-teal-400 transition-colors" />
                            <p className="text-sm text-slate-700 text-center font-bold">
                                {file ? file.name : (noPassage || stage === 'QUESTION' ? '문제 이미지 파일을 선택하거나' : '지문 이미지 파일을 선택하거나')}
                            </p>
                            <p className="text-[10px] text-slate-500 font-bold mt-1">
                                이미지를 복사(Ctrl+C) 후 여기에 붙여넣기(Ctrl+V) 하세요.
                            </p>
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={!file || loading}
                            className={cn(
                                "w-full mt-6 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-all",
                                file && !loading ? "bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-100" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                            {loading ? (ocrProgress > 0 ? `읽는 중... (${ocrProgress}%)` : '준비 중...') : 'OCR 추출 시작'}
                        </button>
                    </section>

                    {/* OCR 결과 및 메타데이터 */}
                    <section className="lg:col-span-2 space-y-8">
                        {ocrResult ? (
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                        {noPassage ? '단독 문제 정보 입력' : (stage === 'PASSAGE' ? '지문 검토' : '문제 검토')}
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        {stage === 'QUESTION' && (
                                            <div className="flex gap-2 mr-4 bg-slate-100 p-1 rounded-lg">
                                                <button
                                                    onClick={() => moveToQuestion(currentQuestionIdx - 1)}
                                                    disabled={currentQuestionIdx <= 1}
                                                    className="px-3 py-1.5 text-xs font-bold bg-white text-slate-700 rounded-md shadow-sm disabled:opacity-50"
                                                >
                                                    이전 문항
                                                </button>
                                                <button
                                                    onClick={() => moveToQuestion(currentQuestionIdx + 1)}
                                                    disabled={currentQuestionIdx >= passageMetadata.expectedQuestions}
                                                    className="px-3 py-1.5 text-xs font-bold bg-white text-slate-700 rounded-md shadow-sm disabled:opacity-50"
                                                >
                                                    다음 문항
                                                </button>
                                                <button
                                                    onClick={() => setStage('PASSAGE')}
                                                    className="px-3 py-1.5 text-xs font-bold bg-teal-50 text-teal-600 rounded-md border border-teal-100"
                                                >
                                                    시험지 정보 수정
                                                </button>
                                            </div>
                                        )}
                                        <button
                                            onClick={stage === 'PASSAGE' ? handleSavePassage : handleSaveQuestion}
                                            disabled={loading}
                                            className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-lg shadow-green-100"
                                        >
                                            <Save className="w-4 h-4" />
                                            {stage === 'PASSAGE'
                                                ? (noPassage ? '시험 정보 저장 후 다음' : '지문 저장 후 다음')
                                                : (editingQuestionId ? '수정 내용 저장' : (currentQuestionIdx < passageMetadata.expectedQuestions ? '저장 후 다음 문항' : '모든 문제 저장 완료'))
                                            }
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center text-slate-400 text-sm font-bold">
                                        {ocrResult.imageUrl ? (
                                            <img src={ocrResult.imageUrl} alt="OCR result" className="w-full h-full object-contain" />
                                        ) : (
                                            '(지문 없음)'
                                        )}
                                    </div>
                                    <div className="flex flex-col h-full">
                                        <div className="flex flex-col gap-2 mb-3">
                                            <label className="text-sm font-bold text-slate-700">OCR 텍스트 (교정 가능)</label>
                                            <div className="flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-lg w-fit">
                                                {['㉠','㉡','㉢','㉣','㉤','①','②','③','④','⑤','<보기>'].map(char => (
                                                    <button
                                                        key={char}
                                                        onClick={() => insertSpecialChar(char)}
                                                        className="px-2 py-1 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 text-xs font-bold rounded border border-slate-200"
                                                    >
                                                        {char}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <textarea
                                            ref={textareaRef}
                                            value={ocrResult.ocrText}
                                            onChange={(e) => setOcrResult({ ...ocrResult, ocrText: e.target.value })}
                                            className="flex-grow p-4 bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none font-mono font-medium leading-relaxed"
                                        />
                                    </div>
                                </div>

                                {stage === 'PASSAGE' ? (
                                    <div className="space-y-6 pt-6 border-t border-slate-200">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-800 uppercase block mb-1 tracking-tighter">시행처</label>
                                                <select
                                                    value={passageMetadata.office}
                                                    onChange={(e) => setPassageMetadata({ ...passageMetadata, office: e.target.value })}
                                                    className="w-full p-2 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg text-sm"
                                                >
                                                    <option value="평가원">평가원</option>
                                                    <option value="교육청">교육청</option>
                                                    <option value="사설">사설</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-800 uppercase block mb-1 tracking-tighter">학년</label>
                                                <select
                                                    value={passageMetadata.grade}
                                                    onChange={(e) => setPassageMetadata({ ...passageMetadata, grade: parseInt(e.target.value) })}
                                                    className="w-full p-2 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg text-sm"
                                                >
                                                    <option value={3}>3학년</option>
                                                    <option value={2}>2학년</option>
                                                    <option value={1}>1학년</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-800 uppercase block mb-1 tracking-tighter">시행년도</label>
                                                <input
                                                    type="number"
                                                    value={passageMetadata.year}
                                                    onChange={(e) => setPassageMetadata({ ...passageMetadata, year: parseInt(e.target.value) })}
                                                    className="w-full p-2 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-800 uppercase block mb-1 tracking-tighter">시행월</label>
                                                <select
                                                    value={passageMetadata.month}
                                                    onChange={(e) => setPassageMetadata({ ...passageMetadata, month: parseInt(e.target.value) })}
                                                    className="w-full p-2 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg text-sm"
                                                >
                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m}>{m}월</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-800 uppercase block mb-1 tracking-tighter">시작 문항</label>
                                                <input
                                                    type="number"
                                                    placeholder="31"
                                                    value={passageMetadata.startNo}
                                                    onChange={(e) => setPassageMetadata({ ...passageMetadata, startNo: e.target.value })}
                                                    className="w-full p-2 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-800 uppercase block mb-1 tracking-tighter">끝 문항</label>
                                                <input
                                                    type="number"
                                                    placeholder="34"
                                                    value={passageMetadata.endNo}
                                                    onChange={(e) => setPassageMetadata({ ...passageMetadata, endNo: e.target.value })}
                                                    className="w-full p-2 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg text-sm"
                                                />
                                            </div>
                                            <div className="bg-teal-50 p-2 rounded-lg border border-teal-100 flex flex-col items-center justify-center">
                                                <label className="text-[10px] font-black text-teal-600 uppercase mb-1 tracking-tighter">자동 문항 수</label>
                                                <span className="text-teal-700 font-black text-sm">{passageMetadata.expectedQuestions}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 pt-6 border-t border-slate-200">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-800 uppercase block mb-1">문항 번호</label>
                                                <input
                                                    ref={qNoRef}
                                                    type="number"
                                                    value={questionMetadata.questionNo}
                                                    onChange={(e) => setQuestionMetadata({ ...questionMetadata, questionNo: e.target.value })}
                                                    onKeyDown={(e) => handleKeyDown(e, ansRef)}
                                                    className="w-full p-2 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-800 uppercase block mb-1">정답</label>
                                                <input
                                                    ref={ansRef}
                                                    type="text"
                                                    value={questionMetadata.answer}
                                                    onChange={(e) => setQuestionMetadata({ ...questionMetadata, answer: e.target.value })}
                                                    onKeyDown={(e) => handleKeyDown(e, kwRef)}
                                                    className="w-full p-2 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-800 uppercase block mb-1">난도</label>
                                                <select
                                                    value={questionMetadata.difficulty}
                                                    onChange={(e) => setQuestionMetadata({ ...questionMetadata, difficulty: e.target.value })}
                                                    className="w-full p-2 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg text-sm"
                                                >
                                                    <option value="상">상</option>
                                                    <option value="중">중</option>
                                                    <option value="하">하</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100">
                                            <label className="text-[10px] font-black text-teal-600 uppercase block mb-2">해시태그 (엔터 시 추가)</label>
                                            <input
                                                ref={kwRef}
                                                type="text"
                                                placeholder="예: #비문학 #법학"
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onKeyDown={handleFinalKeyDown}
                                                className="w-full p-3 bg-white border border-teal-200 text-teal-800 font-bold rounded-lg text-sm outline-none shadow-inner"
                                            />
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {questionMetadata.keywords.map(tag => (
                                                    <span key={tag} className="px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-xs font-bold flex items-center gap-1.5 border border-slate-300">
                                                        {tag}
                                                        <button onClick={() => removeTag(tag)} className="text-slate-400 hover:text-red-500">&times;</button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                                <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
                                <p className="text-slate-500 font-bold">
                                    {stage === 'PASSAGE' ? (noPassage ? '문항 이미지를 업로드하거나 붙여넣으세요.' : '지문 이미지를 업로드하거나 붙여넣으세요.') : `문제 이미지를 업로드하거나 붙여넣으세요.`}
                                </p>
                            </div>
                        )}
                    </section>
                </div>

                {/* 갤러리 섹션 */}
                <section
                    ref={sectionRef}
                    onMouseDown={handleSectionMouseDown}
                    className="mt-16 border-t border-slate-200 pt-10 relative cursor-crosshair select-none px-2 -mx-2"
                >
                    <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                        <Scissors className="w-6 h-6 text-teal-500" />
                        최근 등록 문항 갤러리
                    </h2>

                    {/* 필터: 연도 + 영역 + (문법일 때) 문법 카테고리 */}
                    <div className="mb-4 bg-white p-3 rounded-xl border border-slate-200 space-y-3">
                        {/* 연도 + 영역 한 줄 */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">연도</span>
                            <input
                                type="number"
                                value={yearFilter}
                                onChange={(e) => setYearFilter(e.target.value)}
                                placeholder="예: 2025 (비우면 전체)"
                                className="w-40 text-sm px-2 py-1.5 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-teal-500"
                            />
                            {yearFilter && (
                                <button onClick={() => setYearFilter('')} className="text-xs font-bold text-slate-400 hover:text-slate-700">×</button>
                            )}

                            <div className="w-px h-6 bg-slate-200" />

                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">영역</span>
                            {(['', '문법', '독서', '문학', '화작', '언매'] as const).map(a => (
                                <button
                                    key={a || 'all'}
                                    onClick={() => { setAreaFilter(a); if (a !== '문법' && a !== '언매') setGcFilter(new Set()); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                                        areaFilter === a
                                            ? 'bg-teal-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {a || '전체'}
                                </button>
                            ))}
                        </div>

                        {/* 문법(또는 언매) 선택 시 문법 카테고리 체크박스 */}
                        {(areaFilter === '문법' || areaFilter === '언매') && grammarTree.length > 0 && (
                            <div className="border-t border-slate-100 pt-3">
                                <div className="text-xs font-black text-purple-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    문법 카테고리 <span className="font-medium text-slate-400">(체크한 것만 표시 · 여러 개 OR)</span>
                                    {gcFilter.size > 0 && (
                                        <button
                                            onClick={() => setGcFilter(new Set())}
                                            className="ml-auto text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-2 py-0.5 rounded"
                                        >
                                            전체 해제
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {grammarTree.map((root: any) => (
                                        <div key={root.id}>
                                            <div className="text-[11px] font-black text-slate-600 mb-1">{root.name}</div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                                                {(root.children || []).map((c: any) => {
                                                    const checked = gcFilter.has(c.id);
                                                    return (
                                                        <label key={c.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer ${
                                                            checked ? 'bg-purple-100 text-purple-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
                                                        }`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => setGcFilter(prev => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(c.id)) next.delete(c.id);
                                                                    else next.add(c.id);
                                                                    return next;
                                                                })}
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
                            </div>
                        )}
                    </div>

                    {/* 드래그 선택 안내 띠 (첫 진입 시 1회) */}
                    {showDragHint && selectedIds.size === 0 && (
                        <div className="mb-3 bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-center gap-2 text-sm">
                            <span className="text-base">💡</span>
                            <span className="text-teal-900">
                                <b>팁:</b> 카드 사이 빈 영역을 마우스로 <b>드래그</b>하면 여러 카드를 한 번에 선택할 수 있어요. (Shift/Ctrl 조합 가능)
                            </span>
                            <button onClick={dismissDragHint} className="ml-auto text-xs font-bold text-teal-700 hover:text-teal-900 px-2 py-0.5 rounded hover:bg-teal-100">
                                알겠어요 ×
                            </button>
                        </div>
                    )}

                    {/* 일괄 액션바 (sticky, 선택 있을 때만 표시) */}
                    {selectedIds.size > 0 && (
                        <div className="sticky top-2 z-30 mb-4 bg-slate-900 text-white rounded-xl shadow-lg p-3 flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-bold pl-2">
                                {selectedIds.size}개 선택됨
                            </span>
                            <span className="text-[10px] text-slate-400">
                                빈 영역 드래그 · Ctrl+A 전체 · Shift+클릭 범위 · Esc 해제
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                                <button onClick={() => setSelectedIds(new Set(gallery.map((g) => g.id)))}
                                    className="px-3 py-1.5 text-xs font-bold rounded bg-slate-700 hover:bg-slate-600">
                                    현재 보이는 {gallery.length}개 모두
                                </button>
                                <button onClick={() => { setSelectedIds(new Set()); setLastClickedId(null); }}
                                    className="px-3 py-1.5 text-xs font-bold rounded bg-slate-700 hover:bg-slate-600">
                                    해제
                                </button>
                                <div className="w-px h-5 bg-slate-700" />
                                <button onClick={() => setBulkGrammarOpen(true)}
                                    className="px-3 py-1.5 text-xs font-bold rounded bg-purple-600 hover:bg-purple-700 flex items-center gap-1">
                                    문법 카테고리 추가
                                </button>
                                <button onClick={() => setBulkDeleteOpen(true)}
                                    className="px-3 py-1.5 text-xs font-bold rounded bg-red-600 hover:bg-red-700 flex items-center gap-1">
                                    일괄 삭제
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 드래그 사각형 오버레이 — 섹션 전체 영역 (그리드 좌/우 여백 포함) */}
                    {dragRect && (
                        <div
                            className="absolute pointer-events-none border-2 border-teal-500 bg-teal-500/15 rounded"
                            style={{
                                left: dragRect.x1,
                                top: dragRect.y1,
                                width: dragRect.x2 - dragRect.x1,
                                height: dragRect.y2 - dragRect.y1,
                                zIndex: 20,
                            }}
                        />
                    )}

                    <div
                        ref={gridRef}
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                        style={{ minHeight: '200px' }}
                    >
                        {gallery.map((item) => {
                            // 새 tags 관계 우선, 없으면 legacy keywords CSV fallback
                            const tagNames: string[] = (item.tags && item.tags.length > 0)
                                ? item.tags.map((qt: any) => qt.tag.name)
                                : (item.keywords ? item.keywords.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
                            const grammarCats: any[] = item.grammarCategories || [];
                            const isSelected = selectedIds.has(item.id);
                            return (
                                <div key={item.id}
                                    data-card-id={item.id}
                                    className={`bg-white rounded-xl shadow-md border-2 overflow-hidden group transition-all cursor-crosshair ${
                                        isSelected ? 'border-teal-500 ring-2 ring-teal-300' : 'border-slate-100 hover:ring-2 hover:ring-teal-500'
                                    }`}>
                                    <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden">
                                        {/* 선택 체크박스 (좌상단, 항상 노출) */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleSelect(item.id, e.shiftKey); }}
                                            className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center text-xs font-black shadow-sm transition ${
                                                isSelected
                                                    ? 'bg-teal-600 border-teal-700 text-white'
                                                    : 'bg-white/90 border-slate-300 text-transparent hover:border-teal-500 hover:text-teal-500'
                                            }`}
                                            title={isSelected ? '선택 해제' : '선택 (Shift+클릭으로 범위)'}
                                        >
                                            ✓
                                        </button>
                                        <img src={item.imageUrl} alt="Question" className="w-full h-full object-contain p-2" />
                                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-md text-white text-xs font-black rounded shadow-lg">
                                            {item.questionNo}번
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 flex-wrap p-2">
                                            <button onClick={() => openEditPanel(item)} className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold text-xs">수정</button>
                                            <button onClick={() => openGrammarModal(item)} className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-xs">문법</button>
                                            <button onClick={() => handleDeleteQuestion(item.id)} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-xs">삭제</button>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <AddToCartButton kind="question" questionId={item.id} passageId={item.passageId ?? undefined} hasPassageQuestions={!!item.passageId} compact />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex gap-1 flex-wrap mb-2 min-h-[20px]">
                                            {tagNames.map((name) => (
                                                <span key={name} className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold border border-teal-100">#{name}</span>
                                            ))}
                                        </div>
                                        {grammarCats.length > 0 && (
                                            <div className="flex gap-1 flex-wrap mb-2">
                                                {grammarCats.map((gc: any) => (
                                                    <span key={gc.category.id} className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold border border-purple-200">
                                                        {gc.category.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{(item.passage?.year ?? item.year) || ''} {(item.passage?.month ?? item.month) ? `${item.passage?.month ?? item.month}월` : ''}</p>
                                                <p className="text-[11px] text-slate-500 font-bold">{(item.passage?.area ?? item.area) || item.passage?.office || ''} {(item.passage?.grade ?? item.grade) ? `| ${item.passage?.grade ?? item.grade}학년` : ''}</p>
                                            </div>
                                            <button onClick={() => handleDeletePassage(item.passageId)} className="text-[10px] text-red-300 hover:text-red-500 underline">삭제</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 무한스크롤 sentinel + 상태 표시 */}
                    <InfiniteScrollSentinel
                        hasMore={galleryHasMore}
                        loading={galleryLoading}
                        cursor={galleryCursor}
                        onIntersect={(c) => fetchGalleryPage(c, false)}
                    />
                </section>
            </div>

            {/* 단일 문법 카테고리 선택 모달 */}
            {grammarModalFor && (
                <GrammarModal
                    tree={grammarTree}
                    initialSelected={grammarModalFor.selected}
                    onClose={() => setGrammarModalFor(null)}
                    onSave={(ids) => saveGrammarSelection(grammarModalFor.id, ids)}
                />
            )}

            {/* 일괄 문법 추가 모달 */}
            {bulkGrammarOpen && (
                <BulkGrammarModal
                    tree={grammarTree}
                    selectedItems={gallery.filter((g) => selectedIds.has(g.id))}
                    onClose={() => setBulkGrammarOpen(false)}
                    onSave={(ids) => bulkAssignGrammar(ids)}
                />
            )}

            {/* 일괄 삭제 확인 모달 */}
            {bulkDeleteOpen && (
                <BulkDeleteConfirmModal
                    selectedItems={gallery.filter((g) => selectedIds.has(g.id))}
                    onClose={() => setBulkDeleteOpen(false)}
                    onConfirm={bulkDelete}
                />
            )}

            {/* 우측 슬라이드 수정 패널 */}
            {editPanelFor && (
                <EditQuestionPanel
                    item={editPanelFor}
                    grammarTree={grammarTree}
                    onClose={closeEditPanel}
                    onSaved={updateGalleryItem}
                />
            )}
        </div>
    );
}

// 우측 슬라이드 수정 패널 (단일 문항 편집)
function EditQuestionPanel({
    item, grammarTree, onClose, onSaved,
}: {
    item: any;
    grammarTree: any[];
    onClose: () => void;
    onSaved: (updated: any) => void;
}) {
    const ANSWERS = ['①', '②', '③', '④', '⑤'];
    const DIFFS = ['상', '중', '하'];
    const AREAS = ['문학', '독서', '화작', '언매'];
    const GRADES = ['1', '2', '3'];

    const initialTags: string[] = (item.tags && item.tags.length > 0)
        ? item.tags.map((qt: any) => qt.tag.name)
        : (item.keywords ? item.keywords.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    const initialGrammarIds: number[] = (item.grammarCategories || []).map((g: any) => g.category?.id ?? g.categoryId);

    const [ocrText, setOcrText] = React.useState<string>(item.ocrText || '');
    const [questionNo, setQuestionNo] = React.useState<string>(item.questionNo?.toString() || '');
    const [sourceKey, setSourceKey] = React.useState<string>(item.sourceKey || '');
    const [imageNo, setImageNo] = React.useState<string>(item.imageNo?.toString() || '');
    const [answer, setAnswer] = React.useState<string>(item.answer || '');
    const [difficulty, setDifficulty] = React.useState<string>(item.difficulty || '');
    const [tags, setTags] = React.useState<string[]>(initialTags);
    const [tagInput, setTagInput] = React.useState('');
    const [grammarIds, setGrammarIds] = React.useState<number[]>(initialGrammarIds);

    // 메타 필드 — 지문 있으면 지문 기준, 없으면 문항 자체 기준
    const hasPassage = !!item.passage && !!item.passageId;
    const [year, setYear] = React.useState<string>(
        (hasPassage ? item.passage?.year : item.year)?.toString() || ''
    );
    const [month, setMonth] = React.useState<string>(
        (hasPassage ? item.passage?.month : item.month)?.toString() || ''
    );
    const [grade, setGrade] = React.useState<string>(
        (hasPassage ? item.passage?.grade : item.grade)?.toString() || ''
    );
    const [area, setArea] = React.useState<string>(
        (hasPassage ? item.passage?.area : item.area) || ''
    );
    // '이 문제는 모고 문제가 아님' → 메타 필드 비활성 + sourceKey 자동 조립 중지
    const [skipMockMeta, setSkipMockMeta] = React.useState<boolean>(
        !year && !month && !grade && !sourceKey
    );

    // year/month/grade 가 채워지면 sourceKey 앞 8자리(m + gg + yy + mm)를 자동 조립.
    // 마지막 2자리(문항번호)는 기존 sourceKey 값 유지.
    React.useEffect(() => {
        if (skipMockMeta) return;
        const yy = /^\d{4}$/.test(year) ? year.slice(2) : (year.length === 2 ? year : '');
        const mm = month ? String(parseInt(month, 10)).padStart(2, '0') : '';
        const gg = grade ? String(parseInt(grade, 10)).padStart(2, '0') : '';
        if (!yy || !mm || !gg) return;
        const prefix = `m${gg}${yy}${mm}`;
        const existing = sourceKey.trim();
        // 기존 sourceKey에서 마지막 2자리 추출 (m + 6자리 + 2자리 패턴)
        const m = /^m\d{6}(\d{2})$/.exec(existing);
        const suffix = m ? m[1] : '';
        const next = prefix + suffix;
        if (next !== existing) setSourceKey(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, month, grade, skipMockMeta]);

    const [saving, setSaving] = React.useState(false);
    const [savedToast, setSavedToast] = React.useState(false);
    const [imageUrl, setImageUrl] = React.useState<string>(item.imageUrl);
    const [imageEditorOpen, setImageEditorOpen] = React.useState(false);

    const toggleGrammar = (id: number) => {
        setGrammarIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
    };
    const addTag = () => {
        const v = tagInput.trim();
        if (!v) return;
        if (!tags.includes(v)) setTags([...tags, v]);
        setTagInput('');
    };

    const save = React.useCallback(async () => {
        setSaving(true);
        try {
            // '생략' 체크는 단독 문제(!hasPassage)에서만 유효. 지문 문제는 지문 메타를 그대로 씀.
            const skip = !hasPassage && skipMockMeta;
            const effectiveSourceKey = skip ? '' : sourceKey.trim();
            const effectiveYear = skip ? '' : year;
            const effectiveMonth = skip ? '' : month;
            const effectiveGrade = skip ? '' : grade;
            const effectiveArea = skip ? '' : area;

            // sourceKey 마지막 2자리에서 원본 문항번호(questionNo) 자동 추출.
            const keyMatch = /^m\d{2}\d{2}\d{2}(\d{2})$/.exec(effectiveSourceKey);
            const derivedQuestionNo = keyMatch ? keyMatch[1] : (skip ? '' : questionNo);

            const qBody: any = {
                id: item.id,
                ocrText,
                questionNo: derivedQuestionNo,
                sourceKey: effectiveSourceKey,
                imageNo,
                answer, difficulty,
                tags, grammarCategoryIds: grammarIds,
            };
            // 단독 문제(passage 없음)일 때만 year/month/grade/area 를 Question 에 직접 저장
            if (!hasPassage) {
                qBody.year = effectiveYear;
                qBody.month = effectiveMonth;
                qBody.grade = effectiveGrade;
                qBody.area = effectiveArea;
            }

            // 1) 문제 저장
            const qRes = await fetch('/api/admin/question', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(qBody),
            });
            if (!qRes.ok) {
                const e = await qRes.json().catch(() => ({}));
                alert('문제 저장 실패: ' + (e.error || qRes.status));
                return;
            }
            const qUpdated = await qRes.json();

            // 2) 지문 레벨 필드가 변경됐을 때만 지문 저장
            let passageUpdated: any = null;
            if (hasPassage) {
                const initial = item.passage || {};
                const passageDirty =
                    String(initial.year ?? '') !== year ||
                    String(initial.month ?? '') !== month ||
                    String(initial.grade ?? '') !== grade ||
                    (initial.area ?? '') !== area;
                if (passageDirty) {
                    const pRes = await fetch('/api/admin/passage', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: item.passageId,
                            year: year === '' ? null : parseInt(year),
                            month: month === '' ? null : parseInt(month),
                            grade: grade === '' ? null : parseInt(grade),
                            area: area || null,
                        }),
                    });
                    if (!pRes.ok) {
                        const e = await pRes.json().catch(() => ({}));
                        alert('지문 메타 저장 실패: ' + (e.error || pRes.status));
                        return;
                    }
                    passageUpdated = await pRes.json();
                }
            }

            const parsedYear = effectiveYear === '' ? null : parseInt(effectiveYear);
            const parsedMonth = effectiveMonth === '' ? null : parseInt(effectiveMonth);
            const parsedGrade = effectiveGrade === '' ? null : parseInt(effectiveGrade);
            const parsedArea = effectiveArea || null;

            // 정규화 — 갤러리 카드용 형태 유지
            onSaved({
                ...item,
                ocrText,
                questionNo: derivedQuestionNo ? parseInt(derivedQuestionNo) : null,
                sourceKey: effectiveSourceKey || null,
                imageNo: imageNo ? parseInt(imageNo) : null,
                answer, difficulty,
                tags: (qUpdated.tags || []),
                grammarCategories: (qUpdated.grammarCategories || []),
                // 단독 문제는 question 자체에 메타 저장됨
                year: hasPassage ? item.year : parsedYear,
                month: hasPassage ? item.month : parsedMonth,
                grade: hasPassage ? item.grade : parsedGrade,
                area: hasPassage ? item.area : parsedArea,
                // 지문 있을 때만 passage 갱신
                passage: hasPassage ? {
                    ...(item.passage || {}),
                    ...(passageUpdated || {
                        year: parsedYear, month: parsedMonth, grade: parsedGrade, area: parsedArea,
                    }),
                } : item.passage,
            });
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 1800);
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    }, [item, ocrText, questionNo, sourceKey, imageNo, answer, difficulty, tags, grammarIds, onSaved, hasPassage, year, month, grade, area, skipMockMeta]);

    // Esc 닫기, Ctrl+S 저장
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (!saving) save();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [save, saving, onClose]);

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* 백드롭 */}
            <div className="flex-1 bg-black/30" onClick={onClose} />
            {/* 슬라이드 패널 */}
            <div className="w-[720px] max-w-[92vw] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-50">
                    <div>
                        <h3 className="font-black text-slate-900 text-base">
                            문제 #{item.id} 수정
                        </h3>
                        <p className="text-xs text-slate-500">
                            {(() => {
                                const y = item.passage?.year ?? item.year;
                                const m = item.passage?.month ?? item.month;
                                const g = item.passage?.grade ?? item.grade;
                                const a = item.passage?.area ?? item.area;
                                const parts: string[] = [];
                                if (item.questionNo) parts.push(`${item.questionNo}번`);
                                if (y && m) parts.push(`${y}.${m}`);
                                if (a) parts.push(a);
                                if (g) parts.push(`${g}학년`);
                                return parts.join(' · ');
                            })()}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-2xl leading-none" title="ESC">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* 이미지 미리보기 + 편집 */}
                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 relative">
                        <img src={imageUrl} alt="" className="w-full max-h-96 object-contain" />
                        <button
                            type="button"
                            onClick={() => setImageEditorOpen(true)}
                            className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 bg-white/95 border border-slate-200 rounded shadow hover:bg-slate-100 text-xs font-black text-slate-700"
                            title="자르기 / 다시 올리기"
                        >
                            <ImageIcon size={13} /> 이미지 편집
                        </button>
                    </div>

                    {/* 메타 — 항상 노출. 지문 있으면 지문에, 없으면 문항 자체에 저장 */}
                    <div className={`rounded-lg p-3 border ${hasPassage ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'} ${skipMockMeta ? 'opacity-60' : ''}`}>
                        <div className={`text-xs font-black mb-1 flex items-center gap-2 ${hasPassage ? 'text-blue-900' : 'text-amber-900'}`}>
                            <span>
                                {hasPassage ? '지문 정보' : '모고문제메타'} <span className={`font-medium ${hasPassage ? 'text-blue-700' : 'text-amber-700'}`}>
                                    {hasPassage ? '(이 지문의 모든 문제에 함께 적용됨)' : '(단독 문제 — 이 문항에만 적용)'}
                                </span>
                            </span>
                            {!hasPassage && (
                                <label className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-800 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={skipMockMeta}
                                        onChange={(e) => setSkipMockMeta(e.target.checked)}
                                        className="accent-amber-600"
                                    />
                                    생략 (모고 문제 아님)
                                </label>
                            )}
                        </div>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">연도</label>
                                    <input value={year} onChange={(e) => setYear(e.target.value)} type="number" placeholder="2025"
                                        disabled={skipMockMeta}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-slate-900 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">월</label>
                                    <input value={month} onChange={(e) => setMonth(e.target.value)} type="number" placeholder="9"
                                        disabled={skipMockMeta}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-slate-900 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">학년</label>
                                    <select value={grade} onChange={(e) => setGrade(e.target.value)}
                                        disabled={skipMockMeta}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-slate-900 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed">
                                        <option value="">미정</option>
                                        {GRADES.map((g) => <option key={g} value={g}>{g}학년</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">영역</label>
                                    <select value={area} onChange={(e) => setArea(e.target.value)}
                                        disabled={skipMockMeta}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-slate-900 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed">
                                        <option value="">미정</option>
                                        {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                    {/* 문제 번호 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">모고입력키워드</label>
                            <input
                                value={sourceKey}
                                onChange={(e) => setSourceKey(e.target.value)}
                                placeholder={skipMockMeta ? '(모고 문제 아님)' : '위 메타 선택 후 마지막 2자리(문항)만 입력'}
                                disabled={skipMockMeta}
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900 font-mono disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">m + 학년(2) + 년(2) + 월(2) + 문항(2) — 예: 고1 23년 11월 17번 → <span className="font-mono">m01231117</span></p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">이미지 문제번호</label>
                            <input
                                value={imageNo}
                                onChange={(e) => setImageNo(e.target.value)}
                                type="number"
                                min={1}
                                max={999}
                                placeholder="1~999"
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">이미지 위에 적힌(교재상) 번호</p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">난이도</label>
                        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm text-slate-900 bg-white">
                            <option value="">-</option>
                            {DIFFS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">정답</label>
                        <div className="flex gap-1.5">
                            {ANSWERS.map((a) => (
                                <button key={a} type="button"
                                    onClick={() => setAnswer(answer === a ? '' : a)}
                                    className={`flex-1 py-2 rounded border-2 font-black text-base ${
                                        answer === a ? 'bg-teal-500 text-white border-teal-600' : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400'
                                    }`}>
                                    {a}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">태그</label>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {tags.map((t) => (
                                <span key={t} className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-300 flex items-center gap-1">
                                    #{t}
                                    <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-teal-600 hover:text-teal-900">×</button>
                                </span>
                            ))}
                            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                                onBlur={addTag}
                                placeholder="Enter/콤마로 추가"
                                className="text-sm border border-slate-200 rounded px-2 py-0.5 flex-1 min-w-32 text-slate-900" />
                        </div>
                    </div>

                    {/* 문법 카테고리 */}
                    <div className="border-t pt-4">
                        <label className="text-xs font-bold text-slate-500 block mb-2">
                            문법(어법) 카테고리 <span className="font-medium text-slate-400">(해당될 경우)</span>
                        </label>
                        {grammarTree.length === 0 ? (
                            <div className="text-xs text-slate-400">카테고리가 없습니다.</div>
                        ) : (
                            <div className="space-y-3">
                                {grammarTree.map((root: any) => (
                                    <div key={root.id}>
                                        <div className="text-[11px] font-black text-slate-700 mb-1">{root.name}</div>
                                        <div className="grid grid-cols-2 gap-1">
                                            {(root.children || []).map((c: any) => {
                                                const checked = grammarIds.includes(c.id);
                                                return (
                                                    <label key={c.id}
                                                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer ${
                                                            checked ? 'bg-purple-100 text-purple-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
                                                        }`}>
                                                        <input type="checkbox" checked={checked} onChange={() => toggleGrammar(c.id)} className="accent-purple-600" />
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

                    {/* OCR */}
                    <div className="border-t pt-4">
                        <label className="text-xs font-bold text-slate-500 block mb-1">OCR 본문</label>
                        <textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)}
                            rows={8}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900 font-mono resize-y" />
                    </div>
                </div>

                <div className="px-5 py-3 border-t bg-slate-50 flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 mr-auto">
                        <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Esc</kbd> 닫기 · <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Ctrl+S</kbd> 저장
                    </span>
                    {savedToast && <span className="text-xs font-bold text-emerald-600">✓ 저장됨</span>}
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700">닫기</button>
                    <button onClick={save} disabled={saving}
                        className="px-4 py-2 text-sm font-bold rounded bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 flex items-center gap-1.5">
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
            {imageEditorOpen && (
                <QuestionImageEditor
                    questionId={item.id}
                    imageUrl={imageUrl}
                    onChanged={(newUrl) => {
                        setImageUrl(newUrl);
                        setImageEditorOpen(false);
                        // 갤러리 카드도 새 URL로 갱신
                        onSaved({ ...item, imageUrl: newUrl });
                    }}
                    onClose={() => setImageEditorOpen(false)}
                />
            )}
        </div>
    );
}

// 일괄 문법 추가 모달 (병합 동작 — 기존 카테고리 유지하며 추가)
function BulkGrammarModal({
    tree, selectedItems, onClose, onSave,
}: {
    tree: any[];
    selectedItems: any[];
    onClose: () => void;
    onSave: (ids: number[]) => void;
}) {
    const [selected, setSelected] = React.useState<number[]>([]);
    const toggle = (id: number) => {
        setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };
    // Esc 닫기 + Ctrl+S 저장
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (selected.length > 0) onSave(selected);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected, onClose, onSave]);

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1200px] max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b flex items-center justify-between">
                    <div>
                        <h3 className="font-black text-slate-900 text-base mb-1">
                            문법 카테고리 일괄 추가
                        </h3>
                        <p className="text-xs text-slate-500">
                            <b className="text-purple-700">{selectedItems.length}개 문항</b>에 카테고리를 <b>추가</b>합니다. (기존 유지)
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-2xl leading-none" title="ESC">×</button>
                </div>

                <div className="flex flex-1 min-h-0">
                    {/* 좌: 카테고리 트리 */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 border-r">
                        {tree.length === 0 ? (
                            <div className="text-sm text-slate-400">카테고리가 없습니다.</div>
                        ) : tree.map((root: any) => (
                            <div key={root.id}>
                                <div className="text-xs font-black text-slate-700 mb-1.5">{root.name}</div>
                                <div className="grid grid-cols-2 gap-1">
                                    {(root.children || []).map((c: any) => {
                                        const checked = selected.includes(c.id);
                                        return (
                                            <label key={c.id}
                                                className={`flex items-center gap-1.5 text-sm px-2 py-1.5 rounded cursor-pointer ${
                                                    checked ? 'bg-purple-100 text-purple-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
                                                }`}>
                                                <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} className="accent-purple-600" />
                                                {c.name}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 우: 선택된 문항 미리보기 */}
                    <SelectedItemsPanel items={selectedItems} />
                </div>

                <div className="px-5 py-3 border-t flex items-center justify-end gap-2 bg-slate-50">
                    <span className="text-xs text-slate-500 mr-auto">
                        {selected.length}개 카테고리 추가 예정 · <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Esc</kbd> 닫기 · <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Ctrl+S</kbd> 저장
                    </span>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700">취소</button>
                    <button onClick={() => onSave(selected)} disabled={selected.length === 0}
                        className="px-4 py-2 text-sm font-bold rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                        {selectedItems.length}개 문항에 추가
                    </button>
                </div>
            </div>
        </div>
    );
}

// 일괄 삭제 확인 모달
function BulkDeleteConfirmModal({
    selectedItems, onClose, onConfirm,
}: {
    selectedItems: any[];
    onClose: () => void;
    onConfirm: () => void;
}) {
    const count = selectedItems.length;
    const [confirmText, setConfirmText] = React.useState('');
    const canDelete = confirmText.trim() === '삭제';
    // Esc 닫기 + Ctrl+S 확정 (canDelete 일 때만)
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (canDelete) onConfirm();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [canDelete, onClose, onConfirm]);

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1100px] max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b flex items-center justify-between">
                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                        ⚠️ {count}개 문항 일괄 삭제
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-2xl leading-none" title="ESC">×</button>
                </div>
                <div className="flex flex-1 min-h-0">
                    <div className="flex-1 p-5 space-y-3 border-r">
                        <p className="text-sm text-slate-700 leading-relaxed">
                            선택한 <b className="text-red-600">{count}개 문항</b>이 영구 삭제됩니다.<br />
                            이 작업은 <b>되돌릴 수 없습니다.</b>
                        </p>
                        <p className="text-xs text-slate-500">
                            지문은 삭제되지 않고, 선택된 문항만 삭제돼요.
                        </p>
                        <div className="pt-2">
                            <label className="text-xs font-bold text-slate-700 block mb-1.5">
                                확인을 위해 <b className="text-red-600">"삭제"</b> 라고 입력하세요:
                            </label>
                            <input
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="삭제"
                                autoFocus
                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-red-500"
                            />
                        </div>
                    </div>
                    <SelectedItemsPanel items={selectedItems} />
                </div>
                <div className="px-5 py-3 border-t flex items-center justify-end gap-2 bg-slate-50">
                    <span className="text-xs text-slate-500 mr-auto">
                        <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Esc</kbd> 닫기 · <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Ctrl+S</kbd> 삭제 확정
                    </span>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700">취소</button>
                    <button onClick={onConfirm} disabled={!canDelete}
                        className="px-4 py-2 text-sm font-bold rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                        {count}개 영구 삭제
                    </button>
                </div>
            </div>
        </div>
    );
}

// 선택된 문항 풀사이즈 카드 패널 (모달 우측 공용)
function SelectedItemsPanel({ items }: { items: any[] }) {
    return (
        <aside className="w-[640px] shrink-0 overflow-y-auto bg-slate-50 p-4 border-l">
            <div className="text-xs font-black text-slate-500 mb-3 px-1 sticky top-0 bg-slate-50 py-1 z-10">
                선택된 문항 {items.length}개
            </div>
            {items.length === 0 ? (
                <div className="text-xs text-slate-400 px-1">선택된 문항 없음</div>
            ) : (
                <div className="space-y-4">
                    {items.map((it) => {
                        const tagNames: string[] = (it.tags && it.tags.length > 0)
                            ? it.tags.map((qt: any) => qt.tag.name)
                            : (it.keywords ? it.keywords.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
                        const grammarCats: any[] = it.grammarCategories || [];
                        return (
                            <div key={it.id} className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                                <div className="relative bg-slate-50">
                                    <img src={it.imageUrl} alt="" className="w-full object-contain p-3" style={{ maxHeight: '32rem' }} />
                                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/70 text-white text-xs font-black rounded shadow">
                                        {it.questionNo ? `${it.questionNo}번` : `#${it.id}`}
                                    </div>
                                </div>
                                <div className="p-3">
                                    {tagNames.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {tagNames.map((name) => (
                                                <span key={name} className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold border border-teal-100">#{name}</span>
                                            ))}
                                        </div>
                                    )}
                                    {grammarCats.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {grammarCats.map((gc: any) => (
                                                <span key={gc.category.id} className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold border border-purple-200">
                                                    {gc.category.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="text-[11px] font-bold text-slate-600">
                                        #{it.id} · {it.passage?.year}.{it.passage?.month} {it.passage?.area || ''} {it.passage?.grade && `· ${it.passage.grade}학년`}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </aside>
    );
}

// 문법 카테고리 선택 모달 (갤러리 카드에서 사용 — 단일 문항)
function GrammarModal({
    tree, initialSelected, onClose, onSave,
}: {
    tree: any[];
    initialSelected: number[];
    onClose: () => void;
    onSave: (ids: number[]) => void;
}) {
    const [selected, setSelected] = React.useState<number[]>(initialSelected);
    const toggle = (id: number) => {
        setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                onSave(selected);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected, onClose, onSave]);
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b flex items-center justify-between">
                    <h3 className="font-black text-slate-900 text-base">문법(어법) 카테고리 선택</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-2xl leading-none">×</button>
                </div>
                <div className="overflow-y-auto p-5 space-y-4 flex-1">
                    {tree.length === 0 ? (
                        <div className="text-sm text-slate-400">카테고리가 없습니다. 관리자 페이지(/admin/grammar)에서 추가하세요.</div>
                    ) : tree.map((root: any) => (
                        <div key={root.id}>
                            <div className="text-xs font-black text-slate-700 mb-1.5">{root.name}</div>
                            <div className="grid grid-cols-2 gap-1">
                                {(root.children || []).map((c: any) => {
                                    const checked = selected.includes(c.id);
                                    return (
                                        <label key={c.id}
                                            className={`flex items-center gap-1.5 text-sm px-2 py-1.5 rounded cursor-pointer ${
                                                checked ? 'bg-purple-100 text-purple-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
                                            }`}>
                                            <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} className="accent-purple-600" />
                                            {c.name}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="px-5 py-3 border-t flex items-center justify-end gap-2 bg-slate-50">
                    <span className="text-xs text-slate-500 mr-auto">
                        {selected.length}개 선택 · <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Esc</kbd> 닫기 · <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px]">Ctrl+S</kbd> 저장
                    </span>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700">취소</button>
                    <button onClick={() => onSave(selected)} className="px-4 py-2 text-sm font-bold rounded bg-purple-600 hover:bg-purple-700 text-white">저장</button>
                </div>
            </div>
        </div>
    );
}

// 무한스크롤 sentinel: 화면 하단에 도달하면 onIntersect 호출
function InfiniteScrollSentinel({
    hasMore, loading, cursor, onIntersect,
}: {
    hasMore: boolean;
    loading: boolean;
    cursor: number | null;
    onIntersect: (cursor: number | null) => void;
}) {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (!hasMore || loading) return;
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting) {
                    onIntersect(cursor);
                    break;
                }
            }
        }, { rootMargin: '300px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, loading, cursor, onIntersect]);

    return (
        <div ref={ref} className="text-center py-8 text-xs text-slate-400 font-bold">
            {loading ? '불러오는 중...' : hasMore ? '스크롤하면 더 불러옵니다' : '더 이상 없습니다'}
        </div>
    );
}
