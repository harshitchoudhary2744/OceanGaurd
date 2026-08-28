"""
SQLAlchemy ORM Models for OceanGuard (SIH26143)
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Index
)
from sqlalchemy.orm import declarative_base, relationship
from geoalchemy2 import Geometry

Base = declarative_base()


class Vessel(Base):
    __tablename__ = "vessels"

    mmsi = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    flag = Column(String(50), nullable=False)
    vessel_type = Column(String(50), nullable=False)
    length_meters = Column(Float, default=0.0)
    call_sign = Column(String(20), nullable=True)
    destination = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    telemetry = relationship("AISTelemetry", back_populates="vessel", cascade="all, delete-orphan")
    correlations = relationship("Correlation", back_populates="vessel", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "mmsi": self.mmsi,
            "name": self.name,
            "flag": self.flag,
            "vessel_type": self.vessel_type,
            "length_meters": self.length_meters,
            "call_sign": self.call_sign,
            "destination": self.destination,
        }


class AISTelemetry(Base):
    __tablename__ = "ais_telemetry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mmsi = Column(BigInteger, ForeignKey("vessels.mmsi", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    speed_knots = Column(Float, nullable=False)
    heading_degrees = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    vessel = relationship("Vessel", back_populates="telemetry")

    def to_dict(self, lat: Optional[float] = None, lon: Optional[float] = None):
        return {
            "id": self.id,
            "mmsi": self.mmsi,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "latitude": lat,
            "longitude": lon,
            "speed_knots": self.speed_knots,
            "heading_degrees": self.heading_degrees,
        }


class OilSpill(Base):
    __tablename__ = "oil_spills"

    id = Column(String(50), primary_key=True, index=True)
    detection_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    polygon_geom = Column(Geometry(geometry_type="POLYGON", srid=4326), nullable=False)
    area_sq_km = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)
    source_scene = Column(String(100), nullable=True)
    status = Column(String(30), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    correlations = relationship("Correlation", back_populates="spill", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "detection_timestamp": self.detection_timestamp.isoformat() if self.detection_timestamp else None,
            "area_sq_km": self.area_sq_km,
            "confidence_score": self.confidence_score,
            "source_scene": self.source_scene,
            "status": self.status,
        }


class Correlation(Base):
    __tablename__ = "correlations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    spill_id = Column(String(50), ForeignKey("oil_spills.id", ondelete="CASCADE"), nullable=False, index=True)
    vessel_mmsi = Column(BigInteger, ForeignKey("vessels.mmsi", ondelete="CASCADE"), nullable=False, index=True)
    probability_score = Column(Float, nullable=False)
    distance_meters = Column(Float, nullable=False)
    trajectory_delta_time_min = Column(Float, default=0.0)
    drift_alignment_pct = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    spill = relationship("OilSpill", back_populates="correlations")
    vessel = relationship("Vessel", back_populates="correlations")

    def to_dict(self):
        return {
            "id": self.id,
            "spill_id": self.spill_id,
            "vessel_mmsi": self.vessel_mmsi,
            "probability_score": self.probability_score,
            "distance_meters": self.distance_meters,
            "trajectory_delta_time_min": self.trajectory_delta_time_min,
            "drift_alignment_pct": self.drift_alignment_pct,
        }
