import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { Plus, Minus, Crosshair, Eye, Navigation, Wind, Waves, Compass, Layers, History, ShieldAlert, ChevronUp, AlertTriangle, Ship } from 'lucide-react';
import { SpillFeatureCollection, Vessel, SuspectVessel, MetoceanData, SpillGeoFeature } from '../types';
import {
  calculateSynchronizedOilSpill,
  moveCoordinate,
  generateForecastCone,
  MUMBAI_INCIDENTS,
  MUMBAI_VESSEL_WAYPOINTS
} from '../lib/simulationEngine';

// Precise Great-Circle Bearing (degrees clockwise from North)
function calculateBearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
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
  const heading = calculateBearing(startLon, startLat, endLon, endLat);
  const perpHeading = heading + 90;

  const leftStart = moveCoordinate(startLon, startLat, perpHeading + 180, startHalfWidthKm);
  const rightStart = moveCoordinate(startLon, startLat, perpHeading, startHalfWidthKm);
  const rightEnd = moveCoordinate(endLon, endLat, perpHeading, endHalfWidthKm);
  const leftEnd = moveCoordinate(endLon, endLat, perpHeading + 180, endHalfWidthKm);
  const tipEnd = moveCoordinate(endLon, endLat, heading, 0.4);

  return [leftStart, rightStart, rightEnd, tipEnd, leftEnd, leftStart];
}

interface TacticalMapProps {
  spills: SpillFeatureCollection;
  vessels: Vessel[];
  suspects: SuspectVessel[];
  selectedSpillId: string;
  selectedVesselMmsi?: number | null;
  onSelectSpill: (id: string) => void;
  onSelectVessel: (mmsi: number) => void;
  scrubbedVessels?: { mmsi: number; lon: number; lat: number; heading: number; speed?: number }[];
  centerCoordinates?: [number, number];
  timeOffsetMinutes?: number;
  metocean?: MetoceanData;
  scenario?: string;
  onOpenMobileDrawer?: () => void;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  spills,
  vessels,
  suspects,
  selectedSpillId,
  selectedVesselMmsi,
  onSelectSpill,
  onSelectVessel,
  scrubbedVessels,
  centerCoordinates,
  timeOffsetMinutes = 0,
  metocean,
  onOpenMobileDrawer,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const onSelectVesselRef = useRef(onSelectVessel);
  onSelectVesselRef.current = onSelectVessel;
  const onSelectSpillRef = useRef(onSelectSpill);
  onSelectSpillRef.current = onSelectSpill;

  const [mapLoaded, setMapLoaded] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showHindcast, setShowHindcast] = useState(true);

  // Active Incident Config
  const currentIncident = MUMBAI_INCIDENTS[selectedSpillId] || MUMBAI_INCIDENTS["INC-MUM-2024-01"];
  const dischargeOffset = currentIncident.dischargeOffsetMinutes;
  const isPostDischarge = timeOffsetMinutes >= dischargeOffset;
  const baseOrigin = currentIncident.originCoords;

  // Active Inspected Suspect Vessel (matches selectedVesselMmsi or incident culprit)
  const activeSuspect = useMemo(() => {
    if (!suspects || suspects.length === 0) return null;
    return (
      suspects.find((s) => s.mmsi === selectedVesselMmsi) ||
      suspects.find((s) => s.mmsi === currentIncident.culpritMmsi) ||
      suspects[0]
    );
  }, [suspects, selectedVesselMmsi, currentIncident]);

  // Synchronized Hydrodynamic Oil Spill Polygons for ALL Mumbai incidents
  const currentSpills = useMemo<SpillFeatureCollection>(() => {
    const features: SpillGeoFeature[] = Object.values(MUMBAI_INCIDENTS).map((config) => {
      const live = calculateSynchronizedOilSpill(timeOffsetMinutes, config.id, metocean);

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
      features: features.filter((f) => f.geometry.coordinates.length > 0),
    };
  }, [selectedSpillId, timeOffsetMinutes, metocean]);

  // Current Slick Centroid Position for Active Spill
  const slickCentroid = useMemo<[number, number]>(() => {
    const activeSpill = currentSpills.features.find((f) => f.properties.id === selectedSpillId);
    if (activeSpill?.properties?.center) {
      return activeSpill.properties.center as [number, number];
    }
    return baseOrigin;
  }, [currentSpills, selectedSpillId, baseOrigin]);

  // Hydrodynamic Hindcast Back-Tracing for Active Spill
  const hindcastFeatures = useMemo(() => {
    if (!showHindcast || !isPostDischarge) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    const isAtOrigin =
      Math.abs(slickCentroid[0] - baseOrigin[0]) < 0.001 && Math.abs(slickCentroid[1] - baseOrigin[1]) < 0.001;

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
  }, [slickCentroid, baseOrigin, isPostDischarge, showHindcast]);

  // +6h Hydrodynamic Forecast Dispersal Fan
  const forecastFeatures = useMemo(() => {
    if (!showForecast || !isPostDischarge) {
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
  }, [slickCentroid, metocean, isPostDischarge, showForecast]);

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

  // Initialize MapLibre GL Map
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
          'circle-radius': 14,
          'circle-color': '#f59e0b',
          'circle-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'dump-dot-ring',
        type: 'circle',
        source: 'dump-origin-source',
        paint: {
          'circle-radius': 7.5,
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
          'circle-radius': 2.5,
          'circle-color': '#020617',
        },
      });

      // 4. Secondary Background Trajectories
      map.addSource('all-trajectories', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'all-trajectories-line',
        type: 'line',
        source: 'all-trajectories',
        paint: {
          'line-color': '#64748b',
          'line-width': 1.5,
          'line-dasharray': [3, 3],
          'line-opacity': 0.45,
        },
      });

      // 5. Active Culprit Trajectory Layers
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
          'line-width': 6,
          'line-opacity': 0.30,
        },
      });

      map.addLayer({
        id: 'trajectory-dashed',
        type: 'line',
        source: 'culprit-trajectory',
        paint: {
          'line-color': '#fb7185',
          'line-width': 2.8,
          'line-dasharray': [4, 2],
        },
      });

      // 6. Oil Spill Layers (Multi-Spill Polygons)
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
            0.60,
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
            2.8,
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

  // Update Dynamic Map Layers & Persistent Trajectories
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

    // 5. Update Background Trajectories for all vessels
    const allTrajSrc = map.getSource('all-trajectories') as maplibregl.GeoJSONSource;
    if (allTrajSrc && showTrails) {
      const bgFeatures = MUMBAI_VESSEL_WAYPOINTS.map((vw) => ({
        type: 'Feature' as const,
        properties: { mmsi: vw.mmsi, name: vw.name },
        geometry: {
          type: 'LineString' as const,
          coordinates: vw.waypoints.map((w) => [w.lon, w.lat]),
        },
      }));
      allTrajSrc.setData({ type: 'FeatureCollection', features: bgFeatures });
    } else if (allTrajSrc) {
      allTrajSrc.setData({ type: 'FeatureCollection', features: [] });
    }

    // 6. Update Active Inspected Culprit Trajectory Track (Persisted Always)
    const trajSrc = map.getSource('culprit-trajectory') as maplibregl.GeoJSONSource;
    if (trajSrc && showTrails) {
      // Find track points from suspect data or waypoints
      const activeWaypointTrack = MUMBAI_VESSEL_WAYPOINTS.find((w) => w.mmsi === activeSuspect?.mmsi);
      let lineCoords: number[][] = [];

      if (activeSuspect?.trajectory && activeSuspect.trajectory.length > 1) {
        lineCoords = activeSuspect.trajectory.map((t) => [t[0], t[1]]);
      } else if (activeWaypointTrack) {
        lineCoords = activeWaypointTrack.waypoints.map((w) => [w.lon, w.lat]);
      }

      if (lineCoords.length > 1) {
        trajSrc.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: activeSuspect?.name || 'Inspected Vessel' },
              geometry: { type: 'LineString', coordinates: lineCoords },
            },
          ],
        });
      } else {
        trajSrc.setData({ type: 'FeatureCollection', features: [] });
      }
    } else if (trajSrc) {
      trajSrc.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [mapLoaded, currentSpills, hindcastFeatures, forecastFeatures, dumpOriginFeature, activeSuspect, showTrails]);

  // Smooth camera fly-to when selected incident or vessel changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // Center on active vessel position or incident origin
    const targetLon = activeSuspect?.last_lon ?? baseOrigin[0];
    const targetLat = activeSuspect?.last_lat ?? baseOrigin[1];

    map.flyTo({
      center: [targetLon, targetLat],
      zoom: 10.4,
      duration: 1200,
      essential: true,
    });
  }, [selectedSpillId, selectedVesselMmsi, mapLoaded, baseOrigin, activeSuspect]);

  // Render & Update Vessel Markers with Active Focus Highlight
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
      const isSelected = activeSuspect?.mmsi === v.mmsi;
      const isIncidentCulprit = currentIncident.culpritMmsi === v.mmsi;
      const isCoastGuard = v.mmsi === 419000999;
      const fullVessel = vessels.find((item) => item.mmsi === v.mmsi);
      const name = fullVessel?.name || `MMSI ${v.mmsi}`;
      const markerKey = `vessel-${v.mmsi}`;

      let marker = markersRef.current[markerKey];

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'vessel-marker group cursor-pointer relative';
        el.style.width = '42px';
        el.style.height = '42px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';

        // Outer focus pulse ring for selected vessel
        const ring = document.createElement('div');
        ring.className = 'marker-ring absolute inset-0 rounded-full transition-all';
        el.appendChild(ring);

        // Vessel SVG Ship icon
        const svgContainer = document.createElement('div');
        svgContainer.className = 'marker-icon-container relative z-10 flex items-center justify-center';
        svgContainer.style.width = '26px';
        svgContainer.style.height = '26px';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.style.transition = 'transform 0.15s ease';

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z');
        path.setAttribute('stroke', '#020617');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('class', 'marker-arrow-path');

        svg.appendChild(path);
        svgContainer.appendChild(svg);
        el.appendChild(svgContainer);

        // Label tooltip above marker
        const label = document.createElement('div');
        label.className = 'marker-label absolute -top-6 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[9px] font-mono text-white whitespace-nowrap pointer-events-none transition-all shadow-md';
        label.innerText = name.split(' ')[0] || name;
        el.appendChild(label);

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

      // Update styling based on selected / culprit status
      const el = marker.getElement();
      const ring = el.querySelector('.marker-ring') as HTMLElement;
      const path = el.querySelector('.marker-arrow-path') as SVGPathElement;
      const label = el.querySelector('.marker-label') as HTMLElement;

      if (ring && path && label) {
        if (isSelected) {
          ring.className = 'marker-ring absolute inset-0 rounded-full border-2 border-cyan-400 bg-cyan-400/20 animate-ping';
          path.setAttribute('fill', '#f43f5e');
          path.setAttribute('stroke', '#38bdf8');
          path.setAttribute('stroke-width', '2');
          label.className = 'marker-label absolute -top-6 px-2 py-0.5 rounded bg-rose-950 border border-rose-500 text-[10px] font-mono font-bold text-rose-200 whitespace-nowrap shadow-lg z-30';
          label.innerText = `🎯 ${name} (${v.speed ? v.speed.toFixed(1) : '14.8'} kts)`;
        } else if (isIncidentCulprit) {
          ring.className = 'marker-ring absolute inset-1 rounded-full border border-rose-500/50 bg-rose-500/10';
          path.setAttribute('fill', '#f43f5e');
          path.setAttribute('stroke', '#020617');
          path.setAttribute('stroke-width', '1.5');
          label.className = 'marker-label absolute -top-6 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[9px] font-mono text-slate-300 whitespace-nowrap';
          label.innerText = name.split(' ')[0];
        } else if (isCoastGuard) {
          ring.className = 'marker-ring absolute inset-1 rounded-full border border-cyan-500/30';
          path.setAttribute('fill', '#06b6d4');
          path.setAttribute('stroke', '#020617');
          path.setAttribute('stroke-width', '1.5');
          label.className = 'marker-label absolute -top-6 px-1.5 py-0.5 rounded bg-slate-950/80 border border-cyan-800 text-[9px] font-mono text-cyan-300 whitespace-nowrap';
          label.innerText = 'ICGS PRAHARI';
        } else {
          ring.className = 'marker-ring hidden';
          path.setAttribute('fill', '#94a3b8');
          path.setAttribute('stroke', '#020617');
          path.setAttribute('stroke-width', '1.5');
          label.className = 'marker-label absolute -top-6 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[9px] font-mono text-slate-400 whitespace-nowrap';
          label.innerText = name.split(' ')[0];
        }
      }

      marker.setRotation(v.heading);
    });

    // Cleanup markers no longer active
    const activeKeys = new Set(displayVessels.map((v) => `vessel-${v.mmsi}`));
    Object.keys(markersRef.current).forEach((key) => {
      if (!activeKeys.has(key)) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });
  }, [mapLoaded, vessels, scrubbedVessels, activeSuspect, currentIncident]);

  return (
    <div className="relative w-full h-full bg-[#0b0f19] overflow-hidden">
      {/* MapLibre WebGL Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Mobile Floating Tactical HUD Banner (Top of Map on Mobile) */}
      <div
        onClick={onOpenMobileDrawer}
        className="lg:hidden absolute top-2.5 left-2.5 right-2.5 z-20 p-2.5 bg-[#111622]/95 border border-cyan-500/40 rounded-xl backdrop-blur-md font-mono shadow-2xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ring-1 ring-cyan-500/20 select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold text-xs truncate">{currentIncident.name}</span>
              <span className="text-[8.5px] bg-rose-950 text-rose-300 font-bold px-1.5 py-0.2 rounded border border-rose-600/40 shrink-0">
                {currentIncident.threat.overall_severity_score}/100
              </span>
            </div>
            <div className="text-[9.5px] text-slate-300 flex items-center gap-1.5 truncate mt-0.5">
              <span>Area: <strong className="text-rose-300">{currentIncident.baseAreaSqKm} km²</strong></span>
              <span>•</span>
              <span>Coast: <strong className="text-white">{currentIncident.threat.coast_distance_km} km</strong></span>
              <span>•</span>
              <span>ETA: <strong className="text-amber-300">{currentIncident.threat.predicted_arrival_hours}h</strong></span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[9.5px] text-cyan-300 font-bold bg-cyan-950/60 px-2 py-1 rounded-lg border border-cyan-500/40 shrink-0 ml-2">
          <span>Inspector</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Layer Toggles & Map Controls Overlay */}
      <div className="absolute top-16 sm:top-4 left-3 sm:left-4 flex flex-col gap-2 z-10 font-mono text-xs select-none">
        <div className="bg-[#111622]/90 border border-slate-800 rounded-lg p-1.5 sm:p-2 flex flex-col gap-1 sm:gap-1.5 backdrop-blur-md shadow-lg">
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
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>AIS Kinematic Tracks</span>
          </button>
        </div>
      </div>

      {/* Map Zoom & Center Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-10 select-none">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 rounded-lg bg-[#111622]/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center shadow-lg transition-colors"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 rounded-lg bg-[#111622]/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center shadow-lg transition-colors"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            const targetLon = activeSuspect?.last_lon ?? baseOrigin[0];
            const targetLat = activeSuspect?.last_lat ?? baseOrigin[1];
            mapRef.current?.flyTo({ center: [targetLon, targetLat], zoom: 10.4, duration: 1000 });
          }}
          className="w-8 h-8 rounded-lg bg-[#111622]/90 border border-slate-800 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 flex items-center justify-center shadow-lg transition-colors"
          title="Recenter on Active Target"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Active Incident Legend Indicator (Bottom-Right) */}
      <div className="absolute bottom-20 right-4 z-10 hidden sm:flex flex-col gap-1.5 p-3 bg-[#111622]/95 border border-slate-800 rounded-xl backdrop-blur-md font-mono text-[10px] text-slate-300 shadow-2xl max-w-xs ring-1 ring-slate-800/80">
        <div className="flex items-center justify-between font-bold text-white border-b border-slate-800 pb-1">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Compass className="w-3.5 h-3.5" />
            MUMBAI TACTICAL RADAR
          </span>
          <span className="text-rose-400 font-bold">{timeOffsetMinutes === 0 ? 'LIVE' : `T${timeOffsetMinutes}m`}</span>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-400">Target Vessel:</span>
          <strong className="text-white">{activeSuspect?.name || 'Inspecting...'}</strong>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-400">Breach Origin:</span>
          <strong className="text-amber-300">{currentIncident.name}</strong>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-400">Coast Distance:</span>
          <strong className="text-rose-300">{currentIncident.threat.coast_distance_km} km</strong>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-400">Landfall Arrival:</span>
          <strong className="text-amber-400">{currentIncident.threat.predicted_arrival_hours} hrs</strong>
        </div>
        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-800/80">
          <span className="text-slate-400">Threat Severity:</span>
          <span className="flex items-center gap-1 text-rose-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            {currentIncident.threat.overall_severity_score}/100 ({currentIncident.threat.overall_severity_level})
          </span>
        </div>
      </div>
    </div>
  );
};
