import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST() {
    try {
        const existingUsersCount = await prisma.user.count();
        if (existingUsersCount > 0) {
            return NextResponse.json({ error: '이미 사용자가 존재하여 초기화할 수 없습니다.' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash('admin1234', 10);
        
        await prisma.user.create({
            data: {
                email: 'admin',
                password: hashedPassword,
                name: '시스템 관리자',
                role: 'ADMIN'
            }
        });

        return NextResponse.json({ message: '초기 관리자 계정(admin)이 성공적으로 생성되었습니다.' });
    } catch (error) {
        console.error('Init Error:', error);
        return NextResponse.json({ error: '초기 관리자 생성에 실패했습니다.' }, { status: 500 });
    }
}
