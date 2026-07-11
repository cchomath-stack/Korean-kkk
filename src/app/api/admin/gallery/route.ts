import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const PAGE_SIZE = 50; // 한 번에 50개씩

export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const offsetParam = searchParams.get('offset');
        const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10)) : 0;
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
                orderBy = [
                    { passage: { year: { sort: dir, nulls: 'last' } } },
                    { passage: { month: { sort: dir, nulls: 'last' } } },
                    { year: { sort: dir, nulls: 'last' } },
                    { month: { sort: dir, nulls: 'last' } },
                    { id: 'desc' },
                ];
                break;
            case 'passage':
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

        const [questions, total] = await Promise.all([
            prisma.question.findMany({
                where,
                orderBy,
                skip: offset,
                take: PAGE_SIZE + 1, // 다음 페이지 존재 여부 확인용
                include: {
                    passage: true,
                    tags: { include: { tag: true } },
                    grammarCategories: { include: { category: { select: { id: true, name: true, parentId: true } } } },
                },
            }),
            offset === 0 ? prisma.question.count({ where }) : Promise.resolve(null),
        ]);

        const hasMore = questions.length > PAGE_SIZE;
        const items = hasMore ? questions.slice(0, PAGE_SIZE) : questions;

        return NextResponse.json({
            items,
            hasMore,
            nextOffset: hasMore ? offset + PAGE_SIZE : null,
            total, // 첫 페이지 요청 시에만 총 개수 (다음 요청부터는 null)
        });
    } catch (error: any) {
        console.error('Gallery Fetch Error:', error);
        return NextResponse.json({ error: '목록 조회 실패', detail: error?.message }, { status: 500 });
    }
}
