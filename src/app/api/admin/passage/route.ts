import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('Save Passage Request Body:', body);

        const { imageUrl, ocrText, year, month, grade, source, office, questionRange } = body;

        // 단독 문제 모드의 경우 이미지가 없을 수 있으므로 체크 완화
        // if (!imageUrl) {
        //     return NextResponse.json({ error: '이미지 URL이 필요합니다.' }, { status: 400 });
        // }

        const passage = await prisma.passage.create({
            data: {
                imageUrl,
                ocrText,
                year: year ? parseInt(String(year)) : null,
                month: month ? parseInt(String(month)) : null,
                grade: grade ? parseInt(String(grade)) : null,
                source,
                office,
                questionRange,
            },
        });

        console.log('Passage Saved Successfully:', passage.id);
        return NextResponse.json(passage);
    } catch (error: any) {
        console.error('Save Passage Error:', error);
        return NextResponse.json({
            error: '지문 저장에 실패했습니다.',
            details: error.message
        }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...data } = body;

        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

        const updated = await prisma.passage.update({
            where: { id: parseInt(String(id)) },
            data: {
                ...data,
                year: data.year ? parseInt(String(data.year)) : null,
                month: data.month ? parseInt(String(data.month)) : null,
                grade: data.grade ? parseInt(String(data.grade)) : null,
            }
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: '수정 실패', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

        // 먼저 연결된 질문들을 삭제 (또는 Cascade 설정이 되어있다면 자동 삭제)
        await prisma.question.deleteMany({
            where: { passageId: parseInt(id) }
        });

        await prisma.passage.delete({
            where: { id: parseInt(id) }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: '삭제 실패', details: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        }

        const passage = await prisma.passage.findUnique({
            where: { id: parseInt(id) },
            include: {
                questions: {
                    orderBy: { questionNo: 'asc' },
                },
            },
        });

        if (!passage) {
            return NextResponse.json({ error: '지문을 찾을 수 없습니다.' }, { status: 404 });
        }

        return NextResponse.json(passage);
    } catch (error: any) {
        console.error('Fetch Passage Error:', error);
        return NextResponse.json({ error: '조회 실패', details: error.message }, { status: 500 });
    }
}
