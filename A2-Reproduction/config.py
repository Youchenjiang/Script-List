import os
from pathlib import Path
from dotenv import load_dotenv

# Load env vars from .env file
load_dotenv()

# Project Root
PROJECT_ROOT = Path(__file__).parent.absolute()

# Directories
OUTPUT_DIR = PROJECT_ROOT / "output"
TEMP_DIR = PROJECT_ROOT / "temp"

# Tools
JADX_PATH = str(PROJECT_ROOT / "tools" / "jadx" / "bin" / "jadx.bat")

# API Keys (Load from environment variables for security)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
SILICONFLOW_API_KEY = os.getenv("SILICONFLOW_API_KEY")
SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
SILICONFLOW_MODEL = "Qwen/Qwen2.5-7B-Instruct"
MOBSF_API_KEY = os.getenv("MOBSF_API_KEY") # Required for MobSF
MOBSF_URL = "http://localhost:8000/api/v1"

# Create directories if they don't exist
OUTPUT_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)
