import requests
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional
from config import MOBSF_URL, MOBSF_API_KEY

logger = logging.getLogger(__name__)

class StaticAnalyzer:
    def __init__(self, api_url=MOBSF_URL, api_key=MOBSF_API_KEY):
        self.api_url = api_url
        self.api_key = api_key
        if not self.api_key:
            logger.warning("MOBSF_API_KEY not set. Static analysis will fail.")

    def upload_apk(self, apk_path: str) -> Optional[str]:
        """
        Uploads APK to MobSF and returns the hash (scan_type).
        """
        if not os.path.exists(apk_path):
            logger.error(f"APK not found: {apk_path}")
            return None

        logger.info(f"Uploading {apk_path} to MobSF...")
        multipart_data = {
            'file': (os.path.basename(apk_path), open(apk_path, 'rb'), 'application/octet-stream')
        }
        headers = {'Authorization': self.api_key}
        
        try:
            response = requests.post(f"{self.api_url}/upload", files=multipart_data, headers=headers)
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Upload successful. Hash: {data['hash']}")
                return data['hash']
            else:
                logger.error(f"Upload failed: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error connecting to MobSF: {e}")
            return None

    def scan_apk(self, apk_hash: str) -> bool:
        """
        Triggers the scan for the uploaded APK.
        """
        logger.info(f"Scanning APK with hash {apk_hash}...")
        headers = {'Authorization': self.api_key}
        data = {'hash': apk_hash}
        
        try:
            response = requests.post(f"{self.api_url}/scan", data=data, headers=headers)
            if response.status_code == 200:
                logger.info("Scan started/completed successfully.")
                return True
            else:
                logger.error(f"Scan failed: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error scanning APK: {e}")
            return False

    def get_report(self, apk_hash: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the JSON report.
        """
        logger.info(f"Retrieving report for {apk_hash}...")
        headers = {'Authorization': self.api_key}
        data = {'hash': apk_hash}
        
        try:
            response = requests.post(f"{self.api_url}/report_json", data=data, headers=headers)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get report: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error retrieving report: {e}")
            return None

    def parse_report_for_a2(self, report: Dict[str, Any]) -> list:
        """
        Parses MobSF report into A2 format (file, line, vulnerability).
        """
        findings = []
        # Example parsing logic for MobSF 'code_analysis' section
        if 'code_analysis' in report:
            for issue_type, issues in report['code_analysis'].items():
                for issue in issues:
                    # MobSF structure varies, need to adapt based on actual output
                    # Typically: {'files': {'path/to/file': 'line_number'}, 'metadata': ...}
                    # This is a simplified parser, needs refinement based on actual MobSF JSON
                    if 'files' in issue:
                        for file_path, lines in issue['files'].items():
                            findings.append({
                                "vulnerability": issue_type,
                                "file": file_path,
                                "lines": lines,
                                "severity": issue.get('metadata', {}).get('severity', 'unknown')
                            })
        return findings
