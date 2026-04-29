import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

const MAX_QUERY_LEN = 200;
const MAX_TOKENS = 10;

// 통합 검색: OCR 본문 + 태그 + 메타(영역/난이도/번호 등)를 한 번에
// q는 공백/콤마로 토큰 분리. 각 토큰 앞 #를 떼고 처리. 모든 토큰이 하나의 결과에서 매치되어야 함 (AND).
export async function GET(request: NextRequest) {
    if (!(await requireUser())) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim().slice(0, MAX_QUERY_LEN);

    if (!query || query.length < 1) {
        return NextResponse.json({ error: '검색어를 입력하세요.' }, { status: 400 });
    }

    const tokens = query
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean)
        .slice(0, MAX_TOKENS);

    if (tokens.length === 0) {
        return NextResponse.json({ passages: [], questions: [] });
    }

    try {
        // 각 토큰별 OR 조건 (지문)
        const passageWhere = {
            AND: tokens.map((t) => ({
                OR: [
                    { ocrText: { contains: t } },
                    { area: { contains: t } },
                    { questionRange: { contains: t } },
                    { tags: { some: { tag: { name: { contains: t } } } } },
                    { images: { some: { ocrText: { contains: t } } } },
                ],
            })),
        };

        // 각 토큰별 OR 조건 (문제)
        const questionWhere = {
            AND: tokens.map((t) => ({
                OR: [
                    { ocrText: { contains: t } },
                    { keywords: { contains: t } },
                    { difficulty: { equals: t } },
                    { tags: { some: { tag: { name: { contains: t } } } } },
                    { passage: { is: { area: { contains: t } } } },
                    { passage: { is: { ocrText: { contains: t } } } },
                ],
            })),
        };

        const [passages, questions] = await Promise.all([
            prisma.passage.findMany({
                where: passageWhere,
                include: {
                    questions: { orderBy: { questionNo: 'asc' } },
                    images: { orderBy: { order: 'asc' } },
                    tags: { include: { tag: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
            prisma.question.findMany({
                where: questionWhere,
                include: {
                    passage: {
                        include: { tags: { include: { tag: true } } },
                    },
                    tags: { include: { tag: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
        ]);

        return NextResponse.json({ passages, questions, tokens });
    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: '검색 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
