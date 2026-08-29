import { SpillFeatureCollection, Vessel, SuspectVessel, VectorMatch, MetoceanData } from '../types';
import { globalSimulation } from './simulationEngine';

const bayState = globalSimulation.buildInitialState('bay_of_bengal');
const arabianState = globalSimulation.buildInitialState('arabian_sea');

export const INITIAL_SPILLS: SpillFeatureCollection = {
  type: "FeatureCollection",
  features: [
    ...bayState.spills.features,
    ...arabianState.spills.features,
  ],
};

export const INITIAL_VESSELS: Vessel[] = bayState.vessels;
export const INITIAL_SUSPECTS: SuspectVessel[] = bayState.suspects;

export const INITIAL_VECTOR_MATCHES: VectorMatch[] = [
  {
    id: "SIG-IND-EN-01",
    spill_id: "INC-IND-2017-02",
    title: "Kamarajar Port Ennore Collision & Spill Archive",
    date: "2017-01-28",
    location: "Bay of Bengal (13° 14.2' N, 80° 21.8' E)",
    area_sq_km: 3.42,
    perimeter_km: 9.8,
    eccentricity: 0.81,
    oil_type: "Heavy Bunker Fuel Oil (HFO-380)",
    culprit_name: "MT DAWN KANCHEEPURAM & BW MAPLE",
    similarity_score: 99.8,
  },
  {
    id: "SIG-IND-MH-02",
    spill_id: "MH-2024-SHEEN-08",
    title: "Mumbai High Offshore Platform Sheen Archive",
    date: "2024-08-14",
    location: "Arabian Sea (19.4°N, 71.3°E)",
    area_sq_km: 5.25,
    perimeter_km: 14.1,
    eccentricity: 0.87,
    oil_type: "Heavy Fuel Oil (HFO-380)",
    culprit_name: "MT DESH SHANTI (Prior Offense)",
    similarity_score: 94.2,
  },
  {
    id: "SIG-IND-GK-03",
    spill_id: "GK-2023-DISCH-03",
    title: "Gulf of Kutch Tanker Discharge Pattern",
    date: "2023-11-20",
    location: "Gulf of Kutch (22.5°N, 69.2°E)",
    area_sq_km: 4.80,
    perimeter_km: 12.6,
    eccentricity: 0.84,
    oil_type: "Crude Bilge Washings",
    culprit_name: "Unknown Tanker",
    similarity_score: 91.5,
  },
  {
    id: "SIG-IND-CH-04",
    spill_id: "CH-2023-ANCH-05",
    title: "Cochin Outer Anchorage Sheen",
    date: "2023-09-12",
    location: "Lakshadweep Sea (9.9°N, 76.1°E)",
    area_sq_km: 1.80,
    perimeter_km: 5.8,
    eccentricity: 0.72,
    oil_type: "Light Fuel Oil",
    similarity_score: 87.3,
  },
];

export const DEFAULT_METOCEAN: Record<string, MetoceanData> = {
  arabian_sea: arabianState.metocean,
  bay_of_bengal: bayState.metocean,
};
