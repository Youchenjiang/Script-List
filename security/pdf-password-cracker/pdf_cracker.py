#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
High-Performance PDF Password Cracker (Standard Security Handler R2-R4)
Supports:
- Dictionary attack with multiprocessing
- Standard encryption key derivation (MD5 + RC4, 40-bit / 128-bit)
- Fast verification without heavy third-party PDF rendering overhead
"""

import argparse
import hashlib
import multiprocessing as mp
import os
import re
import struct
import sys
import time
from typing import Dict, Optional, Tuple

PADDING = bytes([
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
    0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A,
])


def md5(data: bytes) -> bytes:
    return hashlib.md5(data).digest()


def rc4_encrypt(key: bytes, data: bytes) -> bytes:
    S = list(range(256))
    j = 0
    klen = len(key)
    for i in range(256):
        j = (j + S[i] + key[i % klen]) % 256
        S[i], S[j] = S[j], S[i]
    i = j = 0
    out = bytearray(len(data))
    for idx in range(len(data)):
        i = (i + 1) % 256
        j = (j + S[i]) % 256
        S[i], S[j] = S[j], S[i]
        out[idx] = data[idx] ^ S[(S[i] + S[j]) % 256]
    return bytes(out)


def pad_password(pw_bytes: bytes) -> bytes:
    pw = pw_bytes[:32]
    if len(pw) < 32:
        pw = pw + PADDING[:32 - len(pw)]
    return pw


def extract_encryption_params(pdf_path: str) -> Dict:
    with open(pdf_path, 'rb') as f:
        raw = f.read()

    trailer_match = re.search(rb'/Encrypt\s+(\d+)\s+\d+\s+R', raw)
    if not trailer_match:
        raise ValueError(f"No /Encrypt dictionary reference found in {pdf_path}. The file might not be encrypted.")

    obj_num = int(trailer_match.group(1))
    pat_str = r'%d\s+0\s+obj\s*(.*?)\s*endobj' % obj_num
    m = re.search(pat_str.encode(), raw, re.DOTALL)
    if not m:
        raise ValueError(f"Could not extract object {obj_num} from PDF.")

    enc_dict = m.group(1)

    u_match = re.search(rb'/U\s*<([0-9a-fA-F]+)>', enc_dict)
    o_match = re.search(rb'/O\s*<([0-9a-fA-F]+)>', enc_dict)
    p_match = re.search(rb'/P\s+(-?\d+)', enc_dict)
    r_match = re.search(rb'/R\s+(\d+)', enc_dict)
    len_match = re.search(rb'/Length\s+(\d+)', enc_dict)
    id_match = re.search(rb'/ID\s*\[\s*<([0-9a-fA-F]+)>', raw)

    if not (u_match and o_match and p_match and r_match and id_match):
        raise ValueError("Failed to parse standard encryption parameters (U, O, P, R, ID).")

    U = bytes.fromhex(u_match.group(1).decode())
    O = bytes.fromhex(o_match.group(1).decode())
    P_val = int(p_match.group(1))
    R = int(r_match.group(1))
    key_size = int(len_match.group(1)) if len_match else 40
    doc_id = bytes.fromhex(id_match.group(1).decode())

    # Pack P as 4-byte little-endian signed integer
    p_bytes = struct.pack('<i', P_val)

    return {
        'U': U,
        'O': O,
        'P': p_bytes,
        'R': R,
        'key_size': key_size,
        'key_bytes_len': key_size // 8,
        'doc_id': doc_id,
        'u_check': U[:16]
    }


def verify_password(pw_str: str, params: Dict) -> bool:
    pw_padded = pad_password(pw_str.encode('latin-1', errors='ignore'))
    hash_input = pw_padded + params['O'] + params['P'] + params['doc_id']
    h = md5(hash_input)

    R = params['R']
    key_len = params['key_bytes_len']

    if R >= 3:
        for _ in range(50):
            h = md5(h[:key_len])

    key = h[:key_len]

    if R == 2:
        test = rc4_encrypt(key, PADDING)
        return test == params['u_check']
    elif R in (3, 4):
        test = md5(PADDING + params['doc_id'])
        test = rc4_encrypt(key, test)
        for i in range(1, 20):
            k = bytes([b ^ i for b in key])
            test = rc4_encrypt(k, test)
        return test == params['u_check']
    else:
        raise NotImplementedError(f"Revision {R} handler not implemented.")


def _worker_batch(lines, params, found_event, result_queue):
    for line in lines:
        if found_event.is_set():
            return
        pw = line.rstrip('\r\n')
        if not pw:
            continue
        try:
            if verify_password(pw, params):
                found_event.set()
                result_queue.put(pw)
                return
        except Exception:
            continue


def crack_dictionary(pdf_path: str, wordlist_path: str, num_workers: int = 4, batch_size: int = 10000):
    print(f"[*] Extracting PDF encryption parameters from: {pdf_path}")
    params = extract_encryption_params(pdf_path)
    print(f"[+] Encryption format: Revision {params['R']}, Key Length: {params['key_size']}-bit")

    if not os.path.isfile(wordlist_path):
        print(f"[-] Wordlist file not found: {wordlist_path}", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Starting dictionary attack using {num_workers} processes...")
    start_time = time.time()
    tested_count = 0

    manager = mp.Manager()
    found_event = manager.Event()
    result_queue = manager.Queue()
    pool = mp.Pool(num_workers)

    try:
        with open(wordlist_path, 'r', encoding='latin-1', errors='ignore') as f:
            batch = []
            for line in f:
                batch.append(line)
                tested_count += 1
                if len(batch) >= batch_size:
                    if found_event.is_set():
                        break
                    pool.apply_async(_worker_batch, args=(batch, params, found_event, result_queue))
                    batch = []
                    if tested_count % 100000 == 0:
                        elapsed = time.time() - start_time
                        rate = tested_count / elapsed if elapsed > 0 else 0
                        print(f"[*] Tested {tested_count:,} passwords ({rate:,.0f} pw/s)...")

            if batch and not found_event.is_set():
                pool.apply_async(_worker_batch, args=(batch, params, found_event, result_queue))

        pool.close()
        while not pool._state:
            if found_event.is_set():
                break
            time.sleep(0.1)

        pool.join()
    except KeyboardInterrupt:
        print("\n[!] Cracking aborted by user.")
        pool.terminate()
        pool.join()
        return

    elapsed = time.time() - start_time
    if not result_queue.empty():
        recovered_pw = result_queue.get()
        print("\n" + "=" * 50)
        print(f"🎉 SUCCESS! Password found: [ {recovered_pw} ]")
        print(f"⏱️  Time elapsed: {elapsed:.2f} seconds ({tested_count / max(elapsed, 0.001):,.0f} pw/s)")
        print("=" * 50)
    else:
        print(f"\n[-] Password not found in wordlist. Tested {tested_count:,} candidates in {elapsed:.2f}s.")


def main():
    parser = argparse.ArgumentParser(
        description="High-Performance PDF Password Recovery Tool (Revision 2-4 Standard Security Handler)"
    )
    parser.add_argument("pdf", help="Path to encrypted PDF file")
    parser.add_argument("-w", "--wordlist", help="Path to dictionary/wordlist file")
    parser.add_argument("-p", "--password", help="Verify a single candidate password")
    parser.add_argument("-t", "--threads", type=int, default=os.cpu_count() or 4, help="Number of worker processes (default: CPU cores)")

    args = parser.parse_args()

    if not os.path.isfile(args.pdf):
        print(f"[-] PDF file not found: {args.pdf}", file=sys.stderr)
        sys.exit(1)

    if args.password:
        params = extract_encryption_params(args.pdf)
        is_valid = verify_password(args.password, params)
        if is_valid:
            print(f"[+] Password '{args.password}' is CORRECT!")
        else:
            print(f"[-] Password '{args.password}' is INCORRECT.")
    elif args.wordlist:
        crack_dictionary(args.pdf, args.wordlist, num_workers=args.threads)
    else:
        params = extract_encryption_params(args.pdf)
        print(f"[+] PDF Encryption Parameters:")
        print(f"    Revision (R) : {params['R']}")
        print(f"    Key Size     : {params['key_size']}-bit")
        print(f"    P Value      : {params['P'].hex()}")
        print(f"    Doc ID       : {params['doc_id'].hex()}")
        print("\nSpecify -w/--wordlist or -p/--password to test candidates.")


if __name__ == "__main__":
    main()
