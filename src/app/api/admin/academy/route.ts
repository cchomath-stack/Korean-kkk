import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (id) {
            const academy = await prisma.academy.findUnique({ where: { id: parseInt(id, 10) } });
            if (!academy) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });
            return NextResponse.json(academy);
        }
        const list = await prisma.academy.findMany({ orderBy: { name: 'asc' } });
        return NextResponse.json(list);
    } catch (error) {
        console.error('Fetch Academy Error:', error);
        return NextResponse.json({ error: '학원 조회 실패' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const { name, code, defaultDesign, logoUrl } = body;
        if (!name?.trim() || !code?.trim()) {
            return NextResponse.json({ error: '이름과 코드는 필수입니다.' }, { status: 400 });
        }
        const academy = await prisma.academy.create({
            data: {
                name: name.trim(),
                code: code.trim(),
                defaultDesign: defaultDesign === 'mexx' ? 'mexx' : 'oreum',
                logoUrl: logoUrl || null,
            },
        });
        return NextResponse.json(academy);
    } catch (error: any) {
        console.error('Create Academy Error:', error);
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: '같은 이름 또는 코드의 학원이 이미 있습니다.' }, { status: 409 });
        }
        return NextResponse.json({ error: '학원 생성 실패', detail: error?.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const { id, ...rest } = body;
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        const data: any = {};
        if ('name' in rest) data.name = String(rest.name).trim();
        if ('code' in rest) data.code = String(rest.code).trim();
        if ('defaultDesign' in rest) data.defaultDesign = rest.defaultDesign === 'mexx' ? 'mexx' : 'oreum';
        if ('logoUrl' in rest) data.logoUrl = rest.logoUrl || null;
        const updated = await prisma.academy.update({ where: { id: parseInt(String(id), 10) }, data });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Update Academy Error:', error);
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: '같은 이름 또는 코드의 학원이 이미 있습니다.' }, { status: 409 });
        }
        return NextResponse.json({ error: '학원 수정 실패', detail: error?.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        await prisma.academy.delete({ where: { id: parseInt(id, 10) } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete Academy Error:', error);
        return NextResponse.json({ error: '학원 삭제 실패' }, { status: 500 });
    }
}
