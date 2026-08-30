import json
import os
from datetime import datetime, timedelta, timezone

def generate_mumbai_demo_data():
    base_time = datetime.now(timezone.utc)
    
    # 1. Vessels operating in the Mumbai Maritime Corridor
    vessels = [
        {
            "mmsi": 419000123,
            "imo_number": 9272840,
            "name": "MT DESH SHANTI",
            "flag": "India (SCI)",
            "vessel_type": "Very Large Crude Carrier (VLCC)",
            "length_meters": 333.0,
            "draught_meters": 16.8,
            "call_sign": "VTDS",
            "destination": "SIKKA REFINERY TERMINAL",
            "current_position": {
                "latitude": 19.112,
                "longitude": 72.100,
                "speed_knots": 14.8,
                "heading_degrees": 325.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 255806000,
            "imo_number": 9842061,
            "name": "MSC KANOKO",
            "flag": "Liberia",
            "vessel_type": "Container Ship",
            "length_meters": 366.0,
            "draught_meters": 14.5,
            "call_sign": "CQES",
            "destination": "JNPT PORT MUMBAI",
            "current_position": {
                "latitude": 18.975,
                "longitude": 72.896,
                "speed_knots": 15.6,
                "heading_degrees": 18.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 419000789,
            "imo_number": 9324567,
            "name": "MT SWARNA SINDHU",
            "flag": "India (SCI)",
            "vessel_type": "Product Tanker",
            "length_meters": 228.0,
            "draught_meters": 12.0,
            "call_sign": "AWXZ",
            "destination": "MUMBAI REFINERY BERTH",
            "current_position": {
                "latitude": 18.930,
                "longitude": 72.871,
                "speed_knots": 11.2,
                "heading_degrees": 72.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 563032000,
            "imo_number": 9418290,
            "name": "CHEMBULK GIBRALTAR",
            "flag": "Singapore",
            "vessel_type": "Chemical Tanker",
            "length_meters": 175.0,
            "draught_meters": 9.8,
            "call_sign": "9V2941",
            "destination": "MUMBAI CHEMICAL TERMINAL",
            "current_position": {
                "latitude": 19.170,
                "longitude": 72.020,
                "speed_knots": 12.8,
                "heading_degrees": 155.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 419000456,
            "imo_number": 9308144,
            "name": "MT JAG LOK",
            "flag": "India (GE Shipping)",
            "vessel_type": "Crude Oil Tanker",
            "length_meters": 244.0,
            "draught_meters": 11.2,
            "call_sign": "AVJL",
            "destination": "SIKKA JAMNAGAR",
            "current_position": {
                "latitude": 19.020,
                "longitude": 72.270,
                "speed_knots": 12.4,
                "heading_degrees": 245.0,
                "timestamp": base_time.isoformat()
            }
        },
        {
            "mmsi": 419000999,
            "imo_number": 9594004,
            "name": "ICGS SAMUDRA PRAHARI",
            "flag": "India (Coast Guard)",
            "vessel_type": "Pollution Control Vessel",
            "length_meters": 95.0,
            "draught_meters": 4.5,
            "call_sign": "AWAH",
            "destination": "POLLUTION RESPONSE SECTOR",
            "current_position": {
                "latitude": 19.060,
                "longitude": 72.180,
                "speed_knots": 18.5,
                "heading_degrees": 310.0,
                "timestamp": base_time.isoformat()
            }
        }
    ]

    # 2. AIS Telemetry across -6 hours
    telemetry = []

    # MT DESH SHANTI (Primary Culprit for INC-MUM-2024-01 - Course 325° NNW)
    desh_pts = [
        {"lon": 72.260, "lat": 18.880, "t_offset_m": 360, "speed": 14.8, "heading": 325.0, "status": "Under way using engine"},
        {"lon": 72.202, "lat": 18.964, "t_offset_m": 180, "speed": 14.8, "heading": 325.0, "status": "Under way using engine"},
        {"lon": 72.145, "lat": 19.048, "t_offset_m": 42,  "speed": 5.2,  "heading": 325.0, "status": "Under way using engine"}, # Spill 1 Origin
        {"lon": 72.100, "lat": 19.112, "t_offset_m": 0,   "speed": 14.8, "heading": 325.0, "status": "Under way using engine"}
    ]
    for p in desh_pts:
        pt_time = base_time - timedelta(minutes=p["t_offset_m"])
        telemetry.append({
            "mmsi": 419000123,
            "timestamp": pt_time.isoformat(),
            "latitude": p["lat"],
            "longitude": p["lon"],
            "speed_knots": p["speed"],
            "heading_degrees": p["heading"],
            "nav_status": p["status"]
        })

    # MSC KANOKO (Primary Culprit for INC-MUM-2024-02 - Course 018° NNE)
    msc_pts = [
        {"lon": 72.818, "lat": 18.735, "t_offset_m": 360, "speed": 16.5, "heading": 18.0, "status": "Under way using engine"},
        {"lon": 72.844, "lat": 18.815, "t_offset_m": 180, "speed": 16.5, "heading": 18.0, "status": "Under way using engine"},
        {"lon": 72.870, "lat": 18.895, "t_offset_m": 30,  "speed": 6.8,  "heading": 18.0, "status": "Under way using engine"}, # Spill 2 Origin
        {"lon": 72.896, "lat": 18.975, "t_offset_m": 0,   "speed": 15.6, "heading": 18.0, "status": "Under way using engine"}
    ]
    for p in msc_pts:
        pt_time = base_time - timedelta(minutes=p["t_offset_m"])
        telemetry.append({
            "mmsi": 255806000,
            "timestamp": pt_time.isoformat(),
            "latitude": p["lat"],
            "longitude": p["lon"],
            "speed_knots": p["speed"],
            "heading_degrees": p["heading"],
            "nav_status": p["status"]
        })

    # MT SWARNA SINDHU (Primary Culprit for INC-MUM-2024-03 - Course 072° ENE)
    swarna_pts = [
        {"lon": 72.643, "lat": 18.855, "t_offset_m": 360, "speed": 12.0, "heading": 72.0, "status": "Under way using engine"},
        {"lon": 72.719, "lat": 18.880, "t_offset_m": 180, "speed": 12.0, "heading": 72.0, "status": "Under way using engine"},
        {"lon": 72.795, "lat": 18.905, "t_offset_m": 25,  "speed": 4.5,  "heading": 72.0, "status": "Under way using engine"}, # Spill 3 Origin
        {"lon": 72.871, "lat": 18.930, "t_offset_m": 0,   "speed": 11.2, "heading": 72.0, "status": "Under way using engine"}
    ]
    for p in swarna_pts:
        pt_time = base_time - timedelta(minutes=p["t_offset_m"])
        telemetry.append({
            "mmsi": 419000789,
            "timestamp": pt_time.isoformat(),
            "latitude": p["lat"],
            "longitude": p["lon"],
            "speed_knots": p["speed"],
            "heading_degrees": p["heading"],
            "nav_status": p["status"]
        })

    # CHEMBULK GIBRALTAR (Primary Culprit for INC-MUM-2024-04 - Course 155° SSE)
    chem_pts = [
        {"lon": 71.915, "lat": 19.395, "t_offset_m": 360, "speed": 13.4, "heading": 155.0, "status": "Under way using engine"},
        {"lon": 71.950, "lat": 19.320, "t_offset_m": 180, "speed": 13.4, "heading": 155.0, "status": "Under way using engine"},
        {"lon": 71.985, "lat": 19.245, "t_offset_m": 20,  "speed": 5.8,  "heading": 155.0, "status": "Under way using engine"}, # Spill 4 Origin
        {"lon": 72.020, "lat": 19.170, "t_offset_m": 0,   "speed": 12.8, "heading": 155.0, "status": "Under way using engine"}
    ]
    for p in chem_pts:
        pt_time = base_time - timedelta(minutes=p["t_offset_m"])
        telemetry.append({
            "mmsi": 563032000,
            "timestamp": pt_time.isoformat(),
            "latitude": p["lat"],
            "longitude": p["lon"],
            "speed_knots": p["speed"],
            "heading_degrees": p["heading"],
            "nav_status": p["status"]
        })

    # 3. Four Real-Time Oil Spills in Mumbai Maritime Zone
    spills = [
        {
            "id": "INC-MUM-2024-01",
            "name": "Mumbai High Sector Alpha - Heavy Crude Discharge",
            "detection_timestamp": base_time.isoformat(),
            "area_sq_km": 5.4,
            "perimeter_km": 14.8,
            "confidence_score": 0.988,
            "source_scene": "S1A_IW_GRDH_1SDV_MUMBAI_HIGH_ALPHA",
            "status": "ACTIVE",
            "center": [72.1674, 19.0562],
            "estimated_discharge_liters": 58000,
            "slick_type": "Heavy Crude Oil (Arabian Heavy)",
            "polygon_coordinates": [
                [72.145, 19.048],
                [72.155, 19.060],
                [72.172, 19.066],
                [72.188, 19.062],
                [72.190, 19.052],
                [72.178, 19.044],
                [72.158, 19.042],
                [72.145, 19.048]
            ]
        },
        {
            "id": "INC-MUM-2024-02",
            "name": "JNPT Channel Approach - Bilge Sludge Flush",
            "detection_timestamp": base_time.isoformat(),
            "area_sq_km": 2.85,
            "perimeter_km": 8.6,
            "confidence_score": 0.965,
            "source_scene": "S1A_IW_GRDH_1SDV_JNPT_CHANNEL",
            "status": "ACTIVE",
            "center": [72.8700, 18.8950],
            "estimated_discharge_liters": 31000,
            "slick_type": "Heavy Fuel Oil (HFO-380 Bilge Sludge)",
            "polygon_coordinates": [
                [72.855, 18.888],
                [72.865, 18.898],
                [72.876, 18.902],
                [72.886, 18.899],
                [72.888, 18.892],
                [72.878, 18.886],
                [72.864, 18.884],
                [72.855, 18.888]
            ]
        },
        {
            "id": "INC-MUM-2024-03",
            "name": "Prongs Reef Anchorage - Bunker Fuel Leak",
            "detection_timestamp": base_time.isoformat(),
            "area_sq_km": 1.95,
            "perimeter_km": 6.2,
            "confidence_score": 0.942,
            "source_scene": "S1A_IW_GRDH_1SDV_PRONGS_REEF",
            "status": "ACTIVE",
            "center": [72.7950, 18.9050],
            "estimated_discharge_liters": 18500,
            "slick_type": "Intermediate Fuel Oil (IFO-180)",
            "polygon_coordinates": [
                [72.782, 18.898],
                [72.790, 18.908],
                [72.800, 18.911],
                [72.808, 18.907],
                [72.806, 18.901],
                [72.798, 18.897],
                [72.788, 18.895],
                [72.782, 18.898]
            ]
        },
        {
            "id": "INC-MUM-2024-04",
            "name": "Neelam South Offshore - Condensate Sheen",
            "detection_timestamp": base_time.isoformat(),
            "area_sq_km": 3.60,
            "perimeter_km": 10.4,
            "confidence_score": 0.958,
            "source_scene": "S1A_IW_GRDH_1SDV_NEELAM_SOUTH",
            "status": "ACTIVE",
            "center": [71.9850, 19.2450],
            "estimated_discharge_liters": 42000,
            "slick_type": "Condensate & Light Crude Sheen",
            "polygon_coordinates": [
                [71.968, 19.236],
                [71.978, 19.249],
                [71.992, 19.254],
                [72.002, 19.250],
                [72.004, 19.241],
                [71.994, 19.236],
                [71.978, 19.233],
                [71.968, 19.236]
            ]
        }
    ]

    correlations = [
        {
            "spill_id": "INC-MUM-2024-01",
            "mmsi": 419000123,
            "vessel_name": "MT DESH SHANTI",
            "probability_score": 98.4,
            "distance_meters": 0.0
        },
        {
            "spill_id": "INC-MUM-2024-02",
            "mmsi": 255806000,
            "vessel_name": "MSC KANOKO",
            "probability_score": 94.8,
            "distance_meters": 0.0
        },
        {
            "spill_id": "INC-MUM-2024-03",
            "mmsi": 419000789,
            "vessel_name": "MT SWARNA SINDHU",
            "probability_score": 91.2,
            "distance_meters": 0.0
        },
        {
            "spill_id": "INC-MUM-2024-04",
            "mmsi": 563032000,
            "vessel_name": "CHEMBULK GIBRALTAR",
            "probability_score": 89.6,
            "distance_meters": 0.0
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
    print(f"Generated Mumbai Maritime Zone multi-incident demo fixture data at: {out_path}")

def seed_database_and_fixtures():
    generate_mumbai_demo_data()

if __name__ == "__main__":
    generate_mumbai_demo_data()
