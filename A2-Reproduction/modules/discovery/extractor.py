import subprocess
import shutil
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class ResourceExtractor:
    def __init__(self, jadx_path="jadx"):
        self.jadx_path = jadx_path

    def extract_apk(self, apk_path: str, output_dir: str) -> bool:
        """
        Decompiles the APK using Jadx.
        """
        apk_path = Path(apk_path)
        output_dir = Path(output_dir)
        
        if not apk_path.exists():
            logger.error(f"APK not found: {apk_path}")
            return False

        # Clean output directory if it exists
        if output_dir.exists():
            shutil.rmtree(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Decompiling {apk_path} to {output_dir}...")
        
        try:
            # Run Jadx
            # -d: output directory
            # --no-res: do not decode resources (optional, but we mainly need code and manifest)
            # But A2 might need layout XMLs, so we keep resources.
            cmd = [self.jadx_path, "-d", str(output_dir), str(apk_path)]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            logger.info("Decompilation successful.")
            self._filter_libraries(output_dir)
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Jadx failed: {e}")
            return False
        except FileNotFoundError:
            logger.error("Jadx executable not found. Please ensure it is in your PATH.")
            return False

    def _filter_libraries(self, output_dir: Path):
        """
        Removes common third-party libraries to reduce noise and token usage.
        """
        sources_dir = output_dir / "sources"
        if not sources_dir.exists():
            return

        # List of common package prefixes to exclude
        # Based on A2 paper: android.*, google.*, okhttp.*, etc.
        exclusions = [
            "android",
            "androidx",
            "com/google",
            "com/android",
            "kotlin",
            "kotlinx",
            "okhttp3",
            "okio",
            "retrofit2",
            "io/reactivex",
            "org/apache",
            "org/json",
            "junit",
            "org/hamcrest"
        ]

        logger.info("Filtering third-party libraries...")
        
        for exclusion in exclusions:
            # Handle path separators for cross-platform compatibility
            parts = exclusion.split("/")
            target_path = sources_dir.joinpath(*parts)
            
            if target_path.exists():
                logger.debug(f"Removing {target_path}")
                shutil.rmtree(target_path)

        logger.info("Filtering complete.")
