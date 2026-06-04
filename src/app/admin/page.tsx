'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Save, Scissors, Type, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

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

    // 갤러리 상태 (무한스크롤 + 연도 필터)
    const [yearFilter, setYearFilter] = useState('');
    const [debouncedYear, setDebouncedYear] = useState('');
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
    }, [debouncedYear]);

    // 연도 필터 바뀌면 처음부터 다시 로드
    useEffect(() => {
        setGallery([]);
        setGalleryCursor(null);
        fetchGalleryPage(null, true);
    }, [debouncedYear, fetchGalleryPage]);

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

    // 갤러리 카드에서 문법 체크 모달
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
                <section className="mt-16 border-t border-slate-200 pt-10">
                    <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                        <Scissors className="w-6 h-6 text-teal-500" />
                        최근 등록 문항 갤러리
                    </h2>

                    {/* 연도 필터 */}
                    <div className="mb-6 flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 max-w-md">
                        <span className="text-xs font-bold text-slate-500 ml-1">연도</span>
                        <input
                            type="number"
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            placeholder="예: 2025 (비우면 전체)"
                            className="flex-1 text-sm px-2 py-1.5 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-teal-500"
                        />
                        {yearFilter && (
                            <button onClick={() => setYearFilter('')} className="text-xs font-bold text-slate-400 hover:text-slate-700">×</button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {gallery.map((item) => {
                            // 새 tags 관계 우선, 없으면 legacy keywords CSV fallback
                            const tagNames: string[] = (item.tags && item.tags.length > 0)
                                ? item.tags.map((qt: any) => qt.tag.name)
                                : (item.keywords ? item.keywords.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
                            const grammarCats: any[] = item.grammarCategories || [];
                            return (
                                <div key={item.id} className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden group hover:ring-2 hover:ring-teal-500 transition-all">
                                    <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden">
                                        <img src={item.imageUrl} alt="Question" className="w-full h-full object-contain p-2" />
                                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-md text-white text-xs font-black rounded shadow-lg">
                                            {item.questionNo}번
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button onClick={() => handleResumePassage(item)} className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold text-xs">수정</button>
                                            <button onClick={() => openGrammarModal(item)} className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-xs">문법</button>
                                            <button onClick={() => handleDeleteQuestion(item.id)} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-xs">삭제</button>
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
                                                <p className="text-sm font-black text-slate-800">{item.passage?.year} {item.passage?.month}월</p>
                                                <p className="text-[11px] text-slate-500 font-bold">{item.passage?.area || item.passage?.office} | {item.passage?.grade}학년</p>
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

            {/* 문법 카테고리 선택 모달 */}
            {grammarModalFor && (
                <GrammarModal
                    tree={grammarTree}
                    initialSelected={grammarModalFor.selected}
                    onClose={() => setGrammarModalFor(null)}
                    onSave={(ids) => saveGrammarSelection(grammarModalFor.id, ids)}
                />
            )}
        </div>
    );
}

// 문법 카테고리 선택 모달 (갤러리 카드에서 사용)
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
                    <span className="text-xs text-slate-500 mr-auto">{selected.length}개 선택</span>
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
