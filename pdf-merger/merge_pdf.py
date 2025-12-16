import sys
import os
import glob
import argparse
from pypdf import PdfWriter

def collect_files(input_paths):
    pdf_files = []
    
    for path in input_paths:
        if os.path.isfile(path):
            if path.lower().endswith('.pdf'):
                pdf_files.append(path)
            else:
                print(f"Warning: '{path}' is not a PDF file. Skipped.")
        elif os.path.isdir(path):
            print(f"Scanning directory: {path}")
            # key=os.path.getmtime could be an option, but name sort is safer default
            found = sorted(glob.glob(os.path.join(path, "*.pdf"))) 
            if found:
                pdf_files.extend(found)
            else:
                print(f"Warning: No PDF files found in '{path}'.")
        else:
            print(f"Warning: '{path}' not found. Skipped.")
            
    return pdf_files

def merge_pdfs(files, output_path):
    merger = PdfWriter()
    
    try:
        for pdf in files:
            print(f"Adding: {pdf}")
            merger.append(pdf)
        
        print(f"Writing to: {output_path}")
        merger.write(output_path)
        merger.close()
        print("Done!")
    except Exception as e:
        print(f"Error merging PDFs: {e}")

def main():
    parser = argparse.ArgumentParser(description="Merge multiple PDF files into one.")
    parser.add_argument("inputs", nargs="+", help="Input files or directories")
    parser.add_argument("-o", "--output", default="merged.pdf", help="Output PDF filename (default: merged.pdf)")
    
    args = parser.parse_args()
    
    files = collect_files(args.inputs)
    
    if not files:
        print("No PDF files found to merge.")
        sys.exit(0)
        
    print(f"\nFound {len(files)} files to merge:")
    for f in files:
        print(f" - {f}")
        
    print(f"\nOutput file: {args.output}")
    
    try:
        input("\nPress Enter to start merging (or Ctrl+C to abort)...")
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(0)
        
    merge_pdfs(files, args.output)

if __name__ == "__main__":
    main()
