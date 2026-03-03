"""Tests for the runit._storage SDK module (persistent KV store for user code)."""

import json
import os
import sys
import tempfile

import pytest

# Add the src directory to the path so we can import runit
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from runit._storage import StorageClient


@pytest.fixture
def storage_dir():
    """Create a temp directory for storage tests."""
    with tempfile.TemporaryDirectory() as d:
        yield d


@pytest.fixture
def client(storage_dir):
    """Create a StorageClient with a temp directory."""
    os.environ['RUNIT_STORAGE_DIR'] = storage_dir
    c = StorageClient()
    yield c
    del os.environ['RUNIT_STORAGE_DIR']


class TestSetAndGet:
    def test_round_trip_dict(self, client):
        client.set('config', {'theme': 'dark', 'count': 42})
        result = client.get('config')
        assert result == {'theme': 'dark', 'count': 42}

    def test_round_trip_string(self, client):
        client.set('name', 'hello world')
        assert client.get('name') == 'hello world'

    def test_round_trip_number(self, client):
        client.set('pi', 3.14159)
        assert client.get('pi') == 3.14159

    def test_round_trip_list(self, client):
        client.set('items', [1, 2, 3])
        assert client.get('items') == [1, 2, 3]

    def test_round_trip_null(self, client):
        client.set('empty', None)
        assert client.get('empty') is None

    def test_round_trip_boolean(self, client):
        client.set('flag', True)
        assert client.get('flag') is True

    def test_overwrite(self, client):
        client.set('counter', 1)
        client.set('counter', 2)
        assert client.get('counter') == 2


class TestGetDefault:
    def test_missing_key_returns_none(self, client):
        assert client.get('missing') is None

    def test_missing_key_returns_default(self, client):
        assert client.get('missing', default=42) == 42


class TestDelete:
    def test_delete_existing(self, client):
        client.set('temp', 'value')
        assert client.delete('temp') is True
        assert client.get('temp') is None

    def test_delete_nonexistent(self, client):
        assert client.delete('nope') is False


class TestExists:
    def test_exists_true(self, client):
        client.set('key', 'val')
        assert client.exists('key') is True

    def test_exists_false(self, client):
        assert client.exists('nope') is False


class TestList:
    def test_empty(self, client):
        assert client.list() == []

    def test_multiple_keys(self, client):
        client.set('beta', 1)
        client.set('alpha', 2)
        keys = client.list()
        assert keys == ['alpha', 'beta']  # sorted

    def test_excludes_usage_file(self, client, storage_dir):
        client.set('data', 'value')
        # .usage file is created by set
        assert '.usage' not in client.list()


class TestKeyValidation:
    def test_valid_keys(self, client):
        valid = ['key', 'my-key', 'data_v2', 'config.json', 'ABC-123']
        for k in valid:
            client.set(k, 'ok')  # no exception

    def test_empty_key(self, client):
        with pytest.raises(ValueError, match='required'):
            client.set('', 'val')

    def test_long_key(self, client):
        with pytest.raises(ValueError, match='maximum length'):
            client.set('a' * 257, 'val')

    def test_invalid_chars(self, client):
        with pytest.raises(ValueError, match='alphanumeric'):
            client.set('key/slash', 'val')

    def test_dot_start(self, client):
        with pytest.raises(ValueError, match='dots'):
            client.set('.hidden', 'val')


class TestSizeLimits:
    def test_value_too_large(self, client):
        big = 'x' * (10 * 1024 * 1024 + 1)
        with pytest.raises(ValueError, match='exceeds maximum'):
            client.set('big', big)


class TestQuota:
    def test_quota_enforcement(self, client):
        # Set a very small quota for testing
        client._max_project_size = 100  # 100 bytes
        client.set('a', 'x' * 10)  # fits
        with pytest.raises(ValueError, match='quota exceeded'):
            client.set('b', 'y' * 200)  # too big

    def test_overwrite_doesnt_double_count(self, client):
        client._max_project_size = 200
        client.set('data', 'x' * 50)  # ~54 bytes with JSON quotes
        # Overwrite with same-ish size; no quota error
        client.set('data', 'y' * 50)


class TestAtomicWrites:
    def test_no_tmp_files_after_write(self, client, storage_dir):
        client.set('data', {'key': 'value'})
        files = os.listdir(storage_dir)
        tmp_files = [f for f in files if f.endswith('.tmp')]
        assert tmp_files == []

    def test_file_content_is_valid_json(self, client, storage_dir):
        client.set('data', [1, 2, 3])
        with open(os.path.join(storage_dir, 'data')) as f:
            content = json.loads(f.read())
        assert content == [1, 2, 3]


class TestSymlinkTraversal:
    def test_symlink_escape_blocked_on_set(self, client, storage_dir):
        """Symlinks pointing outside storage dir are rejected."""
        # Create a symlink inside storage dir pointing to /tmp
        target = tempfile.mkdtemp()
        link_path = os.path.join(storage_dir, 'escape')
        os.symlink(target, link_path)
        with pytest.raises(ValueError, match='outside storage directory'):
            client.set('escape', 'pwned')
        os.unlink(link_path)
        os.rmdir(target)

    def test_symlink_escape_blocked_on_get(self, client, storage_dir):
        """Symlinks pointing outside storage dir are rejected on read."""
        secret_file = os.path.join(tempfile.mkdtemp(), 'secret')
        with open(secret_file, 'w') as f:
            f.write(json.dumps('sensitive'))
        link_path = os.path.join(storage_dir, 'sneaky')
        os.symlink(secret_file, link_path)
        with pytest.raises(ValueError, match='outside storage directory'):
            client.get('sneaky')
        os.unlink(link_path)
        os.unlink(secret_file)

    def test_normal_keys_still_work(self, client):
        """Regular keys without symlinks work fine."""
        client.set('normal-key', 'value')
        assert client.get('normal-key') == 'value'
