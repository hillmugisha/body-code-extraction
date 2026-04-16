import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# API keys
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Paths
BASE_DIR = Path(__file__).parent
INPUT_DIR = BASE_DIR / "input"
OUTPUT_DIR = BASE_DIR / "output"
TEMPLATE_PATH = BASE_DIR / "templates" / "Ryder Quote Template.xlsx"
LOG_PATH = BASE_DIR / "logs" / "pipeline.log"
LOGO_PATH = BASE_DIR / "Pritchard Commercial Logo.png"

# Extraction settings
IMAGE_DPI = 200
MAX_RETRIES = 3
CLAUDE_MODEL = "claude-sonnet-4-6"

# Excel layout — SPO Quote sheet
SPO_SHEET = "SPO Quote"
ACTION_COL = 1   # Column A
LINENO_COL = 2   # Column B
CODE_COL = 3     # Column C  (Data code)
DESC_COL = 4     # Column D  (Description)
PRICE_COL = 5    # Column E  (Price)
COMP_COL = 6     # Column F  (component)

DATA_START_ROW = 4       # First extracted item row
TITLE_ROW = 3            # Vehicle title row
PRESERVE_FROM_ROW = 31   # Rows 31-57 must not be overwritten

# Row locations of pricing labels (keep label, clear value)
TOTAL_ROW = 31
UPFIT_TOTAL_ROW = 42
GRAND_TOTAL_ROW = 43

TARGET_SECTION = "As Configured Vehicle"

# Accuracy confidence weights
CONFIDENCE_WEIGHTS = {"high": 1.0, "medium": 0.85, "low": 0.60}
