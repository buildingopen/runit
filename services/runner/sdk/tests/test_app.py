"""Tests for app module."""

from runit._app import App


def test_action_decorator_without_arguments_registers_function():
    """@app.action should register a function and mark metadata."""
    app = App()

    @app.action
    def greet(name: str) -> dict:
        return {"message": f"Hello {name}"}

    assert greet._runit_action is True
    assert greet._runit_name == "greet"
    assert app.actions == [greet]
    assert greet("Federico") == {"message": "Hello Federico"}


def test_action_decorator_with_custom_name():
    """@app.action(name=...) should override the exposed action name."""
    app = App()

    @app.action(name="custom_greeting")
    def greet() -> dict:
        return {"ok": True}

    assert greet._runit_action is True
    assert greet._runit_name == "custom_greeting"
    assert app.actions[0] is greet


def test_actions_property_returns_copy():
    """The actions property should not expose internal mutable state."""
    app = App()

    @app.action
    def first():
        return 1

    actions = app.actions
    actions.clear()

    assert len(app.actions) == 1
    assert app.actions[0] is first
