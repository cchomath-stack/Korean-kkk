import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;
    
    // 공개 경로 설정 (로그인 연관 API 포함)
    const isPublicPath = path === '/login' || path.startsWith('/api/auth');

    // 세션 토큰 확인
    const sessionCookie = request.cookies.get('session')?.value;
    
    // 1. 토큰이 없는 경우
    if (!sessionCookie && !isPublicPath) {
        return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // 2. 토큰 검증
    if (sessionCookie && !isPublicPath) {
        const payload = await decrypt(sessionCookie);
        if (!payload) {
            // 유효하지 않은 토큰이면 로그인 페이지로 넘김
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    // 3. 로그인된 사용자가 로그인 페이지에 접근하려고 할 때
    if (sessionCookie && isPublicPath && path === '/login') {
        const payload = await decrypt(sessionCookie);
        if (payload) {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api/upload|_next/static|_next/image|favicon.ico).*)'], // Vercel Blob 등 일부 허용할 수도 있음, 기본적으로 모두 막음
}
