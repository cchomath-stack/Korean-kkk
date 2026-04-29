import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

export async function POST() {
    try {
        const existingUsersCount = await prisma.user.count();
        if (existingUsersCount > 0) {
            return NextResponse.json({ error: '이미 사용자가 존재하여 초기화할 수 없습니다.' }, { status: 400 });
        }

        // 무작위 12자 패스워드 생성 (영문 대소문자+숫자, 특수문자 1자 포함)
        const alphanum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const symbols = '!@#$%^&*';
        const buf = randomBytes(11);
        let plainPassword = '';
        for (let i = 0; i < 11; i++) plainPassword += alphanum[buf[i] % alphanum.length];
        plainPassword += symbols[randomBytes(1)[0] % symbols.length];

        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        await prisma.user.create({
            data: {
                email: 'admin',
                password: hashedPassword,
                name: '시스템 관리자',
                role: 'ADMIN',
            },
        });

        return NextResponse.json({
            message: '초기 관리자 계정이 생성되었습니다. 아래 비밀번호는 이 화면에서만 확인할 수 있으니 반드시 저장해두세요.',
            email: 'admin',
            password: plainPassword,
        });
    } catch (error) {
        console.error('Init Error:', error);
        return NextResponse.json({ error: '초기 관리자 생성에 실패했습니다.' }, { status: 500 });
    }
}
