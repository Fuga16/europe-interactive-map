import { CITIES } from '../data/cities'
import type { Heightmap } from '../geo/elevation'
import { CityMarker } from '../components/CityMarker'

interface CitiesLayerProps {
  heightmap: Heightmap
  exaggeration: number
}

export function CitiesLayer({ heightmap, exaggeration }: CitiesLayerProps) {
  return (
    <>
      {CITIES.map((city) => (
        <CityMarker
          key={city.name}
          name={city.name}
          lat={city.lat}
          lon={city.lon}
          heightmap={heightmap}
          exaggeration={exaggeration}
        />
      ))}
    </>
  )
}
