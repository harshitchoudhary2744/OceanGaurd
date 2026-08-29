import { SpillFeatureCollection, Vessel, SuspectVessel, VectorMatch, MetoceanData } from '../types';
import { globalSimulation } from './simulationEngine';

const initialState = globalSimulation.buildInitialState('arabian_sea');
const bayState = globalSimulation.buildInitialState('bay_of_bengal');

export const INITIAL_SPILLS: SpillFeatureCollection = {
  type: "FeatureCollection",
  features: [
    ...initialState.spills.features,
    ...bayState.spills.features,
  ],
};

export const INITIAL_VESSELS: Vessel[] = initialState.vessels;
export const INITIAL_SUSPECTS: SuspectVessel[] = initialState.suspects;

const curYr = new Date().getFullYear();

export const INITIAL_VECTOR_MATCHES: VectorMatch[] = [
  {
    id: "SIG-IND-MH-01",
    spill_id: `MH-${curYr}-SHEEN-08`,
    title: "Mumbai High Offshore Platform Sheen Archive",
    date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    location: "Arabian Sea (19.4°N, 71.3°E)",
    area_sq_km: 5.25,
    perimeter_km: 14.1,
    eccentricity: 0.87,
    oil_type: "Heavy Fuel Oil (HFO-380)",
    culprit_name: "MT DESH SHANTI (Prior Offense)",
    similarity_score: 99.8,
  },
  {
    id: "SIG-IND-GK-02",
    spill_id: `GK-${curYr}-DISCH-03`,
    title: "Gulf of Kutch Tanker Discharge Pattern",
    date: new Date(Date.now() - 65 * 86400000).toISOString().slice(0, 10),
    location: "Gulf of Kutch (22.5°N, 69.2°E)",
    area_sq_km: 4.80,
    perimeter_km: 12.6,
    eccentricity: 0.84,
    oil_type: "Crude Bilge Washings",
    culprit_name: "Unknown Tanker",
    similarity_score: 94.2,
  },
  {
    id: "SIG-IND-EN-03",
    spill_id: `EN-${curYr - 1}-SLICK-11`,
    title: "Chennai Port Ennore Oil Slick Archive",
    date: new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10),
    location: "Bay of Bengal (13.3°N, 80.4°E)",
    area_sq_km: 2.95,
    perimeter_km: 8.9,
    eccentricity: 0.79,
    oil_type: "Marine Diesel / Bunker",
    culprit_name: "BW MAPLE Case Study",
    similarity_score: 91.5,
  },
  {
    id: "SIG-IND-CH-04",
    spill_id: `CH-${curYr}-ANCH-05`,
    title: "Cochin Outer Anchorage Sheen",
    date: new Date(Date.now() - 150 * 86400000).toISOString().slice(0, 10),
    location: "Lakshadweep Sea (9.9°N, 76.1°E)",
    area_sq_km: 1.80,
    perimeter_km: 5.8,
    eccentricity: 0.72,
    oil_type: "Light Fuel Oil",
    similarity_score: 87.3,
  },
];

export const DEFAULT_METOCEAN: Record<string, MetoceanData> = {
  arabian_sea: initialState.metocean,
  bay_of_bengal: bayState.metocean,
};
