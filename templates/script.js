// -----------------------------
// GLOBAL REFERENCES
// -----------------------------
const scene = document.querySelector("a-scene");
const placeBtn = document.getElementById("placeBtn");

let map;
let userLat = null;
let userLon = null;
let objectsLoaded = false;

// -----------------------------
// DEFAULT FALLBACK LOCATION
// (used only if GPS fails)
// -----------------------------
const FALLBACK_LAT = 12.9716;
const FALLBACK_LON = 77.5946;

// -----------------------------
// INITIALIZE MAP (ALWAYS)
// -----------------------------
function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 18);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  // User marker
  L.marker([lat, lon])
    .addTo(map)
    .bindPopup("You are here")
    .openPopup();

  // Allow placing object by clicking map
  map.on("click", (e) => {
    placeObject(e.latlng.lat, e.latlng.lng);
  });
}

// -----------------------------
// GET REAL GPS (NON-BLOCKING)
// -----------------------------
navigator.geolocation.getCurrentPosition(
  (pos) => {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;

    console.log("GPS OK:", userLat, userLon);
    initMap(userLat, userLon);
    loadObjects();
  },
  (err) => {
    console.warn("GPS failed, using fallback");
    userLat = FALLBACK_LAT;
    userLon = FALLBACK_LON;

    initMap(userLat, userLon);
    loadObjects();
  },
  {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  }
);

// -----------------------------
// PLACE OBJECT (BUTTON FALLBACK)
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
    body: JSON.stringify({
      latitude: lat,
      longitude: lon
    })
  }).then(() => {
    addARObject(lat, lon);
    addMapMarker(lat, lon);
  });
}

// -----------------------------
// ADD AR OBJECT (FIXED & SMALL)
// -----------------------------
function addARObject(lat, lon) {
  const box = document.createElement("a-box");

  // GPS anchor
  box.setAttribute(
    "gps-entity-place",
    `latitude: ${lat}; longitude: ${lon}`
  );

  // SMALL SIZE FOR MOBILE
  box.setAttribute("scale", "0.4 0.4 0.4");

  // CLOSE TO GROUND
  box.setAttribute("position", "0 -0.7 0");

  box.setAttribute("color", "red");

  scene.appendChild(box);

  console.log("AR object placed at:", lat, lon);
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
// LOAD SHARED OBJECTS (ONCE)
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
