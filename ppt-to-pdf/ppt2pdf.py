import sys
import os
import glob
import comtypes.client

def get_pdf_path(input_path):
    return os.path.splitext(input_path)[0] + ".pdf"

def ppt_to_pdf(powerpoint, input_path):
    output_path = get_pdf_path(input_path)
    
    # Double check just in case
    if os.path.exists(output_path):
        print(f"Skipping {input_path}, PDF already exists.")
        return

    try:
        deck = powerpoint.Presentations.Open(os.path.abspath(input_path))
        deck.SaveAs(os.path.abspath(output_path), 32) # 32 is the format type for PDF
        deck.Close()
        print(f"Converted {input_path} to {output_path}")
    except Exception as e:
        print(f"Failed to convert {input_path}: {e}")

def collect_files(input_items):
    files_to_convert = []
    skipped_count = 0
    
    for input_item in input_items:
        current_batch = []
        if os.path.isfile(input_item):
             if input_item.lower().endswith(('.ppt', '.pptx')):
                 current_batch.append(input_item)
             else:
                print(f"Ignored {input_item}: Not a PowerPoint file.")
        elif os.path.isdir(input_item):
            print(f"Scanning directory: {input_item}")
            # Search for both .ppt and .pptx files
            current_batch = glob.glob(os.path.join(input_item, "*.ppt")) + glob.glob(os.path.join(input_item, "*.pptx"))
        else:
            print(f"Error: {input_item} is not a valid file or directory.")
            continue

        # Filter batch
        for f in current_batch:
            if os.path.basename(f).startswith('~$'):
                # Silent skip for temp files
                continue
            
            pdf_path = get_pdf_path(f)
            if os.path.exists(pdf_path):
                skipped_count += 1
                continue
            
            files_to_convert.append(f)

    return files_to_convert, skipped_count

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ppt2pdf.py <file_or_directory> [<file_or_directory> ...]")
        sys.exit(1)

    input_paths = sys.argv[1:]
    files, skipped = collect_files(input_paths)

    if skipped > 0:
        print(f"Skipped {skipped} files (PDF already exists).")

    count = len(files)
    if count == 0:
        print("Found 0 files to convert.")
        sys.exit(0)

    print(f"Found {count} files to convert.")
    user_input = input("Press Enter to continue (or Ctrl+C to abort)...")

    # Initialize COM only if we have work to do and user approved
    powerpoint = comtypes.client.CreateObject("PowerPoint.Application")
    powerpoint.Visible = 1

    try:
        for f in files:
            ppt_to_pdf(powerpoint, f)
    finally:
        powerpoint.Quit()
