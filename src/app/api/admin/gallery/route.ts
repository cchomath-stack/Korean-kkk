import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

export async function GET() {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    try {
        const questions = await prisma.question.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: {
                passage: true
            }
        });
        return NextResponse.json(questions);
    } catch (error) {
        console.error('Gallery Fetch Error:', error);
        return NextResponse.json({ error: '목록 조회 실패' }, { status: 500 });
    }
}
