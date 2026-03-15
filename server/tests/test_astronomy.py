"""Tests for astronomy utility functions."""

from datetime import datetime, timezone

from app.utils.astronomy import (
    day_night_terminator,
    is_astronomical_twilight,
    lunar_phase,
    lunar_position,
    normalize_deg,
    solar_position,
    to_julian_date,
)


class TestSolarPosition:
    def test_returns_altitude_and_azimuth(self):
        result = solar_position(51.5, -0.1, datetime(2024, 6, 21, 12, 0, 0, tzinfo=timezone.utc))
        assert "altitude" in result
        assert "azimuth" in result
        assert isinstance(result["altitude"], float)
        assert isinstance(result["azimuth"], float)

    def test_high_sun_at_summer_solstice_noon_london(self):
        result = solar_position(51.5, -0.1, datetime(2024, 6, 21, 12, 0, 0, tzinfo=timezone.utc))
        assert result["altitude"] > 50

    def test_low_sun_at_midnight_london(self):
        result = solar_position(51.5, -0.1, datetime(2024, 6, 21, 0, 0, 0, tzinfo=timezone.utc))
        assert result["altitude"] < 10

    def test_negative_sun_at_winter_night_tromso(self):
        result = solar_position(69.6, 19.0, datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc))
        assert result["altitude"] < 5


class TestLunarPhase:
    def test_illumination_between_0_and_1(self):
        result = lunar_phase(datetime.now(timezone.utc))
        assert 0 <= result <= 1

    def test_near_zero_at_new_moon(self):
        result = lunar_phase(datetime(2024, 1, 11, 11, 0, 0, tzinfo=timezone.utc))
        assert result < 0.05

    def test_near_one_at_full_moon(self):
        result = lunar_phase(datetime(2024, 1, 25, 17, 54, 0, tzinfo=timezone.utc))
        assert result > 0.95

    def test_varies_over_month(self):
        phase1 = lunar_phase(datetime(2024, 1, 11, tzinfo=timezone.utc))
        phase2 = lunar_phase(datetime(2024, 1, 18, tzinfo=timezone.utc))
        phase3 = lunar_phase(datetime(2024, 1, 25, tzinfo=timezone.utc))
        assert phase2 != phase1
        assert phase3 != phase2


class TestAstronomicalTwilight:
    def test_true_during_winter_night_high_latitude(self):
        result = is_astronomical_twilight(69.6, 19.0, datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc))
        assert result is True

    def test_false_during_daytime(self):
        result = is_astronomical_twilight(51.5, -0.1, datetime(2024, 6, 21, 12, 0, 0, tzinfo=timezone.utc))
        assert result is False


class TestDayNightTerminator:
    def test_returns_list_of_points(self):
        points = day_night_terminator(datetime.now(timezone.utc))
        assert isinstance(points, list)
        assert len(points) > 0

    def test_points_have_lat_lon(self):
        points = day_night_terminator(datetime.now(timezone.utc))
        assert "lat" in points[0]
        assert "lon" in points[0]

    def test_spans_longitudes(self):
        points = day_night_terminator(datetime.now(timezone.utc))
        lons = [p["lon"] for p in points]
        assert max(lons) - min(lons) > 100


class TestLunarPosition:
    def test_returns_altitude_and_azimuth(self):
        result = lunar_position(51.5, -0.1, datetime.now(timezone.utc))
        assert "altitude" in result
        assert "azimuth" in result


class TestUtilityFunctions:
    def test_normalize_deg_wraps_correctly(self):
        assert normalize_deg(0) == 0
        assert normalize_deg(360) == 0
        assert normalize_deg(-90) == 270
        assert normalize_deg(450) == 90

    def test_to_julian_date_known_value(self):
        j2000 = to_julian_date(datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc))
        assert abs(j2000 - 2451545.0) < 0.01
