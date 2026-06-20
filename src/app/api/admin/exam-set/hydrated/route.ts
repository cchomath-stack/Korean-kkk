import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

// 시험지 1개를 가져오면서 각 ExamItem 안에 실제 passage/question 데이터까지 같이 채워서 반환
// exam-builder 페이지와 PDF 생성용
// GET /api/admin/exam-set/hydrated?id=123  (없으면 draft 자동 사용)
export async function GET(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) return FORBIDDEN;
    const ownerId = Number(session.userId);

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');

    try {
        let exam;
        if (idParam) {
            exam = await prisma.examSet.findUnique({
                where: { id: parseInt(idParam, 10) },
                include: { items: { orderBy: { order: 'asc' } } },
            });
        } else {
            exam = await prisma.examSet.findFirst({
                where: { ownerId, status: 'draft' },
                include: { items: { orderBy: { order: 'asc' } } },
            });
            if (!exam) {
                exam = await prisma.examSet.create({
                    data: { ownerId, status: 'draft' },
                    include: { items: { orderBy: { order: 'asc' } } },
                });
            }
        }

        if (!exam || exam.ownerId !== ownerId) {
            return NextResponse.json({ error: '시험지를 찾을 수 없습니다.' }, { status: 404 });
        }

        // 필요한 passage/question id 모두 모아서 한 번에 조회
        const passageIds = exam.items.filter(i => i.kind === 'passage' && i.passageId).map(i => i.passageId!) ;
        const questionIds = exam.items.filter(i => i.kind === 'question' && i.questionId).map(i => i.questionId!);

        const [passages, questions] = await Promise.all([
            passageIds.length > 0
                ? prisma.passage.findMany({
                    where: { id: { in: passageIds } },
                    include: {
                        images: { orderBy: { order: 'asc' } },
                        questions: { orderBy: { questionNo: 'asc' } },
                    },
                })
                : Promise.resolve([]),
            questionIds.length > 0
                ? prisma.question.findMany({
                    where: { id: { in: questionIds } },
                    include: {
                        passage: { select: { id: true, year: true, month: true, grade: true, area: true } },
                    },
                })
                : Promise.resolve([]),
        ]);

        const passageMap = new Map(passages.map(p => [p.id, p]));
        const questionMap = new Map(questions.map(q => [q.id, q]));

        const hydrated = exam.items.map(it => ({
            ...it,
            passage: it.kind === 'passage' && it.passageId ? passageMap.get(it.passageId) ?? null : null,
            question: it.kind === 'question' && it.questionId ? questionMap.get(it.questionId) ?? null : null,
        }));

        return NextResponse.json({
            ...exam,
            items: hydrated,
        });
    } catch (error: any) {
        console.error('Hydrated ExamSet Error:', error);
        return NextResponse.json(
            { error: '시험지 조회 실패', detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}
