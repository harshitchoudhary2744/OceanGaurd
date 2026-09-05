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

    # Normal regional maritime traffic in Eastern Mediterranean / Levantine Basin
    for i in range(25):
        vessels.append({
            "mmsi": 500100000 + i,
            "name": f"MED-TRAFFIC-{i + 1:02d}",
            "flag": "Synthetic",
            "vessel_type": random.choice(
                ["Container", "Bulk Carrier", "Tanker", "Cargo"]
            ),
            "length": random.randint(120, 280),
            "call_sign": f"SIM{i + 1:03d}",
            "destination": random.choice(
                ["Limassol", "Larnaca", "Beirut", "Port Said", "Alexandria", "Piraeus"]
            ),
            "lat": center_lat + random.uniform(-1.0, 1.0),
            "lon": center_lon + random.uniform(-1.0, 1.0),
            "heading": random.uniform(0, 360),
            "speed": random.uniform(8, 16),
        })

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
