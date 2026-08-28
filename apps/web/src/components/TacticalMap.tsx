import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { Plus, Minus, Crosshair, Eye, Navigation, Wind, Waves, Compass, Layers, ShieldAlert, Radio } from 'lucide-react';
import { SpillFeatureCollection, Vessel, SuspectVessel, MetoceanData } from '../types';
import { calculateHydrodynamicDrift } from '../lib/api';
import { generateForecastCone } from '../lib/simulationEngine';

interface TacticalMapProps {
  spills: SpillFeatureCollection;
  vessels: Vessel[];
  suspects: SuspectVessel[];
  selectedSpillId: string;
  onSelectSpill: (id: string) => void;
  onSelectVessel: (mmsi: number) => void;
  scrubbedVessels?: { mmsi: number; lon: number; lat: number; heading: number }[];
  centerCoordinates?: [number, number];
  timeOffsetMinutes?: number;
  metocean?: MetoceanData;
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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showForecast, setShowForecast] = useState(true);

  // Hydrodynamically Drifted Spills based on Time Scrubber
  const driftedSpills = useMemo<SpillFeatureCollection>(() => {
    if (timeOffsetMinutes === 0) return spills;
    return {
      type: "FeatureCollection",
      features: spills.features.map((f) => {
        const baseCoords = f.geometry.coordinates[0];
        const driftedCoords = calculateHydrodynamicDrift(baseCoords, timeOffsetMinutes, metocean);
        return {
          ...f,
          geometry: {
            ...f.geometry,
            coordinates: [driftedCoords],
          },
        };
      }),
    };
  }, [spills, timeOffsetMinutes, metocean]);

  // Realistic +6h Hydrodynamic Forecast Dispersal Fan Cone
  const forecastConeFeature = useMemo(() => {
    const activeSpill = spills.features.find((f) => f.properties.id === selectedSpillId) || spills.features[0];
    if (!activeSpill) return null;

    const centroid = activeSpill.properties.center || [72.145, 19.048];
    const driftDir = metocean?.net_drift_direction_deg || 69.3;
    const driftSpeed = metocean?.net_drift_speed_kts || 1.95;

    const coneCoords = generateForecastCone(centroid[0], centroid[1], driftDir, driftSpeed, 6);

    return {
      type: "Feature" as const,
      properties: { name: "+6h Dispersal Envelope" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coneCoords],
      },
    };
  }, [spills, selectedSpillId, metocean]);

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
            maxzoom: 19,
          },
          {
            id: 'esri-labels-layer',
            type: 'raster',
            source: 'esri-labels',
            minzoom: 0,
            maxzoom: 19,
            paint: {
              'raster-opacity': 0.75,
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

      // 1. Forecast Cone Layer (+6h Envelope)
      map.addSource('forecast-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'forecast-fill',
        type: 'fill',
        source: 'forecast-source',
        paint: {
          'fill-color': '#00e5ff',
          'fill-opacity': 0.12,
        },
      });

      map.addLayer({
        id: 'forecast-line',
        type: 'line',
        source: 'forecast-source',
        paint: {
          'line-color': '#00e5ff',
          'line-width': 1.8,
          'line-dasharray': [4, 3],
        },
      });

      // 2. Trajectory Source & Dashed Red Intercept Track
      map.addSource('culprit-trajectory', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'trajectory-glow',
        type: 'line',
        source: 'culprit-trajectory',
        paint: {
          'line-color': '#ff3b30',
          'line-width': 6,
          'line-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'trajectory-dashed',
        type: 'line',
        source: 'culprit-trajectory',
        paint: {
          'line-color': '#ff5c6d',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
        },
      });

      // 3. Spills GeoJSON Source
      map.addSource('spills-source', {
        type: 'geojson',
        data: driftedSpills,
      });

      map.addLayer({
        id: 'spills-glow',
        type: 'line',
        source: 'spills-source',
        paint: {
          'line-color': '#ff3b30',
          'line-width': 8,
          'line-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'spills-fill',
        type: 'fill',
        source: 'spills-source',
        paint: {
          'fill-color': '#ff2a40',
          'fill-opacity': 0.65,
        },
      });

      map.addLayer({
        id: 'spills-line',
        type: 'line',
        source: 'spills-source',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.0,
          'line-opacity': 0.9,
        },
      });

      map.on('click', 'spills-fill', (e) => {
        if (e.features && e.features[0]?.properties?.id) {
          onSelectSpill(e.features[0].properties.id);
        }
      });

      map.on('mouseenter', 'spills-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'spills-fill', () => { map.getCanvas().style.cursor = ''; });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center when scenario changes
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      mapRef.current.flyTo({ center: centerCoordinates, zoom: 9.8, duration: 1200 });
    }
  }, [centerCoordinates, mapLoaded]);

  // Update Live Drifting Spills Layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('spills-source') as maplibregl.GeoJSONSource;
    if (src) src.setData(driftedSpills);
  }, [driftedSpills, mapLoaded]);

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

  // Update Culprit Trajectory
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('culprit-trajectory') as maplibregl.GeoJSONSource;
    if (!src) return;

    if (!showTrails) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const primary = suspects.find((s) => s.probability_score > 70) || suspects[0];
    if (primary?.trajectory) {
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: primary.trajectory.map((t) => [t[0], t[1]]),
            },
            properties: {
              mmsi: primary.mmsi,
              name: primary.name,
            },
          },
        ],
      });
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [suspects, showTrails, mapLoaded]);

  // Update Vessel HTML Markers with Attached Real-Time Spill Tags
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const positions = vessels.map((v) => {
      const scrubbed = scrubbedVessels?.find((s) => s.mmsi === v.mmsi);
      const suspectMatch = suspects.find((s) => s.mmsi === v.mmsi);
      const isCulprit = (suspectMatch && suspectMatch.probability_score > 70) || !!v.linked_spill;
      const linkedSpill = v.linked_spill || suspectMatch?.linked_spill;

      return {
        mmsi: v.mmsi,
        imo: v.imo_number,
        name: v.name,
        vessel_type: v.vessel_type,
        draught: v.draught_meters,
        flag: v.flag,
        destination: v.destination,
        speed: v.current_position?.speed_knots || 14.0,
        lon: scrubbed ? scrubbed.lon : v.current_position?.longitude || 72.15,
        lat: scrubbed ? scrubbed.lat : v.current_position?.latitude || 19.05,
        heading: scrubbed ? scrubbed.heading : v.current_position?.heading_degrees || 52,
        isCulprit,
        probability: suspectMatch ? suspectMatch.probability_score : 98.4,
        linkedSpill,
      };
    });

    const activeKeys = new Set(positions.map((p) => p.mmsi.toString()));
    Object.keys(markersRef.current).forEach((k) => {
      if (!activeKeys.has(k)) {
        markersRef.current[k].remove();
        delete markersRef.current[k];
      }
    });

    positions.forEach((p) => {
      const key = p.mmsi.toString();
      const existing = markersRef.current[key];

      if (existing) {
        existing.setLngLat([p.lon, p.lat]);
        const el = existing.getElement();
        const arrow = el.querySelector('.ship-heading-arrow') as HTMLElement;
        if (arrow) arrow.style.transform = `rotate(${p.heading}deg)`;
      } else {
        const el = document.createElement('div');
        el.className = 'group select-none cursor-pointer';
        el.style.transition = 'transform 0.8s linear';

        // Attached Spill Badge HTML (renders directly beside the culprit ship!)
        const attachedSpillBadgeHtml = (p.isCulprit && p.linkedSpill)
          ? `
            <div class="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-[#121622]/95 border border-[#ff3b30] rounded-xl p-2.5 text-white font-mono text-[10px] shadow-[0_0_20px_rgba(255,59,48,0.4)] pointer-events-auto min-w-[210px] sm:min-w-[230px] backdrop-blur-md z-30">
              <div class="flex items-center justify-between border-b border-[#ff3b30]/40 pb-1 mb-1.5">
                <span class="text-[#ff3b30] font-bold flex items-center gap-1">
                  <span class="w-2 h-2 rounded-full bg-[#ff3b30] animate-ping"></span>
                  ⚠️ SPILL ATTACHED
                </span>
                <span class="bg-[#93000a]/60 text-[#ffb4ab] px-1.5 py-0.5 rounded text-[9px] font-bold border border-[#ffb4ab]/30">${p.probability}% MATCH</span>
              </div>
              <div class="text-[#bac9cc] text-[9px] flex flex-col gap-0.5">
                <div class="flex justify-between">
                  <span class="text-[#849396]">DATE:</span>
                  <span class="text-white font-bold">${p.linkedSpill.detection_date}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-[#849396]">TIME:</span>
                  <span class="text-white font-bold">${p.linkedSpill.detection_time_utc}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-[#849396]">DISCHARGE:</span>
                  <span class="text-[#ffb4ab] font-bold">~${p.linkedSpill.volume_liters.toLocaleString()} L</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-[#849396]">PROXIMITY:</span>
                  <span class="text-[#4ade80] font-bold">0.0 km (Direct Overlap)</span>
                </div>
              </div>
            </div>
          `
          : '';

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            ${p.isCulprit ? '<div class="absolute w-10 h-10 rounded-full bg-[#ff3b30]/35 animate-ping pointer-events-none"></div>' : ''}
            <div class="w-7 h-7 rounded-full ${
              p.isCulprit
                ? 'bg-[#ff2a40] border-2 border-white text-white shadow-[0_0_15px_#ff2a40]'
                : 'bg-[#181c27] border border-[#00daf3] text-[#00daf3] shadow-[0_0_8px_#00daf3]'
            } flex items-center justify-center transition-transform hover:scale-125">
              <svg class="w-4 h-4 ship-heading-arrow transition-transform duration-500" style="transform: rotate(${p.heading}deg);" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>

            <!-- Ship Name Pill Top -->
            <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#121622]/95 border border-[#3b494c]/60 text-white font-mono text-[9.5px] px-2 py-0.5 rounded shadow-xl whitespace-nowrap opacity-85 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span class="${p.isCulprit ? 'text-[#ffb4ab] font-bold' : 'text-white'}">${p.name}</span>
              <span class="text-[#849396] ml-1">(${p.speed} kts)</span>
            </div>

            ${attachedSpillBadgeHtml}
          </div>
        `;

        el.addEventListener('click', () => {
          onSelectVessel(p.mmsi);
          if (mapRef.current) {
            if (popupRef.current) popupRef.current.remove();
            popupRef.current = new maplibregl.Popup({ offset: 15, closeButton: false })
              .setLngLat([p.lon, p.lat])
              .setHTML(`
                <div class="bg-[#181c27] text-white p-3 rounded-xl border border-[#00daf3]/40 font-mono text-xs shadow-2xl">
                  <div class="font-bold ${p.isCulprit ? 'text-[#ffb4ab]' : 'text-[#00daf3]'} mb-1 text-sm">${p.name}</div>
                  <div class="grid grid-cols-2 gap-1 text-[10px] text-[#bac9cc] my-1 border-t border-[#3b494c]/30 pt-1.5">
                    <div>MMSI: <span class="text-white font-bold">${p.mmsi}</span></div>
                    <div>IMO: <span class="text-white">${p.imo || 'N/A'}</span></div>
                    <div>Flag: <span class="text-white">${p.flag}</span></div>
                    <div>Type: <span class="text-white">${p.vessel_type}</span></div>
                    <div>SOG: <span class="text-white font-bold">${p.speed} kts</span></div>
                    <div>COG: <span class="text-white font-bold">${p.heading}°</span></div>
                  </div>
                  <div class="text-[9.5px] text-[#849396] mt-1">Dest: <span class="text-white">${p.destination || 'MUMBAI ANCHORAGE'}</span></div>
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
  }, [vessels, scrubbedVessels, suspects, mapLoaded, onSelectVessel]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Metocean Live Vector Overlay (Top-Right) */}
      <div className="absolute top-3 right-3 z-20 tactical-glass rounded-xl p-2.5 sm:p-3 border border-[#00e5ff]/30 shadow-2xl flex flex-col gap-2 select-none max-w-[200px] sm:max-w-[240px]">
        <div className="flex items-center justify-between border-b border-[#3b494c]/30 pb-1.5">
          <div className="flex items-center gap-1.5 text-white font-mono text-[11px] font-bold">
            <Compass className="w-3.5 h-3.5 text-[#00daf3] animate-spin-slow" />
            <span>METOCEAN VECTORS</span>
          </div>
          <span className="text-[9px] font-mono text-[#4ade80] font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></span>
            LIVE
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
          {/* Wind Vector */}
          <div className="p-1.5 bg-[#171b26] rounded border border-[#3b494c]/20 flex flex-col">
            <div className="flex items-center gap-1 text-[#00daf3]">
              <Wind className="w-3 h-3" />
              <span className="text-[9px] text-[#849396]">WIND</span>
            </div>
            <span className="font-bold text-white text-xs mt-0.5">{metocean?.wind_speed_kts || 16.2} kts</span>
            <span className="text-[9px] text-[#bac9cc] mt-0.5 flex items-center gap-0.5">
              <span style={{ transform: `rotate(${(metocean?.wind_direction_deg || 245) + 180}deg)` }} className="inline-block text-[#00daf3] font-bold">↑</span>
              <span>{metocean?.wind_direction_deg || 245}° {metocean?.wind_cardinal || 'WSW'}</span>
            </span>
          </div>

          {/* Current Vector */}
          <div className="p-1.5 bg-[#171b26] rounded border border-[#3b494c]/20 flex flex-col">
            <div className="flex items-center gap-1 text-[#00daf3]">
              <Waves className="w-3 h-3" />
              <span className="text-[9px] text-[#849396]">CURRENT</span>
            </div>
            <span className="font-bold text-white text-xs mt-0.5">{metocean?.current_speed_kts || 1.4} kts</span>
            <span className="text-[9px] text-[#bac9cc] mt-0.5 flex items-center gap-0.5">
              <span style={{ transform: `rotate(${metocean?.current_direction_deg || 65}deg)` }} className="inline-block text-[#00daf3] font-bold">↑</span>
              <span>{metocean?.current_direction_deg || 65}° {metocean?.current_cardinal || 'ENE'}</span>
            </span>
          </div>
        </div>

        {/* Net Drift Advection */}
        <div className="p-1.5 bg-[#171b26] rounded border border-[#00e5ff]/30 text-[9px] font-mono flex items-center justify-between">
          <span className="text-[#849396]">NET DRIFT:</span>
          <span className="text-[#00e5ff] font-bold">{metocean?.net_drift_speed_kts || 1.95} kts @ {metocean?.net_drift_direction_deg || 69.3}°</span>
        </div>
      </div>

      {/* Map Control Buttons */}
      <div className="absolute top-20 sm:top-28 left-3 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 rounded-lg bg-[#181c27]/90 hover:bg-[#262a35] border border-[#3b494c]/40 text-white flex items-center justify-center shadow-lg transition-colors"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 rounded-lg bg-[#181c27]/90 hover:bg-[#262a35] border border-[#3b494c]/40 text-white flex items-center justify-center shadow-lg transition-colors"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.flyTo({ center: centerCoordinates, zoom: 9.8, duration: 1000 })}
          className="w-8 h-8 rounded-lg bg-[#181c27]/90 hover:bg-[#262a35] border border-[#3b494c]/40 text-[#00daf3] flex items-center justify-center shadow-lg transition-colors"
          title="Center on Incident"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowTrails(!showTrails)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-lg transition-colors ${
            showTrails
              ? 'bg-[#ff3b30]/20 border-[#ff3b30] text-[#ffb4ab]'
              : 'bg-[#181c27]/90 border-[#3b494c]/40 text-[#849396]'
          }`}
          title="Toggle Culprit Trajectory Trail"
        >
          <Navigation className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowForecast(!showForecast)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-lg transition-colors ${
            showForecast
              ? 'bg-[#00e5ff]/20 border-[#00e5ff] text-[#00e5ff]'
              : 'bg-[#181c27]/90 border-[#3b494c]/40 text-[#849396]'
          }`}
          title="Toggle +6h Metocean Drift Forecast Envelope"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-20 sm:bottom-4 left-4 z-20 tactical-glass rounded-lg px-3 py-1.5 border border-[#3b494c]/30 flex items-center gap-3 text-[10px] font-mono text-[#bac9cc] select-none shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#ff2a40] border border-white"></span>
          <span>Active Oil Slick</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00daf3]"></span>
          <span>AIS Vessel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-[#ff3b30]"></span>
          <span>Discharge Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#00e5ff]/20 border border-[#00e5ff] border-dashed"></span>
          <span>+6h Forecast</span>
        </div>
      </div>
    </div>
  );
};
