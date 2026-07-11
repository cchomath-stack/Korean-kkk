'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, Home } from 'lucide-react';

// 직전 페이지로 돌아가는 버튼.
// 히스토리에 이전 항목이 없으면(예: 새 탭에서 URL 직접 열었을 때) fallback 경로(기본 '/')로 이동.
// 스타일 variant 두 가지 지원:
//   variant='pill'  → 큰 pill 스타일 (아이콘 + '뒤로')
//   variant='icon'  → 아이콘만 (원형)
export function BackButton({
    fallback = '/',
    variant = 'pill',
    label = '뒤로',
    className = '',
}: {
    fallback?: string;
    variant?: 'pill' | 'icon';
    label?: string;
    className?: string;
}) {
    const router = useRouter();

    const handleClick = () => {
        // 브라우저 히스토리에 실제로 이전 항목이 있는지 확인
        // Next.js 앱 라우터에서 window.history.length === 1 이면 첫 진입 (직접 URL)
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push(fallback);
        }
    };

    if (variant === 'icon') {
        return (
            <button
                onClick={handleClick}
                title="뒤로"
                className={`p-2 hover:bg-slate-100 rounded-xl text-slate-600 ${className}`}
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            className={`text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-sm font-medium ${className}`}
        >
            <ChevronLeft className="w-4 h-4" />
            {label}
        </button>
    );
}

// 홈(/)으로 이동하는 별도 버튼 — 뒤로가기와 구분해서 명시적으로 홈으로 가고 싶을 때 사용.
export function HomeButton({ className = '' }: { className?: string }) {
    return (
        <a
            href="/"
            className={`text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-sm font-medium ${className}`}
        >
            <Home className="w-4 h-4" />
            홈
        </a>
    );
}
