# analysis/detection.py

from pathlib import Path
from typing import List, Dict, Tuple, Optional
import io
import logging

import fitz  # PyMuPDF
import numpy as np
import cv2
from PIL import Image
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

logger = logging.getLogger(__name__)


class TrOCRModel:
    """
    Lazy-loaded TrOCR model for handwriting recognition.
    """

    def __init__(self):
        self.processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
        self.model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        if self.device.type == "cuda":
            self.model.half()  # FP16

    def ocr(self, images: List[Image.Image]) -> List[str]:
        """
        Perform OCR on a batch of images.
        """
        if not images:
            return []

        pixel_values = self.processor(images, return_tensors="pt").pixel_values
        pixel_values = pixel_values.to(self.device)
        if self.device.type == "cuda":
            pixel_values = pixel_values.half()

        with torch.no_grad():
            generated_ids = self.model.generate(
                pixel_values,
                max_length=256,
                num_beams=4,
                early_stopping=True
            )

        generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)
        return generated_text


_trocr_model = None


def get_trocr_model() -> TrOCRModel:
    """
    Get the global TrOCR model instance.
    """
    global _trocr_model
    if _trocr_model is None:
        _trocr_model = TrOCRModel()
    return _trocr_model


class WrongAnswerDetector:
    """
    Detects wrong answers in handwritten test papers using TrOCR and red-mark alignment.
    """

    def __init__(self, detection_mode: str = "trocr_red_mark", dpi: int = 300):
        self.detection_mode = detection_mode
        self.dpi = dpi
        self.trocr = get_trocr_model()

    def detect(
        self,
        pdf_path: str | Path,
        pages_text: List[Tuple[str, int]],
        manual_entries: List[Dict] | None = None,
    ) -> List[Dict]:
        """
        Main entry point for wrong-answer detection.
        """
        pdf_path = Path(pdf_path)
        results: List[Dict] = []

        logger.info(f"Detecting wrong answers (mode={self.detection_mode})")

        if manual_entries:
            results.extend(self._detect_manual(manual_entries))

        doc = fitz.open(str(pdf_path))
        total_answer_regions = 0
        total_red_marks = 0
        total_matched = 0

        for page_index in range(len(doc)):
            page = doc[page_index]
            pix = page.get_pixmap(dpi=self.dpi)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))

            # Detect answer regions
            answer_boxes = self._detect_answer_regions(img)
            total_answer_regions += len(answer_boxes)

            # Detect red marks
            red_marks = self._detect_red_marks(img)
            total_red_marks += len(red_marks)

            # Match marks to answers
            matched_boxes = self._match_marks_to_answers(answer_boxes, red_marks)
            total_matched += len(matched_boxes)

            # OCR matched regions
            ocr_texts = self._ocr_regions(img, matched_boxes)

            for text in ocr_texts:
                if text.strip():
                    results.append({
                        "page": page_index + 1,
                        "text": text[:500],
                        "detection_method": "trocr_red_mark",
                        "confidence": 0.9,
                    })

        doc.close()

        logger.info(f"Detected {total_answer_regions} answer regions, {total_red_marks} red marks, {total_matched} matched answers")

        # Failsafe: if no results, fallback to full page OCR
        if not results:
            logger.info("No matched answers detected, falling back to full page OCR")
            doc = fitz.open(str(pdf_path))
            for page_index in range(len(doc)):
                page = doc[page_index]
                pix = page.get_pixmap(dpi=self.dpi)
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                text = self.trocr.ocr([img])[0]
                if text.strip():
                    results.append({
                        "page": page_index + 1,
                        "text": text[:500],
                        "detection_method": "trocr_fallback",
                        "confidence": 0.5,
                    })
            doc.close()

        logger.info(f"Total detected wrong-answer instances: {len(results)}")

        return results

    # ----------------------------
    # Detection strategies
    # ----------------------------

    def _detect_manual(self, manual_entries: List[Dict]) -> List[Dict]:
        """
        Handle manual entries.
        """
        detected = []

        for entry in manual_entries:
            if "text" in entry and entry["text"].strip():
                detected.append({
                    "page": entry.get("page", 0),
                    "text": entry["text"],
                    "question_number": entry.get("question_number", ""),
                    "detection_method": "manual",
                    "confidence": 1.0,
                })

        return detected

    def _detect_answer_regions(self, image: Image.Image) -> List[Tuple[int, int, int, int]]:
        """
        Detect potential answer regions (handwritten blocks).
        """
        img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(thresh, connectivity=8)

        boxes = []
        for i in range(1, num_labels):
            x, y, w, h, area = stats[i]
            if area < 500:  # min_area
                continue
            aspect = w / h if h > 0 else 0
            if aspect < 0.2 or aspect > 5:  # aspect_ratio
                continue
            # Additional filters for handwriting (simplified)
            boxes.append((x, y, x + w, y + h))

        return boxes

    def _detect_red_marks(self, image: Image.Image) -> List[Tuple[int, int]]:
        """
        Detect red ink marks (teacher corrections).
        """
        img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        hsv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2HSV)

        lower_red1 = np.array([0, 70, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 70, 50])
        upper_red2 = np.array([180, 255, 255])

        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        red_mask = mask1 + mask2

        contours, _ = cv2.findContours(red_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        marks = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 20:  # filter by size
                continue
            M = cv2.moments(contour)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                marks.append((cx, cy))

        return marks

    def _match_marks_to_answers(
        self,
        answer_boxes: List[Tuple[int, int, int, int]],
        red_marks: List[Tuple[int, int]]
    ) -> List[Tuple[int, int, int, int]]:
        """
        Match red marks to the nearest answer boxes within threshold.
        """
        matched = set()
        threshold = 150  # px

        for mark in red_marks:
            mx, my = mark
            min_dist = float('inf')
            closest_box = None
            for box in answer_boxes:
                bx1, by1, bx2, by2 = box
                cx = (bx1 + bx2) / 2
                cy = (by1 + by2) / 2
                dist = ((mx - cx) ** 2 + (my - cy) ** 2) ** 0.5
                if dist < min_dist and dist < threshold:
                    min_dist = dist
                    closest_box = box
            if closest_box:
                matched.add(closest_box)

        return list(matched)

    def _ocr_regions(
        self,
        image: Image.Image,
        boxes: List[Tuple[int, int, int, int]]
    ) -> List[str]:
        """
        OCR the specified regions.
        """
        crops = []
        for box in boxes:
            x1, y1, x2, y2 = box
            crop = image.crop((x1, y1, x2, y2))
            crops.append(crop)

        if crops:
            texts = self.trocr.ocr(crops)
            return texts
        return []

