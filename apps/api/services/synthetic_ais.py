from datetime import datetime, timedelta, timezone
import math
import random

# Exact synchronized waypoints for the 10 monitored vessels in the Eastern Mediterranean / Levantine Basin
MONITORED_FLEET_WAYPOINTS = [
    # 1. PRIMARY CULPRIT: VLCC Supertanker, Eastbound transit along 33.27°N
    {
        "mmsi": 212000001,
        "imo_number": 9481234,
        "name": "MEDITERRANEAN TRADER",
        "flag": "Malta",
        "vessel_type": "Very Large Crude Carrier (VLCC)",
        "length_meters": 315.0,
        "length": 315,
        "draught_meters": 15.8,
        "call_sign": "9HA4211",
        "destination": "CYPRUS OFFSHORE TRANSIT",
        "cargo_type": "Crude Oil (315,000 DWT)",
        "is_culprit": True,
        "waypoints": [
            {"tMinutes": -360, "lon": 31.6160, "lat": 33.2400, "heading": 95.0, "speed": 13.5},
            {"tMinutes": -180, "lon": 32.4232, "lat": 33.2500, "heading": 95.0, "speed": 13.5},
            {"tMinutes": -65,  "lon": 32.9699, "lat": 33.2620, "heading": 95.0, "speed": 12.0},
            {"tMinutes": -42,  "lon": 33.0421, "lat": 33.2684, "heading": 95.0, "speed": 5.4},
            {"tMinutes": -15,  "lon": 33.0941, "lat": 33.2700, "heading": 95.0, "speed": 6.2},
            {"tMinutes": 0,    "lon": 33.1431, "lat": 33.2750, "heading": 95.0, "speed": 13.5},
            {"tMinutes": 180,  "lon": 33.9503, "lat": 33.2900, "heading": 95.0, "speed": 13.5},
        ],
    },
    # 2. HIGH-SPEED PASSENGER FERRY: North-Northeast transit (25°) to Limassol
    {
        "mmsi": 212000002,
        "imo_number": 9512345,
        "name": "LEVANT STAR",
        "flag": "Cyprus",
        "vessel_type": "High-Speed Passenger Ferry",
        "length_meters": 145.0,
        "length": 145,
        "draught_meters": 6.2,
        "call_sign": "5BKA2",
        "destination": "LIMASSOL PASSENGER FERRY TERMINAL",
        "cargo_type": "Passengers & Accompanied Vehicles (1,200 PAX)",
        "waypoints": [
            {"tMinutes": -360, "lon": 32.8000, "lat": 32.1000, "heading": 25.0, "speed": 18.5},
            {"tMinutes": -180, "lon": 33.0500, "lat": 32.8500, "heading": 25.0, "speed": 18.5},
            {"tMinutes": -42,  "lon": 33.2600, "lat": 33.4500, "heading": 25.0, "speed": 18.5},
            {"tMinutes": 0,    "lon": 33.3200, "lat": 33.6500, "heading": 25.0, "speed": 18.5},
            {"tMinutes": 180,  "lon": 33.5000, "lat": 34.6000, "heading": 25.0, "speed": 18.5},
        ],
    },
    # 3. CAPESIZE BULK CARRIER: Southeast diagonal transit (145°)
    {
        "mmsi": 212000003,
        "imo_number": 9623456,
        "name": "AEGEAN VOYAGER",
        "flag": "Greece",
        "vessel_type": "Capesize Bulk Carrier",
        "length_meters": 225.0,
        "length": 225,
        "draught_meters": 11.8,
        "call_sign": "SVXY",
        "destination": "PORT SAID ANCHORAGE",
        "cargo_type": "Dry Bulk Minerals & Iron Ore",
        "waypoints": [
            {"tMinutes": -360, "lon": 31.5000, "lat": 34.1000, "heading": 145.0, "speed": 13.0},
            {"tMinutes": -180, "lon": 31.9500, "lat": 33.6500, "heading": 145.0, "speed": 13.0},
            {"tMinutes": -42,  "lon": 32.3000, "lat": 33.3000, "heading": 145.0, "speed": 13.0},
            {"tMinutes": 0,    "lon": 32.4500, "lat": 33.1500, "heading": 145.0, "speed": 13.0},
            {"tMinutes": 180,  "lon": 32.9000, "lat": 32.7000, "heading": 145.0, "speed": 13.0},
        ],
    },
    # 4. LPG TANKER: Northwest diagonal transit (305°) to Vasiliko Jetty
    {
        "mmsi": 212000004,
        "imo_number": 9734567,
        "name": "AKROTIRI BREEZE",
        "flag": "Panama",
        "vessel_type": "LPG Tanker",
        "length_meters": 180.0,
        "length": 180,
        "draught_meters": 9.4,
        "call_sign": "3EZZ8",
        "destination": "VASILIKO LPG JETTY",
        "cargo_type": "Liquefied Gas (LPG, 45,000 m³)",
        "waypoints": [
            {"tMinutes": -360, "lon": 34.4000, "lat": 33.2000, "heading": 305.0, "speed": 14.0},
            {"tMinutes": -180, "lon": 33.8500, "lat": 33.5500, "heading": 305.0, "speed": 14.0},
            {"tMinutes": -42,  "lon": 33.4500, "lat": 33.8000, "heading": 305.0, "speed": 14.0},
            {"tMinutes": 0,    "lon": 33.1500, "lat": 34.0000, "heading": 305.0, "speed": 14.0},
            {"tMinutes": 180,  "lon": 32.6000, "lat": 34.3500, "heading": 305.0, "speed": 14.0},
        ],
    },
    # 5. POLLUTION PATROL: Active tactical SAR surveillance sweep (67°)
    {
        "mmsi": 212000005,
        "imo_number": 9845678,
        "name": "CYPRUS POLICE PATROL / EMSA",
        "flag": "Cyprus (Coast Guard)",
        "vessel_type": "Pollution Control Vessel",
        "length_meters": 85.0,
        "length": 85,
        "draught_meters": 4.2,
        "call_sign": "5BCP1",
        "destination": "SAR SECTOR PATROL",
        "cargo_type": "Tier-2 Booms & Offshore Skimmers",
        "waypoints": [
            {"tMinutes": -360, "lon": 32.7000, "lat": 34.2000, "heading": 67.0, "speed": 14.0},
            {"tMinutes": -180, "lon": 32.6000, "lat": 33.6000, "heading": 67.0, "speed": 13.0},
            {"tMinutes": -42,  "lon": 32.8500, "lat": 33.4000, "heading": 67.0, "speed": 11.5},
            {"tMinutes": 0,    "lon": 33.0000, "lat": 33.4500, "heading": 67.0, "speed": 9.0},
            {"tMinutes": 180,  "lon": 33.4000, "lat": 33.6000, "heading": 67.0, "speed": 7.0},
        ],
    },
    # 6. CONTAINER SHIP: Deep southern corridor Westbound transit (270°)
    {
        "mmsi": 500100001,
        "imo_number": 9708681,
        "name": "MSC SVEVA",
        "flag": "Panama",
        "vessel_type": "Container Ship",
        "length_meters": 395.0,
        "length": 395,
        "draught_meters": 15.5,
        "call_sign": "3FVR2",
        "destination": "ROTTERDAM COMMERCIAL GATEWAY",
        "cargo_type": "Containerized Consumer Goods (19,224 TEU)",
        "waypoints": [
            {"tMinutes": -360, "lon": 34.5000, "lat": 32.8000, "heading": 270.0, "speed": 19.0},
            {"tMinutes": -180, "lon": 33.6500, "lat": 32.8000, "heading": 270.0, "speed": 19.0},
            {"tMinutes": -42,  "lon": 33.0000, "lat": 32.8000, "heading": 270.0, "speed": 19.0},
            {"tMinutes": 0,    "lon": 32.7000, "lat": 32.8000, "heading": 270.0, "speed": 19.0},
            {"tMinutes": 180,  "lon": 31.4000, "lat": 32.8000, "heading": 270.0, "speed": 19.0},
        ],
    },
    # 7. PRODUCT TANKER: Coastal southern shelf East-Northeast transit (75°)
    {
        "mmsi": 500100024,
        "imo_number": 9892345,
        "name": "STENA PROMETHEUS",
        "flag": "Cyprus",
        "vessel_type": "Product Tanker",
        "length_meters": 183.0,
        "length": 183,
        "draught_meters": 10.8,
        "call_sign": "5BCR4",
        "destination": "MONI MULTIBUOY MOORING",
        "cargo_type": "Aviation Turbine Fuel Jet A-1 (49,900 DWT)",
        "waypoints": [
            {"tMinutes": -360, "lon": 32.1000, "lat": 34.4000, "heading": 75.0, "speed": 11.0},
            {"tMinutes": -180, "lon": 32.5500, "lat": 34.5000, "heading": 75.0, "speed": 11.0},
            {"tMinutes": -42,  "lon": 32.9000, "lat": 34.5800, "heading": 75.0, "speed": 11.0},
            {"tMinutes": 0,    "lon": 33.0500, "lat": 34.6200, "heading": 75.0, "speed": 11.0},
            {"tMinutes": 180,  "lon": 33.6000, "lat": 34.7200, "heading": 75.0, "speed": 11.0},
        ],
    },
    # 8. OFFSHORE SUPPLY VESSEL: Southbound energy block support transit (176°)
    {
        "mmsi": 500100022,
        "imo_number": 9768521,
        "name": "SEACOR BRAVE",
        "flag": "Marshall Islands",
        "vessel_type": "Offshore Supply Vessel",
        "length_meters": 88.0,
        "length": 88,
        "draught_meters": 5.8,
        "call_sign": "V7KJ9",
        "destination": "APHRODITE GAS FIELD BLOCK 12",
        "cargo_type": "Subsea Drilling Mud & Drill Collars",
        "waypoints": [
            {"tMinutes": -360, "lon": 33.4000, "lat": 34.5000, "heading": 176.0, "speed": 10.5},
            {"tMinutes": -180, "lon": 33.4500, "lat": 33.9000, "heading": 176.0, "speed": 10.5},
            {"tMinutes": -42,  "lon": 33.5000, "lat": 33.4000, "heading": 176.0, "speed": 10.5},
            {"tMinutes": 0,    "lon": 33.5200, "lat": 33.2000, "heading": 176.0, "speed": 8.0},
            {"tMinutes": 180,  "lon": 33.5500, "lat": 32.7000, "heading": 176.0, "speed": 4.0},
        ],
    },
    # 9. VEHICLE CARRIER: Fast East-Southeast express route (124°)
    {
        "mmsi": 500100018,
        "imo_number": 9505039,
        "name": "WALLENIUS CARMEN",
        "flag": "Sweden",
        "vessel_type": "Vehicle Carrier",
        "length_meters": 228.0,
        "length": 228,
        "draught_meters": 9.8,
        "call_sign": "SLWD",
        "destination": "AQABA CAR TERMINAL",
        "cargo_type": "Automobiles & Electric Vehicles (6,500 CEU)",
        "waypoints": [
            {"tMinutes": -360, "lon": 31.8000, "lat": 33.7000, "heading": 124.0, "speed": 17.0},
            {"tMinutes": -180, "lon": 32.5000, "lat": 33.3000, "heading": 124.0, "speed": 17.0},
            {"tMinutes": -42,  "lon": 33.0000, "lat": 33.0000, "heading": 124.0, "speed": 17.0},
            {"tMinutes": 0,    "lon": 33.6000, "lat": 32.6500, "heading": 124.0, "speed": 17.0},
            {"tMinutes": 180,  "lon": 34.3000, "lat": 32.2500, "heading": 124.0, "speed": 17.0},
        ],
    },
    # 10. GENERAL CARGO: Southwest inbound Levantine transit (233°)
    {
        "mmsi": 500100019,
        "imo_number": 9439987,
        "name": "BBC COLORADO",
        "flag": "Antigua & Barbuda",
        "vessel_type": "General Cargo",
        "length_meters": 153.0,
        "length": 153,
        "draught_meters": 7.8,
        "call_sign": "V2FP8",
        "destination": "LIMASSOL BREAKWATER",
        "cargo_type": "Project Industrial Modules & Steel Coils",
        "waypoints": [
            {"tMinutes": -360, "lon": 34.6000, "lat": 34.6000, "heading": 233.0, "speed": 12.0},
            {"tMinutes": -180, "lon": 34.1000, "lat": 34.3000, "heading": 233.0, "speed": 12.0},
            {"tMinutes": -42,  "lon": 33.7500, "lat": 34.0500, "heading": 233.0, "speed": 12.0},
            {"tMinutes": 0,    "lon": 33.6000, "lat": 33.9500, "heading": 233.0, "speed": 12.0},
            {"tMinutes": 180,  "lon": 33.1000, "lat": 33.6500, "heading": 233.0, "speed": 12.0},
        ],
    },
]


def _interpolate_waypoint_pos(waypoints, t_offset_minutes):
    """
    Interpolate vessel coordinates, bearing, and speed along exact timed waypoints.
    Guarantees the vessel position is 100% coincident with its rendered trajectory line.
    """
    if t_offset_minutes <= waypoints[0]["tMinutes"]:
        w = waypoints[0]
        return w["lon"], w["lat"], w["heading"], w["speed"]
    if t_offset_minutes >= waypoints[-1]["tMinutes"]:
        w = waypoints[-1]
        return w["lon"], w["lat"], w["heading"], w["speed"]

    for i in range(len(waypoints) - 1):
        w1 = waypoints[i]
        w2 = waypoints[i + 1]
        if w1["tMinutes"] <= t_offset_minutes <= w2["tMinutes"]:
            seg_span = w2["tMinutes"] - w1["tMinutes"]
            prog = 0.0 if seg_span == 0 else (t_offset_minutes - w1["tMinutes"]) / seg_span

            lon = w1["lon"] + (w2["lon"] - w1["lon"]) * prog
            lat = w1["lat"] + (w2["lat"] - w1["lat"]) * prog

            # Great-circle bearing
            d_lon = math.radians(w2["lon"] - w1["lon"])
            lat1_r = math.radians(w1["lat"])
            lat2_r = math.radians(w2["lat"])
            y = math.sin(d_lon) * math.cos(lat2_r)
            x = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(d_lon)
            heading = (math.degrees(math.atan2(y, x)) + 360) % 360

            speed = w1["speed"] + (w2["speed"] - w1["speed"]) * prog
            return round(lon, 6), round(lat, 6), round(heading, 1), round(speed, 1)

    w = waypoints[-1]
    return w["lon"], w["lat"], w["heading"], w["speed"]


def generate_synthetic_ais(center_lat=33.25902604, center_lon=33.05775642):
    """
    Generate deterministic synthetic AIS for the 10 distinct vessels around the DARTIS benchmark scene.
    Every vessel's telemetry and current position are mathematically locked to their trajectory waypoints.
    """
    random.seed(42)

    scenario_time = datetime(2019, 1, 1, 3, 42, 35, tzinfo=timezone.utc)
    # 6-hour historical lookback window (from T-360 min to T0)
    start_time = scenario_time - timedelta(hours=6)

    vessels_list = []
    telemetry_records = []

    for ship in MONITORED_FLEET_WAYPOINTS:
        wps = ship["waypoints"]
        # Position at t=0 (satellite observation timestamp)
        p0_lon, p0_lat, p0_heading, p0_speed = _interpolate_waypoint_pos(wps, 0)

        vessels_list.append({
            "mmsi": ship["mmsi"],
            "imo_number": ship["imo_number"],
            "name": ship["name"],
            "flag": ship["flag"],
            "vessel_type": ship["vessel_type"],
            "length_meters": ship["length_meters"],
            "draught_meters": ship["draught_meters"],
            "call_sign": ship["call_sign"],
            "destination": ship["destination"],
            "cargo_type": ship["cargo_type"],
            "lat": p0_lat,
            "lon": p0_lon,
            "heading": p0_heading,
            "speed": p0_speed,
        })

        # 25 deterministic telemetry points (every 15 minutes from T-360 to T0)
        for i in range(25):
            t_offset = -360 + (i * 15)
            timestamp = start_time + timedelta(minutes=i * 15)

            # Check if this is the primary culprit's AIS dark window (-42m to -12m)
            is_dark_point = (ship["mmsi"] == 212000001 and -42 <= t_offset <= -15)

            pt_lon, pt_lat, pt_heading, pt_speed = _interpolate_waypoint_pos(wps, t_offset)

            # During dark window for culprit, slow-steaming at discharge location
            if is_dark_point:
                pt_speed = 5.4

            telemetry_records.append({
                "mmsi": ship["mmsi"],
                "timestamp": timestamp.isoformat(),
                "latitude": pt_lat,
                "longitude": pt_lon,
                "speed": pt_speed,
                "speed_knots": pt_speed,
                "heading": pt_heading,
                "heading_degrees": pt_heading,
                "nav_status": "Engaged in response ops" if ship["mmsi"] == 212000005 else "Under way using engine",
            })

    return {
        "scenario_time": scenario_time.isoformat(),
        "vessels": vessels_list,
        "telemetry": telemetry_records,
        "source": "SYNTHETIC_AIS_REPLAY",
    }
