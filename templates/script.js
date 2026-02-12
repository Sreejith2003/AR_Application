// ================================
// GLOBAL REFERENCES
// ================================
const scene = document.querySelector("a-scene");
const cubeBtn = document.getElementById("cubeBtn");
const imageBtn = document.getElementById("imageBtn");
const imageInput = document.getElementById("imageInput");
const mapArrow = document.getElementById("map-arrow");

let map = null;
let loaded = false;

// Compass
let currentHeading = 0;
let placedObjects = [];

// Placement state
let PLACE_MODE = null;
let PENDING_LAT = null;
let PENDING_LON = null;

// ================================
// UNIQUE OWNER ID
// ================================
let OWNER_ID = localStorage.getItem("ar_owner_id");
if (!OWNER_ID) {
  OWNER_ID = crypto.randomUUID();
  localStorage.setItem("ar_owner_id", OWNER_ID);
}

// ================================
// INITIALIZE MAP
// ================================
function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 18);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  L.marker([lat, lon]).addTo(map).bindPopup("You are here").openPopup();

  map.on("click", e => {
    if (!PLACE_MODE) {
      alert("Select Cube or Image first");
      return;
    }

    PENDING_LAT = e.latlng.lat;
    PENDING_LON = e.latlng.lng;

    if (PLACE_MODE === "cube") {
      placeObject(PENDING_LAT, PENDING_LON, "cube", null);
      resetPlacement();
    }

    if (PLACE_MODE === "media") {
      imageInput.click();
    }
  });
}

// ================================
// GPS LOCATION
// ================================
navigator.geolocation.getCurrentPosition(
  pos => {
    initMap(pos.coords.latitude, pos.coords.longitude);
    loadObjects();
  },
  () => alert("GPS permission required"),
  { enableHighAccuracy: true }
);

// ================================
// BUTTONS
// ================================
cubeBtn.onclick = () => {
  PLACE_MODE = "cube";
  alert("Tap on the map to place the cube");
};

imageBtn.onclick = () => {
  PLACE_MODE = "media";
  alert("Tap on the map to place image or video");
};

// ================================
// IMAGE / VIDEO UPLOAD (AUTO-DETECT)
// ================================
imageInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file || PENDING_LAT === null) return;

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/upload", { method: "POST", body: fd });
  const data = await res.json();

  let objectType;

  if (file.type.startsWith("image")) {
    objectType = "image";
  } else if (file.type.startsWith("video")) {
    objectType = "video";
  } else {
    alert("Unsupported file type");
    return;
  }

  placeObject(PENDING_LAT, PENDING_LON, objectType, data.url);
  resetPlacement();
});

// ================================
// PLACE OBJECT
// ================================
function placeObject(lat, lon, type, asset) {
  fetch("/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: lat,
      longitude: lon,
      type,
      asset,
      owner: OWNER_ID
    })
  })
    .then(res => res.json())
    .then(renderObject)
    .catch(() => alert("Place failed"));
}

// ================================
// RENDER OBJECT
// ================================
function renderObject(obj) {
  placedObjects.push(obj);

  let el;

  // ---------------- 3D CUBE ----------------
  if (obj.type === "cube") {
    el = document.createElement("a-box");

    el.setAttribute("width", "2");
    el.setAttribute("height", "2");
    el.setAttribute("depth", "2");

    el.setAttribute("rotation", "25 45 0");
    el.setAttribute(
      "material",
      "color:#e63946; metalness:0.15; roughness:0.4; shader:standard"
    );

    el.setAttribute("shadow", "cast:true; receive:true");
  }

  // ---------------- IMAGE ----------------
  else if (obj.type === "image" && obj.asset) {
    el = document.createElement("a-plane");

    el.setAttribute("src", obj.asset);
    el.setAttribute("width", "8");
    el.setAttribute("height", "4.5");
    el.setAttribute("look-at", "[gps-camera]");
    el.setAttribute("material", "side:double; shader:flat");
  }

  // ---------------- VIDEO ----------------
  else if (obj.type === "video" && obj.asset) {
    el = document.createElement("a-video");

    el.setAttribute("src", obj.asset);
    el.setAttribute("width", "8");
    el.setAttribute("height", "4.5");
    el.setAttribute("look-at", "[gps-camera]");
    el.setAttribute("material", "side:double");

    el.setAttribute("autoplay", "true");
    el.setAttribute("loop", "true");
    el.setAttribute("muted", "true"); // required for mobile autoplay
  }

  else return;

  el.dataset.id = obj.id;

  // GPS anchor
  el.setAttribute(
    "gps-entity-place",
    `latitude:${obj.latitude}; longitude:${obj.longitude}`
  );

  scene.appendChild(el);

  // Freeze world position
  el.addEventListener(
    "gps-entity-place-update-position",
    () => {
      const fixedPos = el.object3D.position.clone();
      el.removeAttribute("gps-entity-place");
      el.object3D.position.copy(fixedPos);

      el.object3D.position.y =
        obj.type === "cube" ? 0.75 : 1.6;
    },
    { once: true }
  );

  // Map marker
  const marker = L.marker([obj.latitude, obj.longitude]).addTo(map);

  if (obj.owner === OWNER_ID) {
    marker.bindPopup(
      `<button onclick="deleteObj('${obj.id}')">🗑 Delete</button>`
    );
  }
}

// ================================
// DELETE
// ================================
window.deleteObj = id => {
  fetch(`/delete/${id}?owner=${OWNER_ID}`, { method: "DELETE" })
    .then(() => {
      document.querySelector(`[data-id="${id}"]`)?.remove();
      placedObjects = placedObjects.filter(o => o.id !== id);
    });
};

// ================================
// LOAD OBJECTS
// ================================
function loadObjects() {
  if (loaded) return;
  loaded = true;

  fetch("/objects")
    .then(res => res.json())
    .then(list => list.forEach(renderObject));
}

// ================================
// RESET
// ================================
function resetPlacement() {
  PLACE_MODE = null;
  PENDING_LAT = null;
  PENDING_LON = null;
}

// ================================
// COMPASS LOGIC
// ================================
window.addEventListener("deviceorientationabsolute", e => {
  if (e.alpha !== null) {
    currentHeading = e.alpha;
    updateArrow();
  }
});

function getBearing(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.cos(toRad(lon2 - lon1));
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

function updateArrow() {
  if (!map || placedObjects.length === 0 || !mapArrow) return;

  const center = map.getCenter();
  const target = placedObjects[0];

  const bearing = getBearing(
    center.lat,
    center.lng,
    target.latitude,
    target.longitude
  );

  mapArrow.style.transform = `rotate(${bearing - currentHeading}deg)`;
}
