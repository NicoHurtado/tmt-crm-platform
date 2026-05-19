import Link from 'next/link';
import { FiCheckCircle, FiHome, FiEye } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';

interface Step5Props {
    reservationCode: string;
    isAlly: boolean;
    onClose: () => void;
}

export default function Step5Confirmation({ reservationCode, isAlly, onClose }: Step5Props) {
    const { language } = useLanguage();

    return (
        <div className="text-center space-y-6 py-8">
            <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${isAlly ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                <FiCheckCircle className={`${isAlly ? 'text-blue-600' : 'text-green-600'}`} size={48} />
            </div>

            <div>
                <h2 className="text-3xl font-bold mb-2">
                    {isAlly
                        ? (language === 'es' ? '¡Reserva Registrada!' : 'Booking Registered!')
                        : (language === 'es' ? '¡Reserva Confirmada!' : 'Booking Confirmed!')}
                </h2>
                <p className="text-gray-600 text-lg">
                    {isAlly
                        ? (language === 'es' ? 'El cliente deberá pagar en efectivo al momento del viaje' : 'The client must pay in cash at the time of the trip')
                        : (language === 'es' ? 'Te hemos enviado un email con los detalles. Ahora debes realizar el pago.' : 'We have sent you an email with the details. Now you must make the payment.')
                    }
                </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 inline-block">
                <p className="text-sm text-gray-600 mb-2">{language === 'es' ? 'Código de Reserva' : 'Booking Code'}</p>
                <p className="text-4xl font-bold text-[#D6A75D] tracking-wider">{reservationCode}</p>
            </div>

            {!isAlly && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                        <strong>{language === 'es' ? 'Importante:' : 'Important:'}</strong> {language === 'es' ? 'Tu reserva estará confirmada una vez completes el pago.' : 'Your booking will be confirmed once you complete the payment.'}
                    </p>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-6 max-w-md mx-auto">
                {isAlly ? (
                    <>
                        <Link
                            href="/reservas"
                            className="flex-1 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold py-3 px-6 rounded-lg transition-all text-center flex items-center justify-center gap-2"
                        >
                            <FiHome /> {language === 'es' ? 'Ver Mis Reservas' : 'View My Bookings'}
                        </Link>
                        <button
                            onClick={onClose}
                            className="flex-1 border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            {language === 'es' ? 'Nueva Reserva' : 'New Booking'}
                        </button>
                    </>
                ) : (
                    <>
                        <Link
                            href={`/tracking/${reservationCode}`}
                            className="flex-1 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold py-3 px-6 rounded-lg transition-all text-center flex items-center justify-center gap-2"
                        >
                            <FiEye /> {language === 'es' ? 'Ver Mi Reserva' : 'View My Booking'}
                        </Link>
                        <button
                            onClick={onClose}
                            className="flex-1 border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            {language === 'es' ? 'Volver al Catálogo' : 'Back to Catalog'}
                        </button>
                    </>
                )}
            </div>

            {isAlly && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>{language === 'es' ? 'Link para el cliente:' : 'Link for the client:'}</strong>
                    </p>
                    <p className="text-sm text-blue-600 font-mono mt-2 break-all">
                        {typeof window !== 'undefined' && `${window.location.origin}/tracking/${reservationCode}?hotel=true`}
                    </p>
                </div>
            )}
        </div>
    );
}
