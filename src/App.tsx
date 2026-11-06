import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useControls } from 'leva'
import { Atmosphere } from './map/Atmosphere'
import { Terrain } from './map/Terrain'
import { Water } from './map/Water'
import { CitiesLayer } from './layers/CitiesLayer'
import { BordersLayer } from './layers/BordersLayer'
import { CameraController } from './camera/CameraController'
import { mapCamera } from './camera/cinematicCamera'
import { loadHeightmap, type Heightmap } from './geo/elevation'
import { LOCATIONS, type LocationKey } from './data/locations'
import { FRANCE_OUTLINE } from './data/france'

const BUTTON_ORDER: LocationKey[] = ['europe', 'paris', 'vienna', 'rome', 'alps']

export default function App() {
  const [heightmap, setHeightmap] = useState<Heightmap | null>(null)
  const [progress, setProgress] = useState(0)
  const [active, setActive] = useState<LocationKey>('europe')

  useEffect(() => {
    let alive = true
    loadHeightmap((p) => alive && setProgress(p)).then((hm) => {
      if (alive) setHeightmap(hm)
    })
    return () => {
      alive = false
    }
  }, [])

  const terrain = useControls('Terrain', {
    exaggeration: { value: 1.5, min: 0.5, max: 4, step: 0.1, label: 'Terrain exaggeration' },
    wireframe: { value: false, label: 'Wireframe' },
    showCities: { value: true, label: 'Show city labels' },
    showBorders: { value: true, label: 'Show borders' },
    cameraSpeed: { value: 1, min: 0.2, max: 3, step: 0.1, label: 'Camera speed' },
  })

  const sun = useControls('Atmosphere', {
    sunIntensity: { value: 2.2, min: 0, max: 5, step: 0.1, label: 'Sun intensity' },
    sunAngle: { value: 35, min: 5, max: 85, step: 1, label: 'Sun angle' },
    fogDensity: { value: 0.0018, min: 0, max: 0.01, step: 0.0001, label: 'Fog density' },
  })

  const fly = (key: LocationKey) => {
    setActive(key)
    const loc = LOCATIONS[key]
    void mapCamera.flyTo({
      lat: loc.lat,
      lon: loc.lon,
      altitudeKm: loc.altitudeKm,
      pitch: loc.pitch,
      yaw: loc.yaw,
      duration: 4,
    })
  }

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: 40, near: 0.05, far: 3000 }}
      >
        <Atmosphere
          sunIntensity={sun.sunIntensity}
          sunAngle={sun.sunAngle}
          fogDensity={sun.fogDensity}
        />
        <CameraController
          heightmap={heightmap}
          exaggeration={terrain.exaggeration}
          speed={terrain.cameraSpeed}
        />
        <Water />
        {heightmap && (
          <>
            <Terrain
              heightmap={heightmap}
              exaggeration={terrain.exaggeration}
              wireframe={terrain.wireframe}
              highlight={FRANCE_OUTLINE}
            />
            {terrain.showCities && (
              <CitiesLayer heightmap={heightmap} exaggeration={terrain.exaggeration} />
            )}
            {terrain.showBorders && (
              <BordersLayer heightmap={heightmap} exaggeration={terrain.exaggeration} />
            )}
          </>
        )}
      </Canvas>

      {!heightmap && (
        <div className="status">Загрузка рельефа… {Math.round(progress * 100)}%</div>
      )}
      {heightmap?.source === 'fallback' && (
        <div className="status warn">
          Резервный рельеф: тайлы недоступны. Горы приблизительные.
        </div>
      )}

      <nav className="flight-buttons">
        {BUTTON_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={active === key ? 'active' : ''}
            onClick={() => fly(key)}
          >
            {LOCATIONS[key].label}
          </button>
        ))}
      </nav>

      <div className="hints">
        ЛКМ — перемещение · ПКМ или Shift+ЛКМ — поворот · колесо — зум · WASD — движение
      </div>
      <div className="attribution">
        Elevation: Terrain Tiles on AWS (SRTM, ASTER, NED and others). Border: approximate.
      </div>
    </>
  )
}
