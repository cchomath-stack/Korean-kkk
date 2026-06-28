import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 학생용 공개: 공개된 회차 목록
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            // 단일 회차 hydrate (학생 체크 페이지용)
            const round = await prisma.examRound.findUnique({
                where: { id: parseInt(id, 10) },
                include: { items: { orderBy: { order: 'asc' } } },
            });
            if (!round || !round.isPublic) {
                return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 });
            }
            // 이미지 + 번호만 노출 (지문 본문/문제 정답 등 민감 정보 제외)
            const passageIds = round.items.filter(i => i.kind === 'passage' && i.passageId).map(i => i.passageId!);
            const questionIds = round.items.filter(i => i.kind === 'question' && i.questionId).map(i => i.questionId!);
            const [passages, questions] = await Promise.all([
                passageIds.length > 0
                    ? prisma.passage.findMany({
                        where: { id: { in: passageIds } },
                        select: { id: true, imageUrl: true, year: true, month: true, grade: true, questionRange: true, images: { orderBy: { order: 'asc' }, select: { imageUrl: true, order: true } } },
                    })
                    : Promise.resolve([]),
                questionIds.length > 0
                    ? prisma.question.findMany({
                        where: { id: { in: questionIds } },
                        select: { id: true, imageUrl: true, questionNo: true, year: true, month: true, grade: true, area: true, passageId: true },
                    })
                    : Promise.resolve([]),
            ]);
            const pMap = new Map(passages.map(p => [p.id, p]));
            const qMap = new Map(questions.map(q => [q.id, q]));
            const items = round.items.map(it => ({
                id: it.id,
                kind: it.kind,
                order: it.order,
                passage: it.kind === 'passage' && it.passageId ? pMap.get(it.passageId) ?? null : null,
                question: it.kind === 'question' && it.questionId ? qMap.get(it.questionId) ?? null : null,
            }));
            return NextResponse.json({
                id: round.id,
                title: round.title,
                subTitle: round.subTitle,
                grade: round.grade,
                requireAcademyCode: round.requireAcademyCode,
                items,
            });
        }

        // 공개 회차 목록
        const rounds = await prisma.examRound.findMany({
            where: { isPublic: true },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, title: true, subTitle: true, grade: true,
                requireAcademyCode: true,
                _count: { select: { items: true } },
            },
        });
        return NextResponse.json(rounds);
    } catch (error: any) {
        console.error('Student Round Error:', error);
        return NextResponse.json({ error: '회차 조회 실패', detail: error?.message }, { status: 500 });
    }
}
