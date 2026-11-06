import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import { getSurfacePoint, type Heightmap } from '../geo/elevation'
import { mapCamera } from '../camera/cinematicCamera'

interface CityMarkerProps {
  name: string
  lat: number
  lon: number
  heightmap: Heightmap
  exaggeration: number
}

/**
 * Маркер на поверхности рельефа. Размер маркера масштабируется от дистанции
 * камеры, чтобы он оставался видимым и на континентальном, и на городском уровне.
 */
export function CityMarker({ name, lat, lon, heightmap, exaggeration }: CityMarkerProps) {
  const groupRef = useRef<Group>(null)
  const position = useMemo(
    () => getSurfacePoint(heightmap, lat, lon, exaggeration, 0.04),
    [heightmap, lat, lon, exaggeration],
  )

  useFrame(() => {
    groupRef.current?.scale.setScalar(Math.max(0.6, mapCamera.pose.distance * 0.05))
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ffb347" emissiveIntensity={0.5} />
      </mesh>
      <Html position={[0, 0.16, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="city-label">{name}</div>
      </Html>
    </group>
  )
}
