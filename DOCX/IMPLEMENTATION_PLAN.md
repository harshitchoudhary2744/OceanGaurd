# OceanGuard Technical Implementation Plan (SIH26143)
### Satellite Synthetic Aperture Radar (SAR) Oil Spill Detection & AIS Vessel Tracking System

---

## Phase 1: Architecture Setup & Infrastructure
* **Monorepo Structure**:
  * `apps/api`: Python 3.11/3.14 FastAPI backend, PyTorch ML, GeoAlchemy2, Qdrant Client, ReportLab.
  * `apps/web`: Pure **React.js 18 + Vite**, TypeScript, Tailwind CSS, Lucide Icons, MapLibre GL.
* **Docker Infrastructure (`docker-compose.yml`)**:
  * PostgreSQL 16 + PostGIS (`postgis/postgis:16-3.4`) on port `5432` (`oceanguard_db`).
  * Qdrant Vector Database (`qdrant/qdrant:latest`) on port `6333`.
* **Dual Execution Mode**: Automatic standalone in-memory fallback with pure-Python geometric trajectory math and cosine search if Docker is offline.

---

## Phase 2: Database Schema & Indian Maritime Seed Data

### 1. PostGIS Schema (`apps/api/db/schema.sql`)
* `vessels`: Static vessel identification (`id`, `mmsi`, `name`, `flag`, `vessel_type`, `call_sign`, `destination`).
* `ais_telemetry`: Time-series spatial records (`id`, `mmsi`, `timestamp`, `location` as `GEOMETRY(Point, 4326)`, `speed_knots`, `heading_degrees`, `nav_status`).
* `oil_spills`: Detected slick polygons (`id`, `detection_timestamp`, `polygon_geom` as `GEOMETRY(Polygon, 4326)`, `area_sq_km`, `perimeter_km`, `confidence_score`, `source_scene`, `status`).
* `correlations`: Suspect ship attributions (`spill_id`, `vessel_mmsi`, `probability_score`, `distance_meters`).
* Spatial GIST indexes on all geometry columns.

### 2. Indian Maritime Seed Data (`apps/api/scripts/seed_demo_data.py`)
* **Arabian Sea • Mumbai High Offshore Sector** (`INC-IND-2024-01` • `19.050° N, 72.150° E`):
  * Primary Culprit: **MT DESH SHANTI** (Indian Flag, VLCC Crude Tanker, MMSI `419000123`, **98.4% match probability** with direct centroid intercept).
  * Monitored Fleet: **MT JAG LOK** (India, Tanker), **MSC KANOKO** (Container), **MT SWARNA SINDHU** (India, Product Tanker), **CHEMBULK GIBRALTAR** (Singapore, Chemical Tanker).
* **Bay of Bengal • Chennai-Ennore Sector** (`INC-IND-2024-02` • `13.250° N, 80.750° E`).
* 6-hour time-series kinematic waypoints with speed and heading for smooth playback.

---

## Phase 3: AI Segmentation & Vessel Correlation Logic

### 1. SAR Segmentation Pipeline (`apps/api/ml/segmentation.py`)
* Lightweight PyTorch U-Net CNN architecture for dark-spot radar backscatter segmentation.
* Image preprocessing, Otsu/adaptive thresholding, and contour extraction.
* Generates georeferenced GeoJSON Polygons with morphological metrics (Area, Perimeter, Eccentricity, Confidence).

### 2. Kinematic Correlation Engine (`apps/api/services/correlation.py`)
* PostGIS `ST_DWithin` spatial query and pure-Python segment-to-point spherical distance calculation.
* Back-projects vessel trajectories over $T-6\text{h}$ against slick centroid.
* Computes culprit attribution score ($0-100\%$) based on minimum distance delta and temporal alignment.

### 3. Morphological Vector Search (`apps/api/services/vector_search.py`)
* Qdrant vector database integration managing 8-dimensional morphological embeddings.
* Performs Cosine similarity search against historical Indian incidents (e.g., *Mumbai High Platform Sheen*, *Gulf of Kutch Tanker Discharge*, *Chennai Port Ennore Slick*).

### 4. Forensic Evidence PDF Generator (`apps/api/services/pdf_generator.py`)
* ReportLab engine producing official **Forensic Incident Audit Dossiers**.
* Contains OMEGA-7 evidence classification, satellite metadata, AIS kinematic logs, GPS intercept coordinates, and digital legal signature certification.

---

## Phase 4: FastAPI REST & WebSocket Endpoints (`apps/api/main.py`)

* `GET /api/v1/health`: System diagnostic health check and status indicators.
* `GET /api/v1/spills`: Returns all detected slicks as a GeoJSON FeatureCollection.
* `GET /api/v1/spills/{id}`: Single incident metadata and spatial polygon.
* `GET /api/v1/spills/{id}/correlate`: Ranked list of suspect vessels with probability scores.
* `GET /api/v1/spills/{id}/similar`: Qdrant vector similarity search for top 3 historical matches.
* `GET /api/v1/vessels`: Active fleet monitoring with current GPS positions.
* `GET /api/v1/telemetry`: Time-series AIS telemetry history for timeline scrubbing.
* `POST /api/v1/spills/detect`: Accepts Sentinel-1 SAR image, runs U-Net inference, and auto-correlates suspect vessels.
* `GET /api/v1/reports/{id}/pdf`: Generates and downloads court-admissible forensic PDF dossier.
* `WS /ws/telemetry`: WebSocket streaming live vessel kinematic drift updates.

---

## Phase 5: Streamlined React.js (Vite) Command Center (`apps/web`)

### 1. Key Components
* **`Header.tsx`**: Clean top navigation with `INDIA EEZ • SIH26143` badge, live Sentinel-1 & AIS indicators, scenario switcher (*Arabian Sea* / *Bay of Bengal*), SAR upload trigger, and PDF audit export.
* **`TacticalMap.tsx`**: Fullscreen MapLibre canvas with dark bathymetry tiles, glowing crimson oil slick polygon (`#FF3B30`), directional vessel markers, and dotted trajectory line to culprit `MT DESH SHANTI`.
* **`InspectorPanel.tsx`**: Clear 3-card sidebar:
  1. *Incident Overview*: Area, discharge volume, AI confidence, and coordinates.
  2. *Vessel Attribution*: Ranked suspects with probability progress bars and proximity distance.
  3. *Qdrant Historical Matches*: Top 3 matching historical spill signatures.
* **`TimeScrubber.tsx`**: Floating bottom timeline bar (-6h to 0h) with play/pause and kinematic vessel interpolation.
* **`UploadSarModal.tsx`**: 2-click SAR scene selector to execute U-Net inference and plot the resulting slick directly onto the map.
* **`ForensicModal.tsx`**: Side-by-side comparison between raw Sentinel-1 radar backscatter and AI predicted mask.

---

## Phase 6: Operational Execution Commands

### 1. Start FastAPI Backend:
```bash
.venv\Scripts\activate
uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000
```
* **API Documentation**: `http://localhost:8000/docs`

### 2. Start React.js (Vite) Frontend:
```bash
cd apps/web
npm run dev
```
* **Command Dashboard**: `http://localhost:3000`