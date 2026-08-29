import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { Plus, Minus, Crosshair, Eye, Navigation, Wind, Waves, Compass, Layers, History } from 'lucide-react';
import { SpillFeatureCollection, Vessel, SuspectVessel, MetoceanData } from '../types';
import { calculateSynchronizedOilSpill, generateForecastCone, generateHindcastCone } from '../lib/simulationEngine';

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
  centerCoordinates,
  timeOffsetMinutes = 0,
  metocean,
  scenario = 'bay_of_bengal',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const prevScenarioRef = useRef<string>(scenario);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const dumpMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showHindcast, setShowHindcast] = useState(true);
  const [showMetoceanOverlay, setShowMetoceanOverlay] = useState(true);

  const isEnnore = scenario === 'bay_of_bengal';
  const baseOrigin = useMemo<[number, number]>(() => {
    return isEnnore ? [80.750, 13.250] : [72.145, 19.048];
  }, [isEnnore]);

  // Primary suspect with maximum spillage probability
  const primarySuspect = useMemo(() => {
    if (!suspects || suspects.length === 0) return null;
    return suspects.reduce((prev, curr) => (curr.probability_score > prev.probability_score ? curr : prev), suspects[0]);
  }, [suspects]);

  // Synchronized Hydrodynamic Oil Spill Polygon (Drifts from baseOrigin with time)
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

  // Current Slick Centroid
  const slickCentroid = useMemo<[number, number]>(() => {
    const activeSpill = currentSpills.features[0];
    if (activeSpill?.properties?.center) {
      return activeSpill.properties.center as [number, number];
    }
    return isEnnore ? [80.769, 13.267] : [72.168, 19.062];
  }, [currentSpills, isEnnore]);

  // +6h Hydrodynamic Forecast Dispersal Fan (Cyan)
  const forecastConeFeature = useMemo(() => {
    const driftDir = metocean?.net_drift_direction_deg || (isEnnore ? 48.2 : 69.3);
    const driftSpeed = metocean?.net_drift_speed_kts || (isEnnore ? 1.52 : 1.95);

    const coneCoords = generateForecastCone(slickCentroid[0], slickCentroid[1], driftDir, driftSpeed, 6);

    return {
      type: "Feature" as const,
      properties: { name: "+6h Metocean Drift Forecast" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coneCoords],
      },
    };
  }, [slickCentroid, metocean, isEnnore]);

  // Hydrodynamic Hindcast (Back-Tracing) Features (Amber Trail from Live Slick -> Dump Origin)
  const hindcastFeatures = useMemo(() => {
    const driftDir = metocean?.net_drift_direction_deg || (isEnnore ? 48.2 : 69.3);
    const driftSpeed = metocean?.net_drift_speed_kts || (isEnnore ? 1.52 : 1.95);

    // Subtle reverse fan
    const coneCoords = generateHindcastCone(slickCentroid[0], slickCentroid[1], driftDir, driftSpeed, isEnnore ? 1.4 : 1.1);

    const coneFeature = {
      type: "Feature" as const,
      properties: { name: "Hindcast Reverse Dispersal Cone" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coneCoords],
      },
    };

    // Vector line precisely connecting the live slick centroid to the true dump origin
    const lineFeature = {
      type: "Feature" as const,
      properties: { name: "Hindcast Reverse Vector" },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [slickCentroid[0], slickCentroid[1]],
          [baseOrigin[0], baseOrigin[1]],
        ],
      },
    };

    return {
      type: "FeatureCollection" as const,
      features: [coneFeature, lineFeature],
    };
  }, [slickCentroid, baseOrigin, metocean, isEnnore]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const isEnnoreInit = scenario === 'bay_of_bengal';
    const initCenter: [number, number] = centerCoordinates || (isEnnoreInit ? [80.750, 13.250] : [72.150, 19.050]);
    const initZoom = isEnnoreInit ? 10.2 : 10.0;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-dark-base': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri, GEBCO, Garmin',
          },
          'esri-dark-reference': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'base-tiles',
            type: 'raster',
            source: 'esri-dark-base',
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'reference-tiles',
            type: 'raster',
            source: 'esri-dark-reference',
            minzoom: 0,
            maxzoom: 19,
            paint: { 'raster-opacity': 0.65 },
          },
        ],
      },
      center: initCenter,
      zoom: initZoom,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      setMapLoaded(true);

      // 1. Forecast Source & Layers (Cyan)
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
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: 'forecast-line',
        type: 'line',
        source: 'forecast-source',
        paint: {
          'line-color': '#22d3ee',
          'line-width': 1.5,
          'line-dasharray': [3, 3],
        },
      });

      // 2. Hindcast Source & Layers (Amber)
      map.addSource('hindcast-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'hindcast-fill',
        type: 'fill',
        source: 'hindcast-source',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.14,
        },
      });

      map.addLayer({
        id: 'hindcast-line',
        type: 'line',
        source: 'hindcast-source',
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#fbbf24',
          'line-width': 2.5,
          'line-dasharray': [4, 4],
        },
      });

      // 3. Culprit Trajectory Layers (Pink / Red)
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
          'line-width': 5,
          'line-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'trajectory-dashed',
        type: 'line',
        source: 'culprit-trajectory',
        paint: {
          'line-color': '#fb7185',
          'line-width': 2.5,
          'line-dasharray': [4, 2],
        },
      });

      // 4. Oil Spill Layers (Crimson Red)
      map.addSource('spills-source', {
        type: 'geojson',
        data: currentSpills,
      });

      map.addLayer({
        id: 'spills-glow',
        type: 'line',
        source: 'spills-source',
        paint: {
          'line-color': '#e11d48',
          'line-width': 6,
          'line-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'spills-fill',
        type: 'fill',
        source: 'spills-source',
        paint: {
          'fill-color': '#e11d48',
          'fill-opacity': 0.55,
        },
      });

      map.addLayer({
        id: 'spills-line',
        type: 'line',
        source: 'spills-source',
        paint: {
          'line-color': '#ff4d6d',
          'line-width': 2.5,
        },
      });

      // Spill click handler
      map.on('click', 'spills-fill', (e) => {
        if (e.features && e.features[0]) {
          const id = e.features[0].properties?.id || (scenario === 'arabian_sea' ? 'INC-IND-2024-01' : 'INC-IND-2017-02');
          onSelectSpill(id);
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

  // Update viewport when scenario changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    if (prevScenarioRef.current === scenario) return;
    prevScenarioRef.current = scenario;

    const isEnnoreTarget = scenario === 'bay_of_bengal';
    const targetCenter: [number, number] = isEnnoreTarget ? [80.750, 13.250] : [72.150, 19.050];
    const targetZoom = isEnnoreTarget ? 10.2 : 10.0;

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    mapRef.current.resize();
    mapRef.current.flyTo({
      center: targetCenter,
      zoom: targetZoom,
      essential: true,
      duration: 1000,
    });
  }, [scenario, mapLoaded]);

  // Update Live Spills Layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('spills-source') as maplibregl.GeoJSONSource;
    if (src) src.setData(currentSpills);
  }, [currentSpills, mapLoaded]);

  // Update Forecast Cone Layer
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

  // Update Hindcast Trail & Cone Layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('hindcast-source') as maplibregl.GeoJSONSource;
    if (!src) return;

    if (showHindcast && hindcastFeatures) {
      src.setData(hindcastFeatures);
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [hindcastFeatures, showHindcast, mapLoaded]);

  // Update Culprit Trajectory Trail Layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('culprit-trajectory') as maplibregl.GeoJSONSource;
    if (!src) return;

    if (!showTrails || !primarySuspect?.trajectory) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

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
  }, [primarySuspect, showTrails, mapLoaded]);

  // Render Exactly ONE Unified Dump Origin Marker placed directly on baseOrigin
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (dumpMarkerRef.current) {
      dumpMarkerRef.current.remove();
      dumpMarkerRef.current = null;
    }

    if (!showHindcast) return;

    const dumpTimeLabel = isEnnore ? '28 Jan 03:45 IST (T-60m)' : '14 Aug 05:29:40 IST (T-42m)';
    const dumpAction = isEnnore ? 'Collision & Breach Origin' : 'Discharge Dump Origin';
    const suspectShip = isEnnore ? 'MT DAWN KANCHEEPURAM' : 'MT DESH SHANTI';
    const cpaDist = isEnnore ? '0.00 km CPA' : '0.34 km CPA';

    const el = document.createElement('div');
    el.className = 'select-none pointer-events-auto cursor-pointer relative z-20';
    el.innerHTML = `
      <div class="relative flex flex-col items-center group -translate-y-1/2">
        <!-- Unified Glowing Amber Target Locus Dot -->
        <div class="relative flex items-center justify-center">
          <div class="absolute w-7 h-7 rounded-full bg-amber-400/40 animate-ping pointer-events-none"></div>
          <div class="w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-xl flex items-center justify-center relative z-10">
            <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
          </div>
        </div>

        <!-- High-Contrast Clean Tactical Callout (Centered directly below the pin) -->
        <div class="mt-1.5 bg-slate-950/95 border border-amber-400/90 rounded px-2.5 py-1 shadow-2xl flex flex-col items-center gap-0.5 whitespace-nowrap backdrop-blur-md">
          <div class="flex items-center gap-1 font-mono text-[10px] font-bold text-amber-300">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>DUMPED: ${dumpTimeLabel}</span>
          </div>
          <div class="text-[8.5px] font-mono text-slate-300">
            ${dumpAction} • <span class="text-amber-200 font-semibold">${suspectShip}</span> (${cpaDist})
          </div>
        </div>
      </div>
    `;

    el.addEventListener('click', () => {
      if (primarySuspect) {
        onSelectVessel(primarySuspect.mmsi);
      }
      if (mapRef.current) {
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setLngLat(baseOrigin)
          .setHTML(`
            <div class="bg-slate-950/95 text-slate-100 p-3 rounded-lg border border-amber-500/80 font-mono text-xs shadow-2xl min-w-[220px]">
              <div class="font-bold text-amber-400 text-xs mb-1 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>HYDRODYNAMIC HINDCAST ORIGIN</span>
              </div>
              <div class="text-[10px] text-slate-300 border-t border-slate-800 pt-1.5 flex flex-col gap-1">
                <div>Timestamp: <span class="text-white font-bold">${dumpTimeLabel}</span></div>
                <div>Locus: <span class="text-amber-200 font-bold">${baseOrigin[1].toFixed(4)}°N, ${baseOrigin[0].toFixed(4)}°E</span></div>
                <div>Primary Culprit: <span class="text-rose-400 font-bold">${suspectShip}</span></div>
                <div>CPA Proximity: <span class="text-emerald-400 font-bold">${cpaDist}</span></div>
              </div>
            </div>
          `)
          .addTo(mapRef.current);
      }
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(baseOrigin)
      .addTo(mapRef.current);

    dumpMarkerRef.current = marker;

    return () => {
      if (dumpMarkerRef.current) {
        dumpMarkerRef.current.remove();
        dumpMarkerRef.current = null;
      }
    };
  }, [showHindcast, baseOrigin, primarySuspect, isEnnore, mapLoaded, onSelectVessel]);

  // Clean and remove old markers on scenario change
  useEffect(() => {
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    if (dumpMarkerRef.current) {
      dumpMarkerRef.current.remove();
      dumpMarkerRef.current = null;
    }
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, [scenario]);

  // Update Vessel HTML Markers (Clean, non-glitchy gliding)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const positions = vessels.map((v) => {
      const scrubbed = scrubbedVessels?.find((s) => s.mmsi === v.mmsi);
      const isPrimary = primarySuspect && primarySuspect.mmsi === v.mmsi;
      const linkedSpill = v.linked_spill || (isPrimary ? primarySuspect.linked_spill : undefined);
      const anomalyScore = v.anomaly_score ?? (isPrimary ? (primarySuspect.anomaly_score || primarySuspect.probability_score) : 5.0);

      return {
        mmsi: v.mmsi,
        imo: v.imo_number,
        name: v.name,
        vessel_type: v.vessel_type,
        flag: v.flag,
        destination: v.destination,
        speed: scrubbed?.speed ?? (v.current_position?.speed_knots || 14.0),
        lon: scrubbed ? scrubbed.lon : (v.current_position?.longitude || baseOrigin[0]),
        lat: scrubbed ? scrubbed.lat : (v.current_position?.latitude || baseOrigin[1]),
        heading: scrubbed ? scrubbed.heading : (v.current_position?.heading_degrees || 52),
        isPrimary,
        probability: isPrimary ? primarySuspect.probability_score : 5.0,
        anomalyScore,
        evidenceTags: v.anomaly_breakdown?.evidence_tags || (isPrimary ? primarySuspect.evidence_tags : []),
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
                <div class="bg-slate-900/95 text-slate-100 p-3 rounded-lg border ${p.isPrimary ? 'border-rose-500/60' : 'border-cyan-500/50'} font-mono text-xs shadow-xl min-w-[220px]">
                  <div class="font-bold ${p.isPrimary ? 'text-rose-400' : 'text-cyan-400'} text-xs mb-1.5 flex items-center justify-between">
                    <span>${p.name}</span>
                    ${p.anomalyScore > 70 ? `<span class="bg-rose-500/20 text-rose-300 text-[10px] px-1.5 py-0.5 rounded border border-rose-500/40">Anomaly: ${p.anomalyScore}%</span>` : ''}
                  </div>
                  <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-300 pt-1 border-t border-slate-700/50">
                    <div>MMSI: <span class="text-white font-bold">${p.mmsi}</span></div>
                    <div>Flag: <span class="text-white">${p.flag}</span></div>
                    <div>Type: <span class="text-white">${p.vessel_type}</span></div>
                    <div>Speed: <span class="text-white font-bold">${p.speed} kts</span></div>
                    <div>Heading: <span class="text-white">${p.heading}°</span></div>
                    <div>Status: <span class="text-emerald-400">Underway</span></div>
                  </div>
                  ${p.isPrimary && p.evidenceTags && p.evidenceTags.length > 0 ? `
                    <div class="mt-1.5 pt-1 border-t border-slate-800 flex flex-wrap gap-1">
                      ${p.evidenceTags.map((tag: string) => `<span class="text-[8.5px] bg-rose-950/80 text-rose-300 px-1.5 py-0.2 rounded border border-rose-800/60">${tag}</span>`).join('')}
                    </div>
                  ` : ''}
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
  }, [vessels, scrubbedVessels, primarySuspect, mapLoaded, onSelectVessel, scenario, baseOrigin]);

  return (
    <div className="relative w-full h-full bg-[#0d1117] overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Banner (Maritime Incident Status) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-[94%] sm:w-auto max-w-lg">
        <div className="tactical-glass rounded-xl px-3 sm:px-4 py-2 border border-rose-500/40 shadow-2xl flex flex-col gap-0.5 text-center font-mono">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="text-rose-400 font-bold">TARGET INCIDENT LOG</span>
            <span className="text-slate-400">•</span>
            <span className="text-white bg-rose-950 px-1.5 py-0.5 rounded border border-rose-600/60 font-bold shadow-sm">
              {isEnnore ? '28 JAN 2017 • 03:45:00 IST (22:15 UTC)' : '14 AUG 2024 • 05:29:40 IST (T-42m)'}
            </span>
          </div>
          <div className="text-[9px] text-slate-300 truncate mt-0.5">
            {isEnnore
              ? 'Kamarajar Port Ennore (13°14.2\'N, 80°21.8\'E) • BW MAPLE vs MT DAWN KANCHEEPURAM (DG Shipping Validated)'
              : 'Mumbai High Sector (19°02.9\'N, 72°08.7\'E) • MT DESH SHANTI (Copernicus C-SAR Feed)'}
          </div>
        </div>
      </div>

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
              <span className="font-bold text-white text-xs mt-0.5">{metocean?.wind_speed_kts || (isEnnore ? 12.8 : 16.2)} kts</span>
              <span className="text-[9px] text-slate-400 mt-0.5">
                {metocean?.wind_direction_deg || (isEnnore ? 190 : 245)}° ({metocean?.wind_cardinal || (isEnnore ? 'S' : 'WSW')})
              </span>
            </div>

            {/* Current Vector */}
            <div className="p-1.5 bg-slate-900/80 rounded border border-slate-800 flex flex-col">
              <div className="flex items-center gap-1 text-slate-400 text-[9px]">
                <Waves className="w-3 h-3 text-cyan-400" />
                <span>CURRENT</span>
              </div>
              <span className="font-bold text-white text-xs mt-0.5">{metocean?.current_speed_kts || (isEnnore ? 1.1 : 1.4)} kts</span>
              <span className="text-[9px] text-slate-400 mt-0.5">
                {metocean?.current_direction_deg || (isEnnore ? 40 : 65)}° ({metocean?.current_cardinal || (isEnnore ? 'NE' : 'ENE')})
              </span>
            </div>
          </div>

          {/* Net Slick Drift Vector & Hindcast Vector */}
          <div className="flex flex-col gap-1 text-[9.5px] font-mono">
            <div className="p-1 bg-slate-900/90 rounded border border-cyan-500/20 flex items-center justify-between">
              <span className="text-slate-400">Forward Drift:</span>
              <span className="text-cyan-300 font-bold">
                {metocean?.net_drift_speed_kts || (isEnnore ? 1.52 : 1.95)} kts @ {metocean?.net_drift_direction_deg || (isEnnore ? 48.2 : 69.3)}°
              </span>
            </div>
            <div className="p-1 bg-amber-950/40 rounded border border-amber-500/30 flex items-center justify-between text-amber-300">
              <span className="text-amber-400/80">Reverse Hindcast:</span>
              <span className="font-bold">
                {metocean?.net_drift_speed_kts || (isEnnore ? 1.52 : 1.95)} kts @ {((metocean?.net_drift_direction_deg || (isEnnore ? 48.2 : 69.3)) + 180) % 360}°
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Map Controls (Left-Side) */}
      <div className="absolute top-20 sm:top-24 left-3 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 text-slate-200 hover:text-white flex items-center justify-center shadow-lg transition-colors"
          title="Zoom In"
          aria-label="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 text-slate-200 hover:text-white flex items-center justify-center shadow-lg transition-colors"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.flyTo({ center: isEnnore ? [80.750, 13.250] : [72.150, 19.050], zoom: isEnnore ? 10.2 : 10.0, duration: 800 })}
          className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 text-cyan-400 flex items-center justify-center shadow-lg transition-colors"
          title="Center on Incident"
          aria-label="Center map on incident location"
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
          aria-label="Toggle vessel trajectory tracks"
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
          aria-label="Toggle 6-hour drift forecast"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowHindcast(!showHindcast)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-lg transition-colors ${
            showHindcast
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
              : 'bg-slate-900/90 border-slate-700/60 text-slate-400'
          }`}
          title="Toggle Hydrodynamic Hindcast (Back-Trace)"
          aria-label="Toggle hydrodynamic hindcast back-trace"
        >
          <History className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowMetoceanOverlay(!showMetoceanOverlay)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-lg transition-colors ${
            showMetoceanOverlay
              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
              : 'bg-slate-900/90 border-slate-700/60 text-slate-400'
          }`}
          title="Toggle Metocean Drift Card"
          aria-label="Toggle metocean overlay card"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {/* Clean Bottom Legend */}
      <div className="absolute bottom-20 sm:bottom-4 left-4 z-20 tactical-glass rounded-lg px-3 py-1.5 border border-slate-700/40 flex items-center gap-3 text-[10px] font-mono text-slate-300 select-none shadow-lg flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-600 border border-rose-300"></span>
          <span>Oil Slick (SAR)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-rose-400"></span>
          <span>Tanker Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/20 border border-cyan-400 border-dashed"></span>
          <span>+6h Forecast</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-400 border-dashed"></span>
          <span>Hindcast Trail & Dump Locus</span>
        </div>
      </div>
    </div>
  );
};
