'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isInitVisible, setIsInitVisible] = useState(false);
    
    const router = useRouter();

    useEffect(() => {
        fetch('/api/auth/check-init')
          .then(res => res.json())
          .then(data => {
            if (data.hasUsers === false) setIsInitVisible(true);
          })
          .catch(() => {});
    }, []);

    const handleInitAdmin = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/init', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                alert('초기 계정(admin / admin1234)이 생성되었습니다! 로그인해주세요.');
                setIsInitVisible(false);
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert('초기화 실패');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || '로그인에 실패했습니다.');
            }
        } catch (err) {
            setError('서버와 통신할 수 없습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-sm w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">모의고사 검색기</h1>
                    <p className="text-slate-500 mt-2 text-sm font-medium">관리자 권한으로 로그인해주세요.</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">아이디</label>
                        <input
                            type="text"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all font-medium placeholder:text-slate-300"
                            placeholder="admin"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all placeholder:text-slate-300"
                            placeholder="••••••"
                            required
                        />
                    </div>
                    
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition flex justify-center items-center mt-8 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '접속하기'}
                    </button>
                </form>

                {isInitVisible && (
                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <button
                            onClick={handleInitAdmin}
                            className="px-4 py-2 text-sm font-bold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
                        >
                            초기 관리자 계정 생성 (Setup Admin)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
