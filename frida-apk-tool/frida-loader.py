import frida
import time
import argparse
import sys

def on_message(message, data):
    if message['type'] == 'send':
        print(f"[*] {message['payload']}")
    else:
        print(message)

def main():
    parser = argparse.ArgumentParser(description="Frida Loader Script")
    parser.add_argument("-p", "--package", required=True, help="Target package name (e.g., com.example.app)")
    parser.add_argument("-s", "--script", default="basic-hook.js", help="Path to Frida script (default: basic-hook.js)")
    args = parser.parse_args()

    print(f"[*] Connecting to {args.package}...")
    
    session = None
    try:
        # 1. Try Remote Device (Standard for Gadget with adb forward)
        # Gadget listens on localhost:27042 (forwarded)
        try:
            device = frida.get_remote_device()
            # Gadget usually appears as a process named "Gadget" or just the single attached process
            session = device.attach("Gadget")
            print(f"[*] Connected to Gadget via Remote Device")
        except (frida.ServerNotRunningError, frida.ProcessNotFoundError):
            pass

        # 2. If Remote failed, try USB Device (Standard for frida-server)
        if session is None:
            try:
                device = frida.get_usb_device()
                session = device.attach(args.package)
                print(f"[*] Attached to {args.package} via USB")
            except frida.ProcessNotFoundError:
                 print(f"[-] Process {args.package} not found. Please launch the app on the device.")
                 return

        with open(args.script, 'r', encoding='utf-8') as f:
            source = f.read()
            
        script = session.create_script(source)
        script.on('message', on_message)
        script.load()
        
        # Resume if possible (Gadget might be paused)
        try:
            device.resume(args.package)
        except:
            pass
            
        print(f"[*] Script loaded. Press Ctrl+C to exit.")
        sys.stdin.read()


        
    except frida.ServerNotRunningError:
        print("[-] Frida server is not running on the device. Please start it first.")
    except frida.ProcessNotFoundError:
        print(f"[-] Could not find process {args.package}. Make sure it is installed.")
    except Exception as e:
        print(f"[-] Error: {e}")

if __name__ == "__main__":
    main()
