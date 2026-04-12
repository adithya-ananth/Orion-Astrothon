"""Tests for NOAA service JSON parsing helpers."""

import json

import pytest

from app.services.noaa_service import _parse_json_resilient


class TestParseJsonResilient:
    def test_parses_normal_json(self):
        payload = '[["time_tag","kp_index"],["2026-04-12 00:00:00.000","2.00"]]'
        result = _parse_json_resilient(payload, "https://example.test/data.json")
        assert isinstance(result, list)
        assert result[-1][1] == "2.00"

    def test_handles_trailing_extra_json_data(self):
        payload = '[["time_tag","kp_index"],["2026-04-12 00:00:00.000","2.00"]]{"extra":true}'
        result = _parse_json_resilient(payload, "https://example.test/data.json")
        assert isinstance(result, list)
        assert result[0][0] == "time_tag"

    def test_returns_none_for_blank_payload(self):
        assert _parse_json_resilient("   \n\t", "https://example.test/data.json") is None

    def test_raises_on_non_json(self):
        with pytest.raises(json.JSONDecodeError):
            _parse_json_resilient("not-json", "https://example.test/data.json")
