Google Voice SMS Export Directory
==================================

Place your Google Voice export files here.

HOW TO GET YOUR EXPORT:
-----------------------
1. Go to https://takeout.google.com
2. Click "Deselect all"
3. Scroll down and select only "Voice"
4. Click "Next step" and choose your export options
5. Download the export when ready
6. Extract the ZIP file and copy the contents here

EXPECTED STRUCTURE:
-------------------
google-voice-export/
  ├── Calls/                         # SMS conversations (HTML format)
  │   ├── +1234567890 - Text.html
  │   ├── +1987654321 - Text.html
  │   └── ...
  └── messages.json                  # Alternative JSON format (if available)

USAGE:
------
After placing files here, run:

  node tools/importGoogleVoiceSms.cjs --dry-run    # Preview first
  node tools/importGoogleVoiceSms.cjs              # Actual import

For more options, see the script header or run:
  head -60 tools/importGoogleVoiceSms.cjs
