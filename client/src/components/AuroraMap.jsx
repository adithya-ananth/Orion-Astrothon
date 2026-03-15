import React, { useMemo, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  GeoJSON,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useAppContext } from '../contexts/AppContext';
import useOvation from '../hooks/useOvation';
import { auroraProbabilityColor } from '../utils/colors';
import { getTerminatorGeoJSON } from '../utils/terminator';
import { fetchPointVisibility } from '../utils/api';
import '../styles/Map.css';

// Fix default marker icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DARK_TILES =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://carto.com/">CARTO</a> | Aurora data: <a href="https://www.swpc.noaa.gov/">NOAA SWPC</a>';

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng),
  });
  return null;
}

function OvationOverlay({ coordinates }) {
  if (!coordinates || coordinates.length === 0) return null;

  return coordinates.map((pt, i) => {
    const prob = pt.probability ?? pt.aurora ?? 0;
    if (prob <= 2) return null;
    return (
      <CircleMarker
        key={i}
        center={[pt.lat ?? pt.latitude, pt.lon ?? pt.longitude]}
        radius={3}
        pathOptions={{
          fillColor: auroraProbabilityColor(prob),
          fillOpacity: 0.7,
          stroke: false,
        }}
      />
    );
  });
}

export default function AuroraMap({ lat, lon }) {
  const { setSelectedPoint } = useAppContext();
  const { coordinates, loading: ovLoading } = useOvation();

  const terminator = useMemo(() => getTerminatorGeoJSON(), []);

  const terminatorStyle = useMemo(
    () => ({
      fillColor: '#000014',
      fillOpacity: 0.35,
      color: 'rgba(100,100,200,0.3)',
      weight: 1,
    }),
    []
  );

  const handleMapClick = useCallback(
    async (latlng) => {
      setSelectedPoint({
        lat: latlng.lat,
        lon: latlng.lng,
        loading: true,
        score: null,
      });
      try {
        const result = await fetchPointVisibility(latlng.lat, latlng.lng);
        setSelectedPoint({
          lat: latlng.lat,
          lon: latlng.lng,
          loading: false,
          score: result.composite_score ?? result.score ?? null,
          breakdown: result.breakdown ?? null,
        });
      } catch {
        setSelectedPoint({
          lat: latlng.lat,
          lon: latlng.lng,
          loading: false,
          score: null,
          error: true,
        });
      }
    },
    [setSelectedPoint]
  );

  const center = lat && lon ? [lat, lon] : [65, -18];

  return (
    <div className="map-wrapper">
      <MapContainer
        center={center}
        zoom={4}
        className="map-container"
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer url={DARK_TILES} attribution={TILE_ATTR} />

        {/* Day/Night terminator */}
        <GeoJSON data={terminator} style={terminatorStyle} />

        {/* OVATION aurora overlay */}
        <OvationOverlay coordinates={coordinates} />

        {/* User location */}
        {lat && lon && (
          <>
            <Marker position={[lat, lon]}>
              <Popup>
                <div className="map-click-popup">
                  <h4>📍 Your Location</h4>
                  <div className="score-line">
                    <span>Lat</span>
                    <span>{lat.toFixed(2)}°</span>
                  </div>
                  <div className="score-line">
                    <span>Lon</span>
                    <span>{lon.toFixed(2)}°</span>
                  </div>
                </div>
              </Popup>
            </Marker>
            <Circle
              center={[lat, lon]}
              radius={500000}
              pathOptions={{
                color: '#00ff88',
                fillColor: '#00ff88',
                fillOpacity: 0.04,
                weight: 1,
                dashArray: '8 4',
              }}
            />
          </>
        )}

        <ClickHandler onMapClick={handleMapClick} />
      </MapContainer>

      {/* Loading indicator */}
      {ovLoading && (
        <div className="map-overlay map-overlay-top-right">
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Loading aurora data…
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="map-legend">
        <h5>Aurora Probability</h5>
        {[
          { color: 'rgba(0,200,50,0.5)', label: '< 20%' },
          { color: 'rgba(200,255,0,0.6)', label: '20–50%' },
          { color: 'rgba(255,100,0,0.7)', label: '50–80%' },
          { color: 'rgba(255,30,200,0.8)', label: '> 80%' },
        ].map(({ color, label }) => (
          <div className="legend-item" key={label}>
            <span className="legend-swatch" style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
