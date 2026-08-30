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

import { globalSimulation, interpolateVesselPosition, MUMBAI_INCIDENTS } from './lib/simulationEngine';

export function App() {
  const [spills, setSpills] = useState<SpillFeatureCollection>(INITIAL_SPILLS);
  const [vessels, setVessels] = useState<Vessel[]>(INITIAL_VESSELS);
  const [suspects, setSuspects] = useState<SuspectVessel[]>(INITIAL_SUSPECTS);
  const [vectorMatches, setVectorMatches] = useState<VectorMatch[]>(INITIAL_VECTOR_MATCHES);
  const [metocean, setMetocean] = useState<MetoceanData>(DEFAULT_METOCEAN.mumbai || DEFAULT_METOCEAN.arabian_sea);
  const [selectedSpillId, setSelectedSpillId] = useState<string>("INC-MUM-2024-01");
  const [selectedVesselMmsi, setSelectedVesselMmsi] = useState<number | null>(419000123);
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

  // 1. Continuous 24/7 Autonomous Simulation Hook
  useEffect(() => {
    const unsubscribe = globalSimulation.subscribe((simState) => {
      setVessels(simState.vessels);
      setSuspects(simState.suspects);
      setMetocean(simState.metocean);
    });
    return () => unsubscribe();
  }, []);

  // Data Loading from Backend
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [spillsData, vesselsData, suspectsData, vectorData, metoceanData] = await Promise.all([
        fetchSpills(),
        fetchVessels(),
        fetchCorrelations(selectedSpillId),
        fetchVectorMatches(selectedSpillId),
        fetchMetoceanData('mumbai')
      ]);

      if (spillsData?.features?.length) setSpills(spillsData);
      if (vesselsData?.length) setVessels(vesselsData);
      if (suspectsData?.length) setSuspects(suspectsData);
      if (vectorData?.length) setVectorMatches(vectorData);
      if (metoceanData) setMetocean(metoceanData);
    } catch (e) {
      // Offline fallback actively running via globalSimulation
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [selectedSpillId]);

  useEffect(() => {
    loadData();
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
                      timestamp: tick.timestamp,
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

  // Handle Multi-Incident Switcher
  const handleSelectSpillId = (spillId: string) => {
    setSelectedSpillId(spillId);
    globalSimulation.setActiveSpill(spillId);
    const newState = globalSimulation.getState();
    setVessels(newState.vessels);
    setSuspects(newState.suspects);
    setSpills(newState.spills);
    setMetocean(newState.metocean);
    setTimeOffsetMinutes(0);
    setIsPlaying(false);

    const config = MUMBAI_INCIDENTS[spillId];
    if (config) {
      setSelectedVesselMmsi(config.culpritMmsi);
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

      const interp = interpolateVesselPosition(v.mmsi, timeOffsetMinutes, 'mumbai', curPos);
      return {
        mmsi: v.mmsi,
        lon: interp.lon,
        lat: interp.lat,
        heading: interp.heading,
        speed: interp.speed,
      };
    });
  }, [timeOffsetMinutes, vessels]);

  // Selected Spill Feature
  const selectedSpillFeature = useMemo<SpillGeoFeature | null>(() => {
    return spills.features.find((f) => f.properties.id === selectedSpillId) || spills.features[0] || null;
  }, [spills, selectedSpillId]);

  // Active Map Center
  const mapCenter = useMemo<[number, number]>(() => {
    const config = MUMBAI_INCIDENTS[selectedSpillId];
    return config?.originCoords || selectedSpillFeature?.properties?.center || [72.200, 19.050];
  }, [selectedSpillFeature, selectedSpillId]);

  // Handle SAR Inference Result from Upload Modal
  const handleInferenceResult = (res: SARInferenceResponse) => {
    if (res?.spill) {
      const newFeature: SpillGeoFeature = {
        type: "Feature",
        id: res.spill.id,
        properties: {
          id: res.spill.id,
          detection_timestamp: res.spill.detection_timestamp,
          area_sq_km: res.spill.area_sq_km,
          perimeter_km: res.spill.perimeter_km,
          confidence_score: res.spill.confidence_score,
          source_scene: res.spill.source_scene,
          status: 'ACTIVE',
          center: res.spill.center,
          estimated_discharge_liters: res.spill.estimated_discharge_liters,
          slick_type: res.spill.slick_type,
        },
        geometry: {
          type: "Polygon",
          coordinates: [res.spill.polygon_coordinates],
        },
      };

      setSpills((prev) => ({
        type: "FeatureCollection",
        features: [newFeature, ...prev.features.filter((f) => f.properties.id !== res.spill.id)],
      }));

      setSelectedSpillId(res.spill.id);

      if (res.ranked_suspects?.length) {
        setSuspects(res.ranked_suspects);
        setSelectedVesselMmsi(res.ranked_suspects[0].mmsi);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070a12] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Header */}
      <Header
        selectedSpillId={selectedSpillId}
        onSelectSpillId={handleSelectSpillId}
        spillFeature={selectedSpillFeature}
        suspects={suspects}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        onOpenForensicModal={() => setIsForensicOpen(true)}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        metocean={metocean}
      />

      {/* 2. Main Tactical Viewport */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left: Dark Bathymetry Map Canvas */}
        <div className="flex-1 h-full relative flex flex-col">
          <TacticalMap
            spills={spills}
            vessels={vessels}
            suspects={suspects}
            selectedSpillId={selectedSpillId}
            onSelectSpill={handleSelectSpillId}
            onSelectVessel={(mmsi) => setSelectedVesselMmsi(mmsi)}
            scrubbedVessels={scrubbedVessels}
            centerCoordinates={mapCenter}
            timeOffsetMinutes={timeOffsetMinutes}
            metocean={metocean}
          />

          {/* Time-Scrubber Timeline (-360m to 0) */}
          <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto">
            <TimeScrubber
              timeOffsetMinutes={timeOffsetMinutes}
              onChangeTimeOffset={setTimeOffsetMinutes}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              playbackSpeed={playbackSpeed}
              onChangeSpeed={(spd: number) => setPlaybackSpeed(spd)}
            />
          </div>
        </div>

        {/* Right: Forensic Incident Inspector Panel (Desktop) */}
        <div className="hidden lg:block w-[420px] xl:w-[460px] h-full z-20 shadow-2xl">
          <InspectorPanel
            spill={selectedSpillFeature?.properties}
            spillFeature={selectedSpillFeature}
            suspects={suspects}
            vectorMatches={vectorMatches}
            selectedVesselMmsi={selectedVesselMmsi ?? undefined}
            onSelectVessel={(mmsi) => setSelectedVesselMmsi(mmsi)}
            metocean={metocean}
          />
        </div>
      </div>

      {/* 3. Mobile Bottom Tab Bar */}
      <div className="lg:hidden h-14 bg-[#111622] border-t border-slate-800 flex items-center justify-around z-30 px-2 font-mono text-[10px]">
        <button
          onClick={() => {
            setMobileActiveTab('map');
            setIsMobileDrawerOpen(false);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${
            mobileActiveTab === 'map' && !isMobileDrawerOpen ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>MAP</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('threat');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${
            isMobileDrawerOpen && mobileActiveTab === 'threat' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>INSPECTOR</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('suspects');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${
            isMobileDrawerOpen && mobileActiveTab === 'suspects' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Ship className="w-4 h-4" />
          <span>VESSELS</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('vectors');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${
            isMobileDrawerOpen && mobileActiveTab === 'vectors' ? 'text-cyan-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>VECTORS</span>
        </button>
      </div>

      {/* 4. Mobile Drawer Modal */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bottom-14 z-40 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="h-[80%] w-full bg-[#111622] rounded-t-2xl border-t border-slate-700 overflow-hidden flex flex-col">
            <InspectorPanel
              spill={selectedSpillFeature?.properties}
              spillFeature={selectedSpillFeature}
              suspects={suspects}
              vectorMatches={vectorMatches}
              selectedVesselMmsi={selectedVesselMmsi ?? undefined}
              onSelectVessel={(mmsi) => {
                setSelectedVesselMmsi(mmsi);
                setIsMobileDrawerOpen(false);
              }}
              onClose={() => setIsMobileDrawerOpen(false)}
              isMobileModal={true}
              metocean={metocean}
            />
          </div>
        </div>
      )}

      {/* 5. Modals */}
      <UploadSarModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDetectionComplete={handleInferenceResult}
      />

      <ForensicModal
        isOpen={isForensicOpen}
        onClose={() => setIsForensicOpen(false)}
        spillId={selectedSpillId}
      />
    </div>
  );
}

export default App;
