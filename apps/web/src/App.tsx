import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { TacticalMap } from './components/TacticalMap';
import { InspectorPanel } from './components/InspectorPanel';
import { TimeScrubber } from './components/TimeScrubber';
import { UploadSarModal } from './components/UploadSarModal';
import { ForensicModal } from './components/ForensicModal';

import {
  SpillFeatureCollection,
  SpillGeoFeature,
  Vessel,
  SuspectVessel,
  VectorMatch,
  SARInferenceResponse
} from './types';
import {
  fetchSpills,
  fetchCorrelations,
  fetchVectorMatches,
  fetchVessels
} from './lib/api';
import {
  INITIAL_SPILLS,
  INITIAL_VESSELS,
  INITIAL_SUSPECTS,
  INITIAL_VECTOR_MATCHES
} from './lib/mockData';

export function App() {
  const [spills, setSpills] = useState<SpillFeatureCollection>(INITIAL_SPILLS);
  const [vessels, setVessels] = useState<Vessel[]>(INITIAL_VESSELS);
  const [suspects, setSuspects] = useState<SuspectVessel[]>(INITIAL_SUSPECTS);
  const [vectorMatches, setVectorMatches] = useState<VectorMatch[]>(INITIAL_VECTOR_MATCHES);

  const [selectedSpillId, setSelectedSpillId] = useState('INC-IND-2024-01');
  const [selectedVesselMmsi, setSelectedVesselMmsi] = useState<number | null>(419000123);
  const [activeScenario, setActiveScenario] = useState('arabian_sea');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Time Scrubber State (-360 to 0)
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isForensicOpen, setIsForensicOpen] = useState<boolean>(false);

  // Data Loading
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [spillsData, vesselsData, suspectsData, vectorData] = await Promise.all([
        fetchSpills(),
        fetchVessels(),
        fetchCorrelations(selectedSpillId),
        fetchVectorMatches(selectedSpillId)
      ]);

      if (spillsData?.features?.length) setSpills(spillsData);
      if (vesselsData?.length) setVessels(vesselsData);
      if (suspectsData?.length) setSuspects(suspectsData);
      if (vectorData?.length) setVectorMatches(vectorData);
    } catch (e) {
      console.warn("API fallback mode:", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [selectedSpillId]);

  useEffect(() => {
    loadData();
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
                      speed_knots: tick.speed_knots,
                      heading_degrees: tick.heading_degrees,
                      timestamp: tick.timestamp
                    }
                  };
                }
                return v;
              })
            );
          }
        } catch (e) {}
      };
      ws.onerror = () => {};
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const selectedSpillFeature = useMemo<SpillGeoFeature | null>(() => {
    return spills.features.find((f) => f.properties.id === selectedSpillId) || spills.features[0] || null;
  }, [spills, selectedSpillId]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (activeScenario === 'bay_of_bengal') return [80.750, 13.250]; // Chennai / Bay of Bengal
    return [72.150, 19.050]; // Arabian Sea / Mumbai High Sector
  }, [activeScenario]);

  // Scrubber Interpolation
  const scrubbedVessels = useMemo(() => {
    if (timeOffsetMinutes === 0) return undefined;
    const progress = (timeOffsetMinutes + 360) / 360;

    return vessels.map((v) => {
      const susp = suspects.find((s) => s.mmsi === v.mmsi);
      if (susp?.trajectory && susp.trajectory.length > 1) {
        const traj = susp.trajectory;
        const indexFloat = progress * (traj.length - 1);
        const idx = Math.min(Math.floor(indexFloat), traj.length - 2);
        const localProg = indexFloat - idx;
        const p1 = traj[idx];
        const p2 = traj[idx + 1];

        return {
          mmsi: v.mmsi,
          lon: p1[0] + localProg * (p2[0] - p1[0]),
          lat: p1[1] + localProg * (p2[1] - p1[1]),
          heading: susp.heading_degrees
        };
      }

      const baseLat = v.current_position?.latitude || 19.05;
      const baseLon = v.current_position?.longitude || 72.15;
      const d = (1.0 - progress) * 0.25;
      return {
        mmsi: v.mmsi,
        lon: baseLon - d,
        lat: baseLat - d,
        heading: v.current_position?.heading_degrees || 135.0
      };
    });
  }, [timeOffsetMinutes, vessels, suspects]);

  const handleDetectionComplete = (result: SARInferenceResponse) => {
    if (result.geojson_feature) {
      setSpills((prev) => ({
        type: 'FeatureCollection',
        features: [result.geojson_feature, ...prev.features]
      }));
      setSelectedSpillId(result.geojson_feature.properties.id);
      if (result.ranked_suspects?.length) {
        setSuspects(result.ranked_suspects);
      }
    }
  };

  const handleScenarioChange = (scenario: string) => {
    setActiveScenario(scenario);
    if (scenario === 'bay_of_bengal') {
      setSelectedSpillId('INC-IND-2024-02');
    } else {
      setSelectedSpillId('INC-IND-2024-01');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0f131d] text-[#dfe2f1] overflow-hidden">
      {/* 1. Clean Header */}
      <Header
        selectedSpillId={selectedSpillId}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        onOpenForensicModal={() => setIsForensicOpen(true)}
        activeScenario={activeScenario}
        onScenarioChange={handleScenarioChange}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
      />

      {/* 2. Main Stage (Map 75% | Inspector 25%) */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Map Container */}
        <div className="flex-1 h-full relative">
          <TacticalMap
            spills={spills}
            vessels={vessels}
            suspects={suspects}
            selectedSpillId={selectedSpillId}
            onSelectSpill={setSelectedSpillId}
            onSelectVessel={setSelectedVesselMmsi}
            scrubbedVessels={scrubbedVessels}
            centerCoordinates={mapCenter}
          />

          {/* Floating Time Scrubber */}
          <TimeScrubber
            timeOffsetMinutes={timeOffsetMinutes}
            onChangeTimeOffset={setTimeOffsetMinutes}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={setPlaybackSpeed}
          />
        </div>

        {/* Inspector Sidebar */}
        <div className="w-[360px] xl:w-[400px] h-full shrink-0">
          <InspectorPanel
            selectedSpill={selectedSpillFeature}
            suspects={suspects}
            vectorMatches={vectorMatches}
            onSelectVessel={setSelectedVesselMmsi}
            selectedVesselMmsi={selectedVesselMmsi}
          />
        </div>
      </main>

      {/* 3. SAR Ingest Modal */}
      <UploadSarModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDetectionComplete={handleDetectionComplete}
      />

      {/* 4. Forensic SAR Side-by-Side Modal */}
      <ForensicModal
        isOpen={isForensicOpen}
        onClose={() => setIsForensicOpen(false)}
        spillId={selectedSpillId}
      />
    </div>
  );
}

export default App;
