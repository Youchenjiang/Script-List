import requests
import os
from PIL import Image
from natsort import natsorted # 用於自然的檔案排序

# --- 預設設定 ---
# 圖片總數 (僅用於手動模式)
DEFAULT_TOTAL_IMAGES = 41
# 儲存圖片的資料夾名稱
DEFAULT_IMAGE_FOLDER = "downloaded_images"
# 最終輸出的 PDF 檔案名稱
DEFAULT_OUTPUT_PDF = "output.pdf"
# 自動模式: 連續失敗幾次後停止
MAX_CONSECUTIVE_FAILURES = 3
# --- 設定結束 ---

def download_single_image(url, file_path):
    """下載單張圖片
    
    Args:
        url: 圖片的 URL
        file_path: 儲存圖片的完整路徑
        
    Returns:
        bool: 下載成功返回 True，失敗返回 False
    """
    try:
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code == 200:
            with open(file_path, 'wb') as f:
                f.write(response.content)
            return True
        else:
            print(f"找不到圖片 (狀態碼: {response.status_code})")
            return False
    except requests.exceptions.RequestException as e:
        print(f"下載時發生錯誤: {e}")
        return False

def download_images_manual(base_url, total_images, output_folder):
    """手動模式: 下載指定數量的圖片
    
    Args:
        base_url: 基礎 URL
        total_images: 要下載的圖片總數
        output_folder: 儲存圖片的資料夾
    """
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        print(f"已建立資料夾: {output_folder}")

    print(f"開始下載圖片 (手動模式: 1-{total_images})...")
    success_count = 0
    
    for i in range(1, total_images + 1):
        image_url = f"{base_url}{i}.jpg"
        file_path = os.path.join(output_folder, f"{i}.jpg")
        
        print(f"下載 {i}.jpg...", end=" ")
        if download_single_image(image_url, file_path):
            print("✓ 成功")
            success_count += 1
        else:
            print("✗ 失敗")
    
    print(f"\n下載完成！成功: {success_count}/{total_images}")

def download_images_auto(base_url, output_folder, max_failures=3):
    """自動模式: 自動偵測並下載所有可用圖片
    
    Args:
        base_url: 基礎 URL
        output_folder: 儲存圖片的資料夾
        max_failures: 連續失敗幾次後停止
        
    Returns:
        int: 成功下載的圖片數量
    """
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        print(f"已建立資料夾: {output_folder}")

    print("開始下載圖片 (自動模式: 持續下載直到找不到圖片)...")
    i = 1
    consecutive_failures = 0
    success_count = 0
    
    while consecutive_failures < max_failures:
        image_url = f"{base_url}{i}.jpg"
        file_path = os.path.join(output_folder, f"{i}.jpg")
        
        print(f"下載 {i}.jpg...", end=" ")
        if download_single_image(image_url, file_path):
            print("✓ 成功")
            success_count += 1
            consecutive_failures = 0
        else:
            print("✗ 失敗")
            consecutive_failures += 1
        
        i += 1
    
    print(f"\n自動下載完成！共成功下載 {success_count} 張圖片")
    return success_count

def create_pdf(image_folder, output_pdf):
    """將資料夾中的圖片合併成一個 PDF
    
    Args:
        image_folder: 圖片資料夾路徑
        output_pdf: 輸出 PDF 檔案名稱
    """
    image_files = [f for f in os.listdir(image_folder) if f.endswith('.jpg')]
    
    # 使用 natsorted 確保檔案順序是 1.jpg, 2.jpg, ..., 10.jpg 而不是 1.jpg, 10.jpg, 2.jpg
    image_files = natsorted(image_files)
    
    if not image_files:
        print("在資料夾中找不到任何圖片，無法建立 PDF。")
        return

    print("\n開始將圖片合併為 PDF...")
    
    image_list = []
    # 開啟第一張圖片
    first_image_path = os.path.join(image_folder, image_files[0])
    img1 = Image.open(first_image_path).convert('RGB')
    
    # 開啟剩餘的圖片並加入列表
    for image_file in image_files[1:]:
        image_path = os.path.join(image_folder, image_file)
        img = Image.open(image_path).convert('RGB')
        image_list.append(img)
        
    # 將所有圖片儲存成一個 PDF
    img1.save(output_pdf, save_all=True, append_images=image_list)
    
    print(f"成功建立 PDF: {output_pdf}")

if __name__ == "__main__":
    print("=" * 50)
    print("圖片下載與 PDF 轉換工具")
    print("=" * 50)
    
    # 讓使用者輸入 BASE_URL
    base_url = input("\n請輸入圖片基礎 URL (不包含數字和 .jpg): ").strip()
    if not base_url:
        print("錯誤: URL 不能為空!")
        exit(1)
    
    # 讓使用者選擇輸出資料夾
    image_folder = input(f"\n輸出資料夾名稱 [預設: {DEFAULT_IMAGE_FOLDER}]: ").strip()
    if not image_folder:
        image_folder = DEFAULT_IMAGE_FOLDER
    
    # 讓使用者選擇 PDF 檔名
    output_pdf = input(f"PDF 檔案名稱 [預設: {DEFAULT_OUTPUT_PDF}]: ").strip()
    if not output_pdf:
        output_pdf = DEFAULT_OUTPUT_PDF
    
    # 選擇下載模式
    print("\n選擇下載模式:")
    print("1. 自動模式 - 自動偵測並下載所有可用圖片 (推薦)")
    print("2. 手動模式 - 下載指定數量的圖片")
    
    mode = input("\n請選擇模式 (1/2) [預設: 1]: ").strip()
    
    print("\n" + "=" * 50)
    
    if mode == "2":
        # 手動模式
        total = input(f"請輸入要下載的圖片總數 [預設: {DEFAULT_TOTAL_IMAGES}]: ").strip()
        total_images = int(total) if total.isdigit() else DEFAULT_TOTAL_IMAGES
        download_images_manual(base_url, total_images, image_folder)
    else:
        # 自動模式 (預設)
        download_images_auto(base_url, image_folder, MAX_CONSECUTIVE_FAILURES)
    
    # 將下載的圖片合併成 PDF
    create_pdf(image_folder, output_pdf)
    
    print("\n" + "=" * 50)
    print("完成!")
    print("=" * 50)
