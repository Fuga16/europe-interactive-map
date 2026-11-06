import { KM_PER_UNIT, geoToWorld } from '../geo/projection'
import { LOCATIONS, type LocationPreset } from '../data/locations'

/**
 * Позиция камеры в "картографической" модели:
 *  - (x, z)    — точка фокуса на карте (мировые координаты)
 *  - distance  — расстояние от камеры до фокуса (мировые единицы)
 *  - pitch     — угол над плоскостью земли, градусы (90 — сверху, 0 — с уровня земли)
 *  - yaw       — поворот вокруг вертикали, градусы (0 — камера на юге, смотрит на север)
 */
export interface CameraPose {
  x: number
  z: number
  distance: number
  pitch: number
  yaw: number
}

export interface FlyToOptions {
  lat: number
  lon: number
  /** Высота в километрах (расстояние до фокуса). */
  altitudeKm: number
  pitch: number
  yaw?: number
  /** Секунды. */
  duration?: number
}

interface Tween {
  from: CameraPose
  to: CameraPose
  elapsed: number
  duration: number
  resolve: () => void
}

export const CAMERA_LIMITS = {
  minDistance: 0.12, // ~1.3 км
  maxDistance: 600,
  minPitch: 3,
  maxPitch: 89,
} as const

const DEG = Math.PI / 180

/**
 * Кинематографичная камера. Одна глобальная инстанция (mapCamera) —
 * её читают CameraController (каждый кадр) и UI-кнопки (flyTo).
 */
export class CinematicCamera {
  readonly pose: CameraPose
  private tween: Tween | null = null

  constructor(initial: CameraPose) {
    this.pose = { ...initial }
  }

  get isFlying(): boolean {
    return this.tween !== null
  }

  /** Плавный полёт к точке. Возвращает промис, который резолвится в конце. */
  flyTo(options: FlyToOptions): Promise<void> {
    const target = geoToWorld(options.lat, options.lon)
    const to: CameraPose = {
      x: target.x,
      z: target.z,
      distance: clamp(options.altitudeKm / KM_PER_UNIT, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance),
      pitch: clamp(options.pitch, CAMERA_LIMITS.minPitch, CAMERA_LIMITS.maxPitch),
      yaw: options.yaw ?? this.pose.yaw,
    }
    this.cancel()
    return new Promise((resolve) => {
      this.tween = {
        from: { ...this.pose },
        to,
        elapsed: 0,
        duration: options.duration ?? 4,
        resolve,
      }
    })
  }

  /** Отменяет текущий полёт (например, когда пользователь сам двигает камеру). */
  cancel(): void {
    if (this.tween) {
      this.tween.resolve()
      this.tween = null
    }
  }

  /** Вызывается каждый кадр. */
  update(dt: number): void {
    const t = this.tween
    if (!t) return
    t.elapsed += dt
    const k = Math.min(t.elapsed / t.duration, 1)
    const e = easeInOutCubic(k)
    const { from, to, } = t

    this.pose.x = lerp(from.x, to.x, e)
    this.pose.z = lerp(from.z, to.z, e)
    this.pose.pitch = lerp(from.pitch, to.pitch, e)
    this.pose.yaw = from.yaw + shortestAngleDelta(from.yaw, to.yaw) * e

    // Дистанция — логарифмически, плюс "отъезд" в середине полёта:
    // камера слегка поднимается, как в кинематографе, и не режет рельеф.
    const base = Math.exp(lerp(Math.log(from.distance), Math.log(to.distance), e))
    this.pose.distance = base * (1 + 0.2 * Math.sin(Math.PI * k))

    if (k >= 1) {
      this.pose.distance = to.distance
      this.tween = null
      t.resolve()
    }
  }

  /** Ручной сдвиг фокуса экранным перетаскиванием (пиксели). */
  panScreen(dxPx: number, dyPx: number, speed: number): void {
    const { forward, right } = this.basis()
    const s = this.pose.distance * 0.0019 * speed
    this.pose.x += forward.x * dyPx * s - right.x * dxPx * s
    this.pose.z += forward.z * dyPx * s - right.z * dxPx * s
  }

  /** Движение WASD относительно направления взгляда. */
  moveRelative(forwardAmount: number, rightAmount: number, dt: number, speed: number): void {
    const { forward, right } = this.basis()
    const s = this.pose.distance * 0.8 * speed * dt
    this.pose.x += (forward.x * forwardAmount + right.x * rightAmount) * s
    this.pose.z += (forward.z * forwardAmount + right.z * rightAmount) * s
  }

  rotate(dYawDeg: number, dPitchDeg: number): void {
    this.pose.yaw = wrapDeg(this.pose.yaw + dYawDeg)
    this.pose.pitch = clamp(this.pose.pitch + dPitchDeg, CAMERA_LIMITS.minPitch, CAMERA_LIMITS.maxPitch)
  }

  zoom(factor: number): void {
    this.pose.distance = clamp(this.pose.distance * factor, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance)
  }

  /** Направление "вперёд" и "вправо" на плоскости земли. */
  private basis() {
    const yr = this.pose.yaw * DEG
    return {
      forward: { x: -Math.sin(yr), z: -Math.cos(yr) },
      right: { x: Math.cos(yr), z: -Math.sin(yr) },
    }
  }
}

/** Стартовая поза — Европа. */
function initialPose(preset: LocationPreset): CameraPose {
  const p = geoToWorld(preset.lat, preset.lon)
  return {
    x: p.x,
    z: p.z,
    distance: clamp(preset.altitudeKm / KM_PER_UNIT, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance),
    pitch: preset.pitch,
    yaw: preset.yaw ?? 0,
  }
}

export const mapCamera = new CinematicCamera(initialPose(LOCATIONS.europe))

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function wrapDeg(d: number): number {
  return ((d % 360) + 360) % 360
}

function shortestAngleDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}
