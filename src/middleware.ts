import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // 1) 공개 경로: 로그인 페이지 + 로그인 관련 API
    const isLoginOrAuthApi = path === '/login' || path.startsWith('/api/auth');

    const sessionCookie = request.cookies.get('session')?.value;
    const payload = sessionCookie ? await decrypt(sessionCookie) : null;

    if (isLoginOrAuthApi) {
        // 이미 로그인된 사용자가 /login 으로 가면 홈으로
        if (path === '/login' && payload) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return NextResponse.next();
    }

    // 2) 세션 필수
    if (!payload) {
        if (path.startsWith('/api/')) {
            return new NextResponse(JSON.stringify({ error: '로그인이 필요합니다.' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 3) ADMIN 전용 경로 게이트
    //    /admin/stats 와 /api/admin/stats 는 일반회원도 접근 가능
    const isStats = path === '/admin/stats' || path === '/api/admin/stats';
    const isAdminPath = path.startsWith('/admin') || path.startsWith('/api/admin');
    if (isAdminPath && !isStats && payload.role !== 'ADMIN') {
        if (path.startsWith('/api/')) {
            return new NextResponse(JSON.stringify({ error: '관리자 권한이 필요합니다.' }), {
                status: 403, headers: { 'Content-Type': 'application/json' },
            });
        }
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api/upload|_next/static|_next/image|favicon.ico).*)'],
};
