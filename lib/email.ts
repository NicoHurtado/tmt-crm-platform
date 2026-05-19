import nodemailer from 'nodemailer';

// Crear transporter de nodemailer con Gmail
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

// Verificar configuración
export async function verifyEmailConfig() {
    try {
        await transporter.verify();
        console.log('✅ Email server ready');
        return true;
    } catch (error) {
        console.error('❌ Email server error:', error);
        return false;
    }
}
