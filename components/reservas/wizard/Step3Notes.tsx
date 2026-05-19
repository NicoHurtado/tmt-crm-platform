import { ReservationFormData } from '@/types/reservation';
import { useLanguage, t } from '@/lib/i18n';

interface Step3Props {
    formData: ReservationFormData;
    updateFormData: (updates: Partial<ReservationFormData>) => void;
    onNext: () => void;
    onBack: () => void;
}

export default function Step3Notes({ formData, updateFormData, onNext, onBack }: Step3Props) {
    const { language } = useLanguage();
    const maxLength = 500;
    const currentLength = formData.notas?.length || 0;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">{t('reservas.paso3_titulo', language)}</h2>
                <p className="text-gray-600">
                    {language === 'es' ? '¿Hay algo especial que debamos saber sobre tu viaje?' : 'Is there anything special we should know about your trip?'}
                </p>
            </div>

            <div>
                <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('reservas.paso3_label', language)}
                </label>
                <textarea
                    id="notas"
                    value={formData.notas || ''}
                    onChange={(e) => updateFormData({ notas: e.target.value })}
                    placeholder={t('reservas.paso3_placeholder', language)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none resize-none"
                    rows={5}
                    maxLength={maxLength}
                />
                <div className="flex justify-between items-center mt-2">

                    <span className={`text-sm ${currentLength > maxLength * 0.9 ? 'text-red-500' : 'text-gray-400'}`}>
                        {currentLength}/{maxLength}
                    </span>
                </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500">
                    {language === 'es' ? 'Mientras más información nos proporciones, mejor podremos personalizar tu experiencia.' : 'The more information you provide, the better we can customize your experience.'}
                </p>
            </div>
        </div>
    );
}
