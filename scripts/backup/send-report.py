#!/usr/bin/env python3
"""Send one metadata-only backup report with an HMAC signature.

The shared secret is read from a file and never appears in process arguments,
the URL, the payload, or logs. A non-zero exit leaves the caller's outbox file
in place for a later retry.
"""

from __future__ import annotations

import hashlib
import hmac
import pathlib
import sys
import time
import urllib.error
import urllib.request


def main() -> int:
    if len(sys.argv) != 5:
        print(
            "usage: send-report.py DESTINATION REPORT_URL SECRET_FILE PAYLOAD_FILE",
            file=sys.stderr,
        )
        return 2

    destination = sys.argv[1]
    report_url = sys.argv[2]
    secret_path = pathlib.Path(sys.argv[3])
    payload_path = pathlib.Path(sys.argv[4])
    if destination not in ("primary", "mirror"):
        print("report destination rejected", file=sys.stderr)
        return 2
    secret = secret_path.read_bytes().strip()
    payload = payload_path.read_bytes()
    if not secret or len(payload) > 32 * 1024:
        print("report input rejected", file=sys.stderr)
        return 2

    timestamp = str(int(time.time()))
    signature = hmac.new(
        secret,
        timestamp.encode("ascii")
        + b"."
        + destination.encode("ascii")
        + b"."
        + payload,
        hashlib.sha256,
    ).hexdigest()
    request = urllib.request.Request(
        report_url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Backup-Timestamp": timestamp,
            "X-Backup-Signature": signature,
            "X-Backup-Destination": destination,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status not in (200, 202):
                print(f"report rejected with status {response.status}", file=sys.stderr)
                return 1
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"report delivery failed: {type(error).__name__}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
