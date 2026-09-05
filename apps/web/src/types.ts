export interface FalsePositiveBreakdown {
  likely_oil_pct: number; // e.g. 94.0
  lookalike_pct: number; // e.g. 6.0
  dominant_class: 'Oil' | 'Calm water' | 'Natural film' | 'Wake' | 'Rain-related artifact' | 'Unknown';
  classes: {
    'Oil': number; // e.g. 94.0%
    'Calm water': number; // e.g. 2.1%
    'Natural film': number; // e.g. 1.8%
    'Wake': number; // e.g. 1.2%
    'Rain-related artifact': number; // e.g. 0.6%
    'Unknown': number; // e.g. 0.3%
  };
  marangoni_damping_db: number;
  wind_threshold_valid: boolean;
  sar_physics_reasoning: string;
}

export interface SpillProperties {
  id: string;
  detection_timestamp: string;
  acquisition_timestamp_ist?: string; // e.g. "2024-10-18 16:14:00 IST"
  acquisition_timestamp_utc?: string; // e.g. "2024-10-18 10:44:00 UTC"
  area_sq_km: number;
  perimeter_km?: number;
  confidence_score: number; // Oil Likelihood Score
  segmentation_dice_score?: number; // e.g. 0.988 (98.8% ground truth overlap benchmark)
  oil_likelihood_score?: number; // e.g. 0.940 (94.0% vs lookalike)
  lookalike_score?: number;
  damping_ratio_db?: number; // e.g. 8.4 dB
  false_positive_analysis?: FalsePositiveBreakdown;
  source_scene?: string;
  status: 'ACTIVE' | 'CONTAINED' | 'DISPERSED';
  center: [number, number]; // [lon, lat]
  centroid?: [number, number]; // [lat, lon]
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
  segmentation_dice_score?: number;
  slick_type: string;
  distance_km: number;
}

export interface AnomalyBreakdown {
  composite_score: number; // Weighted Anomaly Score (0 - 100)
  weighted_anomaly_score?: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'LOW';
  speed_drop_score: number;
  speed_drop_delta_kts: number;
  speed_drop_details?: string;
  ais_gap_score: number;
  max_ais_gap_minutes: number;
  ais_gap_details?: string;
  loitering_score: number;
  loitering_details?: string;
  hindcast_cpa_score: number;
  hindcast_cpa_distance_m: number;
  hindcast_cpa_distance_km?: number;
  hindcast_details?: string;
  evidence_tags: string[];
}

export type MaritimeAssetCategory = 'fishing_zone' | 'fishing_harbour' | 'aquaculture' | 'coastal_community' | 'oil_spill';

export interface MaritimeSpatialAsset {
  id: string;
  name: string;
  category: MaritimeAssetCategory;
  subcategory: string;
  coordinates: [number, number] | number[][][]; // Point [lon, lat] or Polygon [[[lon, lat]...]]
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  distance_to_spill_km?: number;
  description: string;
  fleet_count?: number;
  population?: number;
  economic_annual_cr?: number;
  advisory_status: 'EVACUATE_BOOMS' | 'HIGH_ALERT' | 'STANDBY_TRAWLERS' | 'MONITORING';
}

export interface MapFocusTarget {
  coordinates: [number, number]; // [lon, lat]
  title?: string;
  category?: MaritimeAssetCategory | string;
  zoom?: number;
  description?: string;
  timestamp?: number;
}

export interface DashboardAlert {
  id: string;
  incident_id?: string;
  incident_offset_minutes?: number;
  timestamp_ist: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: MaritimeAssetCategory | 'vessel_violation' | 'sar_detection';
  title: string;
  message: string;
  coordinates?: [number, number]; // [lon, lat]
  action_type?: 'focus_map' | 'jump_scrubber' | 'view_suspect' | 'view_threat';
  action_value?: any;
  action_label?: string;
  acknowledged?: boolean;
}

export interface EnvironmentalThreat {
  coast_distance_km: number;
  growth_rate_pct_per_hour: number;
  fishing_zone_risk: 'HIGH' | 'MEDIUM' | 'LOW';
  fishing_zone_name: string;
  fishing_harbour_risk?: 'HIGH' | 'MEDIUM' | 'LOW';
  fishing_harbour_name?: string;
  aquaculture_risk?: 'HIGH' | 'MEDIUM' | 'LOW';
  aquaculture_name?: string;
  coastal_community_risk?: 'HIGH' | 'MEDIUM' | 'LOW';
  coastal_community_name?: string;
  marine_habitat_risk: 'HIGH' | 'MEDIUM' | 'LOW';
  marine_habitat_name: string;
  overall_severity_score: number; // 0 - 100
  overall_severity_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  predicted_arrival_hours: number;
  coastal_threat_risk: 'HIGH' | 'MEDIUM' | 'LOW';
  projected_impact_zone: string;
  active_advisories?: string[];
  // Dynamic geospatial calculation metrics
  fishing_fleet_count?: number;
  harbour_vessel_count?: number;
  aquaculture_economic_cr?: number;
  community_population?: number;
  fishing_zone_distance_km?: number;
  fishing_harbour_distance_km?: number;
  aquaculture_distance_km?: number;
  community_distance_km?: number;
  fishing_zone_coords?: [number, number];
  fishing_harbour_coords?: [number, number];
  aquaculture_coords?: [number, number];
  coastal_community_coords?: [number, number];
}

export interface HindcastPoint {
  time_offset_minutes: number;
  timestamp: string;
  longitude: number;
  latitude: number;
  distance_from_detected_km: number;
  estimated_slick_radius_m: number;
  hindcast_heading_deg: number;
  drift_speed_kts: number;
}

export interface HindcastData {
  spill_id: string;
  detection_timestamp: string;
  detection_center: [number, number];
  lookback_hours: number;
  sector: string;
  metocean?: MetoceanData;
  reverse_drift_vector?: [number, number];
  reverse_drift_heading_deg?: number;
  reverse_drift_speed_kts?: number;
  reconstructed_origin: {
    longitude: number;
    latitude: number;
    timestamp: string;
    distance_from_detected_km: number;
  };
  hindcast_track: HindcastPoint[];
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
  anomaly_score?: number; // Weighted Anomaly Score (0 - 100)
  anomaly_breakdown?: AnomalyBreakdown;
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
  probability_score: number; // Weighted Anomaly Score (0 - 100)
  weighted_anomaly_score?: number;
  anomaly_score?: number;
  anomaly_breakdown?: AnomalyBreakdown;
  evidence_tags?: string[];
  hindcast_distance_meters?: number;
  hindcast_distance_km?: number;
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
    segmentation_dice_score?: number;
    oil_likelihood_score?: number;
    lookalike_score?: number;
    damping_ratio_db?: number;
    class_probabilities?: Record<string, number>;
    false_positive_analysis?: FalsePositiveBreakdown;
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
  hindcast_direction_deg?: number;
  hindcast_vector?: [number, number];
  wind_cardinal: string;
  current_cardinal: string;
  sar_backscatter_quality: string;
  sea_state: string;
}
