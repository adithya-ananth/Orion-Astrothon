const BASE = '';

async function request(url, options = {}) {
  try {
    const res = await fetch(`${BASE}${url}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`API ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`[API] ${url}:`, err.message);
    throw err;
  }
}

export function fetchSolarWind() {
  return request('/api/solar-wind/latest');
}

export function fetchOvation() {
  return request('/api/ovation/latest');
}

export function fetchVisibility(lat, lon) {
  return request(`/api/visibility/score?lat=${lat}&lon=${lon}`);
}

export function fetchForecast3Day() {
  return request('/api/forecast/3day');
}

export function fetchPointVisibility(lat, lon) {
  return request(`/api/visibility/score?lat=${lat}&lon=${lon}`);
}
