import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

// 같은 sourceKey 를 가진 다른 문항이 있는지 확인
// GET /api/admin/question/check-duplicate?sourceKey=m01231117&excludeId=123
// → { duplicates: [{ id, imageUrl, imageNo, questionNo }] }
export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const sourceKey = (searchParams.get('sourceKey') || '').trim();
        const excludeIdRaw = searchParams.get('excludeId');
        const excludeId = excludeIdRaw ? parseInt(excludeIdRaw, 10) : null;

        if (!sourceKey) {
            return NextResponse.json({ duplicates: [] });
        }

        const where: any = { sourceKey };
        if (excludeId && !Number.isNaN(excludeId)) {
            where.NOT = { id: excludeId };
        }

        const duplicates = await prisma.question.findMany({
            where,
            select: {
                id: true,
                imageUrl: true,
                imageNo: true,
                questionNo: true,
                createdAt: true,
            },
            orderBy: { id: 'asc' },
            take: 5,
        });

        return NextResponse.json({ duplicates });
    } catch (error: any) {
        console.error('Duplicate Check Error:', error);
        return NextResponse.json({ error: '조회 실패', detail: error?.message }, { status: 500 });
    }
}
