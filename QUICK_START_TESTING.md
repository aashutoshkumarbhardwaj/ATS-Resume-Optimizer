# Quick Start Testing Guide
## Job Tracker + Settings + Job Orbit Integration

---

## TL;DR - Get Started in 5 Minutes

### 1️⃣ Start Backend (if not running)
```bash
cd backend
npm run dev
```

Expected output:
```
✅ Job Orbit routes loaded
🚀 Resume Fixer API running on port 3000
```

### 2️⃣ Load Extension in Chrome
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select `extension/src` folder
5. Open any job site (LinkedIn, Indeed, Glassdoor, etc.)

### 3️⃣ Test Job Tracker Tab
1. Click extension icon → popup opens
2. Click **📊 Job Tracker** tab
3. See: "No applications tracked yet" (expected first time)
4. Go to Settings → turn on **Auto-sync job applications to Job Orbit**
5. Save settings

### 4️⃣ Test Autofill
1. Go to **⚡ Autofill** tab in popup
2. Fill in your name, email, phone
3. Click **💾 Save Profile**
4. Navigate to a job application form (LinkedIn, Indeed, etc.)
5. Look for floating **⚡ Autofill** button or use the tab's **⚡ Autofill Tab** button
6. Click to autofill form

### 5️⃣ Check Job Tracker
1. Go back to popup
2. Click **📊 Job Tracker** tab
3. You should see your application recorded with:
   - Company name
   - Job title
   - Location
   - Salary (if available)
   - Application date
   - Status

### 6️⃣ Test Export
1. In Job Tracker tab, click **📥 Export to CSV**
2. File downloads as `job-applications-[timestamp].csv`
3. Open in Excel/Sheets - verify data looks correct

---

## Feature Checklist

### ✅ Job Tracker Tab
- [ ] Tab loads without errors
- [ ] Shows total applications count
- [ ] Shows applied status count  
- [ ] Application list displays with all columns
- [ ] "Sync with Job Orbit" button visible
- [ ] "Export to CSV" button visible

### ✅ Settings Tab
- [ ] Tab loads without errors
- [ ] Job Orbit API key input visible
- [ ] "Connect to Job Orbit" button present
- [ ] Auto-sync toggle works
- [ ] Autofill setting toggles work
- [ ] Export/Import/Clear buttons present
- [ ] All settings save after reload

### ✅ Auto-Recording
- [ ] Autofill form on job site
- [ ] Go to Job Tracker tab
- [ ] New application appears (without manual entry)
- [ ] Details are correct (company, title, etc.)

### ✅ CSV Export
- [ ] Click "Export to CSV" 
- [ ] File downloads
- [ ] Open in Excel/Sheets
- [ ] All columns present
- [ ] Data formatted correctly

### ✅ Settings Persistence
- [ ] Set API key in Settings
- [ ] Toggle some settings
- [ ] Close popup completely
- [ ] Reopen popup
- [ ] All settings still there

---

## Common Issues & Fixes

### Issue: "Job Orbit routes failed" in console
**Fix**: 
```bash
# Check if backend running
curl http://localhost:3000/health

# If not, start it:
cd backend && npm run dev
```

### Issue: Job applications not appearing in Job Tracker
**Fix**:
1. Verify autofill completed (look for success message)
2. Check if auto-sync is enabled in Settings
3. Manual sync: click "Sync with Job Orbit" button
4. Open DevTools (F12) → Application → Local Storage → check `applicationHistory`

### Issue: CSV export is empty or missing columns
**Fix**:
1. First add some applications using autofill
2. Wait 2-3 seconds for storage to sync
3. Try export again
4. Check browser DevTools console for errors

### Issue: Settings not saving
**Fix**:
1. Open DevTools (F12)
2. Check if IndexedDB or Local Storage errors appear
3. Try clearing extension data:
   - Chrome → Settings → Apps → Chrome Extensions
   - Right-click extension → Remove
   - Reload from `chrome://extensions`

### Issue: Autofill button not appearing
**Fix**:
1. Check Settings → "Show floating autofill button" toggle
2. Reload job page (F5)
3. Look for blue floating button (⚡)
4. If still not visible, try manually filling via Settings tab

---

## API Testing (Optional - Advanced)

Test backend endpoints directly:

### 1. Validate API Key
```bash
curl -X POST http://localhost:3000/api/job-orbit/validate \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"test-key-123"}'
```

Response (expected to fail with test key):
```json
{"success":false,"message":"Invalid API key"}
```

### 2. Get Applications
```bash
curl "http://localhost:3000/api/job-orbit/applications?apiKey=test-key"
```

### 3. Get Statistics
```bash
curl "http://localhost:3000/api/job-orbit/statistics?apiKey=test-key"
```

---

## Testing Scenarios

### Scenario 1: Fresh User
1. Load extension for first time
2. Go to Job Tracker → should see "No applications tracked yet"
3. Go to Settings → all defaults should be set
4. Save profile in Autofill tab
5. Go autofill a job form
6. Return to Job Tracker → application should appear

### Scenario 2: Connect to Job Orbit
1. Get API key from Job Orbit (or use test key)
2. Go to Settings
3. Paste API key into "Job Orbit API Key" field
4. Click "Connect to Job Orbit"
5. Should show "✓ Connected to Job Orbit" status
6. Click "Sync with Job Orbit"
7. Applications should sync

### Scenario 3: Data Export & Import
1. Add 5+ applications using autofill
2. Go to Settings → "📤 Export Data"
3. Save the JSON file
4. Go to Settings → "🗑️ Clear All Data" (with confirmation)
5. Job Tracker should be empty
6. Go to Settings → "📥 Import Data"
7. Select the JSON file you saved
8. Applications should reappear

### Scenario 4: Settings Persistence
1. Make changes to all 3 Autofill toggles
2. Enter API key
3. Close popup completely (not just switch tabs)
4. Reopen extension
5. Go to Settings → all changes should still be there

---

## Performance Expectations

| Action | Expected Time |
|--------|----------------|
| Backend startup | < 2 seconds |
| Load extension | < 1 second |
| Autofill form | 1-3 seconds |
| CSV export | < 1 second |
| API call to Job Orbit | 2-5 seconds |
| Save settings | < 500ms |

---

## Success Criteria

✅ **All criteria must pass**:
- [ ] Backend starts without errors
- [ ] Extension loads without errors
- [ ] Job Tracker tab works
- [ ] Settings tab works
- [ ] Autofill auto-records applications
- [ ] CSV export works
- [ ] Settings persist across popups
- [ ] No console errors (F12 DevTools)

---

## When You're Done

1. Check all items in "Success Criteria"
2. Document any bugs found
3. Create GitHub issue if problems discovered
4. Ready for production deployment ✅

---

## Support

**If you encounter issues**:
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for red error messages
4. Copy error and share in GitHub issue
5. Include screenshot of error

**Common console paths to check**:
- `Application` tab → `Local Storage` → Check `applicationHistory`
- `Application` tab → `Cookies` → Check extension ID
- `Console` tab → Look for red X errors

---

**Happy Testing! 🚀**

*If all tests pass, you're ready for production!*
