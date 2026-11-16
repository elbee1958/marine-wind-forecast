
import express from "express";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENWEATHER_API_KEY;
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.static("public", { maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));
app.use(express.json());

app.use(['/api/geocode', '/api/forecast'], (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Lightweight in-memory request throttling for a public demo app.
// Limits reset when the service restarts; use a shared store for high-traffic production.
const requestWindows = new Map();
function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const recent = (requestWindows.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: message });
    recent.push(now);
    requestWindows.set(key, recent);
    next();
  };
}
const limitGeocode = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: "Too many location searches. Please wait a few minutes." });
const limitForecast = rateLimit({ windowMs: 60 * 60 * 1000, max: 12, message: "Forecast request limit reached for this hour. Please try again later." });
const forecastCache = new Map();

const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

// Great-circle destination. Distance is nautical miles.
function destination(lat, lon, bearingDeg, distanceNm) {
  const R = 3440.065; // Earth radius in nautical miles
  const brng = toRad(bearingDeg);
  const d = distanceNm / R;
  const p1 = toRad(lat), l1 = toRad(lon);
  const p2 = Math.asin(Math.sin(p1)*Math.cos(d) + Math.cos(p1)*Math.sin(d)*Math.cos(brng));
  const l2 = l1 + Math.atan2(Math.sin(brng)*Math.sin(d)*Math.cos(p1),
    Math.cos(d)-Math.sin(p1)*Math.sin(p2));
  return { lat: p2 * 180 / Math.PI, lon: ((l2 * 180 / Math.PI + 540) % 360) - 180 };
}

app.get("/api/geocode", limitGeocode, async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: "OpenWeather API key is not configured on the server." });
    const q = String(req.query.q || "").trim().slice(0, 120);
    if (!q) return res.status(400).json({ error: "Enter a town and country." });
    const url = new URL("https://api.openweathermap.org/geo/1.0/direct");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "5");
    url.searchParams.set("appid", API_KEY);
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || "Geocoding failed." });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/forecast", limitForecast, async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: "OpenWeather API key is missing. Add it to the .env file." });
    const lat = Number(req.query.lat), lon = Number(req.query.lon);
    const bearing = Number(req.query.bearing);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180)
      return res.status(400).json({ error: "Valid latitude and longitude are required." });
    if (!Number.isFinite(bearing) || bearing<0 || bearing>359)
      return res.status(400).json({ error: "Enter an offshore bearing from 0 to 359 degrees." });

    const cacheKey = [lat.toFixed(4), lon.toFixed(4), bearing].join(":");
    const cached = forecastCache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < 10 * 60 * 1000) return res.json(cached.data);
    const points = [1, 6, 12].map(nm => ({ distanceNm: nm, ...destination(lat, lon, bearing, nm) }));
    const results = await Promise.all(points.map(async p => {
      // Free 5-day / 3-hour forecast endpoint (does not require One Call 3.0 subscription).
      const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
      url.searchParams.set("lat", p.lat);
      url.searchParams.set("lon", p.lon);
      url.searchParams.set("units", "metric");
      url.searchParams.set("appid", API_KEY);
      const r = await fetch(url);
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `Forecast failed for ${p.distanceNm} NM point.`);
      return {
        ...p,
        timezoneOffset: data.city?.timezone ?? 0,
        forecast: (data.list || []).map(item => ({
          dt: item.dt,
          tempC: item.main?.temp,
          windKnots: (item.wind?.speed ?? 0) * 1.943844,
          gustKnots: item.wind?.gust == null ? null : item.wind.gust * 1.943844,
          windDeg: item.wind?.deg ?? 0,
          description: item.weather?.[0]?.description || ""
        }))
      };
    }));
    const response = { points: results, units: { wind: "knots", temperature: "°C" }, intervalHours: 3, horizonDays: 5 };
    forecastCache.set(cacheKey, { savedAt: Date.now(), data: response });
    res.json(response);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, "0.0.0.0", () => console.log(`Marine forecast app listening on port ${PORT}`));
