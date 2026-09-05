import { SpillFeatureCollection, Vessel, SuspectVessel, VectorMatch, MetoceanData } from '../types';
import { globalSimulation } from './simulationEngine';

const levantineState = globalSimulation.buildInitialState('DARTIS-ow-0001');

export const INITIAL_SPILLS: SpillFeatureCollection = levantineState.spills;
export const INITIAL_VESSELS: Vessel[] = levantineState.vessels;
export const INITIAL_SUSPECTS: SuspectVessel[] = levantineState.suspects;

export const INITIAL_VECTOR_MATCHES: VectorMatch[] = [
  {
    id: "SIG-MED-CYP-01",
    spill_id: "DARTIS-ow-0001",
    title: "Levantine Basin SAR Dark Formation (Scene ow-0001.jpg)",
    date: "2024-09-01",
    location: "Cyprus Offshore (33.2590° N, 33.0578° E)",
    area_sq_km: 7.24,
    perimeter_km: 19.3,
    eccentricity: 0.89,
    oil_type: "Heavy Fuel Oil (HFO-380 Bilge Sludge)",
    culprit_name: "MEDITERRANEAN TRADER (MMSI 212000001)",
    similarity_score: 99.1,
  },
  {
    id: "SIG-MED-LIM-02",
    spill_id: "MED-2024-02",
    title: "Limassol Port Outer Anchorage Bunker Transfer Breach",
    date: "2024-06-12",
    location: "Limassol Anchorage (34° 37.8' N, 33° 04.2' E)",
    area_sq_km: 3.42,
    perimeter_km: 10.1,
    eccentricity: 0.84,
    oil_type: "Intermediate Fuel Oil (IFO-180)",
    culprit_name: "LEVANT STAR (Prior Citation)",
    similarity_score: 94.6,
  },
  {
    id: "SIG-MED-LAR-03",
    spill_id: "MED-2024-03",
    title: "Larnaca Bay Offshore Crude Discharge Sheen",
    date: "2024-03-20",
    location: "Larnaca Bay (34° 51.5' N, 33° 41.0' E)",
    area_sq_km: 4.15,
    perimeter_km: 11.7,
    eccentricity: 0.86,
    oil_type: "Heavy Crude Oil (Basrah Heavy)",
    culprit_name: "UNKNOWN VLCC",
    similarity_score: 91.8,
  },
  {
    id: "SIG-MED-AKR-04",
    spill_id: "MED-2023-04",
    title: "Akrotiri Peninsula Tank Washings Trail",
    date: "2023-11-05",
    location: "Akrotiri South (34° 32.1' N, 32° 58.4' E)",
    area_sq_km: 2.80,
    perimeter_km: 8.9,
    eccentricity: 0.82,
    oil_type: "Oily Tank Residue & Washings",
    culprit_name: "AEGEAN VOYAGER",
    similarity_score: 88.5,
  },
  {
    id: "SIG-MED-SUEZ-05",
    spill_id: "MED-2023-05",
    title: "Suez Northern Approach Transit Route Discharge",
    date: "2023-09-14",
    location: "Eastern Mediterranean Transit Corridor (32.8° N, 32.5° E)",
    area_sq_km: 5.60,
    perimeter_km: 15.2,
    eccentricity: 0.85,
    oil_type: "Crude Bilge Washings",
    culprit_name: "Suez Transit Tanker",
    similarity_score: 86.2,
  },
];

export const DEFAULT_METOCEAN: Record<string, MetoceanData> = {
  mediterranean_dartis: levantineState.metocean,
  levantine: levantineState.metocean,
  eastern_mediterranean: levantineState.metocean,
};
