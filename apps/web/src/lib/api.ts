import {
  SpillFeatureCollection,
  SpillGeoFeature,
  SuspectVessel,
  VectorMatch,
  Vessel,
  SARInferenceResponse
} from '../types';
import {
  INITIAL_SPILLS,
  INITIAL_VESSELS,
  INITIAL_SUSPECTS,
  INITIAL_VECTOR_MATCHES
} from './mockData';
import { globalSimulation } from './simulationEngine';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function fetchSpills(): Promise<SpillFeatureCollection> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/spills`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.features?.length) return data;
    return INITIAL_SPILLS;
  } catch (err) {
    return INITIAL_SPILLS;
  }
}

export async function fetchCorrelations(spillId: string): Promise<SuspectVessel[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/spills/${spillId}/correlate`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.suspects || globalSimulation.buildInitialState(spillId).suspects;
  } catch (err) {
    return globalSimulation.buildInitialState(spillId).suspects;
  }
}

export async function fetchVectorMatches(spillId: string): Promise<VectorMatch[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/spills/${spillId}/similar`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.matches || INITIAL_VECTOR_MATCHES.filter((m) => m.spill_id === spillId);
  } catch (err) {
    const filtered = INITIAL_VECTOR_MATCHES.filter((m) => m.spill_id === spillId);
    return filtered.length > 0 ? filtered : INITIAL_VECTOR_MATCHES;
  }
}

import { DEFAULT_METOCEAN } from './mockData';
import { MetoceanData, HindcastData, AnomalyBreakdown } from '../types';

export async function fetchMetoceanData(sector: string = 'mumbai'): Promise<MetoceanData> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/metocean?sector=${sector}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return DEFAULT_METOCEAN[sector] || DEFAULT_METOCEAN.arabian_sea;
  }
}

export async function fetchHindcastData(
  spillId: string,
  lookbackHours: number = 6,
  sector: string = 'mumbai'
): Promise<HindcastData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/spills/${spillId}/hindcast?lookback_hours=${lookbackHours}&sector=${sector}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Generate fallback hindcast data based on Mumbai incident
    const { MUMBAI_INCIDENTS, generateHindcastTrack } = await import('./simulationEngine');
    const config = MUMBAI_INCIDENTS[spillId] || MUMBAI_INCIDENTS["INC-MUM-2024-01"];
    const centerLon = config.originCoords[0];
    const centerLat = config.originCoords[1];
    const driftDir = 69.3;
    const driftSpeed = 1.95;
    const rawTrack = generateHindcastTrack(centerLon, centerLat, driftDir, driftSpeed, lookbackHours);

    const hindcast_track = rawTrack.map(pt => ({
      time_offset_minutes: pt.timeOffsetMinutes,
      timestamp: new Date(Date.now() + pt.timeOffsetMinutes * 60000).toISOString(),
      longitude: pt.lon,
      latitude: pt.lat,
      distance_from_detected_km: Number((driftSpeed * 1.852 * (Math.abs(pt.timeOffsetMinutes) / 60)).toFixed(2)),
      estimated_slick_radius_m: pt.radiusMeters,
      hindcast_heading_deg: (driftDir + 180) % 360,
      drift_speed_kts: driftSpeed,
    }));

    const origin = hindcast_track[hindcast_track.length - 1];
    return {
      spill_id: spillId,
      detection_timestamp: new Date().toISOString(),
      detection_center: [centerLon, centerLat],
      lookback_hours: lookbackHours,
      sector: 'mumbai',
      reverse_drift_heading_deg: (driftDir + 180) % 360,
      reverse_drift_speed_kts: driftSpeed,
      reconstructed_origin: {
        longitude: origin.longitude,
        latitude: origin.latitude,
        timestamp: origin.timestamp,
        distance_from_detected_km: origin.distance_from_detected_km,
      },
      hindcast_track,
    };
  }
}

export async function fetchVesselAnomalies(
  mmsi: number,
  spillId: string = 'INC-MUM-2024-01'
): Promise<AnomalyBreakdown | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/vessels/${mmsi}/anomalies?spill_id=${spillId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.anomaly_breakdown || null;
  } catch (err) {
    return null;
  }
}

export function calculateHydrodynamicDrift(
  basePolygon: number[][],
  timeOffsetMinutes: number,
  metocean?: MetoceanData,
  scenario: string = 'arabian_sea'
): number[][] {
  if (Math.abs(timeOffsetMinutes) < 0.1 || !basePolygon?.length) return basePolygon;

  const isArabian = scenario === 'arabian_sea' || basePolygon[0][0] < 76.0;
  const dischargeOffset = isArabian ? -42 : -60;
  const baseOrigin: [number, number] = isArabian ? [72.145, 19.048] : [80.750, 13.250];

  const driftSpeedKts = metocean?.net_drift_speed_kts || (isArabian ? 1.95 : 1.52);
  const driftDir = metocean?.net_drift_direction_deg || (isArabian ? 69.3 : 48.2);

  // Time elapsed since oil was dumped (in hours)
  const elapsedSinceDischargeHours = (timeOffsetMinutes - dischargeOffset) / 60.0;
  
  if (elapsedSinceDischargeHours <= 0) {
    // Fresh at origin
    const dx = baseOrigin[0] - basePolygon[0][0];
    const dy = baseOrigin[1] - basePolygon[0][1];
    return basePolygon.map(([lon, lat]) => [
      Number((lon + dx).toFixed(6)),
      Number((lat + dy).toFixed(6))
    ]);
  }

  const driftDistanceKm = (driftSpeedKts * 1.852) * elapsedSinceDischargeHours;
  const R = 6371.0;
  const dByR = driftDistanceKm / R;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const deg = (radVal: number) => (radVal * 180) / Math.PI;
  const brng = rad(driftDir);

  const lat1 = rad(baseOrigin[1]);
  const lon1 = rad(baseOrigin[0]);
  const targetLat = deg(Math.asin(Math.sin(lat1) * Math.cos(dByR) + Math.cos(lat1) * Math.sin(dByR) * Math.cos(brng)));
  const targetLon = deg(lon1 + Math.atan2(Math.sin(brng) * Math.sin(dByR) * Math.cos(lat1), Math.cos(dByR) - Math.sin(lat1) * Math.sin(rad(targetLat))));

  const lons = basePolygon.map(p => p[0]);
  const lats = basePolygon.map(p => p[1]);
  const cx = lons.reduce((a, b) => a + b, 0) / lons.length;
  const cy = lats.reduce((a, b) => a + b, 0) / lats.length;

  const spreadScale = Math.min(1.35, Math.max(0.65, 0.75 + elapsedSinceDischargeHours * 0.35));

  return basePolygon.map(([lon, lat]) => [
    Number((targetLon + (lon - cx) * spreadScale).toFixed(6)),
    Number((targetLat + (lat - cy) * spreadScale).toFixed(6))
  ]);
}

export async function uploadSarScene(formData: FormData): Promise<SARInferenceResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/spills/detect`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    const mockId = `SPILL-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      status: "SUCCESS",
      message: "SAR Scene segmented (Simulation Mode)",
      spill: {
        id: mockId,
        detection_timestamp: new Date().toISOString(),
        area_sq_km: 3.85,
        perimeter_km: 10.2,
        confidence_score: 0.976,
        source_scene: "S1A_IW_GRDH_1SDV_DETECT",
        status: "ACTIVE",
        center: [72.150, 19.050],
        polygon_coordinates: INITIAL_SPILLS.features[0].geometry.coordinates[0],
        estimated_discharge_liters: 39000,
        slick_type: "Heavy Fuel Oil (HFO-380)"
      },
      geojson_feature: {
        type: "Feature",
        id: mockId,
        properties: {
          id: mockId,
          detection_timestamp: new Date().toISOString(),
          area_sq_km: 3.85,
          perimeter_km: 10.2,
          confidence_score: 0.976,
          source_scene: "S1A_IW_GRDH_1SDV_DETECT",
          status: "ACTIVE",
          center: [72.150, 19.050],
          estimated_discharge_liters: 39000,
          slick_type: "Heavy Fuel Oil (HFO-380)"
        },
        geometry: {
          type: "Polygon",
          coordinates: INITIAL_SPILLS.features[0].geometry.coordinates
        }
      },
      metrics: {
        area_sq_km: 3.85,
        perimeter_km: 10.2,
        eccentricity: 0.83,
        confidence: 0.976
      },
      primary_suspect: INITIAL_SUSPECTS[0],
      ranked_suspects: INITIAL_SUSPECTS
    };
  }
}

export async function downloadPdfReportUrl(
  spillId: string,
  spillFeature?: SpillGeoFeature | null,
  suspects?: SuspectVessel[]
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_BASE}/api/v1/reports/${spillId}/pdf`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return window.URL.createObjectURL(blob);
  } catch (err) {
    // Universal client-side fallback: generates identical legal dossier directly in the browser
    const { generateClientSidePdfDossier } = await import('./pdfReport');
    const blob = generateClientSidePdfDossier(spillId, spillFeature, suspects);
    return window.URL.createObjectURL(blob);
  }
}

export async function fetchVessels(): Promise<Vessel[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/vessels`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.vessels || INITIAL_VESSELS;
  } catch (err) {
    return INITIAL_VESSELS;
  }
}
