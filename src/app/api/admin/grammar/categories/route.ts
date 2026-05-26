import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const name = String(body.name || '').trim();
        const parentId = body.parentId ? parseInt(String(body.parentId), 10) : null;
        const orderRaw = body.order;
        const order = orderRaw == null ? 0 : parseInt(String(orderRaw), 10);

        if (!name) {
            return NextResponse.json({ error: '카테고리 이름은 필수입니다.' }, { status: 400 });
        }
        if (name.length > 100) {
            return NextResponse.json({ error: '카테고리 이름이 너무 깁니다.' }, { status: 400 });
        }

        // parentId가 본인일 수 없음 (생성 시점엔 자기 자신이 없지만 안전성)
        if (parentId != null) {
            const parent = await prisma.grammarCategory.findUnique({ where: { id: parentId } });
            if (!parent) {
                return NextResponse.json({ error: '상위 카테고리를 찾을 수 없습니다.' }, { status: 400 });
            }
            // 3단계 이상 금지 (parentId의 parentId가 있으면 안 됨)
            if (parent.parentId != null) {
                return NextResponse.json({ error: '카테고리는 2단계까지만 지원합니다.' }, { status: 400 });
            }
        }

        const created = await prisma.grammarCategory.create({
            data: { name, parentId, order: Number.isNaN(order) ? 0 : order },
        });
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        console.error('Grammar category POST error:', error);
        return NextResponse.json({ error: '카테고리 생성 실패' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const id = parseInt(String(body.id), 10);
        if (Number.isNaN(id)) {
            return NextResponse.json({ error: '유효한 ID가 필요합니다.' }, { status: 400 });
        }

        const data: any = {};
        if (typeof body.name === 'string') {
            const n = body.name.trim();
            if (!n) return NextResponse.json({ error: '카테고리 이름이 비어있습니다.' }, { status: 400 });
            if (n.length > 100) return NextResponse.json({ error: '이름이 너무 깁니다.' }, { status: 400 });
            data.name = n;
        }
        if (body.order != null) {
            const o = parseInt(String(body.order), 10);
            if (!Number.isNaN(o)) data.order = o;
        }

        const updated = await prisma.grammarCategory.update({ where: { id }, data });
        return NextResponse.json(updated);
    } catch (error) {
        console.error('Grammar category PUT error:', error);
        return NextResponse.json({ error: '카테고리 수정 실패' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '', 10);
    if (Number.isNaN(id)) {
        return NextResponse.json({ error: '유효한 ID가 필요합니다.' }, { status: 400 });
    }
    try {
        // 부모/자식 모두 cascade로 자동 정리 (스키마 onDelete: Cascade)
        // 문제↔카테고리 연결도 cascade로 함께 정리됨
        await prisma.grammarCategory.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Grammar category DELETE error:', error);
        return NextResponse.json({ error: '카테고리 삭제 실패' }, { status: 500 });
    }
}
