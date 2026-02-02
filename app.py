from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3, uuid, time, os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app.mount("/templates", StaticFiles(directory=os.path.join(BASE_DIR, "templates")), name="templates")

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/", response_class=HTMLResponse)
def home():
    with open(os.path.join(BASE_DIR, "templates", "index.html"), "r", encoding="utf-8") as f:
        return f.read()

conn = sqlite3.connect("ar.db", check_same_thread=False)
cur = conn.cursor()
cur.execute("""
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

class PlaceObject(BaseModel):
    latitude: float
    longitude: float
    type: str
    asset: Optional[str] = None
    owner: str

@app.post("/upload")
def upload(file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1]
    name = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(UPLOAD_DIR, name)
    with open(path, "wb") as f:
        f.write(file.file.read())
    return {"url": f"/uploads/{name}"}

@app.post("/place")
def place(data: PlaceObject):
    oid = str(uuid.uuid4())
    ts = int(time.time())
    cur.execute(
        "INSERT INTO objects VALUES (?,?,?,?,?,?,?)",
        (oid, data.latitude, data.longitude, data.type, data.asset, data.owner, ts)
    )
    conn.commit()
    return {
        "id": oid,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "type": data.type,
        "asset": data.asset,
        "owner": data.owner
    }

@app.get("/objects")
def objects():
    cur.execute("SELECT * FROM objects")
    rows = cur.fetchall()
    return [{
        "id": r[0],
        "latitude": r[1],
        "longitude": r[2],
        "type": r[3],
        "asset": r[4],
        "owner": r[5]
    } for r in rows]

@app.delete("/delete/{oid}")
def delete(oid: str, owner: str):
    cur.execute("SELECT owner FROM objects WHERE id=?", (oid,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404)
    if row[0] != owner:
        raise HTTPException(403)
    cur.execute("DELETE FROM objects WHERE id=?", (oid,))
    conn.commit()
    return {"status": "deleted"}
