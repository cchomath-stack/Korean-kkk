import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
const PAGE_SIZE = 40;

// GET /api/admin/questions/list
//   ?sort=recent|imageNo|sourceKey|passage    (default recent)
//   &filter=all|mock                          (mock: sourceKey != null)
//   &grammar=<categoryId>                     (filter by grammar category)
//   &passage=<id>                             (filter by specific passage)
//   &q=<text>                                 (sourceKey/ocr partial match)
//   &page=<n>                                 (1-based)
export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const sort = searchParams.get('sort') || 'recent';
        const filter = searchParams.get('filter') || 'all';
        const grammarId = searchParams.get('grammar');
        const passageId = searchParams.get('passage');
        const q = (searchParams.get('q') || '').trim();
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

        const where: any = {};
        if (filter === 'mock') where.sourceKey = { not: null };
        if (grammarId) {
            const gid = parseInt(grammarId, 10);
            if (!isNaN(gid)) where.grammarCategories = { some: { categoryId: gid } };
        }
        if (passageId) {
            const pid = parseInt(passageId, 10);
            if (!isNaN(pid)) where.passageId = pid;
        }
        if (q) {
            where.OR = [
                { sourceKey: { contains: q } },
                { ocrText: { contains: q } },
            ];
        }

        // 정렬 옵션
        let orderBy: any = { createdAt: 'desc' };
        if (sort === 'imageNo') orderBy = [{ imageNo: 'asc' }, { id: 'asc' }];
        else if (sort === 'sourceKey') orderBy = [{ sourceKey: 'asc' }, { id: 'asc' }];
        else if (sort === 'passage') orderBy = [{ passageId: 'asc' }, { questionNo: 'asc' }, { id: 'asc' }];

        const [items, total] = await Promise.all([
            prisma.question.findMany({
                where,
                orderBy,
                skip: (page - 1) * PAGE_SIZE,
                take: PAGE_SIZE,
                include: {
                    passage: {
                        select: { id: true, year: true, month: true, grade: true, area: true, questionRange: true },
                    },
                    grammarCategories: {
                        include: { category: { include: { parent: true } } },
                    },
                },
            }),
            prisma.question.count({ where }),
        ]);

        return NextResponse.json({
            items,
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            pageSize: PAGE_SIZE,
        });
    } catch (error: any) {
        console.error('Questions List Error:', error);
        return NextResponse.json({ error: '목록 실패', detail: error?.message }, { status: 500 });
    }
}
