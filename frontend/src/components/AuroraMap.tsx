import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import axios from 'axios'
import TerminatorLayer from './TerminatorLayer'

// Fix default leaflet marker icon issue in React
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

const customIcon = new L.Icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

function OvationLayer() {
  const map = useMap()

  useEffect(() => {
    let canvasLayer: any = null;

    axios.get('http://localhost:8000/api/ovation')
      .then(res => {
        const ovation = res.data
        if (!ovation || !ovation.coordinates) return

        const OvationCanvasLayer = L.Layer.extend({
            onAdd: function (map: L.Map) {
                const canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated')
                canvas.style.opacity = '0.7'
                canvas.style.pointerEvents = 'none'
                this._canvas = canvas
                map.getPanes().overlayPane.appendChild(canvas)

                map.on('moveend', this._update, this)
                map.on('zoomend', this._update, this)
                this._update()
            },

            onRemove: function (map: L.Map) {
                map.getPanes().overlayPane.removeChild(this._canvas)
                map.off('moveend', this._update, this)
                map.off('zoomend', this._update, this)
            },

            _update: function () {
                const map = this._map
                const canvas = this._canvas
                const size = map.getSize()

                const topLeft = map.containerPointToLayerPoint([0, 0])
                L.DomUtil.setPosition(canvas, topLeft)

                canvas.width = size.x
                canvas.height = size.y

                const ctx = canvas.getContext('2d')
                if (!ctx) return

                ctx.clearRect(0, 0, canvas.width, canvas.height)

                const getColor = (val: number) => {
                    if (val < 10) return null
                    if (val < 20) return 'rgba(0, 255, 0, 0.2)'
                    if (val < 40) return 'rgba(0, 255, 0, 0.4)'
                    if (val < 60) return 'rgba(173, 255, 47, 0.6)'
                    if (val < 80) return 'rgba(255, 255, 0, 0.7)'
                    return 'rgba(255, 0, 0, 0.8)'
                }

                const coords = ovation.coordinates

                coords.forEach((pt: number[]) => {
                    let p_lon = pt[0]
                    const p_lat = pt[1]
                    const p_val = pt[2]

                    if (p_val < 10) return;

                    if (p_lon > 180) p_lon -= 360;

                    const color = getColor(p_val)
                    if (!color) return

                    const nw = map.latLngToContainerPoint([p_lat + 0.5, p_lon - 0.5])
                    const se = map.latLngToContainerPoint([p_lat - 0.5, p_lon + 0.5])

                    const w = Math.max(se.x - nw.x, 1)
                    const h = Math.max(se.y - nw.y, 1)

                    ctx.fillStyle = color
                    ctx.fillRect(nw.x, nw.y, w, h)
                })
            }
        })

        canvasLayer = new OvationCanvasLayer()
        map.addLayer(canvasLayer)
      })
      .catch(err => console.error("Error loading OVATION data:", err))

      return () => {
          if (canvasLayer && map.hasLayer(canvasLayer)) {
              map.removeLayer(canvasLayer)
          }
      }
  }, [map])

  return null
}

function CenterMapOnLocation({ lat, lon }: { lat: number, lon: number }) {
  const map = useMap()
  const prevLoc = useRef<{lat: number, lon: number} | null>(null)

  useEffect(() => {
    // Only center if location actually changed to avoid annoying re-pans
    if (prevLoc.current?.lat !== lat || prevLoc.current?.lon !== lon) {
        map.setView([lat, lon], map.getZoom())
        prevLoc.current = { lat, lon }
    }
  }, [lat, lon, map])
  return null
}

interface AuroraMapProps {
  userLocation: { lat: number; lon: number; name: string };
}

export default function AuroraMap({ userLocation }: AuroraMapProps) {
  // To restrict the map from infinite wrapping, we can set maxBounds.
  // We'll allow it to wrap exactly one full world (3 total visible worlds roughly)
  // [-90, -180] to [90, 180] is one world.
  // maxBounds from [-90, -540] to [90, 540] prevents scrolling infinitely.

  const mapBounds: L.LatLngBoundsExpression = [
    [-90, -540],
    [90, 540]
  ]

  return (
    <div className="h-[700px] w-full rounded-xl overflow-hidden shadow-lg border border-gray-700 z-0 relative">
      <MapContainer
        center={[userLocation.lat, userLocation.lon]}
        zoom={3}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', backgroundColor: '#0f172a' }}
        maxBounds={mapBounds}
        maxBoundsViscosity={1.0}
        minZoom={2}
      >
        <TileLayer
          attribution='&copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          noWrap={false}
        />
        <TerminatorLayer />
        <OvationLayer />

        <CenterMapOnLocation lat={userLocation.lat} lon={userLocation.lon} />

        <Marker position={[userLocation.lat, userLocation.lon]} icon={customIcon}>
          <Popup className="bg-gray-800 text-black">
            <b>{userLocation.name}</b><br/>
            Lat: {userLocation.lat.toFixed(4)}<br/>
            Lon: {userLocation.lon.toFixed(4)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
