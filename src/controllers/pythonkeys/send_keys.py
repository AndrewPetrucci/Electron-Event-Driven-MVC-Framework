import sys
import json
import argparse
import time
import logging
import pywinauto
from pywinauto.keyboard import send_keys
from pywinauto.findwindows import ElementNotFoundError
import pyperclip

# Setup logging
logging.basicConfig(filename='pythonkeys-executor-debug.log', level=logging.INFO, format='%(asctime)s %(message)s')

# Helper to process escape sequences
def process_escape_sequences(s):
    return s.encode('utf-8').decode('unicode_escape')

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
    window.set_focus()
    logging.info('Window focused.')
    time.sleep(0.2)
    active_title = window.wrapper_object().window_text()
    logging.info(f'Active window title: {active_title}')

    # Use clipboard paste for text with newlines or leading/trailing spaces
    text = process_escape_sequences(args.keys)
    if '\n' in args.keys or '\r' in args.keys or text.strip() != text or ' ' in text or '\t' in args.keys:
        try:
            import pyperclip
        except ImportError:
            logging.error('pyperclip is required for clipboard paste. Install with: pip install pyperclip')
            sys.exit(1)
        pyperclip.copy(text)
        send_keys('^v')
        logging.info('Text sent via clipboard paste.')
    else:
        send_keys(text)
        logging.info('Text sent via send_keys.')
    logging.info(f'Successfully sent keys: {args.keys} to {args.target}')
except ElementNotFoundError as e:
    logging.error(f'Window not found by class name: {args.target} ({e})')
    sys.exit(0)
except Exception as e:
    logging.error(f'Error sending keys: {e}', exc_info=True)
    sys.exit(1)
