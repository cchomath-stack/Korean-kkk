import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();

        const {
            passageId, imageUrl, ocrText,
            keywords, answer, difficulty, questionNo,
            sourceKey, imageNo,
            year, month, grade, area, // 단독 문제용 메타
            tags, // string[]
            grammarCategoryIds, // number[]
            pdfDocumentId,
            pageNum, boxX, boxY, boxW, boxH,
        } = body;

        if (!imageUrl) {
            return NextResponse.json({ error: '이미지 URL이 필요합니다.' }, { status: 400 });
        }

        const grammarCatIds = Array.isArray(grammarCategoryIds)
            ? [...new Set(grammarCategoryIds.map((v: any) => parseInt(String(v), 10)).filter((n: number) => !Number.isNaN(n)))]
            : [];
        const toIntOrNull = (v: any) => v === '' || v == null ? null : parseInt(String(v), 10);

        const question = await prisma.question.create({
            data: {
                passageId: passageId ? parseInt(String(passageId)) : null,
                imageUrl,
                ocrText,
                keywords,
                answer,
                difficulty,
                questionNo: toIntOrNull(questionNo),
                sourceKey: sourceKey ? String(sourceKey).trim() || null : null,
                imageNo: toIntOrNull(imageNo),
                year: toIntOrNull(year),
                month: toIntOrNull(month),
                grade: toIntOrNull(grade),
                area: area || null,
                pdfDocumentId: pdfDocumentId ? parseInt(String(pdfDocumentId)) : null,
                pageNum: pageNum ?? null,
                boxX: boxX ?? null,
                boxY: boxY ?? null,
                boxW: boxW ?? null,
                boxH: boxH ?? null,
                ...(Array.isArray(tags) && tags.length > 0 && {
                    tags: {
                        create: await connectTagsForQuestion(tags),
                    },
                }),
                ...(grammarCatIds.length > 0 && {
                    grammarCategories: {
                        create: grammarCatIds.map((cid) => ({ categoryId: cid })),
                    },
                }),
            },
            include: {
                tags: { include: { tag: true } },
                grammarCategories: { include: { category: true } },
            },
        });

        return NextResponse.json(question);
    } catch (error) {
        console.error('Save Question Error:', error);
        return NextResponse.json({ error: '문제 저장에 실패했습니다.' }, { status: 500 });
    }
}

async function connectTagsForQuestion(names: string[]): Promise<{ tagId: number }[]> {
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
        const { id, tags, grammarCategoryIds, ...rest } = body;
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        const qid = parseInt(String(id), 10);

        const allowed = ['ocrText', 'answer', 'difficulty', 'questionNo', 'sourceKey', 'imageNo', 'keywords', 'year', 'month', 'grade', 'area'] as const;
        const intFields = new Set(['questionNo', 'imageNo', 'year', 'month', 'grade']);
        const data: any = {};
        for (const k of allowed) {
            if (k in rest) {
                const v = (rest as any)[k];
                if (intFields.has(k)) {
                    data[k] = v === '' || v == null ? null : parseInt(String(v), 10);
                } else {
                    data[k] = v === '' ? null : v;
                }
            }
        }

        // 태그 / 문법 갱신을 update의 nested write로 합쳐서 단일 트랜잭션 처리
        // → DB 왕복 횟수 16+ → 1 로 대폭 감소 (Neon 연결풀 압박 회피)
        if (Array.isArray(tags)) {
            const cleanedTags = [...new Set(tags.map((n: string) => String(n).trim()).filter(Boolean))];
            data.tags = {
                deleteMany: {},
                ...(cleanedTags.length > 0 && {
                    create: cleanedTags.map((name) => ({
                        tag: { connectOrCreate: { where: { name }, create: { name } } },
                    })),
                }),
            };
        }
        if (Array.isArray(grammarCategoryIds)) {
            const ids = [...new Set(grammarCategoryIds.map((v: any) => parseInt(String(v), 10)).filter((n: number) => !Number.isNaN(n)))];
            data.grammarCategories = {
                deleteMany: {},
                ...(ids.length > 0 && {
                    create: ids.map((cid) => ({ categoryId: cid })),
                }),
            };
        }

        const updated = await prisma.question.update({
            where: { id: qid },
            data,
            include: {
                tags: { include: { tag: true } },
                grammarCategories: { include: { category: true } },
            },
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Update Question Error:', error);
        // 관리자 엔드포인트이므로 실제 에러 메시지 노출 (디버그 용이성)
        return NextResponse.json(
            { error: '수정 실패', detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

        await prisma.question.delete({
            where: { id: parseInt(id) }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Question Error:', error);
        return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }
}
