import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const mode = searchParams.get('mode') || 'CONTENT';

    if (!query || query.length < 2) {
        return NextResponse.json({ error: '최소 2글자 이상의 검색어를 입력하세요.' }, { status: 400 });
    }

    try {
        let passages: any[] = [];
        let questions: any[] = [];

        if (mode === 'CONTENT') {
            // 본문 내용 검색 (OCR 텍스트 위주)
            passages = await prisma.passage.findMany({
                where: { ocrText: { contains: query } },
                include: { questions: { orderBy: { questionNo: 'asc' } } },
                take: 50
            });

            questions = await prisma.question.findMany({
                where: { ocrText: { contains: query } },
                include: { passage: true },
                orderBy: { questionNo: 'asc' },
                take: 50
            });
        } else {
            // 문항 정보 검색 (키워드/태그, 출처, 번호 등)
            questions = await prisma.question.findMany({
                where: {
                    OR: [
                        { keywords: { contains: query } },
                        { difficulty: { equals: query } },
                        { passage: { is: { office: { contains: query } } } },
                        { passage: { is: { questionRange: { contains: query } } } },
                    ],
                },
                include: { passage: true },
                orderBy: { createdAt: 'desc' },
                take: 100
            });

            // 정보 검색 시 지문은 해당 문제와 연계된 것 위주로 표시 (필요 시 내용 필터 추가 가능)
            passages = [];
        }

        return NextResponse.json({ passages, questions });
    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: '검색 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
