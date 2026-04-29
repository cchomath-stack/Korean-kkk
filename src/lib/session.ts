import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET;
if (!secretKey || secretKey.length < 32) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be set to a 32+ character random string in production.');
    }
    console.warn('[session] JWT_SECRET is missing or too short — using insecure dev fallback. Set JWT_SECRET (32+ chars) before deploying.');
}
const key = new TextEncoder().encode(secretKey || 'oreum-dev-only-fallback-do-not-use-in-prod-32chars');

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch {
        return null;
    }
}

export async function createSession(userId: number, role: string) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
    const session = await encrypt({ userId, role, expires });

    (await cookies()).set('session', session, {
        expires,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
    });
}

export async function requireAdmin() {
    const session = await getSession();
    if (!session?.userId || session.role !== 'ADMIN') {
        return null;
    }
    return session;
}

export async function requireUser() {
    const session = await getSession();
    if (!session?.userId) return null;
    return session;
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return null;
    return await decrypt(session);
}

export async function deleteSession() {
    (await cookies()).set('session', '', { expires: new Date(0), path: '/' });
}
