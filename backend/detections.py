# analysis/detection.py

from pathlib import Path
from typing import List, Dict, Tuple, Optional
import io
import logging
import time
import os

import fitz  # PyMuPDF
import numpy as np
import cv2
from PIL import Image
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

logger = logging.getLogger(__name__)


class BaseRegionDetector:
    def detect(self, image: Image.Image):
        raise NotImplementedError


class AnswerRegionDetector(BaseRegionDetector):
    def __init__(self, config: Dict):
        self.config = config

    def detect(self, image: Image.Image) -> List[Tuple[int, int, int, int]]:
        img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            11,
            2,
        )
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(thresh, connectivity=8)

        boxes: List[Tuple[int, int, int, int]] = []
        for i in range(1, num_labels):
            x, y, w, h, area = stats[i]
            if area < self.config["min_area"]:
                continue
            aspect = w / h if h > 0 else 0
            if aspect < 0.2 or aspect > 5:
                continue
            boxes.append((x, y, x + w, y + h))

        return boxes


class RedMarkDetector:
    def __init__(self, config: Dict):
        self.config = config

    def detect(self, image: Image.Image) -> List[Tuple[int, int]]:
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

        marks: List[Tuple[int, int]] = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < self.config["red_area_min"]:
                continue
            M = cv2.moments(contour)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                marks.append((cx, cy))

        return marks


class MarkAnswerMatcher:
    def __init__(self, config: Dict):
        self.config = config

    def match(
        self,
        answer_boxes: List[Tuple[int, int, int, int]],
        red_marks: List[Tuple[int, int]],
    ) -> List[Tuple[int, int, int, int]]:
        matched: set[Tuple[int, int, int, int]] = set()
        threshold = self.config["match_threshold"]

        for mx, my in red_marks:
            min_dist = float("inf")
            closest_box = None
            for bx1, by1, bx2, by2 in answer_boxes:
                cx = (bx1 + bx2) / 2
                cy = (by1 + by2) / 2
                dist = ((mx - cx) ** 2 + (my - cy) ** 2) ** 0.5
                if dist < min_dist and dist < threshold:
                    min_dist = dist
                    closest_box = (bx1, by1, bx2, by2)
            if closest_box:
                matched.add(closest_box)

        return list(matched)


class OCRExtractor:
    def __init__(self, trocr: "TrOCRModel"):
        self.trocr = trocr

    def extract(
        self,
        image: Image.Image,
        boxes: List[Tuple[int, int, int, int]],
    ) -> List[str]:
        crops: List[Image.Image] = []
        for x1, y1, x2, y2 in boxes:
            crops.append(image.crop((x1, y1, x2, y2)))

        if crops:
            return self.trocr.ocr(crops)
        return []


class LayoutStrategy:
    def __init__(self, class_level: int | None):
        if class_level is None:
            self.mode = "block"
        elif class_level <= 3:
            self.mode = "fragment"
        elif class_level <= 6:
            self.mode = "block"
        else:
            self.mode = "dense"

    def adjust_boxes(self, boxes: List[Tuple[int, int, int, int]]) -> List[Tuple[int, int, int, int]]:
        adjusted: List[Tuple[int, int, int, int]] = []

        for (x1, y1, x2, y2) in boxes:
            h = y2 - y1
            if self.mode == "dense" and h > 300:
                mid = (y1 + y2) // 2
                adjusted.append((x1, y1, x2, mid))
                adjusted.append((x1, mid, x2, y2))
            else:
                adjusted.append((x1, y1, x2, y2))

        return adjusted


class DebugVisualizer:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def draw(
        self,
        image: Image.Image,
        answer_boxes: List[Tuple[int, int, int, int]],
        red_marks: List[Tuple[int, int]],
        matched_boxes: List[Tuple[int, int, int, int]],
        page_index: int,
    ) -> None:
        img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        for x1, y1, x2, y2 in answer_boxes:
            cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

        for x, y in red_marks:
            cv2.circle(img, (x, y), 5, (255, 0, 0), -1)

        for x1, y1, x2, y2 in matched_boxes:
            cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 2)

        out_path = self.output_dir / f"page_{page_index}.png"
        cv2.imwrite(str(out_path), img)


class AutoLabelDatasetBuilder:
    def __init__(self, base_dir: Path):
        self.images_dir = base_dir / "images"
        self.labels_dir = base_dir / "labels"

        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.labels_dir.mkdir(parents=True, exist_ok=True)

    def save(
        self,
        image: Image.Image,
        matched_boxes: List[Tuple[int, int, int, int]],
        page_index: int,
    ) -> None:
        img_path = self.images_dir / f"page_{page_index}.jpg"
        image.save(img_path)

        h, w = image.size[1], image.size[0]

        label_path = self.labels_dir / f"page_{page_index}.txt"
        with open(label_path, "w", encoding="utf-8") as f:
            for x1, y1, x2, y2 in matched_boxes:
                cx = ((x1 + x2) / 2) / w
                cy = ((y1 + y2) / 2) / h
                bw = (x2 - x1) / w
                bh = (y2 - y1) / h

                f.write(f"0 {cx} {cy} {bw} {bh}\n")


class YOLORegionDetector(BaseRegionDetector):
    def __init__(self, model_path: str = "yolov8n.pt"):
        try:
            from ultralytics import YOLO

            self.model = YOLO(model_path)
            self.ready = True
        except Exception:
            logger.exception("YOLO init failed")
            self.ready = False

    def detect(self, image: Image.Image) -> List[Tuple[int, int, int, int]]:
        if not self.ready:
            return []

        try:
            results = self.model(np.array(image))
            boxes: List[Tuple[int, int, int, int]] = []

            for r in results:
                for b in r.boxes.xyxy:
                    x1, y1, x2, y2 = map(int, b.tolist())
                    boxes.append((x1, y1, x2, y2))

            return boxes
        except Exception:
            logger.exception("YOLO inference failed")
            return []


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

    def __init__(self, detection_mode: str = "trocr_red_mark", dpi: int = 300, debug: bool = False):
        self.detection_mode = detection_mode
        self.dpi = dpi
        self.debug = debug
        self.trocr = get_trocr_model()
        self.save_dataset = False
        self.use_yolo = False
        self.class_level = None

        self.config = {
            "match_threshold": 150,
            "min_area": 500,
            "red_area_min": 20,
        }

        self.region_detector = AnswerRegionDetector(self.config)
        self.red_detector = RedMarkDetector(self.config)
        self.matcher = MarkAnswerMatcher(self.config)
        self.ocr_extractor = OCRExtractor(self.trocr)

        self.debug_pages: Dict[int, Dict] = {}
        self.paths = {
            "debug": Path("debug_outputs"),
            "dataset": Path("dataset"),
        }
        self.layout_strategy = LayoutStrategy(self.class_level)
        self.visualizer = DebugVisualizer(self.paths["debug"])
        self.dataset_builder = AutoLabelDatasetBuilder(self.paths["dataset"])
        yolo_model_path = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
        self.yolo_detector = YOLORegionDetector(model_path=yolo_model_path)

    def _debug_log_page(self, page_index: int, data_dict: Dict) -> None:
        if not self.debug:
            return
        self.debug_pages[page_index] = data_dict
        logger.debug("Debug page %s: %s", page_index, {k: type(v).__name__ for k, v in data_dict.items()})

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
            start_page = time.time()

            try:
                t0 = time.time()
                if self.use_yolo:
                    answer_boxes = self.yolo_detector.detect(img)
                    if not answer_boxes:
                        answer_boxes = self.region_detector.detect(img)
                else:
                    answer_boxes = self.region_detector.detect(img)
                t_region = time.time() - t0

                answer_boxes = self.layout_strategy.adjust_boxes(answer_boxes)
                total_answer_regions += len(answer_boxes)

                t1 = time.time()
                red_marks = self.red_detector.detect(img)
                t_red = time.time() - t1
                total_red_marks += len(red_marks)

                t2 = time.time()
                matched_boxes = self.matcher.match(answer_boxes, red_marks)
                t_match = time.time() - t2
                total_matched += len(matched_boxes)

                t3 = time.time()
                ocr_texts = self.ocr_extractor.extract(img, matched_boxes)
                t_ocr = time.time() - t3

                total_time = time.time() - start_page
                logger.info(
                    f"[Page {page_index + 1}] "
                    f"regions={len(answer_boxes)} "
                    f"marks={len(red_marks)} "
                    f"matched={len(matched_boxes)} "
                    f"time={round(total_time, 2)}s "
                    f"(region={round(t_region, 2)} red={round(t_red, 2)} match={round(t_match, 2)} ocr={round(t_ocr, 2)})"
                )

                if self.debug:
                    self._debug_log_page(
                        page_index,
                        {
                            "answer_boxes": answer_boxes,
                            "red_marks": red_marks,
                            "matched_boxes": matched_boxes,
                        },
                    )
                    self.visualizer.draw(img, answer_boxes, red_marks, matched_boxes, page_index)

                if self.save_dataset:
                    self.dataset_builder.save(img, matched_boxes, page_index)

                for text in ocr_texts:
                    if text.strip():
                        results.append({
                            "page": page_index + 1,
                            "text": text[:500],
                            "detection_method": "trocr_red_mark",
                            "confidence": 0.9,
                        })
            except Exception:
                logger.exception(f"Page {page_index} failed")
                continue

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
        return self.region_detector.detect(image)

    def _detect_red_marks(self, image: Image.Image) -> List[Tuple[int, int]]:
        """
        Detect red ink marks (teacher corrections).
        """
        return self.red_detector.detect(image)

    def _match_marks_to_answers(
        self,
        answer_boxes: List[Tuple[int, int, int, int]],
        red_marks: List[Tuple[int, int]]
    ) -> List[Tuple[int, int, int, int]]:
        """
        Match red marks to the nearest answer boxes within threshold.
        """
        return self.matcher.match(answer_boxes, red_marks)

    def _ocr_regions(
        self,
        image: Image.Image,
        boxes: List[Tuple[int, int, int, int]]
    ) -> List[str]:
        """
        OCR the specified regions.
        """
        return self.ocr_extractor.extract(image, boxes)

