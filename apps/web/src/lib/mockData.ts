import { SpillFeatureCollection, Vessel, SuspectVessel, VectorMatch } from '../types';

const now = new Date();
const getRecentTimestamp = (minutesAgo: number) => {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
};

export const INITIAL_SPILLS: SpillFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "INC-IND-2024-01",
      properties: {
        id: "INC-IND-2024-01",
        detection_timestamp: getRecentTimestamp(35),
        area_sq_km: 5.40,
        perimeter_km: 14.8,
        confidence_score: 0.988,
        source_scene: "S1A_IW_GRDH_1SDV_ARABIAN_SEA_01",
        status: "ACTIVE",
        center: [72.150, 19.050],
        estimated_discharge_liters: 58000,
        slick_type: "Heavy Fuel Oil (HFO-380 / Bilge Sludge)"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [72.125, 19.035],
            [72.138, 19.058],
            [72.155, 19.068],
            [72.172, 19.060],
            [72.180, 19.048],
            [72.170, 19.035],
            [72.150, 19.030],
            [72.134, 19.032],
            [72.125, 19.035]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "INC-IND-2024-02",
      properties: {
        id: "INC-IND-2024-02",
        detection_timestamp: getRecentTimestamp(90),
        area_sq_km: 2.80,
        perimeter_km: 8.4,
        confidence_score: 0.962,
        source_scene: "S1B_IW_GRDH_1SDV_BAY_OF_BENGAL_02",
        status: "ACTIVE",
        center: [80.750, 13.250],
        estimated_discharge_liters: 22000,
        slick_type: "Marine Diesel / Bunker Fuel"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80.730, 13.235],
            [80.745, 13.260],
            [80.765, 13.268],
            [80.778, 13.252],
            [80.772, 13.238],
            [80.750, 13.230],
            [80.730, 13.235]
          ]
        ]
      }
    }
  ]
};

export const INITIAL_VESSELS: Vessel[] = [
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
      heading_degrees: 135,
      timestamp: getRecentTimestamp(2)
    }
  },
  {
    mmsi: 419000456,
    name: "MT JAG LOK",
    flag: "India",
    vessel_type: "Product Tanker",
    length_meters: 244,
    call_sign: "AVJL",
    destination: "JAWAHARLAL NEHRU PORT",
    current_position: {
      latitude: 19.020,
      longitude: 72.280,
      speed_knots: 12.4,
      heading_degrees: 98,
      timestamp: getRecentTimestamp(2)
    }
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
      latitude: 19.180,
      longitude: 72.110,
      speed_knots: 17.1,
      heading_degrees: 60,
      timestamp: getRecentTimestamp(3)
    }
  },
  {
    mmsi: 419000789,
    name: "MT SWARNA SINDHU",
    flag: "India",
    vessel_type: "Aframax Crude Carrier",
    length_meters: 228,
    call_sign: "AWSS",
    destination: "COCHIN PORT",
    current_position: {
      latitude: 18.890,
      longitude: 72.160,
      speed_knots: 11.2,
      heading_degrees: 182,
      timestamp: getRecentTimestamp(4)
    }
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
      latitude: 19.110,
      longitude: 72.080,
      speed_knots: 13.5,
      heading_degrees: 340,
      timestamp: getRecentTimestamp(5)
    }
  }
];

export const INITIAL_SUSPECTS: SuspectVessel[] = [
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
    heading_degrees: 135,
    last_lat: 19.120,
    last_lon: 72.240,
    trajectory: [
      [72.020, 18.950, getRecentTimestamp(360)],
      [72.080, 19.000, getRecentTimestamp(180)],
      [72.150, 19.050, getRecentTimestamp(60)],  // Exact slick centroid intercept
      [72.240, 19.120, getRecentTimestamp(0)]    // Current position
    ]
  },
  {
    mmsi: 419000456,
    name: "MT JAG LOK",
    flag: "India",
    vessel_type: "Product Tanker",
    length_meters: 244,
    call_sign: "AVJL",
    destination: "JAWAHARLAL NEHRU PORT",
    distance_meters: 14200,
    distance_km: 14.2,
    probability_score: 8.2,
    speed_knots: 12.4,
    heading_degrees: 98,
    last_lat: 19.020,
    last_lon: 72.280
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
    speed_knots: 17.1,
    heading_degrees: 60,
    last_lat: 19.180,
    last_lon: 72.110
  },
  {
    mmsi: 419000789,
    name: "MT SWARNA SINDHU",
    flag: "India",
    vessel_type: "Aframax Crude Carrier",
    length_meters: 228,
    call_sign: "AWSS",
    destination: "COCHIN PORT",
    distance_meters: 24100,
    distance_km: 24.1,
    probability_score: 1.4,
    speed_knots: 11.2,
    heading_degrees: 182,
    last_lat: 18.890,
    last_lon: 72.160
  },
  {
    mmsi: 538004123,
    name: "CHEMBULK GIBRALTAR",
    flag: "Marshall Islands",
    vessel_type: "Chemical Tanker",
    length_meters: 144,
    call_sign: "V7CG",
    destination: "HAZIRA ANCHORAGE",
    distance_meters: 31000,
    distance_km: 31.0,
    probability_score: 0.8,
    speed_knots: 13.5,
    heading_degrees: 340,
    last_lat: 19.110,
    last_lon: 72.080
  }
];

export const INITIAL_VECTOR_MATCHES: VectorMatch[] = [
  {
    id: "SIG-IND-MH-01",
    spill_id: "MH-2024-SHEEN-08",
    title: "Mumbai High Offshore Platform Sheen Archive",
    date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    location: "Arabian Sea (19.4°N, 71.3°E)",
    area_sq_km: 5.25,
    perimeter_km: 14.1,
    eccentricity: 0.87,
    oil_type: "Heavy Fuel Oil (HFO-380)",
    culprit_name: "MT DESH SHANTI (Prior Offense)",
    similarity_score: 99.8
  },
  {
    id: "SIG-IND-GK-02",
    spill_id: "GK-2024-DISCH-03",
    title: "Gulf of Kutch Tanker Discharge Pattern",
    date: new Date(Date.now() - 65 * 86400000).toISOString().slice(0, 10),
    location: "Gulf of Kutch (22.5°N, 69.2°E)",
    area_sq_km: 4.80,
    perimeter_km: 12.6,
    eccentricity: 0.84,
    oil_type: "Crude Bilge Washings",
    culprit_name: "Unknown Tanker",
    similarity_score: 94.2
  },
  {
    id: "SIG-IND-EN-03",
    spill_id: "EN-2023-SLICK-11",
    title: "Chennai Port Ennore Oil Slick Archive",
    date: new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10),
    location: "Bay of Bengal (13.3°N, 80.4°E)",
    area_sq_km: 2.95,
    perimeter_km: 8.9,
    eccentricity: 0.79,
    oil_type: "Marine Diesel / Bunker",
    culprit_name: "BW MAPLE Case Study",
    similarity_score: 91.5
  },
  {
    id: "SIG-IND-CH-04",
    spill_id: "CH-2024-ANCH-05",
    title: "Cochin Outer Anchorage Sheen",
    date: new Date(Date.now() - 150 * 86400000).toISOString().slice(0, 10),
    location: "Lakshadweep Sea (9.9°N, 76.1°E)",
    area_sq_km: 1.80,
    perimeter_km: 5.8,
    eccentricity: 0.72,
    oil_type: "Light Fuel Oil",
    similarity_score: 87.3
  }
];
