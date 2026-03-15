/**
 * Tests for solarWindService.
 */
const solarWindService = require('../services/solarWindService');

describe('solarWindService', () => {
  describe('computeNewellCoupling', () => {
    it('should return 0 when Bt is 0', () => {
      expect(solarWindService.computeNewellCoupling(0, 0, 400)).toBe(0);
    });

    it('should return 0 when speed is 0', () => {
      expect(solarWindService.computeNewellCoupling(-5, 3, 0)).toBe(0);
    });

    it('should return a positive value for southward Bz', () => {
      const coupling = solarWindService.computeNewellCoupling(-10, 5, 400);
      expect(coupling).toBeGreaterThan(0);
    });

    it('should increase with higher speed', () => {
      const slow = solarWindService.computeNewellCoupling(-5, 3, 300);
      const fast = solarWindService.computeNewellCoupling(-5, 3, 600);
      expect(fast).toBeGreaterThan(slow);
    });

    it('should increase with larger Bt', () => {
      const weak = solarWindService.computeNewellCoupling(-2, 1, 400);
      const strong = solarWindService.computeNewellCoupling(-10, 5, 400);
      expect(strong).toBeGreaterThan(weak);
    });
  });

  describe('computePropagationDelay', () => {
    it('should return delay in seconds', () => {
      const delay = solarWindService.computePropagationDelay(400);
      // 1.5e6 / 400 = 3750 seconds
      expect(delay).toBe(3750);
    });

    it('should return null for zero speed', () => {
      expect(solarWindService.computePropagationDelay(0)).toBeNull();
    });

    it('should return null for null speed', () => {
      expect(solarWindService.computePropagationDelay(null)).toBeNull();
    });

    it('should decrease with higher speed', () => {
      const slow = solarWindService.computePropagationDelay(300);
      const fast = solarWindService.computePropagationDelay(600);
      expect(fast).toBeLessThan(slow);
    });
  });

  describe('checkBzThreshold', () => {
    it('should return null when Bz is above threshold', () => {
      expect(solarWindService.checkBzThreshold(0)).toBeNull();
      expect(solarWindService.checkBzThreshold(-5)).toBeNull();
    });

    it('should return alert when Bz is below threshold', () => {
      const alert = solarWindService.checkBzThreshold(-10);
      expect(alert).not.toBeNull();
      expect(alert.type).toBe('BZ_SOUTHWARD');
      expect(alert.severity).toBe('warning');
    });

    it('should return critical for very strong southward Bz', () => {
      const alert = solarWindService.checkBzThreshold(-20);
      expect(alert.severity).toBe('critical');
    });

    it('should return null for null Bz', () => {
      expect(solarWindService.checkBzThreshold(null)).toBeNull();
    });
  });

  describe('checkSpeedThreshold', () => {
    it('should return null when speed is below threshold', () => {
      expect(solarWindService.checkSpeedThreshold(300)).toBeNull();
      expect(solarWindService.checkSpeedThreshold(500)).toBeNull();
    });

    it('should return alert when speed exceeds threshold', () => {
      const alert = solarWindService.checkSpeedThreshold(600);
      expect(alert).not.toBeNull();
      expect(alert.type).toBe('HIGH_SPEED');
    });

    it('should return critical for very high speed', () => {
      const alert = solarWindService.checkSpeedThreshold(800);
      expect(alert.severity).toBe('critical');
    });

    it('should return null for null speed', () => {
      expect(solarWindService.checkSpeedThreshold(null)).toBeNull();
    });
  });

  describe('detectSubstorm', () => {
    it('should return null for empty history', () => {
      expect(solarWindService.detectSubstorm([])).toBeNull();
    });

    it('should return null for insufficient data', () => {
      expect(solarWindService.detectSubstorm([{ timestamp: 1000, bz: -5 }])).toBeNull();
    });

    it('should detect sustained high dBz/dt (southward turning)', () => {
      // Create 6 minutes of data with southward turning rate > 2 nT/min
      const history = [];
      const baseTime = Date.now() - 10 * 60 * 1000;
      for (let i = 0; i <= 6; i++) {
        history.push({
          timestamp: baseTime + i * 60 * 1000,
          bz: -i * 3, // 3 nT/min southward turning rate
        });
      }

      const alert = solarWindService.detectSubstorm(history);
      expect(alert).not.toBeNull();
      expect(alert.type).toBe('SUBSTORM_PRECURSOR');
    });

    it('should not alert for brief rate increases', () => {
      // Only 2 minutes of high rate
      const baseTime = Date.now();
      const history = [
        { timestamp: baseTime, bz: 0 },
        { timestamp: baseTime + 60000, bz: -5 },
        { timestamp: baseTime + 120000, bz: -10 },
        { timestamp: baseTime + 180000, bz: -10 }, // rate drops
        { timestamp: baseTime + 240000, bz: -10 },
      ];

      const alert = solarWindService.detectSubstorm(history);
      expect(alert).toBeNull();
    });
  });
});
