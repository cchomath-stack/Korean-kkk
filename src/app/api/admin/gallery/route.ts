import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const PAGE_SIZE = 30;

export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const cursorParam = searchParams.get('cursor');
        const cursor = cursorParam ? parseInt(cursorParam, 10) : null;
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : null;

        const where: any = {};
        if (year && !Number.isNaN(year)) {
            where.passage = { is: { year } };
        }

        const questions = await prisma.question.findMany({
            where,
            orderBy: { id: 'desc' },
            take: PAGE_SIZE + 1, // 다음 페이지 존재 여부 확인용
            ...(cursor && !Number.isNaN(cursor) && {
                cursor: { id: cursor },
                skip: 1, // cursor 자체는 제외
            }),
            include: {
                passage: true,
                tags: { include: { tag: true } },
                grammarCategories: { include: { category: { select: { id: true, name: true, parentId: true } } } },
            },
        });

        const hasMore = questions.length > PAGE_SIZE;
        const items = hasMore ? questions.slice(0, PAGE_SIZE) : questions;
        const nextCursor = hasMore ? items[items.length - 1].id : null;

        return NextResponse.json({ items, nextCursor, hasMore });
    } catch (error) {
        console.error('Gallery Fetch Error:', error);
        return NextResponse.json({ error: '목록 조회 실패' }, { status: 500 });
    }
}
