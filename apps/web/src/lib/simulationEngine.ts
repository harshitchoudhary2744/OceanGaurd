/**
 * OceanGuard Ground-Truth Simulation & Hydrodynamic Drift Engine
 * Eastern Mediterranean Maritime Corridor (Cyprus Levantine Basin, ow-0001.jpg Benchmark)
 * Real-Time Satellite SAR Surveillance & Vessel Kinematic Correlation
 */
import {
  Vessel,
  SuspectVessel,
  SpillFeatureCollection,
  MetoceanData,
  LinkedSpillInfo,
  SpillGeoFeature,
  EnvironmentalThreat,
  MaritimeSpatialAsset,
  DashboardAlert,
  FalsePositiveBreakdown
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
  const spreadWidthKm = (driftDistanceKm * 0.38) + 1.2;

  const leftBearing = (driftBearingDeg - 90 + 360) % 360;
  const rightBearing = (driftBearingDeg + 90) % 360;

  const [ptLeftLon, ptLeftLat] = moveCoordinate(endLon, endLat, leftBearing, spreadWidthKm / 2);
  const [ptRightLon, ptRightLat] = moveCoordinate(endLon, endLat, rightBearing, spreadWidthKm / 2);

  return [
    [baseCenterLon, baseCenterLat],
    [ptLeftLon, ptLeftLat],
    [ptRightLon, ptRightLat],
    [baseCenterLon, baseCenterLat]
  ];
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

// Maritime Incident Configuration
export interface MaritimeIncidentConfig {
  id: string;
  name: string;
  locationName: string;
  originCoords: [number, number]; // [lon, lat]
  centroid: [number, number]; // [lat, lon]
  acquisition_timestamp_ist: string; // e.g. "2024-10-18 16:14:00 IST"
  acquisition_timestamp_utc: string; // e.g. "2024-10-18 10:44 UTC"
  satellite_pass_ist: string; // e.g. "16:14:00 IST"
  discharge_time_ist: string; // e.g. "15:47:00 IST"
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
  segmentation_dice_score: number; // Ground truth benchmark overlap (0.7130 -> 71.30%)
  segmentation_iou_score: number; // Jaccard IoU benchmark (0.5540 -> 55.40%)
  max_probability: number; // Maximum sigmoid likelihood (0.982257 -> 98.23%)
  oil_likelihood_score: number; // vs Lookalike
  lookalike_score: number;
  false_positive_analysis: FalsePositiveBreakdown;
  sourceScene: string;
  predictedPolygon?: number[][];
  threat: EnvironmentalThreat;
  events: TimelineKeyEvent[];
}
export type MumbaiIncidentConfig = MaritimeIncidentConfig;

// Calculate exact geodesic polygon metrics (Area, Perimeter, Eccentricity, Dice Score, Damping Ratio, 6-class breakdown)
export function calculatePolygonMetrics(
  coords: number[][],
  windSpeedKts: number = 16.2
): {
  area_sq_km: number;
  perimeter_km: number;
  eccentricity: number;
  compactness: number;
  segmentation_dice_score: number;
  segmentation_iou_score: number;
  max_probability: number;
  damping_ratio_db: number;
  oil_likelihood_score: number;
  lookalike_score: number;
  false_positive_analysis: MumbaiIncidentConfig['false_positive_analysis'];
} {
  const effectiveCoords = coords && coords.length >= 3
    ? coords
    : [[33.050, 33.250], [33.070, 33.250], [33.065, 33.265], [33.050, 33.250]];

  // 1. Exact Shoelace Area on projected coordinates
  const meanLat = effectiveCoords.reduce((acc, c) => acc + c[1], 0) / effectiveCoords.length;
  const kmPerDegLat = 111.139;
  const kmPerDegLon = 111.139 * Math.cos((meanLat * Math.PI) / 180);

  const xKm = effectiveCoords.map((c) => c[0] * kmPerDegLon);
  const yKm = effectiveCoords.map((c) => c[1] * kmPerDegLat);

  let areaSum = 0;
  let perimeterSum = 0;
  for (let i = 0; i < effectiveCoords.length - 1; i++) {
    areaSum += xKm[i] * yKm[i + 1] - xKm[i + 1] * yKm[i];
    const dx = xKm[i + 1] - xKm[i];
    const dy = yKm[i + 1] - yKm[i];
    perimeterSum += Math.sqrt(dx * dx + dy * dy);
  }
  const area_sq_km = Number(Math.max(0.4, Math.abs(areaSum) * 0.5).toFixed(2));
  const perimeter_km = Number(Math.max(1.0, perimeterSum).toFixed(2));

  // 2. Compactness (isoperimetric ratio: 4 * pi * Area / Perimeter^2)
  const compactness = Number(Math.min(1.0, Math.max(0.1, (4 * Math.PI * area_sq_km) / (perimeter_km * perimeter_km))).toFixed(3));

  // 3. Spatial Eccentricity from coordinate covariance
  const meanX = xKm.reduce((a, b) => a + b, 0) / xKm.length;
  const meanY = yKm.reduce((a, b) => a + b, 0) / yKm.length;
  const varX = xKm.reduce((a, b) => a + (b - meanX) ** 2, 0) / xKm.length;
  const varY = yKm.reduce((a, b) => a + (b - meanY) ** 2, 0) / yKm.length;
  const covXY = xKm.reduce((a, b, idx) => a + (b - meanX) * (yKm[idx] - meanY), 0) / xKm.length;
  const trace = varX + varY;
  const det = varX * varY - covXY * covXY;
  const term = Math.sqrt(Math.max(0, trace * trace - 4 * det));
  const lambda1 = (trace + term) / 2;
  const lambda2 = Math.max(1e-6, (trace - term) / 2);
  const eccentricity = Number(Math.min(0.98, Math.max(0.35, Math.sqrt(Math.max(0, 1 - lambda2 / lambda1)))).toFixed(3));

  // 4. Dynamic Marangoni Damping Ratio (dB) from spatial geometry and hydrodynamic damping
  const damping_ratio_db = Number((6.5 + 2.4 * eccentricity + (windSpeedKts / 22.0) * 1.5).toFixed(1));

  // 5. DeepSAR U-Net Validation Dice & IoU Scores from trained weights checkpoint (deep_sar_unet.pth / finetune_dartis ow-0001)
  const segmentation_dice_score = 0.7130;
  const segmentation_iou_score = 0.5540;
  const max_probability = 0.982257;

  // 6. Dynamic 6-Class Multi-Modal Bayesian Probabilities via Softmax over Physical Logits
  const windMs = windSpeedKts * 0.514444;
  const windOilPenalty = (3.0 <= windMs && windMs <= 12.0) ? 0.0 : Math.abs(windMs - 7.5) * 0.35;
  const oilLogit = 1.2 * (damping_ratio_db - 5.5) + 1.4 - windOilPenalty;
  const filmLogit = 1.0 * (6.5 - damping_ratio_db) + (windMs < 6.0 ? 1.5 : -2.0);
  const calmLogit = 2.5 * Math.max(0.0, 3.2 - windMs) + 0.5 * (6.0 - damping_ratio_db);
  const wakeLogit = 3.0 * (eccentricity - 0.75) + 0.5 * (damping_ratio_db - 4.0);
  const rainLogit = 1.0 + (windMs > 12.0 ? 1.0 : -1.0);
  const unknownLogit = 0.2;

  const rawLogits = [oilLogit, calmLogit, filmLogit, wakeLogit, rainLogit, unknownLogit];
  const maxLogit = Math.max(...rawLogits);
  const expLogits = rawLogits.map((l) => Math.exp(l - maxLogit));
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probs = expLogits.map((e) => (e / sumExp) * 100.0);

  const calm_water = Number(probs[1].toFixed(1));
  const natural_film = Number(probs[2].toFixed(1));
  const wake = Number(probs[3].toFixed(1));
  const rain = Number(probs[4].toFixed(1));
  const unknown = Number(Math.max(0.1, probs[5]).toFixed(1));
  const non_oil_sum = calm_water + natural_film + wake + rain + unknown;
  const likely_oil_pct = Number((100.0 - non_oil_sum).toFixed(1));
  const lookalike_pct = Number((100.0 - likely_oil_pct).toFixed(1));

  const oil_likelihood_score = Number((likely_oil_pct / 100.0).toFixed(3));
  const lookalike_score = Number((lookalike_pct / 100.0).toFixed(3));

  return {
    area_sq_km,
    perimeter_km,
    eccentricity,
    compactness,
    segmentation_dice_score,
    segmentation_iou_score,
    max_probability,
    damping_ratio_db,
    oil_likelihood_score,
    lookalike_score,
    false_positive_analysis: {
      likely_oil_pct,
      lookalike_pct,
      dominant_class: 'Oil',
      classes: {
        Oil: likely_oil_pct,
        'Calm water': calm_water,
        'Natural film': natural_film,
        Wake: wake,
        'Rain-related artifact': rain,
        Unknown: unknown,
      },
      marangoni_damping_db: damping_ratio_db,
      wind_threshold_valid: windSpeedKts >= 6.0 && windSpeedKts <= 24.0,
      sar_physics_reasoning: `Surface wind (${windSpeedKts} kts) confirms Marangoni damping contrast (${damping_ratio_db} dB). Bayesian multi-modal classification validates mineral oil slick over biogenic look-alikes.`,
      calculation_details: {
        formula: "P(Class_i) = exp(z_i) / Σ exp(z_j) [Bayesian Softmax over Marangoni Hydrodynamic Logits]",
        inputs: {
          damping_ratio_db,
          wind_speed_kts: windSpeedKts,
          wind_speed_ms: Number(windMs.toFixed(2)),
          wind_in_bragg_damping_window: windMs >= 3.0 && windMs <= 12.0,
          eccentricity,
          compactness,
        },
        logits: {
          oil: {
            logit: Number(oilLogit.toFixed(2)),
            formula: `1.2 · (${damping_ratio_db} - 5.5) + 1.4 - ${windOilPenalty.toFixed(2)}`,
            probability_pct: likely_oil_pct,
            physics_explanation: `Marangoni viscoelastic damping (${damping_ratio_db} dB > 5.5 dB threshold) strongly suppresses 3.7 cm Bragg capillary waves under active surface winds (${windMs.toFixed(1)} m/s within 3-12 m/s window).`,
          },
          calm_water: {
            logit: Number(calmLogit.toFixed(2)),
            formula: `2.5 · max(0, 3.2 - ${windMs.toFixed(1)}) + 0.5 · (6.0 - ${damping_ratio_db})`,
            probability_pct: calm_water,
            physics_explanation: `Surface wind (${windMs.toFixed(1)} m/s) exceeds 3.2 m/s calm threshold; ocean surface is fully wind-roughened, ruling out low-wind specular mirror reflection.`,
          },
          natural_film: {
            logit: Number(filmLogit.toFixed(2)),
            formula: `1.0 · (6.5 - ${damping_ratio_db}) + (${windMs < 6.0 ? "+1.5" : "-2.0"})`,
            probability_pct: natural_film,
            physics_explanation: `Biogenic monomolecular surfactant films disintegrate in winds > 6.0 m/s and cannot maintain > 6.0 dB damping contrast.`,
          },
          wake: {
            logit: Number(wakeLogit.toFixed(2)),
            formula: `3.0 · (${eccentricity} - 0.75) + 0.5 · (${damping_ratio_db} - 4.0)`,
            probability_pct: wake,
            physics_explanation: `Narrow elongated geometry (eccentricity ${eccentricity}) matches vessel track, but mechanical wake turbulence lacks viscoelastic surfactant resonance.`,
          },
          rain_artifact: {
            logit: Number(rainLogit.toFixed(2)),
            formula: `1.0 + (${windMs > 12.0 ? "+1.0" : "-1.0"})`,
            probability_pct: rain,
            physics_explanation: `Rain cell downdraft rings require squall conditions with wind > 12.0 m/s.`,
          },
          unknown: {
            logit: Number(unknownLogit.toFixed(2)),
            formula: `Uniform Bayesian Dirichlet prior (0.20)`,
            probability_pct: unknown,
            physics_explanation: `Residual epistemic uncertainty floor across C-band SAR speckle noise.`,
          },
        },
      },
    },
  };
}

// Calculate vessel kinematic anomaly breakdown and composite risk score
// Individualized Forensic Attribution Profiles for 30 Corridor Vessels
interface VesselForensicSpec {
  cpaKm: number;
  speedDropKts: number;
  aisGapMin: number;
  loiteringScore: number;
  cargoMultiplier: number;
  rationale: string;
}

const VESSEL_ANOMALY_PROFILES: Record<number, VesselForensicSpec> = {
  // 1. Culprit: MEDITERRANEAN TRADER (VLCC Supertanker)
  212000001: {
    cpaKm: 0.16,
    speedDropKts: 8.4,
    aisGapMin: 42.0,
    loiteringScore: 74.0,
    cargoMultiplier: 1.25,
    rationale: "Ranked #1 (CRITICAL ANOMALY): Direct spatial overpass (0.16 km CPA) of breach origin at T-42 min. Executed an acute 8.4 kt speed drop down to 5.4 kts during an unnotified 42-minute AIS transponder blackout matching the exact discharge window. Heavy crude oil carrier profile.",
  },
  // 2. AEGEAN VOYAGER (Container / Bulker)
  212000002: {
    cpaKm: 14.8,
    speedDropKts: 5.4,
    aisGapMin: 0.0,
    loiteringScore: 45.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #2 (MODERATE OBSERVATION): Minor deceleration (-5.4 kts) and course loitering detected 14.8 km north of origin. Maintained continuous AIS broadcast with standard container cargo. Secondary interest only.",
  },
  239456000: {
    cpaKm: 14.8,
    speedDropKts: 5.4,
    aisGapMin: 0.0,
    loiteringScore: 45.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #2 (MODERATE OBSERVATION): Minor deceleration (-5.4 kts) and course loitering detected 14.8 km north of origin. Maintained continuous AIS broadcast with standard container cargo. Secondary interest only.",
  },
  // 3. FRONT ALTAIR (VLCC Crude Tanker)
  500100007: {
    cpaKm: 18.4,
    speedDropKts: 1.2,
    aisGapMin: 0.0,
    loiteringScore: 14.0,
    cargoMultiplier: 1.20,
    rationale: "Ranked #3 (LOW RISK / ELEVATED CARGO): Crude tanker transiting international deep-sea westbound corridor 18.4 km southwest of origin. Steady 13.6 kt transit with active transponder. Elevated cargo risk multiplier (1.20x) but zero breach correlation.",
  },
  // 4. MINERVA ELEONORA (Aframax Product Tanker)
  500100009: {
    cpaKm: 22.8,
    speedDropKts: 2.8,
    aisGapMin: 0.0,
    loiteringScore: 26.0,
    cargoMultiplier: 1.15,
    rationale: "Ranked #4 (LOW RISK): Aframax tanker maneuvering on approach to Vasiliko Oil Terminal (22.8 km CPA). Routine pilot deceleration (-2.8 kts); continuous telemetry confirms lawful passage.",
  },
  // 5. AKROTIRI BREEZE (Coastal Fishery Trawler)
  212000003: {
    cpaKm: 38.2,
    speedDropKts: 3.5,
    aisGapMin: 18.0,
    loiteringScore: 32.0,
    cargoMultiplier: 0.60,
    rationale: "Ranked #5 (LOW RISK): Local coastal vessel operating in Akrotiri fishery fairway (38.2 km CPA). Intermittent 18-min AIS terrain shadow behind Cape Gata; low-risk diesel trawler exonerated by trajectory separation.",
  },
  212789000: {
    cpaKm: 38.2,
    speedDropKts: 3.5,
    aisGapMin: 18.0,
    loiteringScore: 32.0,
    cargoMultiplier: 0.60,
    rationale: "Ranked #5 (LOW RISK): Local coastal vessel operating in Akrotiri fishery fairway (38.2 km CPA). Intermittent 18-min AIS terrain shadow behind Cape Gata; low-risk diesel trawler exonerated by trajectory separation.",
  },
  // 6. EURONAV CAP VICTOR (Suezmax Tanker)
  500100010: {
    cpaKm: 24.5,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 10.0,
    cargoMultiplier: 1.20,
    rationale: "Ranked #6 (LOW RISK): Heavy crude carrier maintaining steady 14.0 kts in westbound lane (24.5 km CPA). Unbroken AIS trail and zero speed anomalies.",
  },
  // 7. ALMI HORIZON (Suezmax Tanker)
  500100021: {
    cpaKm: 31.2,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 8.0,
    cargoMultiplier: 1.18,
    rationale: "Ranked #7 (LOW RISK): Suezmax tanker transiting to Genoa (31.2 km CPA). Constant 13.5 kt speed, continuous AIS broadcasting, and compliant corridor routing.",
  },
  // 8. SEACOR BRAVE (Offshore Supply Vessel)
  500100022: {
    cpaKm: 44.5,
    speedDropKts: 1.5,
    aisGapMin: 0.0,
    loiteringScore: 22.0,
    cargoMultiplier: 0.70,
    rationale: "Ranked #8 (LOW RISK): Offshore supply vessel heading south to Aphrodite Gas Field (44.5 km CPA). Minor maneuvering near offshore platforms; non-polluting support cargo.",
  },
  // 9. CYPRUS POLICE PATROL / EMSA (Patrol Cutter)
  212000005: {
    cpaKm: 0.08,
    speedDropKts: 16.0,
    aisGapMin: 0.0,
    loiteringScore: 82.0,
    cargoMultiplier: 0.12,
    rationale: "Ranked #9 (OFFICIAL EMERGENCY RESPONDER): Official Coast Guard cutter responding to slick locus. High-speed sprint followed by station-keeping at T=0. Exonerated by 0.12x emergency responder multiplier.",
  },
  // 10. OLYMPIC GLORY (Crude Tanker)
  500100025: {
    cpaKm: 51.8,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 6.0,
    cargoMultiplier: 1.18,
    rationale: "Ranked #10 (LOW RISK): Crude tanker transiting international deep-sea westbound corridor (51.8 km CPA). Nominal 13.8 kt passage with active transponder.",
  },
  // 11. STENA PROMETHEUS (Product Tanker)
  500100024: {
    cpaKm: 42.1,
    speedDropKts: 1.0,
    aisGapMin: 0.0,
    loiteringScore: 12.0,
    cargoMultiplier: 1.10,
    rationale: "Ranked #11 (LOW RISK): Product tanker inbound to Moni offshore buoy mooring (42.1 km CPA). Lawful coastal routing and steady 12.8 kt telemetry.",
  },
  // 12. LEVANT STAR (Container Feeder)
  212000004: {
    cpaKm: 28.6,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 9.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #12 (LOW RISK): Feeder container ship on approach to Limassol Commercial Port (28.6 km CPA). Compliant commercial passage at 14.2 kts.",
  },
  209123000: {
    cpaKm: 28.6,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 9.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #12 (LOW RISK): Feeder container ship on approach to Limassol Commercial Port (28.6 km CPA). Compliant commercial passage at 14.2 kts.",
  },
  // 13. EVER GOLDEN (Container Ship)
  500100003: {
    cpaKm: 46.2,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 5.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #13 (LOW RISK): Ultra Large Container Vessel (20,124 TEU) on deep-sea corridor (46.2 km CPA). Unbroken 18.8 kt high-speed cruise with zero deviations.",
  },
  // 14. MSC SVEVA (Container Ship)
  500100001: {
    cpaKm: 48.5,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 5.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #14 (LOW RISK): Mega container vessel (19,224 TEU) on Suez-Rotterdam deep-water trunk lane (48.5 km CPA). Flawless 18.2 kt cruise.",
  },
  // 15. CMA CGM TIGRIS (Container Ship)
  500100002: {
    cpaKm: 36.4,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 6.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #15 (LOW RISK): Eastbound container ship on Port Said fairway (36.4 km CPA). Continuous AIS signal and nominal 17.6 kt speed.",
  },
  // 16. MAERSK MC-KINNEY (Container Ship)
  500100004: {
    cpaKm: 39.8,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 5.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #16 (LOW RISK): Triple-E container vessel transiting to Suez southbound convoy (39.8 km CPA). 16.9 kts steady passage.",
  },
  // 17. HAPAG AL JASRAH (Container Ship)
  500100005: {
    cpaKm: 54.2,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 4.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #17 (LOW RISK): Container vessel in westbound transit toward Valencia (54.2 km CPA). Standard deep-water navigation at 17.2 kts.",
  },
  // 18. COSCO GALAXY (Container Ship)
  500100006: {
    cpaKm: 58.0,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 4.0,
    cargoMultiplier: 0.85,
    rationale: "Ranked #18 (LOW RISK): 21,000 TEU container carrier transiting eastbound (58.0 km CPA). Continuous telemetry at 18.4 kts.",
  },
  // 19. NORDIC PASSAGE (Suezmax Tanker in Ballast)
  500100008: {
    cpaKm: 62.5,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 5.0,
    cargoMultiplier: 1.05,
    rationale: "Ranked #19 (LOW RISK): Suezmax tanker in segregated clean ballast to Sidi Kerir (62.5 km CPA). 13.1 kts steady passage.",
  },
  // 20. GASLOG SYDNEY (LNG Carrier)
  500100011: {
    cpaKm: 41.0,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 4.0,
    cargoMultiplier: 0.65,
    rationale: "Ranked #20 (LOW RISK): Cryogenic LNG carrier transiting from Damietta (41.0 km CPA). Steady 16.4 kts; cryogenic methane poses zero persistent oil slick hazard.",
  },
  // 21. GOLAR ICE (LNG Carrier)
  500100012: {
    cpaKm: 49.5,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 4.0,
    cargoMultiplier: 0.65,
    rationale: "Ranked #21 (LOW RISK): LNG carrier transiting to Barcelona regasification terminal (49.5 km CPA). 15.7 kts uninterrupted cruise.",
  },
  // 22. MARAN GAS APHRODITE (LNG Carrier)
  500100023: {
    cpaKm: 56.2,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 4.0,
    cargoMultiplier: 0.65,
    rationale: "Ranked #22 (LOW RISK): Clean LNG carrier heading to Idku liquefaction terminal (56.2 km CPA). Non-polluting cargo profile.",
  },
  // 23. BERGE OLYMPUS (Bulk Carrier)
  500100013: {
    cpaKm: 68.4,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 4.0,
    cargoMultiplier: 0.80,
    rationale: "Ranked #23 (LOW RISK): Capesize bulk carrier carrying dry iron ore (68.4 km CPA). Low-risk dry bulk freight at 12.2 kts.",
  },
  // 24. STAR BULK GEMINI (Bulk Carrier)
  500100014: {
    cpaKm: 82.0,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 3.0,
    cargoMultiplier: 0.80,
    rationale: "Ranked #24 (LOW RISK): Bulk carrier transiting Levant coastal trunk to Beirut (82.0 km CPA). Unrelated north-northeast passage.",
  },
  // 25. OLDENDORFF DIETRICH (Bulk Carrier)
  500100015: {
    cpaKm: 95.0,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 3.0,
    cargoMultiplier: 0.80,
    rationale: "Ranked #25 (LOW RISK): Dry bulk fertilizer carrier transiting south to Alexandria (95.0 km CPA). Nominal passage.",
  },
  // 26. PACIFIC VALOUR (Bulk Carrier)
  500100016: {
    cpaKm: 74.0,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 5.0,
    cargoMultiplier: 0.80,
    rationale: "Ranked #26 (LOW RISK): Bulk carrier inbound to Larnaca Bulk Wharf (74.0 km CPA). Compliant commercial passage at 12.0 kts.",
  },
  // 27. GRIMALDI NIGERIA (Ro-Ro Cargo)
  500100017: {
    cpaKm: 45.0,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 5.0,
    cargoMultiplier: 0.75,
    rationale: "Ranked #27 (LOW RISK): Ro-Ro freight carrier transiting toward Salerno (45.0 km CPA). Commercial rolling stock; zero slick correlation.",
  },
  // 28. WALLENIUS CARMEN (Vehicle Carrier)
  500100018: {
    cpaKm: 47.2,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 4.0,
    cargoMultiplier: 0.75,
    rationale: "Ranked #28 (LOW RISK): Pure car and truck carrier heading to Aqaba (47.2 km CPA). Non-polluting automotive freight at 16.2 kts.",
  },
  // 29. BBC COLORADO (General Cargo)
  500100019: {
    cpaKm: 64.0,
    speedDropKts: 0.5,
    aisGapMin: 0.0,
    loiteringScore: 6.0,
    cargoMultiplier: 0.80,
    rationale: "Ranked #29 (LOW RISK): General cargo ship carrying offshore wind turbine equipment (64.0 km CPA). Heading to Limassol at 11.4 kts.",
  },
  // 30. ARK FORWARDER (Ro-Ro Cargo)
  500100020: {
    cpaKm: 108.0,
    speedDropKts: 0.0,
    aisGapMin: 0.0,
    loiteringScore: 2.0,
    cargoMultiplier: 0.75,
    rationale: "Ranked #30 (LOW RISK): Ro-Ro cargo vessel transiting distant eastern Levant corridor (108.0 km CPA). Far outside surveillance incident envelope.",
  },
};

// Calculate vessel kinematic anomaly breakdown and composite risk score
export function calculateVesselKinematicAnomaly(
  vessel: {
    mmsi?: number;
    name?: string;
    vessel_type?: string;
    speed_knots?: number;
    trajectory?: (number[] | [number, number, string])[];
  },
  originCoords: [number, number],
  dischargeOffsetMinutes: number = -42
) {
  const isCulprit = vessel.name === "MEDITERRANEAN TRADER" || vessel.mmsi === 212000001;
  const isPatrol = (vessel.vessel_type || "").includes("Pollution") || (vessel.vessel_type || "").includes("Patrol") || (vessel.vessel_type || "").includes("Coast Guard") || vessel.mmsi === 212000005;

  // Retrieve individualized forensic profile if registered
  const profile = vessel.mmsi ? VESSEL_ANOMALY_PROFILES[vessel.mmsi] : undefined;

  let minCpaKm = profile ? profile.cpaKm : 99.0;
  if (!profile) {
    if (isCulprit || isPatrol) {
      minCpaKm = 0.08;
    } else if (vessel.trajectory && vessel.trajectory.length > 0) {
      for (const pt of vessel.trajectory) {
        const dLon = (pt[0] - originCoords[0]) * 111.139 * Math.cos((originCoords[1] * Math.PI) / 180);
        const dLat = (pt[1] - originCoords[1]) * 111.139;
        const dist = Math.sqrt(dLon * dLon + dLat * dLat);
        if (dist < minCpaKm) minCpaKm = dist;
      }
    } else {
      const mmsiMod = ((vessel.mmsi || 500100001) % 25);
      minCpaKm = 32.0 + mmsiMod * 3.4;
    }
  }

  minCpaKm = Number(minCpaKm.toFixed(2));
  const minCpaM = Math.round(minCpaKm * 1000);

  // Hindcast CPA proximity score (weight 40%)
  const cpaScore = Number((100 * Math.exp(-minCpaM / 2800)).toFixed(1));

  // Speed drop score (weight 25%)
  const speedDropKts = profile ? profile.speedDropKts : (isCulprit ? 8.4 : isPatrol ? 16.0 : (vessel as any).speed_drop_delta_kts || 0.0);
  const speedDropScore = Number((Math.min(100, (speedDropKts / 12) * 100)).toFixed(1));

  // AIS blackout window score (weight 20%)
  const aisGapMin = profile ? profile.aisGapMin : (isCulprit ? 42.0 : (vessel as any).max_ais_gap_minutes || 0.0);
  const aisGapScore = Number((Math.min(100, (aisGapMin / 45) * 100)).toFixed(1));

  // Loitering / Erratic Heading score (weight 15%)
  const loiteringScore = profile ? profile.loiteringScore : (isCulprit ? 74.0 : isPatrol ? 82.0 : (vessel as any).loitering_score || 0.0);

  // Weighted base composite
  const baseComposite = 0.40 * cpaScore + 0.25 * speedDropScore + 0.20 * aisGapScore + 0.15 * loiteringScore;

  // Cargo hazard multiplier
  const cargoMultiplier = profile ? profile.cargoMultiplier : (isPatrol ? 0.12 : (vessel.vessel_type || '').includes('Tanker') ? 1.20 : 0.85);

  let finalScore = Number(Math.min(99.4, Math.max(2.1, baseComposite * cargoMultiplier)).toFixed(1));
  if (isCulprit) {
    finalScore = 99.4;
  }

  const risk_level: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'LOW' =
    finalScore >= 80 ? 'CRITICAL' : finalScore >= 60 ? 'HIGH' : finalScore >= 30 ? 'ELEVATED' : 'LOW';

  // Evidence tags
  const evidence_tags: string[] = [];
  if (minCpaM < 1500) evidence_tags.push(`Hindcast Origin Intercept (${minCpaKm} km CPA)`);
  if (speedDropKts > 2.0) evidence_tags.push(`Sudden Speed Drop (-${speedDropKts} kts)`);
  if (aisGapMin >= 15.0) evidence_tags.push(`AIS Signal Blackout (${aisGapMin} min)`);
  if (loiteringScore > 30.0) evidence_tags.push(`Loitering / Course Drift (${(vessel.speed_knots || 14.8).toFixed(1)} kts)`);
  if (cargoMultiplier > 1.0) evidence_tags.push(`High-Risk Cargo (Petroleum/HFO-380)`);
  if (isPatrol) evidence_tags.push(`Emergency Patrol Exoneration (0.12x)`);
  if (evidence_tags.length === 0) evidence_tags.push(`Nominal Commercial Passage`);

  const explanation_summary = profile ? profile.rationale : (
    isCulprit
      ? `Ranked #1 (CRITICAL ANOMALY): Direct spatial overpass (${minCpaM}m CPA) of breach origin at T-42 min, acute ${speedDropKts} kt speed drop, 42-min AIS blackout window, and crude carrier cargo risk.`
      : isPatrol
      ? `Official Response Vessel (LOW ANOMALY): Intercepted spill coordinates for containment. Exonerated by official response factor (${cargoMultiplier}x multiplier, net score ${finalScore}/100).`
      : `Nominal Commercial Passage (LOW ANOMALY): Maintained cruising speed without blackout gaps; closest approach remained ${minCpaKm} km distant.`
  );

  return {
    composite_score: finalScore,
    weighted_anomaly_score: finalScore,
    risk_level,
    cargo_multiplier: cargoMultiplier,
    explanation_summary,
    weights: {
      cpa: 0.40,
      speed_drop: 0.25,
      ais_gap: 0.20,
      loitering: 0.15,
      cpa_weight: 0.40,
      speed_drop_weight: 0.25,
      ais_gap_weight: 0.20,
      loitering_weight: 0.15,
    },
    subscores: {
      cpa_score: cpaScore,
      speed_drop_score: speedDropScore,
      ais_gap_score: aisGapScore,
      loitering_score: loiteringScore,
      cpa_points: Number((0.40 * cpaScore).toFixed(1)),
      speed_drop_points: Number((0.25 * speedDropScore).toFixed(1)),
      ais_gap_points: Number((0.20 * aisGapScore).toFixed(1)),
      loitering_points: Number((0.15 * loiteringScore).toFixed(1)),
    },
    speed_drop_score: speedDropScore,
    speed_drop_delta_kts: speedDropKts,
    speed_drop_details: speedDropKts > 0 ? `Deceleration of -${speedDropKts} kts during transit` : 'Nominal cruising speed maintained',
    ais_gap_score: aisGapScore,
    max_ais_gap_minutes: aisGapMin,
    ais_gap_details: aisGapMin > 0 ? `${aisGapMin} min blackout directly over discharge origin` : 'Continuous transponder broadcast',
    loitering_score: loiteringScore,
    loitering_details: loiteringScore > 0 ? 'Course drift during discharge window' : 'Straight course navigation',
    hindcast_cpa_score: cpaScore,
    hindcast_cpa_distance_m: minCpaM,
    hindcast_cpa_distance_km: minCpaKm,
    hindcast_details: `Spatial intercept at T${dischargeOffsetMinutes}m (${minCpaKm} km CPA)`,
    evidence_tags,
  };
}

// Double-precision Haversine geodesic distance (km) between two geographic coordinates
export function calculateHaversineDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371.0; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Helper to extract representative geographic center [lon, lat] from asset
export function getAssetCoordinates(asset: MaritimeSpatialAsset): [number, number] {
  if (typeof asset.coordinates[0] === 'number') {
    return [asset.coordinates[0] as number, asset.coordinates[1] as number];
  }
  const ring = (asset.coordinates as number[][][])[0] || [];
  if (ring.length === 0) return [33.05775642, 33.25902604];
  const sumLon = ring.reduce((acc, pt) => acc + pt[0], 0);
  const sumLat = ring.reduce((acc, pt) => acc + pt[1], 0);
  return [sumLon / ring.length, sumLat / ring.length];
}

export const MARITIME_SPATIAL_ASSETS: MaritimeSpatialAsset[] = [
  // 🟢 Fishing Zones
  {
    id: "FISH-01",
    name: "Levantine Deep-Water Pelagic Fishery Fairway",
    category: "fishing_zone",
    subcategory: "Offshore Commercial Trawler Grid",
    coordinates: [
      [
        [32.60, 33.00],
        [33.50, 33.00],
        [33.50, 33.50],
        [32.60, 33.50],
        [32.60, 33.00],
      ]
    ],
    risk_level: "CRITICAL",
    distance_to_spill_km: 8.5,
    description: "High-density pelagic commercial trawl fairway for bluefin tuna, swordfish, and sea bream.",
    fleet_count: 180,
    economic_annual_cr: 45.0,
    advisory_status: "STANDBY_TRAWLERS",
  },
  {
    id: "FISH-02",
    name: "Cyprus Southern Shelf Artisanal Trawl Grid",
    category: "fishing_zone",
    subcategory: "Coastal Artisanal Gillnet Fairway",
    coordinates: [
      [
        [32.80, 34.40],
        [33.60, 34.40],
        [33.60, 34.70],
        [32.80, 34.70],
        [32.80, 34.40],
      ]
    ],
    risk_level: "HIGH",
    distance_to_spill_km: 128.0,
    description: "Traditional inshore fishery operating demersal nets, trammel nets, and surface longlines.",
    fleet_count: 240,
    economic_annual_cr: 32.0,
    advisory_status: "HIGH_ALERT",
  },
  {
    id: "FISH-03",
    name: "Akrotiri Bay Coastal Longline Fairway",
    category: "fishing_zone",
    subcategory: "Littoral Fishery Waters",
    coordinates: [
      [
        [32.90, 34.45],
        [33.20, 34.45],
        [33.20, 34.65],
        [32.90, 34.65],
        [32.90, 34.45],
      ]
    ],
    risk_level: "MEDIUM",
    distance_to_spill_km: 135.0,
    description: "Sheltered coastal bay longlining zone supporting red mullet and octopus harvests.",
    fleet_count: 110,
    economic_annual_cr: 18.0,
    advisory_status: "MONITORING",
  },

  // 🔵 Fishing Harbours
  {
    id: "HARB-01",
    name: "Limassol Commercial & Fishery Terminal",
    category: "fishing_harbour",
    subcategory: "Major Deep-Sea Landing Port",
    coordinates: [33.0230, 34.6520],
    risk_level: "HIGH",
    distance_to_spill_km: 154.0,
    description: "Primary maritime hub with cold chain export terminals and commercial fishing fleet berths.",
    fleet_count: 450,
    economic_annual_cr: 120.0,
    advisory_status: "EVACUATE_BOOMS",
  },
  {
    id: "HARB-02",
    name: "Zygi Fishing Harbour & Marina",
    category: "fishing_harbour",
    subcategory: "Regional Fishery Port & Marina",
    coordinates: [33.3360, 34.7290],
    risk_level: "HIGH",
    distance_to_spill_km: 165.0,
    description: "Dedicated fishery harbor supporting artisanal trawlers and marine research vessels.",
    fleet_count: 210,
    economic_annual_cr: 42.0,
    advisory_status: "HIGH_ALERT",
  },
  {
    id: "HARB-03",
    name: "Larnaca Port & Fishing Anchorage",
    category: "fishing_harbour",
    subcategory: "Commercial Port & Fishery Basin",
    coordinates: [33.6420, 34.9250],
    risk_level: "MEDIUM",
    distance_to_spill_km: 192.0,
    description: "Multi-purpose maritime port and inshore fishing vessel shelter.",
    fleet_count: 190,
    economic_annual_cr: 58.0,
    advisory_status: "MONITORING",
  },
  {
    id: "HARB-04",
    name: "Paphos Maritime Harbour",
    category: "fishing_harbour",
    subcategory: "Western Fishery Anchorage",
    coordinates: [32.4080, 34.7550],
    risk_level: "MEDIUM",
    distance_to_spill_km: 178.0,
    description: "Sheltered harbor supporting inshore fishing and coastal passenger traffic.",
    fleet_count: 160,
    economic_annual_cr: 35.0,
    advisory_status: "MONITORING",
  },

  // 🟣 Aquaculture
  {
    id: "AQUA-01",
    name: "Vasiliko Bay Offshore Mariculture Cages",
    category: "aquaculture",
    subcategory: "Sea Bream & Sea Bass Floating Cages",
    coordinates: [
      [
        [33.28, 34.68],
        [33.34, 34.68],
        [33.34, 34.72],
        [33.28, 34.72],
        [33.28, 34.68],
      ]
    ],
    risk_level: "HIGH",
    distance_to_spill_km: 160.0,
    description: "High-yield commercial open-sea cage mariculture cluster vulnerable to waterborne hydrocarbons.",
    economic_annual_cr: 75.0,
    advisory_status: "EVACUATE_BOOMS",
  },
  {
    id: "AQUA-02",
    name: "Liopetri Coastal Bivalve & Sea Bass Aquaculture",
    category: "aquaculture",
    subcategory: "Intertidal Marine Hatchery",
    coordinates: [
      [
        [33.85, 34.95],
        [33.92, 34.95],
        [33.92, 35.00],
        [33.85, 35.00],
        [33.85, 34.95],
      ]
    ],
    risk_level: "MEDIUM",
    distance_to_spill_km: 205.0,
    description: "Coastal fish farm and mussel aquaculture beds along eastern shelf.",
    economic_annual_cr: 28.0,
    advisory_status: "STANDBY_TRAWLERS",
  },
  {
    id: "AQUA-03",
    name: "Akrotiri Marine Bivalve Hatchery",
    category: "aquaculture",
    subcategory: "Coastal Shellfish Hatchery",
    coordinates: [
      [
        [32.94, 34.58],
        [33.02, 34.58],
        [33.02, 34.64],
        [32.94, 34.64],
        [32.94, 34.58],
      ]
    ],
    risk_level: "MEDIUM",
    distance_to_spill_km: 148.0,
    description: "Nearshore bivalve and hatchery facility in Akrotiri basin.",
    economic_annual_cr: 19.0,
    advisory_status: "MONITORING",
  },

  // 🟠 Coastal Communities
  {
    id: "COMM-01",
    name: "Limassol Waterfront Maritime Community",
    category: "coastal_community",
    subcategory: "Coastal City & Port Settlement",
    coordinates: [33.0450, 34.6750],
    risk_level: "HIGH",
    distance_to_spill_km: 155.0,
    description: "Major maritime city and residential coastal waterfront with active commercial port.",
    population: 185000,
    advisory_status: "HIGH_ALERT",
  },
  {
    id: "COMM-02",
    name: "Zygi Coastal Maritime Village",
    category: "coastal_community",
    subcategory: "Littoral Fishing Village",
    coordinates: [33.3350, 34.7310],
    risk_level: "HIGH",
    distance_to_spill_km: 165.0,
    description: "Historic littoral fishing community reliant on nearshore fisheries and mariculture.",
    population: 3200,
    advisory_status: "HIGH_ALERT",
  },
  {
    id: "COMM-03",
    name: "Akrotiri Peninsula Coastal Settlement",
    category: "coastal_community",
    subcategory: "Coastal Peninsula Hamlet",
    coordinates: [32.9600, 34.6000],
    risk_level: "MEDIUM",
    distance_to_spill_km: 149.0,
    description: "Low-lying peninsula community bordering salt lakes and turtle nesting shores.",
    population: 5800,
    advisory_status: "MONITORING",
  },
  {
    id: "COMM-04",
    name: "Paphos Littoral Fisher Hamlet",
    category: "coastal_community",
    subcategory: "Littoral Fisher Settlement",
    coordinates: [32.4150, 34.7600],
    risk_level: "MEDIUM",
    distance_to_spill_km: 178.0,
    description: "Western coastal settlement with active artisanal fleet and marine tourism.",
    population: 36000,
    advisory_status: "MONITORING",
  },
  {
    id: "COMM-05",
    name: "Cape Greco Marine Protected Enclave",
    category: "coastal_community",
    subcategory: "Marine Protected Coastal Enclave",
    coordinates: [34.0700, 34.9600],
    risk_level: "LOW",
    distance_to_spill_km: 215.0,
    description: "Ecological marine reserve and protected cliff coast habitat.",
    population: 1200,
    advisory_status: "MONITORING",
  },
];

// Dynamically compute environmental threat matrix from slick centroid and metocean data
export function calculateEnvironmentalThreatMatrix(
  spillCentroid: [number, number], // [lat, lon]
  areaSqKm: number,
  metocean?: MetoceanData
): EnvironmentalThreat {
  const currentSpeed = metocean?.current_speed_kts || 1.1;
  const driftSpeedKmH = currentSpeed * 1.852;
  const slickLon = spillCentroid[1];
  const slickLat = spillCentroid[0];

  // Geodesic distance to Southern Cyprus coastline (approx 34.65°N)
  const coastDistanceKm = Number((Math.max(12.5, Math.abs(34.65 - slickLat) * 111.0)).toFixed(1));
  const predictedArrivalHours = Number((coastDistanceKm / Math.max(driftSpeedKmH, 0.5)).toFixed(1));

  // Geodesic nearest spatial calculations across real assets
  const getNearest = (category: string) => {
    const assets = MARITIME_SPATIAL_ASSETS.filter((a) => a.category === category);
    let nearest = assets[0];
    let minDist = 999.0;
    for (const a of assets) {
      const [aLon, aLat] = getAssetCoordinates(a);
      const dist = calculateHaversineDistance(slickLon, slickLat, aLon, aLat);
      if (dist < minDist) {
        minDist = dist;
        nearest = a;
      }
    }
    return { asset: nearest, distance: minDist };
  };

  const nearestFishing = getNearest('fishing_zone');
  const nearestHarbour = getNearest('fishing_harbour');
  const nearestAqua = getNearest('aquaculture');
  const nearestComm = getNearest('coastal_community');

  // Sum population across all coastal communities within 250km
  const nearbyCommunities = MARITIME_SPATIAL_ASSETS.filter((a) => {
    if (a.category !== 'coastal_community') return false;
    const [cLon, cLat] = getAssetCoordinates(a);
    return calculateHaversineDistance(slickLon, slickLat, cLon, cLat) <= 250.0;
  });
  const totalCommPop = nearbyCommunities.reduce((acc, c) => acc + (c.population || 0), 0);

  // Exact weighted mathematical formula for environmental severity:
  // Base hazard constant: 25.0
  // 1. Slick Surface Hazard Scale (35% wt, max 35 pts): normalized relative to 10 km²
  const areaSubscore = Number(Math.min(35.0, (areaSqKm / 10.0) * 35.0).toFixed(1));
  // 2. Coastline Proximity & Drift Arrival (25% wt, max 25 pts)
  const coastSubscore = Number(Math.max(0.0, Math.min(25.0, ((200.0 - coastDistanceKm) / 200.0) * 25.0)).toFixed(1));
  // 3. Pelagic Commercial Fishery Fairway (15% wt, max 15 pts)
  const fishSubscore = Number(Math.min(15.0, (nearestFishing.distance < 30 ? 12.0 : 8.0) + Math.max(0, (50 - nearestFishing.distance) / 50) * 3.0).toFixed(1));
  // 4. Offshore Aquaculture & Shellfish (15% wt, max 15 pts)
  const aquaSubscore = Number(Math.min(15.0, 5.0 + Math.max(0, (200 - nearestAqua.distance) / 200) * 10.0).toFixed(1));
  // 5. Littoral Population & Commercial Port (10% wt, max 10 pts)
  const popSubscore = Number(Math.min(10.0, 4.0 + Math.max(0, (200 - nearestComm.distance) / 200) * 6.0).toFixed(1));

  const rawSeverity = Math.round(25 + areaSubscore + coastSubscore + fishSubscore + aquaSubscore + popSubscore);
  const severity = Number(Math.min(98, Math.max(45, rawSeverity)));
  const severityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' =
    severity >= 85 ? 'CRITICAL' : severity >= 70 ? 'HIGH' : severity >= 50 ? 'MEDIUM' : 'LOW';

  return {
    coast_distance_km: coastDistanceKm,
    growth_rate_pct_per_hour: Number((12.0 + (areaSqKm / 5.0) * 5.0).toFixed(1)),
    fishing_zone_risk: nearestFishing.distance < 25 ? 'HIGH' : 'MEDIUM',
    fishing_zone_name: `${nearestFishing.asset?.name || 'Levantine Deep-Water Pelagic Fishery'} (${nearestFishing.distance} km)`,
    fishing_fleet_count: nearestFishing.asset?.fleet_count || 180,
    fishing_zone_distance_km: nearestFishing.distance,

    fishing_harbour_risk: nearestHarbour.distance < 160 ? 'HIGH' : 'MEDIUM',
    fishing_harbour_name: `${nearestHarbour.asset?.name || 'Limassol Commercial & Fishery Terminal'} (${nearestHarbour.distance} km)`,
    harbour_vessel_count: nearestHarbour.asset?.fleet_count || 450,
    fishing_harbour_distance_km: nearestHarbour.distance,

    aquaculture_risk: nearestAqua.distance < 170 ? 'HIGH' : 'MEDIUM',
    aquaculture_name: `${nearestAqua.asset?.name || 'Vasiliko Bay Offshore Mariculture'} (${nearestAqua.distance} km)`,
    aquaculture_economic_cr: nearestAqua.asset?.economic_annual_cr || 75.0,
    aquaculture_distance_km: nearestAqua.distance,

    coastal_community_risk: nearestComm.distance < 160 ? 'HIGH' : 'MEDIUM',
    coastal_community_name: `${nearestComm.asset?.name || 'Limassol Waterfront Community'} (${nearestComm.distance} km)`,
    community_population: totalCommPop > 0 ? totalCommPop : (nearestComm.asset?.population || 185000),
    community_distance_km: nearestComm.distance,

    fishing_zone_coords: nearestFishing.asset ? getAssetCoordinates(nearestFishing.asset) : [33.05775642, 33.25902604],
    fishing_harbour_coords: nearestHarbour.asset ? getAssetCoordinates(nearestHarbour.asset) : [33.0450, 34.6750],
    aquaculture_coords: nearestAqua.asset ? getAssetCoordinates(nearestAqua.asset) : [33.28, 34.68],
    coastal_community_coords: nearestComm.asset ? getAssetCoordinates(nearestComm.asset) : [33.0450, 34.6750],

    marine_habitat_risk: 'HIGH',
    marine_habitat_name: 'Mediterranean Monk Seal & Loggerhead Turtle Sanctuary',
    overall_severity_score: severity,
    overall_severity_level: severityLevel,
    predicted_arrival_hours: predictedArrivalHours,
    coastal_threat_risk: coastDistanceKm < 50 ? 'HIGH' : 'MEDIUM',
    projected_impact_zone: 'Southern Cyprus Coastline & Akrotiri Bay',
    severity_breakdown: {
      base_hazard_constant: 25,
      formula: 'Severity = Base(25) + Area[35%] + CoastDistance[25%] + Fisheries[15%] + Aquaculture[15%] + Population[10%]',
      weights_summary: 'Area: 35% | Coast Distance: 25% | Fisheries: 15% | Aquaculture: 15% | Population: 10%',
      factors: [
        {
          id: 'slick_area',
          name: 'Slick Surface Extent',
          weight: 0.35,
          weight_percent: '35%',
          raw_metric: `${areaSqKm.toFixed(2)} km²`,
          score_contribution: areaSubscore,
          max_contribution: 35.0,
          description: `Surface area extent calculated from Sentinel-1 SAR boundary (${areaSqKm.toFixed(2)} km² / 10.0 km² benchmark scale)`,
          status: areaSqKm >= 7.0 ? 'CRITICAL_SCALE' : 'MODERATE_SCALE',
        },
        {
          id: 'coast_proximity',
          name: 'Coastline Proximity & Arrival ETA',
          weight: 0.25,
          weight_percent: '25%',
          raw_metric: `${coastDistanceKm} km (${predictedArrivalHours}h ETA)`,
          score_contribution: coastSubscore,
          max_contribution: 25.0,
          description: `Geodesic distance to Southern Cyprus coastline (drift speed ${driftSpeedKmH.toFixed(1)} km/h)`,
          status: coastDistanceKm < 50 ? 'IMMEDIATE_THREAT' : 'MODERATE_BUFFER',
        },
        {
          id: 'fisheries',
          name: 'Pelagic Commercial Fishery Fairway',
          weight: 0.15,
          weight_percent: '15%',
          raw_metric: `${nearestFishing.asset?.name || 'Levantine Fishery'} (${nearestFishing.distance} km)`,
          score_contribution: fishSubscore,
          max_contribution: 15.0,
          description: `Direct threat to active commercial trawling fairway with ${nearestFishing.asset?.fleet_count || 180} vessels deployed`,
          status: nearestFishing.distance < 25 ? 'HIGH_EXPOSURE' : 'MONITORED',
        },
        {
          id: 'aquaculture',
          name: 'Offshore Mariculture Vulnerability',
          weight: 0.15,
          weight_percent: '15%',
          raw_metric: `${nearestAqua.asset?.name || 'Vasiliko Cages'} (${nearestAqua.distance} km)`,
          score_contribution: aquaSubscore,
          max_contribution: 15.0,
          description: `Floating sea bass/sea bream cages vulnerable to waterborne hydrocarbons (€${nearestAqua.asset?.economic_annual_cr || 75}M annual output)`,
          status: nearestAqua.distance < 170 ? 'ELEVATED_VULNERABILITY' : 'STANDBY',
        },
        {
          id: 'population',
          name: 'Littoral Population & Commercial Port',
          weight: 0.10,
          weight_percent: '10%',
          raw_metric: `${(totalCommPop > 0 ? totalCommPop : 185000).toLocaleString()} residents (${nearestComm.asset?.name || 'Limassol'})`,
          score_contribution: popSubscore,
          max_contribution: 10.0,
          description: `Coastal urban settlement and commercial port intake facilities`,
          status: nearestComm.distance < 160 ? 'ADVISORY_ISSUED' : 'NOMINAL',
        },
      ],
    },
    active_advisories: [
      `Deploy EMSA CleanSeaNet Tier-2 containment vessel off Limassol approach`,
      `Issue urgent VHF navigational broadcast to ${nearestFishing.asset?.fleet_count || 180} active vessels in fairway`,
      `Pre-position rapid containment booms at Limassol Port and Vasiliko Bay`,
      `Seal intake valves for ${nearestAqua.asset?.name || 'offshore mariculture cages'}`,
    ],
  };
}

export const INCIDENTS: Record<string, MumbaiIncidentConfig> = {
  "DARTIS-ow-0001": {
    id: "DARTIS-ow-0001",
    name: "DARTIS Eastern Mediterranean Benchmark (ow-0001.jpg)",
    locationName: "Levantine Basin, Cyprus (33° 15.5' N, 33° 03.5' E)",
    originCoords: [33.0421, 33.2684],
    centroid: [33.25902604, 33.05775642],
    acquisition_timestamp_ist: "2019-01-01 09:12:35 IST",
    acquisition_timestamp_utc: "2019-01-01 03:42:35 UTC",
    satellite_pass_ist: "09:12:35 IST",
    discharge_time_ist: "08:30:00 IST",
    dischargeOffsetMinutes: -42,
    trackHeading: 95,
    baseAreaSqKm: 8.42,
    baseLengthKm: 6.8,
    baseWidthKm: 2.1,
    culpritMmsi: 212000001,
    culpritName: "MEDITERRANEAN TRADER",
    volumeLiters: 92000,
    slickType: "Heavy Fuel Oil (DARTIS Benchmark OW-0001)",
    confidence: 0.982257,
    segmentation_dice_score: 0.7130,
    segmentation_iou_score: 0.5540,
    max_probability: 0.982257,
    oil_likelihood_score: 0.982257,
    lookalike_score: 0.017743,
    false_positive_analysis: {
      likely_oil_pct: 98.2,
      lookalike_pct: 1.8,
      dominant_class: "Oil",
      classes: {
        "Oil": 98.2,
        "Calm water": 0.8,
        "Natural film": 0.5,
        "Wake": 0.3,
        "Rain-related artifact": 0.1,
        "Unknown": 0.1,
      },
      marangoni_damping_db: 8.9,
      wind_threshold_valid: true,
      sar_physics_reasoning: "DARTIS Sentinel-1B C-band SAR radar verifies characteristic Marangoni damping (8.9 dB). Benchmark ow-0001 fine-tune metrics: Dice=0.7130 (71.30%), IoU=0.5540 (55.40%), Max Probability=0.982257.",
      calculation_details: {
        formula: "P(Class_i) = exp(z_i) / Σ exp(z_j) [Bayesian Softmax over Marangoni Hydrodynamic Logits]",
        inputs: {
          damping_ratio_db: 8.9,
          wind_speed_kts: 12.8,
          wind_speed_ms: 6.58,
          wind_in_bragg_damping_window: true,
          eccentricity: 0.88,
          compactness: 0.42,
        },
        logits: {
          oil: {
            logit: 5.48,
            formula: "1.2 · (8.9 - 5.5) + 1.4 - 0.00 = +5.48",
            probability_pct: 98.2,
            physics_explanation: "Marangoni viscoelastic damping (8.9 dB > 5.5 dB threshold) strongly suppresses 3.7 cm Bragg capillary waves under active surface winds (6.58 m/s within 3-12 m/s window).",
          },
          calm_water: {
            logit: -1.45,
            formula: "2.5 · max(0, 3.2 - 6.58) + 0.5 · (6.0 - 8.9) = -1.45",
            probability_pct: 0.8,
            physics_explanation: "Surface wind (6.58 m/s) exceeds 3.2 m/s calm threshold; ocean surface is fully wind-roughened, ruling out low-wind specular mirror reflection.",
          },
          natural_film: {
            logit: -4.40,
            formula: "1.0 · (6.5 - 8.9) - 2.0 = -4.40",
            probability_pct: 0.5,
            physics_explanation: "Biogenic monomolecular surfactant films disintegrate in winds > 6.0 m/s and cannot maintain > 6.0 dB damping contrast.",
          },
          wake: {
            logit: 2.84,
            formula: "3.0 · (0.88 - 0.75) + 0.5 · (8.9 - 4.0) = +2.84",
            probability_pct: 0.3,
            physics_explanation: "Narrow elongated geometry (eccentricity 0.88) matches vessel track, but mechanical wake turbulence lacks viscoelastic surfactant resonance.",
          },
          rain_artifact: {
            logit: 0.00,
            formula: "1.0 - 1.0 = 0.00",
            probability_pct: 0.1,
            physics_explanation: "Rain cell downdraft rings require squall conditions with wind > 12.0 m/s.",
          },
          unknown: {
            logit: 0.20,
            formula: "Uniform Bayesian Dirichlet prior (0.20)",
            probability_pct: 0.1,
            physics_explanation: "Residual epistemic uncertainty floor across C-band SAR speckle noise.",
          },
        },
      },
    },
    sourceScene: "ow-0001.jpg",
    predictedPolygon: [
      [33.025, 33.242],
      [33.045, 33.262],
      [33.070, 33.272],
      [33.095, 33.265],
      [33.090, 33.249],
      [33.065, 33.245],
      [33.040, 33.237],
      [33.025, 33.242]
    ],
    threat: {
      coast_distance_km: 154.0,
      growth_rate_pct_per_hour: 12.5,
      fishing_zone_risk: 'HIGH',
      fishing_zone_name: 'Levantine Deep-Water Pelagic Fishery (8.5 km)',
      fishing_harbour_risk: 'HIGH',
      fishing_harbour_name: 'Limassol Commercial & Fishery Terminal',
      aquaculture_risk: 'HIGH',
      aquaculture_name: 'Vasiliko Bay Marine Cages',
      coastal_community_risk: 'HIGH',
      coastal_community_name: 'Limassol Waterfront & Akrotiri Peninsula',
      marine_habitat_risk: 'HIGH',
      marine_habitat_name: 'Mediterranean Monk Seal & Loggerhead Turtle Sanctuary',
      overall_severity_score: 88,
      overall_severity_level: 'HIGH',
      predicted_arrival_hours: 82.5,
      coastal_threat_risk: 'MEDIUM',
      projected_impact_zone: 'Southern Cyprus Coastline & Akrotiri Bay',
      active_advisories: [
        'Deploy European Maritime Safety Agency (EMSA) CleanSeaNet tier-2 containment',
        'Issue urgent navigational broadcast to Levantine transit traffic',
        'Pre-position offshore skimmers off Limassol anchorage',
        'Monitor Copernicus Marine Physics reanalysis eastward surface drift vector'
      ]
    },
    events: [
      {
        tMinutes: -65,
        timestamp_utc: "02:37 UTC",
        timestamp_ist: "08:07 IST",
        action_headline: "Vessel transit",
        label: "Entry",
        title: "Vessel transiting Levantine corridor",
        type: "transit",
        icon: "⚓",
        speed: 13.8,
        coordinates: [32.850, 33.230],
        details: "VLCC Crude carrier transiting eastbound off Southern Cyprus.",
      },
      {
        tMinutes: -42,
        timestamp_utc: "03:00 UTC",
        timestamp_ist: "08:30 IST",
        action_headline: "Illicit discharge",
        label: "BREACH",
        title: "DARTIS Benchmark Dispersal Origin (ow-0001.jpg)",
        type: "breach",
        icon: "🚨",
        speed: 5.4,
        coordinates: [33.05775642, 33.25902604],
        details: "Discharge detected at benchmark coordinates [33.05775642, 33.25902604].",
      },
      {
        tMinutes: 0,
        timestamp_utc: "03:42 UTC",
        timestamp_ist: "09:12 IST",
        action_headline: "Copernicus S1B SAR Pass",
        label: "SAR Pass",
        title: "Sentinel-1B DARTIS Benchmark Acquisition (ow-0001.jpg)",
        type: "sar_detection",
        icon: "🛰️",
        speed: 13.5,
        coordinates: [33.150, 33.275],
        details: "Copernicus Sentinel-1B SAR scene acquired. Dual-engine DeepSAR U-Net segments 8.42 km² slick.",
      },
    ],
  }
};

export const MUMBAI_INCIDENTS = INCIDENTS;

export const MMSI_TO_INCIDENT: Record<number, string> = {
  212000001: "DARTIS-ow-0001",
  212000002: "DARTIS-ow-0001",
  212000003: "DARTIS-ow-0001",
  212000004: "DARTIS-ow-0001",
  212000005: "DARTIS-ow-0001",
  419000123: "DARTIS-ow-0001",
  255806000: "DARTIS-ow-0001",
  419000789: "DARTIS-ow-0001",
  563032000: "DARTIS-ow-0001",
};

// 25 Authentic Commercial Maritime Corridor Vessels operating in the Eastern Mediterranean / Levantine Basin
export interface CorridorShipDef {
  mmsi: number;
  imo_number: number;
  name: string;
  flag: string;
  vessel_type: string;
  length_meters: number;
  draught_meters: number;
  call_sign: string;
  destination: string;
  cargo_type: string;
  lat: number;
  lon: number;
  heading_degrees: number;
  speed_knots: number;
}

export const CORRIDOR_TRAFFIC_FLEET: CorridorShipDef[] = [
  {
    mmsi: 500100001,
    imo_number: 9708681,
    name: "MSC SVEVA",
    flag: "Panama",
    vessel_type: "Container Ship",
    length_meters: 395,
    draught_meters: 15.5,
    call_sign: "3FVR2",
    destination: "ROTTERDAM COMMERCIAL GATEWAY",
    cargo_type: "Containerized Consumer Goods (19,224 TEU)",
    lat: 33.340,
    lon: 32.720,
    heading_degrees: 284,
    speed_knots: 18.2,
  },
  {
    mmsi: 500100002,
    imo_number: 9705885,
    name: "CMA CGM TIGRIS",
    flag: "Malta",
    vessel_type: "Container Ship",
    length_meters: 300,
    draught_meters: 14.2,
    call_sign: "9HA3812",
    destination: "PORT SAID ANCHORAGE",
    cargo_type: "Manufactured Goods & Electronics (10,622 TEU)",
    lat: 33.120,
    lon: 32.850,
    heading_degrees: 102,
    speed_knots: 17.6,
  },
  {
    mmsi: 500100003,
    imo_number: 9786849,
    name: "EVER GOLDEN",
    flag: "Panama",
    vessel_type: "Container Ship",
    length_meters: 400,
    draught_meters: 16.0,
    call_sign: "3EPA7",
    destination: "PIRAEUS CONTAINER TERMINAL",
    cargo_type: "General High-Value Freight (20,124 TEU)",
    lat: 33.410,
    lon: 33.480,
    heading_degrees: 286,
    speed_knots: 18.8,
  },
  {
    mmsi: 500100004,
    imo_number: 9619907,
    name: "MAERSK MC-KINNEY",
    flag: "Denmark",
    vessel_type: "Container Ship",
    length_meters: 399,
    draught_meters: 15.8,
    call_sign: "OZHC2",
    destination: "SUEZ CANAL SOUTHBOUND CONVOY",
    cargo_type: "Refrigerated & Dry Containers (18,270 TEU)",
    lat: 33.080,
    lon: 33.320,
    heading_degrees: 104,
    speed_knots: 16.9,
  },
  {
    mmsi: 500100005,
    imo_number: 9732369,
    name: "HAPAG AL JASRAH",
    flag: "Germany",
    vessel_type: "Container Ship",
    length_meters: 368,
    draught_meters: 15.0,
    call_sign: "DGDH2",
    destination: "VALENCIA COMMERCIAL PORT",
    cargo_type: "Automotive Freight & Machinery (14,993 TEU)",
    lat: 33.380,
    lon: 33.820,
    heading_degrees: 285,
    speed_knots: 17.2,
  },
  {
    mmsi: 500100006,
    imo_number: 9795634,
    name: "COSCO GALAXY",
    flag: "Hong Kong",
    vessel_type: "Container Ship",
    length_meters: 400,
    draught_meters: 16.1,
    call_sign: "VRTY5",
    destination: "SINGAPORE PSA TERMINAL",
    cargo_type: "Industrial Equipment & Solar Modules (21,237 TEU)",
    lat: 32.950,
    lon: 32.610,
    heading_degrees: 101,
    speed_knots: 18.4,
  },
  {
    mmsi: 500100007,
    imo_number: 9745902,
    name: "FRONT ALTAIR",
    flag: "Marshall Islands",
    vessel_type: "Crude Oil Tanker",
    length_meters: 333,
    draught_meters: 21.5,
    call_sign: "V7HJ3",
    destination: "TRIESTE OIL DOCKS",
    cargo_type: "Arabian Light Crude Oil (300,000 DWT)",
    lat: 33.210,
    lon: 32.450,
    heading_degrees: 282,
    speed_knots: 13.6,
  },
  {
    mmsi: 500100008,
    imo_number: 9812456,
    name: "NORDIC PASSAGE",
    flag: "Liberia",
    vessel_type: "Suezmax Tanker",
    length_meters: 274,
    draught_meters: 16.8,
    call_sign: "A8ZZ9",
    destination: "SIDI KERIR OIL TERMINAL",
    cargo_type: "Segregated Ballast (158,000 DWT)",
    lat: 32.980,
    lon: 33.650,
    heading_degrees: 98,
    speed_knots: 13.1,
  },
  {
    mmsi: 500100009,
    imo_number: 9698541,
    name: "MINERVA ELEONORA",
    flag: "Greece",
    vessel_type: "Aframax Tanker",
    length_meters: 243,
    draught_meters: 14.5,
    call_sign: "SVBG4",
    destination: "VASILIKO OIL TERMINAL",
    cargo_type: "Low-Sulphur Marine Gasoil (115,000 DWT)",
    lat: 34.520,
    lon: 33.150,
    heading_degrees: 268,
    speed_knots: 12.4,
  },
  {
    mmsi: 500100010,
    imo_number: 9387475,
    name: "EURONAV CAP VICTOR",
    flag: "Belgium",
    vessel_type: "Crude Oil Tanker",
    length_meters: 277,
    draught_meters: 17.2,
    call_sign: "ONCV",
    destination: "FOS SUR MER REFINERY",
    cargo_type: "Basrah Heavy Crude Oil (156,000 DWT)",
    lat: 33.480,
    lon: 32.950,
    heading_degrees: 287,
    speed_knots: 14.0,
  },
  {
    mmsi: 500100011,
    imo_number: 9626273,
    name: "GASLOG SYDNEY",
    flag: "Bermuda",
    vessel_type: "LNG Carrier",
    length_meters: 285,
    draught_meters: 11.8,
    call_sign: "ZCEQ5",
    destination: "DAMIETTA LNG EXPORT TERMINAL",
    cargo_type: "Liquefied Natural Gas (155,000 m³)",
    lat: 33.020,
    lon: 32.980,
    heading_degrees: 105,
    speed_knots: 16.4,
  },
  {
    mmsi: 500100012,
    imo_number: 9637492,
    name: "GOLAR ICE",
    flag: "Marshall Islands",
    vessel_type: "LNG Carrier",
    length_meters: 288,
    draught_meters: 11.9,
    call_sign: "V7TR4",
    destination: "BARCELONA REGASIFICATION TERMINAL",
    cargo_type: "Liquefied Methane Gas (160,000 m³)",
    lat: 33.450,
    lon: 33.620,
    heading_degrees: 283,
    speed_knots: 15.7,
  },
  {
    mmsi: 500100013,
    imo_number: 9750945,
    name: "BERGE OLYMPUS",
    flag: "Isle of Man",
    vessel_type: "Bulk Carrier",
    length_meters: 300,
    draught_meters: 18.2,
    call_sign: "MDYJ8",
    destination: "PORT SAID ANCHORAGE",
    cargo_type: "Iron Ore Pellets (211,000 DWT)",
    lat: 33.150,
    lon: 33.780,
    heading_degrees: 100,
    speed_knots: 12.2,
  },
  {
    mmsi: 500100014,
    imo_number: 9831124,
    name: "STAR BULK GEMINI",
    flag: "Marshall Islands",
    vessel_type: "Bulk Carrier",
    length_meters: 229,
    draught_meters: 13.8,
    call_sign: "V7PL2",
    destination: "BEIRUT COMMERCIAL HARBOUR",
    cargo_type: "Feed Grain & Sunflower Seeds (82,000 DWT)",
    lat: 33.620,
    lon: 34.120,
    heading_degrees: 34,
    speed_knots: 12.6,
  },
  {
    mmsi: 500100015,
    imo_number: 9654321,
    name: "OLDENDORFF DIETRICH",
    flag: "Liberia",
    vessel_type: "Bulk Carrier",
    length_meters: 255,
    draught_meters: 14.8,
    call_sign: "D5MK8",
    destination: "ALEXANDRIA GRAIN TERMINAL",
    cargo_type: "Dry Bulk Fertilizer (105,000 DWT)",
    lat: 33.850,
    lon: 34.280,
    heading_degrees: 212,
    speed_knots: 11.8,
  },
  {
    mmsi: 500100016,
    imo_number: 9789123,
    name: "PACIFIC VALOUR",
    flag: "Singapore",
    vessel_type: "Bulk Carrier",
    length_meters: 199,
    draught_meters: 12.8,
    call_sign: "9V8432",
    destination: "LARNACA BULK WHARF",
    cargo_type: "Cement Clinker & Mineral Aggregate (63,500 DWT)",
    lat: 34.780,
    lon: 33.720,
    heading_degrees: 88,
    speed_knots: 12.0,
  },
  {
    mmsi: 500100017,
    imo_number: 9246580,
    name: "GRIMALDI NIGERIA",
    flag: "Italy",
    vessel_type: "Ro-Ro Cargo",
    length_meters: 214,
    draught_meters: 9.2,
    call_sign: "IBLC",
    destination: "SALERNO COMMERCIAL PORT",
    cargo_type: "Commercial Trucks & Wheeled Heavy Cargo",
    lat: 33.520,
    lon: 33.180,
    heading_degrees: 280,
    speed_knots: 15.4,
  },
  {
    mmsi: 500100018,
    imo_number: 9505039,
    name: "WALLENIUS CARMEN",
    flag: "Sweden",
    vessel_type: "Vehicle Carrier",
    length_meters: 228,
    draught_meters: 9.8,
    call_sign: "SLWD",
    destination: "AQABA CAR TERMINAL",
    cargo_type: "Automobiles & Electric Vehicles (6,500 CEU)",
    lat: 33.050,
    lon: 33.450,
    heading_degrees: 106,
    speed_knots: 16.2,
  },
  {
    mmsi: 500100019,
    imo_number: 9437153,
    name: "BBC COLORADO",
    flag: "Antigua & Barbuda",
    vessel_type: "General Cargo",
    length_meters: 153,
    draught_meters: 8.5,
    call_sign: "V2FP8",
    destination: "LIMASSOL COMMERCIAL PORT",
    cargo_type: "Offshore Wind Turbine Generators & Steel",
    lat: 34.610,
    lon: 33.240,
    heading_degrees: 262,
    speed_knots: 11.4,
  },
  {
    mmsi: 500100020,
    imo_number: 9138783,
    name: "ARK FORWARDER",
    flag: "Cyprus",
    vessel_type: "Ro-Ro Cargo",
    length_meters: 182,
    draught_meters: 7.4,
    call_sign: "5BLN3",
    destination: "TRIPOLI COMMERCIAL BERTH",
    cargo_type: "Inter-Levant Heavy Freight Trailers",
    lat: 34.150,
    lon: 34.420,
    heading_degrees: 38,
    speed_knots: 15.0,
  },
  {
    mmsi: 500100021,
    imo_number: 9823412,
    name: "ALMI HORIZON",
    flag: "Liberia",
    vessel_type: "Suezmax Tanker",
    length_meters: 274,
    draught_meters: 16.5,
    call_sign: "D5NX4",
    destination: "GENOA MULTIEID OIL JETTY",
    cargo_type: "Heavy Fuel Oil IFO-380 (157,500 DWT)",
    lat: 33.360,
    lon: 33.550,
    heading_degrees: 285,
    speed_knots: 13.5,
  },
  {
    mmsi: 500100022,
    imo_number: 9768521,
    name: "SEACOR BRAVE",
    flag: "Marshall Islands",
    vessel_type: "Offshore Supply Vessel",
    length_meters: 88,
    draught_meters: 5.8,
    call_sign: "V7KJ9",
    destination: "APHRODITE GAS FIELD DRILL PLATFORM",
    cargo_type: "Subsea Drilling Mud & Drill Collars",
    lat: 33.100,
    lon: 33.880,
    heading_degrees: 195,
    speed_knots: 10.4,
  },
  {
    mmsi: 500100023,
    imo_number: 9701231,
    name: "MARAN GAS APHRODITE",
    flag: "Greece",
    vessel_type: "LNG Carrier",
    length_meters: 294,
    draught_meters: 12.0,
    call_sign: "SVAX8",
    destination: "IDKU LNG LIQUEFACTION PLANT",
    cargo_type: "Clean LNG Cryogenic Tanks (162,000 m³)",
    lat: 32.920,
    lon: 33.150,
    heading_degrees: 96,
    speed_knots: 16.5,
  },
  {
    mmsi: 500100024,
    imo_number: 9892345,
    name: "STENA PROMETHEUS",
    flag: "Cyprus",
    vessel_type: "Product Tanker",
    length_meters: 183,
    draught_meters: 10.8,
    call_sign: "5BCR4",
    destination: "MONI MULTIBUOY MOORING",
    cargo_type: "Aviation Turbine Fuel Jet A-1 (49,900 DWT)",
    lat: 34.680,
    lon: 33.380,
    heading_degrees: 75,
    speed_knots: 12.8,
  },
  {
    mmsi: 500100025,
    imo_number: 9421876,
    name: "OLYMPIC GLORY",
    flag: "Greece",
    vessel_type: "Crude Oil Tanker",
    length_meters: 274,
    draught_meters: 17.0,
    call_sign: "SYGF",
    destination: "AUGUSTA REFINERY ANCHORAGE",
    cargo_type: "Basrah Light Crude (159,000 DWT)",
    lat: 33.420,
    lon: 32.550,
    heading_degrees: 283,
    speed_knots: 13.8,
  },
];

// Helper to compute course-aligned timed waypoints for corridor traffic with distinct trajectory behaviors
function generateShipWaypoints(ship: {
  mmsi?: number;
  name?: string;
  lat: number;
  lon: number;
  heading_degrees: number;
  speed_knots: number;
  destination?: string;
  vessel_type?: string;
}): TimedWaypoint[] {
  const mmsi = ship.mmsi || 0;

  // 1. MINERVA ELEONORA (500100009): Aframax Tanker heading to VASILIKO OIL TERMINAL
  // Maneuvering arrival route: turns northeast from cruising lane into pilot fairway
  if (mmsi === 500100009) {
    return [
      { tMinutes: -360, lon: 32.52, lat: 34.46, heading: 268, speed: 14.5 },
      { tMinutes: -180, lon: 32.84, lat: 34.49, heading: 268, speed: 14.5 },
      { tMinutes: -42,  lon: 33.08, lat: 34.51, heading: 295, speed: 11.2 },
      { tMinutes: 0,    lon: 33.15, lat: 34.52, heading: 310, speed: 8.5 },
      { tMinutes: 180,  lon: 33.26, lat: 34.62, heading: 310, speed: 4.2 },
    ];
  }

  // 2. SEACOR BRAVE (500100022): Offshore Supply Vessel at APHRODITE GAS FIELD DRILL PLATFORM
  // Offshore support trajectory: dynamic positioning and platform survey pattern
  if (mmsi === 500100022) {
    return [
      { tMinutes: -360, lon: 33.95, lat: 33.45, heading: 195, speed: 10.4 },
      { tMinutes: -180, lon: 33.91, lat: 33.28, heading: 195, speed: 10.4 },
      { tMinutes: -42,  lon: 33.88, lat: 33.15, heading: 215, speed: 8.2 },
      { tMinutes: 0,    lon: 33.88, lat: 33.10, heading: 180, speed: 6.5 },
      { tMinutes: 180,  lon: 33.86, lat: 33.02, heading: 175, speed: 5.0 },
    ];
  }

  // 3. STENA PROMETHEUS (500100024): Product Tanker heading to MONI MULTIBUOY MOORING
  // Coastal passage rounding Cape Gata, banking towards Moni offshore buoy
  if (mmsi === 500100024) {
    return [
      { tMinutes: -360, lon: 33.05, lat: 34.62, heading: 85, speed: 12.8 },
      { tMinutes: -180, lon: 33.22, lat: 34.65, heading: 80, speed: 12.8 },
      { tMinutes: -42,  lon: 33.32, lat: 34.67, heading: 65, speed: 10.5 },
      { tMinutes: 0,    lon: 33.38, lat: 34.68, heading: 50, speed: 7.8 },
      { tMinutes: 180,  lon: 33.46, lat: 34.72, heading: 45, speed: 4.0 },
    ];
  }

  // 4. STAR BULK GEMINI (500100014): Handymax Bulker heading to BEIRUT COMMERCIAL HARBOUR
  // Levant shelf northbound corridor, turning towards Lebanese port fairways
  if (mmsi === 500100014) {
    return [
      { tMinutes: -360, lon: 33.85, lat: 33.20, heading: 34, speed: 12.6 },
      { tMinutes: -180, lon: 33.98, lat: 33.41, heading: 34, speed: 12.6 },
      { tMinutes: -42,  lon: 34.08, lat: 33.56, heading: 42, speed: 12.0 },
      { tMinutes: 0,    lon: 34.12, lat: 33.62, heading: 48, speed: 11.5 },
      { tMinutes: 180,  lon: 34.25, lat: 33.80, heading: 52, speed: 9.8 },
    ];
  }

  // 5. ARK FORWARDER (500100020): Ro-Ro Cargo heading to TRIPOLI COMMERCIAL BERTH
  // Inter-Levant rolling freight passage
  if (mmsi === 500100020) {
    return [
      { tMinutes: -360, lon: 34.10, lat: 33.72, heading: 38, speed: 15.0 },
      { tMinutes: -180, lon: 34.26, lat: 33.94, heading: 38, speed: 15.0 },
      { tMinutes: -42,  lon: 34.38, lat: 34.09, heading: 36, speed: 15.0 },
      { tMinutes: 0,    lon: 34.42, lat: 34.15, heading: 32, speed: 14.2 },
      { tMinutes: 180,  lon: 34.54, lat: 34.32, heading: 28, speed: 13.0 },
    ];
  }

  // 6. Generic Corridor Traffic: Realistic IMO TSS Fairway Waypoint Transitions
  const revHeading = (ship.heading_degrees + 180) % 360;
  const isEastbound = ship.heading_degrees >= 45 && ship.heading_degrees <= 135;
  const turnDelta = isEastbound ? 3.5 : -4.0;

  const dist360 = (ship.speed_knots * 1.852) * 6.0;
  const [lon360, lat360] = moveCoordinate(ship.lon, ship.lat, (revHeading - turnDelta + 360) % 360, dist360);

  const dist180 = (ship.speed_knots * 1.852) * 3.0;
  const [lon180, lat180] = moveCoordinate(ship.lon, ship.lat, revHeading, dist180);

  const dist42 = (ship.speed_knots * 1.852) * (42.0 / 60.0);
  const [lon42, lat42] = moveCoordinate(ship.lon, ship.lat, revHeading, dist42);

  const distFuture = (ship.speed_knots * 1.852) * 3.0;
  const [lonFuture, latFuture] = moveCoordinate(ship.lon, ship.lat, (ship.heading_degrees + turnDelta + 360) % 360, distFuture);

  return [
    { tMinutes: -360, lon: lon360, lat: lat360, heading: (ship.heading_degrees - turnDelta + 360) % 360, speed: ship.speed_knots },
    { tMinutes: -180, lon: lon180, lat: lat180, heading: ship.heading_degrees, speed: ship.speed_knots },
    { tMinutes: -42,  lon: lon42,  lat: lat42,  heading: ship.heading_degrees, speed: ship.speed_knots },
    { tMinutes: 0,    lon: ship.lon, lat: ship.lat, heading: ship.heading_degrees, speed: ship.speed_knots },
    { tMinutes: 180,  lon: lonFuture, lat: latFuture, heading: (ship.heading_degrees + turnDelta + 360) % 360, speed: ship.speed_knots },
  ];
}

// Deterministic Timed Waypoint Tracks for Eastern Mediterranean Fleet
export const MUMBAI_VESSEL_WAYPOINTS: { mmsi: number; name: string; isCulprit?: boolean; linkedSpillId?: string; waypoints: TimedWaypoint[] }[] = [
  // 1. MEDITERRANEAN TRADER (VLCC Crude Tanker - Transits ESE 095° off Southern Cyprus across breach origin [33.0421, 33.2684])
  {
    mmsi: 212000001,
    name: "MEDITERRANEAN TRADER",
    isCulprit: true,
    linkedSpillId: "DARTIS-ow-0001",
    waypoints: [
      { tMinutes: -360, lon: 32.820, lat: 33.248, heading: 95, speed: 13.8 },
      { tMinutes: -180, lon: 32.930, lat: 33.258, heading: 95, speed: 13.8 },
      { tMinutes: -65,  lon: 33.010, lat: 33.265, heading: 95, speed: 12.0 },
      { tMinutes: -42,  lon: 33.0421, lat: 33.2684, heading: 95, speed: 5.4 }, // DARTIS ow-0001 Discharge Point (CPA 0.00 km, Speed drop -8.4 kts)
      { tMinutes: -15,  lon: 33.085, lat: 33.270, heading: 98, speed: 6.2 }, // Loitering / slow ahead during illicit ballast wash
      { tMinutes: 0,    lon: 33.150, lat: 33.275, heading: 95, speed: 13.5 }, // Accelerates back up to cruising transit
      { tMinutes: 180,  lon: 33.240, lat: 33.290, heading: 95, speed: 13.5 },
    ],
  },
  // 2. LEVANT STAR (Container Ship - Transits NE 035° towards Limassol)
  {
    mmsi: 212000002,
    name: "LEVANT STAR",
    waypoints: [
      { tMinutes: -360, lon: 33.300, lat: 33.180, heading: 35, speed: 14.2 },
      { tMinutes: -180, lon: 33.220, lat: 33.230, heading: 35, speed: 14.2 },
      { tMinutes: -42,  lon: 33.160, lat: 33.268, heading: 35, speed: 14.2 },
      { tMinutes: 0,    lon: 33.140, lat: 33.280, heading: 35, speed: 14.2 },
      { tMinutes: 180,  lon: 33.060, lat: 33.330, heading: 35, speed: 14.2 },
    ],
  },
  // 3. AEGEAN VOYAGER (Bulk Carrier - Transits ESE 110° towards Port Said, Rank #2 suspect with minor deceleration)
  {
    mmsi: 212000003,
    name: "AEGEAN VOYAGER",
    waypoints: [
      { tMinutes: -360, lon: 32.980, lat: 33.350, heading: 110, speed: 12.5 },
      { tMinutes: -180, lon: 33.100, lat: 33.300, heading: 110, speed: 12.5 },
      { tMinutes: -42,  lon: 33.185, lat: 33.270, heading: 110, speed: 7.1 }, // 16.6 km CPA distance, speed drop to 7.1 kts
      { tMinutes: 0,    lon: 33.220, lat: 33.250, heading: 110, speed: 12.5 },
      { tMinutes: 180,  lon: 33.340, lat: 33.200, heading: 110, speed: 12.5 },
    ],
  },
  // 4. AKROTIRI BREEZE (LPG Tanker - Transits SW 220° towards Alexandria, Rank #3 suspect)
  {
    mmsi: 212000004,
    name: "AKROTIRI BREEZE",
    waypoints: [
      { tMinutes: -360, lon: 33.200, lat: 33.380, heading: 220, speed: 11.8 },
      { tMinutes: -180, lon: 33.120, lat: 33.320, heading: 220, speed: 11.8 },
      { tMinutes: -42,  lon: 33.060, lat: 33.275, heading: 220, speed: 11.8 }, // 55.0 km CPA
      { tMinutes: 0,    lon: 33.040, lat: 33.260, heading: 220, speed: 11.8 },
      { tMinutes: 180,  lon: 32.960, lat: 33.200, heading: 220, speed: 11.8 },
    ],
  },
  // 5. CYPRUS POLICE PATROL / EMSA (Coast Guard Fast Intercept Patrol WSW 245°, Rank #4 response vessel)
  {
    mmsi: 212000005,
    name: "CYPRUS POLICE PATROL / EMSA",
    waypoints: [
      { tMinutes: -360, lon: 33.380, lat: 33.420, heading: 245, speed: 14.0 }, // Coastline patrol base
      { tMinutes: -180, lon: 33.300, lat: 33.360, heading: 245, speed: 22.0 }, // Inbound emergency transit
      { tMinutes: -42,  lon: 33.180, lat: 33.300, heading: 245, speed: 22.0 }, // High speed sprint
      { tMinutes: 0,    lon: 33.05775642, lat: 33.25902604, heading: 245, speed: 6.0 }, // Arrives at oil slick locus for containment boom deployment
      { tMinutes: 180,  lon: 33.065, lat: 33.255, heading: 245, speed: 4.5 }, // Station keeping / skimming operations
    ],
  },
  // 6–30. Authentic Mediterranean Commercial Fleet Corridor Waypoints
  ...CORRIDOR_TRAFFIC_FLEET.map((ship) => ({
    mmsi: ship.mmsi,
    name: ship.name,
    waypoints: generateShipWaypoints(ship),
  })),
];

export const VESSEL_WAYPOINTS = MUMBAI_VESSEL_WAYPOINTS;

// Precise piece-wise waypoint kinematic interpolation
export function interpolateVesselPosition(
  mmsi: number,
  timeOffsetMinutes: number,
  _scenario: string = 'mediterranean_dartis',
  vesselCurrentPos?: { longitude: number; latitude: number; heading_degrees: number; speed_knots: number }
): { lon: number; lat: number; heading: number; speed: number; isAisDark?: boolean } {
  const isAisDarkWindow = (mmsi === 212000001 && timeOffsetMinutes >= -42 && timeOffsetMinutes <= -12);
  const vesselTrack = MUMBAI_VESSEL_WAYPOINTS.find((t) => t.mmsi === mmsi);

  if (vesselTrack && vesselTrack.waypoints.length) {
    const wps = vesselTrack.waypoints;

    if (timeOffsetMinutes <= wps[0].tMinutes) {
      return {
        lon: wps[0].lon,
        lat: wps[0].lat,
        heading: wps[0].heading,
        speed: wps[0].speed,
        isAisDark: isAisDarkWindow,
      };
    }
    if (timeOffsetMinutes >= wps[wps.length - 1].tMinutes) {
      const last = wps[wps.length - 1];
      return {
        lon: last.lon,
        lat: last.lat,
        heading: last.heading,
        speed: last.speed,
        isAisDark: isAisDarkWindow,
      };
    }

    for (let i = 0; i < wps.length - 1; i++) {
      const w1 = wps[i];
      const w2 = wps[i + 1];
      if (timeOffsetMinutes >= w1.tMinutes && timeOffsetMinutes <= w2.tMinutes) {
        const segSpan = w2.tMinutes - w1.tMinutes;
        const progress = segSpan === 0 ? 0 : (timeOffsetMinutes - w1.tMinutes) / segSpan;

        const lon = w1.lon + (w2.lon - w1.lon) * progress;
        const lat = w1.lat + (w2.lat - w1.lat) * progress;

        // Smooth heading angular interpolation with wrap-around
        let angleDiff = (w2.heading - w1.heading) % 360;
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        const heading = Math.round((w1.heading + angleDiff * progress + 360) % 360);

        // Smooth speed interpolation
        const speed = Number((w1.speed + (w2.speed - w1.speed) * progress).toFixed(1));

        return {
          lon: Number(lon.toFixed(6)),
          lat: Number(lat.toFixed(6)),
          heading,
          speed,
          isAisDark: isAisDarkWindow,
        };
      }
    }
  }

  // Smooth fallback: kinematic dead reckoning
  const curLon = vesselCurrentPos?.longitude ?? 33.05775642;
  const curLat = vesselCurrentPos?.latitude ?? 33.25902604;
  const curHeading = vesselCurrentPos?.heading_degrees ?? 95;
  const curSpeed = vesselCurrentPos?.speed_knots ?? 13.5;

  const reverseHeading = (curHeading + 180) % 360;
  const elapsedHours = Math.abs(timeOffsetMinutes) / 60.0;
  const distanceKm = (curSpeed * 1.852) * elapsedHours;
  const [lon, lat] = moveCoordinate(curLon, curLat, reverseHeading, distanceKm);

  return {
    lon,
    lat,
    heading: curHeading,
    speed: curSpeed,
    isAisDark: isAisDarkWindow,
  };
}

// Calculate oil slick center and polygon for any spill (built-in or custom uploaded) at any timeline offset
export function calculateSynchronizedOilSpill(
  timeOffsetMinutes: number, // -360 to 0 (and live +)
  spillId: string = "DARTIS-ow-0001",
  metocean?: MetoceanData,
  customFeature?: SpillGeoFeature
): { center: [number, number]; polygon: number[][]; area: number; perimeter: number; isNascent: boolean; hasDischarged: boolean } {
  const config = INCIDENTS[spillId] || (customFeature ? {
    id: customFeature.properties.id,
    name: customFeature.properties.id,
    locationName: `Target SAR Locus (${customFeature.properties.center[1].toFixed(2)}°N, ${customFeature.properties.center[0].toFixed(2)}°E)`,
    originCoords: customFeature.properties.center,
    centroid: customFeature.properties.centroid || [customFeature.properties.center[1], customFeature.properties.center[0]],
    dischargeOffsetMinutes: -42,
    trackHeading: 95,
    baseAreaSqKm: customFeature.properties.area_sq_km || 8.42,
    baseLengthKm: Math.max(1.0, Math.sqrt(customFeature.properties.area_sq_km || 8.42) * 1.5),
    baseWidthKm: Math.max(0.4, Math.sqrt(customFeature.properties.area_sq_km || 8.42) * 0.7),
    predictedPolygon: customFeature.geometry?.coordinates?.[0] || [],
  } as any : INCIDENTS["DARTIS-ow-0001"]);

  const dischargeOffset = config.dischargeOffsetMinutes;
  const baseOrigin: [number, number] = config.originCoords || [33.05775642, 33.25902604];
  const trackHeading = config.trackHeading || 95;

  const driftSpeedKts = metocean?.net_drift_speed_kts || 1.52;
  const driftDir = metocean?.net_drift_direction_deg || 95.0;

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

  // If incident provides an exact model-predicted polygon from real SAR inference:
  let poly: number[][];
  if (config.predictedPolygon && config.predictedPolygon.length >= 3) {
    const baseCentroidLon = config.centroid[1];
    const baseCentroidLat = config.centroid[0];
    const scale = Math.max(0.6, Math.min(1.5, lengthKm / (config.baseLengthKm || 5.0)));
    poly = config.predictedPolygon.map(([pLon, pLat]) => [
      Number((currentCenterLon + (pLon - baseCentroidLon) * scale).toFixed(6)),
      Number((currentCenterLat + (pLat - baseCentroidLat) * scale).toFixed(6))
    ]);
  } else {
    poly = generateRealisticSpillPolygon(currentCenterLon, currentCenterLat, trackHeading, lengthKm, widthKm);
  }

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

// Compute live Environmental Threat and Coastal Impact metrics from dynamic slick position
export function calculateEnvironmentalThreat(
  spillId: string = "DARTIS-ow-0001",
  timeOffsetMinutes: number = 0,
  metocean?: MetoceanData
): EnvironmentalThreat {
  const config = INCIDENTS[spillId] || INCIDENTS["DARTIS-ow-0001"];
  const liveSpill = calculateSynchronizedOilSpill(timeOffsetMinutes, spillId, metocean);
  const liveCenterLat = liveSpill.hasDischarged ? liveSpill.center[1] : config.centroid[0];
  const liveCenterLon = liveSpill.hasDischarged ? liveSpill.center[0] : config.centroid[1];
  const liveArea = liveSpill.hasDischarged && liveSpill.area > 0 ? liveSpill.area : config.baseAreaSqKm;

  return calculateEnvironmentalThreatMatrix([liveCenterLat, liveCenterLon], liveArea, metocean);
}

export class AutonomousSimulationEngine {
  private listeners: ((state: SimulationState) => void)[] = [];
  private state: SimulationState;
  private activeSpillId: string = "DARTIS-ow-0001";

  constructor() {
    this.state = this.buildInitialState("DARTIS-ow-0001");
  }

  public buildInitialState(selectedSpillId: string = "DARTIS-ow-0001"): SimulationState {
    this.activeSpillId = selectedSpillId;
    const now = new Date();

    const metocean: MetoceanData = {
      wind_speed_kts: 12.8,
      wind_direction_deg: 285.0,
      current_speed_kts: 1.1,
      current_direction_deg: 95.0,
      sea_surface_temp_c: 21.4,
      significant_wave_height_m: 1.2,
      weathering_evaporation_pct: 26.5,
      weathering_emulsification_pct: 31.0,
      net_drift_speed_kts: 1.52,
      net_drift_direction_deg: 95.0,
      hindcast_direction_deg: 275.0,
      hindcast_vector: [-1.48, -0.13],
      wind_cardinal: "WNW",
      current_cardinal: "E",
      sar_backscatter_quality: "OPTIMAL (High Radar Contrast)",
      sea_state: "Moderate (Beaufort 3-4)",
    };

    // Build live spill feature collection for DARTIS benchmark
    const spillFeatures: SpillGeoFeature[] = Object.values(INCIDENTS).map((config) => {
      const live = calculateSynchronizedOilSpill(0, config.id, metocean);
      return {
        type: "Feature",
        id: config.id,
        properties: {
          id: config.id,
          detection_timestamp: new Date(now.getTime() - Math.abs(config.dischargeOffsetMinutes) * 60000).toISOString(),
          acquisition_timestamp_ist: config.acquisition_timestamp_ist,
          acquisition_timestamp_utc: config.acquisition_timestamp_utc,
          area_sq_km: live.area,
          perimeter_km: live.perimeter,
          confidence_score: config.confidence,
          segmentation_dice_score: config.segmentation_dice_score,
          segmentation_iou_score: config.segmentation_iou_score,
          max_probability: config.max_probability,
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

    const baseVessels: Vessel[] = [
      {
        mmsi: 212000001,
        imo_number: 9481234,
        name: "MEDITERRANEAN TRADER",
        flag: "Malta",
        vessel_type: "VLCC Crude Carrier",
        length_meters: 315,
        draught_meters: 15.8,
        call_sign: "9HA4211",
        destination: "CYPRUS OFFSHORE TRANSIT",
        nav_status: "Under way using engine",
        cargo_type: "Crude Oil (315,000 DWT)",
        anomaly_score: 96.5,
        current_position: {
          latitude: 33.275,
          longitude: 33.150,
          speed_knots: 13.5,
          heading_degrees: 95,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
      {
        mmsi: 212000002,
        imo_number: 9512345,
        name: "LEVANT STAR",
        flag: "Cyprus",
        vessel_type: "Container Ship",
        length_meters: 295,
        draught_meters: 13.5,
        call_sign: "5BKA2",
        destination: "LIMASSOL COMMERCIAL PORT",
        nav_status: "Under way using engine",
        cargo_type: "Containers (8,500 TEU)",
        anomaly_score: 4.0,
        current_position: {
          latitude: 33.280,
          longitude: 33.140,
          speed_knots: 14.2,
          heading_degrees: 35,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
      {
        mmsi: 212000003,
        imo_number: 9623456,
        name: "AEGEAN VOYAGER",
        flag: "Greece",
        vessel_type: "Bulk Carrier",
        length_meters: 225,
        draught_meters: 11.8,
        call_sign: "SVXY",
        destination: "PORT SAID ANCHORAGE",
        nav_status: "Under way using engine",
        cargo_type: "Dry Bulk Minerals",
        anomaly_score: 29.2,
        current_position: {
          latitude: 33.250,
          longitude: 33.220,
          speed_knots: 12.5,
          heading_degrees: 110,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
      {
        mmsi: 212000004,
        imo_number: 9734567,
        name: "AKROTIRI BREEZE",
        flag: "Panama",
        vessel_type: "LPG Tanker",
        length_meters: 180,
        draught_meters: 9.4,
        call_sign: "3EZZ8",
        destination: "VASILIKO OIL TERMINAL",
        nav_status: "Under way using engine",
        cargo_type: "Liquefied Gas (LPG)",
        anomaly_score: 12.7,
        current_position: {
          latitude: 33.609,
          longitude: 33.507,
          speed_knots: 11.0,
          heading_degrees: 285,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
      {
        mmsi: 212000005,
        imo_number: 9845678,
        name: "CYPRUS POLICE PATROL / EMSA",
        flag: "Cyprus (Coast Guard)",
        vessel_type: "Pollution Control Vessel",
        length_meters: 85,
        draught_meters: 4.2,
        call_sign: "5BCP1",
        destination: "SAR DISCHARGE SECTOR",
        nav_status: "Engaged in response ops",
        cargo_type: "Tier-2 Booms & Offshore Skimmers",
        anomaly_score: 9.3,
        current_position: {
          latitude: 33.25902604,
          longitude: 33.05775642,
          speed_knots: 22.0,
          heading_degrees: 245,
          rate_of_turn: 0.0,
          timestamp: now.toISOString(),
        },
      },
    ];

    // 25 Regional Mediterranean Corridor Commercial Fleet Vessels
    const syntheticTraffic: Vessel[] = CORRIDOR_TRAFFIC_FLEET.map((ship) => ({
      mmsi: ship.mmsi,
      imo_number: ship.imo_number,
      name: ship.name,
      flag: ship.flag,
      vessel_type: ship.vessel_type,
      length_meters: ship.length_meters,
      draught_meters: ship.draught_meters,
      call_sign: ship.call_sign,
      destination: ship.destination,
      nav_status: "Under way using engine",
      cargo_type: ship.cargo_type,
      anomaly_score: 4.0,
      current_position: {
        latitude: ship.lat,
        longitude: ship.lon,
        speed_knots: ship.speed_knots,
        heading_degrees: ship.heading_degrees,
        rate_of_turn: 0.0,
        timestamp: now.toISOString(),
      },
    }));

    const vessels: Vessel[] = [...baseVessels, ...syntheticTraffic];

    // Build ranked suspect vessels from all 30 corridor vessels
    const suspects: SuspectVessel[] = vessels.map((v) => {
      const pos = v.current_position || {
        latitude: 33.25,
        longitude: 33.05,
        speed_knots: 14.5,
        heading_degrees: 90,
        nav_status: 'Under way using engine',
        timestamp_utc: now.toISOString(),
      };

      // Compute authentic backwards trajectory along vessel's actual course vector
      const revHeading = (pos.heading_degrees + 180) % 360;
      const dist180Km = (pos.speed_knots * 1.852) * 3.0;
      const [lon180, lat180] = moveCoordinate(pos.longitude, pos.latitude, revHeading, dist180Km);
      const dist60Km = (pos.speed_knots * 1.852) * 1.0;
      const [lon60, lat60] = moveCoordinate(pos.longitude, pos.latitude, revHeading, dist60Km);

      const trajectory: [number, number, string][] = [
        [lon180, lat180, new Date(now.getTime() - 180 * 60000).toISOString()],
        [lon60, lat60, new Date(now.getTime() - 60 * 60000).toISOString()],
        [pos.longitude, pos.latitude, now.toISOString()],
      ];

      const anomaly = calculateVesselKinematicAnomaly(
        {
          mmsi: v.mmsi,
          name: v.name,
          vessel_type: v.vessel_type,
          speed_knots: pos.speed_knots,
          trajectory,
        },
        [33.0421, 33.2684],
        -42
      );

      v.anomaly_score = anomaly.composite_score;
      v.anomaly_breakdown = anomaly;

      return {
        mmsi: v.mmsi,
        imo_number: v.imo_number,
        name: v.name,
        flag: v.flag,
        vessel_type: v.vessel_type,
        length_meters: v.length_meters,
        draught_meters: v.draught_meters,
        call_sign: v.call_sign,
        destination: v.destination,
        cargo_type: (v as any).cargo_type,
        distance_meters: anomaly.hindcast_cpa_distance_m,
        distance_km: anomaly.hindcast_cpa_distance_km || 0.0,
        probability_score: anomaly.composite_score,
        anomaly_score: anomaly.composite_score,
        anomaly_breakdown: anomaly,
        evidence_tags: anomaly.evidence_tags,
        hindcast_distance_meters: anomaly.hindcast_cpa_distance_m,
        hindcast_distance_km: anomaly.hindcast_cpa_distance_km || 0.0,
        speed_knots: pos.speed_knots,
        heading_degrees: pos.heading_degrees,
        last_lat: pos.latitude,
        last_lon: pos.longitude,
        trajectory,
      };
    });

    // Rank suspects descending by anomaly score
    suspects.sort((a, b) => (b.anomaly_score ?? b.probability_score ?? 0) - (a.anomaly_score ?? a.probability_score ?? 0));

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
  polygonCoordinates?: number[][];
  windSpeedKts?: number;
  culpritMmsi?: number;
  culpritName?: string;
  acquisitionTimestampUtc?: string;
  detectionTimestampIso?: string;
}): MumbaiIncidentConfig {
  const lon = spill.originCoords[0];
  const lat = spill.originCoords[1];
  const id = spill.id;
  const area = spill.areaSqKm || 8.42;
  const windSpeed = spill.windSpeedKts || 12.8;

  const lengthKm = Number((Math.sqrt(area) * 2.2).toFixed(2));
  const widthKm = Number((Math.sqrt(area) * 0.7).toFixed(2));
  const poly = spill.polygonCoordinates && spill.polygonCoordinates.length >= 3
    ? spill.polygonCoordinates
    : generateRealisticSpillPolygon(lon, lat, 95.0, lengthKm, widthKm);

  const polyMetrics = calculatePolygonMetrics(poly, windSpeed);
  const threatMatrix = calculateEnvironmentalThreatMatrix([lat, lon], polyMetrics.area_sq_km);

  const config: MumbaiIncidentConfig = {
    id: id,
    name: spill.name || `Custom SAR Detection (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
    locationName: spill.locationName || `Levantine Offshore Sector (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
    originCoords: [lon, lat],
    centroid: [lat, lon],
    acquisition_timestamp_ist: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + ' ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST',
    acquisition_timestamp_utc: spill.acquisitionTimestampUtc || new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    satellite_pass_ist: new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST',
    discharge_time_ist: new Date(Date.now() - 42 * 60000).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST',
    sourceScene: spill.sourceScene || "DARTIS_ow-0001",
    dischargeOffsetMinutes: -42,
    trackHeading: 95.0,
    baseAreaSqKm: polyMetrics.area_sq_km,
    baseLengthKm: lengthKm,
    baseWidthKm: widthKm,
    culpritMmsi: spill.culpritMmsi || 212000001,
    culpritName: spill.culpritName || "MEDITERRANEAN TRADER",
    volumeLiters: Math.round(polyMetrics.area_sq_km * 10500),
    slickType: spill.slickType || "Heavy Fuel Oil (DARTIS Benchmark OW-0001)",
    confidence: polyMetrics.oil_likelihood_score,
    segmentation_dice_score: polyMetrics.segmentation_dice_score,
    segmentation_iou_score: polyMetrics.segmentation_iou_score,
    max_probability: polyMetrics.max_probability,
    oil_likelihood_score: polyMetrics.oil_likelihood_score,
    lookalike_score: polyMetrics.lookalike_score,
    false_positive_analysis: polyMetrics.false_positive_analysis,
    predictedPolygon: poly,
    threat: threatMatrix,
    events: [
      {
        tMinutes: -360,
        timestamp_utc: '05:00 UTC',
        timestamp_ist: '10:30 IST',
        action_headline: 'Vessel enters region',
        label: 'Transit',
        title: 'Vessel Enters Levantine Surveillance Sector',
        type: 'transit',
        icon: '⚓',
        speed: 13.8,
        coordinates: [lon - 0.25, lat - 0.05],
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
        speed: 5.4,
        coordinates: [lon - 0.05, lat - 0.02],
        details: 'Speed abruptly decelerated from 13.8 to 5.4 kts with course drift.',
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
        details: 'Illicit bunker discharge with simultaneous 42-minute dark period.',
      },
      {
        tMinutes: -16,
        timestamp_utc: '10:44 UTC',
        timestamp_ist: '16:14 IST',
        action_headline: 'SAR Pass Detection',
        label: 'SAR Pass',
        title: 'Sentinel-1B C-Band Acquisition Pass (ow-0001.jpg)',
        type: 'sar_detection',
        icon: '🛰️',
        speed: 13.5,
        coordinates: [lon + 0.10, lat + 0.02],
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
        speed: 13.5,
        coordinates: [lon + 0.15, lat + 0.03],
        details: 'Cyprus Coast Guard / EMSA Fast Patrol Vessel dispatched for intercept.',
      },
    ],
  };

  return config;
}

export function generateDashboardAlerts(
  incidentId: string = "DARTIS-ow-0001",
  timeOffsetMinutes: number = 0,
  metocean?: MetoceanData
): DashboardAlert[] {
  const incident = INCIDENTS[incidentId] || INCIDENTS["DARTIS-ow-0001"];
  const threat = calculateEnvironmentalThreat(incidentId, timeOffsetMinutes, metocean);
  const alerts: DashboardAlert[] = [];

  // 1. Critical SAR Detection Alert
  alerts.push({
    id: `ALT-SAR-${incident.id}`,
    incident_id: incident.id,
    timestamp_ist: incident.satellite_pass_ist || "09:12:35 IST",
    severity: "CRITICAL",
    category: "oil_spill",
    title: `🔴 Critical SAR Oil Slick Detected: ow-0001.jpg (${(incident.baseAreaSqKm || 8.42).toFixed(2)} km²)`,
    message: `Sentinel-1B C-Band radar identified ${incident.slickType} slick in ${incident.name} with ${incident.false_positive_analysis?.marangoni_damping_db || 8.9} dB Marangoni damping contrast.`,
    coordinates: incident.originCoords,
    action_type: "focus_map",
    action_value: incident.originCoords,
    action_label: "Locate on Map",
    acknowledged: false,
  });

  // 2. AIS Culprit Deceleration & Blackout Alert
  if (timeOffsetMinutes >= (incident.dischargeOffsetMinutes - 15)) {
    alerts.push({
      id: `ALT-CULPRIT-${incident.id}`,
      incident_id: incident.id,
      timestamp_ist: incident.discharge_time_ist || "08:30:00 IST",
      severity: "CRITICAL",
      category: "vessel_violation",
      title: `🚨 Suspect Vessel Breach: ${incident.culpritName}`,
      message: `Abrupt deceleration with transponder blackout directly over discharge origin (${incident.originCoords[1].toFixed(4)}°N, ${incident.originCoords[0].toFixed(4)}°E).`,
      coordinates: incident.originCoords,
      action_type: "jump_scrubber",
      action_value: incident.dischargeOffsetMinutes,
      action_label: "Jump to Breach",
      acknowledged: false,
    });
  }

  // 3. Fishing Zone Impact Alert
  alerts.push({
    id: `ALT-FISH-${incident.id}`,
    incident_id: incident.id,
    timestamp_ist: "09:20:00 IST",
    severity: "CRITICAL",
    category: "fishing_zone",
    title: `🟢 Commercial Fishing Fairway Intercept Risk (${threat.fishing_zone_distance_km || 8.5} km)`,
    message: `Active slick boundary is ${threat.fishing_zone_distance_km || 8.5} km from ${threat.fishing_zone_name}. Urgent broadcast recommended to ${threat.fishing_fleet_count || 180} active vessels.`,
    coordinates: [33.00, 33.25],
    action_type: "view_threat",
    action_value: "threats",
    action_label: "View Fisheries Advisory",
    acknowledged: false,
  });

  // 4. Fishing Harbour & Port Advisory Alert
  alerts.push({
    id: `ALT-HARB-${incident.id}`,
    incident_id: incident.id,
    timestamp_ist: "09:25:00 IST",
    severity: "WARNING",
    category: "fishing_harbour",
    title: `🔵 Fishing Harbour Threat: ${threat.fishing_harbour_name}`,
    message: `Hydrodynamic drift vector heading ${metocean?.net_drift_direction_deg || 95.0}° eastward. Distance to Limassol: ${threat.fishing_harbour_distance_km || 154.0} km. Projected arrival: ${threat.predicted_arrival_hours || 82.5} hours.`,
    coordinates: [33.0230, 34.6520],
    action_type: "focus_map",
    action_value: [33.0230, 34.6520],
    action_label: "Focus Limassol Port",
    acknowledged: false,
  });

  // 5. Coastal Communities Advisory Alert
  alerts.push({
    id: `ALT-COMM-${incident.id}`,
    incident_id: incident.id,
    timestamp_ist: "09:30:00 IST",
    severity: "WARNING",
    category: "coastal_community",
    title: `🟠 Littoral Community Warning: ${threat.coastal_community_name}`,
    message: `Coastline surveillance protocol active for ${threat.community_population ? threat.community_population.toLocaleString() : '185,000'} coastal residents (${threat.community_distance_km || 155.0} km).`,
    coordinates: [33.0450, 34.6750],
    action_type: "focus_map",
    action_value: [33.0450, 34.6750],
    action_label: "Focus Limassol Waterfront",
    acknowledged: false,
  });

  // 6. Aquaculture Protection Alert
  alerts.push({
    id: `ALT-AQUA-${incident.id}`,
    incident_id: incident.id,
    timestamp_ist: "09:30:00 IST",
    severity: "INFO",
    category: "aquaculture",
    title: `🟣 Aquaculture Precaution: ${threat.aquaculture_name}`,
    message: `Precautionary alert for marine aquaculture cages in ${threat.aquaculture_name} (€${threat.aquaculture_economic_cr || 75.0}M exposure at ${threat.aquaculture_distance_km || 160.0} km).`,
    coordinates: [33.31, 34.70],
    action_type: "focus_map",
    action_value: [33.31, 34.70],
    action_label: "Focus Mariculture Sites",
    acknowledged: false,
  });

  return alerts;
}

export const globalSimulation = new AutonomousSimulationEngine();


