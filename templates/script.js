const scene = document.querySelector("a-scene");

let map;
let userLat, userLon;

// -----------------------------
// GET REAL GPS LOCATION
// -----------------------------
navigator.geolocation.getCurrentPosition(
  (pos) => {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;

    initMap(userLat, userLon);
    loadObjects();
  },
  (err) => {
    alert("GPS access denied. Enable location and refresh.");
    console.error(err);
  },
  {
    enableHighAccuracy: true,
    timeout: 10000
  }
);

// -----------------------------
// INIT MAP
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

  // Click anywhere to place object
  map.on("click", (e) => {
    placeObject(e.latlng.lat, e.latlng.lng);
  });
}

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
    alert("Object placed at selected location");
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

  // Push object near ground
  box.setAttribute("position", "0 -1.5 0");
  box.setAttribute("scale", "3 3 3");
  box.setAttribute("color", "red");

  scene.appendChild(box);

  console.log("AR object added at:", lat, lon);
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
// LOAD SHARED OBJECTS
// -----------------------------
function loadObjects() {
  fetch("/objects")
    .then((res) => res.json())
    .then((objects) => {
      objects.forEach((obj) => {
        addARObject(obj.latitude, obj.longitude);
        addMapMarker(obj.latitude, obj.longitude);
      });
    });
}
