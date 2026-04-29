import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

const COVERAGE_LIMIT = 5000;

export async function GET() {
    if (!(await requireUser())) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    try {
        const [
            totalPassages,
            totalQuestions,
            totalPdfs,
            totalTags,
            recentPdfs,
            topTags,
            recentSavedQuestions,
            allQuestions,
        ] = await Promise.all([
            prisma.passage.count(),
            prisma.question.count(),
            prisma.pdfDocument.count(),
            prisma.tag.count(),

            // 최근 PDF 5개 + 카운트
            prisma.pdfDocument.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { _count: { select: { passages: true, questions: true } } },
            }),

            // 인기 태그 top 15 (Tag와 연결된 Question 수 기준)
            prisma.tag.findMany({
                include: { _count: { select: { questions: true, passages: true } } },
                take: 15,
            }),

            // 최근 저장된 문제 5개 (활동 피드)
            prisma.question.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    passage: { select: { area: true, year: true, month: true } },
                    pdfDocument: { select: { name: true } },
                },
            }),

            // 커버리지 매트릭스용: 최근 문제 (최대 COVERAGE_LIMIT개)
            prisma.question.findMany({
                select: {
                    id: true,
                    questionNo: true,
                    difficulty: true,
                    passage: {
                        select: { year: true, month: true, grade: true, area: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: COVERAGE_LIMIT,
            }),
        ]);

        // 인기 태그 정렬 (총 사용 수 기준)
        const sortedTags = topTags
            .map((t) => ({
                name: t.name,
                questions: (t as any)._count.questions,
                passages: (t as any)._count.passages,
                total: (t as any)._count.questions + (t as any)._count.passages,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 15);

        // 커버리지 평탄화
        const coverage = allQuestions.map((q) => ({
            id: q.id,
            questionNo: q.questionNo,
            difficulty: q.difficulty,
            year: q.passage?.year ?? null,
            month: q.passage?.month ?? null,
            grade: q.passage?.grade ?? null,
            area: q.passage?.area ?? null,
        }));

        return NextResponse.json({
            totals: {
                passages: totalPassages,
                questions: totalQuestions,
                pdfs: totalPdfs,
                tags: totalTags,
            },
            recentPdfs,
            topTags: sortedTags,
            recentSavedQuestions,
            coverage,
        });
    } catch (e) {
        console.error('Stats API error:', e);
        return NextResponse.json({ error: '통계 조회 실패' }, { status: 500 });
    }
}
