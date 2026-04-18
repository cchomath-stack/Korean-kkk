import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const questions = await prisma.question.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: {
                passage: true
            }
        });
        return NextResponse.json(questions);
    } catch (error: any) {
        console.error('Gallery Fetch Error:', error);
        return NextResponse.json({ error: '목록 조회 실패', details: error.message }, { status: 500 });
    }
}
