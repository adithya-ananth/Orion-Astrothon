"""Tests for visibility route helpers."""

from app.routes.visibility import _extract_latest_kp_value


class TestExtractLatestKpValue:
    def test_extracts_from_list_row_format(self):
        kp_data = [
            ["time_tag", "kp_index", "a_running", "station_count"],
            ["2026-04-12 00:00:00.000", "4.33", "13", "10"],
        ]
        assert _extract_latest_kp_value(kp_data) == 4.33

    def test_extracts_from_dict_row_format(self):
        kp_data = [
            {"time_tag": "header", "kp": "kp"},
            {"time_tag": "2026-04-12 00:00:00.000", "kp": "3.67"},
        ]
        assert _extract_latest_kp_value(kp_data) == 3.67

    def test_returns_zero_for_unusable_data(self):
        assert _extract_latest_kp_value(None) == 0.0
        assert _extract_latest_kp_value([]) == 0.0
        assert _extract_latest_kp_value([{"time_tag": "2026-04-12"}]) == 0.0
