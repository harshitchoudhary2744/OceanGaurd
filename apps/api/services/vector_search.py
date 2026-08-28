"""
Qdrant Vector Database Integration for Historical Spill Similarity Search
Stores morphological shape embeddings (area, perimeter, eccentricity, signature) and performs Cosine ANN search.
Supports both Qdrant Cloud (Cluster Endpoint with API Key) and local Qdrant container instances with standalone fallback.
"""
import os
import math
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("oceanguard.vector_search")

# Auto-load environment variables from .env files if available
def _load_env_files():
    search_paths = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.getcwd(), "apps", "api", ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        os.path.join(os.getcwd(), ".env.example"),
    ]
    for path in search_paths:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            try:
                with open(abs_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip("'\"")
                            if key and key not in os.environ:
                                os.environ[key] = val
            except Exception as e:
                logger.debug(f"Could not read env file {abs_path}: {e}")

_load_env_files()

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    HAS_QDRANT = True
except ImportError:
    HAS_QDRANT = False

QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_CLUSTER_ENDPOINT = os.getenv("QDRANT_CLUSTER_ENDPOINT") or os.getenv("QDRANT_URL")
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "spill_signatures")
VECTOR_DIM = 8


# Historical catalog seed data for vector search
HISTORICAL_SPILLS_CATALOG = [
    {
        "id": "HIST-IND-2023-08",
        "title": "Mumbai High Offshore Platform Sheen",
        "date": "2023-07-19",
        "location": "Arabian Sea (Mumbai High Sector)",
        "area_sq_km": 5.10,
        "perimeter_km": 14.2,
        "eccentricity": 0.85,
        "oil_type": "Heavy Fuel Oil (HFO-380)",
        "culprit_mmsi": 419000123,
        "culprit_name": "MT DESH SHANTI",
        "vector": [0.51, 0.71, 0.85, 0.65, 0.82, 0.94, 0.58, 0.77]
    },
    {
        "id": "HIST-IND-2022-14",
        "title": "Gulf of Kutch Tanker Discharge",
        "date": "2022-11-12",
        "location": "Gulf of Kutch (Jamnagar Approach)",
        "area_sq_km": 4.60,
        "perimeter_km": 12.8,
        "eccentricity": 0.82,
        "oil_type": "Crude Sludge / Bilge",
        "culprit_mmsi": 419000456,
        "culprit_name": "ORIENTAL TITAN",
        "vector": [0.46, 0.64, 0.82, 0.60, 0.75, 0.90, 0.50, 0.69]
    },
    {
        "id": "HIST-IND-2021-03",
        "title": "Chennai Port Ennore Oil Slick",
        "date": "2021-01-28",
        "location": "Bay of Bengal (Ennore Coast)",
        "area_sq_km": 3.90,
        "perimeter_km": 10.4,
        "eccentricity": 0.78,
        "oil_type": "Heavy Furnace Fuel",
        "culprit_mmsi": 563032000,
        "culprit_name": "BW MAPLE",
        "vector": [0.39, 0.52, 0.78, 0.55, 0.68, 0.85, 0.42, 0.63]
    },
    {
        "id": "HIST-IND-2020-22",
        "title": "Cochin Outer Anchorage Sheen",
        "date": "2020-08-14",
        "location": "Arabian Sea (Cochin Sector)",
        "area_sq_km": 2.70,
        "perimeter_km": 7.8,
        "eccentricity": 0.88,
        "oil_type": "Oily Bilge Water Mix",
        "culprit_mmsi": 419000789,
        "culprit_name": "MT SWARNA SINDHU",
        "vector": [0.27, 0.39, 0.88, 0.75, 0.52, 0.78, 0.33, 0.54]
    }
]


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculate cosine similarity between two float vectors"""
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


class QdrantVectorService:
    def __init__(self):
        self.client: Optional[Any] = None
        self._connected: bool = False
        self._endpoint_info: str = "Uninitialized"
        self._init_qdrant()

    def _init_qdrant(self):
        if not HAS_QDRANT:
            logger.info("qdrant-client not installed, using built-in vector fallback.")
            return

        try:
            if QDRANT_CLUSTER_ENDPOINT:
                logger.info(f"Connecting to Qdrant Cloud Cluster: {QDRANT_CLUSTER_ENDPOINT}")
                self.client = QdrantClient(
                    url=QDRANT_CLUSTER_ENDPOINT,
                    api_key=QDRANT_API_KEY,
                    timeout=5.0
                )
                self._endpoint_info = f"Qdrant Cloud ({QDRANT_CLUSTER_ENDPOINT})"
            else:
                logger.info(f"Connecting to local Qdrant instance: {QDRANT_HOST}:{QDRANT_PORT}")
                self.client = QdrantClient(
                    host=QDRANT_HOST,
                    port=QDRANT_PORT,
                    api_key=QDRANT_API_KEY,
                    timeout=2.0
                )
                self._endpoint_info = f"Local Qdrant ({QDRANT_HOST}:{QDRANT_PORT})"

            # Verify collection existence or create
            collections = self.client.get_collections().collections
            names = [c.name for c in collections]

            if COLLECTION_NAME not in names:
                self.client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=qmodels.VectorParams(
                        size=VECTOR_DIM,
                        distance=qmodels.Distance.COSINE
                    )
                )
                logger.info(f"Created Qdrant collection '{COLLECTION_NAME}' (dim={VECTOR_DIM}, Cosine).")
                self._seed_qdrant_records()
            else:
                # Check point count
                try:
                    count_info = self.client.count(collection_name=COLLECTION_NAME)
                    if count_info.count == 0:
                        self._seed_qdrant_records()
                except Exception:
                    pass

            self._connected = True
            logger.info(f"Successfully connected to Qdrant vector database [{self._endpoint_info}].")
        except Exception as e:
            logger.warning(f"Could not connect to live Qdrant ({e}). Standalone cosine vector engine active.")
            self._connected = False

    def _seed_qdrant_records(self):
        if not self.client:
            return
        points = []
        for i, item in enumerate(HISTORICAL_SPILLS_CATALOG):
            points.append(
                qmodels.PointStruct(
                    id=i + 1,
                    vector=item["vector"],
                    payload={
                        "spill_id": item["id"],
                        "title": item["title"],
                        "date": item["date"],
                        "location": item["location"],
                        "area_sq_km": item["area_sq_km"],
                        "perimeter_km": item["perimeter_km"],
                        "eccentricity": item["eccentricity"],
                        "oil_type": item["oil_type"],
                        "culprit_mmsi": item["culprit_mmsi"],
                        "culprit_name": item["culprit_name"]
                    }
                )
            )
        self.client.upsert(collection_name=COLLECTION_NAME, points=points)
        logger.info(f"Seeded {len(points)} historical oil spill signatures into Qdrant collection '{COLLECTION_NAME}'.")

    def extract_embedding(self, metrics: Dict[str, float]) -> List[float]:
        """Convert physical morphology metrics into normalized 8D vector embedding"""
        area = min(metrics.get("area_sq_km", 3.5) / 10.0, 1.0)
        perimeter = min(metrics.get("perimeter_km", 10.0) / 20.0, 1.0)
        eccentricity = min(max(metrics.get("eccentricity", 0.8), 0.0), 1.0)
        orientation = 0.64
        backscatter = 0.76
        contrast = 0.90
        aspect = min(eccentricity * 0.6, 1.0)
        fractal = 0.65

        return [area, perimeter, eccentricity, orientation, backscatter, contrast, aspect, fractal]

    def search_similar(self, query_vector: Optional[List[float]] = None, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Query top-k morphologically similar historical spills using Cosine similarity.
        """
        if query_vector is None:
            query_vector = [0.42, 0.58, 0.85, 0.63, 0.79, 0.92, 0.45, 0.68]

        # Try Qdrant live query first
        if self._connected and self.client:
            try:
                # Support both modern query_points and legacy search methods
                if hasattr(self.client, "query_points"):
                    res = self.client.query_points(
                        collection_name=COLLECTION_NAME,
                        query=query_vector,
                        limit=top_k
                    )
                    hits = res.points
                else:
                    hits = self.client.search(
                        collection_name=COLLECTION_NAME,
                        query_vector=query_vector,
                        limit=top_k
                    )

                results = []
                for h in hits:
                    p = dict(h.payload or {})
                    p["similarity_score"] = round(float(h.score) * 100.0, 1)
                    results.append(p)
                return results
            except Exception as e:
                logger.warning(f"Qdrant query failed: {e}. Falling back to cosine ranking.")

        # Standalone vector similarity fallback
        results = []
        for item in HISTORICAL_SPILLS_CATALOG:
            sim = cosine_similarity(query_vector, item["vector"])
            res = dict(item)
            res["similarity_score"] = round(sim * 100.0, 1)
            results.append(res)

        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:top_k]


vector_service = QdrantVectorService()
