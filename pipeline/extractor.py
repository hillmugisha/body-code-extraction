"""PDF → images → Claude Vision → structured extraction."""

import base64
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Optional
import fitz  # PyMuPDF
import anthropic
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a precision data extraction assistant for vehicle specification documents. "
    "Output must be valid JSON only — no prose, no markdown fences, no explanation. "
    "Extract exactly what is printed. Do not infer, paraphrase, or summarize."
)

TITLE_SYSTEM_PROMPT = (
    "You are a precise data extraction assistant. "
    "Return only the exact text requested — no explanation, no punctuation around it."
)


@dataclass
class ExtractedItem:
    code: str
    description: str
    msrp: str
    page_number: int
    confidence: str = "high"


@dataclass
class ExtractionResult:
    pdf_path: str
    job_id: str
    items: list[ExtractedItem] = field(default_factory=list)
    vehicle_title: str = ""
    page_range: tuple[int, int] = (0, 0)
    error: Optional[str] = None
    warnings: list[str] = field(default_factory=list)


def render_page_to_base64(pdf_path: str, page_number: int, dpi: int = 200) -> str:
    doc = fitz.open(pdf_path)
    page = doc[page_number]
    matrix = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=matrix)
    png_bytes = pix.tobytes("png")
    doc.close()
    return base64.standard_b64encode(png_bytes).decode("utf-8")


def find_section_pages(pdf_path: str, section_title: str = config.TARGET_SECTION) -> list[int]:
    """Return 0-indexed page numbers that belong to the target section."""
    doc = fitz.open(pdf_path)
    section_pages: list[int] = []
    in_section = False

    for i, page in enumerate(doc):
        text = page.get_text("text")
        if section_title in text:
            in_section = True
            section_pages.append(i)
            continue

        if in_section:
            # Check top 25% of page for continuation marker
            blocks = page.get_text("blocks")
            page_height = page.rect.height
            top_cutoff = page_height * 0.25
            top_text = " ".join(
                b[4] for b in blocks if b[1] < top_cutoff
            )
            # Also check full page text for any continuation variant
            full_text = page.get_text("text")
            is_continuation = (
                "(cont'd)" in top_text
                or "(cont" in top_text.lower()
                or "(cont'd)" in full_text
                or "as configured vehicle" in full_text.lower()
            )
            if is_continuation:
                section_pages.append(i)
            else:
                in_section = False
                break  # Stop after first section ends — multi-vehicle PDFs have multiple sections

    doc.close()

    if not section_pages:
        # Fallback: try fuzzy match
        doc = fitz.open(pdf_path)
        for i, page in enumerate(doc):
            text = page.get_text("text")
            if "as configured" in text.lower():
                section_pages.append(i)
                if len(section_pages) >= 4:
                    break
        doc.close()

    if not section_pages:
        logger.warning(f"Section '{section_title}' not found in {pdf_path}. Defaulting to pages 0-2.")
        section_pages = [0, 1, 2]

    return section_pages


def _call_claude(client: anthropic.Anthropic, system: str, user_text: str, image_b64: str) -> str:
    """Call Claude Vision with retries."""
    for attempt in range(config.MAX_RETRIES):
        try:
            response = client.messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=8192,
                system=system,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": user_text},
                    ],
                }],
            )
            return response.content[0].text
        except anthropic.AuthenticationError:
            raise
        except anthropic.RateLimitError:
            wait = 2 ** attempt
            logger.warning(f"Rate limit hit. Waiting {wait}s...")
            time.sleep(wait)
        except anthropic.APIError as e:
            wait = 2 ** attempt
            logger.warning(f"API error (attempt {attempt + 1}): {e}. Waiting {wait}s...")
            time.sleep(wait)
    raise RuntimeError(f"Claude API call failed after {config.MAX_RETRIES} retries.")


def extract_vehicle_title(pdf_path: str, client: anthropic.Anthropic) -> str:
    """Extract the vehicle title line from page 0."""
    try:
        image_b64 = render_page_to_base64(pdf_path, 0)
        prompt = (
            "Look at this vehicle specification document page. "
            "Find the vehicle title — it is a single line that starts with a model year "
            "(a 4-digit number like 2027) and ends with a vehicle base code in parentheses "
            "(e.g. '(E3F)'). "
            "Example: '2027 E-350 Cutaway Chassis 176\" WB DRW Base (E3F)'\n\n"
            "Return ONLY that title string, exactly as printed. No quotes, no explanation."
        )
        raw = _call_claude(client, TITLE_SYSTEM_PROMPT, prompt, image_b64)
        return raw.strip().strip('"').strip("'")
    except Exception as e:
        logger.warning(f"Vehicle title extraction failed: {e}")
        return ""


def _build_extraction_prompt(page_index: int, total_pages: int, prior_codes: list[str]) -> str:
    return (
        f"This image is page {page_index + 1} of {total_pages} from the "
        f"\"As Configured Vehicle\" section of a Ford vehicle specification document.\n\n"
        f"The page contains a 3-column table: Code | Description | MSRP\n\n"
        f"Extract every data row as a JSON array:\n"
        f'[{{"code": "...", "description": "...", "msrp": "...", "confidence": "high|medium|low"}}]\n\n'
        f"CRITICAL RULES:\n"
        f"1. For 'description': extract ONLY the first/main description line for each code.\n"
        f"   IGNORE any bullet points, sub-details, or 'Includes:' lists that appear below\n"
        f"   the main description line.\n"
        f"   Example: code 780A shows 'Order Code 780A' followed by bullet points —\n"
        f"   extract ONLY 'Order Code 780A'.\n"
        f"2. Skip header rows that contain the literal text 'Code', 'Description', 'MSRP'.\n"
        f"3. Skip section category rows (e.g. 'As Configured Vehicle', 'Emissions', 'Engine').\n"
        f"4. If a row has no code (description-only continuation from previous row), set code to \"\".\n"
        f"5. Set confidence='low' only if text is obscured, blurry, or ambiguous.\n"
        f"6. STOP extracting when you encounter a row whose description contains 'SUBTOTAL', 'TOTAL',\n"
        f"   or 'Destination Charge'. Do NOT extract those rows or anything after them.\n"
        f"   These are pricing summary rows at the bottom of the last page — not data rows.\n\n"
        f"Already extracted codes from prior pages (for reference): {json.dumps(prior_codes)}\n\n"
        f"Respond with ONLY the JSON array, starting with [ and ending with ]."
    )


def parse_claude_response(raw: str, page_number: int) -> list[dict]:
    """Three-stage fallback JSON parser."""
    text = raw.strip()

    # Stage 1: direct parse
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    # Stage 2: extract between outermost [ and ]
    try:
        start = text.index("[")
        end = text.rindex("]") + 1
        data = json.loads(text[start:end])
        if isinstance(data, list):
            return data
    except (ValueError, json.JSONDecodeError):
        pass

    # Stage 3: line-by-line scan for {"code": ...} objects
    items = []
    pattern = re.compile(r'\{[^{}]+\}')
    for match in pattern.finditer(text):
        try:
            obj = json.loads(match.group())
            if "code" in obj or "description" in obj:
                items.append(obj)
        except json.JSONDecodeError:
            pass

    if items:
        return items

    logger.warning(f"parse_claude_response: all 3 stages failed for page {page_number}. Raw: {text[:200]}")
    return []


def deduplicate_items(items: list[ExtractedItem]) -> list[ExtractedItem]:
    """Merge continuation rows and remove cross-page duplicates."""
    # Merge code="" continuations into preceding item
    merged: list[ExtractedItem] = []
    for item in items:
        if item.code == "" and merged:
            merged[-1].description = merged[-1].description.rstrip() + " " + item.description.strip()
        else:
            merged.append(item)

    # Remove exact code duplicates (keep first occurrence)
    seen: set[str] = set()
    deduped: list[ExtractedItem] = []
    for item in merged:
        if item.code and item.code in seen:
            logger.debug(f"Duplicate code skipped: {item.code}")
            continue
        if item.code:
            seen.add(item.code)
        deduped.append(item)

    return deduped


def extract_from_pdf(pdf_path: str, job_id: str) -> ExtractionResult:
    result = ExtractionResult(pdf_path=pdf_path, job_id=job_id)
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

    try:
        # Find relevant pages
        section_pages = find_section_pages(pdf_path)
        if not section_pages:
            result.error = "section_not_found"
            return result

        result.page_range = (section_pages[0], section_pages[-1])

        # Extract vehicle title from page 0
        result.vehicle_title = extract_vehicle_title(pdf_path, client)
        logger.info(f"Vehicle title: {result.vehicle_title}")

        # Extract items page by page
        all_items: list[ExtractedItem] = []
        prior_codes: list[str] = []

        for page_idx, page_number in enumerate(section_pages):
            logger.info(f"Processing page {page_number + 1} ({page_idx + 1}/{len(section_pages)})")
            try:
                image_b64 = render_page_to_base64(pdf_path, page_number)
                prompt = _build_extraction_prompt(page_idx, len(section_pages), prior_codes)
                raw = _call_claude(client, SYSTEM_PROMPT, prompt, image_b64)
                parsed = parse_claude_response(raw, page_number)

                for raw_item in parsed:
                    item = ExtractedItem(
                        code=str(raw_item.get("code", "")).strip(),
                        description=str(raw_item.get("description", "")).strip(),
                        msrp=str(raw_item.get("msrp", "")).strip(),
                        page_number=page_number + 1,
                        confidence=raw_item.get("confidence", "high")
                            if raw_item.get("confidence") in ("high", "medium", "low") else "high",
                    )
                    all_items.append(item)
                    if item.code:
                        prior_codes.append(item.code)

            except Exception as e:
                logger.error(f"Failed to process page {page_number}: {e}")
                result.warnings.append(f"page_{page_number}_failed: {e}")

        # Deduplicate
        deduped = deduplicate_items(all_items)

        # Cross-validate codes against PDF text layer to filter hallucinations
        doc_validate = fitz.open(pdf_path)
        section_text = "".join(doc_validate[p].get_text("text") for p in section_pages)
        doc_validate.close()

        validated: list[ExtractedItem] = []
        for item in deduped:
            if not item.code:
                validated.append(item)  # keep code-less continuation rows
            elif item.code in section_text:
                validated.append(item)
            else:
                logger.warning(f"Hallucinated code filtered: '{item.code}' not found in PDF text layer")
                result.warnings.append(f"hallucinated_code_filtered: {item.code}")

        result.items = validated

        count = len(result.items)
        if count < 5:
            result.warnings.append(f"low_item_count: {count} items (expected 5+)")
        elif count > 120:
            result.warnings.append(f"high_item_count: {count} items (expected <120)")

    except Exception as e:
        logger.error(f"extract_from_pdf failed: {e}")
        result.error = str(e)

    return result
