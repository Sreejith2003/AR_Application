// ================================
// GLOBAL REFERENCES
// ================================
const scene = document.querySelector("a-scene");
const cubeBtn = document.getElementById("cubeBtn");
const imageBtn = document.getElementById("imageBtn");
const imageInput = document.getElementById("imageInput");

let map = null;
let loaded = false;

// Placement state
let PLACE_MODE = null;
let PENDING_LAT = null;
let PENDING_LON = null;

// ================================
// UNIQUE OWNER ID (PER DEVICE)
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

    if (PLACE_MODE === "image") {
      imageInput.click();
    }
  });
}

// ================================
// GET GPS LOCATION
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
  PLACE_MODE = "image";
  alert("Tap on the map to place the image");
};

// ================================
// IMAGE UPLOAD
// ================================
imageInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file || PENDING_LAT === null) return;

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/upload", { method: "POST", body: fd });
  const data = await res.json();

  placeObject(PENDING_LAT, PENDING_LON, "image", data.url);
  resetPlacement();
});

// ================================
// PLACE OBJECT (BACKEND)
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
// RENDER OBJECT (FINAL FIXED VERSION)
// ================================
function renderObject(obj) {
  let el;

  // 🔳 REAL 3D CUBE
  if (obj.type === "cube") {
    el = document.createElement("a-box");

    el.setAttribute("width", "1.5");
    el.setAttribute("height", "1.5");
    el.setAttribute("depth", "1.5");

    el.setAttribute("rotation", "0 45 0");
    el.setAttribute(
      "material",
      "color:#ff3333; metalness:0.2; roughness:0.5"
    );
  }

  // 🖼 IMAGE — BIG & ALWAYS FACING CAMERA
  else if (obj.type === "image" && obj.asset) {
    el = document.createElement("a-plane");

    el.setAttribute("src", obj.asset);
    el.setAttribute("width", "8");
    el.setAttribute("height", "4.5");
    el.setAttribute("look-at", "[gps-camera]");
    el.setAttribute("material", "side:double; shader:flat");
  } else return;

  el.dataset.id = obj.id;
  el.setAttribute(
    "gps-entity-place",
    `latitude:${obj.latitude}; longitude:${obj.longitude}`
  );

  scene.appendChild(el);

  // 🔒 Freeze GPS & lift object
  el.addEventListener(
    "gps-entity-place-update-position",
    () => {
      const pos = el.object3D.position.clone();
      el.removeAttribute("gps-entity-place");
      el.object3D.position.copy(pos);

      // Keep GPS anchor — ONLY adjust height
      el.object3D.position.y = obj.type === "cube" ? 0.75 : 1.6;

    },
    { once: true }
  );

  // MAP MARKER
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
      const el = document.querySelector(`[data-id="${id}"]`);
      if (el) el.remove();
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
