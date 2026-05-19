/**
 * Service Order Utility
 * 
 * Defines the display order for services across the platform.
 * This order applies to:
 * - Hotel/Airbnb links
 * - Ally code links
 * - Regular users without any ally
 * 
 * Services not in this list will appear at the end in alphabetical order.
 */

/**
 * Additional name-based priority constants
 */
const AIRPORT_PRIORITY = 1;
const MUNICIPAL_PRIORITY = 102;

/**
 * Additional name-based ordering for services with the same tipo
 * This helps distinguish between services like "Comuna 13" and "City Tour"
 * which might have the same tipo but different names.
 */
const NAME_ORDER_MAP: Record<string, number> = {
  // City Tour variations
  'comuna 13': 4,
  'compartido': 2,
  'graffiti': 4,
  'café': 5,
  'coffee': 5,
  'city tour': 3,
  'citytour': 3,
};

interface ServiceForSorting {
  nombre: any; // Can be string, object, or JsonValue from Prisma
  esAeropuerto?: boolean;
  esMunicipal?: boolean;
  esCompartido?: boolean;
  orden?: number; // Display order from database
  [key: string]: any;
}

/**
 * Extracts text from multi-language field
 */
function getServiceName(service: ServiceForSorting): string {
  // Handle null or undefined
  if (!service.nombre) {
    return '';
  }

  // Handle string
  if (typeof service.nombre === 'string') {
    return service.nombre.toLowerCase();
  }

  // Handle object (multi-language)
  if (typeof service.nombre === 'object') {
    const nombre = service.nombre as any;
    return (nombre.es || nombre.en || '').toLowerCase();
  }

  return '';
}

/**
 * Gets the priority order for a service based on boolean flags and name
 */
function getServicePriority(service: ServiceForSorting): number {
  // Flag-based ordering takes highest precedence
  if (service.esAeropuerto) return AIRPORT_PRIORITY;
  if (service.esMunicipal) return MUNICIPAL_PRIORITY;

  // Name-based ordering for other services
  const serviceName = getServiceName(service);
  for (const [nameKey, namePriority] of Object.entries(NAME_ORDER_MAP)) {
    if (serviceName.includes(nameKey)) {
      return namePriority;
    }
  }

  // Default: very low priority (will appear at the end)
  return 1000;
}

/**
 * Sorts services according to the defined order
 * 
 * Priority:
 * 1. Database `orden` field (if present) - allows admin to customize order
 * 2. Hardcoded tipo/name priorities (fallback)
 * 3. Alphabetical by name
 * 
 * @param services - Array of services to sort
 * @returns Sorted array of services
 */
export function sortServicesByPriority<T extends ServiceForSorting>(services: T[]): T[] {
  return [...services].sort((a, b) => {
    // Primary sort: database orden field (lower = higher priority)
    const ordenA = a.orden ?? 999;
    const ordenB = b.orden ?? 999;

    if (ordenA !== ordenB) {
      return ordenA - ordenB;
    }

    // Secondary sort: hardcoded priorities (for backward compatibility)
    const priorityA = getServicePriority(a);
    const priorityB = getServicePriority(b);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Tertiary sort: alphabetically by name
    const nameA = getServiceName(a);
    const nameB = getServiceName(b);
    return nameA.localeCompare(nameB);
  });
}



