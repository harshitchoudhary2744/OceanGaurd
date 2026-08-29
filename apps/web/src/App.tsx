import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { TacticalMap } from './components/TacticalMap';
import { InspectorPanel } from './components/InspectorPanel';
import { TimeScrubber } from './components/TimeScrubber';
import { UploadSarModal } from './components/UploadSarModal';
import { ForensicModal } from './components/ForensicModal';
import { Map as MapIcon, ShieldAlert, Ship, Database } from 'lucide-react';

import {
  SpillFeatureCollection,
  SpillGeoFeature,
  Vessel,
  SuspectVessel,
  VectorMatch,
  SARInferenceResponse,
  MetoceanData
} from './types';
import {
  fetchSpills,
  fetchCorrelations,
  fetchVectorMatches,
  fetchVessels,
  fetchMetoceanData
} from './lib/api';
import {
  INITIAL_SPILLS,
  INITIAL_VESSELS,
  INITIAL_SUSPECTS,
  INITIAL_VECTOR_MATCHES,
  DEFAULT_METOCEAN
} from './lib/mockData';

import { globalSimulation, interpolateVesselPosition } from './lib/simulationEngine';

export function App() {
  const [spills, setSpills] = useState<SpillFeatureCollection>(INITIAL_SPILLS);
  const [vessels, setVessels] = useState<Vessel[]>(INITIAL_VESSELS);
  const [suspects, setSuspects] = useState<SuspectVessel[]>(INITIAL_SUSPECTS);
  const [vectorMatches, setVectorMatches] = useState<VectorMatch[]>(INITIAL_VECTOR_MATCHES);
  const [metocean, setMetocean] = useState<MetoceanData>(DEFAULT_METOCEAN.bay_of_bengal);
  const [selectedSpillId, setSelectedSpillId] = useState("INC-IND-2017-02");
  const [selectedVesselMmsi, setSelectedVesselMmsi] = useState<number | null>(419000789);
  const [activeScenario, setActiveScenario] = useState("bay_of_bengal");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mobile Bottom Sheet / Active Tab
  const [mobileActiveTab, setMobileActiveTab] = useState<'map' | 'threat' | 'suspects' | 'vectors'>('map');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Time Scrubber State (-360 to 0)
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isForensicOpen, setIsForensicOpen] = useState<boolean>(false);

  // 1. Continuous 24/7 Autonomous Simulation Hook (Deterministic & synchronized)
  useEffect(() => {
    const unsubscribe = globalSimulation.subscribe((simState) => {
      setVessels(simState.vessels);
      setSuspects(simState.suspects);
      setMetocean(simState.metocean);
    });
    return () => unsubscribe();
  }, []);

  // Data Loading from Backend (with silent offline fallback)
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [spillsData, vesselsData, suspectsData, vectorData, metoceanData] = await Promise.all([
        fetchSpills(),
        fetchVessels(),
        fetchCorrelations(selectedSpillId),
        fetchVectorMatches(selectedSpillId),
        fetchMetoceanData(activeScenario)
      ]);

      if (spillsData?.features?.length) setSpills(spillsData);
      if (vesselsData?.length) setVessels(vesselsData);
      if (suspectsData?.length) setSuspects(suspectsData);
      if (vectorData?.length) setVectorMatches(vectorData);
      if (metoceanData) setMetocean(metoceanData);
    } catch (e) {
      // Offline fallback already actively running via globalSimulation
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [selectedSpillId, activeScenario]);

  useEffect(() => {
    loadData();
    // Auto-sync polling every 5 minutes
    const autoRefreshInterval = setInterval(() => {
      loadData();
    }, 300000);
    return () => clearInterval(autoRefreshInterval);
  }, [loadData]);

  // WebSocket Live Telemetry Feed
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/telemetry';
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TELEMETRY_TICK' && data.vessels?.length) {
            setVessels((prev) =>
              prev.map((v) => {
                const tick = data.vessels.find((t: any) => t.mmsi === v.mmsi);
                if (tick) {
                  return {
                    ...v,
                    current_position: {
                      latitude: tick.latitude,
                      longitude: tick.longitude,
                      heading_degrees: tick.heading_degrees,
                      speed_knots: tick.speed_knots,
                      timestamp_utc: tick.timestamp_utc,
                    },
                  };
                }
                return v;
              })
            );
          }
        } catch (err) {
          console.error("WS Parse error", err);
        }
      };
    } catch (err) {
      console.warn("WebSocket stream unavailable, using simulated kinematic replay");
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Handle Scenario Switcher
  const handleScenarioChange = (scenario: string) => {
    setActiveScenario(scenario);
    globalSimulation.setScenario(scenario);
    const newState = globalSimulation.getState();
    setVessels(newState.vessels);
    setSuspects(newState.suspects);
    setSpills(newState.spills);
    setMetocean(newState.metocean);
    setTimeOffsetMinutes(0);
    setIsPlaying(false);
    if (scenario === 'arabian_sea') {
      setSelectedSpillId("INC-IND-2024-01");
      setSelectedVesselMmsi(419000123);
    } else {
      setSelectedSpillId("INC-IND-2017-02");
      setSelectedVesselMmsi(419000789);
    }
  };

  // Interpolated Vessel Positions based on Time Scrubber (-360 to 0)
  const scrubbedVessels = useMemo(() => {
    if (timeOffsetMinutes === 0) return undefined;

    return vessels.map((v) => {
      const curPos = v.current_position ? {
        longitude: v.current_position.longitude,
        latitude: v.current_position.latitude,
        heading_degrees: v.current_position.heading_degrees,
        speed_knots: v.current_position.speed_knots,
      } : undefined;

      const interp = interpolateVesselPosition(v.mmsi, timeOffsetMinutes, activeScenario, curPos);
      return {
        mmsi: v.mmsi,
        lon: interp.lon,
        lat: interp.lat,
        heading: interp.heading,
        speed: interp.speed,
      };
    });
  }, [timeOffsetMinutes, vessels, activeScenario]);

  // Selected Spill Feature
  const selectedSpillFeature = useMemo<SpillGeoFeature | null>(() => {
    return spills.features.find((f) => f.properties.id === selectedSpillId) || spills.features[0] || null;
  }, [spills, selectedSpillId]);

  // Active Map Center
  const mapCenter = useMemo<[number, number]>(() => {
    if (activeScenario === 'bay_of_bengal') {
      return selectedSpillFeature?.properties?.center || [80.750, 13.250];
    }
    return selectedSpillFeature?.properties?.center || [72.150, 19.050];
  }, [selectedSpillFeature, activeScenario]);

  // Handle Detection from Upload
  const handleDetectionComplete = (result: SARInferenceResponse) => {
    if (result.geojson_feature) {
      setSpills((prev) => ({
        ...prev,
        features: [result.geojson_feature, ...prev.features],
      }));
      setSelectedSpillId(result.geojson_feature.properties.id);
    }
    if (result.ranked_suspects?.length) {
      setSuspects(result.ranked_suspects);
      setSelectedVesselMmsi(result.ranked_suspects[0].mmsi);
    }
  };

  const primaryCulprit = suspects.find((s) => s.probability_score > 70) || suspects[0];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0f19] text-slate-100 overflow-hidden select-none">
      {/* 1. Clean Header */}
      <Header
        selectedSpillId={selectedSpillId}
        spillFeature={selectedSpillFeature}
        suspects={suspects}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        onOpenForensicModal={() => setIsForensicOpen(true)}
        activeScenario={activeScenario}
        onScenarioChange={handleScenarioChange}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        metocean={metocean}
      />

      {/* 2. Main Tactical Stage */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Map Container */}
        <div className="flex-1 h-full relative">
          <TacticalMap
            spills={spills}
            vessels={vessels}
            suspects={suspects}
            selectedSpillId={selectedSpillId}
            onSelectSpill={(id) => {
              setSelectedSpillId(id);
              if (window.innerWidth < 1024) setIsMobileDrawerOpen(true);
            }}
            onSelectVessel={(mmsi) => {
              setSelectedVesselMmsi(mmsi);
              if (window.innerWidth < 1024) setIsMobileDrawerOpen(true);
            }}
            scrubbedVessels={scrubbedVessels}
            centerCoordinates={mapCenter}
            timeOffsetMinutes={timeOffsetMinutes}
            metocean={metocean}
            scenario={activeScenario}
          />

          {/* Mobile Quick Suspect Pill */}
          <div className="lg:hidden absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-rose-500/40 text-xs font-mono shadow-lg text-white"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span className="font-bold text-rose-300">
                {primaryCulprit ? `${primaryCulprit.probability_score}%: ${primaryCulprit.name}` : 'Threat Details'}
              </span>
            </button>
          </div>

          {/* Floating Time Scrubber */}
          <TimeScrubber
            timeOffsetMinutes={timeOffsetMinutes}
            onChangeTimeOffset={setTimeOffsetMinutes}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={setPlaybackSpeed}
            scenario={activeScenario}
          />
        </div>

        {/* Desktop Inspector Sidebar (hidden on screens < lg) */}
        <div className="hidden lg:block w-[360px] xl:w-[400px] h-full shrink-0">
          <InspectorPanel
            spill={selectedSpillFeature?.properties}
            spillFeature={selectedSpillFeature}
            suspects={suspects}
            vectorMatches={vectorMatches}
            onSelectVessel={setSelectedVesselMmsi}
            selectedVesselMmsi={selectedVesselMmsi ?? undefined}
            metocean={metocean}
            scenario={activeScenario}
          />
        </div>

        {/* Mobile Expandable Drawer / Modal */}
        {isMobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
            <div className="bg-[#111622] border-t border-slate-800 rounded-t-2xl max-h-[82vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
              {/* Drag handle bar */}
              <div className="w-12 h-1.5 bg-slate-700/60 rounded-full mx-auto my-2" />
              <InspectorPanel
                spill={selectedSpillFeature?.properties}
                spillFeature={selectedSpillFeature}
                suspects={suspects}
                vectorMatches={vectorMatches}
                onSelectVessel={setSelectedVesselMmsi}
                selectedVesselMmsi={selectedVesselMmsi ?? undefined}
                onClose={() => setIsMobileDrawerOpen(false)}
                isMobileModal={true}
                metocean={metocean}
                scenario={activeScenario}
              />
            </div>
          </div>
        )}
      </main>

      {/* 3. Mobile Bottom Navigation Bar (< lg) */}
      <nav className="lg:hidden h-14 bg-slate-950 border-t border-slate-800 flex items-center justify-around z-30 shrink-0 px-2">
        <button
          onClick={() => {
            setMobileActiveTab('map');
            setIsMobileDrawerOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-mono py-1 px-3 rounded-lg transition-colors ${
            !isMobileDrawerOpen && mobileActiveTab === 'map' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>Map</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('threat');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-mono py-1 px-3 rounded-lg transition-colors ${
            isMobileDrawerOpen && mobileActiveTab === 'threat' ? 'text-rose-300 font-bold' : 'text-slate-400'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Threat</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('suspects');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-mono py-1 px-3 rounded-lg transition-colors ${
            isMobileDrawerOpen && mobileActiveTab === 'suspects' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Ship className="w-4 h-4" />
          <span>Suspects ({suspects.length})</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('vectors');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-mono py-1 px-3 rounded-lg transition-colors ${
            isMobileDrawerOpen && mobileActiveTab === 'vectors' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Intel</span>
        </button>
      </nav>

      {/* 4. SAR Ingest Modal */}
      <UploadSarModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDetectionComplete={handleDetectionComplete}
      />

      {/* 5. Forensic SAR Side-by-Side Modal */}
      <ForensicModal
        isOpen={isForensicOpen}
        onClose={() => setIsForensicOpen(false)}
        spillId={selectedSpillId}
      />
    </div>
  );
}

export default App;
