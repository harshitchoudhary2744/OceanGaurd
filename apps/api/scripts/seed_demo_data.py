import json
import os
from datetime import datetime, timezone

def generate_demo_data():
    base_time = datetime(2019, 1, 1, 3, 42, 35, tzinfo=timezone.utc)
    
    # 1. Vessels operating in Eastern Mediterranean / Cyprus Levantine Basin
    vessels = [
        {
            "mmsi": 212000001,
            "imo_number": 9481234,
            "name": "MEDITERRANEAN TRADER",
            "flag": "Malta",
            "vessel_type": "Very Large Crude Carrier (VLCC)",
            "length_meters": 315.0,
            "draught_meters": 15.8,
            "call_sign": "9HA4211",
            "destination": "CYPRUS OFFSHORE TRANSIT",
            "current_position": {
                "latitude": 33.285,
                "longitude": 33.130,
                "speed_knots": 13.5,
                "heading_degrees": 95.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 209123000,
            "imo_number": 9512345,
            "name": "LEVANT STAR",
            "flag": "Cyprus",
            "vessel_type": "Container Ship",
            "length_meters": 295.0,
            "draught_meters": 13.5,
            "call_sign": "5BKA2",
            "destination": "LIMASSOL COMMERCIAL PORT",
            "current_position": {
                "latitude": 33.320,
                "longitude": 33.080,
                "speed_knots": 14.2,
                "heading_degrees": 35.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 239456000,
            "imo_number": 9623456,
            "name": "AEGEAN VOYAGER",
            "flag": "Greece",
            "vessel_type": "Bulk Carrier",
            "length_meters": 225.0,
            "draught_meters": 11.8,
            "call_sign": "SVXY",
            "destination": "PORT SAID ANCHORAGE",
            "current_position": {
                "latitude": 33.240,
                "longitude": 33.220,
                "speed_knots": 12.5,
                "heading_degrees": 110.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 212789000,
            "imo_number": 9734567,
            "name": "AKROTIRI BREEZE",
            "flag": "Cyprus",
            "vessel_type": "Product Tanker",
            "length_meters": 185.0,
            "draught_meters": 9.5,
            "call_sign": "5BAK7",
            "destination": "VASILIKO OIL TERMINAL",
            "current_position": {
                "latitude": 33.290,
                "longitude": 32.980,
                "speed_knots": 11.0,
                "heading_degrees": 285.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 212999000,
            "imo_number": 9899001,
            "name": "CYPRUS POLICE PATROL / EMSA",
            "flag": "Cyprus",
            "vessel_type": "Pollution Control Vessel",
            "length_meters": 65.0,
            "draught_meters": 4.2,
            "call_sign": "5BCP1",
            "destination": "DARTIS INCIDENT PATROL",
            "current_position": {
                "latitude": 33.270,
                "longitude": 33.090,
                "speed_knots": 18.0,
                "heading_degrees": 220.0,
                "timestamp": base_time.isoformat()
            }
        }
    ]

    # 2. Kinematic Telemetry
    telemetry = [
        {
            "mmsi": 212000001,
            "timestamp": "2018-12-31T21:42:35+00:00",
            "latitude": 33.240,
            "longitude": 32.850,
            "speed_knots": 13.8,
            "heading_degrees": 95.0,
            "nav_status": "Under way using engine"
        },
        {
            "mmsi": 212000001,
            "timestamp": "2019-01-01T00:42:35+00:00",
            "latitude": 33.255,
            "longitude": 32.950,
            "speed_knots": 13.8,
            "heading_degrees": 95.0,
            "nav_status": "Under way using engine"
        },
        {
            "mmsi": 212000001,
            "timestamp": "2019-01-01T03:00:35+00:00",
            "latitude": 33.259026,
            "longitude": 33.057756,
            "speed_knots": 5.4,
            "heading_degrees": 95.0,
            "nav_status": "Under way using engine"
        },
        {
            "mmsi": 212000001,
            "timestamp": "2019-01-01T03:42:35+00:00",
            "latitude": 33.285,
            "longitude": 33.130,
            "speed_knots": 13.5,
            "heading_degrees": 95.0,
            "nav_status": "Under way using engine"
        },
        {
            "mmsi": 209123000,
            "timestamp": "2018-12-31T21:42:35+00:00",
            "latitude": 33.050,
            "longitude": 32.920,
            "speed_knots": 14.5,
            "heading_degrees": 35.0,
            "nav_status": "Under way using engine"
        },
        {
            "mmsi": 209123000,
            "timestamp": "2019-01-01T00:42:35+00:00",
            "latitude": 33.180,
            "longitude": 33.000,
            "speed_knots": 14.5,
            "heading_degrees": 35.0,
            "nav_status": "Under way using engine"
        },
        {
            "mmsi": 209123000,
            "timestamp": "2019-01-01T03:42:35+00:00",
            "latitude": 33.320,
            "longitude": 33.080,
            "speed_knots": 14.2,
            "heading_degrees": 35.0,
            "nav_status": "Under way using engine"
        }
    ]

    # 3. DARTIS ow-0001 Benchmark Oil Spill
    spills = [
        {
            "id": "DARTIS-ow-0001",
            "name": "Cyprus Levantine Basin - DARTIS Benchmark Discharge (ow-0001.jpg)",
            "detection_timestamp": "2019-01-01T03:42:35+00:00",
            "area_sq_km": 8.42,
            "perimeter_km": 18.6,
            "confidence_score": 0.988,
            "segmentation_dice_score": 0.985,
            "oil_likelihood_score": 0.952,
            "lookalike_score": 0.048,
            "damping_ratio_db": 8.9,
            "source_scene": "ow-0001.jpg",
            "status": "ACTIVE",
            "center": [33.05775642, 33.25902604],
            "centroid": [33.25902604, 33.05775642],
            "estimated_discharge_liters": 92000,
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
            "cpa_distance_nm": 0.12,
            "time_discrepancy_minutes": 8.0,
            "speed_profile_drop_detected": True,
            "ais_gap_detected": True,
            "anomaly_reasons": [
                "Kinematic back-projection intercept at discharge origin (CPA 0.12 NM)",
                "Transit speed anomaly: dropped from 13.8 kts to 5.4 kts inside benchmark polygon",
                "AIS gap detected during passage through radar dark-spot origin"
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

    out_path = os.path.join(os.path.dirname(__file__), "..", "db", "demo_fixture.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fixture_data, f, indent=2)
    print(f"Generated Cyprus Levantine Basin demo fixture data at: {out_path}")

def seed_database_and_fixtures():
    generate_demo_data()

generate_mumbai_demo_data = generate_demo_data

if __name__ == "__main__":
    generate_demo_data()
