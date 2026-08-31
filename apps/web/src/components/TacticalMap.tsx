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
  Satellite,
  Anchor,
  Home,
  Droplet
} from 'lucide-react';
import { SpillFeatureCollection, Vessel, SuspectVessel, MetoceanData, SpillGeoFeature, MaritimeSpatialAsset } from '../types';
import {
  calculateSynchronizedOilSpill,
  moveCoordinate,
  generateForecastCone,
  interpolateVesselPosition,
  MUMBAI_INCIDENTS,
  MUMBAI_VESSEL_WAYPOINTS,
  MARITIME_SPATIAL_ASSETS
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

// 🟢 1. Fishing Zones GeoJSON
const FISHING_ZONES_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: MARITIME_SPATIAL_ASSETS.filter((a) => a.category === 'fishing_zone').map((a) => ({
    type: 'Feature' as const,
    properties: {
      id: a.id,
      name: a.name,
      category: a.category,
      category_label: '🟢 Fishing Zone',
      subcategory: a.subcategory,
      risk_level: a.risk_level,
      description: a.description,
      fleet_count: a.fleet_count || 0,
      economic_annual_cr: a.economic_annual_cr || 0,
      advisory_status: a.advisory_status,
      distance_km: a.distance_to_spill_km || 0,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: a.coordinates as number[][][],
    },
  })),
};

// 🔵 2. Fishing Harbours GeoJSON
const FISHING_HARBOURS_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: MARITIME_SPATIAL_ASSETS.filter((a) => a.category === 'fishing_harbour').map((a) => ({
    type: 'Feature' as const,
    properties: {
      id: a.id,
      name: a.name,
      category: a.category,
      category_label: '🔵 Fishing Harbour',
      subcategory: a.subcategory,
      risk_level: a.risk_level,
      description: a.description,
      fleet_count: a.fleet_count || 0,
      economic_annual_cr: a.economic_annual_cr || 0,
      advisory_status: a.advisory_status,
      distance_km: a.distance_to_spill_km || 0,
    },
    geometry: {
      type: 'Point' as const,
      coordinates: a.coordinates as [number, number],
    },
  })),
};

// 🟣 3. Aquaculture GeoJSON
const AQUACULTURE_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: MARITIME_SPATIAL_ASSETS.filter((a) => a.category === 'aquaculture').map((a) => ({
    type: 'Feature' as const,
    properties: {
      id: a.id,
      name: a.name,
      category: a.category,
      category_label: '🟣 Aquaculture',
      subcategory: a.subcategory,
      risk_level: a.risk_level,
      description: a.description,
      economic_annual_cr: a.economic_annual_cr || 0,
      advisory_status: a.advisory_status,
      distance_km: a.distance_to_spill_km || 0,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: a.coordinates as number[][][],
    },
  })),
};

// 🟠 4. Coastal Communities GeoJSON
const COASTAL_COMMUNITIES_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: MARITIME_SPATIAL_ASSETS.filter((a) => a.category === 'coastal_community').map((a) => ({
    type: 'Feature' as const,
    properties: {
      id: a.id,
      name: a.name,
      category: a.category,
      category_label: '🟠 Coastal Community',
      subcategory: a.subcategory,
      risk_level: a.risk_level,
      description: a.description,
      population: a.population || 0,
      advisory_status: a.advisory_status,
      distance_km: a.distance_to_spill_km || 0,
    },
    geometry: {
      type: 'Point' as const,
      coordinates: a.coordinates as [number, number],
    },
  })),
};

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
  
  // Tactical Operational Mode State (Top Tabs)
  const [operationalMode, setOperationalMode] = useState<MapOperationalMode>('surveillance');
  const [showLayerDrawer, setShowLayerDrawer] = useState(false);

  // 5 Color-Coded Maritime Asset Categories Layer Toggles
  const [showFishingZones, setShowFishingZones] = useState<boolean>(true);
  const [showFishingHarbours, setShowFishingHarbours] = useState<boolean>(true);
  const [showAquaculture, setShowAquaculture] = useState<boolean>(true);
  const [showCoastalCommunities, setShowCoastalCommunities] = useState<boolean>(true);
  const [showOilSpills, setShowOilSpills] = useState<boolean>(true);

  // Manual Drift & Trail Overrides
  const [showTrails, setShowTrails] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showHindcast, setShowHindcast] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

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
          acquisition_timestamp_ist: config.acquisition_timestamp_ist,
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

    const breachEvent = currentIncident.events.find((e) => e.type === 'breach') || currentIncident.events[2];
    const breachTimestamp = breachEvent?.timestamp_ist || "15:48 IST";

    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {
            title: `Reconstructed Discharge Origin (${breachTimestamp})`,
            timestamp_ist: breachTimestamp,
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

      // 🟢 1. Fishing Zones Source & Layers
      map.addSource('fishing-zones-source', {
        type: 'geojson',
        data: FISHING_ZONES_GEOJSON,
      });

      map.addLayer({
        id: 'fishing-zones-fill',
        type: 'fill',
        source: 'fishing-zones-source',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.14,
        },
      });

      map.addLayer({
        id: 'fishing-zones-line',
        type: 'line',
        source: 'fishing-zones-source',
        paint: {
          'line-color': '#10b981',
          'line-width': 1.8,
          'line-dasharray': [4, 2],
          'line-opacity': 0.8,
        },
      });

      // 🔵 2. Fishing Harbours Source & Layers
      map.addSource('fishing-harbours-source', {
        type: 'geojson',
        data: FISHING_HARBOURS_GEOJSON,
      });

      map.addLayer({
        id: 'fishing-harbours-glow',
        type: 'circle',
        source: 'fishing-harbours-source',
        paint: {
          'circle-radius': 12,
          'circle-color': '#3b82f6',
          'circle-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'fishing-harbours-circle',
        type: 'circle',
        source: 'fishing-harbours-source',
        paint: {
          'circle-radius': 6,
          'circle-color': '#3b82f6',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.8,
        },
      });

      // 🟣 3. Aquaculture Source & Layers
      map.addSource('aquaculture-source', {
        type: 'geojson',
        data: AQUACULTURE_GEOJSON,
      });

      map.addLayer({
        id: 'aquaculture-fill',
        type: 'fill',
        source: 'aquaculture-source',
        paint: {
          'fill-color': '#a855f7',
          'fill-opacity': 0.16,
        },
      });

      map.addLayer({
        id: 'aquaculture-line',
        type: 'line',
        source: 'aquaculture-source',
        paint: {
          'line-color': '#c084fc',
          'line-width': 1.8,
          'line-dasharray': [3, 2],
          'line-opacity': 0.75,
        },
      });

      // 🟠 4. Coastal Communities Source & Layers
      map.addSource('coastal-communities-source', {
        type: 'geojson',
        data: COASTAL_COMMUNITIES_GEOJSON,
      });

      map.addLayer({
        id: 'coastal-communities-glow',
        type: 'circle',
        source: 'coastal-communities-source',
        paint: {
          'circle-radius': 10,
          'circle-color': '#f97316',
          'circle-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'coastal-communities-circle',
        type: 'circle',
        source: 'coastal-communities-source',
        paint: {
          'circle-radius': 5,
          'circle-color': '#fb923c',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });

      // Interactive Click Popups on Spatial Assets
      const assetPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '280px' });

      const attachAssetPopup = (layerId: string) => {
        map.on('click', layerId, (e) => {
          if (e.features && e.features[0]) {
            const props = e.features[0].properties as any;
            const badge = props.category_label || props.category;
            const html = `
              <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 6px 8px; color: #f1f5f9; background: #070b14; border: 1px solid #334155; border-radius: 8px; font-size: 11px;">
                <div style="font-weight: 800; font-size: 12px; margin-bottom: 3px; color: #ffffff;">${props.name}</div>
                <div style="margin-bottom: 4px; font-size: 10px; font-weight: 700;">${badge}</div>
                <div style="color: #94a3b8; margin-bottom: 6px; font-size: 10px; line-height: 1.3;">${props.description || ''}</div>
                <div style="display: flex; justify-content: space-between; border-top: 1px solid #1e293b; padding-top: 4px; font-size: 10px;">
                  <span style="color: #64748b;">Distance to Slick:</span>
                  <strong style="color: #38bdf8;">${props.distance_km ? props.distance_km + ' km' : 'Proximity Zone'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 2px;">
                  <span style="color: #64748b;">Protection Advisory:</span>
                  <strong style="color: #f43f5e;">${props.advisory_status || 'MONITORING'}</strong>
                </div>
              </div>
            `;
            assetPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
          }
        });

        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      };

      attachAssetPopup('fishing-zones-fill');
      attachAssetPopup('fishing-harbours-circle');
      attachAssetPopup('aquaculture-fill');
      attachAssetPopup('coastal-communities-circle');

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

    // 5. Update 5-Category Layer Visibility
    const setVisibility = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    };

    setVisibility('fishing-zones-fill', showFishingZones);
    setVisibility('fishing-zones-line', showFishingZones);
    setVisibility('fishing-harbours-glow', showFishingHarbours);
    setVisibility('fishing-harbours-circle', showFishingHarbours);
    setVisibility('aquaculture-fill', showAquaculture);
    setVisibility('aquaculture-line', showAquaculture);
    setVisibility('coastal-communities-glow', showCoastalCommunities);
    setVisibility('coastal-communities-circle', showCoastalCommunities);
    setVisibility('spills-glow', showOilSpills);
    setVisibility('spills-fill', showOilSpills);
    setVisibility('spills-line', showOilSpills);

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
    showFishingZones,
    showFishingHarbours,
    showAquaculture,
    showCoastalCommunities,
    showOilSpills,
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
      {/* 5-CATEGORY TACTICAL LAYER SELECTOR & LEGEND (TOP LEFT) */}
      {/* ============================================================== */}
      <div className="absolute top-16 left-3 sm:left-4 z-20 flex flex-col font-mono text-xs select-none max-w-xs">
        <button
          onClick={() => setShowLayerDrawer(!showLayerDrawer)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0b0f19]/90 border border-slate-700/80 text-slate-200 hover:text-white hover:bg-slate-800/90 shadow-xl backdrop-blur-md transition-all active:scale-95"
          title="Toggle 5-category maritime layers and tactical feeds"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold">Tactical Layers & Legend</span>
          {showLayerDrawer ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
        </button>

        {showLayerDrawer && (
          <div className="mt-2 bg-[#070b14]/95 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-2 w-64 ring-1 ring-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-wider">
                Coastal & Threat Layers
              </span>
              <span className="text-[9px] text-slate-500 font-mono">5 ACTIVE CLASSES</span>
            </div>

            {/* 5 Core Categories */}
            <div className="space-y-1">
              <button
                onClick={() => setShowFishingZones(!showFishingZones)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all text-xs font-semibold ${
                  showFishingZones
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900/50 text-slate-500 border border-slate-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                  <span>🟢 Fishing zones</span>
                </div>
                <span className="text-[10px] font-mono">{showFishingZones ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setShowFishingHarbours(!showFishingHarbours)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all text-xs font-semibold ${
                  showFishingHarbours
                    ? 'bg-blue-950/40 text-blue-300 border border-blue-500/40 shadow-sm'
                    : 'bg-slate-900/50 text-slate-500 border border-slate-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                  <span>🔵 Fishing harbours</span>
                </div>
                <span className="text-[10px] font-mono">{showFishingHarbours ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setShowAquaculture(!showAquaculture)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all text-xs font-semibold ${
                  showAquaculture
                    ? 'bg-purple-950/40 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'bg-slate-900/50 text-slate-500 border border-slate-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 shadow-sm shadow-purple-500/50" />
                  <span>🟣 Aquaculture</span>
                </div>
                <span className="text-[10px] font-mono">{showAquaculture ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setShowCoastalCommunities(!showCoastalCommunities)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all text-xs font-semibold ${
                  showCoastalCommunities
                    ? 'bg-orange-950/40 text-orange-300 border border-orange-500/40 shadow-sm'
                    : 'bg-slate-900/50 text-slate-500 border border-slate-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
                  <span>🟠 Coastal communities</span>
                </div>
                <span className="text-[10px] font-mono">{showCoastalCommunities ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setShowOilSpills(!showOilSpills)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all text-xs font-semibold ${
                  showOilSpills
                    ? 'bg-red-950/40 text-red-300 border border-red-500/40 shadow-sm'
                    : 'bg-slate-900/50 text-slate-500 border border-slate-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500 shadow-sm shadow-red-500/50 animate-pulse" />
                  <span>🔴 Oil spill</span>
                </div>
                <span className="text-[10px] font-mono">{showOilSpills ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Tactical Overlays */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1">
                Kinematic Vectors
              </span>
              <button
                onClick={() => setShowHindcast(!showHindcast)}
                className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition-all text-[11px] ${
                  showHindcast ? 'text-amber-300 font-semibold' : 'text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <History className="w-3 h-3 text-amber-400" />
                  <span>-6h Hindcast Cone</span>
                </div>
                <span className="text-[9px] font-mono">{showHindcast ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={() => setShowForecast(!showForecast)}
                className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition-all text-[11px] ${
                  showForecast ? 'text-cyan-300 font-semibold' : 'text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3 h-3 text-cyan-400" />
                  <span>+6h Drift Fan</span>
                </div>
                <span className="text-[9px] font-mono">{showForecast ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={() => setShowTrails(!showTrails)}
                className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition-all text-[11px] ${
                  showTrails ? 'text-rose-300 font-semibold' : 'text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3 h-3 text-rose-400" />
                  <span>AIS Vessel Tracks</span>
                </div>
                <span className="text-[9px] font-mono">{showTrails ? 'ON' : 'OFF'}</span>
              </button>
            </div>
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

      {/* ============================================================== */}
      {/* 5-CATEGORY QUICK LEGEND CHIPS (BOTTOM LEFT ABOVE SCRUBBER) */}
      {/* ============================================================== */}
      <div className="absolute bottom-20 left-3 sm:left-4 z-20 hidden md:flex items-center gap-1 p-1 rounded-xl bg-[#070b14]/90 border border-slate-800/80 shadow-2xl backdrop-blur-md font-mono text-[10px]">
        <button
          onClick={() => setShowFishingZones(!showFishingZones)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
            showFishingZones ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle 🟢 Fishing zones"
        >
          <span className="w-2 h-2 rounded-sm bg-emerald-500 shadow-sm" />
          <span>🟢 Fishing zones</span>
        </button>

        <button
          onClick={() => setShowFishingHarbours(!showFishingHarbours)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
            showFishingHarbours ? 'bg-blue-950/80 text-blue-300 border border-blue-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle 🔵 Fishing harbours"
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" />
          <span>🔵 Fishing harbours</span>
        </button>

        <button
          onClick={() => setShowAquaculture(!showAquaculture)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
            showAquaculture ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle 🟣 Aquaculture"
        >
          <span className="w-2 h-2 rounded-sm bg-purple-500 shadow-sm" />
          <span>🟣 Aquaculture</span>
        </button>

        <button
          onClick={() => setShowCoastalCommunities(!showCoastalCommunities)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
            showCoastalCommunities ? 'bg-orange-950/80 text-orange-300 border border-orange-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle 🟠 Coastal communities"
        >
          <span className="w-2 h-2 rounded-full bg-orange-500 shadow-sm" />
          <span>🟠 Coastal communities</span>
        </button>

        <button
          onClick={() => setShowOilSpills(!showOilSpills)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
            showOilSpills ? 'bg-red-950/80 text-red-300 border border-red-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle 🔴 Oil spill"
        >
          <span className="w-2 h-2 rounded-sm bg-red-500 shadow-sm animate-pulse" />
          <span>🔴 Oil spill</span>
        </button>
      </div>
    </div>
  );
};
