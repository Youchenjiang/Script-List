import os
import sys
import asyncio
from pathlib import Path
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

async def convert_mhtml_to_pdf(input_path, output_path, timeout_ms=30000, wait_after_load_ms=1000):
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

        # Disable JavaScript to prevent hanging on tracking pixels or long-running scripts
        context = await browser.new_context(java_script_enabled=False)
        page = await context.new_page()

        # Load the MHTML file
        # Use Path.as_uri() for robust handling of spaces and special characters
        file_url = Path(input_path).resolve().as_uri()
        
        print(f"Loading {input_path}...")
        try:
            # wait_until="domcontentloaded" is faster and more reliable for MHTML
            await page.goto(file_url, wait_until="domcontentloaded", timeout=timeout_ms)
            
            # Ensure slides are actually present before proceeding
            try:
                await page.wait_for_selector(".slide-content", timeout=timeout_ms)
            except Exception:
                print("Warning: '.slide-content' selector not found. The file might not be a standard Google Slides export.")

            # Optional buffer to let the browser stabilize
            if wait_after_load_ms > 0:
                await page.wait_for_timeout(wait_after_load_ms)

        except Exception as e:
            print(f"Failed to load MHTML within {timeout_ms}ms: {e}")
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
            prefer_css_page_size=True,
            display_header_footer=False,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
        )

        await browser.close()
        print("Successfully exported PDF!")

@click.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output', '-o', help='Path to output PDF file. Defaults to same name as input.')
@click.option('--timeout', '-t', default=30000, help='Max timeout in milliseconds (default: 30000).')
@click.option('--wait-after-load', '-w', default=1000, help='Wait time after load in milliseconds (default: 1000).')
def main(input_file, output, timeout, wait_after_load):
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
        asyncio.run(convert_mhtml_to_pdf(input_file, output, timeout, wait_after_load))
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
