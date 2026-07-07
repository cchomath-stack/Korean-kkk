import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const HARD_LIMIT = 200; // 정렬 다양화 위해 커서 대신 상위 200개만 로드

export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : null;
        const area = (searchParams.get('area') || '').trim();
        const categoryIdsParam = searchParams.get('categoryIds') || '';
        const categoryIds = categoryIdsParam
            .split(',')
            .map(s => parseInt(s, 10))
            .filter(n => !Number.isNaN(n));
        const sort = (searchParams.get('sort') || 'recent').trim();
        const dir: 'asc' | 'desc' = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

        const ands: any[] = [];
        if (year && !Number.isNaN(year)) {
            ands.push({
                OR: [
                    { year },
                    { passage: { is: { year } } },
                ],
            });
        }
        if (area) {
            ands.push({
                OR: [
                    { area },
                    { passage: { is: { area } } },
                ],
            });
        }
        if (categoryIds.length > 0) {
            ands.push({
                grammarCategories: { some: { categoryId: { in: categoryIds } } },
            });
        }
        const where: any = ands.length > 0 ? { AND: ands } : {};

        // 정렬. null 값은 항상 마지막으로 배치.
        let orderBy: any;
        switch (sort) {
            case 'imageNo':
                orderBy = [
                    { imageNo: { sort: dir, nulls: 'last' } },
                    { id: 'desc' },
                ];
                break;
            case 'sourceKey':
                orderBy = [
                    { sourceKey: { sort: dir, nulls: 'last' } },
                    { id: 'desc' },
                ];
                break;
            case 'examDate':
                // 연도·월 순. passage 있는 것 우선 (passage.year/month) → 단독 문제(question.year/month)
                orderBy = [
                    { passage: { year: { sort: dir, nulls: 'last' } } },
                    { passage: { month: { sort: dir, nulls: 'last' } } },
                    { year: { sort: dir, nulls: 'last' } },
                    { month: { sort: dir, nulls: 'last' } },
                    { id: 'desc' },
                ];
                break;
            case 'passage':
                // 지문별 묶음: passageId 오름 (같은 지문끼리 뭉침) → 문항번호 오름
                orderBy = [
                    { passageId: { sort: 'asc', nulls: 'last' } },
                    { questionNo: { sort: 'asc', nulls: 'last' } },
                    { id: 'desc' },
                ];
                break;
            case 'recent':
            default:
                orderBy = [{ id: dir }];
                break;
        }

        const questions = await prisma.question.findMany({
            where,
            orderBy,
            take: HARD_LIMIT,
            include: {
                passage: true,
                tags: { include: { tag: true } },
                grammarCategories: { include: { category: { select: { id: true, name: true, parentId: true } } } },
            },
        });

        return NextResponse.json({
            items: questions,
            total: questions.length,
            limit: HARD_LIMIT,
            hasMore: false,
            nextCursor: null,
        });
    } catch (error: any) {
        console.error('Gallery Fetch Error:', error);
        return NextResponse.json({ error: '목록 조회 실패', detail: error?.message }, { status: 500 });
    }
}
