/**
 * Formats a date from the database (which is stored as ISO string) to a localized date string
 * without timezone conversion issues.
 * 
 * This function extracts the date portion from the ISO string and formats it manually
 * to avoid timezone conversion problems that occur when users are in different timezones.
 * 
 * @param date - Date object or ISO string from the database
 * @param locale - Locale for formatting ('es-CO' or 'en-US')
 * @param format - Format type: 'short' (DD/MM/YYYY), 'long' (D de mes de YYYY), or 'medium' (DD/MM/YY)
 * @returns Formatted date string
 */
export function formatReservationDate(
    date: Date | string,
    locale: 'es-CO' | 'en-US' = 'es-CO',
    format: 'short' | 'long' | 'medium' = 'short'
): string {
    try {
        // Convert to Date object if it's a string
        const dateObj = typeof date === 'string' ? new Date(date) : date;

        // Extract the date portion from ISO string (YYYY-MM-DD)
        const dateStr = dateObj.toISOString().split('T')[0];
        const [year, month, day] = dateStr.split('-');

        if (format === 'short') {
            // DD/MM/YYYY
            return `${day}/${month}/${year}`;
        } else if (format === 'medium') {
            // DD/MM/YY
            return `${day}/${month}/${year.slice(2)}`;
        } else {
            // long format: "5 de diciembre de 2025" or "December 5, 2025"
            const monthNames = locale === 'es-CO'
                ? ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
                : ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

            const monthName = monthNames[parseInt(month) - 1];
            const dayNum = parseInt(day);

            if (locale === 'es-CO') {
                return `${dayNum} de ${monthName} de ${year}`;
            } else {
                return `${monthName} ${dayNum}, ${year}`;
            }
        }
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid date';
    }
}
