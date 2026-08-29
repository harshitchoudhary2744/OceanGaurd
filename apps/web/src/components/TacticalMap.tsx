import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { Plus, Minus, Crosshair, Eye, Navigation, Wind, Waves, Compass, Layers, ShieldAlert } from 'lucide-react';
import { SpillFeatureCollection, Vessel, SuspectVessel, MetoceanData } from '../types';
import { calculateSynchronizedOilSpill, generateForecastCone } from '../lib/simulationEngine';

interface TacticalMapProps {
  spills: SpillFeatureCollection;
  vessels: Vessel[];
  suspects: SuspectVessel[];
  selectedSpillId: string;
  onSelectSpill: (id: string) => void;
  onSelectVessel: (mmsi: number) => void;
  scrubbedVessels?: { mmsi: number; lon: number; lat: number; heading: number; speed?: number }[];
  centerCoordinates?: [number, number];
  timeOffsetMinutes?: number;
  metocean?: MetoceanData;
  scenario?: string;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  spills,
  vessels,
  suspects,
  selectedSpillId,
  onSelectSpill,
  onSelectVessel,
  scrubbedVessels,
  centerCoordinates = [72.150, 19.050],
  timeOffsetMinutes = 0,
  metocean,
  scenario = 'arabian_sea',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showMetoceanOverlay, setShowMetoceanOverlay] = useState(true);

  // Primary suspect with maximum spillage probability
  const primarySuspect = useMemo(() => {
    return suspects.reduce((prev, curr) => (curr.probability_score > prev.probability_score ? curr : prev), suspects[0]);
  }, [suspects]);

  // Synchronized Hydrodynamic Spills (Locks to vessel discharge time & coordinates)
  const currentSpills = useMemo<SpillFeatureCollection>(() => {
    const isArabian = scenario === 'arabian_sea';
    const spillData = calculateSynchronizedOilSpill(timeOffsetMinutes, scenario, metocean);

    const activeSpill = spills.features.find((f) => f.properties.id === selectedSpillId) || spills.features[0];
    const currentYear = new Date().getFullYear();
    const spillId = activeSpill?.properties?.id || (isArabian ? `INC-IND-${currentYear}-01` : `INC-IND-${currentYear}-02`);

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: spillId,
          properties: {
            ...activeSpill?.properties,
            id: spillId,
            center: spillData.center,
            area_sq_km: spillData.area,
            perimeter_km: spillData.perimeter,
            isNascent: spillData.isNascent,
          },
          geometry: {
            type: "Polygon",
            coordinates: [spillData.polygon],
          },
        },
      ],
    };
  }, [spills, selectedSpillId, timeOffsetMinutes, scenario, metocean]);

  // +6h Hydrodynamic Forecast Envelope
  const forecastConeFeature = useMemo(() => {
    const activeSpill = currentSpills.features[0];
    if (!activeSpill) return null;

    const centroid = activeSpill.properties.center || (scenario === 'arabian_sea' ? [72.145, 19.048] : [80.750, 13.250]);
    const driftDir = metocean?.net_drift_direction_deg || (scenario === 'arabian_sea' ? 69.3 : 48.2);
    const driftSpeed = metocean?.net_drift_speed_kts || (scenario === 'arabian_sea' ? 1.95 : 1.52);

    const coneCoords = generateForecastCone(centroid[0], centroid[1], driftDir, driftSpeed, 6);

    return {
      type: "Feature" as const,
      properties: { name: "+6h Metocean Drift Forecast" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coneCoords],
      },
    };
  }, [currentSpills, metocean, scenario]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-dark': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri, DeLorme, NAVTEQ',
          },
          'esri-labels': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'esri-dark-layer',
            type: 'raster',
            source: 'esri-dark',
            minzoom: 0,
            maxzoom: 20,
          },
          {
            id: 'esri-labels-layer',
            type: 'raster',
            source: 'esri-labels',
            minzoom: 0,
            maxzoom: 20,
            paint: {
              'raster-opacity': 0.85,
            },
          },
        ],
      },
      center: centerCoordinates,
      zoom: 9.8,
      attributionControl: false,
    });

    map.on('load', () => {
      setMapLoaded(true);
      mapRef.current = map;

      // 1. Forecast Cone Layer
      map.addSource('forecast-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'forecast-fill',
        type: 'fill',
        source: 'forecast-source',
        paint: {
          'fill-color': '#06b6d4',
          'fill-opacity': 0.10,
        },
      });

      map.addLayer({
        id: 'forecast-line',
        type: 'line',
        source: 'forecast-source',
        paint: {
          'line-color': '#22d3ee',
          'line-width': 1.6,
          'line-dasharray': [3, 3],
        },
      });

      // 2. Trajectory Track Layer
      map.addSource('culprit-trajectory', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'trajectory-glow',
        type: 'line',
        source: 'culprit-trajectory',
        paint: {
          'line-color': '#f43f5e',
          'line-width': 4,
          'line-opacity': 0.20,
        },
      });

      map.addLayer({
        id: 'trajectory-dashed',
        type: 'line',
        source: 'culprit-trajectory',
        paint: {
          'line-color': '#fb7185',
          'line-width': 2.0,
          'line-dasharray': [4, 2],
        },
      });

      // 3. Oil Spill Layer
      map.addSource('spills-source', {
        type: 'geojson',
        data: currentSpills,
      });

      // Ambient Subtle Red Outline Glow
      map.addLayer({
        id: 'spills-glow',
        type: 'line',
        source: 'spills-source',
        paint: {
          'line-color': '#e11d48',
          'line-width': 5,
          'line-opacity': 0.35,
        },
      });

      // Dense Petroleum Slick Core
      map.addLayer({
        id: 'spills-fill',
        type: 'fill',
        source: 'spills-source',
        paint: {
          'fill-color': '#e11d48',
          'fill-opacity': 0.60,
        },
      });

      // Crisp Radar Perimeter Line
      map.addLayer({
        id: 'spills-line',
        type: 'line',
        source: 'spills-source',
        paint: {
          'line-color': '#fda4af',
          'line-width': 1.8,
          'line-opacity': 0.95,
        },
      });

      map.on('click', 'spills-fill', (e) => {
        if (e.features && e.features[0]?.properties?.id) {
          onSelectSpill(e.features[0].properties.id);
        }
      });

      map.on('mouseenter', 'spills-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'spills-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center when scenario changes
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      mapRef.current.flyTo({ center: centerCoordinates, zoom: 9.8, duration: 1000 });
    }
  }, [centerCoordinates, mapLoaded]);

  // Update Live Drifting Spills Layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('spills-source') as maplibregl.GeoJSONSource;
    if (src) src.setData(currentSpills);
  }, [currentSpills, mapLoaded]);

  // Update Forecast Cone
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('forecast-source') as maplibregl.GeoJSONSource;
    if (!src) return;

    if (showForecast && forecastConeFeature) {
      src.setData({
        type: 'FeatureCollection',
        features: [forecastConeFeature],
      });
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [forecastConeFeature, showForecast, mapLoaded]);

  // Update Culprit Trajectory Track
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('culprit-trajectory') as maplibregl.GeoJSONSource;
    if (!src) return;

    if (!showTrails) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    if (primarySuspect?.trajectory) {
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: primarySuspect.trajectory.map((t) => [t[0], t[1]]),
            },
            properties: {
              mmsi: primarySuspect.mmsi,
              name: primarySuspect.name,
            },
          },
        ],
      });
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [primarySuspect, showTrails, mapLoaded]);

  // Remove all markers when scenario changes to avoid ghost markers from other maritime sectors
  useEffect(() => {
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, [scenario]);

  // Update Vessel HTML Markers (Clean, non-glitchy, zero-teleportation)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const positions = vessels.map((v) => {
      const scrubbed = scrubbedVessels?.find((s) => s.mmsi === v.mmsi);
      const isPrimary = primarySuspect && primarySuspect.mmsi === v.mmsi;
      const linkedSpill = v.linked_spill || (isPrimary ? primarySuspect.linked_spill : undefined);

      return {
        mmsi: v.mmsi,
        imo: v.imo_number,
        name: v.name,
        vessel_type: v.vessel_type,
        flag: v.flag,
        destination: v.destination,
        speed: scrubbed?.speed ?? (v.current_position?.speed_knots || 14.0),
        lon: scrubbed ? scrubbed.lon : (v.current_position?.longitude || 72.15),
        lat: scrubbed ? scrubbed.lat : (v.current_position?.latitude || 19.05),
        heading: scrubbed ? scrubbed.heading : (v.current_position?.heading_degrees || 52),
        isPrimary,
        probability: isPrimary ? primarySuspect.probability_score : 5.0,
        linkedSpill,
      };
    });

    const activeKeys = new Set(positions.map((p) => `${scenario}-${p.mmsi}`));
    Object.keys(markersRef.current).forEach((k) => {
      if (!activeKeys.has(k)) {
        markersRef.current[k].remove();
        delete markersRef.current[k];
      }
    });

    positions.forEach((p) => {
      const key = `${scenario}-${p.mmsi}`;
      const existing = markersRef.current[key];

      if (existing) {
        // Smoothly glide marker without jumping
        existing.setLngLat([p.lon, p.lat]);
        const el = existing.getElement();
        const arrow = el.querySelector('.ship-heading-arrow') as HTMLElement;
        if (arrow) arrow.style.transform = `rotate(${p.heading}deg)`;
      } else {
        const el = document.createElement('div');
        el.className = 'group select-none cursor-pointer relative';

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            ${p.isPrimary ? '<div class="absolute w-10 h-10 rounded-full bg-rose-500/25 animate-ping pointer-events-none"></div>' : ''}
            
            <!-- Ship Icon Circle -->
            <div class="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-lg ${
              p.isPrimary
                ? 'bg-rose-600 border border-white text-white shadow-rose-500/50'
                : 'bg-slate-900 border border-cyan-400 text-cyan-400 shadow-cyan-500/30'
            }">
              <svg class="w-3.5 h-3.5 ship-heading-arrow transition-transform duration-300" style="transform: rotate(${p.heading}deg);" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>

            <!-- Clean Label -->
            <div class="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-slate-900/90 border ${
              p.isPrimary ? 'border-rose-500/60 text-rose-200 font-semibold' : 'border-slate-700/60 text-slate-200'
            } px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap shadow-md pointer-events-none transition-opacity duration-200">
              <span>${p.name}</span>
              <span class="text-slate-400 ml-1">${p.speed} kts</span>
            </div>
          </div>
        `;

        el.addEventListener('click', () => {
          onSelectVessel(p.mmsi);
          if (mapRef.current) {
            if (popupRef.current) popupRef.current.remove();
            popupRef.current = new maplibregl.Popup({ offset: 15, closeButton: false })
              .setLngLat([p.lon, p.lat])
              .setHTML(`
                <div class="bg-slate-900/95 text-slate-100 p-3 rounded-lg border ${p.isPrimary ? 'border-rose-500/60' : 'border-cyan-500/50'} font-mono text-xs shadow-xl min-w-[200px]">
                  <div class="font-bold ${p.isPrimary ? 'text-rose-400' : 'text-cyan-400'} text-xs mb-1.5 flex items-center justify-between">
                    <span>${p.name}</span>
                    ${p.isPrimary ? `<span class="bg-rose-500/20 text-rose-300 text-[10px] px-1.5 py-0.5 rounded border border-rose-500/40">${p.probability}% Match</span>` : ''}
                  </div>
                  <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-300 pt-1 border-t border-slate-700/50">
                    <div>MMSI: <span class="text-white font-bold">${p.mmsi}</span></div>
                    <div>Flag: <span class="text-white">${p.flag}</span></div>
                    <div>Type: <span class="text-white">${p.vessel_type}</span></div>
                    <div>Speed: <span class="text-white font-bold">${p.speed} kts</span></div>
                    <div>Heading: <span class="text-white">${p.heading}°</span></div>
                    <div>Status: <span class="text-emerald-400">Underway</span></div>
                  </div>
                  <div class="text-[9.5px] text-slate-400 mt-1.5 pt-1 border-t border-slate-800">
                    Destination: <span class="text-slate-200">${p.destination || 'N/A'}</span>
                  </div>
                </div>
              `)
              .addTo(mapRef.current);
          }
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([p.lon, p.lat])
          .addTo(mapRef.current!);

        markersRef.current[key] = marker;
      }
    });
  }, [vessels, scrubbedVessels, primarySuspect, mapLoaded, onSelectVessel, scenario]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Metocean Live Vector Overlay (Top-Right) */}
      {showMetoceanOverlay && (
        <div className="absolute top-3 right-3 z-20 tactical-glass rounded-xl p-3 border border-cyan-500/20 shadow-xl flex flex-col gap-2 select-none w-56 sm:w-60 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-700/40 pb-1.5">
            <div className="flex items-center gap-1.5 text-white font-mono text-xs font-semibold">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Surface Metocean</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              LIVE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            {/* Wind Vector */}
            <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800 flex flex-col">
              <div className="flex items-center gap-1 text-slate-400 text-[9px]">
                <Wind className="w-3 h-3 text-cyan-400" />
                <span>WIND</span>
              </div>
              <span className="font-bold text-white text-xs mt-0.5">{metocean?.wind_speed_kts || 16.2} kts</span>
              <span className="text-[9px] text-slate-400 mt-0.5">
                {metocean?.wind_direction_deg || 245}° ({metocean?.wind_cardinal || 'WSW'})
              </span>
            </div>

            {/* Current Vector */}
            <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800 flex flex-col">
              <div className="flex items-center gap-1 text-slate-400 text-[9px]">
                <Waves className="w-3 h-3 text-cyan-400" />
                <span>CURRENT</span>
              </div>
              <span className="font-bold text-white text-xs mt-0.5">{metocean?.current_speed_kts || 1.4} kts</span>
              <span className="text-[9px] text-slate-400 mt-0.5">
                {metocean?.current_direction_deg || 65}° ({metocean?.current_cardinal || 'ENE'})
              </span>
            </div>
          </div>

          {/* Net Slick Drift Vector */}
          <div className="p-1.5 bg-slate-900/90 rounded border border-cyan-500/20 text-[10px] font-mono flex items-center justify-between">
            <span className="text-slate-400">Net Advection:</span>
            <span className="text-cyan-300 font-bold">
              {metocean?.net_drift_speed_kts || 1.95} kts @ {metocean?.net_drift_direction_deg || 69.3}°
            </span>
          </div>
        </div>
      )}

      {/* Map Controls (Left-Side) */}
      <div className="absolute top-20 sm:top-24 left-3 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 text-slate-200 hover:text-white flex items-center justify-center shadow-lg transition-colors"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 text-slate-200 hover:text-white flex items-center justify-center shadow-lg transition-colors"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.flyTo({ center: centerCoordinates, zoom: 9.8, duration: 800 })}
          className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 text-cyan-400 flex items-center justify-center shadow-lg transition-colors"
          title="Center on Incident"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowTrails(!showTrails)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-lg transition-colors ${
            showTrails
              ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
              : 'bg-slate-900/90 border-slate-700/60 text-slate-400'
          }`}
          title="Toggle Vessel Trajectory Tracks"
        >
          <Navigation className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowForecast(!showForecast)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-lg transition-colors ${
            showForecast
              ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
              : 'bg-slate-900/90 border-slate-700/60 text-slate-400'
          }`}
          title="Toggle +6h Drift Forecast"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowMetoceanOverlay(!showMetoceanOverlay)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-lg transition-colors ${
            showMetoceanOverlay
              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
              : 'bg-slate-900/90 border-slate-700/60 text-slate-400'
          }`}
          title="Toggle Metocean Drift Card"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {/* Clean Bottom Legend */}
      <div className="absolute bottom-20 sm:bottom-4 left-4 z-20 tactical-glass rounded-lg px-3 py-1.5 border border-slate-700/40 flex items-center gap-3 text-[10px] font-mono text-slate-300 select-none shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-600 border border-rose-300"></span>
          <span>Oil Slick (SAR)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-rose-400"></span>
          <span>Tanker Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/20 border border-cyan-400 border-dashed"></span>
          <span>+6h Forecast</span>
        </div>
      </div>
    </div>
  );
};
