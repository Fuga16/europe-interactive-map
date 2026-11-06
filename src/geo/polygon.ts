/** Точка в формате [долгота, широта]. */
export type LonLat = readonly [number, number]

/** Проверка, лежит ли точка внутри полигона (ray casting). */
export function pointInPolygon(lon: number, lat: number, polygon: readonly LonLat[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const crosses = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}
