const BASE = process.env.REACT_APP_API_URL || '';

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
  return request('/api/solar-wind/latest').then(r => r.data || r);
}

export function fetchOvation() {
  return request('/api/ovation/latest').then(r => r.data || r);
}

export function fetchVisibility(lat, lon) {
  return request(`/api/visibility/score?lat=${lat}&lon=${lon}`).then(r => r.data || r);
}

export function fetchForecast3Day() {
  return request('/api/forecast/3day').then(r => r.data || r);
}

export function fetchPointVisibility(lat, lon) {
  return request(`/api/visibility/score?lat=${lat}&lon=${lon}`).then(r => r.data || r);
}

export function fetchKpIndex() {
  return request('/api/forecast/kp').then(r => r.data || r);
}

export function subscribeNotifications(lat, lon, email, threshold) {
  return request('/api/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify({ lat, lon, email, threshold }),
  }).then(r => r.data || r);
}

export function unsubscribeNotifications(subscriberId) {
  return request(`/api/notifications/unsubscribe/${subscriberId}`, {
    method: 'DELETE',
  });
}
