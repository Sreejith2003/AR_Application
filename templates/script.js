// ================================
// GLOBAL REFERENCES
// ================================
const scene = document.querySelector("a-scene");
const cubeBtn = document.getElementById("cubeBtn");
const imageBtn = document.getElementById("imageBtn");
const imageInput = document.getElementById("imageInput");

let map = null;
let userLat = null;
let userLon = null;
let loaded = false;

// 🔑 Placement state
let PLACE_MODE = null;        // "cube" | "image"
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

  L.marker([lat, lon])
    .addTo(map)
    .bindPopup("You are here")
    .openPopup();

  // ✅ MAP CLICK = PLACE LOCATION
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
      imageInput.click(); // wait for image selection
    }
  });
}

// ================================
// GET GPS LOCATION
// ================================
navigator.geolocation.getCurrentPosition(
  position => {
    userLat = position.coords.latitude;
    userLon = position.coords.longitude;
    initMap(userLat, userLon);
    loadObjects();
  },
  error => {
    alert("GPS permission is required to use this app.");
    console.error(error);
  },
  { enableHighAccuracy: true }
);

// ================================
// BUTTONS (MODE ONLY)
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
// IMAGE SELECTION
// ================================
imageInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file || PENDING_LAT === null) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    placeObject(PENDING_LAT, PENDING_LON, "image", data.url);
    resetPlacement();
  } catch (err) {
    console.error(err);
    alert("Image upload failed");
  }
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
      type: type,
      asset: asset,
      owner: OWNER_ID
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("Place failed");
      return res.json();
    })
    .then(obj => renderObject(obj))
    .catch(err => {
      console.error(err);
      alert("Failed to place object");
    });
}

// ================================
// RENDER OBJECT (AR + MAP)
// ================================
function renderObject(obj) {
  let el;

  if (obj.type === "cube") {
    el = document.createElement("a-box");
    el.setAttribute("scale", "0.4 0.4 0.4");
    el.setAttribute("color", "red");
  }
  else if (obj.type === "image" && obj.asset) {
    el = document.createElement("a-plane");
    el.setAttribute("src", obj.asset);
    el.setAttribute("width", "1");
    el.setAttribute("height", "1");
  }
  else {
    return;
  }

  el.dataset.id = obj.id;

  el.setAttribute(
    "gps-entity-place",
    `latitude:${obj.latitude}; longitude:${obj.longitude}`
  );

  scene.appendChild(el);

  // Freeze object after first GPS placement
  el.addEventListener(
    "gps-entity-place-update-position",
    () => {
      const pos = el.object3D.position.clone();
      el.removeAttribute("gps-entity-place");
      el.object3D.position.copy(pos);
      el.object3D.position.y = -0.3;
    },
    { once: true }
  );

  // MAP MARKER
  const marker = L.marker([obj.latitude, obj.longitude]).addTo(map);

  if (obj.owner === OWNER_ID) {
    marker.bindPopup(
      `<button style="padding:8px;font-size:14px"
        onclick="deleteObj('${obj.id}')">
        🗑 Delete
      </button>`
    );
  } else {
    marker.bindPopup("Shared object");
  }
}

// ================================
// DELETE OBJECT (OWNER ONLY)
// ================================
window.deleteObj = function (id) {
  fetch(`/delete/${id}?owner=${OWNER_ID}`, {
    method: "DELETE"
  })
    .then(res => {
      if (!res.ok) throw new Error("Delete failed");

      const el = document.querySelector(`[data-id="${id}"]`);
      if (el) el.remove();

      alert("Object deleted");
    })
    .catch(err => {
      console.error(err);
      alert("Failed to delete object");
    });
};

// ================================
// LOAD ALL OBJECTS (ONCE)
// ================================
function loadObjects() {
  if (loaded) return;
  loaded = true;

  fetch("/objects")
    .then(res => res.json())
    .then(objects => {
      objects.forEach(renderObject);
    })
    .catch(err => console.error(err));
}

// ================================
// RESET PLACEMENT STATE
// ================================
function resetPlacement() {
  PLACE_MODE = null;
  PENDING_LAT = null;
  PENDING_LON = null;
}


// ================================
// DRAG TO RESIZE MAP (TOUCH + MOUSE)
// ================================
const mapEl = document.getElementById("map");
const resizer = document.getElementById("map-resizer");

let resizing = false;
let startX, startY, startWidth, startHeight;

// START DRAG
const startResize = (e) => {
  e.preventDefault();
  resizing = true;

  const touch = e.touches ? e.touches[0] : e;
  startX = touch.clientX;
  startY = touch.clientY;

  startWidth = mapEl.offsetWidth;
  startHeight = mapEl.offsetHeight;

  document.addEventListener("mousemove", resizeMap);
  document.addEventListener("mouseup", stopResize);
  document.addEventListener("touchmove", resizeMap);
  document.addEventListener("touchend", stopResize);
};

// RESIZE
const resizeMap = (e) => {
  if (!resizing) return;

  const touch = e.touches ? e.touches[0] : e;

  const dx = touch.clientX - startX;
  const dy = touch.clientY - startY;

  let newWidth = startWidth + dx;
  let newHeight = startHeight + dy;

  // Limits (important for mobile)
  newWidth = Math.max(150, Math.min(window.innerWidth - 20, newWidth));
  newHeight = Math.max(150, Math.min(window.innerHeight - 120, newHeight));

  mapEl.style.width = `${newWidth}px`;
  mapEl.style.height = `${newHeight}px`;

  if (map) map.invalidateSize();
};

// STOP DRAG
const stopResize = () => {
  resizing = false;
  document.removeEventListener("mousemove", resizeMap);
  document.removeEventListener("mouseup", stopResize);
  document.removeEventListener("touchmove", resizeMap);
  document.removeEventListener("touchend", stopResize);
};

resizer.addEventListener("mousedown", startResize);
resizer.addEventListener("touchstart", startResize);
