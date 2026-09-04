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
   		 "heading": round(current_heading, 1),
        })

        # Move according to speed and interval
        distance_nm = current_speed * interval_min / 60.0
        lat, lon = _move(lat, lon, distance_nm, current_heading)

    return records


def generate_synthetic_ais(center_lat=19.05, center_lon=72.15):
    """
    Generate deterministic synthetic AIS around a supplied spill location.

    The default center preserves the original Mumbai scenario.
    """

    random.seed(42)

    scenario_time = datetime(
        2026, 9, 4, 12, 0, tzinfo=timezone.utc
    )

    # Scenario vessels are defined relative to the spill.
    # The primary suspect starts southwest of the spill and travels
    # directly toward it before exhibiting suspicious behavior.
    vessels = [
        {
            "mmsi": 419000123,
            "name": "MT DESH SHANTI",
            "flag": "India",
            "vessel_type": "VLCC",
            "length": 330,
            "call_sign": "VTDS1",
            "destination": "Spill Area",
            "lat": center_lat - 0.10,
            "lon": center_lon - 0.10,
            "heading": 45,
            "speed": 14.5,
            "speed_drop_at": 15,
            "gap_at": 13,
        },
        {
            "mmsi": 419000456,
            "name": "MSC KANOKO",
            "flag": "India",
            "vessel_type": "Container",
            "length": 280,
            "call_sign": "VTMK2",
            "destination": "Spill Area",
            "lat": center_lat - 0.45,
            "lon": center_lon - 0.10,
            "heading": 20,
            "speed": 13.5,
        },
        {
            "mmsi": 419000789,
            "name": "MT SWARNA SINDHU",
            "flag": "India",
            "vessel_type": "Tanker",
            "length": 250,
            "call_sign": "VTSW3",
            "destination": "Kandla",
            "lat": center_lat + 0.35,
            "lon": center_lon - 0.45,
            "heading": 90,
            "speed": 14.0,
            "speed_drop_at": 14,
        },
        {
            "mmsi": 477000111,
            "name": "CHEMBULK GIBRALTAR",
            "flag": "Hong Kong",
            "vessel_type": "Chemical",
            "length": 180,
            "call_sign": "VRCH4",
            "destination": "Mumbai",
            "lat": center_lat - 0.15,
            "lon": center_lon + 0.55,
            "heading": 10,
            "speed": 11.5,
            "gap_at": 10,
        },
        {
            "mmsi": 419000222,
            "name": "MV ARABIAN STAR",
            "flag": "India",
            "vessel_type": "Bulk Carrier",
            "length": 210,
            "call_sign": "VTAS5",
            "destination": "Mundra",
            "lat": center_lat + 0.50,
            "lon": center_lon + 0.40,
            "heading": 250,
            "speed": 10.0,
            "loiter_at": 12,
        },
    ]

    # Normal traffic around the same spill location.
    for i in range(25):
        vessels.append({
            "mmsi": 500100000 + i,
            "name": f"TRAFFIC-{i + 1:02d}",
            "flag": "Synthetic",
            "vessel_type": random.choice(
                ["Container", "Bulk Carrier", "Tanker", "Cargo"]
            ),
            "length": random.randint(120, 280),
            "call_sign": f"SIM{i + 1:03d}",
            "destination": random.choice(
                ["Mumbai", "Kandla", "Mundra", "Nhava Sheva"]
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
