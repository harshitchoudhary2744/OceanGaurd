import json
import os
from datetime import datetime, timedelta, timezone

def generate_indian_demo_data():
    base_time = datetime(2024, 10, 14, 23, 42, 1, tzinfo=timezone.utc)
    
    # 1. Vessels operating along the Indian Western Seaboard (Arabian Sea / Mumbai High / Gulf of Khambhat)
    # Spill Centroid is near [72.150, 19.050] (approx 65km WNW off Mumbai Coast)
    vessels = [
        {
            "mmsi": 419000123,
            "name": "MT DESH SHANTI",
            "flag": "India",
            "vessel_type": "Very Large Crude Carrier (VLCC)",
            "length_meters": 333.0,
            "call_sign": "ATVS",
            "destination": "JNPT MUMBAI",
            "current_position": {
                "latitude": 19.160,
                "longitude": 72.280,
                "speed_knots": 14.5,
                "heading_degrees": 135.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 419000456,
            "name": "MT JAG LOK",
            "flag": "India",
            "vessel_type": "Crude Oil Tanker",
            "length_meters": 274.0,
            "call_sign": "AVKL",
            "destination": "SIKKA JAMNAGAR",
            "current_position": {
                "latitude": 19.020,
                "longitude": 72.420,
                "speed_knots": 13.2,
                "heading_degrees": 320.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 353136000,
            "name": "MSC KANOKO",
            "flag": "Liberia",
            "vessel_type": "Container Ship",
            "length_meters": 366.0,
            "call_sign": "D5EG7",
            "destination": "MUNDRA PORT",
            "current_position": {
                "latitude": 19.280,
                "longitude": 72.020,
                "speed_knots": 19.8,
                "heading_degrees": 330.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 419000789,
            "name": "MT SWARNA SINDHU",
            "flag": "India",
            "vessel_type": "Product Tanker",
            "length_meters": 228.0,
            "call_sign": "AWXZ",
            "destination": "COCHIN REFINERY",
            "current_position": {
                "latitude": 18.750,
                "longitude": 72.100,
                "speed_knots": 12.0,
                "heading_degrees": 170.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 563032000,
            "name": "CHEMBULK GIBRALTAR",
            "flag": "Singapore",
            "vessel_type": "Chemical Tanker",
            "length_meters": 175.0,
            "call_sign": "9V2941",
            "destination": "HAZIRA PORT",
            "current_position": {
                "latitude": 19.120,
                "longitude": 71.950,
                "speed_knots": 11.5,
                "heading_degrees": 015.0,
                "timestamp": base_time.isoformat()
            }
        }
    ]

    # 2. AIS Telemetry across -6 hours for each vessel
    telemetry = []
    for v in vessels:
        mmsi = v["mmsi"]
        end_lat = v["current_position"]["latitude"]
        end_lon = v["current_position"]["longitude"]
        speed = v["current_position"]["speed_knots"]
        heading = v["current_position"]["heading_degrees"]
        
        # Primary Suspect: MT DESH SHANTI (trajectory intersects spill centroid [72.150, 19.050] at ~22:45 UTC)
        if v["name"] == "MT DESH SHANTI":
            waypoints = [
                (71.850, 18.750),  # T-6h (17:42)
                (71.910, 18.810),  # T-5h (18:42)
                (71.970, 18.870),  # T-4h (19:42)
                (72.030, 18.930),  # T-3h (20:42)
                (72.090, 18.990),  # T-2h (21:42)
                (72.150, 19.050),  # T-1h (22:45) - Centroid Intercept!
                (72.210, 19.100),  # T-30m (23:12)
                (72.280, 19.160)   # T-0 (23:42)
            ]
        elif v["name"] == "MT JAG LOK":
            waypoints = [
                (72.600, 18.700),
                (72.540, 18.810),
                (72.480, 18.910),
                (72.420, 19.020)
            ]
        elif v["name"] == "MSC KANOKO":
            waypoints = [
                (72.200, 18.600),
                (72.140, 18.820),
                (72.080, 19.050),
                (72.020, 19.280)
            ]
        else:
            waypoints = [
                (end_lon - 0.25, end_lat - 0.25),
                (end_lon - 0.12, end_lat - 0.12),
                (end_lon, end_lat)
            ]

        # Distribute waypoints over 6 hours
        num_pts = len(waypoints)
        for i, (lon, lat) in enumerate(waypoints):
            pt_time = base_time - timedelta(hours=6 * (1 - i / (num_pts - 1)))
            telemetry.append({
                "mmsi": mmsi,
                "timestamp": pt_time.isoformat(),
                "latitude": round(lat, 4),
                "longitude": round(lon, 4),
                "speed_knots": speed,
                "heading_degrees": heading,
                "nav_status": "Under way using engine"
            })

    # 3. Oil Spill Polygon in Arabian Sea / Mumbai High Sector
    spills = [
        {
            "id": "INC-IND-2024-01",
            "detection_timestamp": base_time.isoformat(),
            "area_sq_km": 5.40,
            "perimeter_km": 14.8,
            "confidence_score": 0.988,
            "source_scene": "S1A_IW_GRDH_1SDV_ARABIAN_SEA_01",
            "status": "ACTIVE",
            "center": [72.150, 19.050],
            "estimated_discharge_liters": 58000,
            "slick_type": "Heavy Fuel Oil (HFO-380 / Bilge Sludge)",
            "polygon_coordinates": [
                [72.125, 19.035],
                [72.138, 19.058],
                [72.155, 19.068],
                [72.172, 19.060],
                [72.180, 19.048],
                [72.170, 19.035],
                [72.150, 19.030],
                [72.134, 19.032],
                [72.125, 19.035]
            ]
        },
        {
            "id": "INC-IND-2024-02",
            "detection_timestamp": (base_time - timedelta(hours=3)).isoformat(),
            "area_sq_km": 2.80,
            "perimeter_km": 8.4,
            "confidence_score": 0.962,
            "source_scene": "S1B_IW_GRDH_1SDV_BAY_OF_BENGAL_02",
            "status": "ACTIVE",
            "center": [80.750, 13.250],
            "estimated_discharge_liters": 22000,
            "slick_type": "Marine Diesel / Bunker Fuel",
            "polygon_coordinates": [
                [80.730, 13.235],
                [80.745, 13.260],
                [80.765, 13.268],
                [80.778, 13.252],
                [80.760, 13.238],
                [80.730, 13.235]
            ]
        }
    ]

    fixture_data = {
        "vessels": vessels,
        "telemetry": telemetry,
        "spills": spills,
        "correlations": [
            {
                "spill_id": "INC-IND-2024-01",
                "mmsi": 419000123,
                "vessel_name": "MT DESH SHANTI",
                "probability_score": 98.4,
                "distance_meters": 110.0
            }
        ]
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "db", "demo_fixture.json")
    with open(out_path, "w") as f:
        json.dump(fixture_data, f, indent=2)
    print(f"Generated India demo fixture data at: {out_path}")

if __name__ == "__main__":
    generate_indian_demo_data()
