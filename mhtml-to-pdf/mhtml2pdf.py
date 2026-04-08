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
        print("[1/6] Launching browser...", flush=True)
        try:
            browser = await p.chromium.launch()
        except Exception:
            print("Error: Chromium not found. Please run 'playwright install chromium'.", flush=True)
            return

        print("[2/6] Preparing browser context (Offline Mode)...", flush=True)
        # offline=True blocks internet but allows local/archive resource resolution
        # java_script_enabled=True is required for add_style_tag to signal completion
        context = await browser.new_context(
            java_script_enabled=True,
            offline=True
        )
        page = await context.new_page()

        file_url = Path(input_path).resolve().as_uri()
        print(f"[3/6] Loading MHTML file: {input_path}...", flush=True)
        
        try:
            # Using domcontentloaded for MHTML stability
            await page.goto(file_url, wait_until="domcontentloaded", timeout=timeout_ms)
            print("      - Page content loaded.", flush=True)
            
            # Count slides for progress indication
            slide_count = await page.locator(".slide").count()
            if slide_count == 0:
                slide_count = await page.locator(".slide-content").count()
            
            if slide_count > 0:
                print(f"      - Detected {slide_count} slides.", flush=True)

            print("[4/6] Waiting for slide rendering...", flush=True)
            try:
                await page.wait_for_selector(".slide-content", timeout=5000)
            except Exception:
                pass

            if wait_after_load_ms > 0:
                print(f"      - Buffering for {wait_after_load_ms}ms to settle images...", flush=True)
                await page.wait_for_timeout(wait_after_load_ms)

        except Exception as e:
            print(f"Error: Failed to load MHTML within {timeout_ms}ms: {e}", flush=True)
            await browser.close()
            return

        print("[5/6] Injecting layout correction CSS...", flush=True)
        try:
            # With offline=True and JS enabled, this should complete correctly.
            # Adding a 10s timeout to this specific step just in case.
            await page.add_style_tag(content=FIX_CSS, timeout=10000)
        except Exception as e:
            print(f"      - Warning: CSS injection timed out but proceeding: {e}", flush=True)

        print(f"[6/6] Generating PDF (A4 Landscape): {output_path}...", flush=True)
        print("      - This may take a moment for large presentations...", flush=True)
        try:
            await page.pdf(
                path=output_path,
                format="A4",
                landscape=True,
                print_background=True,
                prefer_css_page_size=True,
                display_header_footer=False,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
            )
            print("\n[✔] Successfully exported PDF!", flush=True)
        except Exception as e:
            print(f"Error during PDF generation: {e}", flush=True)

        await browser.close()

@click.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output', '-o', help='Path to output PDF file. Defaults to same name as input.')
@click.option('--timeout', '-t', default=30000, help='Max timeout in milliseconds (default: 30000).')
@click.option('--wait-after-load', '-w', default=1000, help='Wait time after load in milliseconds (default: 1000).')
def main(input_file, output, timeout, wait_after_load):
    """
    Convert MHTML (Google Slides export) to A4 PDF with proper layout fixes.
    """
    if not input_file.lower().endswith('.mhtml'):
        print("Error: Input file must be an .mhtml file.", flush=True)
        sys.exit(1)
        
    if not output:
        output = os.path.splitext(input_file)[0] + ".pdf"
    
    try:
        asyncio.run(convert_mhtml_to_pdf(input_file, output, timeout, wait_after_load))
    except Exception as e:
        print(f"An error occurred: {e}", flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
