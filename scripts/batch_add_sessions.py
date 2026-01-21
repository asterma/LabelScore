#!/usr/bin/env python3
import argparse
import json
import sys
import time
from typing import Any
from urllib import request, error

def post_json(url: str, payload: dict[str, Any], token: str | None) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body) if body else {}

def login(api_base: str, username: str, password: str) -> str:
    url = f"{api_base}/api/auth/login"
    payload = {"username": username, "password": password}
    result = post_json(url, payload, token=None)
    token = result.get("access_token")
    if not token:
        raise RuntimeError("Login failed: no access_token returned")
    return token

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Batch add sessions by calling the backend scan endpoint."
    )
    parser.add_argument("--file", required=True, help="Text file with one session path per line.")
    parser.add_argument("--api", default="http://localhost:8000", help="Backend base URL.")
    parser.add_argument("--username", default="admin", help="Login username (if no token).")
    parser.add_argument("--password", default="admin123", help="Login password (if no token).")
    parser.add_argument("--token", default="", help="Bearer token (skips login).")
    parser.add_argument("--delay", type=float, default=0.0, help="Delay between requests (seconds).")
    args = parser.parse_args()

    token = args.token.strip() or None
    if not token:
        try:
            token = login(args.api, args.username, args.password)
        except Exception as exc:
            print(f"Login failed: {exc}", file=sys.stderr)
            return 2

    scan_url = f"{args.api}/api/scan/session"
    failed = 0

    try:
        with open(args.file, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except OSError as exc:
        print(f"Failed to read file: {exc}", file=sys.stderr)
        return 2

    for idx, raw in enumerate(lines, start=1):
        path = raw.strip()
        if not path or path.startswith("#"):
            continue

        try:
            result = post_json(scan_url, {"session_path": path}, token)
            if result.get("error"):
                failed += 1
                print(f"[{idx}] FAIL {path} -> {result['error']}")
            else:
                status = result.get("status", "ok")
                sessions_found = result.get("sessions_found")
                images_found = result.get("images_found")
                print(f"[{idx}] OK {path} -> {status}, sessions={sessions_found}, images={images_found}")
        except error.HTTPError as exc:
            failed += 1
            try:
                body = exc.read().decode("utf-8")
            except Exception:
                body = str(exc)
            print(f"[{idx}] FAIL {path} -> HTTP {exc.code}: {body}")
        except Exception as exc:
            failed += 1
            print(f"[{idx}] FAIL {path} -> {exc}")

        if args.delay > 0:
            time.sleep(args.delay)

    if failed:
        print(f"Done with failures: {failed}")
        return 1

    print("Done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
