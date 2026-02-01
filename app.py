from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import uuid
import time
import os

app = FastAPI()

# -------------------------
# CORS
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# STATIC FILES
# -------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app.mount(
    "/templates",
    StaticFiles(directory=os.path.join(BASE_DIR, "templates")),
    name="templates",
)

# -------------------------
# ROOT ROUTE (IMPORTANT)
# -------------------------
@app.get("/", response_class=HTMLResponse)
def read_root():
    with open(os.path.join(BASE_DIR, "templates", "index.html"), "r", encoding="utf-8") as f:
        return f.read()

# -------------------------
# DATABASE
# -------------------------
conn = sqlite3.connect("ar.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    latitude REAL,
    longitude REAL,
    type TEXT,
    owner TEXT,
    created_at INTEGER
)
""")
conn.commit()

# -------------------------
# MODELS
# -------------------------
class PlaceObject(BaseModel):
    latitude: float
    longitude: float
    type: str
    owner: str

# -------------------------
# PLACE OBJECT
# -------------------------
@app.post("/place")
def place_object(data: PlaceObject):
    obj_id = str(uuid.uuid4())
    created_at = int(time.time())

    cursor.execute("""
        INSERT INTO objects VALUES (?, ?, ?, ?, ?, ?)
    """, (
        obj_id,
        data.latitude,
        data.longitude,
        data.type,
        data.owner,
        created_at
    ))
    conn.commit()

    return {
        "id": obj_id,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "type": data.type,
        "owner": data.owner,
        "created_at": created_at
    }

# -------------------------
# GET OBJECTS
# -------------------------
@app.get("/objects")
def get_objects():
    cursor.execute("""
        SELECT id, latitude, longitude, type, owner, created_at
        FROM objects
    """)
    rows = cursor.fetchall()

    return [
        {
            "id": r[0],
            "latitude": r[1],
            "longitude": r[2],
            "type": r[3],
            "owner": r[4],
            "created_at": r[5]
        }
        for r in rows
    ]

# -------------------------
# DELETE OBJECT (OWNER ONLY)
# -------------------------
@app.delete("/delete/{object_id}")
def delete_object(object_id: str, owner: str):
    cursor.execute("SELECT owner FROM objects WHERE id=?", (object_id,))
    row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Object not found")

    if row[0] != owner:
        raise HTTPException(status_code=403, detail="Not object owner")

    cursor.execute("DELETE FROM objects WHERE id=?", (object_id,))
    conn.commit()

    return {"status": "deleted"}
