import { Vector3 } from 'three'
import {
  MAP_BOUNDS,
  VERTICAL_SCALE,
  geoToWorld,
  worldToGeo,
} from './projection'

/**
 * Данные рельефа (DEM).
 *
 * Источник: AWS Terrain Tiles, кодировка Terrarium (без API-ключа).
 * Тайлы Web Mercator, zoom 6. Они склеиваются в один холст, из которого
 * берём высоты в равномерную сетку GRID_COLS x GRID_ROWS (по градусам).
 * Эта же сетка используется и для построения геометрии, и для расчёта
 * высоты маркеров — поэтому они всегда совпадают.
 *
 * Если тайлы недоступны (нет сети, CORS и т.п.) — включается резервный
 * рельеф из нескольких гауссиан (source = 'fallback'). Это только для
 * проверки визуала, не для реальной географии.
 *
 * Атрибуция для UI: "Terrain Tiles on AWS (SRTM, ASTER, NED, ...)".
 */

export const GRID_COLS = 512
export const GRID_ROWS = 360

const TILE_ZOOM = 6
const TILE_SIZE = 256

export interface Heightmap {
  cols: number
  rows: number
  /** Высоты в метрах. Строка 0 — север, колонка 0 — запад. */
  data: Float32Array
  source: 'terrarium' | 'fallback'
}

function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z
}

function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Не удалось загрузить тайл: ${url}`))
    img.src = url
  })
}

/** Загружает рельеф; при любой ошибке возвращает резервный. */
export async function loadHeightmap(
  onProgress?: (progress: number) => void,
): Promise<Heightmap> {
  try {
    return await loadTerrarium(onProgress)
  } catch (error) {
    console.warn('[elevation] Тайлы недоступны, используем резервный рельеф.', error)
    return buildFallbackHeightmap()
  }
}

async function loadTerrarium(onProgress?: (progress: number) => void): Promise<Heightmap> {
  const z = TILE_ZOOM
  const x0 = Math.floor(lonToTileX(MAP_BOUNDS.minLon, z))
  const x1 = Math.floor(lonToTileX(MAP_BOUNDS.maxLon, z))
  const y0 = Math.floor(latToTileY(MAP_BOUNDS.maxLat, z))
  const y1 = Math.floor(latToTileY(MAP_BOUNDS.minLat, z))
  const tilesW = x1 - x0 + 1
  const tilesH = y1 - y0 + 1

  const canvas = document.createElement('canvas')
  canvas.width = tilesW * TILE_SIZE
  canvas.height = tilesH * TILE_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D-контекст недоступен')

  const total = tilesW * tilesH
  let done = 0
  const jobs: Promise<void>[] = []
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`
      jobs.push(
        loadImage(url).then((img) => {
          ctx.drawImage(img, (tx - x0) * TILE_SIZE, (ty - y0) * TILE_SIZE)
          done++
          onProgress?.(done / total)
        }),
      )
    }
  }
  await Promise.all(jobs)

  // Бросит исключение, если холст "испорчен" (CORS) — тогда уйдём в fallback.
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const width = canvas.width

  const data = new Float32Array(GRID_COLS * GRID_ROWS)
  for (let r = 0; r < GRID_ROWS; r++) {
    const lat = lerp(MAP_BOUNDS.maxLat, MAP_BOUNDS.minLat, r / (GRID_ROWS - 1))
    const py = clamp(
      Math.floor((latToTileY(lat, z) - y0) * TILE_SIZE),
      0,
      canvas.height - 1,
    )
    for (let c = 0; c < GRID_COLS; c++) {
      const lon = lerp(MAP_BOUNDS.minLon, MAP_BOUNDS.maxLon, c / (GRID_COLS - 1))
      const px = clamp(Math.floor((lonToTileX(lon, z) - x0) * TILE_SIZE), 0, width - 1)
      const i = (py * width + px) * 4
      // Terrarium: высота = R*256 + G + B/256 - 32768
      data[r * GRID_COLS + c] = pixels[i] * 256 + pixels[i + 1] + pixels[i + 2] / 256 - 32768
    }
  }

  onProgress?.(1)
  return { cols: GRID_COLS, rows: GRID_ROWS, data, source: 'terrarium' }
}

/* ---------- Резервный рельеф ---------- */

const FALLBACK_RANGES = [
  { lat: 46.3, lon: 9.5, amp: 3000, sLat: 0.8, sLon: 2.0 }, // Альпы
  { lat: 42.7, lon: 0.5, amp: 2000, sLat: 0.4, sLon: 1.4 }, // Пиренеи
  { lat: 46.5, lon: 25.0, amp: 1500, sLat: 1.0, sLon: 2.2 }, // Карпаты
  { lat: 43.0, lon: 13.5, amp: 1000, sLat: 1.5, sLon: 0.5 }, // Апеннины
  { lat: 62.0, lon: 12.0, amp: 1000, sLat: 4.0, sLon: 2.5 }, // Скандинавия
]

function buildFallbackHeightmap(): Heightmap {
  const data = new Float32Array(GRID_COLS * GRID_ROWS)
  for (let r = 0; r < GRID_ROWS; r++) {
    const lat = lerp(MAP_BOUNDS.maxLat, MAP_BOUNDS.minLat, r / (GRID_ROWS - 1))
    for (let c = 0; c < GRID_COLS; c++) {
      const lon = lerp(MAP_BOUNDS.minLon, MAP_BOUNDS.maxLon, c / (GRID_COLS - 1))
      let h = 120 + 40 * Math.sin(lon * 0.9) * Math.cos(lat * 0.7)
      for (const range of FALLBACK_RANGES) {
        const dx = (lon - range.lon) / range.sLon
        const dy = (lat - range.lat) / range.sLat
        h += range.amp * Math.exp(-(dx * dx + dy * dy))
      }
      data[r * GRID_COLS + c] = h
    }
  }
  return { cols: GRID_COLS, rows: GRID_ROWS, data, source: 'fallback' }
}

/* ---------- Выборка высот ---------- */

/** Билинейная выборка высоты в метрах по lat/lon. */
export function sampleMeters(hm: Heightmap, lat: number, lon: number): number {
  const fx = clamp(((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * (hm.cols - 1), 0, hm.cols - 1)
  const fy = clamp(((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * (hm.rows - 1), 0, hm.rows - 1)
  const c0 = Math.floor(fx)
  const r0 = Math.floor(fy)
  const c1 = Math.min(c0 + 1, hm.cols - 1)
  const r1 = Math.min(r0 + 1, hm.rows - 1)
  const tx = fx - c0
  const ty = fy - r0
  const h00 = hm.data[r0 * hm.cols + c0]
  const h10 = hm.data[r0 * hm.cols + c1]
  const h01 = hm.data[r1 * hm.cols + c0]
  const h11 = hm.data[r1 * hm.cols + c1]
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), ty)
}

/** Мировая высота поверхности (Y) в точке x/z с учётом exaggeration. */
export function groundHeightAt(hm: Heightmap, x: number, z: number, exaggeration: number): number {
  const { lat, lon } = worldToGeo(x, z)
  return sampleMeters(hm, lat, lon) * VERTICAL_SCALE * exaggeration
}

/**
 * Точка, стоящая на поверхности рельефа, + подъём над ней.
 * Этим пользуются маркеры городов, битв, стрелки маршрутов.
 */
export function getSurfacePoint(
  hm: Heightmap,
  lat: number,
  lon: number,
  exaggeration: number,
  lift = 0,
): Vector3 {
  const y = sampleMeters(hm, lat, lon) * VERTICAL_SCALE * exaggeration + lift
  return geoToWorld(lat, lon, y)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
