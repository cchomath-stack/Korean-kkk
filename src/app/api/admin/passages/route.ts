import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q')?.trim() || '';
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
        const pageSize = 30;

        const where = q
            ? {
                  OR: [
                      { ocrText: { contains: q } },
                      { area: { contains: q } },
                      { questionRange: { contains: q } },
                      { source: { contains: q } },
                      { tags: { some: { tag: { name: { contains: q } } } } },
                  ],
              }
            : {};

        const [items, total] = await Promise.all([
            prisma.passage.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    tags: { include: { tag: true } },
                    _count: { select: { questions: true, images: true } },
                },
            }),
            prisma.passage.count({ where }),
        ]);

        return NextResponse.json({
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        console.error('List Passages Error:', error);
        return NextResponse.json({ error: '지문 목록 조회 실패' }, { status: 500 });
    }
}
