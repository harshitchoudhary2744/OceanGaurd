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

    # 2. AIS Telemetry across -6 hours for each vessel with realistic anomaly profiles
    telemetry = []
    
    # Vessel 1: MT DESH SHANTI (Primary Culprit in Arabian Sea / Mumbai High)
    # Features: Direct hindcast intercept, sudden speed drop (14.8 -> 5.2 kts), 42-min AIS signal blackout during discharge
    desh_pts = [
        {"lon": 71.850, "lat": 18.750, "t_offset_h": 6.0, "speed": 14.8, "heading": 52.0, "status": "Under way using engine"},
        {"lon": 71.950, "lat": 18.850, "t_offset_h": 4.5, "speed": 14.8, "heading": 52.0, "status": "Under way using engine"},
        {"lon": 72.030, "lat": 18.930, "t_offset_h": 3.0, "speed": 14.8, "heading": 52.0, "status": "Under way using engine"},
        {"lon": 72.090, "lat": 18.990, "t_offset_h": 1.5, "speed": 14.5, "heading": 52.0, "status": "Under way using engine"},
        # Speed Drop & Discharge Point at T-42m (0.7h) -> Transponder Gap Starts
        {"lon": 72.145, "lat": 19.048, "t_offset_h": 0.7, "speed": 5.2,  "heading": 55.0, "status": "Under way using engine"}, # 42 min gap here!
        # Transponder Re-activates after discharge at T-0
        {"lon": 72.240, "lat": 19.120, "t_offset_h": 0.0, "speed": 14.8, "heading": 52.0, "status": "Under way using engine"},
    ]
    for p in desh_pts:
        pt_time = base_time - timedelta(hours=p["t_offset_h"])
        telemetry.append({
            "mmsi": 419000123,
            "timestamp": pt_time.isoformat(),
            "latitude": p["lat"],
            "longitude": p["lon"],
            "speed_knots": p["speed"],
            "heading_degrees": p["heading"],
            "nav_status": p["status"]
        })

    # Vessel 2: MT JAG LOK (Product Tanker - Inbound JNPT)
    # Steady voyage, regular reporting, no speed drop
    jag_pts = [
        {"lon": 71.950, "lat": 19.055, "t_offset_h": 6.0, "speed": 12.4, "heading": 98.0},
        {"lon": 72.030, "lat": 19.045, "t_offset_h": 4.5, "speed": 12.4, "heading": 98.0},
        {"lon": 72.100, "lat": 19.035, "t_offset_h": 3.0, "speed": 12.4, "heading": 98.0},
        {"lon": 72.185, "lat": 19.025, "t_offset_h": 1.5, "speed": 12.4, "heading": 98.0},
        {"lon": 72.275, "lat": 19.015, "t_offset_h": 0.0, "speed": 12.4, "heading": 98.0},
    ]
    for p in jag_pts:
        pt_time = base_time - timedelta(hours=p["t_offset_h"])
        telemetry.append({
            "mmsi": 419000456,
            "timestamp": pt_time.isoformat(),
            "latitude": p["lat"],
            "longitude": p["lon"],
            "speed_knots": p["speed"],
            "heading_degrees": p["heading"],
            "nav_status": "Under way using engine"
        })

    # Vessel 3: MSC KANOKO (Container Ship - High Speed Transit)
    msc_pts = [
        {"lon": 71.800, "lat": 19.070, "t_offset_h": 6.0, "speed": 17.2, "heading": 68.0},
        {"lon": 71.875, "lat": 19.100, "t_offset_h": 4.5, "speed": 17.2, "heading": 68.0},
        {"lon": 71.950, "lat": 19.130, "t_offset_h": 3.0, "speed": 17.2, "heading": 68.0},
        {"lon": 72.030, "lat": 19.165, "t_offset_h": 1.5, "speed": 17.2, "heading": 68.0},
        {"lon": 72.105, "lat": 19.195, "t_offset_h": 0.0, "speed": 17.2, "heading": 68.0},
    ]
    for p in msc_pts:
        pt_time = base_time - timedelta(hours=p["t_offset_h"])
        telemetry.append({
            "mmsi": 353136000,
            "timestamp": pt_time.isoformat(),
            "latitude": p["lat"],
            "longitude": p["lon"],
            "speed_knots": p["speed"],
            "heading_degrees": p["heading"],
            "nav_status": "Under way using engine"
        })

    # Vessel 4: MT SWARNA SINDHU
    swarna_pts = [
        {"lon": 72.020, "lat": 18.950, "t_offset_h": 6.0, "speed": 12.0, "heading": 170.0},
        {"lon": 72.050, "lat": 18.880, "t_offset_h": 3.0, "speed": 12.0, "heading": 170.0},
        {"lon": 72.100, "lat": 18.750, "t_offset_h": 0.0, "speed": 12.0, "heading": 170.0},
    ]
    for p in swarna_pts:
        pt_time = base_time - timedelta(hours=p["t_offset_h"])
        telemetry.append({
            "mmsi": 419000789,
            "timestamp": pt_time.isoformat(),
            "latitude": p["lat"],
            "longitude": p["lon"],
            "speed_knots": p["speed"],
            "heading_degrees": p["heading"],
            "nav_status": "Under way using engine"
        })

    # Vessel 5: CHEMBULK GIBRALTAR
    chem_pts = [
        {"lon": 71.900, "lat": 18.900, "t_offset_h": 6.0, "speed": 11.5, "heading": 15.0},
        {"lon": 71.925, "lat": 19.010, "t_offset_h": 3.0, "speed": 11.5, "heading": 15.0},
        {"lon": 71.950, "lat": 19.120, "t_offset_h": 0.0, "speed": 11.5, "heading": 15.0},
    ]
    for p in chem_pts:
        pt_time = base_time - timedelta(hours=p["t_offset_h"])
        telemetry.append({
            "mmsi": 563032000,
            "timestamp": pt_time.isoformat(),
            "latitude": p["lat"],
            "longitude": p["lon"],
            "speed_knots": p["speed"],
            "heading_degrees": p["heading"],
            "nav_status": "Under way using engine"
        })

    # 3. Oil Spill Polygons in Indian Waters
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
            "id": "INC-IND-2017-02",
            "detection_timestamp": "2017-01-27T22:15:00.000Z",
            "area_sq_km": 3.42,
            "perimeter_km": 11.2,
            "confidence_score": 0.962,
            "source_scene": "S1A_IW_GRDH_1SDV_20170128T124530_015024",
            "status": "ACTIVE",
            "center": [80.750, 13.250],
            "estimated_discharge_liters": 251400,
            "slick_type": "Heavy Bunker Fuel Oil (HFO-380)",
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

def seed_database_and_fixtures():
    generate_indian_demo_data()

if __name__ == "__main__":
    generate_indian_demo_data()
