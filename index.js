const express = require("express");

const KINDROID_BASE = "https://api.kindroid.ai/v1";
const app = express();

app.use(express.json());

function requiredEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

const CONFIG = {
  kindroidKey: requiredEnv("KINDROID_API_KEY"),
  aiId: requiredEnv("KINDROID_AI_ID"),
};

// In-memory state.
// Fine for testing, but resets if Railway restarts.
let lastKnownLocation = null;

const fs = require("fs");
const path = require("path");

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseLocationMappings() {
  const filePath = path.join(__dirname, "places.csv");

  if (!fs.existsSync(filePath)) {
    console.warn("places.csv not found. No locations loaded.");
    return [];
  }

  const csv = fs.readFileSync(filePath, "utf8");
  const lines = csv
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));

  const header = parseCsvLine(lines.shift()).map(h => h.toLowerCase());

  const nameIndex = header.indexOf("name");
  const latIndex = header.indexOf("latitude");
  const lonIndex = header.indexOf("longitude");
  const radiusIndex = header.indexOf("radius_meters");

  const mappings = [];

  for (const line of lines) {
    const cols = parseCsvLine(line);

    const name = cols[nameIndex];
    const lat = parseFloat(cols[latIndex]);
    const lon = parseFloat(cols[lonIndex]);
    const radius = parseFloat(cols[radiusIndex] || "300");

    if (!name || isNaN(lat) || isNaN(lon)) {
      console.warn(`Skipping invalid CSV row: ${line}`);
      continue;
    }

    mappings.push({ name, lat, lon, radius });
    console.log(`Loaded location: ${name} at ${lat}, ${lon}, radius ${radius}m`);
  }

  return mappings;
}
const LOCATION_MAPPINGS = parseLocationMappings();

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findKnownLocation(lat, lon) {
  for (const loc of LOCATION_MAPPINGS) {
    const distance = distanceMeters(lat, lon, loc.lat, loc.lon);
    if (distance <= loc.radius) {
      return loc.name;
    }
  }

  return null;
}

function buildLocationMessage(currentLocation) {
  if (currentLocation === lastKnownLocation) {
    return null; // duplicate, do not send
  }

  let message;

  if (currentLocation && !lastKnownLocation) {
    message = `** AUTO LOCATION UPDATE: Hey babe, Christian has arrived at ${currentLocation}`;
  } else if (!currentLocation && lastKnownLocation) {
    message = `** AUTO LOCATION UPDATE: Hey babe, Christian has left ${lastKnownLocation}`;
  } else if (currentLocation && lastKnownLocation) {
    message = `** AUTO LOCATION UPDATE: Hey babe, Christian has moved from ${lastKnownLocation} to ${currentLocation}`;
  } else {
    message = null;
  }

  lastKnownLocation = currentLocation;
  return message;
}

async function sendMessage(text) {
  const res = await fetch(`${KINDROID_BASE}/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.kindroidKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ai_id: CONFIG.aiId,
      message: text,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Kindroid API ${res.status}: ${await res.text()}`);
  }
}

app.post("/api/log-location", async (req, res) => {
  const ts = new Date().toISOString();

  const latitude = parseFloat(req.body.latitude);
  const longitude = parseFloat(req.body.longitude);

  console.log(`[${ts}] Raw body:`, JSON.stringify(req.body));
  console.log(`[${ts}] Location ping: ${latitude}, ${longitude}`);

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({
      error: "Missing or invalid latitude/longitude",
    });
  }

  try {
    const currentLocation = findKnownLocation(latitude, longitude);
    const message = buildLocationMessage(currentLocation);

    if (!message) {
      console.log(`[${ts}] No change. Last location: ${lastKnownLocation || "unknown"}`);
      return res.json({
        success: true,
        sent: false,
        reason: "No location change",
        currentLocation,
      });
    }

    await sendMessage(message);

    console.log(`[${ts}] Sent message: "${message}"`);

    res.json({
      success: true,
      sent: true,
      message,
      currentLocation,
    });
  } catch (err) {
    console.error(`[${ts}] Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "kinlife360",
    mappings: LOCATION_MAPPINGS.length,
    lastKnownLocation,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Location logger listening on port ${PORT}`);
  console.log(`Loaded ${LOCATION_MAPPINGS.length} location mappings`);
});
