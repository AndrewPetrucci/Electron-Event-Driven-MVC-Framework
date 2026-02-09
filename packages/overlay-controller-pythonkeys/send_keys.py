
import sys
print("[PYTHON DIAGNOSTIC] Executable:", sys.executable)
print("[PYTHON DIAGNOSTIC] sys.path:", sys.path)

import json
import argparse
import time
import logging
try:
    import pywinauto
    from pywinauto.keyboard import send_keys
    from pywinauto.findwindows import ElementNotFoundError
    print("[PYTHON DIAGNOSTIC] pywinauto import: SUCCESS")
except ImportError as e:
    print("[PYTHON DIAGNOSTIC] pywinauto import: FAILED", e)
    raise
import pyperclip

try:
    import win32gui # type: ignore
    has_win32gui = True
except ImportError:
    has_win32gui = False

# Setup logging
logging.basicConfig(filename='pythonkeys-executor-debug.log', level=logging.INFO, format='%(asctime)s %(message)s')

# Helper to process escape sequences
def process_escape_sequences(s):
    # Ensure s is treated as a raw string to avoid invalid escape sequence warnings
    if not s:
        return s
    # Replace single backslashes with double backslashes unless already escaped
    safe_s = s.encode('utf-8').decode('unicode_escape')
    return safe_s

# Helper to extract value from JSON
def extract_json_value(json_str, key):
    try:
        obj = json.loads(json_str)
        return obj.get(key, '')
    except Exception as e:
        logging.warning(f'Failed to parse JSON: {e}')
        return ''

# Parse arguments
parser = argparse.ArgumentParser(description='Send keys to application via pywinauto')
parser.add_argument('--keys', type=str, required=True, help='Keys to send')
parser.add_argument('--target', type=str, required=True, help='Target application window title or class')
args = parser.parse_args()

logging.info(f'Script started')
logging.info(f'Keys: {args.keys}')
logging.info(f'Target: {args.target}')

try:

    logging.info('Attempting to connect to application window by class name...')
    app = pywinauto.Application(backend='win32').connect(class_name=args.target)
    window = app.window(class_name=args.target)
    logging.info(f'Window found: {window}')
    handle = getattr(window, 'handle', None)
    logging.info(f'Window handle: {handle}')
    abort = False
    if has_win32gui:
        if handle and isinstance(handle, int) and handle != 0:
            try:
                win32gui.SetForegroundWindow(handle)
                logging.info('Window brought to foreground using win32gui.')
            except Exception as e:
                logging.error(f'Error calling SetForegroundWindow: {e}')
                abort = True
        else:
            logging.error(f'Invalid window handle: {handle}')
            abort = True
    else:
        try:
            window.set_focus()
            logging.info('Window brought to foreground using set_focus.')
        except Exception as e:
            logging.error(f'Error calling set_focus: {e}')
            abort = True

    if abort:
        logging.error('Aborting: Could not bring window to foreground. Keys will NOT be sent.')
        print('Error: Could not bring window to foreground. Keys not sent.', file=sys.stderr)
        sys.exit(1)

    time.sleep(0.2)
    active_title = window.wrapper_object().window_text()
    logging.info(f'Active window title: {active_title}')

    # Use clipboard paste for text with newlines or leading/trailing spaces
    text = process_escape_sequences(args.keys)
    if '\n' in args.keys or '\r' in args.keys or text.strip() != text or ' ' in text or '\t' in args.keys:
        pyperclip.copy(text)
        send_keys('^v')
        logging.info('Text sent via clipboard paste.')
    else:
        send_keys(text)
        logging.info('Text sent via send_keys.')
    logging.info(f'Successfully sent keys: {args.keys} to {args.target}')
except ElementNotFoundError as e:
    error_msg = f'Window not found by class name: {args.target} ({e})'
    logging.error(error_msg)
    print(error_msg, file=sys.stderr)
    sys.exit(0)
except Exception as e:
    import traceback
    error_msg = f'Error sending keys: {e}\n' + traceback.format_exc()
    logging.error(error_msg)
    print(error_msg, file=sys.stderr)
    sys.exit(1)
