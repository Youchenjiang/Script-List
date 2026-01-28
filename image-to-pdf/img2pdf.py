import os
from PIL import Image
from natsort import natsorted

DEFAULT_OUTPUT_PDF = "output.pdf"

def create_pdf(image_folder, output_pdf):
    """將資料夾中的圖片合併成一個 PDF
    
    Args:
        image_folder: 圖片資料夾路徑
        output_pdf: 輸出 PDF 檔案名稱
    """
    if not os.path.exists(image_folder):
        print(f"錯誤: 資料夾 '{image_folder}' 不存在。")
        return

    # 支援的圖片格式
    supported_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.gif')
    image_files = [f for f in os.listdir(image_folder) if f.lower().endswith(supported_extensions)]
    
    # 使用 natsorted 確保檔案順序是自然排序
    image_files = natsorted(image_files)
    
    if not image_files:
        print(f"在 '{image_folder}' 中找不到任何支援的圖片 ({supported_extensions})。")
        return

    print(f"\n找到 {len(image_files)} 張圖片，開始合併為 PDF...")
    
    image_list = []
    first_image = None

    for i, image_file in enumerate(image_files):
        image_path = os.path.join(image_folder, image_file)
        try:
            img = Image.open(image_path).convert('RGB')
            if first_image is None:
                first_image = img
            else:
                image_list.append(img)
            print(f"加入圖片: {image_file}")
        except Exception as e:
            print(f"無法讀取圖片 {image_file}: {e}")

    if first_image:
        try:
            first_image.save(output_pdf, save_all=True, append_images=image_list)
            print(f"\n成功建立 PDF: {os.path.abspath(output_pdf)}")
        except Exception as e:
            print(f"\n建立 PDF 時發生錯誤: {e}")
    else:
        print("\n沒有成功讀取任何圖片，無法建立 PDF。")

if __name__ == "__main__":
    print("=" * 50)
    print("圖片合併 PDF 工具")
    print("=" * 50)
    
    # 讓使用者輸入圖片資料夾
    while True:
        image_folder = input("\n請輸入圖片資料夾路徑 [預設: 當前目錄]: ").strip()
        if not image_folder:
            image_folder = "."
        
        if os.path.isdir(image_folder):
            break
        else:
            print("錯誤: 輸入的路徑不是一個有效的資料夾，請重試。")

    # 讓使用者選擇 PDF 檔名
    output_pdf = input(f"PDF 檔案名稱 [預設: {DEFAULT_OUTPUT_PDF}]: ").strip()
    if not output_pdf:
        output_pdf = DEFAULT_OUTPUT_PDF
    
    # 確保檔名有 .pdf 副檔名
    if not output_pdf.lower().endswith('.pdf'):
        output_pdf += ".pdf"

    # 如果輸出的路徑不是絕對路徑，則將其設為圖片資料夾下的路徑
    if not os.path.isabs(output_pdf):
        output_pdf = os.path.join(image_folder, output_pdf)

        
    create_pdf(image_folder, output_pdf)
    
    print("\n" + "=" * 50)
    input("按 Enter 鍵退出...")
