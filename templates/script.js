// ------------------------------------
// GLOBAL REFERENCES
// ------------------------------------
const scene = document.querySelector("a-scene");
const placeBtn = document.getElementById("placeBtn");

let map;
let userLat = null;
let userLon = null;
let objectsLoaded = false;

// ------------------------------------
// OWNER ID (PERSISTENT PER DEVICE)
// ------------------------------------
let OWNER_ID = localStorage.getItem("ar_owner_id");
if (!OWNER_ID) {
  OWNER_ID = crypto.randomUUID();
  localStorage.setItem("ar_owner_id", OWNER_ID);
}

// ------------------------------------
// FALLBACK LOCATION (IF GPS FAILS)
// ------------------------------------
const FALLBACK_LAT = 12.9716;
const FALLBACK_LON = 77.5946;

// ------------------------------------
// INITIALIZE MAP
// ------------------------------------
function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 18);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  L.marker([lat, lon])
    .addTo(map)
    .bindPopup("You are here")
    .openPopup();

  // Click map to place object
  map.on("click", (e) => {
    placeObject(e.latlng.lat, e.latlng.lng, "cube");
  });
}

// ------------------------------------
// GET GPS LOCATION
// ------------------------------------
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

// ------------------------------------
// PLACE OBJECT BUTTON
// ------------------------------------
placeBtn.onclick = () => {
  if (userLat && userLon) {
    placeObject(userLat, userLon, "cube");
  } else {
    alert("Waiting for GPS...");
  }
};

// ------------------------------------
// PLACE OBJECT (BACKEND CALL)
// ------------------------------------
function placeObject(lat, lon, type) {
  fetch("/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: lat,
      longitude: lon,
      type: type,
      owner: OWNER_ID
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("Place failed");
      return res.json();
    })
    .then(obj => {
      renderObject(obj);
    })
    .catch(err => {
      console.error(err);
      alert("Failed to place object");
    });
}

// ------------------------------------
// RENDER OBJECT (AR + MAP)
// ------------------------------------
function renderObject(obj) {
  addARObject(obj);
  addMapMarker(obj);
}

// ------------------------------------
// ADD AR OBJECT (FIXED / FROZEN)
// ------------------------------------
function addARObject(obj) {
  let entity;

  // Object types
  if (obj.type === "cube") {
    entity = document.createElement("a-box");
    entity.setAttribute("scale", "0.4 0.4 0.4");
    entity.setAttribute("color", "red");
  } else if (obj.type === "sphere") {
    entity = document.createElement("a-sphere");
    entity.setAttribute("radius", "0.25");
    entity.setAttribute("color", "blue");
  } else {
    return;
  }

  entity.classList.add("ar-object");
  entity.dataset.id = obj.id;
  entity.dataset.owner = obj.owner;

  // Initial GPS anchor
  entity.setAttribute(
    "gps-entity-place",
    `latitude: ${obj.latitude}; longitude: ${obj.longitude}`
  );

  scene.appendChild(entity);

  // Freeze after first GPS update
  const freezeOnce = () => {
    const fixedPos = entity.object3D.position.clone();

    entity.removeAttribute("gps-entity-place");
    entity.object3D.position.copy(fixedPos);

    // Lift object for visibility
    entity.object3D.position.y = -0.3;

    entity.removeEventListener(
      "gps-entity-place-update-position",
      freezeOnce
    );
  };

  entity.addEventListener(
    "gps-entity-place-update-position",
    freezeOnce
  );

  // Allow delete ONLY for owner
  if (obj.owner === OWNER_ID) {
    entity.addEventListener("click", () => {
      if (confirm("Delete your object?")) {
        deleteObject(obj.id, entity);
      }
    });
  }
}

// ------------------------------------
// ADD MAP MARKER
// ------------------------------------
function addMapMarker(obj) {
  L.marker([obj.latitude, obj.longitude])
    .addTo(map)
    .bindPopup(
      obj.owner === OWNER_ID
        ? "Your object (tap to delete)"
        : "Shared object"
    );
}

// ------------------------------------
// DELETE OBJECT (OWNER ONLY)
// ------------------------------------
function deleteObject(id, entity) {
  fetch(`/delete/${id}?owner=${OWNER_ID}`, {
    method: "DELETE"
  })
    .then(res => {
      if (!res.ok) throw new Error("Delete failed");
      entity.remove();
    })
    .catch(err => {
      console.error(err);
      alert("Failed to delete object");
    });
}

// ------------------------------------
// LOAD ALL SHARED OBJECTS (ONCE)
// ------------------------------------
function loadObjects() {
  if (objectsLoaded) return;
  objectsLoaded = true;

  fetch("/objects")
    .then(res => res.json())
    .then(objects => {
      objects.forEach(renderObject);
    });
}
