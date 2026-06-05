# Vantera LinkedIn add-on (Chrome)

This is **not** listed in the Chrome Web Store. Install it manually:

## For Vantera users (recommended)

1. In Vantera: **Outreach → LinkedIn → Set up LinkedIn add-on**, or **Help Center → Set up LinkedIn outreach**.
2. Click **Download Vantera LinkedIn add-on (zip)**.
3. Unzip the file.
4. Chrome → `chrome://extensions` → **Developer mode** on → **Load unpacked** → select the unzipped folder.
5. Pin **Vantera LinkedIn Outreach** from the extensions puzzle icon.
6. Paste your Vantera web address and connection code in the add-on popup.

## For developers

```bash
./scripts/pack-linkedin-extension.sh
```

Updates `apps/web/public/vantera-linkedin-extension.zip` for production download.
