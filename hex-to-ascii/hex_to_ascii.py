import argparse
import sys

def hex_to_ascii(hex_str: str) -> str:
    """Convert a hexadecimal string to ASCII characters."""
    # Remove any common separators or prefixes
    clean_hex = hex_str.replace(' ', '').replace(',', '').replace('0x', '').replace('\\x', '')
    
    try:
        # Convert hex to bytes, then decode to utf-8
        bytes_obj = bytes.fromhex(clean_hex)
        # Using 'replace' to safely handle characters that might not be perfectly valid UTF-8
        return bytes_obj.decode('utf-8', errors='replace')
    except ValueError as e:
        print(f"Error: Invalid hexadecimal string. {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Convert Hexadecimal to ASCII characters.")
    parser.add_argument('-t', '--text', type=str, help='The hexadecimal string to convert')
    parser.add_argument('-f', '--file', type=str, help='Read hexadecimal string from a file')
    
    args = parser.parse_args()
    
    hex_input = ""
    if args.file:
        try:
            with open(args.file, 'r', encoding='utf-8') as f:
                hex_input = f.read().strip()
        except Exception as e:
            print(f"Error reading file {args.file}: {e}", file=sys.stderr)
            sys.exit(1)
    elif args.text:
        hex_input = args.text
    else:
        # If no arguments provided, check if piped from stdin
        if not sys.stdin.isatty():
            hex_input = sys.stdin.read().strip()
        else:
            parser.print_help()
            sys.exit(1)
            
    if not hex_input:
        print("Error: No input provided.", file=sys.stderr)
        sys.exit(1)
        
    result = hex_to_ascii(hex_input)
    print(result)

if __name__ == '__main__':
    main()
