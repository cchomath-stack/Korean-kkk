'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ArrowLeft, Trash2, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UserManagementPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('정말 이 사용자를 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchUsers();
            }
        } catch (e) {
            alert('삭제 실패');
        }
    };

    const handleRoleChange = async (id: number, newRole: string) => {
        try {
            const res = await fetch(`/api/admin/users`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, role: newRole })
            });
            if (res.ok) {
                fetchUsers();
            }
        } catch (e) {
            alert('권한 수정 실패');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-5xl mx-auto">
                <header className="mb-10 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 leading-tight">회원 관리</h1>
                            <p className="text-slate-500 font-medium text-sm">플랫폼의 모든 사용자를 관리합니다.</p>
                        </div>
                    </div>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 font-bold transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        메인으로
                    </Link>
                </header>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="font-bold text-slate-800">전체 사용자 목록</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 border-y border-slate-100">ID</th>
                                    <th className="px-6 py-4 border-y border-slate-100">이메일</th>
                                    <th className="px-6 py-4 border-y border-slate-100">이름</th>
                                    <th className="px-6 py-4 border-y border-slate-100">권한</th>
                                    <th className="px-6 py-4 border-y border-slate-100">가입일</th>
                                    <th className="px-6 py-4 border-y border-slate-100 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                                {loading ? (
                                    <tr><td colSpan={6} className="text-center py-20 text-slate-400 font-bold">로딩 중...</td></tr>
                                ) : users.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-20 text-slate-400 font-bold">가입한 사용자가 없습니다.</td></tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">#{user.id}</td>
                                            <td className="px-6 py-4 font-bold">{user.email}</td>
                                            <td className="px-6 py-4">{user.name || '-'}</td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={user.role}
                                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                    className={cn(
                                                        "text-xs font-bold py-1 px-2 rounded outline-none border cursor-pointer",
                                                        user.role === 'ADMIN' ? "bg-red-50 text-red-600 border-red-200" : "bg-teal-50 text-teal-600 border-teal-200"
                                                    )}
                                                >
                                                    <option value="USER">USER</option>
                                                    <option value="ADMIN">ADMIN</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleDelete(user.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
