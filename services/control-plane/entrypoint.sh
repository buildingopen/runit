#!/bin/sh
# Runs as root at container startup, then drops to controlplane user.

# 1. Fix bind-mount directory permissions (Docker creates them as root)
for dir in /tmp/runit-workspaces /tmp/runit-storage; do
  if [ -d "$dir" ]; then
    chown 1001:1001 "$dir" 2>/dev/null || chmod 1777 "$dir" 2>/dev/null || true
  fi
done

# 2. Grant controlplane access to Docker socket (group_add only applies to root,
#    but su-exec drops to controlplane's own groups, losing the socket group)
if [ -S /var/run/docker.sock ]; then
  SOCK_GID=$(stat -c '%g' /var/run/docker.sock)
  if [ "$SOCK_GID" != "0" ]; then
    addgroup -g "$SOCK_GID" -S dockerhost 2>/dev/null || true
    addgroup controlplane dockerhost 2>/dev/null || true
  fi
fi

exec su-exec controlplane "$@"
