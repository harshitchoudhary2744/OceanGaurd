export interface SpillProperties {
  id: string;
  detection_timestamp: string;
  area_sq_km: number;
  perimeter_km?: number;
  confidence_score: number;
  source_scene?: string;
  status: 'ACTIVE' | 'CONTAINED' | 'DISPERSED';
  center: [number, number]; // [lon, lat]
  estimated_discharge_liters?: number;
  slick_type?: string;
}

export interface SpillGeoFeature {
  type: 'Feature';
  id?: string;
  properties: SpillProperties;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface SpillFeatureCollection {
  type: 'FeatureCollection';
  features: SpillGeoFeature[];
}

export interface Vessel {
  mmsi: number;
  name: string;
  flag: string;
  vessel_type: string;
  length_meters: number;
  call_sign?: string;
  destination?: string;
  current_position?: {
    latitude: number;
    longitude: number;
    speed_knots: number;
    heading_degrees: number;
    timestamp?: string;
  };
}

export interface SuspectVessel {
  mmsi: number;
  name: string;
  flag: string;
  vessel_type: string;
  length_meters: number;
  call_sign?: string;
  destination?: string;
  distance_meters: number;
  distance_km?: number;
  probability_score: number;
  speed_knots: number;
  heading_degrees: number;
  last_lat: number;
  last_lon: number;
  trajectory?: [number, number, string][]; // [lon, lat, timestamp]
}

export interface VectorMatch {
  id?: string;
  spill_id?: string;
  title: string;
  date: string;
  location: string;
  area_sq_km: number;
  perimeter_km: number;
  eccentricity: number;
  oil_type: string;
  culprit_name?: string;
  similarity_score: number;
}

export interface SARInferenceResponse {
  status: string;
  message: string;
  spill: SpillProperties & { polygon_coordinates: number[][] };
  geojson_feature: SpillGeoFeature;
  metrics: {
    area_sq_km: number;
    perimeter_km: number;
    eccentricity: number;
    confidence: number;
  };
  primary_suspect?: SuspectVessel;
  ranked_suspects: SuspectVessel[];
}
