"""Tests for notification_service."""

from app.services.notification_service import (
    check_and_notify,
    clear_subscribers,
    get_subscribers,
    subscribe,
    unsubscribe,
)


class TestSubscribe:
    def setup_method(self):
        clear_subscribers()

    def test_subscribe_creates_record(self):
        sub = subscribe(65.0, 25.0, "test@example.com", 60)
        assert sub["email"] == "test@example.com"
        assert sub["lat"] == 65.0
        assert sub["lon"] == 25.0
        assert sub["threshold"] == 60
        assert sub["email_sent"] is False
        assert "id" in sub

    def test_subscribe_adds_to_list(self):
        subscribe(65.0, 25.0, "a@example.com")
        subscribe(70.0, 30.0, "b@example.com")
        assert len(get_subscribers()) == 2

    def test_default_threshold(self):
        sub = subscribe(65.0, 25.0, "test@example.com")
        assert sub["threshold"] == 60


class TestUnsubscribe:
    def setup_method(self):
        clear_subscribers()

    def test_unsubscribe_removes_record(self):
        sub = subscribe(65.0, 25.0, "test@example.com")
        assert unsubscribe(sub["id"]) is True
        assert len(get_subscribers()) == 0

    def test_unsubscribe_nonexistent_returns_false(self):
        assert unsubscribe("nonexistent-id") is False

    def test_unsubscribe_only_removes_target(self):
        sub1 = subscribe(65.0, 25.0, "a@example.com")
        subscribe(70.0, 30.0, "b@example.com")
        unsubscribe(sub1["id"])
        subs = get_subscribers()
        assert len(subs) == 1
        assert subs[0]["email"] == "b@example.com"


class TestCheckAndNotify:
    """Test the anti-spam flag logic described in the issue:

    1. score breach, email_sent=0 → send email, set flag=1
    2. score breach again, email_sent=1 → don't send email
    3. score drops, email_sent=1 → reset flag=0
    4. score breach again, flag=0 → send email and set flag=1
    """

    def setup_method(self):
        clear_subscribers()

    def _constant_score(self, value):
        """Return a score function that always returns *value*."""
        return lambda lat, lon: value

    def test_first_breach_sends_email(self):
        subscribe(65.0, 25.0, "test@example.com", threshold=50)

        events = check_and_notify(self._constant_score(70))
        assert len(events) == 1
        assert events[0]["action"] in ("email_sent", "email_skipped")  # skipped if SMTP not configured
        assert events[0]["score"] == 70

        # Verify flag is now set
        subs = get_subscribers()
        assert subs[0]["email_sent"] is True

    def test_second_breach_skipped_when_flag_set(self):
        subscribe(65.0, 25.0, "test@example.com", threshold=50)

        # First breach
        check_and_notify(self._constant_score(70))

        # Second breach — should NOT send again
        events = check_and_notify(self._constant_score(75))
        assert len(events) == 0

    def test_flag_resets_when_score_drops(self):
        subscribe(65.0, 25.0, "test@example.com", threshold=50)

        # Breach → set flag
        check_and_notify(self._constant_score(70))

        # Score drops below threshold → reset flag
        events = check_and_notify(self._constant_score(30))
        assert len(events) == 1
        assert events[0]["action"] == "flag_reset"

        subs = get_subscribers()
        assert subs[0]["email_sent"] is False

    def test_full_cycle_breach_drop_breach(self):
        """The complete anti-spam cycle from the issue description."""
        subscribe(65.0, 25.0, "test@example.com", threshold=50)

        # Step 1: First breach — send email
        events1 = check_and_notify(self._constant_score(70))
        assert len(events1) == 1
        assert events1[0]["action"] in ("email_sent", "email_skipped")

        # Step 2: Still breached — no email
        events2 = check_and_notify(self._constant_score(80))
        assert len(events2) == 0

        # Step 3: Score drops — reset flag
        events3 = check_and_notify(self._constant_score(30))
        assert len(events3) == 1
        assert events3[0]["action"] == "flag_reset"

        # Step 4: Breach again — send email again
        events4 = check_and_notify(self._constant_score(70))
        assert len(events4) == 1
        assert events4[0]["action"] in ("email_sent", "email_skipped")

    def test_no_events_when_below_threshold(self):
        subscribe(65.0, 25.0, "test@example.com", threshold=50)
        events = check_and_notify(self._constant_score(30))
        assert len(events) == 0

    def test_multiple_subscribers_independent(self):
        subscribe(65.0, 25.0, "a@example.com", threshold=50)
        subscribe(70.0, 30.0, "b@example.com", threshold=80)

        # Score 60: above threshold for a, below for b
        events = check_and_notify(self._constant_score(60))
        assert len(events) == 1
        assert events[0]["email"] == "a@example.com"

    def test_score_function_exception_skips_subscriber(self):
        subscribe(65.0, 25.0, "test@example.com", threshold=50)

        def failing_score(lat, lon):
            raise RuntimeError("API down")

        # Should not raise — just logs and skips
        events = check_and_notify(failing_score)
        assert len(events) == 0

    def test_last_score_updated(self):
        subscribe(65.0, 25.0, "test@example.com", threshold=50)
        check_and_notify(self._constant_score(42))
        subs = get_subscribers()
        assert subs[0]["last_score"] == 42
        assert subs[0]["last_checked"] is not None
