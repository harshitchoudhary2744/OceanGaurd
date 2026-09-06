import os
import sys
import json
from datetime import datetime, timezone

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from apps.api.services.synthetic_ais import generate_synthetic_ais, MONITORED_FLEET_WAYPOINTS
except ImportError:
    from services.synthetic_ais import generate_synthetic_ais, MONITORED_FLEET_WAYPOINTS


def generate_demo_data():
    """
    Generate deterministic Eastern Mediterranean / Levantine Basin demo fixture data
    for the 10 monitored vessels, fully synchronized with tactical map waypoints.
    """
    base_time = datetime(2019, 1, 1, 3, 42, 35, tzinfo=timezone.utc)
    ais_data = generate_synthetic_ais()

    # 1. Format 10 Monitored Vessels with exact t=0 positions
    vessels = []
    for v in ais_data["vessels"]:
        vessels.append({
            "mmsi": v["mmsi"],
            "imo_number": v["imo_number"],
            "name": v["name"],
            "flag": v["flag"],
            "vessel_type": v["vessel_type"],
            "length_meters": v["length_meters"],
            "draught_meters": v["draught_meters"],
            "call_sign": v["call_sign"],
            "destination": v["destination"],
            "cargo_type": v.get("cargo_type", "General Cargo"),
            "current_position": {
                "latitude": v["lat"],
                "longitude": v["lon"],
                "speed_knots": v["speed"],
                "heading_degrees": v["heading"],
                "timestamp": base_time.isoformat()
            }
        })

    # 2. Kinematic Telemetry (250 points across 6h lookback window)
    telemetry = ais_data["telemetry"]

    # 3. Benchmark Oil Spill Incident (DARTIS ow-0001)
    spills = [
        {
            "id": "DARTIS-ow-0001",
            "name": "DARTIS Eastern Mediterranean Benchmark (ow-0001.jpg)",
            "detection_timestamp": "2019-01-01T03:42:35+00:00",
            "area_sq_km": 0.37,
            "perimeter_km": 3.82,
            "confidence_score": 0.982257,
            "oil_likelihood_score": 0.982257,
            "lookalike_score": 0.017743,
            "damping_ratio_db": 8.9,
            "source_scene": "ow-0001.jpg",
            "status": "ACTIVE",
            "center": [33.05775642, 33.25902604],
            "centroid": [33.25902604, 33.05775642],
            "estimated_discharge_liters": 3975,
            "slick_type": "Heavy Fuel Oil (DARTIS Benchmark OW-0001)",
            "polygon_coordinates": [
                [33.032, 33.245],
                [33.048, 33.262],
                [33.068, 33.272],
                [33.085, 33.268],
                [33.082, 33.252],
                [33.062, 33.248],
                [33.042, 33.242],
                [33.032, 33.245]
            ]
        }
    ]

    # 4. Spatial Correlation
    correlations = [
        {
            "spill_id": "DARTIS-ow-0001",
            "vessel_mmsi": 212000001,
            "vessel_name": "MEDITERRANEAN TRADER",
            "correlation_score": 0.984,
            "cpa_distance_nm": 0.08,
            "time_discrepancy_minutes": 0.0,
            "speed_profile_drop_detected": True,
            "ais_gap_detected": True,
            "anomaly_reasons": [
                "Direct trajectory overpass at discharge locus (CPA 0.08 NM at T-42 min)",
                "Transit speed anomaly: dropped from 13.5 kts down to 5.4 kts inside benchmark origin",
                "Deliberate 42-minute AIS transponder blackout matching exact discharge window"
            ],
            "risk_level": "CRITICAL"
        }
    ]

    fixture_data = {
        "vessels": vessels,
        "telemetry": telemetry,
        "spills": spills,
        "correlations": correlations
    }

    out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "db", "demo_fixture.json"))
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fixture_data, f, indent=2)
    print(f"Generated Cyprus Levantine Basin demo fixture data at: {out_path}")

    # Seed Database if available
    try:
        from apps.api.db.session import SessionLocal, is_db_available
        from apps.api.db.models import Vessel, AISTelemetry, Correlation
        from geoalchemy2.shape import from_shape
        from shapely.geometry import Point

        if is_db_available():
            db = SessionLocal()
            try:
                db.query(Correlation).delete()
                db.query(AISTelemetry).delete()
                db.query(Vessel).delete()
                db.commit()

                for v in ais_data["vessels"]:
                    db.add(Vessel(
                        mmsi=v["mmsi"],
                        name=v["name"],
                        flag=v["flag"],
                        vessel_type=v["vessel_type"],
                        length_meters=v.get("length_meters", 200.0),
                        call_sign=v.get("call_sign", "VSSL"),
                        destination=v.get("destination", "MEDITERRANEAN"),
                    ))
                db.commit()

                for t in ais_data["telemetry"]:
                    pt = Point(t["longitude"], t["latitude"])
                    geom = from_shape(pt, srid=4326)
                    dt = datetime.fromisoformat(t["timestamp"])
                    db.add(AISTelemetry(
                        mmsi=t["mmsi"],
                        timestamp=dt,
                        location=geom,
                        speed_knots=t["speed_knots"],
                        heading_degrees=t["heading_degrees"],
                    ))
                db.commit()
                print("Seeded live database with 10 vessels and 250 telemetry records.")
            finally:
                db.close()
    except Exception as db_err:
        print(f"DB seeding skipped: {db_err}")


def seed_database_and_fixtures():
    generate_demo_data()


generate_mumbai_demo_data = generate_demo_data

if __name__ == "__main__":
    generate_demo_data()
