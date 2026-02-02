from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3
import uuid
import time
import os

# -------------------------
# APP SETUP
# -------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# -------------------------
# STATIC FILES
# -------------------------
app.mount("/templates", StaticFiles(directory=os.path.join(BASE_DIR, "templates")), name="templates")

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# -------------------------
# ROOT
# -------------------------
@app.get("/", response_class=HTMLResponse)
def index():
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
    asset TEXT,
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
    asset: Optional[str] = None   # ✅ IMPORTANT
    owner: str

# -------------------------
# UPLOAD IMAGE
# -------------------------
@app.post("/upload")
def upload_image(file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(UPLOAD_DIR, filename)

    with open(path, "wb") as f:
        f.write(file.file.read())

    return {"url": f"/uploads/{filename}"}

# -------------------------
# PLACE OBJECT
# -------------------------
@app.post("/place")
def place_object(data: PlaceObject):
    obj_id = str(uuid.uuid4())
    ts = int(time.time())

    cursor.execute("""
        INSERT INTO objects VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        obj_id,
        data.latitude,
        data.longitude,
        data.type,
        data.asset,
        data.owner,
        ts
    ))
    conn.commit()

    return {
        "id": obj_id,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "type": data.type,
        "asset": data.asset,
        "owner": data.owner,
        "created_at": ts
    }

# -------------------------
# GET OBJECTS
# -------------------------
@app.get("/objects")
def get_objects():
    cursor.execute("SELECT * FROM objects")
    rows = cursor.fetchall()

    return [
        {
            "id": r[0],
            "latitude": r[1],
            "longitude": r[2],
            "type": r[3],
            "asset": r[4],
            "owner": r[5],
            "created_at": r[6]
        }
        for r in rows
    ]

# -------------------------
# DELETE OBJECT (OWNER ONLY)
# -------------------------
@app.delete("/delete/{obj_id}")
def delete_object(obj_id: str, owner: str):
    cursor.execute("SELECT owner FROM objects WHERE id=?", (obj_id,))
    row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Object not found")

    if row[0] != owner:
        raise HTTPException(status_code=403, detail="Not owner")

    cursor.execute("DELETE FROM objects WHERE id=?", (obj_id,))
    conn.commit()

    return {"status": "deleted"}
