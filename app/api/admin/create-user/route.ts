import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { secret } = await request.json();

        // Simple security check
        if (!process.env.ADMIN_BOOTSTRAP_SECRET || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
            return NextResponse.json(
                { error: 'Secret incorrecto' },
                { status: 403 }
            );
        }

        const email = 'admin@transportesmedellin.com';
        const password = process.env.ADMIN_PASSWORD;

        if (!password) {
            return NextResponse.json(
                { error: 'ADMIN_PASSWORD no configurado en variables de entorno' },
                { status: 500 }
            );
        }

        const existingAdmin = await prisma.user.findUnique({ where: { email } });

        if (existingAdmin) {
            return NextResponse.json(
                { message: 'El usuario admin ya existe' },
                { status: 200 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: { email, password: hashedPassword },
        });

        return NextResponse.json({
            message: 'Usuario administrador creado exitosamente',
            email,
            warning: 'IMPORTANTE: Cambia la contraseña después del primer login',
        });
    } catch (error: any) {
        console.error('Error creating admin:', error);
        return NextResponse.json(
            {
                error: 'Error al crear administrador',
                details: error.message
            },
            { status: 500 }
        );
    }
}
