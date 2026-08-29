/**
 * OceanGuard Ground-Truth Simulation & Hydrodynamic Drift Engine
 * Unified, deterministic trajectory and live metocean physics.
 * Eliminates ship teleportation by using continuous waypoint interpolation.
 * Perfectly synchronizes ship track and oil spill discharge & drift.
 */
import { Vessel, SuspectVessel, SpillFeatureCollection, MetoceanData, LinkedSpillInfo } from '../types';

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

export interface TimedWaypoint {
  tMinutes: number; // time offset in minutes (-360 to 0)
  lon: number;
  lat: number;
  heading: number;
  speed: number;
}

// Deterministic Timed Waypoint Tracks for Indian EEZ
export const WAYPOINT_TIMELINES: Record<string, { mmsi: number; name: string; isCulprit?: boolean; waypoints: TimedWaypoint[] }[]> = {
  arabian_sea: [
    // MT DESH SHANTI (VLCC Crude Tanker - Transits SW to NE through Mumbai High)
    // Discharges oil at T - 42m at [72.145, 19.048]
    {
      mmsi: 419000123,
      name: "MT DESH SHANTI",
      isCulprit: true,
      waypoints: [
        { tMinutes: -360, lon: 72.000, lat: 18.930, heading: 52, speed: 14.8 },
        { tMinutes: -180, lon: 72.075, lat: 18.990, heading: 52, speed: 14.8 },
        { tMinutes: -42,  lon: 72.145, lat: 19.048, heading: 52, speed: 14.8 }, // Exact Spill Origin Discharge Point!
        { tMinutes: 0,    lon: 72.240, lat: 19.120, heading: 52, speed: 14.8 }, // Live Present
        { tMinutes: 180,  lon: 72.380, lat: 19.210, heading: 52, speed: 14.8 },
      ],
    },
    // ICGS SAMUDRA PRAHARI (Coast Guard Pollution Vessel - Intercept patrol)
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
    // MT JAG LOK (Product Tanker inbound JNPT)
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
    // MSC KANOKO (Container Ship heading 68°)
    {
      mmsi: 255806000,
      name: "MSC KANOKO",
      waypoints: [
        { tMinutes: -360, lon: 71.800, lat: 19.070, heading: 68, speed: 17.2 },
        { tMinutes: -180, lon: 71.950, lat: 19.130, heading: 68, speed: 17.2 },
        { tMinutes: 0,    lon: 72.105, lat: 19.195, heading: 68, speed: 17.2 },
        { tMinutes: 180,  lon: 72.260, lat: 19.255, heading: 68, speed: 17.2 },
      ],
    },
  ],
  bay_of_bengal: [
    // MT DAWN KANCHEEPURAM (Ennore Port Sector)
    // Discharges oil at T - 60m at [80.750, 13.250]
    {
      mmsi: 419000789,
      name: "MT DAWN KANCHEEPURAM",
      isCulprit: true,
      waypoints: [
        { tMinutes: -360, lon: 80.680, lat: 13.160, heading: 38, speed: 13.2 },
        { tMinutes: -180, lon: 80.710, lat: 13.200, heading: 38, speed: 13.2 },
        { tMinutes: -60,  lon: 80.750, lat: 13.250, heading: 38, speed: 13.2 }, // Exact Spill Origin!
        { tMinutes: 0,    lon: 80.785, lat: 13.290, heading: 38, speed: 13.2 }, // Live Present
        { tMinutes: 180,  lon: 80.840, lat: 13.350, heading: 38, speed: 13.2 },
      ],
    },
    // BW MAPLE (VLGC Gas Carrier)
    {
      mmsi: 352001000,
      name: "BW MAPLE",
      waypoints: [
        { tMinutes: -360, lon: 80.920, lat: 13.410, heading: 215, speed: 15.0 },
        { tMinutes: -180, lon: 80.820, lat: 13.310, heading: 215, speed: 15.0 },
        { tMinutes: 0,    lon: 80.720, lat: 13.210, heading: 215, speed: 15.0 },
        { tMinutes: 180,  lon: 80.620, lat: 13.110, heading: 215, speed: 15.0 },
      ],
    },
  ],
};

// Precise piece-wise waypoint kinematic interpolation
export function interpolateVesselPosition(
  mmsi: number,
  timeOffsetMinutes: number,
  scenario: string = 'arabian_sea'
): { lon: number; lat: number; heading: number; speed: number } | null {
  const tracks = WAYPOINT_TIMELINES[scenario] || WAYPOINT_TIMELINES.arabian_sea;
  const vesselTrack = tracks.find((t) => t.mmsi === mmsi);
  if (!vesselTrack || !vesselTrack.waypoints.length) return null;

  const wps = vesselTrack.waypoints;

  // Clamp or extrapolate
  if (timeOffsetMinutes <= wps[0].tMinutes) {
    return { lon: wps[0].lon, lat: wps[0].lat, heading: wps[0].heading, speed: wps[0].speed };
  }
  if (timeOffsetMinutes >= wps[wps.length - 1].tMinutes) {
    const last = wps[wps.length - 1];
    return { lon: last.lon, lat: last.lat, heading: last.heading, speed: last.speed };
  }

  // Find surrounding waypoint segment
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

  const last = wps[wps.length - 1];
  return { lon: last.lon, lat: last.lat, heading: last.heading, speed: last.speed };
}

// Calculate oil slick center and polygon at any arbitrary timeline point
export function calculateSynchronizedOilSpill(
  timeOffsetMinutes: number, // -360 to 0 (and live +)
  scenario: string = 'arabian_sea',
  metocean?: MetoceanData
): { center: [number, number]; polygon: number[][]; area: number; perimeter: number; isNascent: boolean } {
  const isArabian = scenario === 'arabian_sea';
  const dischargeOffset = isArabian ? -42 : -60; // Incident time in minutes before live
  const baseOrigin: [number, number] = isArabian ? [72.145, 19.048] : [80.750, 13.250];
  const trackHeading = isArabian ? 52 : 38;

  const driftSpeedKts = metocean?.net_drift_speed_kts || (isArabian ? 1.95 : 1.52);
  const driftDir = metocean?.net_drift_direction_deg || (isArabian ? 69.3 : 48.2);

  // If before discharge: spill has not happened yet (or show initial discharge spot)
  if (timeOffsetMinutes < dischargeOffset) {
    const freshPoly = generateRealisticSpillPolygon(baseOrigin[0], baseOrigin[1], trackHeading, 1.8, 0.5);
    return {
      center: baseOrigin,
      polygon: freshPoly,
      area: 0.8,
      perimeter: 4.2,
      isNascent: true,
    };
  }

  // Time elapsed since oil was dumped (in hours)
  const elapsedSinceDischargeHours = (timeOffsetMinutes - dischargeOffset) / 60.0;
  const driftDistanceKm = (driftSpeedKts * 1.852) * elapsedSinceDischargeHours;

  const [currentCenterLon, currentCenterLat] = moveCoordinate(
    baseOrigin[0],
    baseOrigin[1],
    driftDir,
    driftDistanceKm
  );

  // Fay expansion: slick grows as it ages
  const lengthKm = Math.min(6.5, 3.2 + elapsedSinceDischargeHours * 2.8);
  const widthKm = Math.min(2.2, 0.8 + elapsedSinceDischargeHours * 0.9);
  const poly = generateRealisticSpillPolygon(currentCenterLon, currentCenterLat, trackHeading, lengthKm, widthKm);

  const area = Number((lengthKm * widthKm * 0.78).toFixed(2));
  const perimeter = Number(((lengthKm + widthKm) * 2.1).toFixed(1));

  return {
    center: [currentCenterLon, currentCenterLat],
    polygon: poly,
    area,
    perimeter,
    isNascent: false,
  };
}

export class AutonomousSimulationEngine {
  private listeners: ((state: SimulationState) => void)[] = [];
  private intervalId: any = null;
  private state: SimulationState;
  private currentScenario: string = 'arabian_sea';
  private elapsedSeconds: number = 0;

  // Base spill origin coordinates at discharge time (T-42m)
  private baseSpillOrigin: [number, number] = [72.145, 19.048];

  constructor(initialScenario: string = 'arabian_sea') {
    this.currentScenario = initialScenario;
    this.state = this.buildInitialState(initialScenario);
  }

  public buildInitialState(scenario: string): SimulationState {
    this.currentScenario = scenario;
    this.elapsedSeconds = 0;
    const isMumbai = scenario === 'arabian_sea';
    const now = new Date();
    const currentYear = now.getFullYear();
    const formattedDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const detectionTimeIst = new Date(now.getTime() - (isMumbai ? 42 : 60) * 60000).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    const dateCode = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeCode = now.toISOString().slice(11, 19).replace(/:/g, '');

    if (isMumbai) {
      this.baseSpillOrigin = [72.145, 19.048];

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
        wind_cardinal: "WSW",
        current_cardinal: "ENE",
        sar_backscatter_quality: "OPTIMAL (High Radar Contrast)",
        sea_state: "Slight to Moderate (Beaufort 4)",
      };

      // Live present spill (at T=0, 42 minutes after discharge)
      const liveSpill = calculateSynchronizedOilSpill(0, 'arabian_sea', metocean);

      const linkedSpillMHO: LinkedSpillInfo = {
        id: "INC-IND-2024-01",
        detection_date: "14 Aug 2024",
        detection_time_utc: "05:29:40 IST (T-42m)",
        volume_liters: 58000,
        confidence_score: 98.4,
        slick_type: "Heavy Fuel Oil (HFO-380)",
        distance_km: 0.0,
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
          linked_spill: linkedSpillMHO,
          current_position: {
            latitude: 19.120,
            longitude: 72.240,
            speed_knots: 14.8,
            heading_degrees: 52,
            rate_of_turn: 0.0,
            timestamp: new Date().toISOString(),
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
          cargo_type: "Containment Booms",
          current_position: {
            latitude: 19.060,
            longitude: 72.180,
            speed_knots: 18.5,
            heading_degrees: 310,
            rate_of_turn: 0.0,
            timestamp: new Date().toISOString(),
          },
        },
        {
          mmsi: 419000456,
          imo_number: 9308144,
          name: "MT JAG LOK",
          flag: "India (GE Shipping)",
          vessel_type: "Product Tanker",
          length_meters: 244,
          draught_meters: 11.2,
          call_sign: "AVJL",
          destination: "JAWAHARLAL NEHRU PORT",
          nav_status: "Under way using engine",
          cargo_type: "Petroleum Products",
          current_position: {
            latitude: 19.015,
            longitude: 72.275,
            speed_knots: 12.4,
            heading_degrees: 98,
            rate_of_turn: 0.0,
            timestamp: new Date().toISOString(),
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
          destination: "NHAVA SHEVA",
          nav_status: "Under way using engine",
          cargo_type: "Containers (14,000 TEU)",
          current_position: {
            latitude: 19.195,
            longitude: 72.105,
            speed_knots: 17.2,
            heading_degrees: 68,
            rate_of_turn: 0.0,
            timestamp: new Date().toISOString(),
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
          speed_knots: 14.8,
          heading_degrees: 52,
          last_lat: 19.120,
          last_lon: 72.240,
          linked_spill: linkedSpillMHO,
          trajectory: [
            [72.000, 18.930, new Date(now.getTime() - 360 * 60000).toISOString()],
            [72.075, 18.990, new Date(now.getTime() - 180 * 60000).toISOString()],
            [72.145, 19.048, new Date(now.getTime() - 42 * 60000).toISOString()], // Incident Origin Intercept
            [72.240, 19.120, now.toISOString()],
          ],
        },
        {
          mmsi: 419000456,
          imo_number: 9308144,
          name: "MT JAG LOK",
          flag: "India (GE Shipping)",
          vessel_type: "Product Tanker",
          length_meters: 244,
          draught_meters: 11.2,
          call_sign: "AVJL",
          destination: "JAWAHARLAL NEHRU PORT",
          distance_meters: 14200,
          distance_km: 14.2,
          probability_score: 8.2,
          speed_knots: 12.4,
          heading_degrees: 98,
          last_lat: 19.015,
          last_lon: 72.275,
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
          destination: "NHAVA SHEVA",
          distance_meters: 18900,
          distance_km: 18.9,
          probability_score: 3.1,
          speed_knots: 17.2,
          heading_degrees: 68,
          last_lat: 19.195,
          last_lon: 72.105,
        },
      ];

      const spills: SpillFeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "INC-IND-2024-01",
            properties: {
              id: "INC-IND-2024-01",
              detection_timestamp: "2024-08-14T05:29:40.000Z",
              area_sq_km: liveSpill.area,
              perimeter_km: liveSpill.perimeter,
              confidence_score: 0.988,
              source_scene: "S1A_IW_GRDH_1SDV_20240814T052940_048912",
              status: "ACTIVE",
              center: liveSpill.center,
              estimated_discharge_liters: 58000,
              slick_type: "Heavy Fuel Oil (HFO-380)",
            },
            geometry: {
              type: "Polygon",
              coordinates: [liveSpill.polygon],
            },
          },
        ],
      };

      return {
        vessels,
        suspects,
        spills,
        metocean,
        telemetryLogs: [],
        liveElapsedSeconds: 0,
      };
    } else {
      // Bay of Bengal / Ennore Port Sector (Historical Ground Truth Collision: 28 Jan 2017 03:45 IST)
      this.baseSpillOrigin = [80.750, 13.250];

      const metocean: MetoceanData = {
        wind_speed_kts: 12.8,
        wind_direction_deg: 190.0,
        current_speed_kts: 1.1,
        current_direction_deg: 40.0,
        sea_surface_temp_c: 29.1,
        significant_wave_height_m: 1.4,
        weathering_evaporation_pct: 26.0,
        weathering_emulsification_pct: 31.5,
        net_drift_speed_kts: 1.52,
        net_drift_direction_deg: 48.2,
        wind_cardinal: "S",
        current_cardinal: "NE",
        sar_backscatter_quality: "OPTIMAL (High Radar Contrast)",
        sea_state: "Smooth to Slight (Beaufort 3)",
      };

      const liveSpill = calculateSynchronizedOilSpill(0, 'bay_of_bengal', metocean);

      const linkedSpillEnnore: LinkedSpillInfo = {
        id: "INC-IND-2017-02",
        detection_date: "28 Jan 2017",
        detection_time_utc: "03:45:00 IST (22:15 UTC)",
        volume_liters: 251400,
        confidence_score: 96.2,
        slick_type: "Heavy Bunker Fuel Oil (HFO-380)",
        distance_km: 0.0,
      };

      const ennoreBaseIso = "2017-01-27T23:15:00.000Z"; // 28 Jan 2017 04:45 IST (T-0)

      const vessels: Vessel[] = [
        {
          mmsi: 419000789,
          imo_number: 9114816,
          name: "MT DAWN KANCHEEPURAM",
          flag: "India",
          vessel_type: "Product Tanker",
          length_meters: 228,
          draught_meters: 10.4,
          call_sign: "AVDK",
          destination: "KAMARAJAR PORT ENNORE",
          nav_status: "Under way using engine",
          cargo_type: "Fuel Oil / Bunker (Inbound)",
          linked_spill: linkedSpillEnnore,
          current_position: {
            latitude: 13.290,
            longitude: 80.785,
            speed_knots: 13.2,
            heading_degrees: 38,
            rate_of_turn: 0.0,
            timestamp: ennoreBaseIso,
          },
        },
        {
          mmsi: 352001000,
          imo_number: 9322968,
          name: "BW MAPLE",
          flag: "Isle of Man",
          vessel_type: "LPG Tanker",
          length_meters: 226,
          draught_meters: 11.5,
          call_sign: "2BWM",
          destination: "SINGAPORE STRAIT",
          nav_status: "Under way using engine",
          cargo_type: "LPG Gas (Outbound)",
          current_position: {
            latitude: 13.245,
            longitude: 80.740,
            speed_knots: 11.8,
            heading_degrees: 142,
            rate_of_turn: 0.0,
            timestamp: ennoreBaseIso,
          },
        },
        {
          mmsi: 419000888,
          imo_number: 9600000,
          name: "ICGS VAIBHAV",
          flag: "India (Coast Guard)",
          vessel_type: "Offshore Patrol Vessel",
          length_meters: 90,
          draught_meters: 4.2,
          call_sign: "AVBH",
          destination: "ENNORE RECOVERY SECTOR",
          nav_status: "Engaged in response ops",
          cargo_type: "Oil Containment Booms",
          current_position: {
            latitude: 13.220,
            longitude: 80.720,
            speed_knots: 16.0,
            heading_degrees: 20,
            rate_of_turn: 0.0,
            timestamp: ennoreBaseIso,
          },
        },
      ];

      const suspects: SuspectVessel[] = [
        {
          mmsi: 419000789,
          imo_number: 9114816,
          name: "MT DAWN KANCHEEPURAM",
          flag: "India",
          vessel_type: "Product Tanker",
          length_meters: 228,
          draught_meters: 10.4,
          call_sign: "AVDK",
          destination: "KAMARAJAR PORT ENNORE",
          distance_meters: 0.0,
          distance_km: 0.0,
          probability_score: 96.8,
          speed_knots: 13.2,
          heading_degrees: 38,
          last_lat: 13.290,
          last_lon: 80.785,
          linked_spill: linkedSpillEnnore,
          trajectory: [
            [80.680, 13.160, "2017-01-27T17:15:00.000Z"], // 22:45 IST (T-6h)
            [80.710, 13.200, "2017-01-27T20:15:00.000Z"], // 01:45 IST (T-3h)
            [80.750, 13.250, "2017-01-27T22:15:00.000Z"], // 03:45 IST (T-1h Intercept/Collision)
            [80.785, 13.290, "2017-01-27T23:15:00.000Z"], // 04:45 IST (T-0)
          ],
        },
        {
          mmsi: 352001000,
          imo_number: 9322968,
          name: "BW MAPLE",
          flag: "Isle of Man",
          vessel_type: "LPG Tanker",
          length_meters: 226,
          draught_meters: 11.5,
          call_sign: "2BWM",
          destination: "SINGAPORE STRAIT",
          distance_meters: 450,
          distance_km: 0.45,
          probability_score: 94.2,
          speed_knots: 11.8,
          heading_degrees: 142,
          last_lat: 13.245,
          last_lon: 80.740,
          trajectory: [
            [80.780, 13.310, "2017-01-27T17:15:00.000Z"],
            [80.760, 13.280, "2017-01-27T20:15:00.000Z"],
            [80.750, 13.250, "2017-01-27T22:15:00.000Z"], // 03:45 IST (Collision Point)
            [80.740, 13.245, "2017-01-27T23:15:00.000Z"],
          ],
        },
      ];

      const spills: SpillFeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "INC-IND-2017-02",
            properties: {
              id: "INC-IND-2017-02",
              detection_timestamp: "2017-01-27T22:15:00.000Z", // 28 Jan 2017 03:45:00 IST
              area_sq_km: liveSpill.area,
              perimeter_km: liveSpill.perimeter,
              confidence_score: 0.962,
              source_scene: "S1A_IW_GRDH_1SDV_20170128T124530_015024",
              status: "ACTIVE",
              center: liveSpill.center,
              estimated_discharge_liters: 251400,
              slick_type: "Heavy Bunker Fuel Oil (HFO-380)",
            },
            geometry: {
              type: "Polygon",
              coordinates: [liveSpill.polygon],
            },
          },
        ],
      };

      return {
        vessels,
        suspects,
        spills,
        metocean,
        telemetryLogs: [],
        liveElapsedSeconds: 0,
      };
    }
  }

  public start() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public setScenario(scenario: string) {
    this.state = this.buildInitialState(scenario);
    this.notify();
  }

  public getState(): SimulationState {
    return this.state;
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

  // 1-Second Continuous Tick (Deterministic Navigation + Live Slick Hydrodynamic Advection)
  private tick() {
    this.elapsedSeconds += 1;
    const nowIst = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
    const isArabian = this.currentScenario === 'arabian_sea';
    const totalMinutesElapsed = (this.elapsedSeconds / 60.0);

    // 1. Advance oil spill with live drift
    const liveSpillData = calculateSynchronizedOilSpill(totalMinutesElapsed, this.currentScenario, this.state.metocean);

    const updatedSpills: SpillFeatureCollection = {
      type: "FeatureCollection",
      features: this.state.spills.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          center: liveSpillData.center,
          area_sq_km: liveSpillData.area,
          perimeter_km: liveSpillData.perimeter,
        },
        geometry: {
          type: "Polygon",
          coordinates: [liveSpillData.polygon],
        },
      })),
    };

    // 2. Advance all vessels smoothly along their heading
    const updatedVessels = this.state.vessels.map((v) => {
      if (!v.current_position) return v;
      const speedKmPerSec = (v.current_position.speed_knots * 1.852) / 3600;
      const [newLon, newLat] = moveCoordinate(
        v.current_position.longitude,
        v.current_position.latitude,
        v.current_position.heading_degrees,
        speedKmPerSec
      );

      return {
        ...v,
        current_position: {
          ...v.current_position,
          longitude: newLon,
          latitude: newLat,
          timestamp: new Date().toISOString(),
        },
      };
    });

    // 3. Update suspect positions
    const updatedSuspects = this.state.suspects.map((s) => {
      const match = updatedVessels.find((v) => v.mmsi === s.mmsi);
      if (match?.current_position) {
        return {
          ...s,
          last_lon: match.current_position.longitude,
          last_lat: match.current_position.latitude,
          speed_knots: match.current_position.speed_knots,
          heading_degrees: match.current_position.heading_degrees,
        };
      }
      return s;
    });

    // 4. Metocean micro-oscillations
    const windNoise = (Math.random() - 0.5) * 0.04;
    const newWindSpeed = Number(Math.max(12.0, Math.min(22.0, this.state.metocean.wind_speed_kts + windNoise)).toFixed(1));
    const newEvap = Number(Math.min(45.0, this.state.metocean.weathering_evaporation_pct + 0.001).toFixed(2));
    const newEmuls = Number(Math.min(65.0, this.state.metocean.weathering_emulsification_pct + 0.002).toFixed(2));

    const updatedMetocean: MetoceanData = {
      ...this.state.metocean,
      wind_speed_kts: newWindSpeed,
      weathering_evaporation_pct: newEvap,
      weathering_emulsification_pct: newEmuls,
    };

    // 5. AIS packet stream
    const primary = updatedVessels[0];
    const newLog: TelemetryPacket = {
      id: `pkt-${Date.now()}`,
      time_utc: nowIst,
      mmsi: primary.mmsi,
      vessel: primary.name,
      sog_knots: primary.current_position?.speed_knots || 14.8,
      cog_degrees: primary.current_position?.heading_degrees || 52,
      nav_status: primary.nav_status || 'Under way',
      lat: primary.current_position?.latitude || 19.12,
      lon: primary.current_position?.longitude || 72.24,
      message_type: 'AIS Type 1 (Position Report)',
    };

    this.state = {
      vessels: updatedVessels,
      suspects: updatedSuspects,
      spills: updatedSpills,
      metocean: updatedMetocean,
      telemetryLogs: [newLog, ...(this.state.telemetryLogs || [])].slice(0, 15),
      liveElapsedSeconds: this.elapsedSeconds,
    };

    this.notify();
  }
}

export const globalSimulation = new AutonomousSimulationEngine('arabian_sea');
globalSimulation.start();
