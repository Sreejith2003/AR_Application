from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import sqlite3

app = FastAPI()

# Serve EVERYTHING from templates folder (JS + CSS included)
app.mount("/templates", StaticFiles(directory="templates"), name="templates")

templates = Jinja2Templates(directory="templates")

# ---------- Database ----------
def get_db():
    conn = sqlite3.connect("ar.db")
    conn.row_factory = sqlite3.Row
    return conn

with get_db() as db:
    db.execute("""
    CREATE TABLE IF NOT EXISTS objects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL,
        longitude REAL
    )
    """)

# ---------- Routes ----------
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )

@app.post("/place")
async def place_object(data: dict):
    with get_db() as db:
        db.execute(
            "INSERT INTO objects (latitude, longitude) VALUES (?, ?)",
            (data["latitude"], data["longitude"])
        )
    return {"status": "object placed"}

@app.get("/objects")
async def get_objects():
    with get_db() as db:
        rows = db.execute("SELECT latitude, longitude FROM objects").fetchall()
        return JSONResponse([dict(r) for r in rows])
