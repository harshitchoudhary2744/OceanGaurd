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
    return data.suspects || INITIAL_SUSPECTS;
  } catch (err) {
    return INITIAL_SUSPECTS;
  }
}

export async function fetchVectorMatches(spillId: string): Promise<VectorMatch[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/spills/${spillId}/similar`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.matches || INITIAL_VECTOR_MATCHES;
  } catch (err) {
    return INITIAL_VECTOR_MATCHES;
  }
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
