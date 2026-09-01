#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF to Markdown Extraction Tool
Extracts textual content and metadata from PDF files into clean Markdown format.
"""

import argparse
import os
import sys
from typing import Optional


def convert_pdf_to_markdown(
    pdf_path: str,
    output_path: Optional[str] = None,
    include_pages: bool = True,
    include_metadata: bool = True
) -> str:
    try:
        import pypdf
    except ImportError:
        print("[Error] pypdf is required. Install it using: pip install pypdf", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(pdf_path):
        print(f"[Error] File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    if not output_path:
        base_name = os.path.splitext(pdf_path)[0]
        output_path = f"{base_name}.md"

    print(f"[*] Reading PDF: {pdf_path}")
    reader = pypdf.PdfReader(pdf_path)
    total_pages = len(reader.pages)
    print(f"[+] Total pages: {total_pages}")

    md_content = []

    # Title header
    doc_title = os.path.splitext(os.path.basename(pdf_path))[0]
    md_content.append(f"# {doc_title}\n")

    # Frontmatter metadata
    if include_metadata and reader.metadata:
        md_content.append("## Metadata\n")
        for key, value in reader.metadata.items():
            if value:
                clean_key = str(key).lstrip('/')
                md_content.append(f"- **{clean_key}**: {value}")
        md_content.append("\n---\n")

    # Page content extraction
    for idx, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if include_pages:
            md_content.append(f"## Page {idx}\n")
        md_content.append(text.strip())
        md_content.append("\n")

    full_output = "\n".join(md_content)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(full_output)

    print(f"[+] Markdown file saved to: {output_path}")
    print(f"[+] Size: {os.path.getsize(output_path):,} bytes")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Extract clean Markdown from PDF documents")
    parser.add_argument("pdf", help="Path to input PDF file")
    parser.add_argument("-o", "--output", help="Path to output Markdown file (default: input_name.md)")
    parser.add_argument("--no-pages", action="store_true", help="Omit '## Page N' section headers")
    parser.add_argument("--no-metadata", action="store_true", help="Omit metadata section")

    args = parser.parse_args()
    convert_pdf_to_markdown(
        pdf_path=args.pdf,
        output_path=args.output,
        include_pages=not args.no_pages,
        include_metadata=not args.no_metadata
    )


if __name__ == "__main__":
    main()
