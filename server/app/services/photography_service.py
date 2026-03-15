"""Photography recommendation service."""

import logging

logger = logging.getLogger(__name__)

def get_recommended_settings(kp: float) -> dict:
    """Get recommended camera settings based on Kp index."""
    if kp >= 7:
        iso = 800
        aperture = "f/2.8"
        shutter_speed = "8s"
        color_prediction = "Vivid greens with red/purple tops likely; fast-moving curtains"
    elif kp >= 5:
        iso = 1600
        aperture = "f/2.8"
        shutter_speed = "10s"
        color_prediction = "Strong green dominant with possible red tops above Kp6"
    elif kp >= 3:
        iso = 3200
        aperture = "f/2.8"
        shutter_speed = "15s"
        color_prediction = "Green dominant, subtle glow; longer exposures needed"
    else:
        iso = 6400
        aperture = "f/2.0"
        shutter_speed = "20s"
        color_prediction = "Faint or sub-visual aurora; may only appear in long exposure photos"

    return {
        "kp": kp,
        "iso": iso,
        "aperture": aperture,
        "shutterSpeed": shutter_speed,
        "colorPrediction": color_prediction,
        "tips": [
            "Use a sturdy tripod",
            "Manual focus set to infinity",
            "Shoot RAW for best post-processing",
            "Use a 2-second timer or remote shutter",
            "Fast-moving aurora — reduce exposure time" if kp >= 5 else "Slow aurora — longer exposures are fine",
        ],
    }
