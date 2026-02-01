// -----------------------------
// GLOBAL REFERENCES
// -----------------------------
const scene = document.querySelector("a-scene");
const placeBtn = document.getElementById("placeBtn");

let map;
let userLat = null;
let userLon = null;
let objectsLoaded = false;

// Fallback location (used only if GPS fails)
const FALLBACK_LAT = 12.9716;
const FALLBACK_LON = 77.5946;

// -----------------------------
// INIT MAP (ALWAYS)
// -----------------------------
function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 18);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  L.marker([lat, lon])
    .addTo(map)
    .bindPopup("You are here")
    .openPopup();

  // Place object by clicking map
  map.on("click", (e) => {
    placeObject(e.latlng.lat, e.latlng.lng);
  });
}

// -----------------------------
// GET GPS (NON-BLOCKING)
// -----------------------------
navigator.geolocation.getCurrentPosition(
  (pos) => {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
    initMap(userLat, userLon);
    loadObjects();
  },
  () => {
    userLat = FALLBACK_LAT;
    userLon = FALLBACK_LON;
    initMap(userLat, userLon);
    loadObjects();
  },
  { enableHighAccuracy: true, timeout: 10000 }
);

// -----------------------------
// BUTTON PLACEMENT (FALLBACK)
// -----------------------------
placeBtn.onclick = () => {
  if (userLat && userLon) {
    placeObject(userLat, userLon);
  } else {
    alert("Waiting for GPS...");
  }
};

// -----------------------------
// PLACE OBJECT (BACKEND + UI)
// -----------------------------
function placeObject(lat, lon) {
  fetch("/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: lat, longitude: lon })
  }).then(() => {
    addARObject(lat, lon);
    addMapMarker(lat, lon);
  });
}

// -----------------------------
// ADD AR OBJECT (FREEZE MODE)
// -----------------------------
function addARObject(lat, lon) {
  const box = document.createElement("a-box");

  // Initial GPS anchor
  box.setAttribute(
    "gps-entity-place",
    `latitude: ${lat}; longitude: ${lon}`
  );

  // SMALL & MOBILE FRIENDLY
  box.setAttribute("scale", "0.35 0.35 0.35");
  box.setAttribute("color", "red");

  scene.appendChild(box);

  // 🔒 FREEZE OBJECT AFTER FIRST GPS UPDATE
  box.addEventListener("gps-entity-place-update-position", () => {
    const fixedPosition = box.object3D.position.clone();

    // Remove GPS updates
    box.removeAttribute("gps-entity-place");

    // Lock object in local space
    box.object3D.position.copy(fixedPosition);
    box.object3D.position.y = -0.7; // ground level

    console.log("AR object frozen at fixed position");
  });
}

// -----------------------------
// ADD MAP MARKER
// -----------------------------
function addMapMarker(lat, lon) {
  L.marker([lat, lon])
    .addTo(map)
    .bindPopup("AR Object");
}

// -----------------------------
// LOAD OBJECTS ONCE
// -----------------------------
function loadObjects() {
  if (objectsLoaded) return;
  objectsLoaded = true;

  fetch("/objects")
    .then(res => res.json())
    .then(objects => {
      objects.forEach(obj => {
        addARObject(obj.latitude, obj.longitude);
        addMapMarker(obj.latitude, obj.longitude);
      });
    });
}
