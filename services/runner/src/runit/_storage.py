# ABOUTME: StorageClient for persistent key-value storage inside runner containers.
# ABOUTME: Reads/writes files at RUNIT_STORAGE_DIR (/storage). Atomic writes via rename. 10MB/value, 100MB/project.

import json
import os
import re
import tempfile

KEY_PATTERN = re.compile(r'^[a-zA-Z0-9._-]+$')
MAX_KEY_LENGTH = 256
MAX_VALUE_SIZE = 10 * 1024 * 1024  # 10MB per value
DEFAULT_MAX_PROJECT_SIZE = 100 * 1024 * 1024  # 100MB per project
USAGE_FILE = '.usage'


class StorageClient:
    """Persistent key-value storage for RunIt projects.

    Values are stored as files in the storage directory, mounted by the runner.
    Supports JSON-serializable values and raw strings.
    """

    def __init__(self):
        self._dir = os.environ.get('RUNIT_STORAGE_DIR', '/storage')
        self._max_project_size = int(
            os.environ.get('RUNIT_STORAGE_MAX_PROJECT_SIZE', str(DEFAULT_MAX_PROJECT_SIZE))
        )

    def _validate_key(self, key):
        if not key or len(key) == 0:
            raise ValueError('Key is required')
        if len(key) > MAX_KEY_LENGTH:
            raise ValueError(f'Key exceeds maximum length of {MAX_KEY_LENGTH} characters')
        if not KEY_PATTERN.match(key):
            raise ValueError('Key must contain only alphanumeric characters, dots, underscores, and hyphens')
        if '..' in key or key.startswith('.') or key.endswith('.'):
            raise ValueError('Key must not start/end with dots or contain consecutive dots')

    def _path(self, key):
        path = os.path.join(self._dir, key)
        real = os.path.realpath(path)
        if not real.startswith(os.path.realpath(self._dir) + os.sep) and real != os.path.realpath(self._dir):
            raise ValueError('Storage key resolves outside storage directory')
        return path

    def _ensure_dir(self):
        os.makedirs(self._dir, exist_ok=True)

    def _compute_usage(self):
        """Calculate total storage usage by scanning files."""
        total = 0
        if not os.path.isdir(self._dir):
            return 0
        for name in os.listdir(self._dir):
            if name == USAGE_FILE or name.endswith('.tmp'):
                continue
            fpath = os.path.join(self._dir, name)
            if os.path.isfile(fpath):
                total += os.path.getsize(fpath)
        return total

    def _update_usage(self):
        """Write current usage to .usage file."""
        usage = self._compute_usage()
        usage_path = os.path.join(self._dir, USAGE_FILE)
        with open(usage_path, 'w') as f:
            f.write(str(usage))
        return usage

    def set(self, key, value):
        """Store a value. Accepts any JSON-serializable object or string.

        Args:
            key: Storage key (alphanumeric, dots, underscores, hyphens; max 256 chars)
            value: Value to store (JSON-serialized automatically)

        Raises:
            ValueError: If key is invalid or value exceeds size limits
        """
        self._validate_key(key)
        self._ensure_dir()

        serialized = json.dumps(value)
        size = len(serialized.encode('utf-8'))

        if size > MAX_VALUE_SIZE:
            raise ValueError(f'Value size ({size} bytes) exceeds maximum of {MAX_VALUE_SIZE} bytes')

        # Check quota
        existing_size = 0
        existing_path = self._path(key)
        if os.path.isfile(existing_path):
            existing_size = os.path.getsize(existing_path)

        current_usage = self._compute_usage()
        projected = current_usage - existing_size + size
        if projected > self._max_project_size:
            raise ValueError(
                f'Project storage quota exceeded ({projected} / {self._max_project_size} bytes)'
            )

        # Atomic write: write to temp, then rename
        fd, tmp_path = tempfile.mkstemp(dir=self._dir, suffix='.tmp')
        try:
            with os.fdopen(fd, 'w') as f:
                f.write(serialized)
            os.rename(tmp_path, existing_path)
        except Exception:
            # Clean up temp file on failure
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

        self._update_usage()

    def get(self, key, default=None):
        """Retrieve a value by key.

        Args:
            key: Storage key
            default: Value to return if key doesn't exist (default: None)

        Returns:
            The stored value (deserialized from JSON), or default if not found
        """
        self._validate_key(key)
        path = self._path(key)
        if not os.path.isfile(path):
            return default

        with open(path, 'r') as f:
            raw = f.read()
        return json.loads(raw)

    def delete(self, key):
        """Delete a value by key.

        Args:
            key: Storage key

        Returns:
            True if the key existed and was deleted, False if not found
        """
        self._validate_key(key)
        path = self._path(key)
        if not os.path.isfile(path):
            return False
        os.unlink(path)
        self._update_usage()
        return True

    def exists(self, key):
        """Check if a key exists.

        Args:
            key: Storage key

        Returns:
            True if the key exists
        """
        self._validate_key(key)
        return os.path.isfile(self._path(key))

    def list(self):
        """List all storage keys.

        Returns:
            List of key names (strings)
        """
        if not os.path.isdir(self._dir):
            return []
        keys = []
        for name in sorted(os.listdir(self._dir)):
            if name == USAGE_FILE or name.endswith('.tmp'):
                continue
            fpath = os.path.join(self._dir, name)
            if os.path.isfile(fpath):
                keys.append(name)
        return keys


# Singleton instance
storage = StorageClient()
