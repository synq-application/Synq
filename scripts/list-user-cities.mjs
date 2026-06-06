import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROJECT_ID = "new-synq-main";
const FIREBASE_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";

function loadFirebaseCliTokens() {
  const configPath = join(homedir(), ".config", "configstore", "firebase-tools.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (!config?.tokens?.refresh_token) {
    throw new Error("No Firebase CLI tokens found. Run: firebase login");
  }
  return config.tokens;
}

async function getAccessToken(tokens) {
  if (tokens.access_token && tokens.expires_at > Date.now() + 60_000) {
    return tokens.access_token;
  }

  const body = new URLSearchParams({
    client_id: FIREBASE_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}). Run: firebase login`);
  }

  const data = await res.json();
  return data.access_token;
}

function fieldString(fields, key) {
  const value = fields?.[key];
  if (!value) return "";
  if (typeof value.stringValue === "string") return value.stringValue.trim();
  return "";
}

function formatCityLabel(city, state, locationDisplay) {
  if (locationDisplay) return locationDisplay;
  if (!city) return "";
  return state ? `${city}, ${state}` : city;
}

async function fetchAllUsers(accessToken) {
  const users = [];
  let pageToken = "";

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firestore query failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    if (Array.isArray(data.documents)) {
      users.push(...data.documents);
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return users;
}

const tokens = loadFirebaseCliTokens();
const accessToken = await getAccessToken(tokens);
const documents = await fetchAllUsers(accessToken);

const cityCounts = new Map();
let withLocation = 0;
let withoutLocation = 0;

for (const doc of documents) {
  const fields = doc.fields || {};
  const city = fieldString(fields, "city");
  const state = fieldString(fields, "state");
  const locationDisplay = fieldString(fields, "locationDisplay");
  const label = formatCityLabel(city, state, locationDisplay);

  if (!label) {
    withoutLocation++;
    continue;
  }

  withLocation++;
  const key = label
    .toLowerCase()
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ");

  const existing = cityCounts.get(key);
  if (existing) {
    existing.count++;
    if (!existing.display && label) existing.display = label;
  } else {
    cityCounts.set(key, { display: label, count: 1 });
  }
}

const sorted = [...cityCounts.values()].sort((a, b) => {
  if (b.count !== a.count) return b.count - a.count;
  return a.display.localeCompare(b.display);
});

console.log(`Total users: ${documents.length}`);
console.log(`With location: ${withLocation}`);
console.log(`Without location: ${withoutLocation}`);
console.log(`Unique cities: ${sorted.length}`);
console.log("");
console.log("City (user count)");
console.log("----------------");

for (const row of sorted) {
  console.log(`${row.display} (${row.count})`);
}
