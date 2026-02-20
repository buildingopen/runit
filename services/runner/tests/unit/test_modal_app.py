import importlib
import sys
import types


class _FakeImage:
    python_version = "3.11"

    @classmethod
    def debian_slim(cls, **kwargs):
        return cls()

    def apt_install(self, *args, **kwargs):
        return self

    def pip_install(self, *args, **kwargs):
        return self

    def env(self, *args, **kwargs):
        return self

    def add_local_python_source(self, *args, **kwargs):
        return self


class _FakeApp:
    def __init__(self, name):
        self.name = name

    def function(self, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    def local_entrypoint(self):
        def decorator(fn):
            return fn
        return decorator


class _FakeSecret:
    @staticmethod
    def from_name(name):
        return {"secret_name": name}


def _install_fake_modal(monkeypatch):
    fake_modal = types.SimpleNamespace(
        Image=_FakeImage,
        App=_FakeApp,
        Secret=_FakeSecret,
    )
    monkeypatch.setitem(sys.modules, "modal", fake_modal)
    return fake_modal


def _install_fake_executor(monkeypatch, return_value):
    fake_executor_module = types.SimpleNamespace(
        execute_endpoint=lambda **kwargs: return_value(kwargs)
    )
    fake_execute_pkg = types.SimpleNamespace(executor=fake_executor_module)
    monkeypatch.setitem(sys.modules, "execute", fake_execute_pkg)
    monkeypatch.setitem(sys.modules, "execute.executor", fake_executor_module)


def _import_modal_app(monkeypatch):
    _install_fake_modal(monkeypatch)
    if "modal_app" in sys.modules:
        del sys.modules["modal_app"]
    return importlib.import_module("modal_app")


def test_run_endpoint_cpu_caps_timeout(monkeypatch):
    _install_fake_executor(monkeypatch, lambda kwargs: kwargs)
    mod = _import_modal_app(monkeypatch)

    result = mod.run_endpoint_cpu({"timeout_seconds": 5000, "run_id": "r1"})
    assert result["lane"] == "cpu"
    assert result["max_timeout"] == 1800
    assert result["max_memory_mb"] == 4096


def test_run_endpoint_cpu_uses_default_timeout(monkeypatch):
    _install_fake_executor(monkeypatch, lambda kwargs: kwargs)
    mod = _import_modal_app(monkeypatch)

    result = mod.run_endpoint_cpu({"run_id": "r2"})
    assert result["max_timeout"] == 60
    assert result["lane"] == "cpu"


def test_run_endpoint_gpu_uses_gpu_limits(monkeypatch):
    _install_fake_executor(monkeypatch, lambda kwargs: kwargs)
    mod = _import_modal_app(monkeypatch)

    result = mod.run_endpoint_gpu({"run_id": "r3", "timeout_seconds": 999})
    assert result["lane"] == "gpu"
    assert result["max_timeout"] == 180
    assert result["max_memory_mb"] == 16384


def test_main_prints_expected_status(monkeypatch, capsys):
    _install_fake_executor(monkeypatch, lambda kwargs: kwargs)
    mod = _import_modal_app(monkeypatch)

    mod.main()
    out = capsys.readouterr().out
    assert "Execution Layer Runtime v" in out
    assert "Available functions:" in out
    assert "run_endpoint_cpu" in out
    assert "run_endpoint_gpu" in out
