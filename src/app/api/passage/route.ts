import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

// 인증된 모든 사용자(일반회원 포함)가 지문 상세를 조회할 수 있는 읽기 전용 엔드포인트
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
        const passage = await prisma.passage.findUnique({
            where: { id },
            include: {
                questions: {
                    orderBy: { questionNo: 'asc' },
                    include: { tags: { include: { tag: true } } },
                },
                images: { orderBy: { order: 'asc' } },
                tags: { include: { tag: true } },
            },
        });

        if (!passage) {
            return NextResponse.json({ error: '지문을 찾을 수 없습니다.' }, { status: 404 });
        }
        return NextResponse.json(passage);
    } catch (error) {
        console.error('Fetch Passage Error:', error);
        return NextResponse.json({ error: '지문 조회에 실패했습니다.' }, { status: 500 });
    }
}
