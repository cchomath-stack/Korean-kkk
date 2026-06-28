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

        if (id) {
            const round = await prisma.examRound.findUnique({
                where: { id: parseInt(id, 10) },
                include: { items: { orderBy: { order: 'asc' } } },
            });
            if (!round) return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 });

            if (!hydrate) return NextResponse.json(round);

            // hydrate=1 → 각 RoundItem에 passage/question 데이터 채워서 반환
            const passageIds = round.items.filter(i => i.kind === 'passage' && i.passageId).map(i => i.passageId!);
            const questionIds = round.items.filter(i => i.kind === 'question' && i.questionId).map(i => i.questionId!);
            const [passages, questions] = await Promise.all([
                passageIds.length > 0
                    ? prisma.passage.findMany({
                        where: { id: { in: passageIds } },
                        include: { images: { orderBy: { order: 'asc' } }, questions: { orderBy: { questionNo: 'asc' } } },
                    })
                    : Promise.resolve([]),
                questionIds.length > 0
                    ? prisma.question.findMany({ where: { id: { in: questionIds } } })
                    : Promise.resolve([]),
            ]);
            const pMap = new Map(passages.map(p => [p.id, p]));
            const qMap = new Map(questions.map(q => [q.id, q]));
            const hydratedItems = round.items.map(it => ({
                ...it,
                passage: it.kind === 'passage' && it.passageId ? pMap.get(it.passageId) ?? null : null,
                question: it.kind === 'question' && it.questionId ? qMap.get(it.questionId) ?? null : null,
            }));
            return NextResponse.json({ ...round, items: hydratedItems });
        }

        const list = await prisma.examRound.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { items: true, wrongNoteRequests: true } } },
        });
        return NextResponse.json(list);
    } catch (error: any) {
        console.error('Fetch Round Error:', error);
        return NextResponse.json({ error: '회차 조회 실패', detail: error?.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const { title, subTitle, grade, isPublic, requireAcademyCode } = body;
        if (!title?.trim()) {
            return NextResponse.json({ error: '회차 이름은 필수입니다.' }, { status: 400 });
        }
        const round = await prisma.examRound.create({
            data: {
                title: title.trim(),
                subTitle: subTitle?.trim() || null,
                grade: grade == null || grade === '' ? null : parseInt(String(grade), 10),
                isPublic: !!isPublic,
                requireAcademyCode: requireAcademyCode === undefined ? true : !!requireAcademyCode,
            },
        });
        return NextResponse.json(round);
    } catch (error: any) {
        console.error('Create Round Error:', error);
        return NextResponse.json({ error: '회차 생성 실패', detail: error?.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const { id, ...rest } = body;
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        const data: any = {};
        if ('title' in rest) data.title = String(rest.title).trim();
        if ('subTitle' in rest) data.subTitle = rest.subTitle?.trim() || null;
        if ('grade' in rest) data.grade = rest.grade == null || rest.grade === '' ? null : parseInt(String(rest.grade), 10);
        if ('isPublic' in rest) data.isPublic = !!rest.isPublic;
        if ('requireAcademyCode' in rest) data.requireAcademyCode = !!rest.requireAcademyCode;
        const updated = await prisma.examRound.update({
            where: { id: parseInt(String(id), 10) },
            data,
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Update Round Error:', error);
        return NextResponse.json({ error: '회차 수정 실패', detail: error?.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        await prisma.examRound.delete({ where: { id: parseInt(id, 10) } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete Round Error:', error);
        return NextResponse.json({ error: '회차 삭제 실패' }, { status: 500 });
    }
}
