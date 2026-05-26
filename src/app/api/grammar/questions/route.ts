import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

const MAX_QUERY_LEN = 200;
const MAX_TOKENS = 10;

// 문법 문제 검색: 카테고리 필터 + 키워드 검색 (둘 다 선택적)
export async function GET(request: NextRequest) {
    if (!(await requireUser())) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryIdsParam = searchParams.get('categoryIds') || '';
    const query = (searchParams.get('q') || '').trim().slice(0, MAX_QUERY_LEN);

    const categoryIds = categoryIdsParam
        .split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n));

    const tokens = query
        ? query
            .split(/[,\s]+/)
            .map((t) => t.replace(/^#/, '').trim())
            .filter(Boolean)
            .slice(0, MAX_TOKENS)
        : [];

    try {
        const where: any = {
            // 카테고리 1개 이상은 무조건 가짐 (= 문법 문제임)
            grammarCategories: { some: {} },
        };

        if (categoryIds.length > 0) {
            where.grammarCategories = {
                some: { categoryId: { in: categoryIds } },
            };
        }

        if (tokens.length > 0) {
            where.AND = tokens.map((t) => ({
                OR: [
                    { ocrText: { contains: t } },
                    { keywords: { contains: t } },
                    { difficulty: { equals: t } },
                    { tags: { some: { tag: { name: { contains: t } } } } },
                    { grammarCategories: { some: { category: { name: { contains: t } } } } },
                    { passage: { is: { area: { contains: t } } } },
                    { passage: { is: { ocrText: { contains: t } } } },
                ],
            }));
        }

        const questions = await prisma.question.findMany({
            where,
            include: {
                passage: { select: { area: true, year: true, month: true, grade: true } },
                tags: { include: { tag: true } },
                grammarCategories: {
                    include: { category: { select: { id: true, name: true, parentId: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });

        return NextResponse.json({ questions, categoryIds, tokens });
    } catch (error) {
        console.error('Grammar questions search error:', error);
        return NextResponse.json({ error: '검색 실패' }, { status: 500 });
    }
}
