/**
 * OceanGuard Ground-Truth Simulation & Hydrodynamic Drift Engine
 * Mumbai Maritime Corridor (Arabian Sea, Mumbai High, JNPT Port & Approaches)
 * Real-Time Multi-Incident Surveillance & Vessel Kinematic Correlation
 */
import {
  Vessel,
  SuspectVessel,
  SpillFeatureCollection,
  MetoceanData,
  LinkedSpillInfo,
  SpillGeoFeature,
  EnvironmentalThreat
} from '../types';

export interface TelemetryPacket {
  id: string;
  time_utc: string;
  mmsi: number;
  vessel: string;
  sog_knots: number;
  cog_degrees: number;
  nav_status: string;
  lat: number;
  lon: number;
  message_type: string;
}

export interface SimulationState {
  vessels: Vessel[];
  suspects: SuspectVessel[];
  spills: SpillFeatureCollection;
  metocean: MetoceanData;
  telemetryLogs: TelemetryPacket[];
  liveElapsedSeconds: number;
  activeSpillId: string;
}

// Calculate destination point given lat/lon, bearing (degrees), and distance (km)
export function moveCoordinate(lon: number, lat: number, headingDeg: number, distanceKm: number): [number, number] {
  const R = 6371.0;
  const dByR = distanceKm / R;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const deg = (radVal: number) => (radVal * 180) / Math.PI;

  const lat1 = rad(lat);
  const lon1 = rad(lon);
  const brng = rad(headingDeg);

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dByR) + Math.cos(lat1) * Math.sin(dByR) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dByR) * Math.cos(lat1), Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2));

  return [Number(deg(lon2).toFixed(6)), Number(deg(lat2).toFixed(6))];
}

// Generate smooth realistic elongated oil spill polygon
export function generateRealisticSpillPolygon(
  centerLon: number,
  centerLat: number,
  trackBearingDeg: number,
  lengthKm: number = 5.2,
  widthKm: number = 1.4
): number[][] {
  const points: number[][] = [];
  const steps = 36;

  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const localX = (lengthKm / 2) * Math.cos(theta) + 0.12 * Math.sin(3 * theta);
    const localY = (widthKm / 2) * Math.sin(theta) + 0.08 * Math.cos(4 * theta);

    const brngRad = ((trackBearingDeg - 90) * Math.PI) / 180;
    const rotX = localX * Math.cos(brngRad) - localY * Math.sin(brngRad);
    const rotY = localX * Math.sin(brngRad) + localY * Math.cos(brngRad);

    const [ptLon, ptLat] = moveCoordinate(
      centerLon,
      centerLat,
      Math.atan2(rotX, rotY) * (180 / Math.PI),
      Math.sqrt(rotX * rotX + rotY * rotY)
    );
    points.push([ptLon, ptLat]);
  }

  points.push(points[0]);
  return points;
}

// +6h Hydrodynamic Forecast Dispersal Fan Cone
export function generateForecastCone(
  baseCenterLon: number,
  baseCenterLat: number,
  driftBearingDeg: number,
  driftSpeedKts: number,
  hours: number = 6
): number[][] {
  const driftDistanceKm = (driftSpeedKts * 1.852) * hours;
  const [endLon, endLat] = moveCoordinate(baseCenterLon, baseCenterLat, driftBearingDeg, driftDistanceKm);
  const spreadWidthKm = 1.2 + (hours * 0.45);

  const leftBase = moveCoordinate(baseCenterLon, baseCenterLat, (driftBearingDeg - 90 + 360) % 360, 0.8);
  const rightBase = moveCoordinate(baseCenterLon, baseCenterLat, (driftBearingDeg + 90) % 360, 0.8);
  const rightHead = moveCoordinate(endLon, endLat, (driftBearingDeg + 65) % 360, spreadWidthKm);
  const frontHead = moveCoordinate(endLon, endLat, driftBearingDeg, spreadWidthKm * 0.7);
  const leftHead = moveCoordinate(endLon, endLat, (driftBearingDeg - 65 + 360) % 360, spreadWidthKm);

  return [leftBase, rightBase, rightHead, frontHead, leftHead, leftBase];
}

// -6h Hydrodynamic Hindcast (Back-Tracing) Dispersal Origin Cone
export function generateHindcastCone(
  baseCenterLon: number,
  baseCenterLat: number,
  driftBearingDeg: number,
  driftSpeedKts: number,
  hours: number = 6
): number[][] {
  const reverseBearing = (driftBearingDeg + 180) % 360;
  const driftDistanceKm = (driftSpeedKts * 1.852) * hours;
  const [originLon, originLat] = moveCoordinate(baseCenterLon, baseCenterLat, reverseBearing, driftDistanceKm);
  const spreadWidthKm = 0.6 + (hours * 0.25);

  const leftBase = moveCoordinate(baseCenterLon, baseCenterLat, (reverseBearing - 90 + 360) % 360, 0.6);
  const rightBase = moveCoordinate(baseCenterLon, baseCenterLat, (reverseBearing + 90) % 360, 0.6);
  const rightHead = moveCoordinate(originLon, originLat, (reverseBearing + 45) % 360, spreadWidthKm);
  const frontHead = moveCoordinate(originLon, originLat, reverseBearing, spreadWidthKm * 0.5);
  const leftHead = moveCoordinate(originLon, originLat, (reverseBearing - 45 + 360) % 360, spreadWidthKm);

  return [leftBase, rightBase, rightHead, frontHead, leftHead, leftBase];
}

// Generate step-by-step hindcast track points (-360 to 0)
export function generateHindcastTrack(
  baseCenterLon: number,
  baseCenterLat: number,
  driftBearingDeg: number,
  driftSpeedKts: number,
  hours: number = 6,
  steps: number = 6
): { timeOffsetMinutes: number; lon: number; lat: number; radiusMeters: number }[] {
  const reverseBearing = (driftBearingDeg + 180) % 360;
  const track = [];

  for (let i = 0; i <= steps; i++) {
    const hrsAgo = (i / steps) * hours;
    const minsAgo = Math.round(hrsAgo * 60);
    const distKm = (driftSpeedKts * 1.852) * hrsAgo;
    const [ptLon, ptLat] = moveCoordinate(baseCenterLon, baseCenterLat, reverseBearing, distKm);
    const contraction = Math.max(0.4, 1.0 - (hrsAgo / 6.0) * 0.55);

    track.push({
      timeOffsetMinutes: -minsAgo,
      lon: ptLon,
      lat: ptLat,
      radiusMeters: Math.round(1200 * contraction)
    });
  }

  return track;
}

export interface TimedWaypoint {
  tMinutes: number; // time offset in minutes (-360 to 0)
  lon: number;
  lat: number;
  heading: number;
  speed: number;
}

export interface TimelineKeyEvent {
  tMinutes: number; // time offset from live in minutes (-360 to 0)
  timestamp_utc: string; // e.g. "09:42 UTC"
  timestamp_ist: string; // e.g. "15:12 IST"
  action_headline: string; // e.g. "Vessel enters region", "Vessel slows", "Possible source corridor"
  label: string; // short badge, e.g. "Transit", "Deviation", "Breach", "SAR Pass", "Live"
  title: string; // full headline
  type: 'transit' | 'anomaly_onset' | 'breach' | 'sar_detection' | 'live';
  icon: string; // e.g. "⚓", "⚠️", "🚨", "🛰️", "🎯"
  speed: number;
  coordinates: [number, number];
  details: string; // tactical summary
}

// Mumbai Maritime Zone Active Incident Definitions
export interface MumbaiIncidentConfig {
  id: string;
  name: string;
  locationName: string;
  originCoords: [number, number]; // [lon, lat]
  centroid: [number, number]; // [lat, lon]
  acquisition_timestamp_utc: string; // e.g. "2024-10-18 10:44 UTC"
  dischargeOffsetMinutes: number;
  trackHeading: number;
  baseAreaSqKm: number;
  baseLengthKm: number;
  baseWidthKm: number;
  culpritMmsi: number;
  culpritName: string;
  volumeLiters: number;
  slickType: string;
  confidence: number; // Oil likelihood
  segmentation_dice_score: number; // Ground truth benchmark overlap
  oil_likelihood_score: number; // 94% vs Lookalike
  lookalike_score: number; // 6%
  false_positive_analysis: {
    likely_oil_pct: number;
    lookalike_pct: number;
    dominant_class: 'Oil' | 'Calm water' | 'Natural film' | 'Wake' | 'Rain-related artifact' | 'Unknown';
    classes: {
      'Oil': number;
      'Calm water': number;
      'Natural film': number;
      'Wake': number;
      'Rain-related artifact': number;
      'Unknown': number;
    };
    marangoni_damping_db: number;
    wind_threshold_valid: boolean;
    sar_physics_reasoning: string;
  };
  sourceScene: string;
  threat: EnvironmentalThreat;
  events: TimelineKeyEvent[];
}

export const MUMBAI_INCIDENTS: Record<string, MumbaiIncidentConfig> = {
  "INC-MUM-2024-01": {
    id: "INC-MUM-2024-01",
    name: "Mumbai High Sector Alpha",
    locationName: "Mumbai High Offshore (19° 02.9' N, 72° 08.7' E)",
    originCoords: [72.145, 19.048],
    centroid: [19.048, 72.145],
    acquisition_timestamp_utc: "2024-10-18 10:44:00 UTC",
    dischargeOffsetMinutes: -43,
    trackHeading: 325,
    baseAreaSqKm: 5.40,
    baseLengthKm: 4.8,
    baseWidthKm: 1.4,
    culpritMmsi: 419000123,
    culpritName: "MT DESH SHANTI",
    volumeLiters: 58000,
    slickType: "Heavy Crude Oil (Arabian Heavy)",
    confidence: 0.940,
    segmentation_dice_score: 0.988,
    oil_likelihood_score: 0.940,
    lookalike_score: 0.060,
    false_positive_analysis: {
      likely_oil_pct: 94.0,
      lookalike_pct: 6.0,
      dominant_class: "Oil",
      classes: {
        "Oil": 94.0,
        "Calm water": 2.1,
        "Natural film": 1.8,
        "Wake": 1.2,
        "Rain-related artifact": 0.6,
        "Unknown": 0.3,
      },
      marangoni_damping_db: 8.4,
      wind_threshold_valid: true,
      sar_physics_reasoning: "Wind speed 16.2 kts suppresses calm-water look-alikes (>3.0 m/s threshold). Strong Marangoni capillary wave damping ratio (8.4 dB) validates mineral crude oil slick.",
    },
    sourceScene: "S1A_IW_GRDH_1SDV_MUMBAI_HIGH_ALPHA",
    threat: {
      coast_distance_km: 42.0,
      growth_rate_pct_per_hour: 18.5,
      fishing_zone_risk: 'HIGH',
      fishing_zone_name: 'North Konkan Marine Fishery Zone',
      marine_habitat_risk: 'HIGH',
      marine_habitat_name: 'Pelagic Dolphin & Sea Turtle Corridor',
      overall_severity_score: 92,
      overall_severity_level: 'CRITICAL',
      predicted_arrival_hours: 11.5,
      coastal_threat_risk: 'HIGH',
      projected_impact_zone: 'South Mumbai & Alibaug Shoreline'
    },
    events: [
      {
        tMinutes: -78,
        timestamp_utc: "09:42 UTC",
        timestamp_ist: "15:12 IST",
        action_headline: "Vessel enters region",
        label: "Entry",
        title: "Vessel enters Mumbai High TSS Sector",
        type: "transit",
        icon: "⚓",
        speed: 14.8,
        coordinates: [72.260, 18.880],
        details: "Normal navigation at 14.8 kts along deep-water offshore international corridor.",
      },
      {
        tMinutes: -57,
        timestamp_utc: "10:03 UTC",
        timestamp_ist: "15:33 IST",
        action_headline: "Vessel slows",
        label: "Deceleration",
        title: "Sudden Speed Drop & AIS Blackout",
        type: "anomaly_onset",
        icon: "⚠️",
        speed: 5.2,
        coordinates: [72.180, 18.995],
        details: "Sudden deceleration from 14.8 to 5.2 kts (-9.6 kts drop). AIS transponder blackout initiates.",
      },
      {
        tMinutes: -43,
        timestamp_utc: "10:17 UTC",
        timestamp_ist: "15:47 IST",
        action_headline: "Possible source corridor",
        label: "BREACH",
        title: "Illicit Crude Discharge Locus",
        type: "breach",
        icon: "🚨",
        speed: 5.2,
        coordinates: [72.145, 19.048],
        details: "Estimated ~58,000 L crude discharge along hindcast trajectory corridor (0.00 km CPA).",
      },
      {
        tMinutes: -16,
        timestamp_utc: "10:44 UTC",
        timestamp_ist: "16:14 IST",
        action_headline: "SAR Satellite Acquisition",
        label: "SAR Pass",
        title: "Sentinel-1 C-Band SAR Acquisition",
        type: "sar_detection",
        icon: "🛰️",
        speed: 14.8,
        coordinates: [72.115, 19.090],
        details: "Satellite SAR radar backscatter depression detects 5.40 km² oil slick (Segmentation Dice: 98.8%).",
      },
      {
        tMinutes: 0,
        timestamp_utc: "11:00 UTC",
        timestamp_ist: "16:30 IST",
        action_headline: "Live Intercept Assessment",
        label: "Live Track",
        title: "Current Track & Coastal Threat",
        type: "live",
        icon: "🎯",
        speed: 14.8,
        coordinates: [72.100, 19.112],
        details: "Live tracking active. 42.0 km from coast with 11.5h projected landfall arrival at South Mumbai / Alibaug.",
      },
    ],
  },
  "INC-MUM-2024-02": {
    id: "INC-MUM-2024-02",
    name: "JNPT Access Channel",
    locationName: "JNPT Deep-Water Channel (18° 53.7' N, 72° 52.2' E)",
    originCoords: [72.870, 18.895],
    centroid: [18.895, 72.870],
    acquisition_timestamp_utc: "2024-10-18 10:48:00 UTC",
    dischargeOffsetMinutes: -30,
    trackHeading: 18,
    baseAreaSqKm: 2.85,
    baseLengthKm: 3.4,
    baseWidthKm: 1.1,
    culpritMmsi: 255806000,
    culpritName: "MSC KANOKO",
    volumeLiters: 31000,
    slickType: "Heavy Fuel Oil (HFO-380 Bilge Sludge)",
    confidence: 0.925,
    segmentation_dice_score: 0.974,
    oil_likelihood_score: 0.925,
    lookalike_score: 0.075,
    false_positive_analysis: {
      likely_oil_pct: 92.5,
      lookalike_pct: 7.5,
      dominant_class: "Oil",
      classes: {
        "Oil": 92.5,
        "Calm water": 1.5,
        "Natural film": 2.2,
        "Wake": 3.0,
        "Rain-related artifact": 0.5,
        "Unknown": 0.3,
      },
      marangoni_damping_db: 7.9,
      wind_threshold_valid: true,
      sar_physics_reasoning: "Channel approach wind 16.2 kts suppresses calm patches. High damping signature in narrow fairway confirms heavy bunker sludge.",
    },
    sourceScene: "S1A_IW_GRDH_1SDV_JNPT_CHANNEL",
    threat: {
      coast_distance_km: 6.5,
      growth_rate_pct_per_hour: 22.4,
      fishing_zone_risk: 'HIGH',
      fishing_zone_name: 'Uran & Karanja Artisanal Fisheries',
      marine_habitat_risk: 'HIGH',
      marine_habitat_name: 'Elephanta Sanctuary & Mangrove Estuaries',
      overall_severity_score: 86,
      overall_severity_level: 'HIGH',
      predicted_arrival_hours: 2.2,
      coastal_threat_risk: 'HIGH',
      projected_impact_zone: 'JNPT Port & Elephanta Islands'
    },
    events: [
      {
        tMinutes: -60,
        timestamp_utc: "10:00 UTC",
        timestamp_ist: "15:30 IST",
        action_headline: "Vessel enters region",
        label: "Entry",
        title: "Inbound Transit South Channel Approach",
        type: "transit",
        icon: "⚓",
        speed: 16.5,
        coordinates: [72.818, 18.735],
        details: "Container carrier inbound at cruising speed 16.5 kts.",
      },
      {
        tMinutes: -40,
        timestamp_utc: "10:20 UTC",
        timestamp_ist: "15:50 IST",
        action_headline: "Vessel slows",
        label: "Deceleration",
        title: "Approaching Dredged Harbor Fairway",
        type: "anomaly_onset",
        icon: "⚠️",
        speed: 6.8,
        coordinates: [72.844, 18.815],
        details: "Speed reduction from 16.5 to 6.8 kts entering pilot rendezvous corridor.",
      },
      {
        tMinutes: -30,
        timestamp_utc: "10:30 UTC",
        timestamp_ist: "16:00 IST",
        action_headline: "Possible source corridor",
        label: "BREACH",
        title: "Nighttime Bilge Washings Discharge",
        type: "breach",
        icon: "🚨",
        speed: 6.8,
        coordinates: [72.870, 18.895],
        details: "Illicit discharge of ~31,000 L HFO bilge washings along JNPT deep channel.",
      },
      {
        tMinutes: -12,
        timestamp_utc: "10:48 UTC",
        timestamp_ist: "16:18 IST",
        action_headline: "SAR Satellite Acquisition",
        label: "SAR Pass",
        title: "Sentinel-1 SAR Synthetic Aperture Match",
        type: "sar_detection",
        icon: "🛰️",
        speed: 15.6,
        coordinates: [72.885, 18.940],
        details: "SAR radar image confirms 2.85 km² dark slick in dredged navigation fairway.",
      },
      {
        tMinutes: 0,
        timestamp_utc: "11:00 UTC",
        timestamp_ist: "16:30 IST",
        action_headline: "Live Intercept Assessment",
        label: "Live Track",
        title: "Current Channel Position (Nhava Sheva)",
        type: "live",
        icon: "🎯",
        speed: 15.6,
        coordinates: [72.896, 18.975],
        details: "Target heading 018° at 15.6 kts towards JNPT berths. Threat arrival in 2.2h.",
      },
    ],
  },
  "INC-MUM-2024-03": {
    id: "INC-MUM-2024-03",
    name: "Prongs Reef Anchorage",
    locationName: "Mumbai Outer Anchorage (18° 54.3' N, 72° 47.7' E)",
    originCoords: [72.795, 18.905],
    centroid: [18.905, 72.795],
    acquisition_timestamp_utc: "2024-10-18 10:50:00 UTC",
    dischargeOffsetMinutes: -25,
    trackHeading: 72,
    baseAreaSqKm: 1.95,
    baseLengthKm: 2.8,
    baseWidthKm: 0.9,
    culpritMmsi: 419000789,
    culpritName: "MT SWARNA SINDHU",
    volumeLiters: 19000,
    slickType: "Intermediate Fuel Oil (IFO-180)",
    confidence: 0.935,
    segmentation_dice_score: 0.968,
    oil_likelihood_score: 0.935,
    lookalike_score: 0.065,
    false_positive_analysis: {
      likely_oil_pct: 93.5,
      lookalike_pct: 6.5,
      dominant_class: "Oil",
      classes: {
        "Oil": 93.5,
        "Calm water": 2.0,
        "Natural film": 2.5,
        "Wake": 1.2,
        "Rain-related artifact": 0.5,
        "Unknown": 0.3,
      },
      marangoni_damping_db: 8.1,
      wind_threshold_valid: true,
      sar_physics_reasoning: "Anchorage area verified. Damping ratio of 8.1 dB and high aspect ratio rule out natural algal surfactant films.",
    },
    sourceScene: "S1A_IW_GRDH_1SDV_PRONGS_REEF",
    threat: {
      coast_distance_km: 4.2,
      growth_rate_pct_per_hour: 14.8,
      fishing_zone_risk: 'HIGH',
      fishing_zone_name: 'Sassoon Docks Artisanal Fishery',
      marine_habitat_risk: 'HIGH',
      marine_habitat_name: 'Prongs Reef Intertidal Coral Bed',
      overall_severity_score: 84,
      overall_severity_level: 'HIGH',
      predicted_arrival_hours: 1.2,
      coastal_threat_risk: 'HIGH',
      projected_impact_zone: 'Colaba Point & Marine Drive Foreshore'
    },
    events: [
      {
        tMinutes: -55,
        timestamp_utc: "10:05 UTC",
        timestamp_ist: "15:35 IST",
        action_headline: "Vessel enters region",
        label: "Entry",
        title: "Western Coastal Outer Limits Approach",
        type: "transit",
        icon: "⚓",
        speed: 12.0,
        coordinates: [72.643, 18.855],
        details: "Product tanker approaching Mumbai harbor outer limits at 12.0 kts.",
      },
      {
        tMinutes: -35,
        timestamp_utc: "10:25 UTC",
        timestamp_ist: "15:55 IST",
        action_headline: "Vessel slows",
        label: "Deceleration",
        title: "Outer Anchorage Loitering & Alignment",
        type: "anomaly_onset",
        icon: "⚠️",
        speed: 4.5,
        coordinates: [72.719, 18.880],
        details: "Deceleration to 4.5 kts. Loitering maneuver during unlogged bunkering transfer.",
      },
      {
        tMinutes: -25,
        timestamp_utc: "10:35 UTC",
        timestamp_ist: "16:05 IST",
        action_headline: "Possible source corridor",
        label: "BREACH",
        title: "Bunkering Transfer Overflow Release",
        type: "breach",
        icon: "🚨",
        speed: 4.5,
        coordinates: [72.795, 18.905],
        details: "Unreported ~19,000 L IFO-180 fuel oil discharge during anchorage transfer.",
      },
      {
        tMinutes: -10,
        timestamp_utc: "10:50 UTC",
        timestamp_ist: "16:20 IST",
        action_headline: "SAR Satellite Acquisition",
        label: "SAR Pass",
        title: "Sentinel-1 SAR Detection at Reef Zone",
        type: "sar_detection",
        icon: "🛰️",
        speed: 11.2,
        coordinates: [72.830, 18.918],
        details: "SAR radar identifies 1.95 km² slick drifting 69.3° towards Colaba Point.",
      },
      {
        tMinutes: 0,
        timestamp_utc: "11:00 UTC",
        timestamp_ist: "16:30 IST",
        action_headline: "Live Intercept Assessment",
        label: "Live Track",
        title: "Current Inbound Position (Refinery Channel)",
        type: "live",
        icon: "🎯",
        speed: 11.2,
        coordinates: [72.871, 18.930],
        details: "Target transiting at 11.2 kts. Projected coral reef impact within 1.2 hours.",
      },
    ],
  },
  "INC-MUM-2024-04": {
    id: "INC-MUM-2024-04",
    name: "Neelam South Offshore",
    locationName: "Neelam Offshore Field (19° 14.7' N, 71° 59.1' E)",
    originCoords: [71.985, 19.245],
    centroid: [19.245, 71.985],
    acquisition_timestamp_utc: "2024-10-18 10:52:00 UTC",
    dischargeOffsetMinutes: -20,
    trackHeading: 155,
    baseAreaSqKm: 3.60,
    baseLengthKm: 3.8,
    baseWidthKm: 1.2,
    culpritMmsi: 563032000,
    culpritName: "CHEMBULK GIBRALTAR",
    volumeLiters: 42000,
    slickType: "Condensate & Light Crude Sheen",
    confidence: 0.915,
    segmentation_dice_score: 0.958,
    oil_likelihood_score: 0.915,
    lookalike_score: 0.085,
    false_positive_analysis: {
      likely_oil_pct: 91.5,
      lookalike_pct: 8.5,
      dominant_class: "Oil",
      classes: {
        "Oil": 91.5,
        "Calm water": 2.8,
        "Natural film": 3.1,
        "Wake": 1.5,
        "Rain-related artifact": 0.8,
        "Unknown": 0.3,
      },
      marangoni_damping_db: 7.6,
      wind_threshold_valid: true,
      sar_physics_reasoning: "Chemical condensate sheen validated against biogenic slicks via multi-polarization damping characteristics.",
    },
    sourceScene: "S1A_IW_GRDH_1SDV_NEELAM_SOUTH",
    threat: {
      coast_distance_km: 38.0,
      growth_rate_pct_per_hour: 16.0,
      fishing_zone_risk: 'MEDIUM',
      fishing_zone_name: 'Offshore Commercial Trawl Fairway',
      marine_habitat_risk: 'MEDIUM',
      marine_habitat_name: 'Benthic Deepwater Reefs',
      overall_severity_score: 78,
      overall_severity_level: 'MEDIUM',
      predicted_arrival_hours: 10.4,
      coastal_threat_risk: 'MEDIUM',
      projected_impact_zone: 'Vasai & Manori Coastal Corridor'
    },
    events: [
      {
        tMinutes: -60,
        timestamp_utc: "10:00 UTC",
        timestamp_ist: "15:30 IST",
        action_headline: "Vessel enters region",
        label: "Entry",
        title: "Southbound Chemical Tanker TSS Transit",
        type: "transit",
        icon: "⚓",
        speed: 13.4,
        coordinates: [71.915, 19.395],
        details: "Chemical tanker cruising at 13.4 kts along offshore international corridor.",
      },
      {
        tMinutes: -30,
        timestamp_utc: "10:30 UTC",
        timestamp_ist: "16:00 IST",
        action_headline: "Vessel slows",
        label: "Deceleration",
        title: "Neelam Platform Cluster Course Adjustment",
        type: "anomaly_onset",
        icon: "⚠️",
        speed: 5.8,
        coordinates: [71.950, 19.320],
        details: "Course deflection and speed drop to 5.8 kts near Neelam drilling complex.",
      },
      {
        tMinutes: -20,
        timestamp_utc: "10:40 UTC",
        timestamp_ist: "16:10 IST",
        action_headline: "Possible source corridor",
        label: "BREACH",
        title: "Tank Washings Illicit Discharge",
        type: "breach",
        icon: "🚨",
        speed: 5.8,
        coordinates: [71.985, 19.245],
        details: "Illicit discharge of ~42,000 L chemical condensate & tank washings.",
      },
      {
        tMinutes: -8,
        timestamp_utc: "10:52 UTC",
        timestamp_ist: "16:22 IST",
        action_headline: "SAR Satellite Acquisition",
        label: "SAR Pass",
        title: "SAR Multi-Polarimetric Anomaly Confirmed",
        type: "sar_detection",
        icon: "🛰️",
        speed: 12.8,
        coordinates: [72.000, 19.210],
        details: "Sentinel-1 SAR validates 3.60 km² high-contrast surface slick.",
      },
      {
        tMinutes: 0,
        timestamp_utc: "11:00 UTC",
        timestamp_ist: "16:30 IST",
        action_headline: "Live Intercept Assessment",
        label: "Live Track",
        title: "Current Southbound Position",
        type: "live",
        icon: "🎯",
        speed: 12.8,
        coordinates: [72.020, 19.170],
        details: "Target continuing SSE 155° at 12.8 kts. Projected 10.4h coastal arrival.",
      },
    ],
  }
};

export const MMSI_TO_INCIDENT: Record<number, string> = {
  419000123: "INC-MUM-2024-01",
  255806000: "INC-MUM-2024-02",
  419000789: "INC-MUM-2024-03",
  563032000: "INC-MUM-2024-04",
  419000456: "INC-MUM-2024-01",
  419000999: "INC-MUM-2024-01",
};

// Deterministic Timed Waypoint Tracks for Mumbai Maritime Fleet
export const MUMBAI_VESSEL_WAYPOINTS: { mmsi: number; name: string; isCulprit?: boolean; linkedSpillId?: string; waypoints: TimedWaypoint[] }[] = [
  // 1. MT DESH SHANTI (VLCC Crude Tanker - Transits NNW 325° from Mumbai High towards Gujarat)
  {
    mmsi: 419000123,
    name: "MT DESH SHANTI",
    isCulprit: true,
    linkedSpillId: "INC-MUM-2024-01",
    waypoints: [
      { tMinutes: -360, lon: 72.260, lat: 18.880, heading: 325, speed: 14.8 },
      { tMinutes: -180, lon: 72.202, lat: 18.964, heading: 325, speed: 14.8 },
      { tMinutes: -42,  lon: 72.145, lat: 19.048, heading: 325, speed: 5.2 }, // Spill 1 Discharge Point
      { tMinutes: 0,    lon: 72.100, lat: 19.112, heading: 325, speed: 14.8 },
      { tMinutes: 180,  lon: 72.042, lat: 19.196, heading: 325, speed: 14.8 },
    ],
  },
  // 2. MSC KANOKO (Container Ship - Inbound JNPT Harbor Channel NNE 018°)
  {
    mmsi: 255806000,
    name: "MSC KANOKO",
    isCulprit: true,
    linkedSpillId: "INC-MUM-2024-02",
    waypoints: [
      { tMinutes: -360, lon: 72.818, lat: 18.735, heading: 18, speed: 16.5 },
      { tMinutes: -180, lon: 72.844, lat: 18.815, heading: 18, speed: 16.5 },
      { tMinutes: -30,  lon: 72.870, lat: 18.895, heading: 18, speed: 6.8 }, // Spill 2 Discharge Point (Channel)
      { tMinutes: 0,    lon: 72.896, lat: 18.975, heading: 18, speed: 15.6 },
      { tMinutes: 180,  lon: 72.922, lat: 19.055, heading: 18, speed: 12.0 },
    ],
  },
  // 3. MT SWARNA SINDHU (Product Tanker - Inbound Mumbai Outer Anchorage ENE 072°)
  {
    mmsi: 419000789,
    name: "MT SWARNA SINDHU",
    isCulprit: true,
    linkedSpillId: "INC-MUM-2024-03",
    waypoints: [
      { tMinutes: -360, lon: 72.643, lat: 18.855, heading: 72, speed: 12.0 },
      { tMinutes: -180, lon: 72.719, lat: 18.880, heading: 72, speed: 12.0 },
      { tMinutes: -25,  lon: 72.795, lat: 18.905, heading: 72, speed: 4.5 }, // Spill 3 Discharge Point (Anchorage)
      { tMinutes: 0,    lon: 72.871, lat: 18.930, heading: 72, speed: 11.2 },
      { tMinutes: 180,  lon: 72.947, lat: 18.955, heading: 72, speed: 10.0 },
    ],
  },
  // 4. CHEMBULK GIBRALTAR (Chemical Tanker - Passing Neelam Offshore SSE 155°)
  {
    mmsi: 563032000,
    name: "CHEMBULK GIBRALTAR",
    isCulprit: true,
    linkedSpillId: "INC-MUM-2024-04",
    waypoints: [
      { tMinutes: -360, lon: 71.915, lat: 19.395, heading: 155, speed: 13.4 },
      { tMinutes: -180, lon: 71.950, lat: 19.320, heading: 155, speed: 13.4 },
      { tMinutes: -20,  lon: 71.985, lat: 19.245, heading: 155, speed: 5.8 }, // Spill 4 Discharge Point
      { tMinutes: 0,    lon: 72.020, lat: 19.170, heading: 155, speed: 12.8 },
      { tMinutes: 180,  lon: 72.055, lat: 19.095, heading: 155, speed: 12.8 },
    ],
  },
  // 5. MT JAG LOK (Crude Oil Tanker - Transiting WSW 245°)
  {
    mmsi: 419000456,
    name: "MT JAG LOK",
    waypoints: [
      { tMinutes: -360, lon: 72.450, lat: 19.100, heading: 245, speed: 12.4 },
      { tMinutes: -180, lon: 72.360, lat: 19.060, heading: 245, speed: 12.4 },
      { tMinutes: 0,    lon: 72.270, lat: 19.020, heading: 245, speed: 12.4 },
      { tMinutes: 180,  lon: 72.180, lat: 18.980, heading: 245, speed: 12.4 },
    ],
  },
  // 6. ICGS SAMUDRA PRAHARI (Coast Guard Pollution Control Intercept Patrol NW 310°)
  {
    mmsi: 419000999,
    name: "ICGS SAMUDRA PRAHARI",
    waypoints: [
      { tMinutes: -360, lon: 72.420, lat: 18.900, heading: 310, speed: 18.5 },
      { tMinutes: -180, lon: 72.300, lat: 18.980, heading: 310, speed: 18.5 },
      { tMinutes: 0,    lon: 72.180, lat: 19.060, heading: 310, speed: 18.5 },
      { tMinutes: 180,  lon: 72.060, lat: 19.140, heading: 310, speed: 18.5 },
    ],
  },
];

// Precise piece-wise waypoint kinematic interpolation
export function interpolateVesselPosition(
  mmsi: number,
  timeOffsetMinutes: number,
  _scenario: string = 'mumbai',
  vesselCurrentPos?: { longitude: number; latitude: number; heading_degrees: number; speed_knots: number }
): { lon: number; lat: number; heading: number; speed: number } {
  const vesselTrack = MUMBAI_VESSEL_WAYPOINTS.find((t) => t.mmsi === mmsi);

  if (vesselTrack && vesselTrack.waypoints.length) {
    const wps = vesselTrack.waypoints;

    if (timeOffsetMinutes <= wps[0].tMinutes) {
      return { lon: wps[0].lon, lat: wps[0].lat, heading: wps[0].heading, speed: wps[0].speed };
    }
    if (timeOffsetMinutes >= wps[wps.length - 1].tMinutes) {
      const last = wps[wps.length - 1];
      return { lon: last.lon, lat: last.lat, heading: last.heading, speed: last.speed };
    }

    for (let i = 0; i < wps.length - 1; i++) {
      const w1 = wps[i];
      const w2 = wps[i + 1];
      if (timeOffsetMinutes >= w1.tMinutes && timeOffsetMinutes <= w2.tMinutes) {
        const segSpan = w2.tMinutes - w1.tMinutes;
        const progress = segSpan === 0 ? 0 : (timeOffsetMinutes - w1.tMinutes) / segSpan;

        const lon = w1.lon + (w2.lon - w1.lon) * progress;
        const lat = w1.lat + (w2.lat - w1.lat) * progress;
        const heading = w1.heading;
        const speed = w1.speed;

        return {
          lon: Number(lon.toFixed(6)),
          lat: Number(lat.toFixed(6)),
          heading,
          speed,
        };
      }
    }
  }

  // Smooth fallback: kinematic dead reckoning
  const curLon = vesselCurrentPos?.longitude ?? 72.150;
  const curLat = vesselCurrentPos?.latitude ?? 19.050;
  const curHeading = vesselCurrentPos?.heading_degrees ?? 52;
  const curSpeed = vesselCurrentPos?.speed_knots ?? 14.0;

  const reverseHeading = (curHeading + 180) % 360;
  const elapsedHours = Math.abs(timeOffsetMinutes) / 60.0;
  const distanceKm = (curSpeed * 1.852) * elapsedHours;
  const [lon, lat] = moveCoordinate(curLon, curLat, reverseHeading, distanceKm);

  return { lon, lat, heading: curHeading, speed: curSpeed };
}

// Calculate oil slick center and polygon for any Mumbai spill at any timeline offset
export function calculateSynchronizedOilSpill(
  timeOffsetMinutes: number, // -360 to 0 (and live +)
  spillId: string = "INC-MUM-2024-01",
  metocean?: MetoceanData
): { center: [number, number]; polygon: number[][]; area: number; perimeter: number; isNascent: boolean; hasDischarged: boolean } {
  const config = MUMBAI_INCIDENTS[spillId] || MUMBAI_INCIDENTS["INC-MUM-2024-01"];
  const dischargeOffset = config.dischargeOffsetMinutes;
  const baseOrigin: [number, number] = config.originCoords;
  const trackHeading = config.trackHeading;

  const driftSpeedKts = metocean?.net_drift_speed_kts || 1.95;
  const driftDir = metocean?.net_drift_direction_deg || 69.3;

  // If before discharge: spill has not happened yet
  if (timeOffsetMinutes < dischargeOffset) {
    return {
      center: baseOrigin,
      polygon: [],
      area: 0.0,
      perimeter: 0.0,
      isNascent: true,
      hasDischarged: false,
    };
  }

  // Time elapsed since oil was discharged (in hours)
  const elapsedSinceDischargeHours = (timeOffsetMinutes - dischargeOffset) / 60.0;
  const driftDistanceKm = (driftSpeedKts * 1.852) * elapsedSinceDischargeHours;

  const [currentCenterLon, currentCenterLat] = moveCoordinate(
    baseOrigin[0],
    baseOrigin[1],
    driftDir,
    driftDistanceKm
  );

  // Fay expansion: slick grows as it ages
  const lengthKm = Math.min(config.baseLengthKm * 1.4, config.baseLengthKm * 0.7 + elapsedSinceDischargeHours * 1.5);
  const widthKm = Math.min(config.baseWidthKm * 1.5, config.baseWidthKm * 0.6 + elapsedSinceDischargeHours * 0.6);
  const poly = generateRealisticSpillPolygon(currentCenterLon, currentCenterLat, trackHeading, lengthKm, widthKm);

  const area = Number((lengthKm * widthKm * 0.78).toFixed(2));
  const perimeter = Number(((lengthKm + widthKm) * 2.1).toFixed(1));

  return {
    center: [currentCenterLon, currentCenterLat],
    polygon: poly,
    area,
    perimeter,
    isNascent: elapsedSinceDischargeHours < 0.1,
    hasDischarged: true,
  };
}

// Compute live Environmental Threat and Coastal Impact metrics
export function calculateEnvironmentalThreat(
  spillId: string = "INC-MUM-2024-01",
  timeOffsetMinutes: number = 0,
  metocean?: MetoceanData
): EnvironmentalThreat {
  const config = MUMBAI_INCIDENTS[spillId] || MUMBAI_INCIDENTS["INC-MUM-2024-01"];
  const baseThreat = config.threat;
  const driftSpeedKts = metocean?.net_drift_speed_kts || 1.95;
  const driftSpeedKmH = driftSpeedKts * 1.852;

  // Real-time dynamic drift towards coastline
  const elapsedSinceDischarge = Math.max(0, (timeOffsetMinutes - config.dischargeOffsetMinutes) / 60.0);
  const driftedDistanceKm = driftSpeedKmH * elapsedSinceDischarge;
  const currentCoastDistance = Math.max(0.5, Number((baseThreat.coast_distance_km - (driftedDistanceKm * 0.4)).toFixed(1)));
  const predictedArrival = Math.max(0.2, Number((currentCoastDistance / Math.max(0.5, driftSpeedKmH)).toFixed(1)));

  return {
    ...baseThreat,
    coast_distance_km: currentCoastDistance,
    predicted_arrival_hours: predictedArrival,
  };
}

export class AutonomousSimulationEngine {
  private listeners: ((state: SimulationState) => void)[] = [];
  private state: SimulationState;
  private activeSpillId: string = "INC-MUM-2024-01";

  constructor() {
    this.state = this.buildInitialState("INC-MUM-2024-01");
  }

  public buildInitialState(selectedSpillId: string = "INC-MUM-2024-01"): SimulationState {
    this.activeSpillId = selectedSpillId;
    const now = new Date();

    const metocean: MetoceanData = {
      wind_speed_kts: 16.2,
      wind_direction_deg: 245.0,
      current_speed_kts: 1.4,
      current_direction_deg: 65.0,
      sea_surface_temp_c: 28.4,
      significant_wave_height_m: 1.8,
      weathering_evaporation_pct: 22.5,
      weathering_emulsification_pct: 34.0,
      net_drift_speed_kts: 1.95,
      net_drift_direction_deg: 69.3,
      hindcast_direction_deg: 249.3,
      hindcast_vector: [-1.82, -0.69],
      wind_cardinal: "WSW",
      current_cardinal: "ENE",
      sar_backscatter_quality: "OPTIMAL (High Radar Contrast)",
      sea_state: "Slight to Moderate (Beaufort 4)",
    };

    // Build all 4 live spills
    const spillFeatures: SpillGeoFeature[] = Object.values(MUMBAI_INCIDENTS).map((config) => {
      const live = calculateSynchronizedOilSpill(0, config.id, metocean);
      return {
        type: "Feature",
        id: config.id,
        properties: {
          id: config.id,
          detection_timestamp: new Date(now.getTime() - Math.abs(config.dischargeOffsetMinutes) * 60000).toISOString(),
          acquisition_timestamp_utc: config.acquisition_timestamp_utc,
          area_sq_km: live.area,
          perimeter_km: live.perimeter,
          confidence_score: config.confidence,
          segmentation_dice_score: config.segmentation_dice_score,
          oil_likelihood_score: config.oil_likelihood_score,
          false_positive_analysis: config.false_positive_analysis,
          source_scene: config.sourceScene,
          status: "ACTIVE",
          center: live.center,
          centroid: config.centroid,
          estimated_discharge_liters: config.volumeLiters,
          slick_type: config.slickType,
        },
        geometry: {
          type: "Polygon",
          coordinates: [live.polygon],
        },
      };
    });

    // Vessel Anomaly Profiles
    const deshShantiAnomaly = {
      composite_score: 98.4,
      risk_level: 'CRITICAL' as const,
      speed_drop_score: 96.0,
      speed_drop_delta_kts: 9.6,
      speed_drop_details: 'Sudden deceleration from 14.8 to 5.2 kts during transit',
      ais_gap_score: 92.0,
      max_ais_gap_minutes: 42.0,
      ais_gap_details: '42 min transponder blackout directly over discharge origin',
      loitering_score: 74.0,
      loitering_details: 'Slow-speed maneuvering and course deflection during dump',
      hindcast_cpa_score: 100.0,
      hindcast_cpa_distance_m: 0.0,
      hindcast_cpa_distance_km: 0.0,
      hindcast_details: 'Direct spatial intercept with hindcast discharge origin at T-42m',
      evidence_tags: [
        'Direct Hindcast Origin Match (0.00 km CPA)',
        'Sudden Speed Drop (-9.6 kts)',
        'AIS Signal Blackout (42 min)',
        'High-Risk Cargo (Crude Oil 280,000 DWT)'
      ]
    };

    const mscAnomaly = {
      composite_score: 94.8,
      risk_level: 'CRITICAL' as const,
      speed_drop_score: 88.0,
      speed_drop_delta_kts: 10.4,
      speed_drop_details: 'Speed drop from 17.2 to 6.8 kts entering JNPT approach',
      ais_gap_score: 84.0,
      max_ais_gap_minutes: 30.0,
      ais_gap_details: '30 min blackout during nighttime approach',
      loitering_score: 65.0,
      hindcast_cpa_score: 98.0,
      hindcast_cpa_distance_m: 0.0,
      hindcast_cpa_distance_km: 0.0,
      hindcast_details: 'Direct intercept with JNPT channel bilge flush locus at T-30m',
      evidence_tags: [
        'Direct JNPT Channel Intercept (0.00 km CPA)',
        'Nighttime Bilge Washings Indicator',
        'Speed Drop (-10.4 kts)'
      ]
    };

    const swarnaAnomaly = {
      composite_score: 91.2,
      risk_level: 'HIGH' as const,
      speed_drop_score: 82.0,
      speed_drop_delta_kts: 8.0,
      speed_drop_details: 'Sudden deceleration to 4.5 kts near Prongs Reef',
      ais_gap_score: 78.0,
      max_ais_gap_minutes: 25.0,
      loitering_score: 85.0,
      hindcast_cpa_score: 95.0,
      hindcast_cpa_distance_m: 0.0,
      hindcast_cpa_distance_km: 0.0,
      evidence_tags: [
        'Anchorage Bunker Transfer Breach',
        'Direct Hindcast Match (0.00 km CPA)',
        'Loitering Anomaly'
      ]
    };

    const chemAnomaly = {
      composite_score: 89.6,
      risk_level: 'HIGH' as const,
      speed_drop_score: 79.0,
      speed_drop_delta_kts: 7.6,
      speed_drop_details: 'Course deflection and speed drop near Neelam Offshore',
      ais_gap_score: 72.0,
      max_ais_gap_minutes: 20.0,
      loitering_score: 70.0,
      hindcast_cpa_score: 92.0,
      hindcast_cpa_distance_m: 0.0,
      hindcast_cpa_distance_km: 0.0,
      evidence_tags: [
        'Offshore Platform Sector Breach',
        'Condensate Sheen Intercept'
      ]
    };

    const vessels: Vessel[] = [
      {
        mmsi: 419000123,
        imo_number: 9272840,
        name: "MT DESH SHANTI",
        flag: "India (SCI)",
        vessel_type: "VLCC Crude Carrier",
        length_meters: 333,
        draught_meters: 16.8,
        call_sign: "VTDS",
        destination: "SIKKA REFINERY TERMINAL",
        nav_status: "Under way using engine",
        cargo_type: "Crude Oil (280,000 DWT)",
        anomaly_score: 98.4,
        anomaly_breakdown: deshShantiAnomaly,
        current_position: {
          latitude: 19.112,
          longitude: 72.100,
          speed_knots: 14.8,
          heading_degrees: 325,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
      {
        mmsi: 255806000,
        imo_number: 9842061,
        name: "MSC KANOKO",
        flag: "Liberia",
        vessel_type: "Container Ship",
        length_meters: 366,
        draught_meters: 14.5,
        call_sign: "CQES",
        destination: "JNPT PORT MUMBAI",
        nav_status: "Under way using engine",
        cargo_type: "Containers (14,000 TEU)",
        anomaly_score: 94.8,
        anomaly_breakdown: mscAnomaly,
        current_position: {
          latitude: 18.975,
          longitude: 72.896,
          speed_knots: 15.6,
          heading_degrees: 18,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
      {
        mmsi: 419000789,
        imo_number: 9324567,
        name: "MT SWARNA SINDHU",
        flag: "India (SCI)",
        vessel_type: "Product Tanker",
        length_meters: 228,
        draught_meters: 12.0,
        call_sign: "AWXZ",
        destination: "MUMBAI REFINERY BERTH",
        nav_status: "Under way using engine",
        cargo_type: "Refined Petroleum",
        anomaly_score: 91.2,
        anomaly_breakdown: swarnaAnomaly,
        current_position: {
          latitude: 18.930,
          longitude: 72.871,
          speed_knots: 11.2,
          heading_degrees: 72,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
      {
        mmsi: 563032000,
        imo_number: 9418290,
        name: "CHEMBULK GIBRALTAR",
        flag: "Singapore",
        vessel_type: "Chemical Tanker",
        length_meters: 175,
        draught_meters: 9.8,
        call_sign: "9V2941",
        destination: "MUMBAI CHEMICAL TERMINAL",
        nav_status: "Under way using engine",
        cargo_type: "Liquid Chemicals",
        anomaly_score: 89.6,
        anomaly_breakdown: chemAnomaly,
        current_position: {
          latitude: 19.170,
          longitude: 72.020,
          speed_knots: 12.8,
          heading_degrees: 155,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
      {
        mmsi: 419000456,
        imo_number: 9308144,
        name: "MT JAG LOK",
        flag: "India (GE Shipping)",
        vessel_type: "Crude Oil Tanker",
        length_meters: 244,
        draught_meters: 11.2,
        call_sign: "AVJL",
        destination: "SIKKA JAMNAGAR",
        nav_status: "Under way using engine",
        cargo_type: "Crude Oil",
        anomaly_score: 8.2,
        current_position: {
          latitude: 19.020,
          longitude: 72.270,
          speed_knots: 12.4,
          heading_degrees: 245,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
      {
        mmsi: 419000999,
        imo_number: 9594004,
        name: "ICGS SAMUDRA PRAHARI",
        flag: "India (Coast Guard)",
        vessel_type: "Pollution Control Vessel",
        length_meters: 95,
        draught_meters: 4.5,
        call_sign: "AWAH",
        destination: "POLLUTION RESPONSE SECTOR",
        nav_status: "Engaged in response ops",
        cargo_type: "Containment Booms & Skimmers",
        anomaly_score: 0.0,
        current_position: {
          latitude: 19.060,
          longitude: 72.180,
          speed_knots: 18.5,
          heading_degrees: 310,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
    ];

    const suspects: SuspectVessel[] = [
      {
        mmsi: 419000123,
        imo_number: 9272840,
        name: "MT DESH SHANTI",
        flag: "India (SCI)",
        vessel_type: "VLCC Crude Carrier",
        length_meters: 333,
        draught_meters: 16.8,
        call_sign: "VTDS",
        destination: "SIKKA REFINERY TERMINAL",
        distance_meters: 0.0,
        distance_km: 0.0,
        probability_score: 98.4,
        anomaly_score: 98.4,
        anomaly_breakdown: deshShantiAnomaly,
        evidence_tags: deshShantiAnomaly.evidence_tags,
        hindcast_distance_meters: 0.0,
        hindcast_distance_km: 0.0,
        speed_knots: 14.8,
        heading_degrees: 325,
        last_lat: 19.112,
        last_lon: 72.100,
        trajectory: [
          [72.260, 18.880, new Date(now.getTime() - 360 * 60000).toISOString()],
          [72.202, 18.964, new Date(now.getTime() - 180 * 60000).toISOString()],
          [72.145, 19.048, new Date(now.getTime() - 42 * 60000).toISOString()],
          [72.100, 19.112, now.toISOString()],
        ],
      },
      {
        mmsi: 255806000,
        imo_number: 9842061,
        name: "MSC KANOKO",
        flag: "Liberia",
        vessel_type: "Container Ship",
        length_meters: 366,
        draught_meters: 14.5,
        call_sign: "CQES",
        destination: "JNPT PORT MUMBAI",
        distance_meters: 0.0,
        distance_km: 0.0,
        probability_score: 94.8,
        anomaly_score: 94.8,
        anomaly_breakdown: mscAnomaly,
        evidence_tags: mscAnomaly.evidence_tags,
        hindcast_distance_meters: 0.0,
        hindcast_distance_km: 0.0,
        speed_knots: 15.6,
        heading_degrees: 18,
        last_lat: 18.975,
        last_lon: 72.896,
        trajectory: [
          [72.818, 18.735, new Date(now.getTime() - 360 * 60000).toISOString()],
          [72.844, 18.815, new Date(now.getTime() - 180 * 60000).toISOString()],
          [72.870, 18.895, new Date(now.getTime() - 30 * 60000).toISOString()],
          [72.896, 18.975, now.toISOString()],
        ],
      },
      {
        mmsi: 419000789,
        imo_number: 9324567,
        name: "MT SWARNA SINDHU",
        flag: "India (SCI)",
        vessel_type: "Product Tanker",
        length_meters: 228,
        draught_meters: 12.0,
        call_sign: "AWXZ",
        destination: "MUMBAI REFINERY BERTH",
        distance_meters: 0.0,
        distance_km: 0.0,
        probability_score: 91.2,
        anomaly_score: 91.2,
        anomaly_breakdown: swarnaAnomaly,
        evidence_tags: swarnaAnomaly.evidence_tags,
        hindcast_distance_meters: 0.0,
        hindcast_distance_km: 0.0,
        speed_knots: 11.2,
        heading_degrees: 72,
        last_lat: 18.930,
        last_lon: 72.871,
        trajectory: [
          [72.643, 18.855, new Date(now.getTime() - 360 * 60000).toISOString()],
          [72.719, 18.880, new Date(now.getTime() - 180 * 60000).toISOString()],
          [72.795, 18.905, new Date(now.getTime() - 25 * 60000).toISOString()],
          [72.871, 18.930, now.toISOString()],
        ],
      },
      {
        mmsi: 563032000,
        imo_number: 9418290,
        name: "CHEMBULK GIBRALTAR",
        flag: "Singapore",
        vessel_type: "Chemical Tanker",
        length_meters: 175,
        draught_meters: 9.8,
        call_sign: "9V2941",
        destination: "MUMBAI CHEMICAL TERMINAL",
        distance_meters: 0.0,
        distance_km: 0.0,
        probability_score: 89.6,
        anomaly_score: 89.6,
        anomaly_breakdown: chemAnomaly,
        evidence_tags: chemAnomaly.evidence_tags,
        hindcast_distance_meters: 0.0,
        hindcast_distance_km: 0.0,
        speed_knots: 12.8,
        heading_degrees: 155,
        last_lat: 19.170,
        last_lon: 72.020,
        trajectory: [
          [71.915, 19.395, new Date(now.getTime() - 360 * 60000).toISOString()],
          [71.950, 19.320, new Date(now.getTime() - 180 * 60000).toISOString()],
          [71.985, 19.245, new Date(now.getTime() - 20 * 60000).toISOString()],
          [72.020, 19.170, now.toISOString()],
        ],
      },
      {
        mmsi: 419000456,
        imo_number: 9308144,
        name: "MT JAG LOK",
        flag: "India (GE Shipping)",
        vessel_type: "Crude Oil Tanker",
        length_meters: 244,
        draught_meters: 11.2,
        call_sign: "AVJL",
        destination: "SIKKA JAMNAGAR",
        distance_meters: 14200,
        distance_km: 14.2,
        probability_score: 8.2,
        anomaly_score: 8.2,
        evidence_tags: ['Nominal Commercial Passage'],
        speed_knots: 12.4,
        heading_degrees: 98,
        last_lat: 19.015,
        last_lon: 72.275,
      },
    ];

    const spills: SpillFeatureCollection = {
      type: "FeatureCollection",
      features: spillFeatures,
    };

    return {
      vessels,
      suspects,
      spills,
      metocean,
      telemetryLogs: [],
      liveElapsedSeconds: 0,
      activeSpillId: selectedSpillId,
    };
  }

  public getState(): SimulationState {
    return this.state;
  }

  public setActiveSpill(spillId: string) {
    this.activeSpillId = spillId;
    this.state = this.buildInitialState(spillId);
    this.notify();
  }

  public subscribe(listener: (state: SimulationState) => void) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state));
  }
}

export function registerCustomSpillIncident(spill: {
  id: string;
  name?: string;
  locationName?: string;
  originCoords: [number, number]; // [lon, lat]
  areaSqKm?: number;
  slickType?: string;
  sourceScene?: string;
  confidence?: number;
}): MumbaiIncidentConfig {
  const lon = spill.originCoords[0];
  const lat = spill.originCoords[1];
  const id = spill.id;
  const area = spill.areaSqKm || 4.85;

  const config: MumbaiIncidentConfig = {
    id: id,
    name: spill.name || `Custom SAR Detection (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
    locationName: spill.locationName || `Offshore Sector (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
    originCoords: [lon, lat],
    centroid: [lat, lon],
    acquisition_timestamp_utc: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    sourceScene: spill.sourceScene || `S1A_IW_GRDH_${id}`,
    dischargeOffsetMinutes: -42,
    trackHeading: 52.0,
    baseAreaSqKm: area,
    baseLengthKm: Number((Math.sqrt(area) * 2.2).toFixed(2)),
    baseWidthKm: Number((Math.sqrt(area) * 0.7).toFixed(2)),
    culpritMmsi: 419000123,
    culpritName: "MT DESH SHANTI",
    volumeLiters: Math.round(area * 10500),
    slickType: spill.slickType || "Heavy Fuel Oil (HFO-380 / Bilge Sludge)",
    confidence: spill.confidence || 0.940,
    segmentation_dice_score: 0.988,
    oil_likelihood_score: 0.940,
    lookalike_score: 0.060,
    false_positive_analysis: {
      likely_oil_pct: 94.0,
      lookalike_pct: 6.0,
      dominant_class: 'Oil',
      classes: {
        'Oil': 94.0,
        'Calm water': 2.1,
        'Natural film': 1.8,
        'Wake': 1.2,
        'Rain-related artifact': 0.6,
        'Unknown': 0.3,
      },
      marangoni_damping_db: 8.4,
      wind_threshold_valid: true,
      sar_physics_reasoning: 'Capillary wave damping ratio (8.4 dB) validates biogenic vs mineral oil contrast under 16.2 kts surface wind.',
    },
    threat: {
      coast_distance_km: Number((Math.max(4.0, Math.abs(72.85 - lon) * 111.0)).toFixed(1)),
      growth_rate_pct_per_hour: 14.5,
      fishing_zone_risk: 'HIGH',
      fishing_zone_name: 'Custom Offshore Sector Fairway',
      marine_habitat_risk: 'MEDIUM',
      marine_habitat_name: 'Coastal Inshore Pelagic Zone',
      overall_severity_score: 86,
      overall_severity_level: 'CRITICAL',
      predicted_arrival_hours: Number((Math.max(2.0, (Math.abs(72.85 - lon) * 111.0) / 3.6)).toFixed(1)),
      coastal_threat_risk: 'HIGH',
      projected_impact_zone: 'Mumbai Coastal Corridor',
    },
    events: [
      {
        tMinutes: -360,
        timestamp_utc: '05:00 UTC',
        timestamp_ist: '10:30 IST',
        action_headline: 'Vessel enters region',
        label: 'Transit',
        title: 'Vessel Enters Coastal Sector Alpha',
        type: 'transit',
        icon: '⚓',
        speed: 14.8,
        coordinates: [lon - 0.25, lat - 0.20],
        details: 'Vessel enters radar coverage cruising at nominal speed.',
      },
      {
        tMinutes: -60,
        timestamp_utc: '10:00 UTC',
        timestamp_ist: '15:30 IST',
        action_headline: 'Vessel slows',
        label: 'Deceleration',
        title: 'Abrupt Speed Drop & Engine Loiter',
        type: 'anomaly_onset',
        icon: '⚠️',
        speed: 5.2,
        coordinates: [lon - 0.05, lat - 0.04],
        details: 'Speed abruptly decelerated from 14.8 to 5.2 kts with course drift.',
      },
      {
        tMinutes: -42,
        timestamp_utc: '10:18 UTC',
        timestamp_ist: '15:48 IST',
        action_headline: 'Possible source corridor',
        label: 'Discharge',
        title: 'Illicit Discharge & Transponder Blackout',
        type: 'breach',
        icon: '🚨',
        speed: 5.4,
        coordinates: [lon, lat],
        details: 'Illicit bilge wash dump with simultaneous 42-minute dark period.',
      },
      {
        tMinutes: -16,
        timestamp_utc: '10:44 UTC',
        timestamp_ist: '16:14 IST',
        action_headline: 'SAR Pass Detection',
        label: 'SAR Pass',
        title: 'Sentinel-1 C-Band Acquisition Pass',
        type: 'sar_detection',
        icon: '🛰️',
        speed: 12.6,
        coordinates: [lon + 0.10, lat + 0.08],
        details: 'Copernicus Sentinel-1 satellite radar acquisition passes overhead.',
      },
      {
        tMinutes: 0,
        timestamp_utc: '11:00 UTC',
        timestamp_ist: '16:30 IST',
        action_headline: 'Live Tactical Intercept',
        label: 'Live',
        title: 'Real-Time Intercept & Coast Guard Dispatch',
        type: 'live',
        icon: '🎯',
        speed: 14.8,
        coordinates: [lon + 0.20, lat + 0.15],
        details: 'Indian Coast Guard Fast Patrol Vessel dispatched for intercept.',
      },
    ],
  };

  MUMBAI_INCIDENTS[id] = config;
  return config;
}

export const globalSimulation = new AutonomousSimulationEngine();

