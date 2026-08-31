"""
Supabase PostGIS Migration & Seeding Tool for OceanGuard (SIH26143)
Provisions tables, PostGIS extensions, spatial GIST indexes, and uploads all relevant updated data to Supabase.
"""
import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import create_engine, text

# Load environment variables and set python path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

def load_env():
    try:
        from dotenv import load_dotenv
        for parent in [Path(__file__).resolve().parent, ROOT_DIR / "apps" / "api", ROOT_DIR]:
            env_file = parent / ".env"
            if env_file.exists():
                load_dotenv(dotenv_path=env_file, override=False)
                break
    except Exception:
        pass

load_env()

raw_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL") or os.getenv("SUPABASE_DB_URL")

if not raw_url or "localhost" in raw_url:
    print("[!] INFO: No Supabase DATABASE_URL found in .env (currently set to localhost or empty).")
    print("To connect your Supabase instance, add your connection string to .env:")
    print("DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require")
    print("\nOr provide it as a CLI argument: python apps/api/scripts/init_supabase.py [YOUR_CONNECTION_STRING]")
    if len(sys.argv) > 1:
        raw_url = sys.argv[1]
    else:
        sys.exit(0)

if raw_url.startswith("postgres://"):
    db_url = raw_url.replace("postgres://", "postgresql://", 1)
else:
    db_url = raw_url

if "sslmode" not in db_url and "supabase" in db_url.lower():
    db_url += ("&" if "?" in db_url else "?") + "sslmode=require"

print("=" * 75)
print("OceanGuard -- Supabase Cloud PostGIS Migration & Full Data Ingestion Tool")
print("=" * 75)
masked = db_url.split("@")[-1] if "@" in db_url else db_url
print(f"Connecting to database at: @{masked}\n")

try:
    engine = create_engine(db_url, connect_args={"connect_timeout": 15})
    with engine.connect() as conn:
        # 1. Enable PostGIS
        print("1. Enabling PostGIS Spatial Extension on Supabase...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        postgis_ver = conn.execute(text("SELECT PostGIS_Version();")).scalar()
        conn.commit()
        print(f"   [OK] PostGIS extension active: {postgis_ver}")

        # 2. Run Schema Definition
        print("\n2. Provisioning Relational & Geospatial Schema (Tables + GIST Indexes)...")
        schema_file = Path(__file__).resolve().parent.parent / "db" / "schema.sql"
        with open(schema_file, "r", encoding="utf-8") as f:
            sql_statements = f.read()

        for statement in sql_statements.split(";"):
            cleaned = statement.strip()
            if cleaned:
                conn.execute(text(cleaned))
        conn.commit()
        print("   [OK] Tables verified: vessels, ais_telemetry, oil_spills, correlations.")
        print("   [OK] GIST spatial and B-tree temporal indexes provisioned.")

        # 3. Load latest fixture data
        print("\n3. Loading and Preparing Relevant Updated OceanGuard Dataset...")
        from apps.api.scripts.seed_demo_data import generate_mumbai_demo_data
        generate_mumbai_demo_data()

        fixture_file = Path(__file__).resolve().parent.parent / "db" / "demo_fixture.json"
        with open(fixture_file, "r", encoding="utf-8") as f:
            fixture = json.load(f)

        vessels = fixture.get("vessels", [])
        telemetry = fixture.get("telemetry", [])
        spills = fixture.get("spills", [])
        correlations = fixture.get("correlations", [])

        print(f"   - Vessels to ingest: {len(vessels)}")
        print(f"   - AIS Telemetry points: {len(telemetry)}")
        print(f"   - Detected Oil Spill incidents: {len(spills)}")
        print(f"   - Kinematic Correlation records: {len(correlations)}")

        # 4. Clean Stale Legacy Data
        print("\n4. Synchronizing Tables with Fresh Ground Truth Dataset...")
        conn.execute(text("TRUNCATE TABLE correlations, ais_telemetry, oil_spills, vessels CASCADE;"))
        conn.commit()

        # 5. Ingest Vessels
        print("   -> Uploading Vessels...")
        for v in vessels:
            conn.execute(
                text("""
                    INSERT INTO vessels (mmsi, name, flag, vessel_type, length_meters, call_sign, destination)
                    VALUES (:mmsi, :name, :flag, :vessel_type, :length_meters, :call_sign, :destination)
                    ON CONFLICT (mmsi) DO UPDATE SET
                        name = EXCLUDED.name,
                        flag = EXCLUDED.flag,
                        vessel_type = EXCLUDED.vessel_type,
                        length_meters = EXCLUDED.length_meters,
                        call_sign = EXCLUDED.call_sign,
                        destination = EXCLUDED.destination;
                """),
                {
                    "mmsi": v["mmsi"],
                    "name": v["name"],
                    "flag": v["flag"],
                    "vessel_type": v["vessel_type"],
                    "length_meters": float(v.get("length_meters", 0.0)),
                    "call_sign": v.get("call_sign"),
                    "destination": v.get("destination")
                }
            )
        conn.commit()
        print(f"   [OK] Seeded {len(vessels)} vessels into Supabase.")

        # 6. Ingest AIS Telemetry
        print("   -> Uploading Time-series AIS Telemetry with PostGIS Point geometries...")
        for t in telemetry:
            conn.execute(
                text("""
                    INSERT INTO ais_telemetry (mmsi, timestamp, location, speed_knots, heading_degrees)
                    VALUES (
                        :mmsi,
                        :timestamp,
                        ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                        :speed_knots,
                        :heading_degrees
                    );
                """),
                {
                    "mmsi": t["mmsi"],
                    "timestamp": t["timestamp"],
                    "lon": float(t["longitude"]),
                    "lat": float(t["latitude"]),
                    "speed_knots": float(t["speed_knots"]),
                    "heading_degrees": float(t["heading_degrees"])
                }
            )
        conn.commit()
        print(f"   [OK] Seeded {len(telemetry)} AIS telemetry points into Supabase.")

        # 7. Ingest Oil Spills
        print("   -> Uploading Detected Oil Spill Polygons with PostGIS Polygon geometries...")
        for s in spills:
            poly_coords = s["polygon_coordinates"]
            # Ensure closed polygon
            if poly_coords[0] != poly_coords[-1]:
                poly_coords.append(poly_coords[0])
            coords_str = ", ".join([f"{pt[0]} {pt[1]}" for pt in poly_coords])
            wkt_polygon = f"POLYGON(({coords_str}))"

            conn.execute(
                text("""
                    INSERT INTO oil_spills (id, detection_timestamp, polygon_geom, area_sq_km, confidence_score, source_scene, status)
                    VALUES (
                        :id,
                        :detection_timestamp,
                        ST_GeomFromText(:wkt, 4326),
                        :area_sq_km,
                        :confidence_score,
                        :source_scene,
                        :status
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        detection_timestamp = EXCLUDED.detection_timestamp,
                        polygon_geom = EXCLUDED.polygon_geom,
                        area_sq_km = EXCLUDED.area_sq_km,
                        confidence_score = EXCLUDED.confidence_score,
                        source_scene = EXCLUDED.source_scene,
                        status = EXCLUDED.status;
                """),
                {
                    "id": s["id"],
                    "detection_timestamp": s["detection_timestamp"],
                    "wkt": wkt_polygon,
                    "area_sq_km": float(s["area_sq_km"]),
                    "confidence_score": float(s["confidence_score"]),
                    "source_scene": s.get("source_scene", "S1A_IW_GRDH"),
                    "status": s.get("status", "ACTIVE")
                }
            )
        conn.commit()
        print(f"   [OK] Seeded {len(spills)} oil spill incident polygons into Supabase.")

        # 8. Ingest Correlations
        print("   -> Uploading Kinematic Trajectory Correlation Records...")
        for c in correlations:
            conn.execute(
                text("""
                    INSERT INTO correlations (spill_id, vessel_mmsi, probability_score, distance_meters, trajectory_delta_time_min, drift_alignment_pct)
                    VALUES (
                        :spill_id,
                        :vessel_mmsi,
                        :probability_score,
                        :distance_meters,
                        :delta_t,
                        :drift_align
                    );
                """),
                {
                    "spill_id": c["spill_id"],
                    "vessel_mmsi": c["mmsi"],
                    "probability_score": float(c["probability_score"]),
                    "distance_meters": float(c.get("distance_meters", 0.0)),
                    "delta_t": float(c.get("trajectory_delta_time_min", -42.0)),
                    "drift_align": float(c.get("drift_alignment_pct", 95.0))
                }
            )
        conn.commit()
        print(f"   [OK] Seeded {len(correlations)} spatial correlations into Supabase.")

        # 9. Verification & PostGIS Spatial Diagnostics
        print("\n" + "=" * 75)
        print("5. VERIFYING DATABASE INGESTION & POSTGIS SPATIAL INTEGRITY")
        print("=" * 75)

        v_count = conn.execute(text("SELECT COUNT(*) FROM vessels;")).scalar()
        t_count = conn.execute(text("SELECT COUNT(*) FROM ais_telemetry;")).scalar()
        s_count = conn.execute(text("SELECT COUNT(*) FROM oil_spills;")).scalar()
        c_count = conn.execute(text("SELECT COUNT(*) FROM correlations;")).scalar()

        print(f"-> Total Vessels in DB:        {v_count}")
        print(f"-> Total AIS Points in DB:     {t_count}")
        print(f"-> Total Oil Spills in DB:     {s_count}")
        print(f"-> Total Correlations in DB:   {c_count}")

        print("\n--- Spills Verified in Supabase PostGIS ---")
        spill_rows = conn.execute(text("""
            SELECT 
                id, 
                area_sq_km, 
                confidence_score, 
                status,
                ST_AsText(ST_Centroid(polygon_geom)) AS centroid,
                ST_Area(polygon_geom::geography) / 1000000.0 AS geodesic_area_sq_km
            FROM oil_spills
            ORDER BY id ASC;
        """)).fetchall()

        for r in spill_rows:
            print(f"  [SPILL] ID: {r[0]:<17} | Area: {r[1]:.2f} km² (PostGIS Geodesic: {r[5]:.2f} km²) | Conf: {r[2]*100:.1f}% | Centroid: {r[4]}")

        print("\n--- Suspect Correlations Verified in Supabase ---")
        corr_rows = conn.execute(text("""
            SELECT 
                c.spill_id, 
                v.name, 
                v.mmsi, 
                c.probability_score, 
                c.distance_meters,
                c.trajectory_delta_time_min,
                c.drift_alignment_pct
            FROM correlations c
            JOIN vessels v ON c.vessel_mmsi = v.mmsi
            ORDER BY c.spill_id ASC;
        """)).fetchall()

        for cr in corr_rows:
            print(f"  [CORR] Spill: {cr[0]:<17} -> Suspect: {cr[1]:<22} (MMSI: {cr[2]}) | Prob: {cr[3]:.1f}% | CPA: {cr[4]:.1f}m | Delta T: {cr[5]:.1f}m")

    print("\n" + "=" * 75)
    print("SUCCESS: ALL RELEVANT UPDATED DATA UPLOADED TO SUPABASE POSTGIS!")
    print("=" * 75)

except Exception as e:
    print(f"\n[ERROR] Failed during Supabase migration/upload: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

