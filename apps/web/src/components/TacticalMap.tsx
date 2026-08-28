import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Plus, Minus, Crosshair, Eye, Navigation } from 'lucide-react';
import { SpillFeatureCollection, Vessel, SuspectVessel } from '../types';

interface TacticalMapProps {
  spills: SpillFeatureCollection;
  vessels: Vessel[];
  suspects: SuspectVessel[];
  selectedSpillId: string;
  onSelectSpill: (id: string) => void;
  onSelectVessel: (mmsi: number) => void;
  scrubbedVessels?: { mmsi: number; lon: number; lat: number; heading: number }[];
  centerCoordinates?: [number, number];
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  spills,
  vessels,
  suspects,
  selectedSpillId,
  onSelectSpill,
  onSelectVessel,
  scrubbedVessels,
  centerCoordinates = [72.150, 19.050],
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showTrails, setShowTrails] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-dark': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri, DeLorme, NAVTEQ',
          },
          'esri-labels': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'esri-dark-layer',
            type: 'raster',
            source: 'esri-dark',
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'esri-labels-layer',
            type: 'raster',
            source: 'esri-labels',
            minzoom: 0,
            maxzoom: 19,
            paint: {
              'raster-opacity': 0.7,
            },
          },
        ],
      },
      center: centerCoordinates,
      zoom: 9.5,
      pitch: 30,
      attributionControl: false,
    });

    map.on('load', () => {
      setMapLoaded(true);
      mapRef.current = map;

      // Add Spills GeoJSON Source
      map.addSource('spills-source', {
        type: 'geojson',
        data: spills,
      });

      // Spills Fill
      map.addLayer({
        id: 'spills-fill',
        type: 'fill',
        source: 'spills-source',
        paint: {
          'fill-color': '#ff3b30',
          'fill-opacity': 0.4,
        },
      });

      // Spills Outline
      map.addLayer({
        id: 'spills-line',
        type: 'line',
        source: 'spills-source',
        paint: {
          'line-color': '#ffb4ab',
          'line-width': 2.5,
        },
      });

      // Trajectory Source
      map.addSource('culprit-trajectory', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Trajectory Dashed Line
      map.addLayer({
        id: 'trajectory-dashed',
        type: 'line',
        source: 'culprit-trajectory',
        paint: {
          'line-color': '#ff3b30',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
        },
      });

      // Slick Click
      map.on('click', 'spills-fill', (e) => {
        if (e.features && e.features[0]?.properties?.id) {
          onSelectSpill(e.features[0].properties.id);
        }
      });

      map.on('mouseenter', 'spills-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'spills-fill', () => { map.getCanvas().style.cursor = ''; });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center when scenario changes
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      mapRef.current.flyTo({ center: centerCoordinates, zoom: 9.5, duration: 1500 });
    }
  }, [centerCoordinates, mapLoaded]);

  // Update Spills Layer
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('spills-source') as maplibregl.GeoJSONSource;
    if (src) src.setData(spills);
  }, [spills, mapLoaded]);

  // Update Trajectory
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource('culprit-trajectory') as maplibregl.GeoJSONSource;
    if (!src) return;

    if (!showTrails) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const primary = suspects.find((s) => s.probability_score > 70) || suspects[0];
    if (primary?.trajectory) {
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: primary.trajectory.map((p) => [p[0], p[1]]),
            },
          },
        ],
      });
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [suspects, showTrails, mapLoaded]);

  // Update Vessel HTML Markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const positions = vessels.map((v) => {
      const scrubbed = scrubbedVessels?.find((s) => s.mmsi === v.mmsi);
      const isCulprit = suspects.some((s) => s.mmsi === v.mmsi && s.probability_score > 70);
      return {
        mmsi: v.mmsi,
        name: v.name,
        lon: scrubbed ? scrubbed.lon : v.current_position?.longitude || 72.15,
        lat: scrubbed ? scrubbed.lat : v.current_position?.latitude || 19.05,
        heading: scrubbed ? scrubbed.heading : v.current_position?.heading_degrees || 135,
        isCulprit,
      };
    });

    // Cleanup removed
    const activeKeys = new Set(positions.map((p) => p.mmsi.toString()));
    Object.keys(markersRef.current).forEach((k) => {
      if (!activeKeys.has(k)) {
        markersRef.current[k].remove();
        delete markersRef.current[k];
      }
    });

    // Update or create
    positions.forEach((p) => {
      const key = p.mmsi.toString();
      const existing = markersRef.current[key];

      if (existing) {
        existing.setLngLat([p.lon, p.lat]);
        const arrow = existing.getElement().querySelector('.vessel-arrow') as HTMLElement;
        if (arrow) arrow.style.transform = `rotate(${p.heading}deg)`;
      } else {
        const el = document.createElement('div');
        el.className = 'cursor-pointer flex flex-col items-center group';
        el.innerHTML = `
          <div class="w-7 h-7 rounded-full ${
            p.isCulprit
              ? 'bg-[#93000a] border-2 border-[#ffb4ab] text-white shadow-[0_0_12px_#ffb4ab]'
              : 'bg-[#1c1f2a] border border-[#00e5ff] text-[#00e5ff]'
          } flex items-center justify-center">
            <div class="vessel-arrow" style="transform: rotate(${p.heading}deg)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4 20L12 16L20 20L12 2Z"/>
              </svg>
            </div>
          </div>
          <div class="mt-1 px-1.5 py-0.5 rounded bg-[#0a0e18]/90 border border-[#3b494c]/40 text-[9px] font-mono whitespace-nowrap ${
            p.isCulprit ? 'text-[#ffb4ab] font-bold' : 'text-[#00daf3]'
          }">
            ${p.name}
          </div>
        `;

        el.addEventListener('click', () => onSelectVessel(p.mmsi));

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([p.lon, p.lat])
          .addTo(mapRef.current!);

        markersRef.current[key] = marker;
      }
    });
  }, [vessels, scrubbedVessels, suspects, mapLoaded]);

  return (
    <div className="relative w-full h-full bg-[#0f131d] overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating HUD Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5">
        <div className="tactical-glass p-1 rounded-lg flex flex-col gap-1 shadow-lg">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="w-8 h-8 rounded bg-[#1c1f2a] hover:bg-[#00e5ff] hover:text-black text-white flex items-center justify-center transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="w-8 h-8 rounded bg-[#1c1f2a] hover:bg-[#00e5ff] hover:text-black text-white flex items-center justify-center transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.flyTo({ center: centerCoordinates, zoom: 9.5 })}
            className="w-8 h-8 rounded bg-[#1c1f2a] hover:bg-[#00e5ff] hover:text-black text-white flex items-center justify-center transition-colors"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setShowTrails(!showTrails)}
          className={`w-10 h-10 rounded-lg tactical-glass flex items-center justify-center transition-all ${
            showTrails ? 'text-[#ffb4ab] border-[#ff3b30]' : 'text-[#849396]'
          }`}
          title="Toggle Suspect Trajectory"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-20 left-4 z-20 flex gap-2 pointer-events-none">
        <div className="bg-[#1c1f2a]/90 px-2.5 py-1 rounded border border-[#3b494c]/30 font-mono text-[10px] text-white flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-[#ff3b30]"></span>
          <span>Oil Slick (SAR)</span>
        </div>
        <div className="bg-[#1c1f2a]/90 px-2.5 py-1 rounded border border-[#3b494c]/30 font-mono text-[10px] text-white flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00daf3]"></span>
          <span>AIS Vessel</span>
        </div>
        <div className="bg-[#1c1f2a]/90 px-2.5 py-1 rounded border border-[#3b494c]/30 font-mono text-[10px] text-white flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-[#ff3b30]"></span>
          <span>Trajectory</span>
        </div>
      </div>
    </div>
  );
};
