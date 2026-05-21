'use client'

export type VehicleType = 'auto' | 'camioneta' | 'van' | 'bus'

export function getVehicleType(nombre: string): VehicleType {
  const n = nombre.toLowerCase()
  if (n.includes('bus')) return 'bus'
  if (n.includes('van')) return 'van'
  if (n.includes('camioneta') || n.includes('suv') || n.includes('4x4') || n.includes('pickup')) return 'camioneta'
  return 'auto'
}

function AutoSVG() {
  return (
    <svg viewBox="0 0 120 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="a-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EEEEF5" />
          <stop offset="100%" stopColor="#CCCCDA" />
        </linearGradient>
        <linearGradient id="a-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#B8B8C6" />
          <stop offset="100%" stopColor="#A0A0AE" />
        </linearGradient>
        <linearGradient id="a-roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F8F8FF" />
          <stop offset="100%" stopColor="#DDDDE8" />
        </linearGradient>
        <linearGradient id="a-win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B8DCF0" />
          <stop offset="100%" stopColor="#7ABCD8" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="60" cy="67" rx="44" ry="4" fill="#00000011" />

      {/* Body */}
      <path d="M10 38 L10 56 Q10 58 13 58 L98 58 Q101 58 101 56 L101 38 Z" fill="url(#a-body)" />

      {/* Cabin */}
      <path d="M27 38 L35 23 L79 23 L88 38 Z" fill="url(#a-roof)" />

      {/* 3D side face */}
      <path d="M101 38 L109 31 L109 54 L101 56 Z" fill="url(#a-side)" />
      {/* 3D top connecting face */}
      <path d="M88 38 L96 31 L109 31 L101 38 Z" fill="#D0D0DA" />

      {/* Windshield */}
      <path d="M39 37 L46 24 L75 24 L83 37 Z" fill="url(#a-win)" fillOpacity="0.88" />
      {/* Windshield glare */}
      <path d="M41 36 L47 25 L55 25 L49 36 Z" fill="white" fillOpacity="0.22" />

      {/* Rear window */}
      <path d="M27 37 L33 24 L40 24 L35 37 Z" fill="url(#a-win)" fillOpacity="0.7" />

      {/* Side window */}
      <rect x="13" y="40" width="13" height="11" rx="2" fill="url(#a-win)" fillOpacity="0.55" />

      {/* Door crease */}
      <line x1="57" y1="37" x2="57" y2="57" stroke="#B4B4C2" strokeWidth="0.8" strokeOpacity="0.8" />

      {/* Headlight */}
      <rect x="97" y="39" width="4" height="8" rx="1.2" fill="#FFFDE0" fillOpacity="0.95" />
      <rect x="97" y="39" width="4" height="8" rx="1.2" fill="#FDD835" fillOpacity="0.25" />

      {/* Taillight */}
      <rect x="10" y="40" width="3.5" height="8" rx="1" fill="#D6A75D" fillOpacity="0.9" />

      {/* Front bumper accent */}
      <path d="M101 53 L109 50 L109 54 L101 56 Z" fill="#D6A75D" fillOpacity="0.5" />

      {/* Front wheel */}
      <circle cx="80" cy="58" r="10.5" fill="#1A1A2E" />
      <circle cx="80" cy="58" r="6.5" fill="#303048" />
      <circle cx="80" cy="58" r="3" fill="#888898" />
      <line x1="80" y1="51.5" x2="80" y2="64.5" stroke="#555565" strokeWidth="1.2" />
      <line x1="73.5" y1="58" x2="86.5" y2="58" stroke="#555565" strokeWidth="1.2" />

      {/* Rear wheel */}
      <circle cx="32" cy="58" r="10.5" fill="#1A1A2E" />
      <circle cx="32" cy="58" r="6.5" fill="#303048" />
      <circle cx="32" cy="58" r="3" fill="#888898" />
      <line x1="32" y1="51.5" x2="32" y2="64.5" stroke="#555565" strokeWidth="1.2" />
      <line x1="25.5" y1="58" x2="38.5" y2="58" stroke="#555565" strokeWidth="1.2" />
    </svg>
  )
}

function CamionetaSVG() {
  return (
    <svg viewBox="0 0 120 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="c-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8EEF5" />
          <stop offset="100%" stopColor="#C4CDD8" />
        </linearGradient>
        <linearGradient id="c-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#AABAC8" />
          <stop offset="100%" stopColor="#94A8B8" />
        </linearGradient>
        <linearGradient id="c-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5F8FF" />
          <stop offset="100%" stopColor="#D8E0EC" />
        </linearGradient>
        <linearGradient id="c-win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8D4F0" />
          <stop offset="100%" stopColor="#68B0D4" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="60" cy="67" rx="46" ry="4" fill="#00000013" />

      {/* Body — taller, boxier */}
      <path d="M10 35 L10 57 Q10 59 13 59 L99 59 Q102 59 102 57 L102 35 Z" fill="url(#c-body)" />

      {/* Roof — flatter, wider */}
      <path d="M18 35 L22 20 L92 20 L99 35 Z" fill="url(#c-roof)" />

      {/* 3D side face */}
      <path d="M102 35 L110 28 L110 55 L102 57 Z" fill="url(#c-side)" />
      {/* 3D top face */}
      <path d="M99 35 L107 28 L110 28 L102 35 Z" fill="#C8D4DC" />

      {/* Windshield — more vertical/upright */}
      <path d="M23 34 L27 21 L86 21 L92 34 Z" fill="url(#c-win)" fillOpacity="0.88" />
      <path d="M25 33 L29 22 L38 22 L34 33 Z" fill="white" fillOpacity="0.2" />

      {/* Side windows */}
      <rect x="12" y="37" width="16" height="13" rx="2" fill="url(#c-win)" fillOpacity="0.6" />
      <rect x="32" y="37" width="18" height="13" rx="2" fill="url(#c-win)" fillOpacity="0.5" />

      {/* Door lines */}
      <line x1="31" y1="34" x2="31" y2="58" stroke="#A8B8C4" strokeWidth="0.9" strokeOpacity="0.9" />
      <line x1="53" y1="34" x2="53" y2="58" stroke="#A8B8C4" strokeWidth="0.9" strokeOpacity="0.7" />

      {/* Headlight */}
      <rect x="98" y="37" width="4.5" height="9" rx="1.5" fill="#FFFDE0" fillOpacity="0.95" />
      <rect x="98" y="37" width="4.5" height="9" rx="1.5" fill="#FDD835" fillOpacity="0.3" />

      {/* Taillight */}
      <rect x="10" y="38" width="3.5" height="9" rx="1" fill="#D6A75D" fillOpacity="0.9" />

      {/* Grille accent */}
      <path d="M102 52 L110 49 L110 55 L102 57 Z" fill="#D6A75D" fillOpacity="0.45" />

      {/* Front wheel */}
      <circle cx="81" cy="59" r="11" fill="#1A1A2E" />
      <circle cx="81" cy="59" r="7" fill="#303048" />
      <circle cx="81" cy="59" r="3" fill="#888898" />
      <line x1="81" y1="52" x2="81" y2="66" stroke="#555565" strokeWidth="1.2" />
      <line x1="74" y1="59" x2="88" y2="59" stroke="#555565" strokeWidth="1.2" />

      {/* Rear wheel */}
      <circle cx="31" cy="59" r="11" fill="#1A1A2E" />
      <circle cx="31" cy="59" r="7" fill="#303048" />
      <circle cx="31" cy="59" r="3" fill="#888898" />
      <line x1="31" y1="52" x2="31" y2="66" stroke="#555565" strokeWidth="1.2" />
      <line x1="24" y1="59" x2="38" y2="59" stroke="#555565" strokeWidth="1.2" />
    </svg>
  )
}

function VanSVG() {
  return (
    <svg viewBox="0 0 120 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="v-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EAEEF8" />
          <stop offset="100%" stopColor="#C8CEE0" />
        </linearGradient>
        <linearGradient id="v-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#AEB8CC" />
          <stop offset="100%" stopColor="#96A0B4" />
        </linearGradient>
        <linearGradient id="v-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4F6FF" />
          <stop offset="100%" stopColor="#D8DCEE" />
        </linearGradient>
        <linearGradient id="v-win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A4D0EE" />
          <stop offset="100%" stopColor="#64ACCC" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="60" cy="67" rx="47" ry="4" fill="#00000015" />

      {/* Body — tall box van */}
      <path d="M8 32 L8 57 Q8 59 11 59 L99 59 Q102 59 102 57 L102 32 Z" fill="url(#v-body)" />

      {/* Roof — flat top */}
      <path d="M8 32 L12 20 L99 20 L99 32 Z" fill="url(#v-roof)" />

      {/* 3D side face */}
      <path d="M102 32 L110 25 L110 55 L102 57 Z" fill="url(#v-side)" />
      {/* 3D top face */}
      <path d="M99 32 L107 25 L110 25 L102 32 Z" fill="#C4CEDC" />

      {/* Cab windshield */}
      <path d="M74 31 L77 21 L99 21 L99 31 Z" fill="url(#v-win)" fillOpacity="0.88" />
      <path d="M76 30 L79 22 L86 22 L83 30 Z" fill="white" fillOpacity="0.2" />

      {/* Cab side window */}
      <rect x="60" y="34" width="12" height="14" rx="2" fill="url(#v-win)" fillOpacity="0.65" />

      {/* Sliding side door */}
      <rect x="25" y="33" width="30" height="20" rx="1.5" fill="#D8DCE8" fillOpacity="0.4" stroke="#B8BECE" strokeWidth="0.8" />
      {/* Door window */}
      <rect x="28" y="36" width="24" height="12" rx="1.5" fill="url(#v-win)" fillOpacity="0.55" />
      {/* Door handle */}
      <rect x="53" y="43" width="4" height="2" rx="1" fill="#A0A8B8" />

      {/* Small rear side window */}
      <rect x="10" y="34" width="11" height="13" rx="2" fill="url(#v-win)" fillOpacity="0.5" />

      {/* Door vertical lines */}
      <line x1="25" y1="32" x2="25" y2="58" stroke="#B0BAC8" strokeWidth="0.8" />
      <line x1="57" y1="32" x2="57" y2="58" stroke="#B0BAC8" strokeWidth="0.8" />
      <line x1="73" y1="32" x2="73" y2="58" stroke="#B0BAC8" strokeWidth="1" />

      {/* Headlight */}
      <rect x="98" y="34" width="4.5" height="10" rx="1.5" fill="#FFFDE0" fillOpacity="0.95" />
      <rect x="98" y="34" width="4.5" height="10" rx="1.5" fill="#FDD835" fillOpacity="0.3" />

      {/* Taillight */}
      <rect x="8" y="35" width="4" height="10" rx="1" fill="#D6A75D" fillOpacity="0.9" />

      {/* Grille */}
      <rect x="102" y="48" width="8" height="2" rx="1" fill="#D6A75D" fillOpacity="0.5" />
      <rect x="102" y="52" width="8" height="2" rx="1" fill="#D6A75D" fillOpacity="0.4" />

      {/* Front wheel */}
      <circle cx="83" cy="59" r="11" fill="#1A1A2E" />
      <circle cx="83" cy="59" r="7" fill="#303048" />
      <circle cx="83" cy="59" r="3" fill="#888898" />
      <line x1="83" y1="52" x2="83" y2="66" stroke="#555565" strokeWidth="1.2" />
      <line x1="76" y1="59" x2="90" y2="59" stroke="#555565" strokeWidth="1.2" />

      {/* Rear wheel */}
      <circle cx="28" cy="59" r="11" fill="#1A1A2E" />
      <circle cx="28" cy="59" r="7" fill="#303048" />
      <circle cx="28" cy="59" r="3" fill="#888898" />
      <line x1="28" y1="52" x2="28" y2="66" stroke="#555565" strokeWidth="1.2" />
      <line x1="21" y1="59" x2="35" y2="59" stroke="#555565" strokeWidth="1.2" />
    </svg>
  )
}

function BusSVG() {
  return (
    <svg viewBox="0 0 120 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8EDF8" />
          <stop offset="100%" stopColor="#C0C8DC" />
        </linearGradient>
        <linearGradient id="b-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#A8B4C8" />
          <stop offset="100%" stopColor="#8C98AC" />
        </linearGradient>
        <linearGradient id="b-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2F5FF" />
          <stop offset="100%" stopColor="#D4D8EC" />
        </linearGradient>
        <linearGradient id="b-win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9CCAEC" />
          <stop offset="100%" stopColor="#5AA8CC" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="56" cy="67" rx="50" ry="4" fill="#00000016" />

      {/* Body — long rectangle */}
      <path d="M6 30 L6 57 Q6 59 9 59 L100 59 Q103 59 103 57 L103 30 Z" fill="url(#b-body)" />

      {/* Roof */}
      <path d="M6 30 L9 18 L100 18 L100 30 Z" fill="url(#b-roof)" />

      {/* 3D side face */}
      <path d="M103 30 L111 23 L111 55 L103 57 Z" fill="url(#b-side)" />
      {/* 3D top face */}
      <path d="M100 30 L108 23 L111 23 L103 30 Z" fill="#BCC8D8" />

      {/* Gold stripe along body */}
      <rect x="6" y="33" width="97" height="3" fill="#D6A75D" fillOpacity="0.45" />
      <rect x="103" y="33" width="8" height="3" fill="#C09048" fillOpacity="0.5" />

      {/* Windshield — front */}
      <path d="M90 29 L92 19 L100 19 L100 29 Z" fill="url(#b-win)" fillOpacity="0.85" />
      <path d="M92 28 L94 20 L98 20 L96 28 Z" fill="white" fillOpacity="0.2" />

      {/* Windshield small side */}
      <rect x="103" y="23" width="8" height="10" rx="1" fill="url(#b-win)" fillOpacity="0.65" />

      {/* Windows row — main body */}
      {[9, 22, 35, 48, 61, 74].map((x) => (
        <rect key={x} x={x} y={37} width={11} height={12} rx={1.5} fill="url(#b-win)" fillOpacity={0.6} />
      ))}

      {/* Destination sign */}
      <rect x="9" y="19" width="30" height="8" rx="1.5" fill="#1A1A2E" fillOpacity="0.7" />
      <rect x="11" y="20.5" width="26" height="5" rx="1" fill="#D6A75D" fillOpacity="0.4" />

      {/* Door */}
      <rect x="84" y="36" width="5" height="21" rx="1" fill="#B8C0D0" fillOpacity="0.5" stroke="#A0ACBC" strokeWidth="0.6" />
      <line x1="86.5" y1="36" x2="86.5" y2="57" stroke="#A0ACBC" strokeWidth="0.6" />

      {/* Headlight */}
      <rect x="99" y="31" width="4.5" height="10" rx="1.5" fill="#FFFDE0" fillOpacity="0.95" />
      <rect x="99" y="31" width="4.5" height="10" rx="1.5" fill="#FDD835" fillOpacity="0.3" />

      {/* Taillight */}
      <rect x="6" y="32" width="4" height="10" rx="1" fill="#D6A75D" fillOpacity="0.9" />

      {/* Grille lines */}
      <rect x="103" y="43" width="8" height="2" rx="1" fill="#D6A75D" fillOpacity="0.5" />
      <rect x="103" y="47" width="8" height="2" rx="1" fill="#D6A75D" fillOpacity="0.4" />
      <rect x="103" y="51" width="8" height="2" rx="1" fill="#D6A75D" fillOpacity="0.35" />

      {/* Front wheel */}
      <circle cx="85" cy="59" r="10.5" fill="#1A1A2E" />
      <circle cx="85" cy="59" r="6.5" fill="#303048" />
      <circle cx="85" cy="59" r="2.8" fill="#888898" />
      <line x1="85" y1="52.5" x2="85" y2="65.5" stroke="#555565" strokeWidth="1.1" />
      <line x1="78.5" y1="59" x2="91.5" y2="59" stroke="#555565" strokeWidth="1.1" />

      {/* Rear wheel */}
      <circle cx="24" cy="59" r="10.5" fill="#1A1A2E" />
      <circle cx="24" cy="59" r="6.5" fill="#303048" />
      <circle cx="24" cy="59" r="2.8" fill="#888898" />
      <line x1="24" y1="52.5" x2="24" y2="65.5" stroke="#555565" strokeWidth="1.1" />
      <line x1="17.5" y1="59" x2="30.5" y2="59" stroke="#555565" strokeWidth="1.1" />
    </svg>
  )
}

const icons: Record<VehicleType, () => JSX.Element> = {
  auto: AutoSVG,
  camioneta: CamionetaSVG,
  van: VanSVG,
  bus: BusSVG,
}

interface VehicleIconProps {
  nombre: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function VehicleIcon({ nombre, className = '', size = 'md' }: VehicleIconProps) {
  const type = getVehicleType(nombre)
  const IconComponent = icons[type]

  const sizeClasses = {
    sm: 'w-14 h-10',
    md: 'w-20 h-14',
    lg: 'w-32 h-24',
  }

  return (
    <div className={`flex items-center justify-center ${sizeClasses[size]} ${className}`}>
      <IconComponent />
    </div>
  )
}
