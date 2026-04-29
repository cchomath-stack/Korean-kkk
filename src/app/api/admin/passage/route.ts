import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();

        const {
            imageUrl, ocrText,
            year, month, grade,
            source, office, area,
            questionRange, startNo, endNo,
            // 새 형식 (bulk):
            images,   // [{ imageUrl, ocrText, order, pageNum, boxX, boxY, boxW, boxH }]
            tags,     // string[]
            pdfDocumentId,
        } = body;

        // 멀티 이미지 묶음 모드: images 배열이 오면 PassageImage로 저장
        const useMulti = Array.isArray(images) && images.length > 0;

        const passage = await prisma.passage.create({
            data: {
                imageUrl: useMulti ? images[0].imageUrl : imageUrl,
                ocrText: useMulti ? images[0].ocrText : ocrText,
                year: year ? parseInt(String(year)) : null,
                month: month ? parseInt(String(month)) : null,
                grade: grade ? parseInt(String(grade)) : null,
                source,
                office,
                area,
                questionRange: questionRange || (startNo && endNo ? `${startNo}~${endNo}` : null),
                startNo: startNo ? parseInt(String(startNo)) : null,
                endNo: endNo ? parseInt(String(endNo)) : null,
                ...(pdfDocumentId && { pdfDocumentId: parseInt(String(pdfDocumentId)) }),
                ...(useMulti && {
                    images: {
                        create: images.map((img: any, i: number) => ({
                            imageUrl: img.imageUrl,
                            ocrText: img.ocrText ?? null,
                            order: typeof img.order === 'number' ? img.order : i,
                            pageNum: img.pageNum ?? null,
                            boxX: img.boxX ?? null,
                            boxY: img.boxY ?? null,
                            boxW: img.boxW ?? null,
                            boxH: img.boxH ?? null,
                        })),
                    },
                }),
                ...(Array.isArray(tags) && tags.length > 0 && {
                    tags: {
                        create: await connectTags(tags),
                    },
                }),
            },
            include: { images: true, tags: { include: { tag: true } } },
        });

        return NextResponse.json(passage);
    } catch (error) {
        console.error('Save Passage Error:', error);
        return NextResponse.json({ error: '지문 저장에 실패했습니다.' }, { status: 500 });
    }
}

// 태그 이름 배열 → upsert 후 PassageTag/QuestionTag create payload
async function connectTags(names: string[]): Promise<{ tagId: number }[]> {
    const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const result: { tagId: number }[] = [];
    for (const name of cleaned) {
        const t = await prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name },
        });
        result.push({ tagId: t.id });
    }
    return result;
}

export async function PUT(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
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
    } catch (error) {
        console.error('Update Passage Error:', error);
        return NextResponse.json({ error: '수정 실패' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
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
    } catch (error) {
        console.error('Delete Passage Error:', error);
        return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }
}

// 관리자 도구용 GET (USER 가 viewer 페이지에서 쓰는 GET 은 /api/passage 로 분리됨)
export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
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
    } catch (error) {
        console.error('Fetch Passage Error:', error);
        return NextResponse.json({ error: '조회 실패' }, { status: 500 });
    }
}
