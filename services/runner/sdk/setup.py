"""Setup script for Runtime SDK."""

from pathlib import Path

from setuptools import find_packages, setup

# Read README for long description
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text() if readme_file.exists() else ""

setup(
    name="execution-layer",
    version="0.1.0",
    description="SDK for building apps on Runtime",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Runtime AI",
    author_email="support@runtime.ai",
    url="https://github.com/federicodeponte/execution-layer",
    packages=find_packages(exclude=["tests", "tests.*"]),
    python_requires=">=3.11",
    install_requires=[
        # No hard dependencies - optional features only
    ],
    extras_require={
        "dataframe": [
            "pandas>=2.0.0",
            "pyarrow>=14.0.0",  # For Parquet support
        ],
        "excel": [
            "pandas>=2.0.0",
            "openpyxl>=3.1.0",  # For Excel support
        ],
        "dev": [
            "pytest>=7.4.0",
            "pytest-asyncio>=0.23.0",
            "pytest-cov>=4.1.0",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    keywords="fastapi runtime sdk serverless",
    project_urls={
        "Documentation": "https://docs.runtime.ai",
        "Source": "https://github.com/federicodeponte/execution-layer",
        "Tracker": "https://github.com/federicodeponte/execution-layer/issues",
    },
)
