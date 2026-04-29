import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ user: null }, { status: 200 });
    }
    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, name: true, role: true },
    });
    return NextResponse.json({ user });
}
