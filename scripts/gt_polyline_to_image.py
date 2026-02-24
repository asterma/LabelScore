#!/usr/bin/env python3
"""Overlay /ld_polyline3d from a ROS1 bag onto an IMG_INTENSITY image.

Example:
  python scripts/gt_polyline_to_image.py \
    --image /path/to/map/IMG_INTENSITY/xxx.jpg \
    --bag /path/to/GT_RF-*/LDE/xxx.bag \
    --out /path/to/output.png
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Tuple

try:
    import rosbag  # type: ignore
except Exception as exc:  # pragma: no cover - environment-specific
    raise SystemExit(
        "rosbag (ROS1) is required to read .bag files. "
        "Please run inside a ROS environment."
    ) from exc

try:
    from PIL import Image, ImageDraw  # type: ignore
except Exception as exc:  # pragma: no cover - environment-specific
    raise SystemExit("Pillow is required. Install with: pip install pillow") from exc


def _iter_points(msg) -> Iterable[Tuple[float, float]]:
    """Try to extract 2D points from a variety of message layouts."""
    candidates = []

    if hasattr(msg, "points"):
        candidates = getattr(msg, "points")
    elif hasattr(msg, "polyline"):
        candidates = getattr(msg, "polyline")
    elif hasattr(msg, "polylines"):
        # flatten list of polylines
        for poly in getattr(msg, "polylines"):
            if hasattr(poly, "points"):
                for p in poly.points:
                    yield _point_xy(p)
        return

    for p in candidates:
        yield _point_xy(p)


def _point_xy(p) -> Tuple[float, float]:
    if hasattr(p, "x") and hasattr(p, "y"):
        return float(p.x), float(p.y)
    if hasattr(p, "u") and hasattr(p, "v"):
        return float(p.u), float(p.v)
    if hasattr(p, "point"):
        pt = getattr(p, "point")
        if hasattr(pt, "x") and hasattr(pt, "y"):
            return float(pt.x), float(pt.y)
    raise ValueError("Unsupported point format in /ld_polyline3d")


def _load_polyline(bag_path: Path, topic: str, msg_index: int) -> list[Tuple[float, float]]:
    with rosbag.Bag(str(bag_path), "r") as bag:
        messages = [msg for _, msg, _ in bag.read_messages(topics=[topic])]

    if not messages:
        raise ValueError(f"No messages found for topic {topic}")

    idx = msg_index if msg_index >= 0 else 0
    idx = min(idx, len(messages) - 1)

    points: list[Tuple[float, float]] = []
    for x, y in _iter_points(messages[idx]):
        points.append((x, y))
    if not points:
        raise ValueError("No points found in message")
    return points


def main() -> int:
    parser = argparse.ArgumentParser(description="Overlay /ld_polyline3d onto IMG_INTENSITY image")
    parser.add_argument("--image", required=True, help="Path to IMG_INTENSITY image")
    parser.add_argument("--bag", required=True, help="Path to GT_RF/LDE .bag file")
    parser.add_argument("--topic", default="/ld_polyline3d", help="Topic name")
    parser.add_argument("--out", required=True, help="Output image path")
    parser.add_argument("--msg-index", type=int, default=0, help="Message index to use")
    parser.add_argument("--color", default="#ff3b30", help="Polyline color")
    parser.add_argument("--width", type=int, default=2, help="Line width")
    parser.add_argument("--flip-y", action="store_true", help="Flip y-axis (image coords)")
    parser.add_argument("--scale", type=float, default=1.0, help="Scale for x/y")

    args = parser.parse_args()

    image_path = Path(args.image)
    bag_path = Path(args.bag)
    out_path = Path(args.out)

    if not image_path.exists():
        raise SystemExit(f"Image not found: {image_path}")
    if not bag_path.exists():
        raise SystemExit(f"Bag not found: {bag_path}")

    points = _load_polyline(bag_path, args.topic, args.msg_index)

    img = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    width, height = img.size
    scaled = []
    for x, y in points:
        x *= args.scale
        y *= args.scale
        if args.flip_y:
            y = height - y
        scaled.append((x, y))

    if len(scaled) >= 2:
        draw.line(scaled, fill=args.color, width=args.width)
    else:
        x, y = scaled[0]
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=args.color)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    print(f"Saved: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
