from pathlib import Path

from PIL import Image, ImageDraw


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "extension" / "icons"


def render_icon(size: int) -> None:
    scale = 4
    canvas_size = size * scale
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    ink = "#1c1c1a"
    paper = "#fbfbfa"
    radius = round(canvas_size * 14 / 64)
    draw.rounded_rectangle((0, 0, canvas_size - 1, canvas_size - 1), radius=radius, fill=ink)

    def point(x: float, y: float) -> tuple[int, int]:
        return round(x * canvas_size / 64), round(y * canvas_size / 64)

    draw.polygon(
        [point(12, 17.5), point(22, 19), point(32, 25), point(32, 49.5), point(23, 42), point(13, 39.7)],
        fill=paper,
    )
    draw.polygon(
        [point(52, 17.5), point(42, 19), point(32, 25), point(32, 49.5), point(41, 42), point(51, 39.7)],
        fill=paper,
    )

    image.resize((size, size), Image.Resampling.LANCZOS).save(OUTPUT_DIR / f"icon-{size}.png")


if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for icon_size in (16, 32, 48, 128):
        render_icon(icon_size)
