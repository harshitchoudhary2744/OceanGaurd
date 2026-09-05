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
import { SpillFeatureCollection, Vessel, SuspectVessel, MetoceanData, SpillGeoFeature, MaritimeSpatialAsset, MapFocusTarget } from '../types';
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

// ============================================================================
// REALISTIC MARITIME SHIP SILHOUETTES & CULPRIT HIGHLIGHTING
// ============================================================================
function getShipMarkerHtml(
  type: 'culprit' | 'patrol' | 'commercial',
  isSelected: boolean,
  isAisDark: boolean,
  name: string,
  speed: number,
  heading: number
): string {
  const displayShortName = name.length > 15 ? name.split(' ').slice(0, 2).join(' ') : name;
  const speedStr = (speed || 0).toFixed(1);

  if (type === 'culprit') {
    const labelTitle = isAisDark
      ? '📡 AIS DARK • DISCHARGE'
      : isSelected
      ? '🎯 PRIMARY SUSPECT'
      : '🎯 CULPRIT VESSEL';

    const labelClass = isAisDark
      ? 'marker-label absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-amber-950/95 border-2 border-amber-400 text-[10px] font-mono font-bold text-amber-200 whitespace-nowrap shadow-[0_0_25px_rgba(245,158,11,0.9)] z-40 flex items-center gap-1.5 backdrop-blur-md animate-bounce'
      : isSelected
      ? 'marker-label absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-rose-950/95 border-2 border-rose-400 text-[10px] font-mono font-bold text-white whitespace-nowrap shadow-[0_0_25px_rgba(244,63,94,0.95)] z-40 flex items-center gap-1.5 backdrop-blur-md ring-2 ring-rose-500/50'
      : 'marker-label absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-rose-950/90 border-2 border-rose-500 text-[10px] font-mono font-bold text-rose-200 whitespace-nowrap shadow-[0_0_18px_rgba(244,63,94,0.85)] z-40 flex items-center gap-1.5 backdrop-blur-md';

    return `
      <!-- Double Radar Threat Rings -->
      <div class="marker-ring absolute -inset-3 rounded-full border-2 border-rose-500/70 bg-rose-500/15 animate-ping pointer-events-none"></div>
      <div class="absolute -inset-1 rounded-full border border-rose-400/60 bg-rose-950/30 animate-pulse pointer-events-none"></div>

      <!-- Tactical Reticle Brackets (Target Lock) -->
      <div class="marker-reticle absolute -inset-1.5 pointer-events-none flex flex-col justify-between p-0.5 z-20">
        <div class="flex justify-between">
          <div class="w-3 h-3 border-t-2 border-l-2 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,1)]"></div>
          <div class="w-3 h-3 border-t-2 border-r-2 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,1)]"></div>
        </div>
        <div class="flex justify-between">
          <div class="w-3 h-3 border-b-2 border-l-2 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,1)]"></div>
          <div class="w-3 h-3 border-b-2 border-r-2 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,1)]"></div>
        </div>
      </div>

      <!-- Rotated VLCC Supertanker Silhouette -->
      <div class="marker-icon-container relative z-10 flex items-center justify-center pointer-events-none" style="width: 36px; height: 72px; transform: rotate(${heading}deg); transform-origin: center center; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
        <svg viewBox="0 0 36 72" width="34" height="68" class="drop-shadow-[0_0_12px_rgba(244,63,94,0.95)]" xmlns="http://www.w3.org/2000/svg">
          <!-- Outer Hull -->
          <path d="M18 4 C13 4 8 12 8 22 L8 58 C8 65 12 68 18 68 C24 68 28 65 28 58 L28 22 C28 12 23 4 18 4 Z" fill="#e11d48" stroke="#ffffff" stroke-width="1.8" />
          <!-- Inner Deck -->
          <path d="M18 7 C14 7 10 14 10 23 L10 56 C10 61 13 64 18 64 C23 64 26 61 26 56 L26 23 C26 14 22 7 18 7 Z" fill="#9f1239" />
          <!-- Bulbous Bow Arc -->
          <path d="M14 7 Q18 4.5 22 7" stroke="#ffffff" stroke-width="1.4" fill="none" />
          <!-- Crude Oil Pipe Manifold Spine -->
          <line x1="18" y1="16" x2="18" y2="50" stroke="#fde047" stroke-width="2.2" stroke-linecap="round" />
          <!-- Lateral Manifold Headers -->
          <line x1="11" y1="24" x2="25" y2="24" stroke="#fde047" stroke-width="1.6" stroke-linecap="round" />
          <line x1="11" y1="33" x2="25" y2="33" stroke="#fde047" stroke-width="1.6" stroke-linecap="round" />
          <line x1="11" y1="42" x2="25" y2="42" stroke="#fde047" stroke-width="1.6" stroke-linecap="round" />
          <!-- Cargo Tank Domes -->
          <circle cx="14" cy="20" r="1.3" fill="#ffffff" />
          <circle cx="22" cy="20" r="1.3" fill="#ffffff" />
          <circle cx="14" cy="28.5" r="1.3" fill="#ffffff" />
          <circle cx="22" cy="28.5" r="1.3" fill="#ffffff" />
          <circle cx="14" cy="37.5" r="1.3" fill="#ffffff" />
          <circle cx="22" cy="37.5" r="1.3" fill="#ffffff" />
          <circle cx="14" cy="46" r="1.3" fill="#ffffff" />
          <circle cx="22" cy="46" r="1.3" fill="#ffffff" />
          <!-- Aft Superstructure (Bridge Block) -->
          <rect x="10" y="52" width="16" height="8" rx="1.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.2" />
          <!-- Bridge Wings -->
          <line x1="7" y1="54" x2="29" y2="54" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
          <!-- Bridge Window Glass (Glowing Cyan) -->
          <rect x="12" y="53" width="12" height="2" rx="0.5" fill="#38bdf8" />
          <!-- Exhaust Funnel (Hazard Crimson/Dark) -->
          <rect x="15" y="60.5" width="6" height="3" rx="0.8" fill="#e11d48" stroke="#ffffff" stroke-width="0.8" />
          <circle cx="18" cy="62" r="0.8" fill="#020617" />
        </svg>
      </div>

      <!-- Prominent Culprit Label -->
      <div class="${labelClass}">
        <span class="w-2 h-2 rounded-full ${isAisDark ? 'bg-amber-400' : 'bg-rose-500'} animate-ping"></span>
        <span>${labelTitle}: ${name}</span>
        <span class="text-white font-mono font-semibold marker-speed-val">(${speedStr} kts)</span>
      </div>
    `;
  }

  if (type === 'patrol') {
    return `
      <div class="marker-ring absolute -inset-1 rounded-full border border-cyan-500/50 bg-cyan-500/10 pointer-events-none"></div>
      <div class="marker-icon-container relative z-10 flex items-center justify-center pointer-events-none" style="width: 22px; height: 44px; transform: rotate(${heading}deg); transform-origin: center center; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
        <svg viewBox="0 0 24 48" width="20" height="40" class="drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3 L6 15 L6 41 C6 44 8.5 46 12 46 C15.5 46 18 44 18 41 L18 15 Z" fill="#06b6d4" stroke="#ffffff" stroke-width="1.4" />
          <path d="M12 6 L8 16 L8 39 C8 41 9.5 43 12 43 C14.5 43 16 41 16 39 L16 16 Z" fill="#0891b2" />
          <circle cx="12" cy="12" r="1.5" fill="#ffffff" />
          <rect x="8.5" y="18" width="7" height="13" rx="1.8" fill="#0f172a" stroke="#ffffff" stroke-width="0.9" />
          <rect x="9.5" y="19.5" width="5" height="2.5" rx="0.5" fill="#67e8f9" />
          <line x1="9" y1="25" x2="11.5" y2="25" stroke="#38bdf8" stroke-width="1.2" />
          <line x1="12.5" y1="25" x2="15" y2="25" stroke="#f43f5e" stroke-width="1.2" />
          <rect x="9.5" y="34" width="5" height="4" rx="0.5" fill="#0e7490" stroke="#083344" stroke-width="0.5" />
        </svg>
      </div>
      <div class="marker-label absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-950/90 border border-cyan-700/70 text-[9px] font-mono text-cyan-300 whitespace-nowrap pointer-events-none z-30 flex items-center gap-1">
        🛡️ CYPRUS CG PATROL <span class="marker-speed-val font-semibold">(${speedStr} kts)</span>
      </div>
    `;
  }

  // Standard Commercial Vessel (Cargo / Bulker / Container)
  let hullFill = '#475569';
  let hullStroke = '#0f172a';
  let deckFill = '#334155';
  let hatchFill = '#1e293b';
  let hatchStroke = '#64748b';
  let bridgeFill = '#64748b';
  let windowFill = '#38bdf8';
  let ringHtml = '';
  let labelClass = 'marker-label absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[9px] font-mono text-slate-400 whitespace-nowrap pointer-events-none z-30 group-hover:text-white group-hover:border-slate-600 transition-colors flex items-center gap-1';
  let labelPrefix = '';

  if (isSelected) {
    hullFill = '#0284c7';
    hullStroke = '#ffffff';
    deckFill = '#0369a1';
    hatchFill = '#0c4a6e';
    hatchStroke = '#38bdf8';
    bridgeFill = '#38bdf8';
    windowFill = '#e0f2fe';
    ringHtml = '<div class="marker-ring absolute -inset-2 rounded-full border-2 border-sky-400 bg-sky-500/20 animate-ping pointer-events-none"></div>';
    labelClass = 'marker-label absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-950/95 border-2 border-sky-500 text-[10px] font-mono font-bold text-sky-300 whitespace-nowrap shadow-xl z-30 flex items-center gap-1 backdrop-blur-sm';
    labelPrefix = '🔍 ';
  } else if (isAisDark) {
    hullFill = '#d97706';
    hullStroke = '#fef3c7';
    deckFill = '#b45309';
    hatchFill = '#78350f';
    hatchStroke = '#f59e0b';
    bridgeFill = '#f59e0b';
    ringHtml = '<div class="marker-ring absolute -inset-2 rounded-full border border-amber-500/70 bg-amber-500/20 animate-pulse pointer-events-none"></div>';
    labelClass = 'marker-label absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/80 text-[9px] font-mono text-amber-300 whitespace-nowrap pointer-events-none z-30 animate-pulse flex items-center gap-1';
    labelPrefix = '⚠️ AIS DARK ';
  }

  return `
    ${ringHtml}
    <div class="marker-icon-container relative z-10 flex items-center justify-center pointer-events-none" style="width: 24px; height: 48px; transform: rotate(${heading}deg); transform-origin: center center; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
      <svg viewBox="0 0 28 56" width="22" height="44" class="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 4 C11 4 7 11 7 19 L7 45 C7 51 10 54 14 54 C18 54 21 51 21 45 L21 19 C21 11 17 4 14 4 Z" fill="${hullFill}" stroke="${hullStroke}" stroke-width="1.4" />
        <path d="M14 6 C12 6 9 12 9 19 L9 44 C9 48 11 51 14 51 C17 51 19 48 19 44 L19 19 C19 12 16 6 14 6 Z" fill="${deckFill}" />
        <rect x="10" y="14" width="8" height="6" rx="0.8" fill="${hatchFill}" stroke="${hatchStroke}" stroke-width="0.8" />
        <rect x="10" y="22" width="8" height="6" rx="0.8" fill="${hatchFill}" stroke="${hatchStroke}" stroke-width="0.8" />
        <rect x="10" y="30" width="8" height="6" rx="0.8" fill="${hatchFill}" stroke="${hatchStroke}" stroke-width="0.8" />
        <rect x="9" y="38" width="10" height="7" rx="1.2" fill="${bridgeFill}" stroke="${hullStroke}" stroke-width="1" />
        <rect x="10.5" y="39.5" width="7" height="1.5" rx="0.4" fill="${windowFill}" />
        <line x1="7" y1="41" x2="21" y2="41" stroke="${hullStroke}" stroke-width="1" />
        <rect x="12" y="46" width="4" height="2.5" rx="0.5" fill="#0f172a" />
      </svg>
    </div>
    <div class="${labelClass}">
      <span>${labelPrefix}${displayShortName}</span>
      <span class="marker-speed-val text-slate-300 font-mono">(${speedStr} kts)</span>
    </div>
  `;
}

interface TacticalMapProps {
  spills: SpillFeatureCollection;
  vessels: Vessel[];
  suspects: SuspectVessel[];
  selectedSpillId: string;
  selectedVesselMmsi?: number | null;
  onSelectSpill: (id: string) => void;
  onSelectVessel: (mmsi: number) => void;
  scrubbedVessels?: { mmsi: number; lon: number; lat: number; heading: number; speed?: number; isAisDark?: boolean }[];
  centerCoordinates?: [number, number];
  timeOffsetMinutes?: number;
  metocean?: MetoceanData;
  scenario?: string;
  onOpenMobileDrawer?: () => void;
  focusTarget?: MapFocusTarget | null;
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
  focusTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const locatorMarkerRef = useRef<maplibregl.Marker | null>(null);
  const locatorPopupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectVesselRef = useRef(onSelectVessel);
  onSelectVesselRef.current = onSelectVessel;
  const onSelectSpillRef = useRef(onSelectSpill);
  onSelectSpillRef.current = onSelectSpill;

  const [mapLoaded, setMapLoaded] = useState(false);
  const [showLayerDrawer, setShowLayerDrawer] = useState(false);

  // 5 Color-Coded Maritime Asset Categories Layer Toggles
  const [showFishingZones, setShowFishingZones] = useState<boolean>(true);
  const [showFishingHarbours, setShowFishingHarbours] = useState<boolean>(true);
  const [showAquaculture, setShowAquaculture] = useState<boolean>(true);
  const [showCoastalCommunities, setShowCoastalCommunities] = useState<boolean>(true);
  const [showOilSpills, setShowOilSpills] = useState<boolean>(true);

  // Tactical Layer Toggles & Base Map Mode
  const [showTrails, setShowTrails] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showHindcast, setShowHindcast] = useState(true);
  const [showSarSwath, setShowSarSwath] = useState(true);
  const [showCpaVector, setShowCpaVector] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [baseMapMode, setBaseMapMode] = useState<'dark' | 'satellite'>('dark');

  // Active Incident Config
  const currentIncident = MUMBAI_INCIDENTS[selectedSpillId] || MUMBAI_INCIDENTS["DARTIS-ow-0001"] || Object.values(MUMBAI_INCIDENTS)[0];
  const dischargeOffset = currentIncident?.dischargeOffsetMinutes ?? -45;
  const isPostDischarge = timeOffsetMinutes >= dischargeOffset;
  const baseOrigin = currentIncident?.originCoords || [33.05775642, 33.25902604];

  // Active Inspected Suspect Vessel
  const activeSuspect = useMemo(() => {
    if (!suspects || suspects.length === 0) return null;
    return (
      suspects.find((s) => s.mmsi === selectedVesselMmsi) ||
      suspects.find((s) => s.mmsi === currentIncident.culpritMmsi) ||
      suspects[0]
    );
  }, [suspects, selectedVesselMmsi, currentIncident]);

  // Synchronized Hydrodynamic Oil Spill Polygons - Merging Backend Features + Simulation
  const currentSpills = useMemo<SpillFeatureCollection>(() => {
    const mergedMap = new Map<string, SpillGeoFeature>();

    // 1. Process configured incidents with hydrodynamic drift simulation
    Object.values(MUMBAI_INCIDENTS).forEach((config) => {
      const offsetToUse = config.id === selectedSpillId ? timeOffsetMinutes : 0;
      const backendFeature = spills?.features?.find((f) => f.properties.id === config.id);
      const live = calculateSynchronizedOilSpill(offsetToUse, config.id, metocean, backendFeature);

      mergedMap.set(config.id, {
        type: "Feature",
        id: config.id,
        properties: {
          id: config.id,
          detection_timestamp: backendFeature?.properties?.detection_timestamp || new Date().toISOString(),
          acquisition_timestamp_ist: config.acquisition_timestamp_ist,
          acquisition_timestamp_utc: config.acquisition_timestamp_utc,
          area_sq_km: backendFeature?.properties?.area_sq_km || live.area,
          perimeter_km: backendFeature?.properties?.perimeter_km || live.perimeter,
          confidence_score: backendFeature?.properties?.confidence_score || config.confidence,
          segmentation_dice_score: backendFeature?.properties?.segmentation_dice_score || config.segmentation_dice_score,
          oil_likelihood_score: backendFeature?.properties?.oil_likelihood_score || config.oil_likelihood_score,
          damping_ratio_db: backendFeature?.properties?.damping_ratio_db || config.false_positive_analysis?.marangoni_damping_db || 8.4,
          source_scene: backendFeature?.properties?.source_scene || config.sourceScene,
          status: (backendFeature?.properties?.status as any) || "ACTIVE",
          center: offsetToUse === 0 && backendFeature?.properties?.center ? backendFeature.properties.center : live.center,
          centroid: config.centroid,
          estimated_discharge_liters: backendFeature?.properties?.estimated_discharge_liters || config.volumeLiters,
          slick_type: backendFeature?.properties?.slick_type || config.slickType,
        },
        geometry: (offsetToUse === 0 && backendFeature?.geometry?.coordinates?.length)
          ? backendFeature.geometry
          : {
              type: "Polygon",
              coordinates: live.hasDischarged && live.polygon.length > 0
                ? [live.polygon]
                : (backendFeature?.geometry?.coordinates || []),
            },
      });
    });

    // 2. Ingest external / uploaded / dynamic spills from backend
    if (spills?.features?.length) {
      spills.features.forEach((bf) => {
        if (!mergedMap.has(bf.properties.id)) {
          const offsetToUse = bf.properties.id === selectedSpillId ? timeOffsetMinutes : 0;
          const live = calculateSynchronizedOilSpill(offsetToUse, bf.properties.id, metocean, bf);
          mergedMap.set(bf.properties.id, {
            ...bf,
            properties: {
              ...bf.properties,
              center: offsetToUse === 0 && bf.properties.center ? bf.properties.center : live.center,
              area_sq_km: live.hasDischarged && offsetToUse !== 0 ? live.area : bf.properties.area_sq_km,
              perimeter_km: live.hasDischarged && offsetToUse !== 0 ? live.perimeter : (bf.properties.perimeter_km || 10.0),
              damping_ratio_db: bf.properties.damping_ratio_db || 8.2,
            },
            geometry: (offsetToUse === 0 && bf.geometry?.coordinates?.length)
              ? bf.geometry
              : {
                  type: "Polygon",
                  coordinates: live.hasDischarged && live.polygon.length > 0 ? [live.polygon] : bf.geometry.coordinates,
                },
          });
        }
      });
    }

    return {
      type: "FeatureCollection",
      features: Array.from(mergedMap.values()).filter((f) => f.geometry.coordinates.length > 0 && f.geometry.coordinates[0]?.length > 0),
    };
  }, [spills, selectedSpillId, timeOffsetMinutes, metocean]);

  // Current Slick Centroid Position for Active Spill
  const slickCentroid = useMemo<[number, number]>(() => {
    const activeSpill = currentSpills.features.find((f) => f.properties.id === selectedSpillId);
    if (activeSpill?.properties?.center) {
      return activeSpill.properties.center as [number, number];
    }
    const incident = MUMBAI_INCIDENTS[selectedSpillId];
    if (incident?.originCoords) {
      return incident.originCoords;
    }
    return centerCoordinates || baseOrigin;
  }, [currentSpills, selectedSpillId, baseOrigin, centerCoordinates]);

  // Smooth camera auto-fly when selected spill or center coordinates update
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    map.flyTo({
      center: [slickCentroid[0], slickCentroid[1]],
      zoom: 11.2,
      duration: 1400,
      essential: true,
    });
  }, [selectedSpillId, mapLoaded]);

  // Satellite SAR Swath Footprint (24 km x 24 km Sentinel-1 / PALSAR radar frame)
  const sarSwathFeature = useMemo(() => {
    const halfSizeKm = 12.0;
    const centerLon = slickCentroid[0];
    const centerLat = slickCentroid[1];
    const heading = 192; // Typical Sun-synchronous descending SAR orbit angle
    const rad = (heading * Math.PI) / 180;

    const corners = [
      [-halfSizeKm, -halfSizeKm],
      [halfSizeKm, -halfSizeKm],
      [halfSizeKm, halfSizeKm],
      [-halfSizeKm, halfSizeKm],
      [-halfSizeKm, -halfSizeKm],
    ];

    const boxCoords = corners.map(([dx, dy]) => {
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
      return moveCoordinate(centerLon, centerLat, (Math.atan2(rx, ry) * (180 / Math.PI) + 360) % 360, Math.sqrt(rx * rx + ry * ry));
    });

    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {
            title: "Copernicus Sentinel-1 SAR Acquisition Frame",
            polarization: "VV + VH Cross-Polarization",
            mode: "IW (Interferometric Wide Swath)",
            resolution: "10m Ground Resolution",
            scene_id: currentIncident.sourceScene,
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [boxCoords],
          },
        },
      ],
    };
  }, [slickCentroid, currentIncident]);

  // Closest Point of Approach (CPA) Intercept Vector from active suspect to breach origin
  const cpaVectorFeature = useMemo(() => {
    if (!activeSuspect || !isPostDischarge || !showCpaVector) {
      return { type: "FeatureCollection" as const, features: [] };
    }

    const suspectDisplay = scrubbedVessels?.find((v) => v.mmsi === activeSuspect.mmsi);
    const suspectCoord: [number, number] = suspectDisplay
      ? [suspectDisplay.lon, suspectDisplay.lat]
      : (activeSuspect.trajectory?.[0] ? [activeSuspect.trajectory[0][0], activeSuspect.trajectory[0][1]] : baseOrigin);

    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {
            type: "cpa_vector",
            title: "CPA Trajectory Intercept Vector",
            cpa_km: 0.0,
          },
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [suspectCoord[0], suspectCoord[1]],
              [baseOrigin[0], baseOrigin[1]],
            ],
          },
        },
      ],
    };
  }, [activeSuspect, isPostDischarge, showCpaVector, scrubbedVessels, baseOrigin]);

  // Hydrodynamic Hindcast Back-Tracing
  const hindcastFeatures = useMemo(() => {
    const shouldShow = showHindcast;
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
  }, [showHindcast, isPostDischarge, slickCentroid, baseOrigin]);

  // Hydrodynamic +6h Drift Forecast Fan
  const forecastFeatures = useMemo(() => {
    const shouldShow = showForecast;
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
  }, [showForecast, isPostDischarge, slickCentroid, metocean]);

  // Dump Origin GPS Point Marker
  const dumpOriginFeature = useMemo(() => {
    const shouldShow = isPostDischarge;
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
  }, [isPostDischarge, currentIncident, baseOrigin]);

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
          'satellite-base': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri, Maxar, Earthstar Geographics',
            maxzoom: 18,
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
            id: 'satellite-base-layer',
            type: 'raster',
            source: 'satellite-base',
            minzoom: 0,
            maxzoom: 20,
            layout: {
              visibility: 'none',
            },
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

      // 7. SAR Satellite Footprint Swath Layer
      map.addSource('sar-swath-source', {
        type: 'geojson',
        data: sarSwathFeature,
      });

      map.addLayer({
        id: 'sar-swath-fill',
        type: 'fill',
        source: 'sar-swath-source',
        paint: {
          'fill-color': '#06b6d4',
          'fill-opacity': 0.05,
        },
      });

      map.addLayer({
        id: 'sar-swath-line',
        type: 'line',
        source: 'sar-swath-source',
        paint: {
          'line-color': '#06b6d4',
          'line-width': 1.6,
          'line-dasharray': [4, 4],
          'line-opacity': 0.65,
        },
      });

      // 8. CPA Intercept Vector Layer
      map.addSource('cpa-vector-source', {
        type: 'geojson',
        data: cpaVectorFeature,
      });

      map.addLayer({
        id: 'cpa-vector-line',
        type: 'line',
        source: 'cpa-vector-source',
        paint: {
          'line-color': '#fbbf24',
          'line-width': 2.0,
          'line-dasharray': [3, 3],
          'line-opacity': 0.85,
        },
      });

      // 9. Oil Spill Layers (Multi-Spill Polygons)
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
          'line-width': 8,
          'line-opacity': 0.45,
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
            0.68,
            0.40
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
            3.2,
            1.6
          ],
        },
      });

      // Click on spill polygon to select & show Tactical HUD Popup
      map.on('click', 'spills-fill', (e) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const clickedId = props?.id;
          if (clickedId) {
            onSelectSpillRef.current(clickedId);
          }

          const coords = e.lngLat;
          const popupHtml = `
            <div style="font-family: monospace; padding: 8px; background: #070b14; border: 1.5px solid #06b6d4; border-radius: 10px; color: #f8fafc; font-size: 11px; min-width: 225px; box-shadow: 0 10px 25px rgba(0,0,0,0.85);">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 5px; margin-bottom: 6px;">
                <strong style="color: #38bdf8; font-size: 12px; display: flex; align-items: center; gap: 4px;">🚨 ${props?.id || 'OIL SPILL'}</strong>
                <span style="background: rgba(225,29,72,0.25); color: #fda4af; padding: 1.5px 6px; border-radius: 4px; font-weight: bold; border: 1px solid rgba(225,29,72,0.4); font-size: 9.5px;">${props?.status || 'ACTIVE'}</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 6px;">
                <div><span style="color: #94a3b8;">Area:</span> <b style="color: #e2e8f0;">${Number(props?.area_sq_km || 0).toFixed(2)} km²</b></div>
                <div><span style="color: #94a3b8;">Perimeter:</span> <b style="color: #e2e8f0;">${props?.perimeter_km ? Number(props.perimeter_km).toFixed(1) : '11.4'} km</b></div>
                <div><span style="color: #94a3b8;">AI Dice:</span> <b style="color: #34d399;">${(Number(props?.segmentation_dice_score || 0.962) * 100).toFixed(1)}%</b></div>
                <div><span style="color: #94a3b8;">Confidence:</span> <b style="color: #38bdf8;">${(Number(props?.confidence_score || 0.95) * 100).toFixed(1)}%</b></div>
                <div><span style="color: #94a3b8;">Damping:</span> <b style="color: #fbbf24;">${props?.damping_ratio_db || '8.4'} dB</b></div>
                <div><span style="color: #94a3b8;">Discharge:</span> <b style="color: #f43f5e;">${props?.estimated_discharge_liters ? Number(props.estimated_discharge_liters).toLocaleString() : '45,000'} L</b></div>
              </div>
              <div style="border-top: 1px solid #1e293b; padding-top: 5px; font-size: 9.5px; color: #94a3b8; display: flex; flex-direction: column; gap: 2px;">
                <div><span style="color: #64748b;">Type:</span> ${props?.slick_type || 'Heavy Fuel Oil'}</div>
                <div><span style="color: #64748b;">Scene:</span> ${props?.source_scene || 'Copernicus Sentinel-1'}</div>
              </div>
            </div>
          `;

          new maplibregl.Popup({ closeButton: true, closeOnClick: true, className: 'tactical-popup' })
            .setLngLat(coords)
            .setHTML(popupHtml)
            .addTo(map);
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

    // 5. Update Base Map & 5-Category Layer Visibility
    const setVisibility = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    };

    setVisibility('dark-ocean-base-layer', baseMapMode === 'dark');
    setVisibility('satellite-base-layer', baseMapMode === 'satellite');

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

    // 6. Update SAR Satellite Swath Footprint
    const swathSrc = map.getSource('sar-swath-source') as maplibregl.GeoJSONSource;
    if (swathSrc) swathSrc.setData(sarSwathFeature);
    setVisibility('sar-swath-fill', showSarSwath);
    setVisibility('sar-swath-line', showSarSwath);

    // 7. Update CPA Intercept Vector
    const cpaSrc = map.getSource('cpa-vector-source') as maplibregl.GeoJSONSource;
    if (cpaSrc) cpaSrc.setData(cpaVectorFeature);
    setVisibility('cpa-vector-line', showCpaVector);

    // 8. Update Background Trajectories for all vessels
    const allTrajSrc = map.getSource('all-trajectories') as maplibregl.GeoJSONSource;
    const shouldShowTrails = showTrails;
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

    // 9. Update Active Inspected Culprit Trajectory Track
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
    sarSwathFeature,
    cpaVectorFeature,
    activeSuspect,
    baseMapMode,
    showTrails,
    showSarSwath,
    showCpaVector,
    showFishingZones,
    showFishingHarbours,
    showAquaculture,
    showCoastalCommunities,
    showOilSpills
  ]);

  // Dynamic Target Locator Beacon & Camera Fly-To Hook
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !focusTarget || !focusTarget.coordinates) return;
    const map = mapRef.current;
    const [targetLon, targetLat] = focusTarget.coordinates;

    // 1. Automatically turn on the category layer so the located asset is visible
    if (focusTarget.category === 'fishing_zone') setShowFishingZones(true);
    if (focusTarget.category === 'fishing_harbour') setShowFishingHarbours(true);
    if (focusTarget.category === 'aquaculture') setShowAquaculture(true);
    if (focusTarget.category === 'coastal_community') setShowCoastalCommunities(true);
    if (focusTarget.category === 'oil_spill' || focusTarget.category === 'sar_detection') setShowOilSpills(true);

    // 2. Smoothly fly camera to exact target coordinates
    map.flyTo({
      center: [targetLon, targetLat],
      zoom: focusTarget.zoom || 11.8,
      duration: 1400,
      essential: true,
    });

    // 3. Remove existing locator beacon and popup
    if (locatorMarkerRef.current) {
      locatorMarkerRef.current.remove();
      locatorMarkerRef.current = null;
    }
    if (locatorPopupRef.current) {
      locatorPopupRef.current.remove();
      locatorPopupRef.current = null;
    }

    // 4. Create Tactical Radar Locator Beacon Element
    const el = document.createElement('div');
    el.className = 'locator-beacon-container pointer-events-none select-none';
    el.style.width = '64px';
    el.style.height = '64px';
    el.style.position = 'relative';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';

    el.innerHTML = `
      <div style="position: absolute; inset: 0; border-radius: 9999px; border: 2px solid #38bdf8; background: rgba(56, 189, 248, 0.15); animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: absolute; inset: 12px; border-radius: 9999px; border: 2px dashed #06b6d4; animation: spin 4s linear infinite;"></div>
      <div style="position: absolute; width: 14px; height: 14px; border-radius: 9999px; background: #06b6d4; border: 2px solid #ffffff; box-shadow: 0 0 15px #06b6d4;"></div>
      <div style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); background: rgba(7, 11, 20, 0.95); border: 1px solid #38bdf8; color: #38bdf8; font-family: ui-monospace, monospace; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.8); letter-spacing: 0.5px;">
        🎯 LOCATED TARGET
      </div>
    `;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([targetLon, targetLat])
      .addTo(map);

    locatorMarkerRef.current = marker;

    // 5. Open rich context popup
    const popupHtml = `
      <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 8px 10px; color: #f1f5f9; background: #070b14; border: 1px solid #06b6d4; border-radius: 10px; font-size: 11px; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #38bdf8; font-weight: 800; font-size: 11px;">🎯 TARGET LOCATED</span>
          <span style="color: #94a3b8; font-size: 9px;">${targetLat.toFixed(4)}°N, ${targetLon.toFixed(4)}°E</span>
        </div>
        <div style="font-weight: 700; font-size: 12px; color: #ffffff; margin-bottom: 4px;">${focusTarget.title || 'Selected Maritime Asset'}</div>
        <div style="color: #cbd5e1; font-size: 10px; line-height: 1.4;">${focusTarget.description || 'Target coordinates locked and tracked in OceanGuard Tactical Map.'}</div>
      </div>
    `;

    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: [0, -32], maxWidth: '300px' })
      .setLngLat([targetLon, targetLat])
      .setHTML(popupHtml)
      .addTo(map);

    locatorPopupRef.current = popup;

    // Auto-remove beacon after 20 seconds
    const timer = setTimeout(() => {
      if (locatorMarkerRef.current === marker) {
        marker.remove();
        locatorMarkerRef.current = null;
      }
    }, 20000);

    return () => clearTimeout(timer);
  }, [focusTarget, mapLoaded]);

  // Smooth camera fly-to when selected incident or vessel changes (if no manual focusTarget)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || focusTarget) return;
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
  }, [selectedSpillId, selectedVesselMmsi, mapLoaded, baseOrigin, activeSuspect, focusTarget]);

  // Render & Update Vessel Markers with Active Focus Highlight
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const displayVessels = scrubbedVessels || vessels.map((v) => {
      const interp = interpolateVesselPosition(v.mmsi, 0, 'mediterranean_dartis', v.current_position ? {
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
      const isIncidentCulprit = currentIncident.culpritMmsi === v.mmsi || v.mmsi === 212000001;
      const isCoastGuard = v.mmsi === 419000999;
      const fullVessel = vessels.find((item) => item.mmsi === v.mmsi);
      const name = fullVessel?.name || `MMSI ${v.mmsi}`;
      const markerKey = `vessel-${v.mmsi}`;
      const isAisDark = !!(v as any).isAisDark;

      const shipType: 'culprit' | 'patrol' | 'commercial' = isIncidentCulprit
        ? 'culprit'
        : (isCoastGuard || v.mmsi === 212000005)
        ? 'patrol'
        : 'commercial';

      const stateKey = `${shipType}-${isSelected}-${isAisDark}`;
      let marker = markersRef.current[markerKey];

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'vessel-marker group cursor-pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.dataset.renderedState = stateKey;

        if (shipType === 'culprit') {
          el.style.width = '64px';
          el.style.height = '92px';
          el.style.zIndex = isSelected ? '55' : '50';
        } else if (shipType === 'patrol') {
          el.style.width = '36px';
          el.style.height = '54px';
          el.style.zIndex = '35';
        } else {
          el.style.width = '38px';
          el.style.height = '56px';
          el.style.zIndex = isSelected ? '45' : '20';
        }

        el.innerHTML = getShipMarkerHtml(shipType, isSelected, isAisDark, name, v.speed || 0, v.heading);

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
        const el = marker.getElement();

        if (el.dataset.renderedState !== stateKey) {
          el.dataset.renderedState = stateKey;
          if (shipType === 'culprit') {
            el.style.width = '64px';
            el.style.height = '92px';
            el.style.zIndex = isSelected ? '55' : '50';
          } else if (shipType === 'patrol') {
            el.style.width = '36px';
            el.style.height = '54px';
            el.style.zIndex = '35';
          } else {
            el.style.width = '38px';
            el.style.height = '56px';
            el.style.zIndex = isSelected ? '45' : '20';
          }
          el.innerHTML = getShipMarkerHtml(shipType, isSelected, isAisDark, name, v.speed || 0, v.heading);
        } else {
          const svgContainer = el.querySelector('.marker-icon-container') as HTMLElement;
          if (svgContainer) {
            svgContainer.style.transform = `rotate(${v.heading}deg)`;
          }
          const speedEl = el.querySelector('.marker-speed-val') as HTMLElement;
          if (speedEl) {
            speedEl.textContent = `(${(v.speed || 0).toFixed(1)} kts)`;
          }
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
      {/* 5-CATEGORY TACTICAL LAYER SELECTOR & LEGEND (TOP LEFT) */}
      {/* ============================================================== */}
      <div className="absolute top-3.5 left-3 sm:left-4 z-20 flex flex-col font-mono text-xs select-none max-w-xs">
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
              <button
                onClick={() => setShowSarSwath(!showSarSwath)}
                className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition-all text-[11px] ${
                  showSarSwath ? 'text-cyan-300 font-semibold' : 'text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Satellite className="w-3 h-3 text-cyan-400" />
                  <span>SAR Satellite Frame</span>
                </div>
                <span className="text-[9px] font-mono">{showSarSwath ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={() => setShowCpaVector(!showCpaVector)}
                className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition-all text-[11px] ${
                  showCpaVector ? 'text-amber-300 font-semibold' : 'text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3 h-3 text-amber-400" />
                  <span>CPA Intercept Line</span>
                </div>
                <span className="text-[9px] font-mono">{showCpaVector ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Fleet & Target Vessels Legend */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <span className="text-[9px] text-cyan-400 font-extrabold uppercase tracking-wider px-1">
                Fleet & Target Vessels
              </span>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/50 text-[10px] text-rose-200 shadow-sm shadow-rose-950/50">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                <span className="font-semibold">🎯 Culprit: Mediterranean Trader (VLCC)</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/40 text-[10px] text-cyan-300">
                <span className="w-2 h-2 rounded bg-cyan-400 shrink-0" />
                <span>🛡️ Cyprus Coast Guard Patrol</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded bg-slate-500 shrink-0" />
                <span>🚢 Commercial Cargo & Bulkers (28 Ships)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MAP ZOOM, BASEMAP & CENTER CONTROLS (TOP RIGHT) */}
      {/* ============================================================== */}
      <div className="absolute top-3.5 right-3 sm:right-4 flex flex-col gap-1.5 z-20 select-none">
        <button
          onClick={() => setBaseMapMode((prev) => (prev === 'dark' ? 'satellite' : 'dark'))}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-lg transition-all ${
            baseMapMode === 'satellite'
              ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300 shadow-cyan-500/30'
              : 'bg-[#111622]/90 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={baseMapMode === 'dark' ? 'Switch to High-Res Satellite Imagery' : 'Switch to Dark Tactical Bathymetry'}
        >
          <Satellite className="w-4 h-4" />
        </button>
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
            mapRef.current?.flyTo({ center: [slickCentroid[0], slickCentroid[1]], zoom: 11.2, duration: 1200 });
          }}
          className="w-8 h-8 rounded-lg bg-[#111622]/90 border border-slate-800 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 flex items-center justify-center shadow-lg transition-colors"
          title="Recenter on Active Oil Spill"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* ============================================================== */}
      {/* TOP-RIGHT DOCKED TELEMETRY CAPSULE (NON-OVERLAPPING) */}
      {/* ============================================================== */}
      <div className="absolute top-28 right-3 sm:right-4 z-10 hidden md:flex flex-col gap-1 p-2.5 bg-[#111622]/95 border border-slate-800 rounded-xl backdrop-blur-md font-mono text-[10px] text-slate-300 shadow-2xl max-w-[240px] ring-1 ring-slate-800/80">
        <div className="flex items-center justify-between font-bold text-white border-b border-slate-800 pb-1">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Compass className="w-3.5 h-3.5" />
            CYPRUS EEZ RADAR
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
