import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const hydrate = searchParams.get('hydrate') === '1';
        const status = searchParams.get('status');

        if (id) {
            const req = await prisma.wrongNoteRequest.findUnique({
                where: { id: parseInt(id, 10) },
                include: {
                    academy: true,
                    round: true,
                    answers: { include: { roundItem: true } },
                },
            });
            if (!req) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });

            if (!hydrate) return NextResponse.json(req);

            // hydrate: 각 answer.roundItem에 passage/question 정보 채움
            const passageIds = req.answers
                .filter(a => a.roundItem.kind === 'passage' && a.roundItem.passageId)
                .map(a => a.roundItem.passageId!);
            const questionIds = req.answers
                .filter(a => a.roundItem.kind === 'question' && a.roundItem.questionId)
                .map(a => a.roundItem.questionId!);

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

            const hydratedAnswers = req.answers
                .sort((a, b) => a.roundItem.order - b.roundItem.order)
                .map(a => ({
                    ...a,
                    passage: a.roundItem.kind === 'passage' && a.roundItem.passageId ? pMap.get(a.roundItem.passageId) ?? null : null,
                    question: a.roundItem.kind === 'question' && a.roundItem.questionId ? qMap.get(a.roundItem.questionId) ?? null : null,
                }));

            return NextResponse.json({ ...req, answers: hydratedAnswers });
        }

        const where: any = {};
        if (status) where.status = status;

        const list = await prisma.wrongNoteRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                academy: { select: { id: true, name: true } },
                round: { select: { id: true, title: true } },
                _count: { select: { answers: true } },
            },
        });
        return NextResponse.json(list);
    } catch (error: any) {
        console.error('Fetch WrongNote Error:', error);
        return NextResponse.json({ error: '조회 실패', detail: error?.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const { id, status, design } = body;
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        const data: any = {};
        if (status === 'pending' || status === 'processed') {
            data.status = status;
            if (status === 'processed') data.processedAt = new Date();
            else data.processedAt = null;
        }
        if (design === 'mexx' || design === 'oreum') data.design = design;
        const updated = await prisma.wrongNoteRequest.update({
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
        await prisma.wrongNoteRequest.delete({ where: { id: parseInt(id, 10) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete WrongNote Error:', error);
        return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }
}
