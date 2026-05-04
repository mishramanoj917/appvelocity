"""
Visual QA microservice — pixel diff endpoint.

POST /diff
  Body: { "figmaPath": "/workspace/.../assets/nodeId.png",
          "screenshotPath": "/workspace/.../screenshots/screen.png" }
  Returns: { "diffPercent": 12.4, "mismatchBoxes": [...] }

POST /health
  Returns: { "status": "ok" }
"""

import os
import json
import numpy as np
from flask import Flask, request, jsonify

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    from PIL import Image, ImageChops

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "cv2": CV2_AVAILABLE})


@app.route("/diff", methods=["POST"])
def diff():
    data = request.get_json(force=True)
    figma_path      = data.get("figmaPath", "")
    screenshot_path = data.get("screenshotPath", "")

    if not os.path.exists(figma_path):
        return jsonify({"error": f"Figma image not found: {figma_path}"}), 404
    if not os.path.exists(screenshot_path):
        return jsonify({"error": f"Screenshot not found: {screenshot_path}"}), 404

    try:
        result = compute_diff(figma_path, screenshot_path)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def compute_diff(figma_path: str, screenshot_path: str) -> dict:
    if CV2_AVAILABLE:
        return _diff_cv2(figma_path, screenshot_path)
    return _diff_pillow(figma_path, screenshot_path)


def _diff_cv2(a_path: str, b_path: str) -> dict:
    img_a = cv2.imread(a_path)
    img_b = cv2.imread(b_path)

    # Resize b to match a dimensions
    if img_a.shape != img_b.shape:
        img_b = cv2.resize(img_b, (img_a.shape[1], img_a.shape[0]))

    diff = cv2.absdiff(img_a, img_b)
    gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 30, 255, cv2.THRESH_BINARY)

    total_pixels  = gray.size
    diff_pixels   = int(np.sum(thresh > 0))
    diff_percent  = round(diff_pixels / total_pixels * 100, 2)

    # Find bounding boxes of mismatched regions
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w * h > 100:  # ignore tiny noise
            boxes.append({"x": x, "y": y, "width": w, "height": h})

    return {"diffPercent": diff_percent, "mismatchBoxes": boxes[:20]}


def _diff_pillow(a_path: str, b_path: str) -> dict:
    from PIL import Image, ImageChops
    img_a = Image.open(a_path).convert("RGB")
    img_b = Image.open(b_path).convert("RGB").resize(img_a.size)

    diff  = ImageChops.difference(img_a, img_b)
    arr   = np.array(diff)
    mask  = np.any(arr > 30, axis=2)

    diff_percent = round(float(mask.sum()) / mask.size * 100, 2)
    return {"diffPercent": diff_percent, "mismatchBoxes": []}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
