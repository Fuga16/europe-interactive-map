import { Vector3 } from 'three'

/**
 * ЕДИНСТВЕННОЕ место, где живёт преобразование географических координат в мировые.
 *
 * Схема:
 *   lat/lon (градусы)  --geoToWorld-->  Three.js (x, y, z)
 *
 *  - Проекция: равнопромежуточная (equirectangular), центрированная на Европе.
 *  - X: восток, Z: юг (+Z смотрит на юг), Y: высота.
 *  - Масштаб по широте: UNITS_PER_DEGREE единиц на градус.
 *  - По долготе масштаб умножается на cos(широты центра), чтобы формы
 *    не были сильно растянуты по горизонтали.
 *
 * Высота (Y) добавляется отдельно: см. elevation.ts (getSurfacePoint).
 * Если когда-нибудь понадобится Меркатор — меняется только этот файл.
 */

/** Границы карты, которую мы строим, в градусах. */
export const MAP_BOUNDS = {
  minLat: 34,
  maxLat: 72,
  minLon: -12,
  maxLon: 42,
} as const

/** Точка, в которой мировые координаты равны (0, 0). */
export const PROJECTION_CENTER = { lat: 52, lon: 15 } as const

/** Сколько мировых единиц в одном градусе широты. */
export const UNITS_PER_DEGREE = 10

/** Сколько километров в одной мировой единице (~11.1 км). */
export const KM_PER_UNIT = 111.32 / UNITS_PER_DEGREE

/**
 * Вертикальный масштаб: единиц Y на один метр высоты при exaggeration = 1.
 * Это в 10 раз больше "реального" масштаба — рельеф читается лучше.
 * Итоговая высота = метры * VERTICAL_SCALE * terrainExaggeration.
 */
export const VERTICAL_SCALE = 10 / (KM_PER_UNIT * 1000)

const COS_CENTER = Math.cos((PROJECTION_CENTER.lat * Math.PI) / 180)

/** Географические координаты -> мировые координаты на уровне y. */
export function geoToWorld(lat: number, lon: number, y = 0): Vector3 {
  const x = (lon - PROJECTION_CENTER.lon) * UNITS_PER_DEGREE * COS_CENTER
  const z = -(lat - PROJECTION_CENTER.lat) * UNITS_PER_DEGREE
  return new Vector3(x, y, z)
}

/** Обратное преобразование: мировые (x, z) -> lat/lon. */
export function worldToGeo(x: number, z: number): { lat: number; lon: number } {
  const lon = x / (UNITS_PER_DEGREE * COS_CENTER) + PROJECTION_CENTER.lon
  const lat = -z / UNITS_PER_DEGREE + PROJECTION_CENTER.lat
  return { lat, lon }
}
