import os
import requests
import zipfile
import io
from pathlib import Path

def setup_jadx():
    version = "1.5.0"
    url = f"https://github.com/skylot/jadx/releases/download/v{version}/jadx-{version}.zip"
    install_dir = Path("tools/jadx")
    
    if install_dir.exists():
        print(f"JADX directory {install_dir} already exists.")
        return str(install_dir / "bin" / "jadx.bat")

    install_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Downloading JADX v{version} from {url}...")
    try:
        r = requests.get(url)
        r.raise_for_status()
        print("Download complete. Extracting...")
        
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            z.extractall(install_dir)
            
        print("Extraction complete.")
        
        jadx_bat = install_dir / "bin" / "jadx.bat"
        if jadx_bat.exists():
            print(f"Verified jadx.bat at: {jadx_bat}")
            return str(jadx_bat)
        else:
            print("Error: jadx.bat not found after extraction.")
            return None
            
    except Exception as e:
        print(f"Failed to setup JADX: {e}")
        return None

if __name__ == "__main__":
    setup_jadx()
