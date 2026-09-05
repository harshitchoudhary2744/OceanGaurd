from datetime import datetime, timedelta, timezone
import math
import random


def _move(lat, lon, distance_nm, heading_deg):
    """
    Move a point by distance in nautical miles along a heading.
    Good enough for synthetic AIS-scale trajectories.
    """
    heading = math.radians(heading_deg)

    dlat = distance_nm * math.cos(heading) / 60.0
    dlon = distance_nm * math.sin(heading) / (60.0 * math.cos(math.radians(lat)))

    return lat + dlat, lon + dlon


def _trajectory(
    mmsi,
    start_lat,
    start_lon,
    heading,
    speed,
    start_time,
    points=25,
    interval_min=15,
    speed_drop_at=None,
    gap_at=None,
    loiter_at=None,
):
    records = []

    lat = start_lat
    lon = start_lon
    current_heading = heading
    current_speed = speed

    for i in range(points):
        timestamp = start_time + timedelta(minutes=i * interval_min)

        # Deliberate AIS gap
        if gap_at is not None and i == gap_at:
            timestamp += timedelta(minutes=45)

        # Deliberate speed drop
        if speed_drop_at is not None and i >= speed_drop_at:
            current_speed = 2.5

        # Deliberate loitering / heading changes
        if loiter_at is not None and i >= loiter_at:
            current_speed = 2.0
            current_heading = (heading + ((i - loiter_at) * 55)) % 360

        records.append({
            "mmsi": mmsi,
            "timestamp": timestamp.isoformat(),
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "speed": round(current_speed, 2),
            "speed_knots": round(current_speed, 2),
            "heading": round(current_heading, 1),
            "heading_degrees": round(current_heading, 1),
        })

        # Move according to speed and interval
        distance_nm = current_speed * interval_min / 60.0
        lat, lon = _move(lat, lon, distance_nm, current_heading)

    return records


def generate_synthetic_ais(center_lat=33.25902604, center_lon=33.05775642):
    """
    Generate deterministic synthetic AIS around the DARTIS ow-0001 benchmark location.
    Coordinates: 33.25902604° N, 33.05775642° E (Cyprus / Levantine Basin)
    """
    random.seed(42)

    scenario_time = datetime(
        2019, 1, 1, 3, 42, 35, tzinfo=timezone.utc
    )

    # Scenario vessels are defined relative to the DARTIS ow-0001 spill location.
    # The primary suspect (MEDITERRANEAN TRADER) transits east-southeast along 095°,
    # slow-steaming at the discharge coordinates with an AIS gap.
    vessels = [
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
            "lat": 33.373641,
            "lon": 31.603408,
            "heading": 95,
            "speed": 13.8,
            "speed_drop_at": 21,
            "gap_at": 21,
            "loiter_at": 21,
        },
        {
            "mmsi": 209123000,
            "imo_number": 9512345,
            "name": "LEVANT STAR",
            "flag": "Cyprus",
            "vessel_type": "Container Ship",
            "length_meters": 295.0,
            "length": 295,
            "draught_meters": 13.5,
            "call_sign": "5BKA2",
            "destination": "LIMASSOL COMMERCIAL PORT",
            "lat": center_lat - 0.35,
            "lon": center_lon - 0.15,
            "heading": 35,
            "speed": 14.2,
        },
        {
            "mmsi": 239456000,
            "imo_number": 9623456,
            "name": "AEGEAN VOYAGER",
            "flag": "Greece",
            "vessel_type": "Bulk Carrier",
            "length_meters": 225.0,
            "length": 225,
            "draught_meters": 11.8,
            "call_sign": "SVXY",
            "destination": "PORT SAID ANCHORAGE",
            "lat": center_lat + 0.25,
            "lon": center_lon - 0.30,
            "heading": 110,
            "speed": 12.5,
            "speed_drop_at": 15,
        },
        {
            "mmsi": 212789000,
            "imo_number": 9734567,
            "name": "AKROTIRI BREEZE",
            "flag": "Cyprus",
            "vessel_type": "Product Tanker",
            "length_meters": 185.0,
            "length": 185,
            "draught_meters": 9.5,
            "call_sign": "5BAK7",
            "destination": "VASILIKO OIL TERMINAL",
            "lat": center_lat + 0.35,
            "lon": center_lon + 0.45,
            "heading": 285,
            "speed": 11.0,
            "gap_at": 10,
        },
        {
            "mmsi": 212999000,
            "imo_number": 9899001,
            "name": "CYPRUS POLICE PATROL / EMSA",
            "flag": "Cyprus",
            "vessel_type": "Pollution Control Vessel",
            "length_meters": 65.0,
            "length": 65,
            "draught_meters": 4.2,
            "call_sign": "5BCP1",
            "destination": "DARTIS INCIDENT PATROL",
            "lat": center_lat + 0.15,
            "lon": center_lon + 0.10,
            "heading": 220,
            "speed": 18.0,
            "loiter_at": 12,
        },
    ]

    # Normal regional commercial maritime traffic in Eastern Mediterranean / Levantine Basin
    corridor_fleet = [
        {"mmsi": 500100001, "name": "MSC SVEVA", "flag": "Panama", "vessel_type": "Container Ship", "length": 395, "call_sign": "3FVR2", "destination": "ROTTERDAM", "lat": 33.340, "lon": 32.720, "heading": 284, "speed": 18.2},
        {"mmsi": 500100002, "name": "CMA CGM TIGRIS", "flag": "Malta", "vessel_type": "Container Ship", "length": 300, "call_sign": "9HA3812", "destination": "PORT SAID", "lat": 33.120, "lon": 32.850, "heading": 102, "speed": 17.6},
        {"mmsi": 500100003, "name": "EVER GOLDEN", "flag": "Panama", "vessel_type": "Container Ship", "length": 400, "call_sign": "3EPA7", "destination": "PIRAEUS", "lat": 33.410, "lon": 33.480, "heading": 286, "speed": 18.8},
        {"mmsi": 500100004, "name": "MAERSK MC-KINNEY", "flag": "Denmark", "vessel_type": "Container Ship", "length": 399, "call_sign": "OZHC2", "destination": "SUEZ CANAL", "lat": 33.080, "lon": 33.320, "heading": 104, "speed": 16.9},
        {"mmsi": 500100005, "name": "HAPAG AL JASRAH", "flag": "Germany", "vessel_type": "Container Ship", "length": 368, "call_sign": "DGDH2", "destination": "VALENCIA", "lat": 33.380, "lon": 33.820, "heading": 285, "speed": 17.2},
        {"mmsi": 500100006, "name": "COSCO GALAXY", "flag": "Hong Kong", "vessel_type": "Container Ship", "length": 400, "call_sign": "VRTY5", "destination": "SINGAPORE", "lat": 32.950, "lon": 32.610, "heading": 101, "speed": 18.4},
        {"mmsi": 500100007, "name": "FRONT ALTAIR", "flag": "Marshall Islands", "vessel_type": "Crude Oil Tanker", "length": 333, "call_sign": "V7HJ3", "destination": "TRIESTE", "lat": 33.210, "lon": 32.450, "heading": 282, "speed": 13.6},
        {"mmsi": 500100008, "name": "NORDIC PASSAGE", "flag": "Liberia", "vessel_type": "Suezmax Tanker", "length": 274, "call_sign": "A8ZZ9", "destination": "SIDI KERIR", "lat": 32.980, "lon": 33.650, "heading": 98, "speed": 13.1},
        {"mmsi": 500100009, "name": "MINERVA ELEONORA", "flag": "Greece", "vessel_type": "Aframax Tanker", "length": 243, "call_sign": "SVBG4", "destination": "VASILIKO", "lat": 34.520, "lon": 33.150, "heading": 268, "speed": 12.4},
        {"mmsi": 500100010, "name": "EURONAV CAP VICTOR", "flag": "Belgium", "vessel_type": "Crude Oil Tanker", "length": 277, "call_sign": "ONCV", "destination": "FOS SUR MER", "lat": 33.480, "lon": 32.950, "heading": 287, "speed": 14.0},
        {"mmsi": 500100011, "name": "GASLOG SYDNEY", "flag": "Bermuda", "vessel_type": "LNG Carrier", "length": 285, "call_sign": "ZCEQ5", "destination": "DAMIETTA", "lat": 33.020, "lon": 32.980, "heading": 105, "speed": 16.4},
        {"mmsi": 500100012, "name": "GOLAR ICE", "flag": "Marshall Islands", "vessel_type": "LNG Carrier", "length": 288, "call_sign": "V7TR4", "destination": "BARCELONA", "lat": 33.450, "lon": 33.620, "heading": 283, "speed": 15.7},
        {"mmsi": 500100013, "name": "BERGE OLYMPUS", "flag": "Isle of Man", "vessel_type": "Bulk Carrier", "length": 300, "call_sign": "MDYJ8", "destination": "PORT SAID", "lat": 33.150, "lon": 33.780, "heading": 100, "speed": 12.2},
        {"mmsi": 500100014, "name": "STAR BULK GEMINI", "flag": "Marshall Islands", "vessel_type": "Bulk Carrier", "length": 229, "call_sign": "V7PL2", "destination": "BEIRUT", "lat": 33.620, "lon": 34.120, "heading": 34, "speed": 12.6},
        {"mmsi": 500100015, "name": "OLDENDORFF DIETRICH", "flag": "Liberia", "vessel_type": "Bulk Carrier", "length": 255, "call_sign": "D5MK8", "destination": "ALEXANDRIA", "lat": 33.850, "lon": 34.280, "heading": 212, "speed": 11.8},
        {"mmsi": 500100016, "name": "PACIFIC VALOUR", "flag": "Singapore", "vessel_type": "Bulk Carrier", "length": 199, "call_sign": "9V8432", "destination": "LARNACA", "lat": 34.780, "lon": 33.720, "heading": 88, "speed": 12.0},
        {"mmsi": 500100017, "name": "GRIMALDI NIGERIA", "flag": "Italy", "vessel_type": "Ro-Ro Cargo", "length": 214, "call_sign": "IBLC", "destination": "SALERNO", "lat": 33.520, "lon": 33.180, "heading": 280, "speed": 15.4},
        {"mmsi": 500100018, "name": "WALLENIUS CARMEN", "flag": "Sweden", "vessel_type": "Vehicle Carrier", "length": 228, "call_sign": "SLWD", "destination": "AQABA", "lat": 33.050, "lon": 33.450, "heading": 106, "speed": 16.2},
        {"mmsi": 500100019, "name": "BBC COLORADO", "flag": "Antigua & Barbuda", "vessel_type": "General Cargo", "length": 153, "call_sign": "V2FP8", "destination": "LIMASSOL", "lat": 34.610, "lon": 33.240, "heading": 262, "speed": 11.4},
        {"mmsi": 500100020, "name": "ARK FORWARDER", "flag": "Cyprus", "vessel_type": "Ro-Ro Cargo", "length": 182, "call_sign": "5BLN3", "destination": "TRIPOLI", "lat": 34.150, "lon": 34.420, "heading": 38, "speed": 15.0},
        {"mmsi": 500100021, "name": "ALMI HORIZON", "flag": "Liberia", "vessel_type": "Suezmax Tanker", "length": 274, "call_sign": "D5NX4", "destination": "GENOA", "lat": 33.360, "lon": 33.550, "heading": 285, "speed": 13.5},
        {"mmsi": 500100022, "name": "SEACOR BRAVE", "flag": "Marshall Islands", "vessel_type": "Offshore Supply Vessel", "length": 88, "call_sign": "V7KJ9", "destination": "APHRODITE FIELD", "lat": 33.100, "lon": 33.880, "heading": 195, "speed": 10.4},
        {"mmsi": 500100023, "name": "MARAN GAS APHRODITE", "flag": "Greece", "vessel_type": "LNG Carrier", "length": 294, "call_sign": "SVAX8", "destination": "IDKU", "lat": 32.920, "lon": 33.150, "heading": 96, "speed": 16.5},
        {"mmsi": 500100024, "name": "STENA PROMETHEUS", "flag": "Cyprus", "vessel_type": "Product Tanker", "length": 183, "call_sign": "5BCR4", "destination": "MONI", "lat": 34.680, "lon": 33.380, "heading": 75, "speed": 12.8},
        {"mmsi": 500100025, "name": "OLYMPIC GLORY", "flag": "Greece", "vessel_type": "Crude Oil Tanker", "length": 274, "call_sign": "SYGF", "destination": "AUGUSTA", "lat": 33.420, "lon": 32.550, "heading": 283, "speed": 13.8},
    ]
    vessels.extend(corridor_fleet)

    telemetry = []

    for vessel in vessels:
        telemetry.extend(
            _trajectory(
                mmsi=vessel["mmsi"],
                start_lat=vessel["lat"],
                start_lon=vessel["lon"],
                heading=vessel["heading"],
                speed=vessel["speed"],
                start_time=scenario_time - timedelta(hours=6),
                points=25,
                interval_min=15,
                speed_drop_at=vessel.get("speed_drop_at"),
                gap_at=vessel.get("gap_at"),
                loiter_at=vessel.get("loiter_at"),
            )
        )

    return {
        "scenario_time": scenario_time.isoformat(),
        "vessels": [
            {
                k: v
                for k, v in vessel.items()
                if k not in {
                    "lat",
                    "lon",
                    "heading",
                    "speed",
                    "speed_drop_at",
                    "gap_at",
                    "loiter_at",
                }
            }
            for vessel in vessels
        ],
        "telemetry": telemetry,
        "source": "SYNTHETIC_AIS_REPLAY",
    }
