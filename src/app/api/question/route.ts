import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

// 인증된 모든 사용자(일반회원 포함)가 문항 상세를 조회할 수 있는 읽기 전용 엔드포인트
// (지문 없는 단독 문제 뷰어용)
export async function GET(request: NextRequest) {
    const session = await requireUser();
    if (!session) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (!idParam || Number.isNaN(id)) {
        return NextResponse.json({ error: '유효한 ID가 필요합니다.' }, { status: 400 });
    }

    try {
        const question = await prisma.question.findUnique({
            where: { id },
            include: {
                passage: {
                    include: {
                        images: { orderBy: { order: 'asc' } },
                        tags: { include: { tag: true } },
                    },
                },
                tags: { include: { tag: true } },
                grammarCategories: { include: { category: true } },
            },
        });

        if (!question) {
            return NextResponse.json({ error: '문항을 찾을 수 없습니다.' }, { status: 404 });
        }
        return NextResponse.json(question);
    } catch (error) {
        console.error('Fetch Question Error:', error);
        return NextResponse.json({ error: '문항 조회에 실패했습니다.' }, { status: 500 });
    }
}
