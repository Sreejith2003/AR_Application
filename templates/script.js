const scene = document.querySelector("a-scene");
const cubeBtn = document.getElementById("cubeBtn");
const imageBtn = document.getElementById("imageBtn");
const imageInput = document.getElementById("imageInput");

let map, userLat, userLon;
let loaded = false;

// OWNER ID
let OWNER_ID = localStorage.getItem("ar_owner_id");
if (!OWNER_ID) {
  OWNER_ID = crypto.randomUUID();
  localStorage.setItem("ar_owner_id", OWNER_ID);
}

// MAP
function initMap(lat, lon) {
  map = L.map("map").setView([lat, lon], 18);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  L.marker([lat, lon]).addTo(map).bindPopup("You").openPopup();
}

// GPS
navigator.geolocation.getCurrentPosition(
  pos => {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
    initMap(userLat, userLon);
    loadObjects();
  },
  () => alert("GPS permission required"),
  { enableHighAccuracy: true }
);

// PLACE CUBE
cubeBtn.onclick = () => {
  placeObject(userLat, userLon, "cube", null);
};

// IMAGE UPLOAD
imageBtn.onclick = () => imageInput.click();

imageInput.onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/upload", { method: "POST", body: fd });
  const data = await res.json();

  placeObject(userLat, userLon, "image", data.url);
};

// PLACE OBJECT
function placeObject(lat, lon, type, asset) {
  fetch("/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: lat,
      longitude: lon,
      type: type,
      asset: asset,   // ✅ ALWAYS PRESENT (null or URL)
      owner: OWNER_ID
    })
  })
    .then(res => res.json())
    .then(renderObject)
    .catch(err => {
      console.error(err);
      alert("Place failed");
    });
}

// RENDER OBJECT
function renderObject(obj) {
  let el;

  if (obj.type === "cube") {
    el = document.createElement("a-box");
    el.setAttribute("scale", "0.4 0.4 0.4");
    el.setAttribute("color", "red");
  } else if (obj.type === "image" && obj.asset) {
    el = document.createElement("a-plane");
    el.setAttribute("src", obj.asset);
    el.setAttribute("width", "1");
    el.setAttribute("height", "1");
  } else {
    return;
  }

  el.dataset.id = obj.id;
  el.setAttribute(
    "gps-entity-place",
    `latitude:${obj.latitude}; longitude:${obj.longitude}`
  );

  scene.appendChild(el);

  el.addEventListener("gps-entity-place-update-position", () => {
    const p = el.object3D.position.clone();
    el.removeAttribute("gps-entity-place");
    el.object3D.position.copy(p);
    el.object3D.position.y = -0.3;
  }, { once: true });

  const marker = L.marker([obj.latitude, obj.longitude]).addTo(map);
  if (obj.owner === OWNER_ID) {
    marker.bindPopup(`<button onclick="deleteObj('${obj.id}')">Delete</button>`);
  }
}

// DELETE
window.deleteObj = id => {
  fetch(`/delete/${id}?owner=${OWNER_ID}`, { method: "DELETE" })
    .then(() => {
      const el = document.querySelector(`[data-id="${id}"]`);
      if (el) el.remove();
      alert("Deleted");
    });
};

// LOAD OBJECTS
function loadObjects() {
  if (loaded) return;
  loaded = true;

  fetch("/objects")
    .then(res => res.json())
    .then(list => list.forEach(renderObject));
}
