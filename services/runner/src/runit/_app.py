# ABOUTME: RunIt app class with @app.action decorator for marking functions as RunIt actions.
# ABOUTME: Syntactic sugar that makes intent explicit.
# ABOUTME: Runner checks _runit_action attribute on functions.


class App:
    """RunIt application container.

    Use @app.action to mark functions as RunIt actions.
    The runner uses this to discover which functions to expose.

    Example:
        from runit import app

        @app.action
        def greet(name: str) -> dict:
            return {"message": f"Hello, {name}!"}

        @app.action(name="custom_name")
        def my_func(x: int) -> dict:
            return {"result": x * 2}
    """

    def __init__(self):
        self._actions = []

    def action(self, func=None, *, name=None):
        """Mark a function as a RunIt action.

        Can be used with or without arguments:
            @app.action
            def my_func(): ...

            @app.action(name="custom")
            def my_func(): ...
        """
        def decorator(f):
            f._runit_action = True
            f._runit_name = name or f.__name__
            self._actions.append(f)
            return f

        if func is not None:
            return decorator(func)
        return decorator

    @property
    def actions(self):
        """List of registered action functions."""
        return list(self._actions)


# Singleton instance
app = App()
