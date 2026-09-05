"""
Spatial Vessel Correlation & Maritime Anomaly Engine for OceanGuard (SIH26143)
Correlates detected oil slicks with AIS vessel trajectories using PostGIS and GeoAlchemy2.
Incorporates:
- Hydrodynamic Drift Hindcasting (reverse wind vectors + ocean currents back-tracing)
- Multi-factor Suspect Vessel Anomaly Scoring (loitering, sudden speed drops, AIS signal gaps, CPA)
"""
import math
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_GeomFromText, ST_Centroid

try:
    from apps.api.db.models import Vessel, AISTelemetry, OilSpill, Correlation
    from apps.api.ml.segmentation import metocean_engine
except ImportError:
    from db.models import Vessel, AISTelemetry, OilSpill, Correlation
    from ml.segmentation import metocean_engine

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


def parse_iso_timestamp(ts_str: Any) -> Optional[datetime]:
    """Robust ISO timestamp parser"""
    if isinstance(ts_str, datetime):
        return ts_str
    if not ts_str or not isinstance(ts_str, str):
        return None
    try:
        clean = ts_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        return None


class MaritimeAnomalyDetector:
    """
    Multi-Factor Maritime Vessel Anomaly Detector
    Evaluates:
    1. Sudden Speed Drops (bilge/sludge/cargo washing discharge operational signature)
    2. AIS Signal Gaps / Transponder Blackouts ("Dark Ship" evasion)
    3. Loitering & Erratic Heading Maneuvers
    4. Hydrodynamic Hindcast Origin Alignment & CPA Distance
    """

    def __init__(
        self,
        speed_drop_threshold_kts: float = 4.0,
        ais_gap_threshold_minutes: float = 20.0,
        loiter_speed_threshold_kts: float = 3.5
    ):
        self.speed_drop_threshold_kts = speed_drop_threshold_kts
        self.ais_gap_threshold_minutes = ais_gap_threshold_minutes
        self.loiter_speed_threshold_kts = loiter_speed_threshold_kts

    def detect_speed_drops(self, points: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect sudden decelerations along trajectory"""
        if len(points) < 2:
            return {
                "detected": False,
                "max_drop_kts": 0.0,
                "drop_from_kts": 0.0,
                "drop_to_kts": 0.0,
                "drop_timestamp": None,
                "score": 0.0,
                "details": "Insufficient telemetry points for speed profile analysis"
            }

        max_drop = 0.0
        drop_from_spd = 0.0
        drop_to_spd = 0.0
        drop_timestamp = None

        for i in range(len(points) - 1):
            p1 = points[i]
            p2 = points[i + 1]
            s1 = float(p1.get("speed_knots", 14.0))
            s2 = float(p2.get("speed_knots", 14.0))
            drop = s1 - s2
            if drop > max_drop:
                max_drop = drop
                drop_from_spd = s1
                drop_to_spd = s2
                drop_timestamp = p2.get("timestamp")

        # Check multi-step drop as well (e.g. over 2-3 points)
        if len(points) >= 3:
            for i in range(len(points) - 2):
                s_start = float(points[i].get("speed_knots", 14.0))
                s_mid = float(points[i+1].get("speed_knots", 14.0))
                s_end = float(points[i+2].get("speed_knots", 14.0))
                drop_span = s_start - min(s_mid, s_end)
                if drop_span > max_drop:
                    max_drop = drop_span
                    drop_from_spd = s_start
                    drop_to_spd = min(s_mid, s_end)
                    drop_timestamp = points[i+1].get("timestamp")

        detected = max_drop >= self.speed_drop_threshold_kts
        # Score scaled 0 to 100
        score = min(100.0, max(0.0, (max_drop / 12.0) * 100.0)) if detected else max(0.0, (max_drop / 6.0) * 25.0)

        details = (
            f"Sudden deceleration of -{round(max_drop, 1)} kts ({round(drop_from_spd, 1)} -> {round(drop_to_spd, 1)} kts)"
            if detected else "Normal voyage cruising speed maintained"
        )

        return {
            "detected": detected,
            "max_drop_kts": round(max_drop, 1),
            "drop_from_kts": round(drop_from_spd, 1),
            "drop_to_kts": round(drop_to_spd, 1),
            "drop_timestamp": drop_timestamp,
            "score": round(score, 1),
            "details": details
        }

    def detect_ais_gaps(self, points: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect transmission blackouts exceeding threshold"""
        if len(points) < 2:
            return {
                "detected": False,
                "max_gap_minutes": 0.0,
                "gap_count": 0,
                "gap_start": None,
                "gap_end": None,
                "score": 0.0,
                "details": "Insufficient telemetry points for AIS gap detection"
            }

        max_gap_mins = 0.0
        gap_count = 0
        gap_start = None
        gap_end = None

        for i in range(len(points) - 1):
            t1 = parse_iso_timestamp(points[i].get("timestamp"))
            t2 = parse_iso_timestamp(points[i + 1].get("timestamp"))
            if t1 and t2:
                diff_mins = (t2 - t1).total_seconds() / 60.0
                if diff_mins >= self.ais_gap_threshold_minutes:
                    gap_count += 1
                    if diff_mins > max_gap_mins:
                        max_gap_mins = diff_mins
                        gap_start = points[i].get("timestamp")
                        gap_end = points[i + 1].get("timestamp")

        detected = max_gap_mins >= self.ais_gap_threshold_minutes
        score = min(100.0, max(0.0, (max_gap_mins / 60.0) * 100.0)) if detected else 0.0

        details = (
            f"AIS signal blackout of {round(max_gap_mins, 1)} min detected during transit"
            if detected else "Continuous nominal AIS telemetry stream"
        )

        return {
            "detected": detected,
            "max_gap_minutes": round(max_gap_mins, 1),
            "gap_count": gap_count,
            "gap_start": gap_start,
            "gap_end": gap_end,
            "score": round(score, 1),
            "details": details
        }

    def detect_loitering(self, points: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect loitering or erratic heading changes in open waters"""
        if len(points) < 2:
            return {
                "detected": False,
                "score": 0.0,
                "avg_speed_kts": 0.0,
                "min_speed_kts": 0.0,
                "total_turn_deg": 0.0,
                "details": "Insufficient telemetry points for loitering analysis"
            }

        speeds = [float(p.get("speed_knots", 14.0)) for p in points]
        avg_speed = sum(speeds) / len(speeds)
        min_speed = min(speeds)

        total_heading_turn = 0.0
        for i in range(len(points) - 1):
            h1 = float(points[i].get("heading_degrees", 0.0))
            h2 = float(points[i + 1].get("heading_degrees", 0.0))
            diff = abs(h2 - h1)
            if diff > 180:
                diff = 360 - diff
            total_heading_turn += diff

        # If vessel moved at low speed or did large heading deviations
        is_slow = min_speed <= self.loiter_speed_threshold_kts or avg_speed <= 6.0
        is_erratic = total_heading_turn >= 90.0

        loitering_score = 0.0
        if is_slow and is_erratic:
            loitering_score = 88.0
        elif is_slow:
            loitering_score = 65.0
        elif is_erratic:
            loitering_score = 45.0
        else:
            loitering_score = 5.0

        detected = loitering_score >= 50.0
        details = (
            f"Vessel showed slow-speed maneuvering ({round(min_speed, 1)} kts) with {round(total_heading_turn, 0)}° turn"
            if detected else "Direct steady course underway"
        )

        return {
            "detected": detected,
            "score": round(loitering_score, 1),
            "avg_speed_kts": round(avg_speed, 1),
            "min_speed_kts": round(min_speed, 1),
            "total_turn_deg": round(total_heading_turn, 1),
            "details": details
        }

    def compute_hindcast_cpa(
        self,
        points: List[Dict[str, Any]],
        hindcast_track: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculates the minimum Closest Point of Approach (CPA) between vessel trajectory
        and the hydrodynamic back-traced spill positions.
        """
        if not points or not hindcast_track:
            return {
                "min_cpa_meters": 50000.0,
                "min_cpa_km": 50.0,
                "cpa_timestamp": None,
                "cpa_lon": None,
                "cpa_lat": None,
                "score": 0.0,
                "details": "No hindcast correlation data available"
            }

        min_cpa = float("inf")
        cpa_point = None
        cpa_hindcast_pt = None

        # Temporal and spatial matching
        for p in points:
            for h in hindcast_track:
                d = haversine_distance_meters(
                    p["longitude"], p["latitude"],
                    h["longitude"], h["latitude"]
                )
                if d < min_cpa:
                    min_cpa = d
                    cpa_point = p
                    cpa_hindcast_pt = h

        # Proximity score based on hindcast CPA
        score = 100.0 * math.exp(-min_cpa / 2800.0)
        if min_cpa < 300:
            score = max(score, 98.2)

        details = (
            f"Direct spatial intercept with hindcast discharge locus ({round(min_cpa / 1000.0, 2)} km CPA)"
            if min_cpa < 2000 else f"Closest distance to hindcast path: {round(min_cpa / 1000.0, 2)} km"
        )

        return {
            "min_cpa_meters": round(min_cpa, 1),
            "min_cpa_km": round(min_cpa / 1000.0, 2),
            "cpa_timestamp": cpa_point.get("timestamp") if cpa_point else None,
            "cpa_lon": cpa_point.get("longitude") if cpa_point else None,
            "cpa_lat": cpa_point.get("latitude") if cpa_point else None,
            "score": round(score, 1),
            "details": details
        }

    def compute_anomaly_breakdown(
        self,
        vessel: Dict[str, Any],
        points: List[Dict[str, Any]],
        hindcast_track: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Fuses all behavioral and hydrodynamic features into a composite Anomaly Matrix.
        """
        speed_res = self.detect_speed_drops(points)
        gap_res = self.detect_ais_gaps(points)
        loiter_res = self.detect_loitering(points)
        cpa_res = self.compute_hindcast_cpa(points, hindcast_track or [])

        # Weight distribution
        w_cpa = 0.40
        w_speed = 0.25
        w_gap = 0.20
        w_loiter = 0.15

        base_composite = (
            w_cpa * cpa_res["score"] +
            w_speed * speed_res["score"] +
            w_gap * gap_res["score"] +
            w_loiter * loiter_res["score"]
        )

        vtype = vessel.get("vessel_type", "")
        # Vessel risk multiplier
        if "Tanker" in vtype or "VLCC" in vtype or "Crude" in vtype:
            cargo_mult = 1.18
        elif "Chemical" in vtype or "Gas" in vtype:
            cargo_mult = 1.10
        elif any(k in vtype for k in ["Coast Guard", "Patrol", "Pollution", "Control", "Response", "Law Enforcement"]):
            cargo_mult = 0.12 # Official response vessels have low anomaly culpability
        else:
            cargo_mult = 0.95

        final_score = min(99.4, max(4.0, base_composite * cargo_mult))
        if cargo_mult >= 0.9 and cpa_res["min_cpa_meters"] < 400 and (speed_res["detected"] or gap_res["detected"]):
            final_score = max(final_score, 96.5)

        # Categorization
        if final_score >= 80.0:
            risk_level = "CRITICAL"
        elif final_score >= 60.0:
            risk_level = "HIGH"
        elif final_score >= 35.0:
            risk_level = "ELEVATED"
        else:
            risk_level = "LOW"

        # Evidence Tags
        evidence_tags = []
        if cpa_res["min_cpa_meters"] < 1500:
            evidence_tags.append(f"Hindcast Origin Intercept ({cpa_res['min_cpa_km']} km CPA)")
        if speed_res["detected"]:
            evidence_tags.append(f"Sudden Speed Drop (-{speed_res['max_drop_kts']} kts)")
        if gap_res["detected"]:
            evidence_tags.append(f"AIS Signal Blackout ({gap_res['max_gap_minutes']} min)")
        if loiter_res["detected"]:
            evidence_tags.append(f"Loitering / Erratic Heading ({loiter_res['min_speed_kts']} kts)")
        if "Tanker" in vtype:
            evidence_tags.append("High-Risk Cargo (Petroleum/HFO-380)")

        if not evidence_tags:
            evidence_tags.append("Nominal Commercial Passage")

        return {
            "composite_score": round(final_score, 1),
            "risk_level": risk_level,
            "speed_drop_score": speed_res["score"],
            "speed_drop_delta_kts": speed_res["max_drop_kts"],
            "speed_drop_details": speed_res["details"],
            "ais_gap_score": gap_res["score"],
            "max_ais_gap_minutes": gap_res["max_gap_minutes"],
            "ais_gap_details": gap_res["details"],
            "loitering_score": loiter_res["score"],
            "loitering_details": loiter_res["details"],
            "hindcast_cpa_score": cpa_res["score"],
            "hindcast_cpa_distance_m": cpa_res["min_cpa_meters"],
            "hindcast_cpa_distance_km": cpa_res["min_cpa_km"],
            "hindcast_details": cpa_res["details"],
            "evidence_tags": evidence_tags
        }


anomaly_detector = MaritimeAnomalyDetector()


class VesselCorrelationEngine:
    def __init__(self, search_radius_meters: float = 15000.0, time_window_hours: float = 6.0):
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

            # Group by vessel
            vessel_points: Dict[int, List[Dict[str, Any]]] = {}
            vessel_meta: Dict[int, Dict[str, Any]] = {}
            for r in results:
                mmsi = r.mmsi
                pt = {
                    "longitude": float(r.lon),
                    "latitude": float(r.lat),
                    "speed_knots": float(r.speed_knots or 14.0),
                    "heading_degrees": float(r.heading_degrees or 0.0),
                    "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                    "dist_meters": float(r.dist_meters)
                }
                vessel_points.setdefault(mmsi, []).append(pt)
                if mmsi not in vessel_meta:
                    vessel_meta[mmsi] = {
                        "mmsi": mmsi,
                        "name": r.name,
                        "flag": r.flag,
                        "vessel_type": r.vessel_type,
                        "length_meters": r.length_meters,
                        "call_sign": r.call_sign,
                        "destination": r.destination,
                    }

            # Generate hindcast track for spill
            center_x = float(db.scalar(func.ST_X(func.ST_Centroid(spill.polygon_geom))))
            center_y = float(db.scalar(func.ST_Y(func.ST_Centroid(spill.polygon_geom))))
            hindcast_track = metocean_engine.calculate_hindcast_track(
                center=[center_x, center_y],
                detection_timestamp_iso=spill.detection_timestamp.isoformat(),
                lookback_hours=6.0
            )

            ranked = []
            for mmsi, pts in vessel_points.items():
                pts_sorted = sorted(pts, key=lambda x: x["timestamp"] or "")
                v = vessel_meta[mmsi]
                anomaly = anomaly_detector.compute_anomaly_breakdown(v, pts_sorted, hindcast_track)
                min_dist = min(p["dist_meters"] for p in pts)

                ranked.append({
                    **v,
                    "min_distance": round(min_dist, 1),
                    "distance_meters": round(min_dist, 1),
                    "distance_km": round(min_dist / 1000.0, 2),
                    "probability_score": anomaly["composite_score"],
                    "anomaly_score": anomaly["composite_score"],
                    "anomaly_breakdown": anomaly,
                    "evidence_tags": anomaly["evidence_tags"],
                    "speed_knots": pts_sorted[-1]["speed_knots"],
                    "heading_degrees": pts_sorted[-1]["heading_degrees"],
                    "last_lat": pts_sorted[-1]["latitude"],
                    "last_lon": pts_sorted[-1]["longitude"],
                    "timestamp": pts_sorted[-1]["timestamp"],
                    "trajectory": [[p["longitude"], p["latitude"], p["timestamp"]] for p in pts_sorted]
                })

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
        telemetry_records: List[Dict[str, Any]],
        sector: str = "arabian_sea"
    ) -> List[Dict[str, Any]]:
        """
        Standalone spatial, hydrodynamic hindcasting & trajectory correlation engine.
        """
        spill_lon, spill_lat = spill_center
        # Compute reverse drift hindcast path
        hindcast_track = metocean_engine.calculate_hindcast_track(
            center=[spill_lon, spill_lat],
            detection_timestamp_iso=spill_timestamp,
            lookback_hours=6.0
        )

        ranked_suspects = []

        for vessel in vessels_list:
            mmsi = vessel["mmsi"]
            points = [t for t in telemetry_records if t["mmsi"] == mmsi]
            if not points:
                continue

            # Sort points by timestamp
            points = sorted(points, key=lambda x: x.get("timestamp", ""))

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

            # Compute comprehensive multi-factor anomaly breakdown
            anomaly = anomaly_detector.compute_anomaly_breakdown(
                vessel=vessel,
                points=points,
                hindcast_track=hindcast_track
            )

            latest_point = points[-1] if points else closest_point
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
                "probability_score": anomaly["composite_score"],
                "anomaly_score": anomaly["composite_score"],
                "weighted_anomaly_score": anomaly["composite_score"],
                "anomaly_breakdown": anomaly,
                "evidence_tags": anomaly["evidence_tags"],
                "speed_knots": latest_point.get("speed_knots", 14.2),
                "heading_degrees": latest_point.get("heading_degrees", 128.0),
                "last_lat": latest_point["latitude"],
                "last_lon": latest_point["longitude"],
                "trajectory": [[p["longitude"], p["latitude"], p.get("timestamp", "")] for p in points]
            })

        ranked_suspects.sort(key=lambda x: x["probability_score"], reverse=True)
        return ranked_suspects


correlation_engine = VesselCorrelationEngine()
