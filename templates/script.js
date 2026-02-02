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
// PLACE CUBE BUTTON
// ================================
cubeBtn.onclick = () => {
  if (userLat === null || userLon === null) {
    alert("Waiting for GPS...");
    return;
  }
  placeObject(userLat, userLon, "cube", null);
};

// ================================
// PLACE IMAGE BUTTON
// ================================
imageBtn.onclick = () => {
  if (userLat === null || userLon === null) {
    alert("Waiting for GPS...");
    return;
  }
  imageInput.click();
};

// ================================
// IMAGE SELECTION
// ================================
imageInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    placeObject(userLat, userLon, "image", data.url);
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
      asset: asset,   // always present (null or URL)
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

      // Remove AR entity
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
