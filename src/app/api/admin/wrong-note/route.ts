import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

// GET: ?id=X&hydrate=1 → 단건 상세 (문항 이미지까지 채워서 반환)
//      ?status=pending|processed → 목록 필터
//      아무 것도 없으면 전체 목록
export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const hydrate = searchParams.get('hydrate') === '1';
        const status = searchParams.get('status');

        if (id) {
            const submission = await prisma.wrongNoteSubmission.findUnique({
                where: { id: parseInt(id, 10) },
                include: {
                    examSet: {
                        select: {
                            id: true, title: true, subTitle: true, grade: true, academyName: true,
                            wrongNoteDesign: true, studentAccessSlug: true,
                        },
                    },
                    answers: { include: { examItem: true } },
                },
            });
            if (!submission) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });

            if (!hydrate) return NextResponse.json(submission);

            // hydrate: examItem의 passage/question 이미지+메타 채우기
            const passageIds = submission.answers
                .filter(a => a.examItem.kind === 'passage' && a.examItem.passageId)
                .map(a => a.examItem.passageId!);
            const questionIds = submission.answers
                .filter(a => a.examItem.kind === 'question' && a.examItem.questionId)
                .map(a => a.examItem.questionId!);

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
            const pMap = new Map(passages.map(p => [p.id, p]));
            const qMap = new Map(questions.map(q => [q.id, q]));

            const hydratedAnswers = submission.answers
                .sort((a, b) => a.examItem.order - b.examItem.order)
                .map(a => ({
                    ...a,
                    passage: a.examItem.kind === 'passage' && a.examItem.passageId ? pMap.get(a.examItem.passageId) ?? null : null,
                    question: a.examItem.kind === 'question' && a.examItem.questionId ? qMap.get(a.examItem.questionId) ?? null : null,
                }));

            return NextResponse.json({ ...submission, answers: hydratedAnswers });
        }

        const where: any = {};
        if (status) where.status = status;

        const list = await prisma.wrongNoteSubmission.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                examSet: { select: { id: true, title: true, subTitle: true, grade: true } },
                _count: { select: { answers: true } },
            },
        });
        return NextResponse.json(list);
    } catch (error: any) {
        console.error('Fetch WrongNote Error:', error);
        return NextResponse.json({ error: '조회 실패', detail: error?.message }, { status: 500 });
    }
}

// PUT: 상태 변경(pending↔processed), 개별 요청에 대한 디자인 오버라이드는 지원하지 않음
// (디자인은 ExamSet.wrongNoteDesign에서 결정됨)
export async function PUT(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const { id, status } = body;
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        const data: any = {};
        if (status === 'pending' || status === 'processed') {
            data.status = status;
            data.processedAt = status === 'processed' ? new Date() : null;
        }
        const updated = await prisma.wrongNoteSubmission.update({
            where: { id: parseInt(String(id), 10) },
            data,
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Update WrongNote Error:', error);
        return NextResponse.json({ error: '수정 실패', detail: error?.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        await prisma.wrongNoteSubmission.delete({ where: { id: parseInt(id, 10) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete WrongNote Error:', error);
        return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }
}
