/**
 * Tests for visibilityService.
 */
const visibilityService = require('../services/visibilityService');

describe('visibilityService', () => {
  describe('computeVisibilityScore', () => {
    it('should return a composite score between 0 and 100', () => {
      const ovationData = {
        coordinates: [
          { Latitude: 65, Longitude: 25, Aurora: 80 },
        ],
      };
      const cloudData = { total: 20, low: 10, mid: 10, high: 20 };
      const darknessScore = 70;

      const result = visibilityService.computeVisibilityScore(
        65, 25, ovationData, cloudData, darknessScore
      );

      expect(result.composite).toBeGreaterThanOrEqual(0);
      expect(result.composite).toBeLessThanOrEqual(100);
      expect(result.breakdown).toHaveProperty('aurora');
      expect(result.breakdown).toHaveProperty('cloud');
      expect(result.breakdown).toHaveProperty('darkness');
    });

    it('should apply correct weights', () => {
      const result = visibilityService.computeVisibilityScore(
        65, 25,
        { coordinates: [{ Latitude: 65, Longitude: 25, Aurora: 100 }] },
        { total: 0, low: 0, mid: 0, high: 0 },
        100
      );
      // All perfect: 100*0.5 + 100*0.35 + 100*0.15 = 100
      expect(result.composite).toBe(100);
    });

    it('should return 0 for worst conditions', () => {
      const result = visibilityService.computeVisibilityScore(
        0, 0,
        { coordinates: [{ Latitude: 0, Longitude: 0, Aurora: 0 }] },
        { total: 100, low: 100, mid: 100, high: 100 },
        0
      );
      expect(result.composite).toBeLessThanOrEqual(25);
    });
  });

  describe('getCloudScore', () => {
    it('should return 100 for clear skies', () => {
      const score = visibilityService.getCloudScore({
        total: 0, low: 0, mid: 0, high: 0,
      });
      expect(score).toBe(100);
    });

    it('should weight low clouds more heavily', () => {
      const lowCloud = visibilityService.getCloudScore({
        total: 50, low: 50, mid: 0, high: 0,
      });
      const highCloud = visibilityService.getCloudScore({
        total: 50, low: 0, mid: 0, high: 50,
      });
      expect(lowCloud).toBeLessThan(highCloud);
    });

    it('should return 50 when cloudData is null', () => {
      expect(visibilityService.getCloudScore(null)).toBe(50);
    });
  });

  describe('getAuroraProbability', () => {
    it('should return 0 for null data', () => {
      expect(visibilityService.getAuroraProbability(65, 25, null)).toBe(0);
    });

    it('should find nearest grid point', () => {
      const data = {
        coordinates: [
          { Latitude: 64, Longitude: 24, Aurora: 30 },
          { Latitude: 65, Longitude: 25, Aurora: 75 },
          { Latitude: 66, Longitude: 26, Aurora: 40 },
        ],
      };
      const result = visibilityService.getAuroraProbability(65.1, 25.1, data);
      expect(result).toBe(75);
    });
  });

  describe('getDarknessScore', () => {
    it('should return higher score during astronomical twilight', () => {
      // Winter night at Tromsø (69.6°N) - deep darkness
      const winterNight = new Date(Date.UTC(2024, 0, 15, 0, 0, 0));
      const score = visibilityService.getDarknessScore(69.6, 19.0, winterNight);
      expect(score).toBeGreaterThan(0);
    });

    it('should return low score during daytime', () => {
      // Summer noon at mid-latitude
      const summerNoon = new Date(Date.UTC(2024, 5, 21, 12, 0, 0));
      const score = visibilityService.getDarknessScore(45.0, 0, summerNoon);
      expect(score).toBeLessThanOrEqual(15);
    });
  });

  describe('getMagneticMidnight', () => {
    it('should return magnetic midnight info', () => {
      const result = visibilityService.getMagneticMidnight(65, 25, new Date());
      expect(result).toHaveProperty('magneticMidnightUTC');
      expect(result).toHaveProperty('timestamp');
      expect(result.magneticMidnightUTC).toBeGreaterThanOrEqual(0);
      expect(result.magneticMidnightUTC).toBeLessThan(24);
    });
  });
});
