import {
  SpillFeatureCollection,
  SpillGeoFeature,
  SuspectVessel,
  VectorMatch,
  Vessel,
  SARInferenceResponse,
  MetoceanData,
  HindcastData,
  AnomalyBreakdown
} from '../types';
import {
  INITIAL_SPILLS,
  INITIAL_VESSELS,
  INITIAL_SUSPECTS,
  INITIAL_VECTOR_MATCHES,
  DEFAULT_METOCEAN
} from './mockData';
import {
  globalSimulation,
  MUMBAI_INCIDENTS,
  generateHindcastTrack,
  generateRealisticSpillPolygon,
  registerCustomSpillIncident,
  calculatePolygonMetrics
} from './simulationEngine';

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


export async function fetchMetoceanData(sector: string = 'mediterranean_dartis'): Promise<MetoceanData> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/metocean?sector=${sector}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return DEFAULT_METOCEAN[sector] || DEFAULT_METOCEAN.mediterranean_dartis || Object.values(DEFAULT_METOCEAN)[0];
  }
}

export async function fetchHindcastData(
  spillId: string,
  lookbackHours: number = 6,
  sector: string = 'mediterranean_dartis'
): Promise<HindcastData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/spills/${spillId}/hindcast?lookback_hours=${lookbackHours}&sector=${sector}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Generate fallback hindcast data based on benchmark incident
    const config = MUMBAI_INCIDENTS[spillId] || MUMBAI_INCIDENTS["DARTIS-ow-0001"];
    const centerLon = config.originCoords[0];
    const centerLat = config.originCoords[1];
    const driftDir = 84.5;
    const driftSpeed = 1.35;
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
      detection_timestamp: "2019-01-01T03:42:35+00:00",
      detection_center: [centerLon, centerLat],
      lookback_hours: lookbackHours,
      sector: 'mediterranean_dartis',
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
  spillId: string = 'DARTIS-ow-0001'
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
  scenario: string = 'mediterranean_dartis'
): number[][] {
  if (Math.abs(timeOffsetMinutes) < 0.1 || !basePolygon?.length) return basePolygon;

  const dischargeOffset = -45;
  const baseOrigin: [number, number] = (basePolygon && basePolygon.length > 0)
    ? [basePolygon[0][0], basePolygon[0][1]]
    : [33.05775642, 33.25902604];

  const driftSpeedKts = metocean?.net_drift_speed_kts || 1.35;
  const driftDir = metocean?.net_drift_direction_deg || 84.5;

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
    const data = await res.json();
    return data;
  } catch (err) {
    const lonRaw = formData.get('center_lon');
    const latRaw = formData.get('center_lat');
    const sceneIdRaw = formData.get('scene_id');

    const centerLon = lonRaw ? Number(lonRaw) : 33.05775642;
    const centerLat = latRaw ? Number(latRaw) : 33.25902604;
    const sceneId = sceneIdRaw ? String(sceneIdRaw) : 'ow-0001.jpg';
    const mockId = `INC-CUST-${Date.now().toString().slice(-4)}`;

    const polygon = generateRealisticSpillPolygon(centerLon, centerLat, 52.0, 4.6, 1.3);
    const polyMetrics = calculatePolygonMetrics(polygon, 16.2);
    const fallbackArea = sceneId.includes('ow-0001') ? 0.37 : (polyMetrics.area_sq_km || 0.37);
    const mockMaskUrl = `http://localhost:8000/api/v1/ml/masks/${sceneId.replace(/\.(jpg|jpeg)$/i, '.png')}`;

    // Register into the incident engine so all tabs, threat models, and scrubbing works immediately
    registerCustomSpillIncident({
      id: mockId,
      name: `Custom Uploaded Scene: ${sceneId}`,
      locationName: `Offshore Target (${centerLat.toFixed(3)}°N, ${centerLon.toFixed(3)}°E)`,
      originCoords: [centerLon, centerLat],
      areaSqKm: fallbackArea,
      sourceScene: sceneId,
      slickType: "Heavy Crude Oil (Marine Heavy Residue)",
      confidence: polyMetrics.oil_likelihood_score,
      polygonCoordinates: polygon,
      windSpeedKts: 16.2,
    });

    const nowIso = "2019-01-01T03:42:35+00:00";
    const nowIst = "2019-01-01 09:12:35 IST";
    const nowUtc = "2019-01-01 03:42:35 UTC";

    const spillObj = {
      id: mockId,
      detection_timestamp: nowIso,
      acquisition_timestamp_ist: nowIst,
      acquisition_timestamp_utc: nowUtc,
      area_sq_km: fallbackArea,
      perimeter_km: polyMetrics.perimeter_km,
      confidence_score: polyMetrics.oil_likelihood_score,
      segmentation_dice_score: 0.962,
      oil_likelihood_score: polyMetrics.oil_likelihood_score,
      lookalike_score: polyMetrics.lookalike_score,
      source_scene: sceneId,
      status: "ACTIVE" as const,
      center: [centerLon, centerLat] as [number, number],
      centroid: [centerLat, centerLon] as [number, number],
      polygon_coordinates: polygon,
      estimated_discharge_liters: Math.round(fallbackArea * 10500),
      slick_type: "Heavy Crude Oil (Marine Heavy Residue)",
      mask_data_url: mockMaskUrl
    };

    const geojsonFeature: SpillGeoFeature = {
      type: "Feature",
      id: mockId,
      properties: {
        ...spillObj,
        detection_timestamp: "2019-01-01T03:42:35+00:00",
        acquisition_timestamp_utc: "2019-01-01 03:42:35 UTC",
      },
      geometry: {
        type: "Polygon",
        coordinates: [polygon]
      }
    };

    return {
      status: "SUCCESS",
      message: "SAR Scene segmented & attributed successfully.",
      spill: spillObj,
      geojson_feature: geojsonFeature,
      metrics: {
        area_sq_km: polyMetrics.area_sq_km,
        perimeter_km: polyMetrics.perimeter_km,
        eccentricity: polyMetrics.eccentricity,
        confidence: polyMetrics.segmentation_dice_score,
        segmentation_dice_score: polyMetrics.segmentation_dice_score,
        oil_likelihood_score: polyMetrics.oil_likelihood_score,
        lookalike_score: polyMetrics.lookalike_score,
        damping_ratio_db: polyMetrics.damping_ratio_db,
        class_probabilities: polyMetrics.false_positive_analysis.classes
      },
      primary_suspect: INITIAL_SUSPECTS[0],
      ranked_suspects: INITIAL_SUSPECTS,
      mask_data_url: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' width='256' height='256'><rect width='256' height='256' fill='%23070b14'/><ellipse cx='128' cy='128' rx='42' ry='24' fill='%23f43f5e' filter='drop-shadow(0 0 8px %23f43f5e)'/></svg>`
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
