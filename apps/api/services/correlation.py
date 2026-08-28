"""
Spatial Vessel Correlation Engine for OceanGuard (SIH26143)
Correlates detected oil slicks with AIS vessel trajectories using PostGIS and GeoAlchemy2.
Provides graceful fallback with Shapely spatial mathematics.
"""
import math
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_GeomFromText, ST_Centroid

from apps.api.db.models import Vessel, AISTelemetry, OilSpill, Correlation

logger = logging.getLogger("oceanguard.correlation")


def haversine_distance_meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Calculate great-circle distance between two points in meters"""
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def point_to_segment_distance_meters(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate perpendicular distance from point to line segment in meters"""
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return haversine_distance_meters(px, py, x1, y1)

    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return haversine_distance_meters(px, py, proj_x, proj_y)


class VesselCorrelationEngine:
    def __init__(self, search_radius_meters: float = 15000.0, time_window_hours: float = 2.0):
        self.search_radius_meters = search_radius_meters
        self.time_window_hours = time_window_hours

    def correlate_postgis(self, db: Session, spill_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Execute high-performance PostGIS query using ST_DWithin and temporal filters.
        """
        try:
            spill = db.query(OilSpill).filter(OilSpill.id == spill_id).first()
            if not spill:
                return None

            time_start = spill.detection_timestamp - timedelta(hours=self.time_window_hours)
            time_end = spill.detection_timestamp + timedelta(hours=self.time_window_hours)

            # Query vessels that have AIS points within 15 km of spill polygon within time window
            query = (
                db.query(
                    Vessel.mmsi,
                    Vessel.name,
                    Vessel.flag,
                    Vessel.vessel_type,
                    Vessel.length_meters,
                    Vessel.call_sign,
                    Vessel.destination,
                    AISTelemetry.timestamp,
                    AISTelemetry.speed_knots,
                    AISTelemetry.heading_degrees,
                    func.ST_X(func.ST_Centroid(AISTelemetry.location)).label("lon"),
                    func.ST_Y(func.ST_Centroid(AISTelemetry.location)).label("lat"),
                    ST_Distance(AISTelemetry.location, spill.polygon_geom, use_spheroid=True).label("dist_meters")
                )
                .join(AISTelemetry, Vessel.mmsi == AISTelemetry.mmsi)
                .filter(
                    and_(
                        AISTelemetry.timestamp >= time_start,
                        AISTelemetry.timestamp <= time_end,
                        ST_DWithin(AISTelemetry.location, spill.polygon_geom, self.search_radius_meters, use_spheroid=True)
                    )
                )
                .order_by(text("dist_meters ASC"))
            )

            results = query.all()
            if not results:
                return []

            # Group by vessel and rank
            vessel_data: Dict[int, Dict[str, Any]] = {}
            for r in results:
                mmsi = r.mmsi
                dist = float(r.dist_meters)
                if mmsi not in vessel_data or dist < vessel_data[mmsi]["min_distance"]:
                    vessel_data[mmsi] = {
                        "mmsi": mmsi,
                        "name": r.name,
                        "flag": r.flag,
                        "vessel_type": r.vessel_type,
                        "length_meters": r.length_meters,
                        "call_sign": r.call_sign,
                        "destination": r.destination,
                        "min_distance": dist,
                        "speed_knots": r.speed_knots,
                        "heading_degrees": r.heading_degrees,
                        "last_lat": r.lat,
                        "last_lon": r.lon,
                        "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                    }

            ranked = []
            for v in vessel_data.values():
                dist = v["min_distance"]
                prob = max(5.0, 100.0 * math.exp(-dist / 3200.0))
                if "Tanker" in v["vessel_type"]:
                    prob = min(99.4, prob * 1.15)
                if dist < 400:
                    prob = max(prob, 94.8)
                v["probability_score"] = round(prob, 1)
                v["distance_meters"] = round(dist, 1)
                ranked.append(v)

            ranked.sort(key=lambda x: x["probability_score"], reverse=True)
            return ranked
        except Exception as e:
            logger.warning(f"PostGIS correlation query error: {e}. Falling back to spatial algorithm.")
            return None

    def correlate_standalone(
        self,
        spill_id: str,
        spill_center: List[float],
        spill_timestamp: str,
        vessels_list: List[Dict[str, Any]],
        telemetry_records: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Standalone spatial & trajectory correlation fallback using pure geometry calculations.
        """
        spill_lon, spill_lat = spill_center
        ranked_suspects = []

        for vessel in vessels_list:
            mmsi = vessel["mmsi"]
            points = [t for t in telemetry_records if t["mmsi"] == mmsi]
            if not points:
                continue

            # Sort points by timestamp
            points = sorted(points, key=lambda x: x["timestamp"])

            min_dist = float("inf")
            closest_point = points[0]

            # Calculate distance across all trajectory segments
            for i in range(len(points) - 1):
                p1 = points[i]
                p2 = points[i + 1]
                seg_dist = point_to_segment_distance_meters(
                    spill_lon, spill_lat,
                    p1["longitude"], p1["latitude"],
                    p2["longitude"], p2["latitude"]
                )
                if seg_dist < min_dist:
                    min_dist = seg_dist
                    closest_point = p2

            # Also check point distances
            for pt in points:
                d = haversine_distance_meters(spill_lon, spill_lat, pt["longitude"], pt["latitude"])
                if d < min_dist:
                    min_dist = d
                    closest_point = pt

            # Scoring algorithm
            dist_score = 100.0 * math.exp(-min_dist / 3500.0)
            vtype_weight = 1.2 if "Tanker" in vessel.get("vessel_type", "") else 0.95
            speed = closest_point.get("speed_knots", 12.0)
            speed_factor = 1.1 if (8.0 <= speed <= 18.0) else 0.9

            final_prob = min(98.4, max(4.2, dist_score * vtype_weight * speed_factor))
            if min_dist < 400:
                final_prob = max(final_prob, 94.8)

            ranked_suspects.append({
                "mmsi": mmsi,
                "name": vessel["name"],
                "flag": vessel["flag"],
                "vessel_type": vessel["vessel_type"],
                "length_meters": vessel.get("length_meters", 250.0),
                "call_sign": vessel.get("call_sign", "VSSL"),
                "destination": vessel.get("destination", "PORT SUTERA"),
                "distance_meters": round(min_dist, 1),
                "distance_km": round(min_dist / 1000.0, 2),
                "probability_score": round(final_prob, 1),
                "speed_knots": closest_point.get("speed_knots", 14.2),
                "heading_degrees": closest_point.get("heading_degrees", 128.0),
                "last_lat": closest_point["latitude"],
                "last_lon": closest_point["longitude"],
                "trajectory": [[p["longitude"], p["latitude"], p["timestamp"]] for p in points]
            })

        ranked_suspects.sort(key=lambda x: x["probability_score"], reverse=True)
        return ranked_suspects


correlation_engine = VesselCorrelationEngine()
