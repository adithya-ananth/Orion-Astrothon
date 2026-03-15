
// Debounce helper for slider
let debounceTimer;
export function debounceSubscribe(lat, lon, email, threshold) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    import("./api").then(api => api.subscribeNotifications(lat, lon, email, threshold).catch(console.error));
  }, 500);
}

