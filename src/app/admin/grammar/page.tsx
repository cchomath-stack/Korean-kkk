'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
    Home, BookOpen, Loader2, Plus, Trash2, Save, X, Edit2,
} from 'lucide-react';

type TreeChild = { id: number; name: string; order: number; count: number };
type TreeRoot = TreeChild & { children: TreeChild[] };

export default function GrammarAdminPage() {
    const [tree, setTree] = useState<TreeRoot[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingRoot, setAddingRoot] = useState(false);
    const [newRootName, setNewRootName] = useState('');
    const [addingChildOf, setAddingChildOf] = useState<number | null>(null);
    const [newChildName, setNewChildName] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/grammar/categories');
            if (res.ok) {
                const data = await res.json();
                setTree(data.tree || []);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const createCategory = async (name: string, parentId: number | null, order: number) => {
        const res = await fetch('/api/admin/grammar/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parentId, order }),
        });
        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            alert('생성 실패: ' + (e.error || res.status));
            return false;
        }
        return true;
    };

    const updateCategory = async (id: number, name: string) => {
        const res = await fetch('/api/admin/grammar/categories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name }),
        });
        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            alert('수정 실패: ' + (e.error || res.status));
            return false;
        }
        return true;
    };

    const deleteCategory = async (id: number, hasQuestions: number, hasChildren: number) => {
        const msg = hasChildren > 0
            ? `이 카테고리에는 하위 ${hasChildren}개가 포함되어 있습니다. 모두 삭제됩니다.\n` + (hasQuestions > 0 ? `이 카테고리에 속한 문제 ${hasQuestions}개의 연결도 함께 해제됩니다.\n` : '') + '계속할까요?'
            : hasQuestions > 0
                ? `이 카테고리에 속한 문제 ${hasQuestions}개의 연결이 해제됩니다. 삭제할까요?`
                : '정말 삭제할까요?';
        if (!confirm(msg)) return;
        const res = await fetch(`/api/admin/grammar/categories?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            alert('삭제 실패: ' + (e.error || res.status));
            return;
        }
        load();
    };

    const handleAddRoot = async () => {
        const name = newRootName.trim();
        if (!name) return;
        if (await createCategory(name, null, tree.length)) {
            setNewRootName('');
            setAddingRoot(false);
            load();
        }
    };

    const handleAddChild = async (parentId: number) => {
        const name = newChildName.trim();
        if (!name) return;
        const parent = tree.find((r) => r.id === parentId);
        const order = parent?.children.length || 0;
        if (await createCategory(name, parentId, order)) {
            setNewChildName('');
            setAddingChildOf(null);
            load();
        }
    };

    const startEdit = (id: number, name: string) => {
        setEditingId(id);
        setEditName(name);
    };

    const handleEditSave = async () => {
        if (!editingId) return;
        const name = editName.trim();
        if (!name) return;
        if (await updateCategory(editingId, name)) {
            setEditingId(null);
            setEditName('');
            load();
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="h-14 px-6 flex items-center gap-4 border-b bg-white shadow-sm sticky top-0 z-40">
                <Link href="/" className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-sm font-medium">
                    <Home size={16} /> 홈
                </Link>
                <span className="text-slate-300">|</span>
                <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <BookOpen size={16} /> 문법(어법) 카테고리 관리
                </h1>
                <span className="text-xs text-slate-400 font-medium">대분류 → 소분류 (2단계)</span>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-500 py-10 justify-center">
                        <Loader2 className="animate-spin" size={16} /> 불러오는 중...
                    </div>
                ) : (
                    <div className="space-y-4">
                        {tree.map((root) => (
                            <div key={root.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    {editingId === root.id ? (
                                        <>
                                            <input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); }}
                                                className="text-base font-black text-slate-900 px-2 py-1 border border-teal-400 rounded flex-1 max-w-xs"
                                                autoFocus
                                            />
                                            <button onClick={handleEditSave} className="px-3 py-1 text-xs font-bold rounded bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1">
                                                <Save size={12} /> 저장
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs font-bold rounded bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                취소
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                                                {root.name}
                                                <span className="text-xs font-medium text-slate-400">· 하위 {root.children.length}개</span>
                                            </h2>
                                            <div className="ml-auto flex items-center gap-1">
                                                <button onClick={() => startEdit(root.id, root.name)}
                                                    className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-teal-700" title="이름 수정">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => deleteCategory(root.id, root.count, root.children.length)}
                                                    className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600" title="삭제">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Children */}
                                <div className="pl-4 border-l-2 border-slate-100 space-y-1.5">
                                    {root.children.map((child) => (
                                        <div key={child.id} className="flex items-center gap-2 py-1">
                                            {editingId === child.id ? (
                                                <>
                                                    <input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); }}
                                                        className="text-sm font-bold text-slate-800 px-2 py-1 border border-teal-400 rounded flex-1 max-w-xs"
                                                        autoFocus
                                                    />
                                                    <button onClick={handleEditSave} className="px-3 py-1 text-xs font-bold rounded bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1">
                                                        <Save size={12} /> 저장
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs font-bold rounded bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                        취소
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-sm font-bold text-slate-800">{child.name}</span>
                                                    <span className="text-[10px] font-medium text-slate-400">
                                                        {child.count > 0 ? `· 문제 ${child.count}` : ''}
                                                    </span>
                                                    <div className="ml-auto flex items-center gap-1">
                                                        <button onClick={() => startEdit(child.id, child.name)}
                                                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-teal-700">
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button onClick={() => deleteCategory(child.id, child.count, 0)}
                                                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}

                                    {addingChildOf === root.id ? (
                                        <div className="flex items-center gap-2 py-2">
                                            <input
                                                value={newChildName}
                                                onChange={(e) => setNewChildName(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddChild(root.id); }}
                                                placeholder="새 소분류 이름"
                                                className="text-sm px-2 py-1 border border-teal-400 rounded flex-1 max-w-xs text-slate-900"
                                                autoFocus
                                            />
                                            <button onClick={() => handleAddChild(root.id)} className="px-3 py-1 text-xs font-bold rounded bg-teal-600 text-white hover:bg-teal-700">
                                                추가
                                            </button>
                                            <button onClick={() => { setAddingChildOf(null); setNewChildName(''); }}
                                                className="px-2 py-1 text-xs font-bold rounded bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                취소
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setAddingChildOf(root.id)}
                                            className="text-xs font-bold text-slate-500 hover:text-teal-700 flex items-center gap-1 mt-1">
                                            <Plus size={12} /> 소분류 추가
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {addingRoot ? (
                            <div className="bg-white rounded-xl border-2 border-teal-400 p-4 shadow-md flex items-center gap-2">
                                <input
                                    value={newRootName}
                                    onChange={(e) => setNewRootName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddRoot(); }}
                                    placeholder="새 대분류 이름"
                                    className="text-base font-bold px-3 py-2 border border-slate-300 rounded flex-1 max-w-md text-slate-900"
                                    autoFocus
                                />
                                <button onClick={handleAddRoot}
                                    className="px-4 py-2 text-sm font-bold rounded bg-teal-600 text-white hover:bg-teal-700">
                                    추가
                                </button>
                                <button onClick={() => { setAddingRoot(false); setNewRootName(''); }}
                                    className="px-3 py-2 text-sm font-bold rounded bg-slate-100 text-slate-600 hover:bg-slate-200">
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setAddingRoot(true)}
                                className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition font-bold text-sm flex items-center justify-center gap-2">
                                <Plus size={16} /> 새 대분류 추가
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
