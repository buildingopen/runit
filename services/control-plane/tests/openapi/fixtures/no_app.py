"""
No FastAPI App - Test Fixture

ABOUTME: Python file without a FastAPI app instance
"""

from fastapi import FastAPI


def create_app():
    """Factory function that creates app but doesn't export it"""
    app = FastAPI()

    @app.get("/")
    def root():
        return {"message": "Hello"}

    return app


# Note: no 'app' variable exported
