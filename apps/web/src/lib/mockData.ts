import { SpillFeatureCollection, Vessel, SuspectVessel, VectorMatch } from '../types';

export const INITIAL_SPILLS: SpillFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "INC-IND-2024-01",
      properties: {
        id: "INC-IND-2024-01",
        detection_timestamp: "2024-10-14T23:42:01Z",
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
        detection_timestamp: "2024-10-14T20:42:01Z",
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
            [80.760, 13.238],
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
    vessel_type: "Very Large Crude Carrier (VLCC)",
    length_meters: 333.0,
    call_sign: "ATVS",
    destination: "JNPT MUMBAI",
    current_position: {
      latitude: 19.160,
      longitude: 72.280,
      speed_knots: 14.5,
      heading_degrees: 135.0,
      timestamp: "2024-10-14T23:42:01Z"
    }
  },
  {
    mmsi: 419000456,
    name: "MT JAG LOK",
    flag: "India",
    vessel_type: "Crude Oil Tanker",
    length_meters: 274.0,
    call_sign: "AVKL",
    destination: "SIKKA JAMNAGAR",
    current_position: {
      latitude: 19.020,
      longitude: 72.420,
      speed_knots: 13.2,
      heading_degrees: 320.0,
      timestamp: "2024-10-14T23:42:01Z"
    }
  },
  {
    mmsi: 353136000,
    name: "MSC KANOKO",
    flag: "Liberia",
    vessel_type: "Container Ship",
    length_meters: 366.0,
    call_sign: "D5EG7",
    destination: "MUNDRA PORT",
    current_position: {
      latitude: 19.280,
      longitude: 72.020,
      speed_knots: 19.8,
      heading_degrees: 330.0,
      timestamp: "2024-10-14T23:42:01Z"
    }
  },
  {
    mmsi: 419000789,
    name: "MT SWARNA SINDHU",
    flag: "India",
    vessel_type: "Product Tanker",
    length_meters: 228.0,
    call_sign: "AWXZ",
    destination: "COCHIN REFINERY",
    current_position: {
      latitude: 18.750,
      longitude: 72.100,
      speed_knots: 12.0,
      heading_degrees: 170.0,
      timestamp: "2024-10-14T23:42:01Z"
    }
  },
  {
    mmsi: 563032000,
    name: "CHEMBULK GIBRALTAR",
    flag: "Singapore",
    vessel_type: "Chemical Tanker",
    length_meters: 175.0,
    call_sign: "9V2941",
    destination: "HAZIRA PORT",
    current_position: {
      latitude: 19.120,
      longitude: 71.950,
      speed_knots: 11.5,
      heading_degrees: 15.0,
      timestamp: "2024-10-14T23:42:01Z"
    }
  }
];

export const INITIAL_SUSPECTS: SuspectVessel[] = [
  {
    mmsi: 419000123,
    name: "MT DESH SHANTI",
    flag: "India",
    vessel_type: "Very Large Crude Carrier (VLCC)",
    length_meters: 333.0,
    call_sign: "ATVS",
    destination: "JNPT MUMBAI",
    distance_meters: 110.0,
    distance_km: 0.11,
    probability_score: 98.4,
    speed_knots: 14.5,
    heading_degrees: 135.0,
    last_lat: 19.160,
    last_lon: 72.280,
    trajectory: [
      [71.850, 18.750, "2024-10-14T17:42:00Z"],
      [71.910, 18.810, "2024-10-14T18:42:00Z"],
      [71.970, 18.870, "2024-10-14T19:42:00Z"],
      [72.030, 18.930, "2024-10-14T20:42:00Z"],
      [72.090, 18.990, "2024-10-14T21:42:00Z"],
      [72.150, 19.050, "2024-10-14T22:45:00Z"], // Intersect centroid
      [72.210, 19.100, "2024-10-14T23:12:00Z"],
      [72.280, 19.160, "2024-10-14T23:42:01Z"]
    ]
  },
  {
    mmsi: 419000456,
    name: "MT JAG LOK",
    flag: "India",
    vessel_type: "Crude Oil Tanker",
    length_meters: 274.0,
    call_sign: "AVKL",
    destination: "SIKKA JAMNAGAR",
    distance_meters: 8900.0,
    distance_km: 8.90,
    probability_score: 36.2,
    speed_knots: 13.2,
    heading_degrees: 320.0,
    last_lat: 19.020,
    last_lon: 72.420,
    trajectory: [
      [72.600, 18.700, "2024-10-14T17:42:00Z"],
      [72.540, 18.810, "2024-10-14T19:42:00Z"],
      [72.480, 18.910, "2024-10-14T21:42:00Z"],
      [72.420, 19.020, "2024-10-14T23:42:01Z"]
    ]
  },
  {
    mmsi: 353136000,
    name: "MSC KANOKO",
    flag: "Liberia",
    vessel_type: "Container Ship",
    length_meters: 366.0,
    call_sign: "D5EG7",
    destination: "MUNDRA PORT",
    distance_meters: 14200.0,
    distance_km: 14.20,
    probability_score: 11.8,
    speed_knots: 19.8,
    heading_degrees: 330.0,
    last_lat: 19.280,
    last_lon: 72.020,
    trajectory: [
      [72.200, 18.600, "2024-10-14T17:42:00Z"],
      [72.140, 18.820, "2024-10-14T19:42:00Z"],
      [72.080, 19.050, "2024-10-14T21:42:00Z"],
      [72.020, 19.280, "2024-10-14T23:42:01Z"]
    ]
  }
];

export const INITIAL_VECTOR_MATCHES: VectorMatch[] = [
  {
    id: "HIST-IND-2023-08",
    spill_id: "HIST-IND-2023-08",
    title: "Mumbai High Offshore Platform Sheen",
    date: "2023-07-19",
    location: "Arabian Sea (Mumbai High Sector)",
    area_sq_km: 5.10,
    perimeter_km: 14.2,
    eccentricity: 0.85,
    oil_type: "Heavy Fuel Oil (HFO-380)",
    culprit_name: "MT DESH SHANTI",
    similarity_score: 98.2
  },
  {
    id: "HIST-IND-2022-14",
    spill_id: "HIST-IND-2022-14",
    title: "Gulf of Kutch Tanker Discharge",
    date: "2022-11-12",
    location: "Gulf of Kutch (Jamnagar Approach)",
    area_sq_km: 4.60,
    perimeter_km: 12.8,
    eccentricity: 0.82,
    oil_type: "Crude Sludge / Bilge",
    culprit_name: "ORIENTAL TITAN",
    similarity_score: 89.5
  },
  {
    id: "HIST-IND-2021-03",
    spill_id: "HIST-IND-2021-03",
    title: "Chennai Port Ennore Oil Slick",
    date: "2021-01-28",
    location: "Bay of Bengal (Ennore Coast)",
    area_sq_km: 3.90,
    perimeter_km: 10.4,
    eccentricity: 0.78,
    oil_type: "Heavy Furnace Fuel",
    culprit_name: "BW MAPLE",
    similarity_score: 84.1
  }
];
