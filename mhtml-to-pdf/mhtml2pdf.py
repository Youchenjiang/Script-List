import os
import sys
import asyncio
from playwright.async_api import async_playwright
import click

# CSS to fix Google Slides MHTML layout issues for A4 printing
# Based on working solution from cursor_mhtml.md
FIX_CSS = """
@media print {
    @page { 
        size: A4 landscape; 
        margin: 0; 
    }

    html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
    }

    /* Each slide container: center horizontally, align to top */
    .slide {
        width: 100% !important;
        min-height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        justify-content: center !important;   /* Horizontal center */
        align-items: flex-start !important;   /* Align to top */
        break-after: page !important;
        page-break-after: always !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
    }

    .slide:last-child {
        break-after: auto !important;
        page-break-after: auto !important;
    }

    /* Reset margin and ensure background images show correctly */
    .slide-content {
        margin: 0 !important;
        width: 960px !important;
        height: 540px !important;
        background-repeat: no-repeat !important;
        background-size: 100% 100% !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    .offscreen-header { 
        display: none !important; 
    }
}
"""

async def convert_mhtml_to_pdf(input_path, output_path):
    """
    Automates a Chromium browser to open an MHTML file, inject corrective CSS,
    and export it as a high-quality A4 PDF.
    """
    async with async_playwright() as p:
        # Launch browser headless
        try:
            browser = await p.chromium.launch()
        except Exception:
            print("Error: Chromium not found. Please run 'playwright install chromium'.")
            return

        context = await browser.new_context()
        page = await context.new_page()

        # Load the MHTML file
        # Convert path to absolute file URI for the browser
        abs_path = os.path.abspath(input_path)
        file_url = f"file:///{abs_path.replace(os.sep, '/')}"
        
        print(f"Loading {input_path}...")
        try:
            # wait_until="networkidle" ensures all resources (background images) are loaded
            await page.goto(file_url, wait_until="networkidle", timeout=60000)
        except Exception as e:
            print(f"Failed to load MHTML: {e}")
            await browser.close()
            return

        # Inject corrective CSS to fix the layout and backgrounds
        await page.add_style_tag(content=FIX_CSS)

        # Print to PDF with specific settings for A4 Landscape
        print(f"Exporting to {output_path}...")
        await page.pdf(
            path=output_path,
            format="A4",
            landscape=True,
            print_background=True,
            display_header_footer=False,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
        )

        await browser.close()
        print("Successfully exported PDF!")

@click.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output', '-o', help='Path to output PDF file. Defaults to same name as input.')
def main(input_file, output):
    """
    Convert MHTML (Google Slides export) to A4 PDF with proper layout fixes.
    
    This tool solves common issues:
    1. Disappearing background images.
    2. Multiple slides clipped or merged on one page.
    3. Alignment and white-space issues on A4 paper.
    """
    if not input_file.lower().endswith('.mhtml'):
        print("Error: Input file must be an .mhtml file.")
        sys.exit(1)
        
    if not output:
        output = os.path.splitext(input_file)[0] + ".pdf"
    
    try:
        asyncio.run(convert_mhtml_to_pdf(input_file, output))
    except ImportError:
        print("Error: Missing dependencies. Run: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
