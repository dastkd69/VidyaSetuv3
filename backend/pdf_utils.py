# analysis/pdf_utils.py

from pathlib import Path
from typing import List, Tuple
import io
import logging

import fitz  # PyMuPDF
import pytesseract
from PIL import Image, ImageEnhance

logger = logging.getLogger(__name__)

TESS_PATH = Path(__file__).parent / "tesseract" / "tesseract.exe"
pytesseract.pytesseract.tesseract_cmd = str(TESS_PATH)


class PDFTextExtractor:
    """
    Handles PDF text extraction with OCR fallback.
    Returns page-wise text suitable for downstream analysis.
    """

    def __init__(self, dpi: int = 200, min_text_length: int = 50):
        self.dpi = dpi
        self.min_text_length = min_text_length

    def extract_pages(self, pdf_path: str | Path) -> List[Tuple[str, int]]:
        """
        Extract text from all pages of a PDF.

        Returns:
            List of (text, page_number)
        """
        pdf_path = Path(pdf_path)
        pages_text: List[Tuple[str, int]] = []

        if not pdf_path.exists():
            logger.error(f"PDF not found: {pdf_path}")
            return pages_text

        try:
            doc = fitz.open(str(pdf_path))

            for page_index in range(len(doc)):
                page = doc[page_index]

                # Attempt direct text extraction
                text = page.get_text()

                # OCR fallback if text is insufficient
                if len(text.strip()) < self.min_text_length:
                    text = self._ocr_page(page)

                pages_text.append((text, page_index + 1))

            doc.close()

        except Exception as e:
            logger.exception(f"Failed to extract text from PDF: {pdf_path}")
            raise e

        return pages_text 

    def _ocr_page(self, page) -> str:
        """
        Perform OCR on a PyMuPDF page.
        """
        try:
            pix = page.get_pixmap(dpi=self.dpi)
            img_data = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_data))
            image = self._preprocess_image(image)
            return pytesseract.image_to_string(image, lang="eng")

        except Exception as e:
            logger.warning("OCR failed on page, returning empty text")
            return ""

    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """
        Enhance image for better OCR accuracy.
        """
        image = image.convert("L")  # grayscale
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
        return image
