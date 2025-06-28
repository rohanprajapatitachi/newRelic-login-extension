# New Relic Cookie Extractor Extension

This browser extension automatically logs into New Relic and extracts authentication cookies for use in Excel or other applications.

## Features

- Automatic login to New Relic using stored credentials
- Cookie extraction and formatting
- Copy cookies to clipboard
- Export cookies to CSV format for Excel
- Secure credential storage

## Installation

1. Download or clone this extension folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your toolbar

## Usage

1. Click the extension icon in your browser toolbar
2. Enter your New Relic credentials (pre-filled with provided credentials)
3. Click "Login & Extract Cookies"
4. The extension will automatically log in and extract cookies
5. Use "Copy to Clipboard" to copy cookies for immediate use
6. Use "Export to Excel Format" to download a CSV file

## Security Notes

- Credentials are stored locally in the extension
- Cookies are extracted only from New Relic domains
- No data is sent to external servers

## Troubleshooting

- If login fails, check your credentials
- Make sure you're not already logged into New Relic in another tab
- Clear browser cache if you encounter issues
- Check that the extension has the necessary permissions

## File Structure 