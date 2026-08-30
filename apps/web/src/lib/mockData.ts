import { SpillFeatureCollection, Vessel, SuspectVessel, VectorMatch, MetoceanData } from '../types';
import { globalSimulation } from './simulationEngine';

const mumbaiState = globalSimulation.buildInitialState('INC-MUM-2024-01');

export const INITIAL_SPILLS: SpillFeatureCollection = mumbaiState.spills;
export const INITIAL_VESSELS: Vessel[] = mumbaiState.vessels;
export const INITIAL_SUSPECTS: SuspectVessel[] = mumbaiState.suspects;

export const INITIAL_VECTOR_MATCHES: VectorMatch[] = [
  {
    id: "SIG-IND-MH-01",
    spill_id: "INC-MUM-2024-01",
    title: "Mumbai High Alpha Flowline & Transit Archive",
    date: "2024-08-14",
    location: "Arabian Sea (19° 03.4' N, 72° 10.0' E)",
    area_sq_km: 5.40,
    perimeter_km: 14.8,
    eccentricity: 0.87,
    oil_type: "Heavy Crude Oil (Arabian Heavy)",
    culprit_name: "MT DESH SHANTI (Prior Offense)",
    similarity_score: 98.4,
  },
  {
    id: "SIG-IND-JNPT-02",
    spill_id: "INC-MUM-2024-02",
    title: "JNPT Port Approach Bilge Sludge Pattern",
    date: "2024-05-18",
    location: "JNPT Access Channel (18° 53.7' N, 72° 42.7' E)",
    area_sq_km: 2.85,
    perimeter_km: 8.6,
    eccentricity: 0.83,
    oil_type: "Heavy Fuel Oil (HFO-380 Bilge Sludge)",
    culprit_name: "MSC KANOKO",
    similarity_score: 94.8,
  },
  {
    id: "SIG-IND-PRONGS-03",
    spill_id: "INC-MUM-2024-03",
    title: "Prongs Reef Anchorage Bunker Transfer Breach",
    date: "2023-11-22",
    location: "Mumbai Outer Anchorage (18° 56.5' N, 72° 38.1' E)",
    area_sq_km: 1.95,
    perimeter_km: 6.2,
    eccentricity: 0.79,
    oil_type: "Intermediate Fuel Oil (IFO-180)",
    culprit_name: "MT SWARNA SINDHU",
    similarity_score: 91.2,
  },
  {
    id: "SIG-IND-NEELAM-04",
    spill_id: "INC-MUM-2024-04",
    title: "Neelam South Offshore Chronic Condensate Sheen",
    date: "2023-08-30",
    location: "Neelam Field (19° 14.7' N, 71° 59.1' E)",
    area_sq_km: 3.60,
    perimeter_km: 10.4,
    eccentricity: 0.85,
    oil_type: "Condensate & Light Crude Sheen",
    culprit_name: "CHEMBULK GIBRALTAR",
    similarity_score: 89.6,
  },
  {
    id: "SIG-IND-GK-05",
    spill_id: "GK-2023-DISCH-03",
    title: "Gulf of Kutch Tanker Discharge Archive",
    date: "2023-11-20",
    location: "Gulf of Kutch (22.5°N, 69.2°E)",
    area_sq_km: 4.80,
    perimeter_km: 12.6,
    eccentricity: 0.84,
    oil_type: "Crude Bilge Washings",
    culprit_name: "Unknown Tanker",
    similarity_score: 86.5,
  },
];

export const DEFAULT_METOCEAN: Record<string, MetoceanData> = {
  arabian_sea: mumbaiState.metocean,
  mumbai: mumbaiState.metocean,
};
