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

// Mumbai Maritime Zone Active Incident Definitions
export interface MumbaiIncidentConfig {
  id: string;
  name: string;
  locationName: string;
  originCoords: [number, number];
  dischargeOffsetMinutes: number;
  trackHeading: number;
  baseAreaSqKm: number;
  baseLengthKm: number;
  baseWidthKm: number;
  culpritMmsi: number;
  culpritName: string;
  volumeLiters: number;
  slickType: string;
  confidence: number;
  sourceScene: string;
  threat: EnvironmentalThreat;
}

export const MUMBAI_INCIDENTS: Record<string, MumbaiIncidentConfig> = {
  "INC-MUM-2024-01": {
    id: "INC-MUM-2024-01",
    name: "Mumbai High Sector Alpha",
    locationName: "Mumbai High Offshore (19° 03.4' N, 72° 10.0' E)",
    originCoords: [72.145, 19.048],
    dischargeOffsetMinutes: -42,
    trackHeading: 52,
    baseAreaSqKm: 5.40,
    baseLengthKm: 4.8,
    baseWidthKm: 1.4,
    culpritMmsi: 419000123,
    culpritName: "MT DESH SHANTI",
    volumeLiters: 58000,
    slickType: "Heavy Crude Oil (Arabian Heavy)",
    confidence: 0.988,
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
    }
  },
  "INC-MUM-2024-02": {
    id: "INC-MUM-2024-02",
    name: "JNPT Access Channel",
    locationName: "JNPT Deep-Water Channel (18° 53.7' N, 72° 42.7' E)",
    originCoords: [72.712, 18.895],
    dischargeOffsetMinutes: -30,
    trackHeading: 68,
    baseAreaSqKm: 2.85,
    baseLengthKm: 3.4,
    baseWidthKm: 1.1,
    culpritMmsi: 255806000,
    culpritName: "MSC KANOKO",
    volumeLiters: 31000,
    slickType: "Heavy Fuel Oil (HFO-380 Bilge Sludge)",
    confidence: 0.965,
    sourceScene: "S1A_IW_GRDH_1SDV_JNPT_CHANNEL",
    threat: {
      coast_distance_km: 8.5,
      growth_rate_pct_per_hour: 22.4,
      fishing_zone_risk: 'HIGH',
      fishing_zone_name: 'Uran & Karanja Artisanal Fisheries',
      marine_habitat_risk: 'HIGH',
      marine_habitat_name: 'Elephanta Sanctuary & Mangrove Estuaries',
      overall_severity_score: 86,
      overall_severity_level: 'HIGH',
      predicted_arrival_hours: 2.4,
      coastal_threat_risk: 'HIGH',
      projected_impact_zone: 'JNPT Port & Elephanta Islands'
    }
  },
  "INC-MUM-2024-03": {
    id: "INC-MUM-2024-03",
    name: "Prongs Reef Anchorage",
    locationName: "Mumbai Outer Anchorage (18° 56.5' N, 72° 38.1' E)",
    originCoords: [72.635, 18.942],
    dischargeOffsetMinutes: -25,
    trackHeading: 38,
    baseAreaSqKm: 1.95,
    baseLengthKm: 2.6,
    baseWidthKm: 0.9,
    culpritMmsi: 419000789,
    culpritName: "MT SWARNA SINDHU",
    volumeLiters: 18500,
    slickType: "Intermediate Fuel Oil (IFO-180)",
    confidence: 0.942,
    sourceScene: "S1A_IW_GRDH_1SDV_PRONGS_REEF",
    threat: {
      coast_distance_km: 4.2,
      growth_rate_pct_per_hour: 14.8,
      fishing_zone_risk: 'HIGH',
      fishing_zone_name: 'Sassoon Docks & Colaba Trawler Hub',
      marine_habitat_risk: 'HIGH',
      marine_habitat_name: 'Prongs Reef Intertidal Coral Shelf',
      overall_severity_score: 84,
      overall_severity_level: 'HIGH',
      predicted_arrival_hours: 1.2,
      coastal_threat_risk: 'HIGH',
      projected_impact_zone: 'Colaba Point & Marine Drive Reefs'
    }
  },
  "INC-MUM-2024-04": {
    id: "INC-MUM-2024-04",
    name: "Neelam South Offshore",
    locationName: "Neelam Offshore Field (19° 14.7' N, 71° 59.1' E)",
    originCoords: [71.985, 19.245],
    dischargeOffsetMinutes: -20,
    trackHeading: 45,
    baseAreaSqKm: 3.60,
    baseLengthKm: 3.8,
    baseWidthKm: 1.2,
    culpritMmsi: 563032000,
    culpritName: "CHEMBULK GIBRALTAR",
    volumeLiters: 42000,
    slickType: "Condensate & Light Crude Sheen",
    confidence: 0.958,
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
    }
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
  // 1. MT DESH SHANTI (VLCC Crude Tanker - Transits SW to NE through Mumbai High)
  {
    mmsi: 419000123,
    name: "MT DESH SHANTI",
    isCulprit: true,
    linkedSpillId: "INC-MUM-2024-01",
    waypoints: [
      { tMinutes: -360, lon: 71.970, lat: 18.910, heading: 52, speed: 14.8 },
      { tMinutes: -180, lon: 72.065, lat: 18.985, heading: 52, speed: 14.8 },
      { tMinutes: -42,  lon: 72.145, lat: 19.048, heading: 52, speed: 5.2 }, // Spill 1 Discharge Point
      { tMinutes: 0,    lon: 72.240, lat: 19.120, heading: 52, speed: 14.8 },
      { tMinutes: 180,  lon: 72.380, lat: 19.210, heading: 52, speed: 14.8 },
    ],
  },
  // 2. MSC KANOKO (Container Ship - High Speed Inbound JNPT)
  {
    mmsi: 255806000,
    name: "MSC KANOKO",
    isCulprit: true,
    linkedSpillId: "INC-MUM-2024-02",
    waypoints: [
      { tMinutes: -360, lon: 72.580, lat: 18.780, heading: 68, speed: 17.2 },
      { tMinutes: -180, lon: 72.650, lat: 18.840, heading: 68, speed: 17.2 },
      { tMinutes: -30,  lon: 72.712, lat: 18.895, heading: 68, speed: 6.8 }, // Spill 2 Discharge Point
      { tMinutes: 0,    lon: 72.760, lat: 18.930, heading: 68, speed: 15.6 },
      { tMinutes: 180,  lon: 72.860, lat: 19.010, heading: 68, speed: 12.0 },
    ],
  },
  // 3. MT SWARNA SINDHU (Product Tanker - Inbound Mumbai Refinery)
  {
    mmsi: 419000789,
    name: "MT SWARNA SINDHU",
    isCulprit: true,
    linkedSpillId: "INC-MUM-2024-03",
    waypoints: [
      { tMinutes: -360, lon: 72.540, lat: 18.840, heading: 38, speed: 12.5 },
      { tMinutes: -180, lon: 72.585, lat: 18.890, heading: 38, speed: 12.5 },
      { tMinutes: -25,  lon: 72.635, lat: 18.942, heading: 38, speed: 4.5 }, // Spill 3 Discharge Point
      { tMinutes: 0,    lon: 72.670, lat: 18.980, heading: 38, speed: 11.2 },
      { tMinutes: 180,  lon: 72.740, lat: 19.050, heading: 38, speed: 10.0 },
    ],
  },
  // 4. CHEMBULK GIBRALTAR (Chemical Tanker - Passing Neelam Offshore)
  {
    mmsi: 563032000,
    name: "CHEMBULK GIBRALTAR",
    isCulprit: true,
    linkedSpillId: "INC-MUM-2024-04",
    waypoints: [
      { tMinutes: -360, lon: 71.860, lat: 19.120, heading: 45, speed: 13.4 },
      { tMinutes: -180, lon: 71.920, lat: 19.180, heading: 45, speed: 13.4 },
      { tMinutes: -20,  lon: 71.985, lat: 19.245, heading: 45, speed: 5.8 }, // Spill 4 Discharge Point
      { tMinutes: 0,    lon: 72.040, lat: 19.310, heading: 45, speed: 12.8 },
      { tMinutes: 180,  lon: 72.120, lat: 19.390, heading: 45, speed: 12.8 },
    ],
  },
  // 5. MT JAG LOK (Crude Oil Tanker - Transiting West)
  {
    mmsi: 419000456,
    name: "MT JAG LOK",
    waypoints: [
      { tMinutes: -360, lon: 71.950, lat: 19.055, heading: 98, speed: 12.4 },
      { tMinutes: -180, lon: 72.100, lat: 19.035, heading: 98, speed: 12.4 },
      { tMinutes: 0,    lon: 72.275, lat: 19.015, heading: 98, speed: 12.4 },
      { tMinutes: 180,  lon: 72.420, lat: 18.990, heading: 98, speed: 12.4 },
    ],
  },
  // 6. ICGS SAMUDRA PRAHARI (Coast Guard Pollution Control Intercept Patrol)
  {
    mmsi: 419000999,
    name: "ICGS SAMUDRA PRAHARI",
    waypoints: [
      { tMinutes: -360, lon: 72.380, lat: 18.920, heading: 310, speed: 18.5 },
      { tMinutes: -180, lon: 72.280, lat: 18.990, heading: 310, speed: 18.5 },
      { tMinutes: 0,    lon: 72.180, lat: 19.060, heading: 310, speed: 18.5 },
      { tMinutes: 180,  lon: 72.100, lat: 19.120, heading: 310, speed: 18.5 },
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
          area_sq_km: live.area,
          perimeter_km: live.perimeter,
          confidence_score: config.confidence,
          source_scene: config.sourceScene,
          status: "ACTIVE",
          center: live.center,
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
        destination: "MUMBAI OFFSHORE TERMINAL",
        nav_status: "Under way using engine",
        cargo_type: "Crude Oil (280,000 DWT)",
        anomaly_score: 98.4,
        anomaly_breakdown: deshShantiAnomaly,
        current_position: {
          latitude: 19.120,
          longitude: 72.240,
          speed_knots: 14.8,
          heading_degrees: 52,
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
          latitude: 18.930,
          longitude: 72.760,
          speed_knots: 15.6,
          heading_degrees: 68,
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
          latitude: 18.980,
          longitude: 72.670,
          speed_knots: 11.2,
          heading_degrees: 38,
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
          latitude: 19.310,
          longitude: 72.040,
          speed_knots: 12.8,
          heading_degrees: 45,
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
          latitude: 19.015,
          longitude: 72.275,
          speed_knots: 12.4,
          heading_degrees: 98,
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
        destination: "MUMBAI OFFSHORE TERMINAL",
        distance_meters: 0.0,
        distance_km: 0.0,
        probability_score: 98.4,
        anomaly_score: 98.4,
        anomaly_breakdown: deshShantiAnomaly,
        evidence_tags: deshShantiAnomaly.evidence_tags,
        hindcast_distance_meters: 0.0,
        hindcast_distance_km: 0.0,
        speed_knots: 14.8,
        heading_degrees: 52,
        last_lat: 19.120,
        last_lon: 72.240,
        trajectory: [
          [71.970, 18.910, new Date(now.getTime() - 360 * 60000).toISOString()],
          [72.065, 18.985, new Date(now.getTime() - 180 * 60000).toISOString()],
          [72.145, 19.048, new Date(now.getTime() - 42 * 60000).toISOString()],
          [72.240, 19.120, now.toISOString()],
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
        heading_degrees: 68,
        last_lat: 18.930,
        last_lon: 72.760,
        trajectory: [
          [72.580, 18.780, new Date(now.getTime() - 360 * 60000).toISOString()],
          [72.650, 18.840, new Date(now.getTime() - 180 * 60000).toISOString()],
          [72.712, 18.895, new Date(now.getTime() - 30 * 60000).toISOString()],
          [72.760, 18.930, now.toISOString()],
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
        heading_degrees: 38,
        last_lat: 18.980,
        last_lon: 72.670,
        trajectory: [
          [72.540, 18.840, new Date(now.getTime() - 360 * 60000).toISOString()],
          [72.585, 18.890, new Date(now.getTime() - 180 * 60000).toISOString()],
          [72.635, 18.942, new Date(now.getTime() - 25 * 60000).toISOString()],
          [72.670, 18.980, now.toISOString()],
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
        heading_degrees: 45,
        last_lat: 19.310,
        last_lon: 72.040,
        trajectory: [
          [71.860, 19.120, new Date(now.getTime() - 360 * 60000).toISOString()],
          [71.920, 19.180, new Date(now.getTime() - 180 * 60000).toISOString()],
          [71.985, 19.245, new Date(now.getTime() - 20 * 60000).toISOString()],
          [72.040, 19.310, now.toISOString()],
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

export const globalSimulation = new AutonomousSimulationEngine();
