"""Tests for visibility_service."""

from datetime import datetime, timezone

from app.services.visibility_service import (
    compute_visibility_score,
    get_aurora_probability,
    get_cloud_score,
    get_darkness_score,
    get_magnetic_midnight,
)


class TestComputeVisibilityScore:
    def test_composite_between_0_and_100(self):
        ovation_data = {
            "coordinates": [
                [25, 65, 80],
            ],
        }
        cloud_data = {"total": 20, "low": 10, "mid": 10, "high": 20}
        darkness_score = 70

        result = compute_visibility_score(65, 25, ovation_data, cloud_data, darkness_score)

        assert 0 <= result["composite"] <= 100
        assert "aurora" in result["breakdown"]
        assert "cloud" in result["breakdown"]
        assert "darkness" in result["breakdown"]

    def test_applies_correct_weights(self):
        result = compute_visibility_score(
            65, 25,
            {"coordinates": [[25, 65, 100]]},
            {"total": 0, "low": 0, "mid": 0, "high": 0},
            100,
        )
        # All perfect: 100*0.5 + 100*0.35 + 100*0.15 = 100
        assert result["composite"] == 100

    def test_low_score_for_worst_conditions(self):
        result = compute_visibility_score(
            0, 0,
            {"coordinates": [[0, 0, 0]]},
            {"total": 100, "low": 100, "mid": 100, "high": 100},
            0,
        )
        assert result["composite"] <= 25


class TestGetCloudScore:
    def test_clear_skies(self):
        score = get_cloud_score({"total": 0, "low": 0, "mid": 0, "high": 0})
        assert score == 100

    def test_low_clouds_weighted_more(self):
        low_cloud = get_cloud_score({"total": 50, "low": 50, "mid": 0, "high": 0})
        high_cloud = get_cloud_score({"total": 50, "low": 0, "mid": 0, "high": 50})
        assert low_cloud < high_cloud

    def test_none_returns_50(self):
        assert get_cloud_score(None) == 50

    def test_all_null_values_returns_50(self):
        """When weather API fails, all values are None — should return 50 (moderate)."""
        score = get_cloud_score({"total": None, "low": None, "mid": None, "high": None})
        assert score == 50


class TestGetAuroraProbability:
    def test_returns_0_for_null_data(self):
        assert get_aurora_probability(65, 25, None) == 0

    def test_finds_nearest_grid_point(self):
        data = {
            "coordinates": [
                [24, 64, 30],
                [25, 65, 75],
                [26, 66, 40],
            ],
        }
        result = get_aurora_probability(65.1, 25.1, data)
        assert result == 75


class TestGetDarknessScore:
    def test_higher_score_during_astronomical_twilight(self):
        winter_night = datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc)
        score = get_darkness_score(69.6, 19.0, winter_night)
        assert score > 0

    def test_low_score_during_daytime(self):
        summer_noon = datetime(2024, 6, 21, 12, 0, 0, tzinfo=timezone.utc)
        score = get_darkness_score(45.0, 0, summer_noon)
        assert score <= 15


class TestGetMagneticMidnight:
    def test_returns_magnetic_midnight_info(self):
        result = get_magnetic_midnight(65, 25, datetime.now(timezone.utc))
        assert "magneticMidnightUTC" in result
        assert "timestamp" in result
        assert 0 <= result["magneticMidnightUTC"] < 24
