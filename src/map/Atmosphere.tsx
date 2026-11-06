import { useMemo } from 'react'
import * as THREE from 'three'
import { geoToWorld, PROJECTION_CENTER } from '../geo/projection'

interface AtmosphereProps {
  sunIntensity: number
  /** Высота солнца над горизонтом, градусы. */
  sunAngle: number
  fogDensity: number
}

const FOG_COLOR = '#c9d8e0'
const SKY_TOP = new THREE.Color('#6f93b5')
const SKY_HORIZON = new THREE.Color('#dbe5eb')

/** Солнце, рассеянный свет, туман и небо-градиент. */
export function Atmosphere({ sunIntensity, sunAngle, fogDensity }: AtmosphereProps) {
  const center = geoToWorld(PROJECTION_CENTER.lat, PROJECTION_CENTER.lon)

  // Солнце с юго-запада — рельеф читается теневыми склонами с северо-востока.
  const el = (sunAngle * Math.PI) / 180
  const az = (225 * Math.PI) / 180
  const sunPos: [number, number, number] = [
    center.x + Math.cos(el) * Math.sin(az) * 300,
    Math.sin(el) * 300,
    center.z + Math.cos(el) * Math.cos(az) * 300,
  ]

  return (
    <>
      <fogExp2 attach="fog" args={[FOG_COLOR, fogDensity]} />
      <hemisphereLight args={['#e4edf3', '#4a4a3a', 0.7]} />
      <directionalLight position={sunPos} intensity={sunIntensity} color="#fff3dc" />
      <SkyDome center={[center.x, 0, center.z]} />
    </>
  )
}

/** Купол неба с вертикальным градиентом (вершины окрашены по высоте). */
function SkyDome({ center }: { center: [number, number, number] }) {
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(1500, 32, 16)
    const pos = g.getAttribute('position')
    const colors = new Float32Array(pos.count * 3)
    const tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(pos.getY(i) / 1500, 0, 1)
      tmp.copy(SKY_HORIZON).lerp(SKY_TOP, Math.pow(t, 0.6))
      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])

  return (
    <mesh geometry={geometry} position={center}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}
