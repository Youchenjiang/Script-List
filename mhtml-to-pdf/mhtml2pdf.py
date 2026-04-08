import os
import sys
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
import click

def get_fix_css():
    """Generates the CSS to securely fix layout sizes."""
    return f"""
@media print {{
    @page {{ margin: 0; }}

    html, body {{
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
    }}

    /* Each slide container: center horizontally, align to top */
    .slide {{
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
    }}

    .slide:last-child {{
        break-after: auto !important;
        page-break-after: auto !important;
    }}

    /* Reset margin and ensure background images show correctly */
    .slide-content {{
        margin: 0 !important;
        width: 960px !important;
        height: 540px !important;
        background-repeat: no-repeat !important;
        background-size: 100% 100% !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }}

    .offscreen-header {{ 
        display: none !important; 
    }}
}}
"""

async def convert_mhtml_to_pdf(input_path, output_path, paper="A4"):
    """
    Automates a Chromium browser to open an MHTML file, inject corrective CSS,
    and export it as a high-quality PDF.
    """
    async with async_playwright() as p:
        print("[1/6] Launching browser...", flush=True)
        try:
            browser = await p.chromium.launch()
        except Exception:
            print("Error: Chromium not found. Please run 'playwright install chromium'.", flush=True)
            sys.exit(1)

        try:
            print("[2/6] Preparing browser context (Offline Mode)...", flush=True)
            context = await browser.new_context(
                java_script_enabled=True,
                offline=True
            )
            page = await context.new_page()

            file_url = Path(input_path).resolve().as_uri()
            print(f"[3/6] Loading MHTML file: {input_path}...", flush=True)
            
            try:
                # Using domcontentloaded for MHTML stability
                await page.goto(file_url, wait_until="domcontentloaded", timeout=30000)
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

                print(f"      - Buffering for 1000ms to settle images...", flush=True)
                await page.wait_for_timeout(1000)

            except Exception as e:
                print(f"Error: Failed to load MHTML within 30000ms: {e}", flush=True)
                sys.exit(1)

            print("[5/6] Injecting layout correction CSS...", flush=True)
            try:
                # Injecting CSS via evaluate avoids Playwright's internal add_style_tag 
                # waiting mechanisms that hang on MHTML/offline modes.
                css_content = get_fix_css()
                await page.evaluate(f'''
                    const style = document.createElement('style');
                    style.textContent = `{css_content}`;
                    document.head.appendChild(style);
                ''')
            except Exception as e:
                print(f"      - Warning: CSS injection failed: {e}", flush=True)

            print(f"[6/6] Generating PDF ({paper.upper()} Format): {output_path}...", flush=True)
            print("      - This may take a moment for large presentations...", flush=True)
            try:
                pdf_kwargs = {
                    "path": output_path,
                    "print_background": True,
                    "display_header_footer": False,
                    "margin": {"top": "0", "right": "0", "bottom": "0", "left": "0"}
                }
                
                if paper.lower() == '16:9':
                    pdf_kwargs["width"] = "960px"
                    pdf_kwargs["height"] = "540px"
                else:  # A4
                    pdf_kwargs["format"] = "A4"
                    pdf_kwargs["landscape"] = True
                    pdf_kwargs["scale"] = 1.168

                await page.pdf(**pdf_kwargs)
                print("\n[✔] Successfully exported PDF!", flush=True)
            except Exception as e:
                print(f"Error during PDF generation: {e}", flush=True)
                sys.exit(1)
        finally:
            await browser.close()

@click.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output', '-o', help='Path to output PDF file. Defaults to same name as input.')
@click.option('--paper', '-p', type=click.Choice(['A4', '16:9'], case_sensitive=False), default='A4', help='Paper format (A4 or 16:9).')
def main(input_file, output, paper):
    """
    Convert MHTML (Google Slides export) to PDF with proper layout fixes.
    """
    if not input_file.lower().endswith('.mhtml'):
        print("Error: Input file must be an .mhtml file.", flush=True)
        sys.exit(1)
        
    if not output:
        output = os.path.splitext(input_file)[0] + ".pdf"
    
    try:
        asyncio.run(convert_mhtml_to_pdf(input_file, output, paper))
    except SystemExit:
        raise
    except Exception as e:
        print(f"An unexpected error occurred: {e}", flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
