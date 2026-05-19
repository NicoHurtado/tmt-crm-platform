export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import MarkdownRenderer from '@/components/MarkdownRenderer';

const CONTENT_KEY = 'terminos_condiciones';

export default async function TerminosCondicionesPage() {
    const record = await prisma.siteContent.findUnique({ where: { key: CONTENT_KEY } });
    const content = record?.value?.trim() ?? '';

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">
                    Términos y Condiciones
                </h1>
                {content ? (
                    <MarkdownRenderer content={content} />
                ) : (
                    <p className="text-gray-400 italic">
                        Aún no se ha configurado el contenido. Edítalo desde el panel de administración.
                    </p>
                )}
            </div>
        </div>
    );
}
