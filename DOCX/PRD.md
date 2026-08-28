# Product Requirement Document (PRD)

## Project Overview
* **Project Name:** OceanGuard (SIH Problem Statement: SIH26143)
* **Target Audience:** Coast Guard Authorities, Maritime Security Agencies, Environmental Protection Officers.
* **Core Objective:** Provide an automated satellite-based oil spill detection and vessel correlation platform using Synthetic Aperture Radar (SAR) imagery, computer vision, spatial vector search, and real-time AIS vessel trajectory analysis.

---

## Target User Personas
* **Maritime Auditor / Coast Guard Officer:** Needs real-time alert dashboards, high-resolution GIS maps, vessel identification numbers (MMSI), and timestamped culprit attribution scores to take legal action.
* **Environmental Data Analyst:** Needs historical spill trend analytics, vector search over past slicks, and exportable PDF audit reports.

---

## Core Features & Requirements

### 1. Interactive Ocean GIS Dashboard
* Render global maritime maps using Mapbox GL JS with custom dark-mode thematic layers.
* Display live/simulated AIS vessel coordinates with heading indicators and speed vectors.
* Dual-layer overlay rendering: Toggle raw Sentinel-1 SAR geotiff imagery and predicted U-Net oil slick segmentation masks.
* Time-slider control to scrub back in time and replay vessel paths relative to slick formation timestamps.

### 2. Automated SAR Image Processing & Segmentation Pipeline
* Ingest Sentinel-1 SAR (GRD) imagery.
* Execute despeckling, backscatter noise reduction, and land-masking preprocessing.
* Deploy a lightweight PyTorch U-Net computer vision model to predict dark-spot oil slick boundaries and output GeoJSON polygons.

### 3. Spatial Vessel Correlation Engine
* Calculate back-projected vessel trajectories along AIS coordinate history using PostGIS.
* Determine spatial proximity (`ST_DWithin`), heading velocity alignment, and drift vectors to score potential culprit vessels ($0–100\% \text{ confidence}$).
* Identify target vessel details: Vessel Name, Call Sign, MMSI, Flag State, and Destination.

### 4. Historical Spill Similarity Search (Vector DB)
* Convert slick morphology features (area, perimeter, orientation, eccentricity, backscatter signature) into vector embeddings.
* Query Qdrant vector database to identify historical spill patterns, recurring dump zones, and repeat offender vessel profiles.

### 5. Automated PDF Audit & Evidence Generator
* Auto-generate exportable, court-admissible PDF forensic reports containing satellite crop overlays, AIS telemetry logs, spatial calculations, and attributed vessel metadata.

---

## Technical Stack & Architecture
* **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Mapbox GL JS, Lucide Icons, Recharts.
* **Backend API:** Python 3.11+, FastAPI, Uvicorn, WebSockets (for live alert feeds).
* **AI & Machine Learning:** PyTorch (U-Net model), OpenCV, GDAL/Rasterio (spatial raster processing).
* **Database & GIS:** PostgreSQL 16 with PostGIS extension (geospatial relational data), Qdrant (spatial vector search engine).
* **State & Data Fetching:** React Query (TanStack Query), Zustand (global map state).

---

## Non-Functional Requirements
* **Latency:** Map tile and vector rendering must load under 1.5 seconds. Inference pipeline must process incoming SAR scenes under 10 seconds.
* **Reliability:** System must handle missing AIS telemetry points by interpolating vessel trajectories between last known coordinates.
* **UI/UX:** Dark-themed, high-contrast command center UI optimized for dashboard displays.