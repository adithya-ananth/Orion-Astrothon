"""Tests for photography settings and aurora color prediction."""

from app.services.photography_service import get_recommended_settings


class TestAuroraColorPrediction:
    def test_low_kp_green_dominant(self):
        settings = get_recommended_settings(3)
        assert "557.7nm" in settings["auroraColor"]
        assert "Green" in settings["auroraColor"]

    def test_kp_below_5_green_only(self):
        settings = get_recommended_settings(4)
        assert settings["auroraColor"] == "Green (557.7nm atomic oxygen dominant)"

    def test_kp_5_green_with_red_fringes(self):
        settings = get_recommended_settings(5)
        assert "red" in settings["auroraColor"].lower()
        assert "Green" in settings["auroraColor"]

    def test_kp_6_green_with_red_fringes(self):
        settings = get_recommended_settings(6)
        assert "red" in settings["auroraColor"].lower()
        assert "fringes" in settings["auroraColor"].lower()

    def test_kp_above_6_green_and_red(self):
        settings = get_recommended_settings(7)
        assert "Green and red" in settings["auroraColor"]
        assert "high altitude" in settings["auroraColor"].lower()

    def test_kp_9_green_and_red(self):
        settings = get_recommended_settings(9)
        assert "Green and red" in settings["auroraColor"]


class TestPhotographySettings:
    def test_aurora_color_field_always_present(self):
        for kp in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]:
            settings = get_recommended_settings(kp)
            assert "auroraColor" in settings

    def test_color_prediction_field_still_present(self):
        settings = get_recommended_settings(5)
        assert "colorPrediction" in settings
        assert "shutterSpeed" in settings
