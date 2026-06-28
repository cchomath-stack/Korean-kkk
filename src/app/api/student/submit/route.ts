import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 학생 오답노트 제출 (비로그인 공개)
// body: { roundId, studentName, school?, grade?, academyCode?, academyId?, wrongItemIds: number[] }
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { roundId, studentName, school, grade, academyCode, academyId, wrongItemIds } = body;

        if (!roundId) return NextResponse.json({ error: '회차가 필요합니다.' }, { status: 400 });
        if (!studentName?.trim()) return NextResponse.json({ error: '학생 이름이 필요합니다.' }, { status: 400 });
        if (!Array.isArray(wrongItemIds) || wrongItemIds.length === 0) {
            return NextResponse.json({ error: '틀린 문제를 1개 이상 체크해주세요.' }, { status: 400 });
        }

        const round = await prisma.examRound.findUnique({
            where: { id: parseInt(String(roundId), 10) },
        });
        if (!round || !round.isPublic) {
            return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 });
        }

        // 학원 결정
        let academy: { id: number; defaultDesign: string } | null = null;
        if (academyCode?.trim()) {
            const found = await prisma.academy.findUnique({
                where: { code: academyCode.trim() },
                select: { id: true, defaultDesign: true },
            });
            if (!found) return NextResponse.json({ error: '학원 코드가 올바르지 않습니다.' }, { status: 400 });
            academy = found;
        } else if (academyId) {
            const found = await prisma.academy.findUnique({
                where: { id: parseInt(String(academyId), 10) },
                select: { id: true, defaultDesign: true },
            });
            if (!found) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 400 });
            academy = found;
        }

        // 코드 필수 회차인데 코드 미입력
        if (round.requireAcademyCode && !academy) {
            return NextResponse.json({ error: '이 회차는 학원 코드가 필요합니다.' }, { status: 400 });
        }

        // wrongItemIds 유효성: 회차에 속한 RoundItem만 통과
        const validItems = await prisma.roundItem.findMany({
            where: {
                id: { in: wrongItemIds.map((v: any) => parseInt(String(v), 10)).filter((v: number) => !isNaN(v)) },
                roundId: round.id,
            },
            select: { id: true },
        });
        if (validItems.length === 0) {
            return NextResponse.json({ error: '유효한 문제 항목이 없습니다.' }, { status: 400 });
        }

        const created = await prisma.wrongNoteRequest.create({
            data: {
                academyId: academy?.id ?? null,
                roundId: round.id,
                studentName: studentName.trim(),
                school: school?.trim() || null,
                grade: grade == null || grade === '' ? null : parseInt(String(grade), 10),
                design: academy?.defaultDesign === 'mexx' ? 'mexx' : 'oreum',
                answers: {
                    create: validItems.map(v => ({ roundItemId: v.id })),
                },
            },
        });

        return NextResponse.json({
            success: true,
            requestId: created.id,
            message: '제출 완료. 학원에서 받아 보실 수 있습니다.',
        });
    } catch (error: any) {
        console.error('Student Submit Error:', error);
        return NextResponse.json({ error: '제출 실패', detail: error?.message }, { status: 500 });
    }
}
