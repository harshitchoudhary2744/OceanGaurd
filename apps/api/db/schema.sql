-- OceanGuard PostGIS Database Schema (SIH26143)

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Vessels Static Information
CREATE TABLE IF NOT EXISTS vessels (
    mmsi BIGINT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    flag VARCHAR(50) NOT NULL,
    vessel_type VARCHAR(50) NOT NULL,
    length_meters FLOAT DEFAULT 0.0,
    call_sign VARCHAR(20),
    destination VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Time-series AIS Telemetry
CREATE TABLE IF NOT EXISTS ais_telemetry (
    id SERIAL PRIMARY KEY,
    mmsi BIGINT NOT NULL REFERENCES vessels(mmsi) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    speed_knots FLOAT NOT NULL,
    heading_degrees FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Detected Oil Spills from SAR Satellite Analysis
CREATE TABLE IF NOT EXISTS oil_spills (
    id VARCHAR(50) PRIMARY KEY,
    detection_timestamp TIMESTAMPTZ NOT NULL,
    polygon_geom GEOMETRY(Polygon, 4326) NOT NULL,
    area_sq_km FLOAT NOT NULL,
    confidence_score FLOAT NOT NULL,
    source_scene VARCHAR(100),
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Spatial Vessel-Spill Correlation Attributions
CREATE TABLE IF NOT EXISTS correlations (
    id SERIAL PRIMARY KEY,
    spill_id VARCHAR(50) NOT NULL REFERENCES oil_spills(id) ON DELETE CASCADE,
    vessel_mmsi BIGINT NOT NULL REFERENCES vessels(mmsi) ON DELETE CASCADE,
    probability_score FLOAT NOT NULL,
    distance_meters FLOAT NOT NULL,
    trajectory_delta_time_min FLOAT DEFAULT 0.0,
    drift_alignment_pct FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Spatial and Temporal Indexes
CREATE INDEX IF NOT EXISTS idx_ais_telemetry_location ON ais_telemetry USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_ais_telemetry_mmsi_time ON ais_telemetry (mmsi, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_oil_spills_geom ON oil_spills USING GIST(polygon_geom);
CREATE INDEX IF NOT EXISTS idx_oil_spills_time ON oil_spills (detection_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_correlations_spill ON correlations (spill_id);
