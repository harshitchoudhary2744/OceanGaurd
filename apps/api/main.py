"""
OceanGuard FastAPI Backend Server (SIH26143)
Satellite Oil Spill Detection, Vessel Tracking & Spatial Correlation System
"""
import os
import io
import json
import math
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    WebSocket,
    WebSocketDisconnect,
    Response,
    Query
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from apps.api.db.session import get_db, is_db_available
from apps.api.db.models import Vessel, AISTelemetry, OilSpill, Correlation
from apps.api.ml.segmentation import sar_pipeline
from apps.api.services.correlation import correlation_engine
from apps.api.services.vector_search import vector_service
from apps.api.services.pdf_generator import generate_forensic_pdf_report

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("oceanguard.api")

app = FastAPI(
    title="OceanGuard API",
    description="Satellite SAR Oil Spill Detection & Vessel Tracking System (SIH26143)",
    version="1.0.0"
)

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Demo Fixture Data as In-Memory Cache/Fallback
FIXTURE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "db/demo_fixture.json"))
_FIXTURE_DATA = {
    "vessels": [],
    "telemetry": [],
    "spills": [],
    "correlations": []
}

def load_fixtures():
    global _FIXTURE_DATA
    if os.path.exists(FIXTURE_PATH):
        try:
            with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
                _FIXTURE_DATA = json.load(f)
            logger.info("Loaded demo fixture data into memory.")
        except Exception as e:
            logger.warning(f"Failed to read fixture: {e}")
    else:
        # Run generator to build fixture
        try:
            from apps.api.scripts.seed_demo_data import seed_database_and_fixtures
            seed_database_and_fixtures()
            with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
                _FIXTURE_DATA = json.load(f)
        except Exception as e:
            logger.warning(f"Error seeding fixture: {e}")

load_fixtures()


@app.on_event("startup")
async def startup_event():
    load_fixtures()
    logger.info("OceanGuard Backend initialized.")


# -------------------------------------------------------------
# REST ENDPOINTS
# -------------------------------------------------------------

@app.get("/api/v1/health")
def health_check():
    """System status and component diagnostics"""
    return {
        "status": "healthy",
        "system": "OceanGuard Tactical Command",
        "problem_statement": "SIH26143",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "database_connected": is_db_available(),
        "qdrant_connected": vector_service._connected,
        "pytorch_unet_available": sar_pipeline.model is not None,
        "active_spills_count": len(_FIXTURE_DATA.get("spills", []))
    }


@app.get("/api/v1/spills")
def get_all_spills(db: Optional[Session] = Depends(get_db)):
    """
    Returns all detected oil spills formatted as a GeoJSON FeatureCollection.
    """
    features = []

    # 1. Query database if available
    if db:
        try:
            db_spills = db.query(OilSpill).all()
            for s in db_spills:
                poly = to_shape(s.polygon_geom)
                coords = [list(poly.exterior.coords)]
                features.append({
                    "type": "Feature",
                    "id": s.id,
                    "properties": {
                        "id": s.id,
                        "detection_timestamp": s.detection_timestamp.isoformat() if s.detection_timestamp else None,
                        "area_sq_km": s.area_sq_km,
                        "confidence_score": s.confidence_score,
                        "source_scene": s.source_scene,
                        "status": s.status,
                        "center": [round(poly.centroid.x, 6), round(poly.centroid.y, 6)]
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": coords
                    }
                })
        except Exception as e:
            logger.warning(f"DB query failed in get_all_spills: {e}")

    # 2. Fallback to fixture data if no DB results
    if not features:
        for s in _FIXTURE_DATA.get("spills", []):
            features.append({
                "type": "Feature",
                "id": s["id"],
                "properties": {
                    "id": s["id"],
                    "detection_timestamp": s["detection_timestamp"],
                    "area_sq_km": s["area_sq_km"],
                    "perimeter_km": s.get("perimeter_km", 11.4),
                    "confidence_score": s["confidence_score"],
                    "source_scene": s["source_scene"],
                    "status": s["status"],
                    "center": s["center"],
                    "estimated_discharge_liters": s.get("estimated_discharge_liters", 45000),
                    "slick_type": s.get("slick_type", "Heavy Fuel Oil (HFO-380)")
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [s["polygon_coordinates"]]
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }


@app.get("/api/v1/spills/{spill_id}")
def get_spill_by_id(spill_id: str, db: Optional[Session] = Depends(get_db)):
    """Get metadata for a single oil spill incident"""
    # 1. Check DB if available
    if db:
        try:
            s = db.query(OilSpill).filter(OilSpill.id == spill_id).first()
            if s:
                poly = to_shape(s.polygon_geom)
                return {
                    "type": "Feature",
                    "id": s.id,
                    "properties": {
                        "id": s.id,
                        "detection_timestamp": s.detection_timestamp.isoformat() if s.detection_timestamp else None,
                        "area_sq_km": s.area_sq_km,
                        "confidence_score": s.confidence_score,
                        "source_scene": s.source_scene,
                        "status": s.status,
                        "center": [round(poly.centroid.x, 6), round(poly.centroid.y, 6)]
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [list(poly.exterior.coords)]
                    }
                }
        except Exception:
            pass

    # 2. Check fixture
    for s in _FIXTURE_DATA.get("spills", []):
        if s["id"].lower() == spill_id.lower():
            return {
                "type": "Feature",
                "id": s["id"],
                "properties": {
                    "id": s["id"],
                    "detection_timestamp": s["detection_timestamp"],
                    "area_sq_km": s["area_sq_km"],
                    "perimeter_km": s.get("perimeter_km", 14.8),
                    "confidence_score": s["confidence_score"],
                    "source_scene": s["source_scene"],
                    "status": s["status"],
                    "center": s["center"],
                    "estimated_discharge_liters": s.get("estimated_discharge_liters", 58000),
                    "slick_type": s.get("slick_type", "Heavy Fuel Oil (HFO-380)")
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [s["polygon_coordinates"]]
                }
            }
    raise HTTPException(status_code=404, detail="Spill incident not found")


@app.get("/api/v1/spills/{spill_id}/correlate")
def correlate_spill_vessels(spill_id: str, db: Optional[Session] = Depends(get_db)):
    """
    Calculates spatial vessel proximity and trajectory intersection.
    Returns ranked list of suspect vessels with culprit probability scores (0-100%).
    """
    # 1. Find target spill
    spill = None
    for s in _FIXTURE_DATA.get("spills", []):
        if s["id"].lower() == spill_id.lower():
            spill = s
            break

    if not spill and _FIXTURE_DATA.get("spills"):
        spill = _FIXTURE_DATA["spills"][0]

    if not spill:
        raise HTTPException(status_code=404, detail="Spill incident not found")

    # 2. Try PostGIS correlation query first if DB available
    if db:
        postgis_results = correlation_engine.correlate_postgis(db, spill["id"])
        if postgis_results:
            return {
                "spill_id": spill["id"],
                "correlation_method": "PostGIS_ST_DWithin_Spheroid",
                "suspects": postgis_results
            }

    # 3. Use standalone trajectory correlation engine
    results = correlation_engine.correlate_standalone(
        spill_id=spill["id"],
        spill_center=spill["center"],
        spill_timestamp=spill["detection_timestamp"],
        vessels_list=_FIXTURE_DATA.get("vessels", []),
        telemetry_records=_FIXTURE_DATA.get("telemetry", [])
    )

    return {
        "spill_id": spill["id"],
        "correlation_method": "Standalone_Kinematic_Trajectory_Intersection",
        "suspects": results
    }


@app.get("/api/v1/spills/{spill_id}/similar")
def get_similar_historical_spills(spill_id: str):
    """
    Queries Qdrant vector database for top 3 morphologically similar historical spills.
    """
    spill = None
    for s in _FIXTURE_DATA.get("spills", []):
        if s["id"].lower() == spill_id.lower():
            spill = s
            break

    area = spill.get("area_sq_km", 4.2) if spill else 4.2
    perimeter = spill.get("perimeter_km", 11.4) if spill else 11.4
    eccentricity = 0.84

    embedding = vector_service.extract_embedding({
        "area_sq_km": area,
        "perimeter_km": perimeter,
        "eccentricity": eccentricity
    })

    matches = vector_service.search_similar(query_vector=embedding, top_k=3)
    return {
        "spill_id": spill_id,
        "vector_dim": 8,
        "vector_metric": "Cosine",
        "matches": matches
    }


@app.post("/api/v1/spills/detect")
async def detect_spill_from_sar_image(
    file: Optional[UploadFile] = File(None),
    center_lon: float = Form(72.150),
    center_lat: float = Form(19.050),
    scene_id: Optional[str] = Form("S1A_IW_GRDH_ARABIAN_SEA_01")
):
    """
    Uploads SAR satellite scene, executes PyTorch U-Net inference,
    computes oil slick boundaries and auto-correlates against live vessel fleet.
    """
    if file:
        content = await file.read()
    else:
        # Default mock 256x256 byte payload
        content = bytes([128] * (256 * 256))

    # Run ML Pipeline
    pipeline_result = sar_pipeline.process_sar_payload(
        image_bytes=content,
        center_lon=center_lon,
        center_lat=center_lat,
        scene_id=scene_id or "S1A_IW_GRDH_1SDV_UPLOADED"
    )

    feature = pipeline_result["feature"]
    metrics = pipeline_result["metrics"]
    new_spill_id = feature["properties"]["id"]

    new_spill_obj = {
        "id": new_spill_id,
        "detection_timestamp": datetime.utcnow().isoformat() + "Z",
        "area_sq_km": metrics["area_sq_km"],
        "perimeter_km": metrics["perimeter_km"],
        "confidence_score": metrics["confidence"],
        "source_scene": scene_id or "S1A_IW_GRDH_1SDV_UPLOADED",
        "status": "ACTIVE",
        "center": [center_lon, center_lat],
        "polygon_coordinates": feature["geometry"]["coordinates"][0],
        "estimated_discharge_liters": int(metrics["area_sq_km"] * 10500),
        "slick_type": "Synthetic SAR Dark-Spot Detection"
    }

    # Prepend to in-memory fixture so UI updates immediately
    _FIXTURE_DATA["spills"].insert(0, new_spill_obj)

    # Auto-correlate with vessels
    suspects = correlation_engine.correlate_standalone(
        spill_id=new_spill_id,
        spill_center=[center_lon, center_lat],
        spill_timestamp=new_spill_obj["detection_timestamp"],
        vessels_list=_FIXTURE_DATA.get("vessels", []),
        telemetry_records=_FIXTURE_DATA.get("telemetry", [])
    )

    return {
        "status": "SUCCESS",
        "message": "SAR scene analyzed and segmented successfully.",
        "spill": new_spill_obj,
        "geojson_feature": feature,
        "metrics": metrics,
        "primary_suspect": suspects[0] if suspects else None,
        "ranked_suspects": suspects
    }


@app.get("/api/v1/reports/{spill_id}/pdf")
def download_forensic_audit_pdf(spill_id: str):
    """
    Downloads court-admissible Forensic Incident Audit Dossier in PDF format.
    """
    spill = None
    for s in _FIXTURE_DATA.get("spills", []):
        if s["id"].lower() == spill_id.lower():
            spill = s
            break

    if not spill and _FIXTURE_DATA.get("spills"):
        spill = _FIXTURE_DATA["spills"][0]

    # Get suspect details
    suspects = correlation_engine.correlate_standalone(
        spill_id=spill_id,
        spill_center=spill["center"] if spill else [72.150, 19.050],
        spill_timestamp=spill["detection_timestamp"] if spill else datetime.utcnow().isoformat(),
        vessels_list=_FIXTURE_DATA.get("vessels", []),
        telemetry_records=_FIXTURE_DATA.get("telemetry", [])
    )
    culprit = suspects[0] if suspects else None

    # Get vector matches
    similar_spills = vector_service.search_similar(top_k=3)

    pdf_bytes = generate_forensic_pdf_report(
        spill_id=spill_id,
        spill_data=spill,
        culprit_data=culprit,
        similar_spills=similar_spills
    )

    filename = f"OceanGuard_Forensic_Report_{spill_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@app.get("/api/v1/vessels")
def get_vessels_fleet():
    """Returns list of monitored vessels with latest telemetry state"""
    vessels = _FIXTURE_DATA.get("vessels", [])
    telemetry = _FIXTURE_DATA.get("telemetry", [])

    results = []
    for v in vessels:
        v_points = [t for t in telemetry if t["mmsi"] == v["mmsi"]]
        latest_point = v_points[-1] if v_points else None
        results.append({
            **v,
            "current_position": {
                "latitude": latest_point["latitude"] if latest_point else 2.75,
                "longitude": latest_point["longitude"] if latest_point else 101.35,
                "speed_knots": latest_point["speed_knots"] if latest_point else 14.0,
                "heading_degrees": latest_point["heading_degrees"] if latest_point else 128.0,
                "timestamp": latest_point["timestamp"] if latest_point else None,
            }
        })
    return {"vessels": results}


@app.get("/api/v1/telemetry")
def get_telemetry_history(
    mmsi: Optional[int] = Query(None),
    hours: int = Query(6)
):
    """Returns time-series AIS points for timeline scrubbing"""
    all_tel = _FIXTURE_DATA.get("telemetry", [])
    if mmsi:
        return {"telemetry": [t for t in all_tel if t["mmsi"] == mmsi]}
    return {"telemetry": all_tel}


# -------------------------------------------------------------
# WEBSOCKET REAL-TIME TELEMETRY BROADCAST
# -------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws/telemetry")
async def websocket_telemetry_feed(websocket: WebSocket):
    """
    WebSocket endpoint streaming live vessel telemetry updates and drift ticks.
    """
    await manager.connect(websocket)
    tick_counter = 0
    try:
        while True:
            await asyncio.sleep(2.0)
            tick_counter += 1
            
            # Simulated micro-movement for active vessels
            ticks = []
            for v in _FIXTURE_DATA.get("vessels", []):
                mmsi = v["mmsi"]
                v_pts = [t for t in _FIXTURE_DATA.get("telemetry", []) if t["mmsi"] == mmsi]
                if v_pts:
                    last_pt = v_pts[-1]
                    # Micro advance along heading
                    hdg_rad = (last_pt["heading_degrees"] * 3.14159) / 180.0
                    d_lon = 0.0003 * math.sin(hdg_rad)
                    d_lat = 0.0003 * math.cos(hdg_rad)
                    
                    ticks.append({
                        "mmsi": mmsi,
                        "name": v["name"],
                        "longitude": round(last_pt["longitude"] + d_lon, 6),
                        "latitude": round(last_pt["latitude"] + d_lat, 6),
                        "speed_knots": last_pt["speed_knots"],
                        "heading_degrees": last_pt["heading_degrees"],
                        "timestamp": datetime.utcnow().isoformat() + "Z"
                    })

            await websocket.send_json({
                "type": "TELEMETRY_TICK",
                "sequence": tick_counter,
                "server_time": datetime.utcnow().isoformat() + "Z",
                "nodes_active": len(ticks),
                "vessels": ticks
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket exception: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.api.main:app", host="0.0.0.0", port=8000, reload=True)
