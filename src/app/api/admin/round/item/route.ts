import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const { roundId, kind, passageId, questionId } = body;
        if (!roundId) return NextResponse.json({ error: 'roundId가 필요합니다.' }, { status: 400 });
        if (kind !== 'passage' && kind !== 'question') {
            return NextResponse.json({ error: 'kind는 passage 또는 question이어야 합니다.' }, { status: 400 });
        }

        const round = await prisma.examRound.findUnique({ where: { id: parseInt(String(roundId), 10) } });
        if (!round) return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 });

        // 중복 차단
        const existing = await prisma.roundItem.findFirst({
            where: {
                roundId: round.id,
                kind,
                passageId: kind === 'passage' ? parseInt(String(passageId), 10) : null,
                questionId: kind === 'question' ? parseInt(String(questionId), 10) : null,
            },
        });
        if (existing) return NextResponse.json({ alreadyExists: true, item: existing });

        const last = await prisma.roundItem.findFirst({
            where: { roundId: round.id },
            orderBy: { order: 'desc' },
        });
        const nextOrder = (last?.order ?? -1) + 1;

        const item = await prisma.roundItem.create({
            data: {
                roundId: round.id,
                kind,
                passageId: kind === 'passage' ? parseInt(String(passageId), 10) : null,
                questionId: kind === 'question' ? parseInt(String(questionId), 10) : null,
                order: nextOrder,
            },
        });
        return NextResponse.json(item);
    } catch (error: any) {
        console.error('Add RoundItem Error:', error);
        return NextResponse.json({ error: '항목 추가 실패', detail: error?.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        await prisma.roundItem.delete({ where: { id: parseInt(id, 10) } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete RoundItem Error:', error);
        return NextResponse.json({ error: '항목 삭제 실패' }, { status: 500 });
    }
}

// 순서 일괄 변경
export async function PUT(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const { roundId, items } = body;
        if (!roundId || !Array.isArray(items)) {
            return NextResponse.json({ error: 'roundId와 items가 필요합니다.' }, { status: 400 });
        }
        await prisma.$transaction(
            items.map((it: any) =>
                prisma.roundItem.update({
                    where: { id: parseInt(String(it.id), 10) },
                    data: { order: parseInt(String(it.order), 10) },
                })
            )
        );
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Reorder RoundItem Error:', error);
        return NextResponse.json({ error: '순서 변경 실패', detail: error?.message }, { status: 500 });
    }
}
