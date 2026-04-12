import argparse
import base64
import sys
import os

def encode_text(text: str) -> str:
    """Encode string to base64."""
    return base64.b64encode(text.encode('utf-8')).decode('utf-8')

def decode_text(b64_str: str) -> str:
    """Decode base64 string to original string."""
    try:
        return base64.b64decode(b64_str.encode('utf-8')).decode('utf-8')
    except Exception as e:
        print(f"Error decoding text: {e}", file=sys.stderr)
        sys.exit(1)

def encode_file(file_path: str) -> str:
    """Encode file content to base64 string."""
    try:
        with open(file_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    except Exception as e:
        print(f"Error reading file {file_path}: {e}", file=sys.stderr)
        sys.exit(1)

def decode_file(b64_str: str, output_path: str):
    """Decode base64 string and write to file."""
    try:
        data = base64.b64decode(b64_str.encode('utf-8'))
        with open(output_path, 'wb') as f:
            f.write(data)
        print(f"Successfully decoded and saved to {output_path}")
    except Exception as e:
        print(f"Error decoding or writing to file: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="A versatile Base64 encoder and decoder for text and files.")
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('-e', '--encode', action='store_true', help='Encode mode')
    group.add_argument('-d', '--decode', action='store_true', help='Decode mode')
    
    parser.add_argument('-t', '--text', type=str, help='Text to encode/decode')
    parser.add_argument('-f', '--file', type=str, help='File to encode/decode (input)')
    parser.add_argument('-o', '--output', type=str, help='Output file path (saving base64 string or decoded file)')
    
    args = parser.parse_args()
    
    if not args.text and not args.file:
        print("Error: Must provide either --text (-t) or --file (-f).", file=sys.stderr)
        parser.print_help()
        sys.exit(1)
        
    if args.encode:
        if args.text:
            result = encode_text(args.text)
            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    f.write(result)
                print(f"Base64 encoded string saved to {args.output}")
            else:
                print(result)
        elif args.file:
            result = encode_file(args.file)
            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    f.write(result)
                print(f"Base64 encoded file saved to {args.output}")
            else:
                print(result)
                
    elif args.decode:
        if args.text:
            if args.output:
                decode_file(args.text, args.output)
            else:
                result = decode_text(args.text)
                print(result)
        elif args.file:
            # Read the base64 string from the input file
            try:
                with open(args.file, 'r', encoding='utf-8') as f:
                    b64_content = f.read().strip()
            except Exception as e:
                print(f"Error reading base64 file {args.file}: {e}", file=sys.stderr)
                sys.exit(1)
                
            if args.output:
                decode_file(b64_content, args.output)
            else:
                # If no output file specified, try to print decoded text
                print(decode_text(b64_content))

if __name__ == '__main__':
    main()
