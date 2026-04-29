import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

export async function GET() {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: { id: true, email: true, name: true, role: true, createdAt: true },
        });
        return NextResponse.json(users);
    } catch (error) {
        console.error('Fetch Users Error:', error);
        return NextResponse.json({ error: '사용자 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const email = String(body.email || '').trim();
        const password = String(body.password || '');
        const name = body.name ? String(body.name).trim() : null;
        const role = body.role === 'ADMIN' ? 'ADMIN' : 'USER';

        if (!email || !password) {
            return NextResponse.json({ error: '이메일과 비밀번호는 필수입니다.' }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
        }
        if (email.length > 200 || (name && name.length > 100)) {
            return NextResponse.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
        }

        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists) {
            return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 });
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashed, name, role },
            select: { id: true, email: true, name: true, role: true, createdAt: true },
        });
        return NextResponse.json(user, { status: 201 });
    } catch (error) {
        console.error('Create User Error:', error);
        return NextResponse.json({ error: '사용자 생성에 실패했습니다.' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) return FORBIDDEN;
    try {
        const body = await request.json();
        const id = parseInt(String(body.id), 10);
        const role = body.role === 'ADMIN' ? 'ADMIN' : 'USER';
        if (Number.isNaN(id)) {
            return NextResponse.json({ error: '유효한 ID가 필요합니다.' }, { status: 400 });
        }
        // 본인 권한을 강등하면 락아웃 가능 — 막기
        if (session.userId === id && role !== 'ADMIN') {
            return NextResponse.json({ error: '자기 자신의 권한은 변경할 수 없습니다.' }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { role },
            select: { id: true, email: true, name: true, role: true, createdAt: true },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error('Update User Error:', error);
        return NextResponse.json({ error: '사용자 권한 업데이트에 실패했습니다.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) return FORBIDDEN;

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;

    if (Number.isNaN(id)) {
        return NextResponse.json({ error: '유효한 ID가 필요합니다.' }, { status: 400 });
    }
    // 본인 계정 삭제 방지
    if (session.userId === id) {
        return NextResponse.json({ error: '자기 자신의 계정은 삭제할 수 없습니다.' }, { status: 400 });
    }
    // 마지막 관리자 보호
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
        return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (target.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
            return NextResponse.json({ error: '마지막 관리자는 삭제할 수 없습니다.' }, { status: 400 });
        }
    }

    try {
        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete User Error:', error);
        return NextResponse.json({ error: '사용자 삭제에 실패했습니다.' }, { status: 500 });
    }
}
