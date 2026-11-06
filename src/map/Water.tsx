import { geoToWorld, PROJECTION_CENTER } from '../geo/projection'

/**
 * Уровень моря. Плоскость большая, чтобы закрыть Атлантику по краям карты.
 * Прозрачность позволяет видеть дно (тёмные морские тона в палитре рельефа).
 * Анимация/отражения — следующий шаг, сейчас это простой материал.
 */
export function Water() {
  const c = geoToWorld(PROJECTION_CENTER.lat, PROJECTION_CENTER.lon)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[c.x, 0, c.z]}>
      <planeGeometry args={[900, 900]} />
      <meshStandardMaterial
        color="#2c6a86"
        roughness={0.25}
        metalness={0.05}
        transparent
        opacity={0.82}
        depthWrite={false}
      />
    </mesh>
  )
}
