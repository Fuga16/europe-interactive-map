import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Heightmap } from '../geo/elevation'
import { MAP_BOUNDS, VERTICAL_SCALE, geoToWorld } from '../geo/projection'
import { pointInPolygon, type LonLat } from '../geo/polygon'

interface TerrainProps {
  heightmap: Heightmap
  exaggeration: number
  wireframe?: boolean
  /** Полигон, который подсвечиваем тоном (например, Франция). */
  highlight?: readonly LonLat[]
}

/**
 * Hypsometric-палитра: цвет по высоте (метры).
 * Стиль "стратегической карты": приглушённые зелёные -> охра -> серо-коричневые
 * -> снег. Море — тёмно-синее, с глубиной темнее.
 */
const PALETTE: [number, string][] = [
  [-4000, '#0b2638'],
  [-200, '#1b4560'],
  [0, '#2a5b73'],
  [1, '#6f8a4a'],
  [300, '#7f9450'],
  [800, '#a2a15d'],
  [1400, '#b59c63'],
  [2000, '#8c7a58'],
  [2600, '#8a8782'],
  [3200, '#eef1f1'],
]
const PALETTE_COLORS = PALETTE.map(([h, hex]) => [h, new THREE.Color(hex)] as const)
const HIGHLIGHT = new THREE.Color('#c98f4a')

function colorForHeight(meters: number, out: THREE.Color): THREE.Color {
  if (meters <= PALETTE_COLORS[0][0]) return out.copy(PALETTE_COLORS[0][1])
  for (let i = 1; i < PALETTE_COLORS.length; i++) {
    const [h1, c1] = PALETTE_COLORS[i]
    if (meters <= h1) {
      const [h0, c0] = PALETTE_COLORS[i - 1]
      const t = (meters - h0) / (h1 - h0)
      return out.copy(c0).lerp(c1, t)
    }
  }
  return out.copy(PALETTE_COLORS[PALETTE_COLORS.length - 1][1])
}

/**
 * Строит геометрию из карты высот. Вершины лежат в той же сетке, что и
 * данные: это гарантирует, что маркеры (getSurfacePoint) стоят на поверхности.
 */
function buildTerrainGeometry(
  hm: Heightmap,
  exaggeration: number,
  highlight?: readonly LonLat[],
): THREE.BufferGeometry {
  const { cols, rows, data } = hm
  const positions = new Float32Array(cols * rows * 3)
  const colors = new Float32Array(cols * rows * 3)
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6)
  const tmp = new THREE.Color()

  for (let r = 0; r < rows; r++) {
    const lat = THREE.MathUtils.lerp(MAP_BOUNDS.maxLat, MAP_BOUNDS.minLat, r / (rows - 1))
    for (let c = 0; c < cols; c++) {
      const lon = THREE.MathUtils.lerp(MAP_BOUNDS.minLon, MAP_BOUNDS.maxLon, c / (cols - 1))
      const idx = r * cols + c
      const meters = data[idx]

      const p = geoToWorld(lat, lon, meters * VERTICAL_SCALE * exaggeration)
      positions[idx * 3] = p.x
      positions[idx * 3 + 1] = p.y
      positions[idx * 3 + 2] = p.z

      colorForHeight(meters, tmp)
      if (highlight && pointInPolygon(lon, lat, highlight)) tmp.lerp(HIGHLIGHT, 0.45)
      colors[idx * 3] = tmp.r
      colors[idx * 3 + 1] = tmp.g
      colors[idx * 3 + 2] = tmp.b
    }
  }

  let k = 0
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c
      const b = a + 1
      const d2 = a + cols
      const e = d2 + 1
      // Порядок обхода: нормали смотрят вверх.
      indices[k++] = a
      indices[k++] = d2
      indices[k++] = b
      indices[k++] = b
      indices[k++] = d2
      indices[k++] = e
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals() // даёт рельефную "hillshade"-подсветку
  return geometry
}

export function Terrain({ heightmap, exaggeration, wireframe = false, highlight }: TerrainProps) {
  const geometry = useMemo(
    () => buildTerrainGeometry(heightmap, exaggeration, highlight),
    [heightmap, exaggeration, highlight],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0} wireframe={wireframe} />
    </mesh>
  )
}
