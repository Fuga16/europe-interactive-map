import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { mapCamera } from './cinematicCamera'
import { groundHeightAt, type Heightmap } from '../geo/elevation'

interface CameraControllerProps {
  heightmap: Heightmap | null
  exaggeration: number
  speed: number
}

/** Минимальный зазор камеры над землёй (мировые единицы, ~1 км). */
const MIN_CLEARANCE = 0.08
const DEG = Math.PI / 180

/**
 * Управление:
 *  - ЛКМ + тяга      — перемещение по карте
 *  - ПКМ / Shift+ЛКМ — поворот (yaw) и наклон (pitch)
 *  - колесо          — зум
 *  - WASD            — движение относительно взгляда
 *
 * Все состояния живут в mapCamera; здесь только ввод и перевод позы в Three-камеру.
 */
export function CameraController({ heightmap, exaggeration, speed }: CameraControllerProps) {
  const { camera, gl } = useThree()

  // Актуальные props для обработчиков, которые висят на window/canvas.
  const live = useRef({ heightmap, exaggeration, speed })
  useEffect(() => {
    live.current = { heightmap, exaggeration, speed }
  }, [heightmap, exaggeration, speed])

  const keys = useRef(new Set<string>())
  const drag = useRef<{ rotate: boolean; x: number; y: number } | null>(null)

  useEffect(() => {
    const el = gl.domElement

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return
      drag.current = { rotate: e.button === 2 || e.shiftKey, x: e.clientX, y: e.clientY }
      mapCamera.cancel()
      el.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      d.x = e.clientX
      d.y = e.clientY
      if (d.rotate) {
        mapCamera.rotate(dx * 0.25, -dy * 0.15)
      } else {
        mapCamera.panScreen(dx, dy, live.current.speed)
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      drag.current = null
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      mapCamera.cancel()
      mapCamera.zoom(Math.exp(e.deltaY * 0.0012))
    }
    const onContextMenu = (e: Event) => e.preventDefault()

    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.isContentEditable)
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTyping(e.target)) keys.current.add(e.code)
    }
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code)
    const onBlur = () => keys.current.clear()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [gl])

  const focus = useRef(new Vector3())
  const eye = useRef(new Vector3())

  useFrame((_, dt) => {
    const { heightmap: hm, exaggeration: exag, speed: spd } = live.current

    mapCamera.update(dt)

    const f = (keys.current.has('KeyW') ? 1 : 0) - (keys.current.has('KeyS') ? 1 : 0)
    const r = (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0)
    if (f !== 0 || r !== 0) {
      mapCamera.cancel()
      mapCamera.moveRelative(f, r, dt, spd)
    }

    const { x, z, distance, pitch, yaw } = mapCamera.pose
    const focusY = hm ? groundHeightAt(hm, x, z, exag) : 0
    focus.current.set(x, focusY, z)

    const pr = pitch * DEG
    const yr = yaw * DEG
    const cosP = Math.cos(pr)
    eye.current.set(
      x + distance * cosP * Math.sin(yr),
      focusY + distance * Math.sin(pr),
      z + distance * cosP * Math.cos(yr),
    )

    // Камера не уходит под рельеф.
    const groundAtEye = hm ? groundHeightAt(hm, eye.current.x, eye.current.z, exag) : 0
    if (eye.current.y < groundAtEye + MIN_CLEARANCE) {
      eye.current.y = groundAtEye + MIN_CLEARANCE
    }

    camera.position.copy(eye.current)
    camera.lookAt(focus.current)
  })

  return null
}
