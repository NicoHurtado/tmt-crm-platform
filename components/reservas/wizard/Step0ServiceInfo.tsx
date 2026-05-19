import Image from 'next/image';
import { FiClock, FiCheckCircle } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';

interface Service {
    nombre: string;
    descripcion: string;
    imagen: string;
    duracion: string | null;
    incluye: string[];
    adicionales: any[];
}

interface Step0Props {
    service: Service;
    onNext: () => void;
    onBack: () => void;
}

export default function Step0ServiceInfo({ service, onNext, onBack }: Step0Props) {
    const { language } = useLanguage();

    return (
        <div className="space-y-6">
            <div className="relative h-64 w-full rounded-xl overflow-hidden">
                <Image
                    src={service.imagen || '/medellin.jpg'}
                    alt={service.nombre}
                    fill
                    className="object-cover"
                />
            </div>

            <div>
                <h2 className="text-3xl font-bold mb-2">{service.nombre}</h2>
                {service.duracion && (
                    <div className="flex items-center gap-2 text-gray-600 mb-4">
                        <FiClock />
                        <span>{service.duracion}</span>
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-xl font-bold mb-3">{t('reservas.paso4_detalles', language)}</h3>
                <p className="text-gray-700 leading-relaxed">{service.descripcion}</p>
            </div>

            {service.incluye && service.incluye.length > 0 && (
                <div>
                    <h3 className="text-xl font-bold mb-3">{t('reservas.paso0_incluye', language)}</h3>
                    <ul className="space-y-2">
                        {service.incluye.map((item, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <FiCheckCircle className="text-[#D6A75D] mt-1 flex-shrink-0" />
                                <span className="text-gray-700">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {service.adicionales && service.adicionales.length > 0 && (
                <div>
                    <h3 className="text-xl font-bold mb-3">{t('reservas.paso0_adicionales', language)}</h3>
                    <ul className="space-y-2">
                        {service.adicionales.map((adicional: any, index: number) => (
                            <li key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-gray-700">{adicional.nombre}</span>
                                <span className="text-[#D6A75D] font-bold">
                                    +${Number(adicional.precio).toLocaleString('es-CO')}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
