/**
 * Tests for astronomy utility functions.
 */
const astronomy = require('../utils/astronomy');

describe('astronomy', () => {
  describe('solarPosition', () => {
    it('should return altitude and azimuth', () => {
      const result = astronomy.solarPosition(51.5, -0.1, new Date(Date.UTC(2024, 5, 21, 12, 0, 0)));
      expect(result).toHaveProperty('altitude');
      expect(result).toHaveProperty('azimuth');
      expect(typeof result.altitude).toBe('number');
      expect(typeof result.azimuth).toBe('number');
    });

    it('should show high sun altitude at summer solstice noon in London', () => {
      // June 21 at noon UTC, London - sun should be high
      const result = astronomy.solarPosition(51.5, -0.1, new Date(Date.UTC(2024, 5, 21, 12, 0, 0)));
      expect(result.altitude).toBeGreaterThan(50);
    });

    it('should show low/negative sun altitude at midnight in London', () => {
      // June 21 at midnight UTC, London
      const result = astronomy.solarPosition(51.5, -0.1, new Date(Date.UTC(2024, 5, 21, 0, 0, 0)));
      expect(result.altitude).toBeLessThan(10);
    });

    it('should show negative sun altitude at winter night in Tromsø', () => {
      // January 15 at noon UTC, Tromsø (69.6°N) - polar night
      const result = astronomy.solarPosition(69.6, 19.0, new Date(Date.UTC(2024, 0, 15, 12, 0, 0)));
      expect(result.altitude).toBeLessThan(5);
    });
  });

  describe('lunarPhase', () => {
    it('should return illumination between 0 and 1', () => {
      const result = astronomy.lunarPhase(new Date());
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should be near 0 at known new moon', () => {
      // New moon: January 11, 2024
      const result = astronomy.lunarPhase(new Date(Date.UTC(2024, 0, 11, 11, 0, 0)));
      expect(result).toBeLessThan(0.05);
    });

    it('should be near 1 at known full moon', () => {
      // Full moon: January 25, 2024
      const result = astronomy.lunarPhase(new Date(Date.UTC(2024, 0, 25, 17, 54, 0)));
      expect(result).toBeGreaterThan(0.95);
    });

    it('should vary over a month', () => {
      const phase1 = astronomy.lunarPhase(new Date(Date.UTC(2024, 0, 11)));
      const phase2 = astronomy.lunarPhase(new Date(Date.UTC(2024, 0, 18)));
      const phase3 = astronomy.lunarPhase(new Date(Date.UTC(2024, 0, 25)));
      // Phases should change over the month
      expect(phase2).not.toEqual(phase1);
      expect(phase3).not.toEqual(phase2);
    });
  });

  describe('isAstronomicalTwilight', () => {
    it('should return true during deep night at high latitude winter', () => {
      // Tromsø, winter midnight
      const result = astronomy.isAstronomicalTwilight(
        69.6, 19.0,
        new Date(Date.UTC(2024, 0, 15, 0, 0, 0))
      );
      expect(result).toBe(true);
    });

    it('should return false during daytime', () => {
      // London, summer noon
      const result = astronomy.isAstronomicalTwilight(
        51.5, -0.1,
        new Date(Date.UTC(2024, 5, 21, 12, 0, 0))
      );
      expect(result).toBe(false);
    });
  });

  describe('dayNightTerminator', () => {
    it('should return an array of points', () => {
      const points = astronomy.dayNightTerminator(new Date());
      expect(Array.isArray(points)).toBe(true);
      expect(points.length).toBeGreaterThan(0);
    });

    it('should return points with lat and lon properties', () => {
      const points = astronomy.dayNightTerminator(new Date());
      expect(points[0]).toHaveProperty('lat');
      expect(points[0]).toHaveProperty('lon');
    });

    it('should span longitudes', () => {
      const points = astronomy.dayNightTerminator(new Date());
      const lons = points.map(p => p.lon);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      expect(maxLon - minLon).toBeGreaterThan(100);
    });
  });

  describe('lunarPosition', () => {
    it('should return altitude and azimuth', () => {
      const result = astronomy.lunarPosition(51.5, -0.1, new Date());
      expect(result).toHaveProperty('altitude');
      expect(result).toHaveProperty('azimuth');
    });
  });

  describe('utility functions', () => {
    it('normalizeDeg should wrap angles to [0, 360)', () => {
      expect(astronomy.normalizeDeg(0)).toBe(0);
      expect(astronomy.normalizeDeg(360)).toBe(0);
      expect(astronomy.normalizeDeg(-90)).toBe(270);
      expect(astronomy.normalizeDeg(450)).toBe(90);
    });

    it('toJulianDate should compute known values', () => {
      // J2000.0 epoch: January 1, 2000, 12:00 TT ≈ 2451545.0
      const j2000 = astronomy.toJulianDate(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)));
      expect(Math.abs(j2000 - 2451545.0)).toBeLessThan(0.01);
    });
  });
});
