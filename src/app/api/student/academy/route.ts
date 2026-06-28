import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 학생용 공개: 학원 목록 (코드 OFF 회차일 때 학생이 학원 선택용)
export async function GET() {
    try {
        const list = await prisma.academy.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, defaultDesign: true },
        });
        return NextResponse.json(list);
    } catch (error) {
        console.error('Student Academy List Error:', error);
        return NextResponse.json({ error: '학원 조회 실패' }, { status: 500 });
    }
}

// 학생용 공개: 학원 코드 검증 → 학원 정보 반환
export async function POST(request: NextRequest) {
    try {
        const { code } = await request.json();
        if (!code?.trim()) return NextResponse.json({ error: '학원 코드가 필요합니다.' }, { status: 400 });
        const academy = await prisma.academy.findUnique({
            where: { code: code.trim() },
            select: { id: true, name: true, defaultDesign: true },
        });
        if (!academy) return NextResponse.json({ error: '존재하지 않는 코드입니다.' }, { status: 404 });
        return NextResponse.json(academy);
    } catch (error) {
        console.error('Student Academy Code Error:', error);
        return NextResponse.json({ error: '코드 검증 실패' }, { status: 500 });
    }
}
