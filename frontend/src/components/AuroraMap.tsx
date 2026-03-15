import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import axios from 'axios'
import TerminatorLayer from './TerminatorLayer'

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

export default function AuroraMap() {
  return (
    <div className="h-[500px] w-full rounded-xl overflow-hidden shadow-lg border border-gray-700 z-0">
      <MapContainer
        center={[60, -100]}
        zoom={3}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', backgroundColor: '#0f172a' }}
      >
        <TileLayer
          attribution='&copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <TerminatorLayer />
        <OvationLayer />
      </MapContainer>
    </div>
  )
}
