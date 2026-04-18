import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const existingUsersCount = await prisma.user.count();
        return NextResponse.json({ hasUsers: existingUsersCount > 0 });
    } catch {
        return NextResponse.json({ hasUsers: true }); // 오류 시 안전하게 숨김
    }
}
