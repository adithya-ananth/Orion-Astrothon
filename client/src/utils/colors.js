/**
 * Color ramp for aurora probability (0–100).
 * transparent → green → yellow → red → magenta
 */
export function auroraProbabilityColor(prob) {
  if (prob <= 0) return 'rgba(0,0,0,0)';
  if (prob <= 20) {
    const t = prob / 20;
    return `rgba(0, ${Math.round(200 * t)}, ${Math.round(50 * t)}, ${(0.3 * t).toFixed(2)})`;
  }
  if (prob <= 50) {
    const t = (prob - 20) / 30;
    const g = Math.round(200 + 55 * t);
    const r = Math.round(200 * t);
    return `rgba(${r}, ${g}, 0, 0.5)`;
  }
  if (prob <= 80) {
    const t = (prob - 50) / 30;
    const g = Math.round(255 * (1 - t));
    return `rgba(${Math.round(200 + 55 * t)}, ${g}, 0, 0.65)`;
  }
  const t = (prob - 80) / 20;
  return `rgba(255, ${Math.round(30 * t)}, ${Math.round(200 * t)}, 0.8)`;
}

/** Kp index color: green (0-3), yellow (4-5), red (6-7), magenta (8-9) */
export function kpColor(kp) {
  if (kp <= 3) return '#00ff88';
  if (kp <= 5) return '#ffdd00';
  if (kp <= 7) return '#ff4444';
  return '#ff44ff';
}

/** Visibility score color: red (0-30), yellow (30-60), green (60-100) */
export function scoreColor(score) {
  if (score < 30) return '#ff4444';
  if (score < 60) return '#ffdd00';
  return '#00ff88';
}

/** Bz indicator color */
export function bzColor(bz) {
  if (bz > 0) return '#00ff88';
  if (bz >= -5) return '#ffdd00';
  return '#ff4444';
}

/** Solar wind speed color */
export function speedColor(speed) {
  if (speed < 400) return '#00ff88';
  if (speed <= 500) return '#ffdd00';
  return '#ff4444';
}

/** Freshness indicator: seconds since last update */
export function freshnessColor(secondsAgo) {
  if (secondsAgo < 120) return '#00ff88';
  if (secondsAgo < 600) return '#ffdd00';
  return '#ff4444';
}
