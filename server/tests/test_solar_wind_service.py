"""Tests for solar_wind_service."""

import time

from app.services.solar_wind_service import (
    check_bz_threshold,
    check_ovation_reliability,
    check_speed_threshold,
    compute_newell_coupling,
    compute_propagation_delay,
    detect_substorm,
)


class TestComputeNewellCoupling:
    def test_zero_when_bt_is_zero(self):
        assert compute_newell_coupling(0, 0, 400) == 0

    def test_zero_when_speed_is_zero(self):
        assert compute_newell_coupling(-5, 3, 0) == 0

    def test_positive_for_southward_bz(self):
        coupling = compute_newell_coupling(-10, 5, 400)
        assert coupling > 0

    def test_increases_with_speed(self):
        slow = compute_newell_coupling(-5, 3, 300)
        fast = compute_newell_coupling(-5, 3, 600)
        assert fast > slow

    def test_increases_with_larger_bt(self):
        weak = compute_newell_coupling(-2, 1, 400)
        strong = compute_newell_coupling(-10, 5, 400)
        assert strong > weak


class TestComputePropagationDelay:
    def test_delay_in_seconds(self):
        delay = compute_propagation_delay(400)
        # 1.5e6 / 400 = 3750 seconds
        assert delay == 3750

    def test_null_for_zero_speed(self):
        assert compute_propagation_delay(0) is None

    def test_null_for_none_speed(self):
        assert compute_propagation_delay(None) is None

    def test_decreases_with_higher_speed(self):
        slow = compute_propagation_delay(300)
        fast = compute_propagation_delay(600)
        assert fast < slow


class TestCheckBzThreshold:
    def test_none_when_above_threshold(self):
        assert check_bz_threshold(0) is None
        assert check_bz_threshold(-5) is None

    def test_alert_when_below_threshold(self):
        alert = check_bz_threshold(-10)
        assert alert is not None
        assert alert["type"] == "BZ_SOUTHWARD"
        assert alert["severity"] == "warning"

    def test_critical_for_very_strong_southward(self):
        alert = check_bz_threshold(-20)
        assert alert["severity"] == "critical"

    def test_none_for_null(self):
        assert check_bz_threshold(None) is None


class TestCheckSpeedThreshold:
    def test_none_when_below_threshold(self):
        assert check_speed_threshold(300) is None
        assert check_speed_threshold(500) is None

    def test_alert_when_exceeds_threshold(self):
        alert = check_speed_threshold(600)
        assert alert is not None
        assert alert["type"] == "HIGH_SPEED"

    def test_critical_for_very_high_speed(self):
        alert = check_speed_threshold(800)
        assert alert["severity"] == "critical"

    def test_none_for_null(self):
        assert check_speed_threshold(None) is None


class TestDetectSubstorm:
    def test_none_for_empty_history(self):
        assert detect_substorm([]) is None

    def test_none_for_insufficient_data(self):
        assert detect_substorm([{"timestamp": 1000, "bz": -5}]) is None

    def test_detects_sustained_high_dbzdt(self):
        # Create 6 minutes of data with southward turning rate > 2 nT/min
        history = []
        base_time = time.time() - 10 * 60
        for i in range(7):
            history.append({
                "timestamp": base_time + i * 60,
                "bz": -i * 3,  # 3 nT/min southward turning rate
            })

        alert = detect_substorm(history)
        assert alert is not None
        assert alert["type"] == "SUBSTORM_PRECURSOR"

    def test_no_alert_for_brief_rate_increase(self):
        base_time = time.time()
        history = [
            {"timestamp": base_time, "bz": 0},
            {"timestamp": base_time + 60, "bz": -5},
            {"timestamp": base_time + 120, "bz": -10},
            {"timestamp": base_time + 180, "bz": -10},  # rate drops
            {"timestamp": base_time + 240, "bz": -10},
        ]

        alert = detect_substorm(history)
        assert alert is None


class TestCheckOvationReliability:
    def test_reliable_when_no_history(self):
        result = check_ovation_reliability([])
        assert result["reliable"] is True

    def test_reliable_when_stable_bz(self):
        base_time = time.time()
        history = [
            {"timestamp": base_time, "bz": -5},
            {"timestamp": base_time + 60, "bz": -5.5},
            {"timestamp": base_time + 120, "bz": -5.2},
        ]
        result = check_ovation_reliability(history)
        assert result["reliable"] is True

    def test_unreliable_when_rapid_change(self):
        base_time = time.time()
        history = [
            {"timestamp": base_time, "bz": 0},
            {"timestamp": base_time + 60, "bz": -5},  # 5 nT/min > 2 threshold
        ]
        result = check_ovation_reliability(history)
        assert result["reliable"] is False
        assert "max_dbz_dt" in result
        assert result["max_dbz_dt"] > 2

    def test_returns_reason_when_unreliable(self):
        base_time = time.time()
        history = [
            {"timestamp": base_time, "bz": 0},
            {"timestamp": base_time + 60, "bz": -10},
        ]
        result = check_ovation_reliability(history)
        assert result["reliable"] is False
        assert "reason" in result
        assert "OVATION" in result["reason"]
