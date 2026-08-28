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

export interface LinkedSpillInfo {
  id: string;
  detection_date: string;
  detection_time_utc: string;
  volume_liters: number;
  confidence_score: number;
  slick_type: string;
  distance_km: number;
}

export interface Vessel {
  mmsi: number;
  imo_number?: number;
  name: string;
  flag: string;
  vessel_type: string;
  length_meters: number;
  draught_meters?: number;
  call_sign?: string;
  destination?: string;
  nav_status?: string;
  cargo_type?: string;
  linked_spill?: LinkedSpillInfo;
  current_position?: {
    latitude: number;
    longitude: number;
    speed_knots: number;
    heading_degrees: number;
    timestamp?: string;
    rate_of_turn?: number;
  };
}

export interface SuspectVessel {
  mmsi: number;
  imo_number?: number;
  name: string;
  flag: string;
  vessel_type: string;
  length_meters: number;
  draught_meters?: number;
  call_sign?: string;
  destination?: string;
  distance_meters: number;
  distance_km?: number;
  probability_score: number;
  speed_knots: number;
  heading_degrees: number;
  last_lat: number;
  last_lon: number;
  linked_spill?: LinkedSpillInfo;
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

export interface MetoceanData {
  wind_speed_kts: number;
  wind_direction_deg: number;
  current_speed_kts: number;
  current_direction_deg: number;
  sea_surface_temp_c: number;
  significant_wave_height_m: number;
  weathering_evaporation_pct: number;
  weathering_emulsification_pct: number;
  net_drift_speed_kts: number;
  net_drift_direction_deg: number;
  wind_cardinal: string;
  current_cardinal: string;
  sar_backscatter_quality: string;
  sea_state: string;
}
