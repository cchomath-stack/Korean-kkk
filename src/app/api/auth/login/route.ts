import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: '아이디와 비밀번호를 모두 입력해주세요.' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        // 사용자 존재/비밀번호 불일치를 동일 메시지로 응답 (사용자 열거 방지)
        // 사용자가 없을 때도 bcrypt 호출하여 타이밍 차이 최소화
        const passwordHash = user?.password || '$2a$10$invaliddummyhashinvaliddummyhashinvaliddummyhashinva';
        const isPasswordValid = await bcrypt.compare(password, passwordHash);

        if (!user || !isPasswordValid) {
            return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
        }

        // 로그인 성공, JWT 세션 쿠키 설정
        await createSession(user.id, user.role);

        return NextResponse.json({ message: '로그인 성공', user: { id: user.id, email: user.email, name: user.name, role: user.role } });

    } catch (error) {
        console.error('Login Error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
