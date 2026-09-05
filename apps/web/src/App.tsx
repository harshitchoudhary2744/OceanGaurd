import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { TacticalMap } from './components/TacticalMap';
import { InspectorPanel } from './components/InspectorPanel';
import { TimeScrubber } from './components/TimeScrubber';
import { UploadSarModal } from './components/UploadSarModal';
import { ForensicModal } from './components/ForensicModal';
import { AlertNotificationCenter, FloatingAlertBanner } from './components/AlertNotificationCenter';
import { Map as MapIcon, ShieldAlert, Ship, Database, AlertTriangle, Sparkles, Bell } from 'lucide-react';

import {
  SpillFeatureCollection,
  SpillGeoFeature,
  Vessel,
  SuspectVessel,
  VectorMatch,
  SARInferenceResponse,
  MetoceanData,
  DashboardAlert,
  MapFocusTarget
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

import {
  globalSimulation,
  interpolateVesselPosition,
  MUMBAI_INCIDENTS,
  MMSI_TO_INCIDENT,
  generateDashboardAlerts,
  registerCustomSpillIncident
} from './lib/simulationEngine';

export function App() {
  const [spills, setSpills] = useState<SpillFeatureCollection>(INITIAL_SPILLS);
  const [vessels, setVessels] = useState<Vessel[]>(INITIAL_VESSELS);
  const [suspects, setSuspects] = useState<SuspectVessel[]>(INITIAL_SUSPECTS);
  const [vectorMatches, setVectorMatches] = useState<VectorMatch[]>(INITIAL_VECTOR_MATCHES);
  const [metocean, setMetocean] = useState<MetoceanData>(DEFAULT_METOCEAN.mediterranean_dartis || DEFAULT_METOCEAN.levantine || Object.values(DEFAULT_METOCEAN)[0]);
  const [selectedSpillId, setSelectedSpillId] = useState<string>("DARTIS-ow-0001");
  const [selectedVesselMmsi, setSelectedVesselMmsi] = useState<number | null>(212000001);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mobile Bottom Sheet / Active Tab
  const [mobileActiveTab, setMobileActiveTab] = useState<'map' | 'overview' | 'sar_physics' | 'culprit' | 'metocean' | 'threats'>('map');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Automatic Alert Notification Center & Map Locator Target State
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [isAlertCenterOpen, setIsAlertCenterOpen] = useState<boolean>(false);
  const [activeBannerAlert, setActiveBannerAlert] = useState<DashboardAlert | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);

  // Time Scrubber State (-360 to 0)
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isForensicOpen, setIsForensicOpen] = useState<boolean>(false);

  // Dynamic Alert Generation Loop
  useEffect(() => {
    const generated = generateDashboardAlerts(selectedSpillId, timeOffsetMinutes, metocean);
    setAlerts(generated);
    const topCritical = generated.find((a) => a.severity === 'CRITICAL' && !a.acknowledged);
    if (topCritical) {
      setActiveBannerAlert(topCritical);
    }
  }, [selectedSpillId, timeOffsetMinutes, metocean]);

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    if (activeBannerAlert?.id === id) {
      setActiveBannerAlert(null);
    }
  };

  const handleClearAllAlerts = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    setActiveBannerAlert(null);
  };

  const handleAlertAction = (actionType: string, actionValue: any, alert?: DashboardAlert) => {
    // 1. Locate on Map (Direct Coordinates Locking)
    if (actionType === 'focus_map' || Array.isArray(actionValue) || (alert && alert.coordinates)) {
      const coords: [number, number] = Array.isArray(actionValue) && actionValue.length === 2
        ? (actionValue as [number, number])
        : (alert?.coordinates || [33.05775642, 33.25902604]);

      setFocusTarget({
        coordinates: coords,
        title: alert?.title || 'Tactical Target Located',
        category: alert?.category,
        description: alert?.message || `Navigated to ${coords[1].toFixed(4)}°N, ${coords[0].toFixed(4)}°E`,
        zoom: 11.8,
        timestamp: Date.now(),
      });

      if (alert?.incident_id && alert.incident_id !== selectedSpillId) {
        handleSelectSpillId(alert.incident_id);
      }

      setMobileActiveTab('map');
      setIsMobileDrawerOpen(false);
      setIsAlertCenterOpen(false);
    } 
    // 2. Jump Timeline Scrubber to Breach Discharging Offset
    else if (actionType === 'jump_scrubber') {
      const offset = typeof actionValue === 'number' ? actionValue : (alert?.incident_offset_minutes ?? -45);
      setTimeOffsetMinutes(offset);

      if (alert?.coordinates) {
        setFocusTarget({
          coordinates: alert.coordinates,
          title: alert.title || 'Breach Discharge Location',
          category: alert.category,
          description: alert.message,
          zoom: 11.5,
          timestamp: Date.now(),
        });
      }

      setMobileActiveTab('map');
      setIsMobileDrawerOpen(false);
      setIsAlertCenterOpen(false);
    } 
    // 3. View Environmental Threat Tab
    else if (actionType === 'view_threat') {
      if (alert?.coordinates) {
        setFocusTarget({
          coordinates: alert.coordinates,
          title: alert.title,
          category: alert.category,
          description: alert.message,
          zoom: 11.2,
          timestamp: Date.now(),
        });
      }
      setMobileActiveTab('threats');
      setIsMobileDrawerOpen(true);
      setIsAlertCenterOpen(false);
    } 
    // 4. View Culprit / Suspect Vessel
    else if (actionType === 'view_suspect') {
      if (typeof actionValue === 'number') {
        handleSelectVessel(actionValue);
      }
      setMobileActiveTab('culprit');
      setIsMobileDrawerOpen(true);
      setIsAlertCenterOpen(false);
    } 
    // 5. Default Fallback
    else {
      setIsAlertCenterOpen(false);
    }
  };

  const handleFocusLocation = (coords: [number, number], title: string, category?: string) => {
    setFocusTarget({
      coordinates: coords,
      title: title,
      category: category,
      description: `Target coordinates locked: ${coords[1].toFixed(4)}°N, ${coords[0].toFixed(4)}°E`,
      zoom: 11.8,
      timestamp: Date.now(),
    });
    setMobileActiveTab('map');
    setIsMobileDrawerOpen(false);
  };

  const unreadAlertCount = useMemo(() => alerts.filter((a) => !a.acknowledged).length, [alerts]);

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
        fetchMetoceanData('mediterranean_dartis')
      ]);

      if (spillsData?.features?.length) setSpills(spillsData);
      if (vesselsData?.length) setVessels(vesselsData);
      if (suspectsData?.length) {
        setSuspects(suspectsData);
        const config = MUMBAI_INCIDENTS[selectedSpillId];
        setSelectedVesselMmsi(config?.culpritMmsi || suspectsData[0].mmsi);
      }
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

    const config = MUMBAI_INCIDENTS[spillId];
    if (config) {
      setSelectedVesselMmsi(config.culpritMmsi);
      if (config.originCoords) {
        setFocusTarget({
          coordinates: config.originCoords,
          title: config.name,
          category: 'oil_spill',
          description: config.locationName,
          zoom: 11.2,
          timestamp: Date.now(),
        });
      }
    }
  };

  // Handle Anomaly / Vessel Click Selection (Bidirectional synchronization)
  const handleSelectVessel = (mmsi: number) => {
    setSelectedVesselMmsi(mmsi);
    const targetSpillId = MMSI_TO_INCIDENT[mmsi] || selectedSpillId;

    if (targetSpillId !== selectedSpillId) {
      setSelectedSpillId(targetSpillId);
      globalSimulation.setActiveSpill(targetSpillId);
      const newState = globalSimulation.getState();
      setVessels(newState.vessels);
      setSuspects(newState.suspects);
      setSpills(newState.spills);
      setMetocean(newState.metocean);
    }
  };

  // Handle Timeline Playback
  const handleTogglePlay = () => {
    if (!isPlaying) {
      // If at the end of the timeline, restart replay from -360m (-6h)
      if (timeOffsetMinutes >= 0) {
        setTimeOffsetMinutes(-360);
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  // Synchronized Replay Timer Loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimeOffsetMinutes((prev) => {
          const next = prev + playbackSpeed * 2;
          if (next >= 0) {
            setIsPlaying(false);
            return 0; // Cleanly park at LIVE
          }
          return next;
        });
      }, 140);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Interpolated Vessel Positions: ONLY the selected anomaly's culprit vessel replays along its trajectory
  const scrubbedVessels = useMemo(() => {
    const activeCulpritMmsi = MUMBAI_INCIDENTS[selectedSpillId]?.culpritMmsi || selectedVesselMmsi;

    return vessels.map((v) => {
      const curPos = v.current_position ? {
        longitude: v.current_position.longitude,
        latitude: v.current_position.latitude,
        heading_degrees: v.current_position.heading_degrees,
        speed_knots: v.current_position.speed_knots,
      } : undefined;

      // Replay only the active anomaly suspect; background traffic stays static at live (t=0)
      const offsetForThisVessel = (v.mmsi === activeCulpritMmsi) ? timeOffsetMinutes : 0;
      const interp = interpolateVesselPosition(v.mmsi, offsetForThisVessel, 'mediterranean_dartis', curPos);
      return {
        mmsi: v.mmsi,
        lon: interp.lon,
        lat: interp.lat,
        heading: interp.heading,
        speed: interp.speed,
      };
    });
  }, [timeOffsetMinutes, vessels, selectedSpillId, selectedVesselMmsi]);

  // Selected Spill Feature
  const selectedSpillFeature = useMemo<SpillGeoFeature | null>(() => {
    return spills.features.find((f) => f.properties.id === selectedSpillId) || spills.features[0] || null;
  }, [spills, selectedSpillId]);

  // Active Map Center
  const mapCenter = useMemo<[number, number]>(() => {
    const config = MUMBAI_INCIDENTS[selectedSpillId];
    return config?.originCoords || selectedSpillFeature?.properties?.center || [33.05775642, 33.25902604];
  }, [selectedSpillFeature, selectedSpillId]);

  // Handle SAR Inference Result from Upload Modal
  const handleInferenceResult = (res: SARInferenceResponse) => {
    if (res?.spill) {
      // 1. Use response.geojson_feature.geometry to render the detected oil-spill polygon
      const geometry = res.geojson_feature?.geometry || {
        type: "Polygon",
        coordinates: res.spill.polygon_coordinates ? [res.spill.polygon_coordinates] : [],
      };

      // 2. Use response.spill.center for the spill center / map positioning: [longitude, latitude]
      const centerLon = res.spill.center[0];
      const centerLat = res.spill.center[1];

      // 3. Register custom spill incident into simulationEngine for full HUD/threat/culprit synchronization
      registerCustomSpillIncident({
        id: res.spill.id,
        name: `SAR Detection: ${res.spill.source_scene || res.spill.id}`,
        originCoords: [centerLon, centerLat],
        areaSqKm: res.spill.area_sq_km,
        sourceScene: res.spill.source_scene,
        slickType: res.spill.slick_type,
        confidence: res.spill.confidence_score,
        polygonCoordinates: geometry.coordinates?.[0] || res.spill.polygon_coordinates,
        culpritMmsi: res.primary_suspect?.mmsi || (res.ranked_suspects?.[0]?.mmsi),
        culpritName: res.primary_suspect?.name || (res.ranked_suspects?.[0]?.name),
        acquisitionTimestampUtc: res.spill.acquisition_timestamp_utc,
        detectionTimestampIso: res.spill.detection_timestamp,
      });

      const newFeature: SpillGeoFeature = {
        type: "Feature",
        id: res.spill.id,
        properties: {
          id: res.spill.id,
          detection_timestamp: res.spill.detection_timestamp,
          acquisition_timestamp_ist: res.spill.acquisition_timestamp_ist || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + ' ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST',
          acquisition_timestamp_utc: res.spill.acquisition_timestamp_utc || new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
          area_sq_km: res.spill.area_sq_km,
          perimeter_km: res.spill.perimeter_km,
          confidence_score: res.spill.confidence_score,
          segmentation_dice_score: res.metrics?.segmentation_dice_score || 0.988,
          oil_likelihood_score: res.metrics?.oil_likelihood_score || 0.940,
          source_scene: res.spill.source_scene,
          status: 'ACTIVE',
          center: [centerLon, centerLat],
          centroid: res.spill.centroid || [centerLat, centerLon],
          estimated_discharge_liters: res.spill.estimated_discharge_liters,
          slick_type: res.spill.slick_type,
        },
        geometry: geometry,
      };

      setSpills((prev) => ({
        type: "FeatureCollection",
        features: [newFeature, ...prev.features.filter((f) => f.properties.id !== res.spill.id)],
      }));

      setSelectedSpillId(res.spill.id);

      // Center and mark map using response.spill.center
      setFocusTarget({
        coordinates: [centerLon, centerLat],
        title: `SAR Detection: ${res.spill.id}`,
        category: 'oil_spill',
        description: `Acquired ${res.spill.source_scene || 'Sentinel-1'} | Area: ${res.spill.area_sq_km.toFixed(2)} km² | Centroid: ${centerLat.toFixed(4)}°N, ${centerLon.toFixed(4)}°E`,
        zoom: 12.0,
        timestamp: Date.now(),
      });

      // 4. Update primary suspect and ranked suspects from /detect
      if (res.ranked_suspects && res.ranked_suspects.length > 0) {
        setSuspects(res.ranked_suspects);
      }
      if (res.primary_suspect) {
        setSelectedVesselMmsi(res.primary_suspect.mmsi);
      } else if (res.ranked_suspects?.length) {
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
        unreadAlertCount={unreadAlertCount}
        onOpenAlerts={() => setIsAlertCenterOpen(true)}
      />

      {/* 2. Main Tactical Viewport */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left: Dark Bathymetry Map Canvas */}
        <div className="flex-1 h-full relative flex flex-col">
          {/* Floating Critical Alert HUD Banner */}
          <FloatingAlertBanner
            alert={activeBannerAlert}
            onDismiss={() => setActiveBannerAlert(null)}
            onAction={handleAlertAction}
            onOpenDrawer={() => setIsAlertCenterOpen(true)}
          />

          <TacticalMap
            spills={spills}
            vessels={vessels}
            suspects={suspects}
            selectedSpillId={selectedSpillId}
            selectedVesselMmsi={selectedVesselMmsi}
            onSelectSpill={handleSelectSpillId}
            onSelectVessel={handleSelectVessel}
            scrubbedVessels={scrubbedVessels}
            centerCoordinates={mapCenter}
            timeOffsetMinutes={timeOffsetMinutes}
            metocean={metocean}
            focusTarget={focusTarget}
            onOpenMobileDrawer={() => {
              setMobileActiveTab('threats');
              setIsMobileDrawerOpen(true);
            }}
          />

          {/* Time-Scrubber Timeline (-360m to 0) */}
          <div className="absolute bottom-20 sm:bottom-4 left-3 right-3 z-20 pointer-events-none flex justify-center">
            <TimeScrubber
              timeOffsetMinutes={timeOffsetMinutes}
              onChangeTimeOffset={setTimeOffsetMinutes}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              playbackSpeed={playbackSpeed}
              onChangeSpeed={(spd: number) => setPlaybackSpeed(spd)}
              activeSpillId={selectedSpillId}
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
            onSelectVessel={handleSelectVessel}
            metocean={metocean}
            timeOffsetMinutes={timeOffsetMinutes}
            onFocusLocation={handleFocusLocation}
          />
        </div>
      </div>

      {/* 3. Mobile Bottom Tab Bar */}
      <div className="lg:hidden h-16 bg-[#111622] border-t border-slate-800 flex items-center justify-around z-30 px-1.5 font-mono text-[10px] shadow-2xl shrink-0">
        <button
          onClick={() => {
            setMobileActiveTab('map');
            setIsMobileDrawerOpen(false);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            mobileActiveTab === 'map' && !isMobileDrawerOpen ? 'text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-500/30' : 'text-slate-400'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>MAP</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('overview');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            isMobileDrawerOpen && mobileActiveTab === 'overview' ? 'text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-500/30' : 'text-slate-400'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>OVERVIEW</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('sar_physics');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            isMobileDrawerOpen && mobileActiveTab === 'sar_physics' ? 'text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-500/30' : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>SAR AI</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('culprit');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            isMobileDrawerOpen && mobileActiveTab === 'culprit' ? 'text-rose-400 font-bold bg-rose-950/40 border border-rose-500/30' : 'text-slate-400'
          }`}
        >
          <Ship className="w-4 h-4 text-rose-400" />
          <span>CULPRIT</span>
        </button>

        <button
          onClick={() => {
            setMobileActiveTab('threats');
            setIsMobileDrawerOpen(true);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            isMobileDrawerOpen && mobileActiveTab === 'threats' ? 'text-amber-400 font-bold bg-amber-950/40 border border-amber-500/30' : 'text-slate-400'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>THREATS</span>
        </button>
      </div>

      {/* 4. Mobile Drawer Modal */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bottom-16 z-40 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="h-[88%] w-full bg-[#111622] rounded-t-2xl border-t border-slate-700 overflow-hidden flex flex-col shadow-2xl">
            <InspectorPanel
              spill={selectedSpillFeature?.properties}
              spillFeature={selectedSpillFeature}
              suspects={suspects}
              vectorMatches={vectorMatches}
              selectedVesselMmsi={selectedVesselMmsi ?? undefined}
              onSelectVessel={(mmsi) => {
                handleSelectVessel(mmsi);
                setIsMobileDrawerOpen(false);
              }}
              onClose={() => setIsMobileDrawerOpen(false)}
              isMobileModal={true}
              metocean={metocean}
              timeOffsetMinutes={timeOffsetMinutes}
              initialTab={mobileActiveTab === 'map' ? 'overview' : mobileActiveTab}
              onFocusLocation={handleFocusLocation}
            />
          </div>
        </div>
      )}

      {/* 5. Modals & Drawers */}
      <AlertNotificationCenter
        isOpen={isAlertCenterOpen}
        onClose={() => setIsAlertCenterOpen(false)}
        alerts={alerts}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        onAcknowledgeAll={handleClearAllAlerts}
        onAlertAction={handleAlertAction}
      />

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
