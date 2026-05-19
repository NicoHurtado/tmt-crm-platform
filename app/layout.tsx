import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { Toaster } from '@/components/ui/sonner';

import localFont from 'next/font/local';
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const ciabatta = localFont({
    src: [
        {
            path: '../public/fonts/Ciabatta-Light.woff',
            weight: '300',
            style: 'normal',
        },
        {
            path: '../public/fonts/Ciabatta-Medium.woff',
            weight: '500',
            style: 'normal',
        },
    ],
    variable: '--font-ciabatta',
});

export const metadata: Metadata = {
    title: "Transportes Medellín Travel",
    description: "Transporte seguro y tours increíbles en Medellín",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" className={cn(inter.variable, ciabatta.variable)}>
            <body>
                <AuthProvider>{children}</AuthProvider>
                <Toaster position="top-center" richColors />
            </body>
        </html>
    );
}
