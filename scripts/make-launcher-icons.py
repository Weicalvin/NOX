#!/usr/bin/env python3
"""Rasterize NOX launcher icons from the logo language."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/workspace")
OUT = ROOT / "android/app/src/main/res"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def draw_logo(size: int, rounded: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (5, 5, 5, 255))
    d = ImageDraw.Draw(img)
    pad = max(2, size // 18)
    radius = size // 2 if rounded else max(6, size // 6)
    inset = [pad, pad, size - pad - 1, size - pad - 1]
    d.rounded_rectangle(inset, radius=radius, fill=(17, 17, 17, 255))
    stroke = max(2, size // 28)
    d.rounded_rectangle(
        inset,
        radius=radius,
        outline=(200, 204, 212, 255),
        width=stroke,
    )
    try:
        font = ImageFont.truetype(FONT, int(size * 0.46))
    except OSError:
        font = ImageFont.load_default()
    text = "N"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.03
    d.text((x, y), text, font=font, fill=(242, 240, 235, 255))
    return img


def main() -> None:
    for folder, size in SIZES.items():
        dest = OUT / folder
        dest.mkdir(parents=True, exist_ok=True)
        draw_logo(size, False).save(dest / "ic_launcher.png", "PNG")
        draw_logo(size, True).save(dest / "ic_launcher_round.png", "PNG")
    play = ROOT / "public" / "icon-512.png"
    draw_logo(512, False).save(play, "PNG")
    draw_logo(192, False).save(ROOT / "public" / "icon-192.png", "PNG")


if __name__ == "__main__":
    main()
