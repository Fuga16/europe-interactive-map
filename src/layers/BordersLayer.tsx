import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { FRANCE_OUTLINE } from '../data/france'
import { getSurfacePoint, type Heightmap } from '../geo/elevation'

interface BordersLayerProps {
  heightmap: Heightmap
  exaggeration: number
}

/**
 * Контур-демо: полигон, "уложенный" на рельеф. Тот же подход потом пойдёт
 * для исторических границ (GeoJSON -> точки -> getSurfacePoint).
 */
export function BordersLayer({ heightmap, exaggeration }: BordersLayerProps) {
  const points = useMemo(() => {
    const pts = FRANCE_OUTLINE.map(([lon, lat]) =>
      getSurfacePoint(heightmap, lat, lon, exaggeration, 0.05),
    )
    pts.push(pts[0].clone()) // замыкаем контур
    return pts
  }, [heightmap, exaggeration])

  return <Line points={points} color="#ffe3a3" lineWidth={2} />
}
