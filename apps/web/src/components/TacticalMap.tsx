import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { Plus, Minus, Crosshair, Eye, Navigation, Wind, Waves, Compass, Layers, History, ShieldAlert } from 'lucide-react';
import { SpillFeatureCollection, Vessel, SuspectVessel, MetoceanData, SpillGeoFeature } from '../types';
import { calculateSynchronizedOilSpill, moveCoordinate, generateForecastCone, MUMBAI_INCIDENTS } from '../lib/simulationEngine';

// Precise Great-Circle Bearing (degrees clockwise from North)
function calculateBearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// Generate mathematically locked directional cone between two points
function generateConeBetweenPoints(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
  startHalfWidthKm: number = 0.35,
  endHalfWidthKm: number = 0.85
): number[][] {
  const bearing = calculateBearing(startLon, startLat, endLon, endLat);
  const perp1 = (bearing - 90 + 360) % 360;
  const perp2 = (bearing + 90) % 360;

  const leftStart = moveCoordinate(startLon, startLat, perp1, startHalfWidthKm);
  const rightStart = moveCoordinate(startLon, startLat, perp2, startHalfWidthKm);
  const rightEnd = moveCoordinate(endLon, endLat, perp2, endHalfWidthKm);
  const tipEnd = moveCoordinate(endLon, endLat, bearing, endHalfWidthKm * 0.3);
  const leftEnd = moveCoordinate(endLon, endLat, perp1, endHalfWidthKm);

  return [leftStart, rightStart, rightEnd, tipEnd, leftEnd, leftStart];
}

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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectVesselRef = useRef(onSelectVessel);
  onSelectVesselRef.current = onSelectVessel;
  const onSelectSpillRef = useRef(onSelectSpill);
  onSelectSpillRef.current = onSelectSpill;

  const [mapLoaded, setMapLoaded] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showHindcast, setShowHindcast] = useState(true);
  const [showMetoceanOverlay, setShowMetoceanOverlay] = useState(true);

  // Active Incident Config
  const currentIncident = MUMBAI_INCIDENTS[selectedSpillId] || MUMBAI_INCIDENTS["INC-MUM-2024-01"];
  const dischargeOffset = currentIncident.dischargeOffsetMinutes;
  const isPostDischarge = timeOffsetMinutes >= dischargeOffset;
  const baseOrigin = currentIncident.originCoords;

  // Primary suspect for active spill
  const primarySuspect = useMemo(() => {
    if (!suspects || suspects.length === 0) return null;
    return suspects.find(s => s.mmsi === currentIncident.culpritMmsi) ||
      suspects.reduce((prev, curr) => (curr.probability_score > prev.probability_score ? curr : prev), suspects[0]);
  }, [suspects, currentIncident]);

  // Synchronized Hydrodynamic Oil Spill Polygons for ALL Mumbai incidents
  const currentSpills = useMemo<SpillFeatureCollection>(() => {
    const features: SpillGeoFeature[] = Object.values(MUMBAI_INCIDENTS).map((config) => {
      const live = calculateSynchronizedOilSpill(timeOffsetMinutes, config.id, metocean);
      const isSelected = config.id === selectedSpillId;

      return {
        type: "Feature",
        id: config.id,
        properties: {
          id: config.id,
          detection_timestamp: new Date().toISOString(),
          area_sq_km: live.area,
          perimeter_km: live.perimeter,
          confidence_score: config.confidence,
          source_scene: config.sourceScene,
          status: "ACTIVE",
          center: live.center,
          estimated_discharge_liters: config.volumeLiters,
          slick_type: config.slickType,
        },
        geometry: {
          type: "Polygon",
          coordinates: live.hasDischarged && live.polygon.length > 0 ? [live.polygon] : [],
        },
      };
    });

    return {
      type: "FeatureCollection",
      features: features.filter(f => f.geometry.coordinates.length > 0),
    };
  }, [selectedSpillId, timeOffsetMinutes, metocean]);

  // Current Slick Centroid Position for Active Spill
  const slickCentroid = useMemo<[number, number]>(() => {
    const activeSpill = currentSpills.features.find(f => f.properties.id === selectedSpillId);
    if (activeSpill?.properties?.center) {
      return activeSpill.properties.center as [number, number];
    }
    return baseOrigin;
  }, [currentSpills, selectedSpillId, baseOrigin]);

  // Hydrodynamic Hindcast Back-Tracing for Active Spill
  const hindcastFeatures = useMemo(() => {
    if (!isPostDischarge) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    const isAtOrigin = Math.abs(slickCentroid[0] - baseOrigin[0]) < 0.001 && Math.abs(slickCentroid[1] - baseOrigin[1]) < 0.001;

    const coneCoords = isAtOrigin
      ? [
          [baseOrigin[0] - 0.003, baseOrigin[1] - 0.003],
          [baseOrigin[0] + 0.003, baseOrigin[1] - 0.003],
          [baseOrigin[0] + 0.003, baseOrigin[1] + 0.003],
          [baseOrigin[0] - 0.003, baseOrigin[1] + 0.003],
          [baseOrigin[0] - 0.003, baseOrigin[1] - 0.003],
        ]
      : generateConeBetweenPoints(
          slickCentroid[0],
          slickCentroid[1],
          baseOrigin[0],
          baseOrigin[1],
          0.30,
          0.75
        );

    const coneFeature = {
      type: "Feature" as const,
      properties: { name: "Hindcast Reverse Dispersal Cone" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coneCoords],
      },
    };

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
  }, [slickCentroid, baseOrigin, isPostDischarge]);

  // +6h Hydrodynamic Forecast Dispersal Fan
  const forecastFeatures = useMemo(() => {
    if (!isPostDischarge) {
      return { type: "FeatureCollection" as const, features: [] };
    }
    const driftDir = metocean?.net_drift_direction_deg || 69.3;
    const driftSpeed = metocean?.net_drift_speed_kts || 1.95;

    const cone = generateForecastCone(
      slickCentroid[0],
      slickCentroid[1],
      driftDir,
      driftSpeed,
      6
    );

    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { name: "+6h Dispersal Forecast Fan" },
          geometry: {
            type: "Polygon" as const,
            coordinates: [cone],
          },
        },
      ],
    };
  }, [slickCentroid, metocean, isPostDischarge]);

  // Dump Origin Point GeoJSON Feature
  const dumpOriginFeature = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {
            name: `${currentIncident.name} Breach Origin`,
            id: selectedSpillId,
          },
          geometry: {
            type: "Point" as const,
            coordinates: baseOrigin,
          },
        },
      ],
    };
  }, [currentIncident, selectedSpillId, baseOrigin]);

  // Initialize MapLibre GL Map (Centered on Mumbai Waters)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initCenter: [number, number] = centerCoordinates || [72.350, 19.050];
    const initZoom = 9.8;

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

      // 1. Forecast Source & Layers (Cyan Fan)
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
          'fill-opacity': 0.12,
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

      // 2. Hindcast Source & Layers (Amber Reverse Cone & Vector)
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
          'line-dasharray': [4, 3],
        },
      });

      // 3. Dump Origin Point Layers
      map.addSource('dump-origin-source', {
        type: 'geojson',
        data: dumpOriginFeature,
      });

      map.addLayer({
        id: 'dump-dot-glow',
        type: 'circle',
        source: 'dump-origin-source',
        paint: {
          'circle-radius': 12,
          'circle-color': '#f59e0b',
          'circle-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'dump-dot-ring',
        type: 'circle',
        source: 'dump-origin-source',
        paint: {
          'circle-radius': 6.5,
          'circle-color': '#fbbf24',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      map.addLayer({
        id: 'dump-dot-core',
        type: 'circle',
        source: 'dump-origin-source',
        paint: {
          'circle-radius': 2.2,
          'circle-color': '#020617',
        },
      });

      // 4. Culprit Trajectory Layers
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

      // 5. Oil Spill Layers (Crimson Multi-Spill Polygons)
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
          'fill-color': [
            'case',
            ['==', ['get', 'id'], selectedSpillId],
            '#e11d48',
            '#be123c'
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'id'], selectedSpillId],
            0.55,
            0.35
          ],
        },
      });

      map.addLayer({
        id: 'spills-line',
        type: 'line',
        source: 'spills-source',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'id'], selectedSpillId],
            '#fb7185',
            '#f43f5e'
          ],
          'line-width': [
            'case',
            ['==', ['get', 'id'], selectedSpillId],
            2.5,
            1.5
          ],
        },
      });

      // Click on spill polygon to select
      map.on('click', 'spills-fill', (e) => {
        if (e.features && e.features[0]) {
          const clickedId = e.features[0].properties?.id;
          if (clickedId) {
            onSelectSpillRef.current(clickedId);
          }
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

  // Update Dynamic Map Layers
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // 1. Update Spills Source
    const spillsSrc = map.getSource('spills-source') as maplibregl.GeoJSONSource;
    if (spillsSrc) spillsSrc.setData(currentSpills);

    // 2. Update Hindcast Source
    const hindcastSrc = map.getSource('hindcast-source') as maplibregl.GeoJSONSource;
    if (hindcastSrc) hindcastSrc.setData(hindcastFeatures);

    // 3. Update Forecast Source
    const forecastSrc = map.getSource('forecast-source') as maplibregl.GeoJSONSource;
    if (forecastSrc) forecastSrc.setData(forecastFeatures);

    // 4. Update Dump Origin Source
    const dumpSrc = map.getSource('dump-origin-source') as maplibregl.GeoJSONSource;
    if (dumpSrc) dumpSrc.setData(dumpOriginFeature);

    // 5. Update Culprit Trajectory Track
    const trajSrc = map.getSource('culprit-trajectory') as maplibregl.GeoJSONSource;
    if (trajSrc) {
      if (primarySuspect?.trajectory && primarySuspect.trajectory.length > 1) {
        const lineCoords = primarySuspect.trajectory.map((t) => [t[0], t[1]]);
        trajSrc.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: primarySuspect.name },
              geometry: { type: 'LineString', coordinates: lineCoords },
            },
          ],
        });
      } else {
        trajSrc.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [mapLoaded, currentSpills, hindcastFeatures, forecastFeatures, dumpOriginFeature, primarySuspect]);

  // Smooth camera fly-to when selected incident changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    map.flyTo({
      center: baseOrigin,
      zoom: 10.2,
      duration: 1200,
      essential: true
    });
  }, [selectedSpillId, baseOrigin, mapLoaded]);

  // Render & Update Vessel Markers
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const displayVessels = scrubbedVessels || vessels.map((v) => ({
      mmsi: v.mmsi,
      lon: v.current_position?.longitude ?? 72.150,
      lat: v.current_position?.latitude ?? 19.050,
      heading: v.current_position?.heading_degrees ?? 0,
      speed: v.current_position?.speed_knots ?? 0,
    }));

    displayVessels.forEach((v) => {
      const isCulprit = primarySuspect?.mmsi === v.mmsi;
      const isCoastGuard = v.mmsi === 419000999;
      const fullVessel = vessels.find((item) => item.mmsi === v.mmsi);
      const name = fullVessel?.name || `MMSI ${v.mmsi}`;
      const markerKey = `vessel-${v.mmsi}`;

      let marker = markersRef.current[markerKey];

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'vessel-marker group cursor-pointer';
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.style.transition = 'transform 0.2s ease';

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z');
        path.setAttribute('fill', isCulprit ? '#f43f5e' : isCoastGuard ? '#06b6d4' : '#94a3b8');
        path.setAttribute('stroke', '#020617');
        path.setAttribute('stroke-width', '1.5');

        svg.appendChild(path);
        el.appendChild(svg);

        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onSelectVesselRef.current(v.mmsi);
        });

        marker = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
          .setLngLat([v.lon, v.lat])
          .addTo(map);

        markersRef.current[markerKey] = marker;
      } else {
        marker.setLngLat([v.lon, v.lat]);
      }

      marker.setRotation(v.heading);
    });

    // Cleanup markers that are no longer in fleet
    const activeKeys = new Set(displayVessels.map(v => `vessel-${v.mmsi}`));
    Object.keys(markersRef.current).forEach(key => {
      if (!activeKeys.has(key)) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });
  }, [mapLoaded, vessels, scrubbedVessels, primarySuspect]);

  return (
    <div className="relative w-full h-full bg-[#0b0f19] overflow-hidden">
      {/* MapLibre WebGL Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Layer Toggles & Map Controls Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 font-mono text-xs select-none">
        <div className="bg-[#111622]/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1.5 backdrop-blur-md shadow-lg">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
            Tactical Layers
          </span>
          <button
            onClick={() => setShowHindcast(!showHindcast)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-left transition-all ${
              showHindcast ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>-6h Hindcast Cone</span>
          </button>
          <button
            onClick={() => setShowForecast(!showForecast)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-left transition-all ${
              showForecast ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>+6h Drift Forecast</span>
          </button>
          <button
            onClick={() => setShowTrails(!showTrails)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-left transition-all ${
              showTrails ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>AIS Culprit Track</span>
          </button>
        </div>
      </div>

      {/* Active Incident HUD Badge */}
      <div className="absolute top-4 right-4 z-10 font-mono text-xs select-none hidden sm:block">
        <div className="bg-[#111622]/90 border border-slate-800 rounded-lg p-2.5 flex items-center gap-3 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <div>
              <div className="text-white font-bold text-[11px]">{currentIncident.name}</div>
              <div className="text-[10px] text-slate-400">{currentIncident.locationName}</div>
            </div>
          </div>
          <div className="pl-3 border-l border-slate-800 text-right">
            <div className="text-rose-400 font-bold">{currentIncident.baseAreaSqKm} km²</div>
            <div className="text-[9px] text-slate-500">{currentIncident.volumeLiters.toLocaleString()} L</div>
          </div>
        </div>
      </div>

      {/* Zoom Controls Bottom-Right */}
      <div className="absolute bottom-6 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          className="w-8 h-8 rounded-lg bg-[#111622]/90 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center backdrop-blur-md shadow-md"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          className="w-8 h-8 rounded-lg bg-[#111622]/90 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center backdrop-blur-md shadow-md"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            mapRef.current?.flyTo({ center: baseOrigin, zoom: 10.2, duration: 1000 });
          }}
          aria-label="Recenter camera on breach origin"
          title="Recenter camera on breach origin"
          className="w-8 h-8 rounded-lg bg-[#111622]/90 border border-slate-800 text-cyan-400 hover:text-cyan-300 flex items-center justify-center backdrop-blur-md shadow-md"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
