# How to Load Extension in Chrome - Step by Step

## Option 1: Correct Path (Recommended)

### Step 1: Open Chrome Extensions Page
1. Open Chrome browser
2. Type in address bar: `chrome://extensions/`
3. Press Enter
4. You should see a page with all your extensions

### Step 2: Enable Developer Mode
1. In the top right corner, find **"Developer mode"** toggle
2. Click it to turn it ON (should be blue/enabled)

### Step 3: Load Unpacked
1. After enabling Developer mode, new buttons appear at top left
2. Click **"Load unpacked"** button
3. A file picker dialog opens

### Step 4: Navigate to Extension Folder
The correct path is:
```
/Users/aashutoshkumarbhardwaj/Documents/GitHub/ATS-Resume-Optimizer/extension/
```

**NOT** the root folder or backend folder!

**Specifically:**
- ✅ Correct: `.../extension/` (contains manifest.json directly)
- ❌ Wrong: `.../ATS-Resume-Optimizer/` (root folder)
- ❌ Wrong: `.../backend/`

### Step 5: Select Folder
1. Navigate to and click the `extension` folder
2. Click **"Select Folder"** button
3. Wait for Chrome to process...
4. Should see "Resume Fixer" appear in your extensions list

### Step 6: Verify Installation
✅ You should see:
- "Resume Fixer" in extensions list
- Blue icon in Chrome toolbar
- No errors (might show warnings, that's ok)

---

## If It Fails - Troubleshooting

### Error: "Cannot load extension" or similar
**Possible causes and solutions:**

#### 1. Wrong folder selected
**Check:**
- Is `manifest.json` in the folder you selected?
- Path should end with `/extension/` not `/extension/src/`

**Solution:**
1. Go back to `chrome://extensions/`
2. Click "Load unpacked" again
3. Navigate to `extension` folder (not `src` subfolder)
4. Click "Select Folder"

#### 2. Missing files
**Check:**
Run this command to verify files exist:
```bash
ls -la /Users/aashutoshkumarbhardwaj/Documents/GitHub/ATS-Resume-Optimizer/extension/src/popup/
```

Should show:
- popup.html ✓
- popup.js ✓
- popup.css ✓

And:
```bash
ls -la /Users/aashutoshkumarbhardwaj/Documents/GitHub/ATS-Resume-Optimizer/extension/src/background/
```

Should show:
- service-worker.js ✓

#### 3. Invalid manifest.json
**Check:**
```bash
cat /Users/aashutoshkumarbhardwaj/Documents/GitHub/ATS-Resume-Optimizer/extension/manifest.json
```

Should be valid JSON (no syntax errors)

**Solution if broken:**
- Contact me, I can fix it

#### 4. Icons missing
**Check:**
```bash
ls -la /Users/aashutoshkumarbhardwaj/Documents/GitHub/ATS-Resume-Optimizer/extension/src/assets/icons/
```

Should show icon files

**If missing:**
1. Don't worry, extension can still load
2. But you'll see warnings (harmless)

---

## Option 2: Alternative - Using Finder

### Step 1: Open Finder
1. Click Finder icon in dock
2. Press Cmd+Shift+G (Go to folder)

### Step 2: Paste Path
1. Paste this path:
```
/Users/aashutoshkumarbhardwaj/Documents/GitHub/ATS-Resume-Optimizer/extension
```
2. Press Enter
3. Folder opens in Finder

### Step 3: Verify Contents
Check that you see these files/folders:
- ✓ manifest.json
- ✓ src/ folder
- ✓ package.json
- ✓ config.js

### Step 4: Back to Chrome
1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked"
4. Drag the extension folder from Finder into the dialog
5. Or navigate to it using the file picker

---

## Quick Checklist

Before loading, verify:

- [ ] Extension folder exists at correct path
- [ ] manifest.json is in extension folder (not in src/)
- [ ] src/popup/popup.html exists
- [ ] src/background/service-worker.js exists  
- [ ] src/contentScript/content-script.js exists
- [ ] Chrome Extensions page is open (chrome://extensions/)
- [ ] Developer mode is ON (toggle is blue)
- [ ] You're selecting the "extension" folder, not "src"

---

## After Loading

### What You Should See
✅ Extension appears in list as "Resume Fixer"
✅ No red error message at top
✅ Blue/colored icon in toolbar
✅ Version shows: 1.0.0

### What's Ok (Warnings)
⚠️ Yellow warnings about permissions - normal, harmless
⚠️ Missing icon files - extension still works

### What's NOT Ok (Errors)
❌ Red error message - manifest problem
❌ "Cannot load extension" - wrong folder or corrupted files

---

## Quick Fixes

### If Nothing Appears
1. Refresh chrome://extensions/ page (F5)
2. Try loading again

### If You See Errors
1. Right-click extension
2. Click "Remove"
3. Try loading again
4. If still fails, check troubleshooting above

### If Icon Not Showing
1. This is a display issue, not a loading issue
2. Extension is probably loaded
3. Try clicking browser menu (top right) → All Extensions
4. Should be in the list

---

## Complete Example Path

Your extension is at:
```
/Users/aashutoshkumarbhardwaj/
  Documents/
    GitHub/
      ATS-Resume-Optimizer/
        extension/          ← SELECT THIS FOLDER
          ├── manifest.json
          ├── src/
          │   ├── popup/
          │   │   ├── popup.html
          │   │   ├── popup.js
          │   │   └── popup.css
          │   ├── background/
          │   │   └── service-worker.js
          │   ├── contentScript/
          │   │   └── content-script.js
          │   └── ...
          └── package.json
```

The folder to select in "Load unpacked" is: **extension/**

---

## Testing After Load

Once loaded:

1. **Click extension icon** in Chrome toolbar
2. **Popup should open** without errors
3. **Check console** (F12 → Console):
   - Should see: `[Popup] Initialized`
   - Should NOT see red errors

4. **Upload a PDF** to test it works

---

## Still Not Working?

If you've tried everything above:

1. Post the exact error message you're seeing
2. Describe the step where it fails
3. I can help debug further

Common error messages and solutions:
- "Manifest errors" → I can fix manifest.json
- "Cannot read file" → Reinstall dependencies
- "Extension disabled" → Enable it in the list

---

**Remember:** You're selecting the `extension` folder that contains `manifest.json` directly, not any subfolder!

Good luck! 🚀
