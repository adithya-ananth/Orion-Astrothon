"""Tests for the NOAA 3-day forecast text parser."""

from app.services.noaa_service import parse_3day_forecast_text

# Realistic sample text taken from NOAA SWPC (abridged to the relevant section)
SAMPLE_FORECAST_TEXT = """\
:Product: 3-Day Forecast
:Issued: 2026 Mar 15 0030 UTC
# Prepared by the U.S. Dept. of Commerce, NOAA, Space Weather Prediction Center
#
A. NOAA Geomagnetic Activity Observation and Forecast

The greatest observed 3 hr Kp over the past 24 hours was 6 (NOAA Scale
G2).
The greatest expected 3 hr Kp for Mar 15-Mar 17 2026 is 4.67 (NOAA Scale
G1).

NOAA Kp index breakdown Mar 15-Mar 17 2026

             Mar 15       Mar 16       Mar 17
00-03UT       4.00         3.67         2.67
03-06UT       4.33         3.67         3.00
06-09UT       4.67 (G1)    3.00         2.33
09-12UT       4.00         2.33         2.33
12-15UT       3.67         2.00         2.33
15-18UT       3.33         2.67         2.33
18-21UT       2.67         3.00         2.33
21-00UT       2.67         3.00         2.00

Rationale: G1 (Minor) geomagnetic storms are expected on 15 Mar due to
influence from a positive polarity coronal hole.

B. NOAA Solar Radiation Activity Observation and Forecast

Solar radiation, as observed by NOAA GOES-18 over the past 24 hours, was
below S-scale storm level thresholds.
"""


class TestParse3DayForecast:
    def test_returns_24_entries(self):
        """8 time-slots × 3 days = 24 entries."""
        result = parse_3day_forecast_text(SAMPLE_FORECAST_TEXT)
        assert len(result) == 24

    def test_first_entry(self):
        result = parse_3day_forecast_text(SAMPLE_FORECAST_TEXT)
        assert result[0]["time_tag"] == "Mar 15 00-03UT"
        assert result[0]["kp"] == 4.00

    def test_last_entry(self):
        result = parse_3day_forecast_text(SAMPLE_FORECAST_TEXT)
        assert result[-1]["time_tag"] == "Mar 17 21-00UT"
        assert result[-1]["kp"] == 2.00

    def test_g_scale_tag_stripped(self):
        """'4.67 (G1)' should parse as kp=4.67, not include the tag."""
        result = parse_3day_forecast_text(SAMPLE_FORECAST_TEXT)
        # 06-09UT Mar 15 has 4.67 (G1)
        entry = [r for r in result if r["time_tag"] == "Mar 15 06-09UT"][0]
        assert entry["kp"] == 4.67

    def test_ordering(self):
        """Entries should be ordered: all Mar 15 slots, then Mar 16, then Mar 17."""
        result = parse_3day_forecast_text(SAMPLE_FORECAST_TEXT)
        # First 8 entries are Mar 15, next 8 are Mar 16, last 8 are Mar 17
        for i in range(8):
            assert "Mar 15" in result[i]["time_tag"]
        for i in range(8, 16):
            assert "Mar 16" in result[i]["time_tag"]
        for i in range(16, 24):
            assert "Mar 17" in result[i]["time_tag"]

    def test_kp_values_are_floats(self):
        result = parse_3day_forecast_text(SAMPLE_FORECAST_TEXT)
        for entry in result:
            assert isinstance(entry["kp"], float)

    def test_each_entry_has_time_tag_and_kp(self):
        result = parse_3day_forecast_text(SAMPLE_FORECAST_TEXT)
        for entry in result:
            assert "time_tag" in entry
            assert "kp" in entry

    def test_empty_text_returns_empty_list(self):
        assert parse_3day_forecast_text("") == []

    def test_garbage_text_returns_empty_list(self):
        assert parse_3day_forecast_text("no forecast data here\njust noise") == []

    def test_specific_kp_values(self):
        """Verify all 24 Kp values against the sample text."""
        result = parse_3day_forecast_text(SAMPLE_FORECAST_TEXT)
        expected_kp = [
            # Mar 15
            4.00, 4.33, 4.67, 4.00, 3.67, 3.33, 2.67, 2.67,
            # Mar 16
            3.67, 3.67, 3.00, 2.33, 2.00, 2.67, 3.00, 3.00,
            # Mar 17
            2.67, 3.00, 2.33, 2.33, 2.33, 2.33, 2.33, 2.00,
        ]
        actual_kp = [e["kp"] for e in result]
        assert actual_kp == expected_kp
