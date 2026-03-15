import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Circle,
  GeoJSON,
  Marker,
  Popup,
  useMapEvents,
  useMap,
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

const MIN_VISIBLE_AURORA_PROBABILITY = 2;
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 181;

/**
 * Build a grid from the OVATION coordinate array.
 * Returns a 2D array [row][col] = probability, where
 *   row 0 = latitude +90°, row 180 = latitude -90°,
 *   col 0 = longitude -180°, col 359 = longitude +179°.
 */
function buildGrid(coordinates) {
  const grid = new Float32Array(CANVAS_WIDTH * CANVAS_HEIGHT);

  for (const pt of coordinates) {
    if (pt.probability <= MIN_VISIBLE_AURORA_PROBABILITY) continue;
    // Map lat [-90,90] → row [180,0]
    const row = Math.round(90 - pt.lat);
    // Map lon [-180,180) → col [0,360)
    const col = ((Math.round(pt.lon) % 360) + 360) % 360;
    if (row >= 0 && row < CANVAS_HEIGHT && col >= 0 && col < CANVAS_WIDTH) {
      grid[row * CANVAS_WIDTH + col] = pt.probability;
    }
  }
  return grid;
}

/**
 * Parse an rgba(...) color string into [r, g, b, a] with a in 0-255 range.
 */
function parseRGBA(rgba) {
  const m = rgba.match(/[\d.]+/g);
  if (!m || m.length < 4) return [0, 0, 0, 0];
  return [
    Math.round(+m[0]),
    Math.round(+m[1]),
    Math.round(+m[2]),
    Math.round(+m[3] * 255),
  ];
}

/**
 * Render the OVATION grid onto an offscreen canvas and return a data URL.
 */
function renderOvationImage(coordinates) {
  const grid = buildGrid(coordinates);
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);

  for (let row = 0; row < CANVAS_HEIGHT; row++) {
    for (let col = 0; col < CANVAS_WIDTH; col++) {
      const prob = grid[row * CANVAS_WIDTH + col];
      if (prob <= MIN_VISIBLE_AURORA_PROBABILITY) continue;
      const [r, g, b, a] = parseRGBA(auroraProbabilityColor(prob));
      const idx = (row * CANVAS_WIDTH + col) * 4;
      imgData.data[idx] = r;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = b;
      imgData.data[idx + 3] = a;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Canvas-based OVATION overlay rendered as a Leaflet ImageOverlay.
 * Produces a smooth aurora heat-map instead of individual dot markers.
 */
function OvationOverlay({ coordinates }) {
  const map = useMap();
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!coordinates || coordinates.length === 0) return;

    const dataUrl = renderOvationImage(coordinates);
    const bounds = L.latLngBounds([[-90, -180], [90, 180]]);

    if (overlayRef.current) {
      overlayRef.current.setUrl(dataUrl);
    } else {
      overlayRef.current = L.imageOverlay(dataUrl, bounds, {
        opacity: 0.85,
        interactive: false,
        className: 'ovation-image-overlay',
      }).addTo(map);
    }

    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
    };
  }, [map, coordinates]);

  return null;
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
          score: result.composite ?? result.score ?? null,
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
