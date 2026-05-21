import Image from 'next/image'

export type VehicleType = 'auto' | 'camioneta' | 'van' | 'bus'

const VEHICLE_IMAGES: Record<VehicleType, string> = {
  auto:      'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779384382/vehicles/auto.png',
  camioneta: 'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779384384/vehicles/camioneta.png',
  van:       'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779384385/vehicles/van.png',
  bus:       'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779384386/vehicles/bus.png',
}

export function getVehicleType(nombre: string): VehicleType {
  const n = nombre.toLowerCase()
  if (n.includes('bus')) return 'bus'
  if (n.includes('van')) return 'van'
  if (n.includes('camioneta') || n.includes('suv') || n.includes('4x4') || n.includes('pickup')) return 'camioneta'
  return 'auto'
}

const SIZE_PX = {
  sm: { w: 56, h: 40 },
  md: { w: 80, h: 56 },
  lg: { w: 128, h: 96 },
}

interface VehicleIconProps {
  nombre: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function VehicleIcon({ nombre, className = '', size = 'md' }: VehicleIconProps) {
  const type = getVehicleType(nombre)
  const { w, h } = SIZE_PX[size]

  return (
    <Image
      src={VEHICLE_IMAGES[type]}
      alt={type}
      width={w}
      height={h}
      className={`object-contain ${className}`}
    />
  )
}
