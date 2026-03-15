"""Tests for visibility_service."""

from datetime import datetime, timezone

from app.services.visibility_service import (
    adjust_aurora_for_bz,
    compute_visibility_score,
    estimate_bortle_class,
    get_aurora_probability,
    get_cloud_score,
    get_darkness_score,
    get_magnetic_midnight,
)


class TestComputeVisibilityScore:
    def test_composite_between_0_and_100(self):
        ovation_data = {
            "coordinates": [
                {"Latitude": 65, "Longitude": 25, "Aurora": 80},
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
            {"coordinates": [{"Latitude": 65, "Longitude": 25, "Aurora": 100}]},
            {"total": 0, "low": 0, "mid": 0, "high": 0},
            100,
        )
        # All perfect: 100*0.5 + 100*0.35 + 100*0.15 = 100
        assert result["composite"] == 100

    def test_low_score_for_worst_conditions(self):
        result = compute_visibility_score(
            0, 0,
            {"coordinates": [{"Latitude": 0, "Longitude": 0, "Aurora": 0}]},
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
                {"Latitude": 64, "Longitude": 24, "Aurora": 30},
                {"Latitude": 65, "Longitude": 25, "Aurora": 75},
                {"Latitude": 66, "Longitude": 26, "Aurora": 40},
            ],
        }
        result = get_aurora_probability(65.1, 25.1, data)
        assert result == 75

    def test_handles_list_format(self):
        """NOAA OVATION data uses list [lon, lat, aurora] format."""
        data = {"coordinates": [[25, 65, 75], [26, 66, 40]]}
        result = get_aurora_probability(65.1, 25.1, data)
        assert result == 75


class TestAdjustAuroraForBz:
    def test_no_adjustment_when_bz_above_threshold(self):
        assert adjust_aurora_for_bz(50, 0) == 50
        assert adjust_aurora_for_bz(50, -5) == 50

    def test_no_adjustment_when_bz_at_threshold(self):
        assert adjust_aurora_for_bz(50, -7) == 50

    def test_no_adjustment_when_bz_is_none(self):
        assert adjust_aurora_for_bz(50, None) == 50

    def test_boost_when_bz_below_threshold(self):
        # Bz = -10: boost = 1 + (10 - 7) * 0.05 = 1.15
        result = adjust_aurora_for_bz(50, -10)
        assert result == 50 * 1.15  # 57.5

    def test_larger_boost_for_stronger_southward(self):
        mild = adjust_aurora_for_bz(50, -10)
        strong = adjust_aurora_for_bz(50, -20)
        assert strong > mild

    def test_clamped_to_100(self):
        # Very high base + strong Bz should not exceed 100
        result = adjust_aurora_for_bz(95, -20)
        assert result == 100

    def test_zero_probability_stays_zero(self):
        assert adjust_aurora_for_bz(0, -20) == 0


class TestEstimateBortleClass:
    def test_london_is_high_bortle(self):
        """Central London should have a high Bortle class (bright sky)."""
        bortle = estimate_bortle_class(51.51, -0.13)
        assert bortle >= 7

    def test_rural_scotland_is_low_bortle(self):
        """Rural Scottish Highlands (away from towns) should be dark."""
        bortle = estimate_bortle_class(57.0, -5.5)  # Highlands, away from Inverness
        assert bortle <= 4

    def test_tromso_area_darker_than_london(self):
        """Tromsø area should be much darker than London."""
        tromso = estimate_bortle_class(69.65, 18.96)
        london = estimate_bortle_class(51.51, -0.13)
        assert tromso < london

    def test_london_darker_than_rural_scotland(self):
        """London should have a brighter sky (higher Bortle) than rural Scotland."""
        london = estimate_bortle_class(51.51, -0.13)
        scotland = estimate_bortle_class(57.0, -5.5)
        assert london > scotland

    def test_remote_location_is_dark(self):
        """A remote location far from any city should be very dark."""
        bortle = estimate_bortle_class(-70, 0)  # Antarctica
        assert bortle <= 3


class TestDarknessScoreBortleDifferentiation:
    def test_london_vs_scotland_different_darkness(self):
        """London and rural Scotland should get different darkness scores."""
        winter_night = datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc)
        london_score = get_darkness_score(51.51, -0.13, winter_night)
        scotland_score = get_darkness_score(57.48, -4.22, winter_night)
        assert scotland_score > london_score


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
