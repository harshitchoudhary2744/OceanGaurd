/**
 * OceanGuard Autonomous 24/7 Real-Time Simulation Engine
 * Provides continuous live AIS kinematics, hydrodynamic drift, metocean fluctuations,
 * and forensic telemetry even when offline or disconnected from the backend.
 */
import { Vessel, SuspectVessel, SpillFeatureCollection, MetoceanData, SpillGeoFeature } from '../types';

export interface SimulationState {
  vessels: Vessel[];
  suspects: SuspectVessel[];
  spills: SpillFeatureCollection;
  metocean: MetoceanData;
  telemetryLogs: { id: string; time: string; mmsi: number; vessel: string; message: string; severity: 'info' | 'warning' | 'alert' }[];
}

// Calculate destination point given lat/lon, bearing (degrees), and distance (km)
export function moveCoordinate(lon: number, lat: number, headingDeg: number, distanceKm: number): [number, number] {
  const R = 6371.0; // Earth radius in km
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

// Smooth realistic elongated spill polygon aligned with discharge track
export function generateRealisticSpillPolygon(centerLon: number, centerLat: number, trackBearingDeg: number, lengthKm: number, widthKm: number): number[][] {
  const points: number[][] = [];
  const steps = 32;

  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    // Elongated ellipse with turbulent edge variations
    const localX = (lengthKm / 2) * Math.cos(theta) + 0.12 * Math.sin(3 * theta);
    const localY = (widthKm / 2) * Math.sin(theta) + 0.08 * Math.cos(4 * theta);

    // Rotate by track bearing
    const brngRad = ((trackBearingDeg - 90) * Math.PI) / 180;
    const rotX = localX * Math.cos(brngRad) - localY * Math.sin(brngRad);
    const rotY = localX * Math.sin(brngRad) + localY * Math.cos(brngRad);

    const [ptLon, ptLat] = moveCoordinate(centerLon, centerLat, Math.atan2(rotX, rotY) * (180 / Math.PI), Math.sqrt(rotX * rotX + rotY * rotY));
    points.push([ptLon, ptLat]);
  }

  points.push(points[0]); // Close polygon
  return points;
}

// Generate +6h Hydrodynamic Forecast Dispersal Fan Cone
export function generateForecastCone(
  baseCenterLon: number,
  baseCenterLat: number,
  driftBearingDeg: number,
  driftSpeedKts: number,
  hours: number = 6
): number[][] {
  const driftDistanceKm = (driftSpeedKts * 1.852) * hours;
  const [endLon, endLat] = moveCoordinate(baseCenterLon, baseCenterLat, driftBearingDeg, driftDistanceKm);

  // Width of dispersal cone expands with time (Fay spreading)
  const spreadWidthKm = 1.2 + (hours * 0.45);

  const leftBase = moveCoordinate(baseCenterLon, baseCenterLat, (driftBearingDeg - 90 + 360) % 360, 0.8);
  const rightBase = moveCoordinate(baseCenterLon, baseCenterLat, (driftBearingDeg + 90) % 360, 0.8);

  const rightHead = moveCoordinate(endLon, endLat, (driftBearingDeg + 65) % 360, spreadWidthKm);
  const frontHead = moveCoordinate(endLon, endLat, driftBearingDeg, spreadWidthKm * 0.7);
  const leftHead = moveCoordinate(endLon, endLat, (driftBearingDeg - 65 + 360) % 360, spreadWidthKm);

  return [
    leftBase,
    rightBase,
    rightHead,
    frontHead,
    leftHead,
    leftBase
  ];
}

export class AutonomousSimulationEngine {
  private listeners: ((state: SimulationState) => void)[] = [];
  private intervalId: any = null;
  private state: SimulationState;

  constructor(initialScenario: string = 'arabian_sea') {
    this.state = this.buildInitialState(initialScenario);
  }

  public buildInitialState(scenario: string): SimulationState {
    const isMumbai = scenario === 'arabian_sea';
    const baseTime = new Date().toISOString();

    if (isMumbai) {
      // Mumbai High Sector - Arabian Sea (Track from SW 72.020, 18.950 to NE 72.240, 19.120)
      // Track direction is 52° NE. Tanker MT DESH SHANTI is heading 52°.
      const spillCenterLon = 72.145;
      const spillCenterLat = 19.048;
      const spillPoly = generateRealisticSpillPolygon(spillCenterLon, spillCenterLat, 52, 5.2, 1.4);

      const vessels: Vessel[] = [
        {
          mmsi: 419000123,
          name: "MT DESH SHANTI",
          flag: "India",
          vessel_type: "Crude Oil Tanker (VLCC)",
          length_meters: 333,
          call_sign: "VTDS",
          destination: "MUMBAI REFINERY",
          current_position: {
            latitude: 19.120,
            longitude: 72.240,
            speed_knots: 14.8,
            heading_degrees: 52, // Aligned with actual track
            timestamp: baseTime,
          },
        },
        {
          mmsi: 419000456,
          name: "MT JAG LOK",
          flag: "India",
          vessel_type: "Product Tanker",
          length_meters: 244,
          call_sign: "AVJL",
          destination: "JNPT PORT",
          current_position: {
            latitude: 19.015,
            longitude: 72.275,
            speed_knots: 12.4,
            heading_degrees: 98,
            timestamp: baseTime,
          },
        },
        {
          mmsi: 255806000,
          name: "MSC KANOKO",
          flag: "Liberia",
          vessel_type: "Container Ship",
          length_meters: 366,
          call_sign: "CQES",
          destination: "NHAVA SHEVA",
          current_position: {
            latitude: 19.195,
            longitude: 72.105,
            speed_knots: 17.2,
            heading_degrees: 68,
            timestamp: baseTime,
          },
        },
        {
          mmsi: 419000789,
          name: "MT SWARNA SINDHU",
          flag: "India",
          vessel_type: "Aframax Tanker",
          length_meters: 228,
          call_sign: "AWSS",
          destination: "COCHIN PORT",
          current_position: {
            latitude: 18.885,
            longitude: 72.155,
            speed_knots: 11.2,
            heading_degrees: 182,
            timestamp: baseTime,
          },
        },
        {
          mmsi: 538004123,
          name: "CHEMBULK GIBRALTAR",
          flag: "Marshall Islands",
          vessel_type: "Chemical Tanker",
          length_meters: 144,
          call_sign: "V7CG",
          destination: "HAZIRA ANCHORAGE",
          current_position: {
            latitude: 19.115,
            longitude: 72.075,
            speed_knots: 13.5,
            heading_degrees: 342,
            timestamp: baseTime,
          },
        },
      ];

      const suspects: SuspectVessel[] = [
        {
          mmsi: 419000123,
          name: "MT DESH SHANTI",
          flag: "India",
          vessel_type: "Crude Oil Tanker (VLCC)",
          length_meters: 333,
          call_sign: "VTDS",
          destination: "MUMBAI REFINERY",
          distance_meters: 0.0,
          distance_km: 0.0,
          probability_score: 98.4,
          speed_knots: 14.8,
          heading_degrees: 52,
          last_lat: 19.120,
          last_lon: 72.240,
          trajectory: [
            [72.020, 18.950, new Date(Date.now() - 360 * 60000).toISOString()],
            [72.080, 19.000, new Date(Date.now() - 180 * 60000).toISOString()],
            [72.145, 19.048, new Date(Date.now() - 60 * 60000).toISOString()],
            [72.240, 19.120, new Date().toISOString()],
          ],
        },
        {
          mmsi: 419000456,
          name: "MT JAG LOK",
          flag: "India",
          vessel_type: "Product Tanker",
          length_meters: 244,
          call_sign: "AVJL",
          destination: "JNPT PORT",
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
          name: "MSC KANOKO",
          flag: "Liberia",
          vessel_type: "Container Ship",
          length_meters: 366,
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
              detection_timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
              area_sq_km: 5.40,
              perimeter_km: 14.8,
              confidence_score: 0.988,
              source_scene: "S1A_IW_GRDH_1SDV_ARABIAN_SEA_01",
              status: "ACTIVE",
              center: [spillCenterLon, spillCenterLat],
              estimated_discharge_liters: 58000,
              slick_type: "Heavy Fuel Oil (HFO-380 / Bilge Sludge)",
            },
            geometry: {
              type: "Polygon",
              coordinates: [spillPoly],
            },
          },
        ],
      };

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

      return {
        vessels,
        suspects,
        spills,
        metocean,
        telemetryLogs: [
          { id: '1', time: new Date().toLocaleTimeString(), mmsi: 419000123, vessel: 'MT DESH SHANTI', message: 'AIS Kinematic Fix Received: 19.120°N, 72.240°E', severity: 'alert' },
          { id: '2', time: new Date().toLocaleTimeString(), mmsi: 419000456, vessel: 'MT JAG LOK', message: 'Course adjusted to 098° inbound JNPT', severity: 'info' },
          { id: '3', time: new Date().toLocaleTimeString(), mmsi: 255806000, vessel: 'MSC KANOKO', message: 'Approaching Mumbai High TSS Lane', severity: 'warning' },
        ],
      };
    } else {
      // Bay of Bengal / Ennore Port Sector (13.250°N, 80.750°E)
      const spillCenterLon = 80.750;
      const spillCenterLat = 13.250;
      const spillPoly = generateRealisticSpillPolygon(spillCenterLon, spillCenterLat, 38, 3.6, 1.1);

      const vessels: Vessel[] = [
        {
          mmsi: 419000456,
          name: "MT DAWN KANCHEEPURAM",
          flag: "India",
          vessel_type: "LPG / Product Tanker",
          length_meters: 218,
          call_sign: "AVDK",
          destination: "KAMARAJAR PORT ENNORE",
          current_position: {
            latitude: 13.290,
            longitude: 80.785,
            speed_knots: 13.2,
            heading_degrees: 38,
            timestamp: baseTime,
          },
        },
        {
          mmsi: 352001000,
          name: "BW MAPLE",
          flag: "Isle of Man",
          vessel_type: "VLGC Gas Carrier",
          length_meters: 226,
          call_sign: "MGEK",
          destination: "CHENNAI OUTER ANCHORAGE",
          current_position: {
            latitude: 13.210,
            longitude: 80.720,
            speed_knots: 9.8,
            heading_degrees: 215,
            timestamp: baseTime,
          },
        },
      ];

      const suspects: SuspectVessel[] = [
        {
          mmsi: 419000456,
          name: "MT DAWN KANCHEEPURAM",
          flag: "India",
          vessel_type: "LPG / Product Tanker",
          length_meters: 218,
          call_sign: "AVDK",
          destination: "KAMARAJAR PORT ENNORE",
          distance_meters: 0.0,
          distance_km: 0.0,
          probability_score: 96.8,
          speed_knots: 13.2,
          heading_degrees: 38,
          last_lat: 13.290,
          last_lon: 80.785,
          trajectory: [
            [80.710, 13.200, new Date(Date.now() - 360 * 60000).toISOString()],
            [80.750, 13.250, new Date(Date.now() - 60 * 60000).toISOString()],
            [80.785, 13.290, new Date().toISOString()],
          ],
        },
      ];

      const spills: SpillFeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "INC-IND-2024-02",
            properties: {
              id: "INC-IND-2024-02",
              detection_timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
              area_sq_km: 2.80,
              perimeter_km: 8.4,
              confidence_score: 0.962,
              source_scene: "S1B_IW_GRDH_1SDV_BAY_OF_BENGAL_02",
              status: "ACTIVE",
              center: [spillCenterLon, spillCenterLat],
              estimated_discharge_liters: 22000,
              slick_type: "Marine Diesel / Bunker Fuel",
            },
            geometry: {
              type: "Polygon",
              coordinates: [spillPoly],
            },
          },
        ],
      };

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

      return {
        vessels,
        suspects,
        spills,
        metocean,
        telemetryLogs: [],
      };
    }
  }

  public start() {
    if (this.intervalId) return;

    // 1-second continuous autonomous update loop
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

  // 1-Second Autonomous Simulation Tick
  private tick() {
    // 1. Advance all vessels continuously based on their speed and heading
    // 1 knot = 1.852 km/h = ~0.000514 km/sec
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

    // 2. Micro-meteorological fluctuations
    const windNoise = (Math.random() - 0.5) * 0.08;
    const currentNoise = (Math.random() - 0.5) * 0.02;

    const newWindSpeed = Number(Math.max(12.0, Math.min(24.0, this.state.metocean.wind_speed_kts + windNoise)).toFixed(1));
    const newCurrentSpeed = Number(Math.max(0.8, Math.min(2.5, this.state.metocean.current_speed_kts + currentNoise)).toFixed(2));

    // Slow continuous weathering progression
    const newEvap = Number(Math.min(45.0, this.state.metocean.weathering_evaporation_pct + 0.002).toFixed(2));
    const newEmuls = Number(Math.min(65.0, this.state.metocean.weathering_emulsification_pct + 0.003).toFixed(2));

    const updatedMetocean: MetoceanData = {
      ...this.state.metocean,
      wind_speed_kts: newWindSpeed,
      current_speed_kts: newCurrentSpeed,
      weathering_evaporation_pct: newEvap,
      weathering_emulsification_pct: newEmuls,
    };

    // 3. Update primary suspect latest position
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

    this.state = {
      ...this.state,
      vessels: updatedVessels,
      suspects: updatedSuspects,
      metocean: updatedMetocean,
    };

    this.notify();
  }
}

export const globalSimulation = new AutonomousSimulationEngine('arabian_sea');
globalSimulation.start();
