import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
// @ts-ignore
import terminator from '@joergdietrich/leaflet.terminator'

export default function TerminatorLayer() {
  const map = useMap()

  useEffect(() => {
    let tLayer: any = null;
    try {
        tLayer = terminator({
            color: '#000000',
            opacity: 0.5,
            fillColor: '#000000',
            fillOpacity: 0.5
        })
        tLayer.addTo(map)

        const interval = setInterval(() => {
            tLayer.setTime()
        }, 60000)

        return () => {
            clearInterval(interval)
            if (map.hasLayer(tLayer)) {
                map.removeLayer(tLayer)
            }
        }
    } catch (e) {
        console.warn("Terminator plugin error", e)
    }
  }, [map])

  return null
}
