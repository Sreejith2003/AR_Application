const scene = document.querySelector("a-scene");
const placeBtn = document.getElementById("placeBtn");

// DEFAULT LOCATION (fallback if GPS fails)
let userLat = 12.9716;
let userLon = 77.5946;

let map;

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
    .bindPopup("Your Location")
    .openPopup();

  // Click anywhere to place object
  map.on("click", (e) => {
    placeObject(e.latlng.lat, e.latlng.lng);
  });
}

// -----------------------------
// TRY GPS (NON-BLOCKING)
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
    console.warn("GPS failed, using fallback location");
    initMap(userLat, userLon);
    loadObjects();
  },
  { enableHighAccuracy: true, timeout: 8000 }
);

// -----------------------------
// BUTTON FALLBACK
// -----------------------------
placeBtn.onclick = () => {
  placeObject(userLat, userLon);
};

// -----------------------------
// PLACE OBJECT
// -----------------------------
function placeObject(lat, lon) {
  fetch("/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: lat, longitude: lon })
  }).then(() => {
    addARObject(lat, lon);
    addMapMarker(lat, lon);
    alert("Object placed");
  });
}

// -----------------------------
// ADD AR OBJECT (NEAR GROUND)
// -----------------------------
function addARObject(lat, lon) {
  const box = document.createElement("a-box");

  box.setAttribute(
    "gps-entity-place",
    `latitude: ${lat}; longitude: ${lon}`
  );

  box.setAttribute("position", "0 -1.5 0");
  box.setAttribute("scale", "3 3 3");
  box.setAttribute("color", "red");

  scene.appendChild(box);
}

// -----------------------------
// MAP MARKER
// -----------------------------
function addMapMarker(lat, lon) {
  L.marker([lat, lon])
    .addTo(map)
    .bindPopup("AR Object");
}

// -----------------------------
// LOAD SHARED OBJECTS
// -----------------------------
function loadObjects() {
  fetch("/objects")
    .then(res => res.json())
    .then(objects => {
      objects.forEach(obj => {
        addARObject(obj.latitude, obj.longitude);
        addMapMarker(obj.latitude, obj.longitude);
      });
    });
}
