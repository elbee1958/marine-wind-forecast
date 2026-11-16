# Marine Wind Forecast — public PWA edition

A mobile-friendly Progressive Web App (PWA) backed by an Express server. It uses the OpenWeather Geocoding API and the standard 5-day / 3-hour forecast endpoint (not One Call 3.0).

## What it does
- Search by town and country, or enter latitude and longitude.
- Enter the bearing from the reference point toward the sea (degrees clockwise from north).
- Calculates forecast points at 1, 6 and 12 nautical miles offshore.
- Shows wind direction, wind speed and gusts in knots, plus air temperature in °C.
- Works on desktop and mobile. Once deployed over HTTPS, users can add it to their phone's home screen.

## Important marine limitations
The reference point should be on or very close to the shoreline. Town geocoding commonly returns a town centre. The app does not identify coastlines, decide which direction is sea, or verify that the calculated points are over water. OpenWeather's standard forecast is atmospheric weather data, not a dedicated marine forecast. This is not a certified navigation or safety product; verify forecasts and positions before sailing.

## Deploy publicly on Render
The included `render.yaml` describes a public Render Web Service. Render provides an `onrender.com` address and HTTPS. The free service may sleep after inactivity and take a short time to wake when a visitor opens it.

### 1. Create a GitHub repository
1. Sign in to GitHub and create a **new public repository**, for example `marine-wind-forecast`.
2. Upload the contents of this folder to the repository's main branch.
3. **Do not upload `.env` or your OpenWeather key.** This deployment package intentionally does not contain `.env`; `.gitignore` also excludes it.

### 2. Deploy on Render
1. Create/sign in to an account at https://render.com.
2. Choose **New → Blueprint** (or create a Web Service and connect the GitHub repository).
3. Select the `marine-wind-forecast` repository. Render reads `render.yaml` and creates the web service.
4. When prompted for `OPENWEATHER_API_KEY`, enter your OpenWeather API key as a secret environment variable. Do not put it in source files or GitHub.
5. Deploy. Render will provide a public URL similar to `https://marine-wind-forecast.onrender.com`.

If using **New → Web Service** instead of Blueprint, set:
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `OPENWEATHER_API_KEY` = your key
- Health check path: `/health`

### 3. Install on a phone
Open the public HTTPS address in Chrome on Android, then use the browser menu → **Install app** or **Add to Home screen**. On iPhone, open the address in Safari → Share → **Add to Home Screen**.

## Local testing on Windows
1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env` and add your OpenWeather key.
3. In this folder, open Command Prompt and run `npm install`, then `npm start`.
4. Visit http://localhost:3000.

## API usage protection
The server applies simple per-IP request limits and caches identical forecast requests for 10 minutes. The limits/cache are in-memory and reset on restart; they are suitable as a basic safeguard for a small public app, not a substitute for a shared rate-limit store under heavy traffic. Keep an eye on OpenWeather usage and billing limits.

## Data and units
- Geocoding: `https://api.openweathermap.org/geo/1.0/direct`
- Forecast: `https://api.openweathermap.org/data/2.5/forecast`
- Wind conversion: m/s × 1.943844 = knots
- Temperature: Celsius
- Forecast interval: 3 hours; horizon: up to 5 days
- Gusts may be absent in some forecast entries.
