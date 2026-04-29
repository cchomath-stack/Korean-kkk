import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

// 특정 PDF + 그에 속한 모든 저장된 지문/문제 (좌표 포함)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    try {
        const { id } = await ctx.params;
        const pdfId = parseInt(id);
        if (isNaN(pdfId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

        const doc = await prisma.pdfDocument.findUnique({
            where: { id: pdfId },
            include: {
                passages: {
                    include: {
                        images: { orderBy: { order: 'asc' } },
                        tags: { include: { tag: true } },
                    },
                },
                questions: {
                    include: {
                        tags: { include: { tag: true } },
                    },
                },
            },
        });
        if (!doc) return NextResponse.json({ error: 'PDF를 찾을 수 없습니다.' }, { status: 404 });
        return NextResponse.json(doc);
    } catch (e) {
        console.error('PDF detail error:', e);
        return NextResponse.json({ error: 'PDF 조회 실패' }, { status: 500 });
    }
}
