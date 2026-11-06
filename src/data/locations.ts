/**
 * Демо-локации для кинематографических перелётов.
 * altitudeKm — расстояние камеры до точки фокуса в километрах.
 */
export interface LocationPreset {
  label: string
  lat: number
  lon: number
  altitudeKm: number
  /** Угол над землёй, градусы (90 — сверху, низкие значения — "взгляд над горами"). */
  pitch: number
  yaw?: number
}

export const LOCATIONS = {
  europe: { label: 'Europe', lat: 50, lon: 12, altitudeKm: 4200, pitch: 70, yaw: 0 },
  paris: { label: 'Paris', lat: 48.8566, lon: 2.3522, altitudeKm: 300, pitch: 45, yaw: 20 },
  vienna: { label: 'Vienna', lat: 48.2082, lon: 16.3738, altitudeKm: 220, pitch: 40, yaw: 0 },
  rome: { label: 'Rome', lat: 41.9028, lon: 12.4964, altitudeKm: 220, pitch: 40, yaw: 0 },
  alps: { label: 'Alps', lat: 46.6, lon: 10.5, altitudeKm: 90, pitch: 15, yaw: 200 },
} as const satisfies Record<string, LocationPreset>

export type LocationKey = keyof typeof LOCATIONS
