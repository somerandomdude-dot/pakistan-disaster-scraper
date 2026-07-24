from app.jobs.scheduler import effective_poll_interval


def test_polling_never_exceeds_five_minutes():
    assert effective_poll_interval(20) == 5
    assert effective_poll_interval(10) == 5
    assert effective_poll_interval(5) == 5


def test_faster_source_intervals_are_preserved():
    assert effective_poll_interval(1) == 1
    assert effective_poll_interval(2) == 2
    assert effective_poll_interval(3) == 3


def test_invalid_interval_is_clamped_to_one_minute():
    assert effective_poll_interval(0) == 1
    assert effective_poll_interval(-10) == 1
