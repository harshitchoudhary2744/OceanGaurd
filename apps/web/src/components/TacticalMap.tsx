import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import {
  Plus,
  Minus,
  Crosshair,
  Eye,
  Navigation,
  Wind,
  Waves,
  Compass,
  Layers,
  History,
  ShieldAlert,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Ship,
  Sparkles,
  Fish,
  Satellite
} from 'lucide-react';
import { SpillFeatureCollection, Vessel, SuspectVessel, MetoceanData, SpillGeoFeature } from '../types';
import {
  calculateSynchronizedOilSpill,
  moveCoordinate,
  generateForecastCone,
  interpolateVesselPosition,
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

export type MapOperationalMode = 'surveillance' | 'hindcast' | 'forecast' | 'ecology' | 'sar';

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

// Marine Ecology Protected Habitats & Commercial Fishery GeoJSON
const MARINE_ECOLOGY_FEATURES = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {
        id: 'HAB-01',
        name: 'Thane Creek Flamingo Sanctuary & Mangrove Reserve',
        type: 'Mangrove / Wetland MPA',
        risk_level: 'HIGH',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [72.95, 19.00],
          [73.02, 19.00],
          [73.02, 19.14],
          [72.95, 19.14],
          [72.95, 19.00],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        id: 'HAB-02',
        name: 'Prongs Reef & South Mumbai Coastal Biotope',
        type: 'Intertidal Coral Reef',
        risk_level: 'CRITICAL',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [72.78, 18.88],
          [72.84, 18.88],
          [72.84, 18.94],
          [72.78, 18.94],
          [72.78, 18.88],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        id: 'FISH-01',
        name: 'Mumbai High Pelagic Commercial Fishing Fairway',
        type: 'Active Trawler Zone',
        risk_level: 'ELEVATED',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [72.00, 18.85],
          [72.30, 18.85],
          [72.30, 19.20],
          [72.00, 19.20],
          [72.00, 18.85],
        ]],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        id: 'FISH-02',
        name: 'JNPT Approach Inshore Artisanal Fishery',
        type: 'Gillnet & Purse Seine Fleet',
        risk_level: 'HIGH',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [72.75, 18.80],
          [72.92, 18.80],
          [72.92, 18.96],
          [72.75, 18.96],
          [72.75, 18.80],
        ]],
      },
    },
  ],
};

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
  
  // Tactical Operational Mode State (Top Tabs)
  const [operationalMode, setOperationalMode] = useState<MapOperationalMode>('surveillance');
  const [showLayerDrawer, setShowLayerDrawer] = useState(false);

  // Manual Layer Overrides
  const [showTrails, setShowTrails] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showHindcast, setShowHindcast] = useState(true);
  const [showEcology, setShowEcology] = useState(true);

  // Active Incident Config
  const currentIncident = MUMBAI_INCIDENTS[selectedSpillId] || MUMBAI_INCIDENTS["INC-MUM-2024-01"];
  const dischargeOffset = currentIncident.dischargeOffsetMinutes;
  const isPostDischarge = timeOffsetMinutes >= dischargeOffset;
  const baseOrigin = currentIncident.originCoords;

  // Active Inspected Suspect Vessel
  const activeSuspect = useMemo(() => {
    if (!suspects || suspects.length === 0) return null;
    return (
      suspects.find((s) => s.mmsi === selectedVesselMmsi) ||
      suspects.find((s) => s.mmsi === currentIncident.culpritMmsi) ||
      suspects[0]
    );
  }, [suspects, selectedVesselMmsi, currentIncident]);

  // Synchronized Hydrodynamic Oil Spill Polygons
  const currentSpills = useMemo<SpillFeatureCollection>(() => {
    const features: SpillGeoFeature[] = Object.values(MUMBAI_INCIDENTS).map((config) => {
      const offsetToUse = config.id === selectedSpillId ? timeOffsetMinutes : 0;
      const live = calculateSynchronizedOilSpill(offsetToUse, config.id, metocean);

      return {
        type: "Feature",
        id: config.id,
        properties: {
          id: config.id,
          detection_timestamp: new Date().toISOString(),
          acquisition_timestamp_utc: config.acquisition_timestamp_utc,
          area_sq_km: live.area,
          perimeter_km: live.perimeter,
          confidence_score: config.confidence,
          segmentation_dice_score: config.segmentation_dice_score,
          oil_likelihood_score: config.oil_likelihood_score,
          source_scene: config.sourceScene,
          status: "ACTIVE",
          center: live.center,
          centroid: config.centroid,
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

  // Hydrodynamic Hindcast Back-Tracing
  const hindcastFeatures = useMemo(() => {
    const shouldShow = showHindcast && (operationalMode === 'hindcast' || operationalMode === 'surveillance');
    if (!shouldShow || !isPostDischarge) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    const hindcastCone = generateConeBetweenPoints(
      slickCentroid[0],
      slickCentroid[1],
      baseOrigin[0],
      baseOrigin[1],
      0.35,
      0.90
    );

    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { type: "hindcast_cone", title: "Reverse Drift Advection (-6h)" },
          geometry: { type: "Polygon" as const, coordinates: [hindcastCone] },
        },
        {
          type: "Feature" as const,
          properties: { type: "hindcast_vector", title: "Back-Track Drift Vector" },
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [slickCentroid[0], slickCentroid[1]],
              [baseOrigin[0], baseOrigin[1]],
            ],
          },
        },
      ],
    };
  }, [showHindcast, operationalMode, isPostDischarge, slickCentroid, baseOrigin]);

  // Hydrodynamic +6h Drift Forecast Fan
  const forecastFeatures = useMemo(() => {
    const shouldShow = showForecast && (operationalMode === 'forecast' || operationalMode === 'surveillance');
    if (!shouldShow || !isPostDischarge) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    const driftBearing = metocean ? (metocean.current_direction_deg || 65) : 65;
    const driftSpeed = metocean ? (metocean.current_speed_kts || 1.1) : 1.1;
    const cone = generateForecastCone(slickCentroid[0], slickCentroid[1], driftBearing, driftSpeed, 6);

    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { type: "forecast_fan", title: "+6h Fay Hydrodynamic Dispersion Fan" },
          geometry: { type: "Polygon" as const, coordinates: [cone] },
        },
      ],
    };
  }, [showForecast, operationalMode, isPostDischarge, slickCentroid, metocean]);

  // Dump Origin GPS Point Marker
  const dumpOriginFeature = useMemo(() => {
    const shouldShow = isPostDischarge && (operationalMode === 'hindcast' || operationalMode === 'surveillance');
    if (!shouldShow) {
      return { type: "FeatureCollection" as const, features: [] };
    }
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {
            title: `Reconstructed Discharge Origin (10:18 UTC)`,
            timestamp_utc: "10:18 UTC",
            incident_id: currentIncident.id,
          },
          geometry: { type: "Point" as const, coordinates: baseOrigin },
        },
      ],
    };
  }, [isPostDischarge, operationalMode, currentIncident, baseOrigin]);

  // Initialize MapLibre Engine
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'dark-ocean-base': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri, DeLorme, GEBCO, NOAA NGDC',
            maxzoom: 16,
          },
          'dark-ocean-labels': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 16,
          },
        },
        layers: [
          {
            id: 'dark-ocean-base-layer',
            type: 'raster',
            source: 'dark-ocean-base',
            minzoom: 0,
            maxzoom: 20,
          },
          {
            id: 'dark-ocean-labels-layer',
            type: 'raster',
            source: 'dark-ocean-labels',
            minzoom: 0,
            maxzoom: 20,
            paint: {
              'raster-opacity': 0.7,
            },
          },
        ],
      },
      center: centerCoordinates || baseOrigin,
      zoom: 10.4,
      pitch: 32,
      bearing: -12,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      setMapLoaded(true);

      // 1. Marine Ecology & Fishery Habitats Source & Layers
      map.addSource('ecology-source', {
        type: 'geojson',
        data: MARINE_ECOLOGY_FEATURES,
      });

      map.addLayer({
        id: 'ecology-fill',
        type: 'fill',
        source: 'ecology-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'risk_level'],
            'CRITICAL', '#10b981',
            'HIGH', '#059669',
            '#047857'
          ],
          'fill-opacity': 0.12,
        },
      });

      map.addLayer({
        id: 'ecology-line',
        type: 'line',
        source: 'ecology-source',
        paint: {
          'line-color': '#10b981',
          'line-width': 1.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.6,
        },
      });

      // 2. Forecast Source & Layers (Cyan Fan)
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
          'fill-opacity': 0.14,
        },
      });

      map.addLayer({
        id: 'forecast-line',
        type: 'line',
        source: 'forecast-source',
        paint: {
          'line-color': '#22d3ee',
          'line-width': 1.8,
          'line-dasharray': [3, 3],
        },
      });

      // 3. Hindcast Source & Layers (Amber Reverse Cone & Vector)
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
          'fill-opacity': 0.16,
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

      // 4. Dump Origin Point Layers
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

      // 5. Secondary Background Trajectories
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
          'line-opacity': 0.40,
        },
      });

      // 6. Active Culprit Trajectory Layers
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

      // 7. Oil Spill Layers (Multi-Spill Polygons)
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
          'line-width': 7,
          'line-opacity': 0.40,
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
            0.65,
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
            3.0,
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

    // 5. Update Ecology Layer Visibility
    const ecologyFill = map.getLayer('ecology-fill');
    const isEcologyMode = operationalMode === 'ecology';
    if (ecologyFill) {
      map.setLayoutProperty('ecology-fill', 'visibility', (showEcology && isEcologyMode) ? 'visible' : 'none');
      map.setLayoutProperty('ecology-line', 'visibility', (showEcology && isEcologyMode) ? 'visible' : 'none');
    }

    // 6. Update Background Trajectories for all vessels
    const allTrajSrc = map.getSource('all-trajectories') as maplibregl.GeoJSONSource;
    const shouldShowTrails = showTrails && (operationalMode === 'hindcast' || operationalMode === 'surveillance');
    if (allTrajSrc && shouldShowTrails) {
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

    // 7. Update Active Inspected Culprit Trajectory Track
    const trajSrc = map.getSource('culprit-trajectory') as maplibregl.GeoJSONSource;
    if (trajSrc && shouldShowTrails) {
      const activeWaypointTrack = MUMBAI_VESSEL_WAYPOINTS.find((w) => w.mmsi === activeSuspect?.mmsi);
      let lineCoords: number[][] = [];

      if (activeWaypointTrack && activeWaypointTrack.waypoints.length > 1) {
        lineCoords = activeWaypointTrack.waypoints.map((w) => [w.lon, w.lat]);
      } else if (activeSuspect?.trajectory && activeSuspect.trajectory.length > 1) {
        lineCoords = activeSuspect.trajectory.map((t) => [t[0], t[1]]);
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
  }, [
    mapLoaded,
    currentSpills,
    hindcastFeatures,
    forecastFeatures,
    dumpOriginFeature,
    activeSuspect,
    showTrails,
    showEcology,
    operationalMode
  ]);

  // Smooth camera fly-to when selected incident or vessel changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const activeWaypointTrack = MUMBAI_VESSEL_WAYPOINTS.find((w) => w.mmsi === activeSuspect?.mmsi);
    const lastWp = activeWaypointTrack?.waypoints[activeWaypointTrack.waypoints.length - 1];
    const targetLon = lastWp?.lon ?? activeSuspect?.last_lon ?? baseOrigin[0];
    const targetLat = lastWp?.lat ?? activeSuspect?.last_lat ?? baseOrigin[1];

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

    const displayVessels = scrubbedVessels || vessels.map((v) => {
      const interp = interpolateVesselPosition(v.mmsi, 0, 'mumbai', v.current_position ? {
        longitude: v.current_position.longitude,
        latitude: v.current_position.latitude,
        heading_degrees: v.current_position.heading_degrees,
        speed_knots: v.current_position.speed_knots,
      } : undefined);
      return {
        mmsi: v.mmsi,
        lon: interp.lon,
        lat: interp.lat,
        heading: interp.heading,
        speed: interp.speed,
      };
    });

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
        el.className = 'vessel-marker group cursor-pointer';
        el.style.width = '42px';
        el.style.height = '42px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';

        const ring = document.createElement('div');
        ring.className = 'marker-ring absolute inset-0 rounded-full transition-all pointer-events-none';
        el.appendChild(ring);

        const svgContainer = document.createElement('div');
        svgContainer.className = 'marker-icon-container relative z-10 flex items-center justify-center pointer-events-none';
        svgContainer.style.width = '26px';
        svgContainer.style.height = '26px';
        svgContainer.style.transformOrigin = 'center center';
        svgContainer.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        svgContainer.style.transform = `rotate(${v.heading}deg)`;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z');
        path.setAttribute('stroke', '#020617');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('class', 'marker-arrow-path');

        svg.appendChild(path);
        svgContainer.appendChild(svg);
        el.appendChild(svgContainer);

        const label = document.createElement('div');
        label.className = 'marker-label absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[9px] font-mono text-white whitespace-nowrap pointer-events-none transition-all shadow-md z-30 flex items-center gap-1';
        label.innerText = name.split(' ')[0] || name;
        el.appendChild(label);

        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onSelectVesselRef.current(v.mmsi);
        });

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([v.lon, v.lat])
          .addTo(map);

        markersRef.current[markerKey] = marker;
      } else {
        marker.setLngLat([v.lon, v.lat]);
      }

      const el = marker.getElement();
      const ring = el.querySelector('.marker-ring') as HTMLElement;
      const svgContainer = el.querySelector('.marker-icon-container') as HTMLElement;
      const path = el.querySelector('.marker-arrow-path') as SVGPathElement;
      const label = el.querySelector('.marker-label') as HTMLElement;

      if (svgContainer) {
        svgContainer.style.transform = `rotate(${v.heading}deg)`;
      }

      if (ring && path && label) {
        if (isSelected) {
          ring.className = 'marker-ring absolute inset-0 rounded-full border-2 border-rose-500 bg-rose-500/20 animate-ping pointer-events-none';
          path.setAttribute('fill', '#f43f5e');
          path.setAttribute('stroke', '#ffffff');
          path.setAttribute('stroke-width', '2');
          label.className = 'marker-label absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-md bg-slate-950/95 border-2 border-rose-500 text-[10px] font-mono font-bold text-rose-300 whitespace-nowrap shadow-2xl z-30 flex items-center gap-1.5 backdrop-blur-sm';
          label.innerText = `🎯 ${name} (${v.speed ? v.speed.toFixed(1) : '14.8'} kts)`;
        } else if (isCoastGuard) {
          ring.className = 'marker-ring absolute inset-1 rounded-full border border-cyan-500/40 pointer-events-none';
          path.setAttribute('fill', '#06b6d4');
          path.setAttribute('stroke', '#020617');
          path.setAttribute('stroke-width', '1.5');
          label.className = 'marker-label absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-950/90 border border-cyan-700/70 text-[9px] font-mono text-cyan-300 whitespace-nowrap pointer-events-none z-30 flex items-center gap-1';
          label.innerText = '🛡️ ICGS PRAHARI';
        } else {
          ring.className = 'marker-ring hidden';
          path.setAttribute('fill', '#64748b');
          path.setAttribute('stroke', '#0f172a');
          path.setAttribute('stroke-width', '1.5');
          label.className = 'marker-label absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[9px] font-mono text-slate-400 whitespace-nowrap pointer-events-none z-30';
          label.innerText = name.split(' ')[0];
        }
      }
    });

    const activeKeys = new Set(displayVessels.map((v) => `vessel-${v.mmsi}`));
    Object.keys(markersRef.current).forEach((key) => {
      if (!activeKeys.has(key)) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });
  }, [mapLoaded, vessels, scrubbedVessels, activeSuspect, currentIncident]);

  return (
    <div className="relative w-full h-full bg-[#0b0f19] overflow-hidden select-none">
      {/* MapLibre WebGL Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* ============================================================== */}
      {/* MAP OPERATIONAL MODE TABS (TOP CENTER) - REORGANIZED & CLEAN */}
      {/* ============================================================== */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center bg-[#111622]/95 border border-cyan-500/40 p-1 rounded-xl shadow-2xl backdrop-blur-md font-mono text-[10.5px] max-w-[95vw] overflow-x-auto no-scrollbar gap-1 ring-1 ring-cyan-500/20">
        <button
          onClick={() => setOperationalMode('surveillance')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            operationalMode === 'surveillance'
              ? 'bg-cyan-500 text-slate-950 shadow-md scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
          title="Default clean tactical view"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>Surveillance</span>
        </button>

        <button
          onClick={() => setOperationalMode('hindcast')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            operationalMode === 'hindcast'
              ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
          title="Reverse drift cone and AIS kinematics"
        >
          <History className="w-3.5 h-3.5" />
          <span>-6h Hindcast</span>
        </button>

        <button
          onClick={() => setOperationalMode('forecast')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            operationalMode === 'forecast'
              ? 'bg-cyan-400 text-slate-950 shadow-md scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
          title="+6h Fay forward drift dispersion"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>+6h Landfall</span>
        </button>

        <button
          onClick={() => setOperationalMode('ecology')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            operationalMode === 'ecology'
              ? 'bg-emerald-500 text-slate-950 shadow-md scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
          title="MPAs, Coral Reefs & Commercial Fishery sectors"
        >
          <Fish className="w-3.5 h-3.5" />
          <span>Ecology & Habitats</span>
        </button>

        <button
          onClick={() => setOperationalMode('sar')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            operationalMode === 'sar'
              ? 'bg-rose-500 text-white shadow-md scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
          title="Sentinel-1 SAR radar backscatter & 6-class breakdown"
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>SAR Radar</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* FLOATING COLLAPSIBLE LAYERS BUTTON & DRAWER (TOP LEFT) */}
      {/* ============================================================== */}
      <div className="absolute top-16 left-3 sm:left-4 z-20 flex flex-col font-mono text-xs select-none">
        <button
          onClick={() => setShowLayerDrawer(!showLayerDrawer)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111622]/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xl backdrop-blur-md transition-all active:scale-95"
          title="Toggle individual map layers"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold">Layers</span>
          {showLayerDrawer ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
        </button>

        {showLayerDrawer && (
          <div className="mt-2 bg-[#111622]/95 border border-slate-700 rounded-xl p-2.5 flex flex-col gap-1.5 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-top-2 w-52">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider px-1">
              Active Layer Overrides
            </span>
            <button
              onClick={() => setShowHindcast(!showHindcast)}
              className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all text-[11px] ${
                showHindcast ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                <span>-6h Hindcast Cone</span>
              </div>
              <span className="text-[9px]">{showHindcast ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={() => setShowForecast(!showForecast)}
              className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all text-[11px] ${
                showForecast ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" />
                <span>+6h Drift Fan</span>
              </div>
              <span className="text-[9px]">{showForecast ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={() => setShowTrails(!showTrails)}
              className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all text-[11px] ${
                showTrails ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>AIS Kinematics</span>
              </div>
              <span className="text-[9px]">{showTrails ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={() => setShowEcology(!showEcology)}
              className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all text-[11px] ${
                showEcology ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Fish className="w-3.5 h-3.5" />
                <span>Ecology & Fish</span>
              </div>
              <span className="text-[9px]">{showEcology ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MAP ZOOM & CENTER CONTROLS (TOP RIGHT) */}
      {/* ============================================================== */}
      <div className="absolute top-16 right-3 sm:right-4 flex flex-col gap-1.5 z-20 select-none">
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

      {/* ============================================================== */}
      {/* TOP-RIGHT DOCKED TELEMETRY CAPSULE (NON-OVERLAPPING) */}
      {/* ============================================================== */}
      <div className="absolute top-32 right-3 sm:right-4 z-10 hidden md:flex flex-col gap-1 p-2.5 bg-[#111622]/95 border border-slate-800 rounded-xl backdrop-blur-md font-mono text-[10px] text-slate-300 shadow-2xl max-w-[240px] ring-1 ring-slate-800/80">
        <div className="flex items-center justify-between font-bold text-white border-b border-slate-800 pb-1">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Compass className="w-3.5 h-3.5" />
            MUMBAI EEZ RADAR
          </span>
          <span className="text-rose-400 font-bold">{timeOffsetMinutes === 0 ? 'LIVE' : `T${timeOffsetMinutes}m`}</span>
        </div>
        <div className="flex justify-between items-center text-[10px] pt-0.5">
          <span className="text-slate-400">Incident:</span>
          <strong className="text-white truncate max-w-[130px]">{currentIncident.name}</strong>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-400">Centroid:</span>
          <strong className="text-cyan-300">{currentIncident.centroid[0].toFixed(3)}°N, {currentIncident.centroid[1].toFixed(3)}°E</strong>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-400">Culprit:</span>
          <strong className="text-rose-400">{activeSuspect?.name || 'Inspecting...'}</strong>
        </div>
        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-800/80">
          <span className="text-slate-400">Threat Level:</span>
          <span className="flex items-center gap-1 text-rose-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {currentIncident.threat.overall_severity_score}/100 ({currentIncident.threat.overall_severity_level})
          </span>
        </div>
      </div>
    </div>
  );
};
