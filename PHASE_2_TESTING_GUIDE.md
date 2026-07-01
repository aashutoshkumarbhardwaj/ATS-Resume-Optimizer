# Phase 2 Testing Guide

**Quick Start for Testing the Integrated Autofill System**

---

## Setup (5 minutes)

### 1. Load Extension in Chrome

```bash
# If you haven't built yet:
cd extension
npm run build  # Creates dist folder or prepares files

# Open Chrome DevTools
# Go to: chrome://extensions/
# Enable Developer mode (top-right toggle)
# Click "Load unpacked"
# Navigate to: extension/  (or extension/dist if built)
# Select the folder
```

### 2. Pin Extension to Toolbar
- Click extension icon → Pin
- Now you'll see 🔧 icon in top-right

---

## Test Scenario 1: Basic Profile Setup (10 minutes)

### Steps

1. **Click Extension Icon** → Opens Popup
2. **Click "⚡ Autofill" Tab**
3. **Fill Out Profile**:
   - Full Name: `John Doe`
   - Email: `john.doe@example.com`
   - Phone: `+1 (555) 123-4567`
   - City: `San Francisco`
   - Country: `United States`
   - LinkedIn: `https://linkedin.com/in/johndoe`
   - GitHub: `https://github.com/johndoe`
   - Current Title: `Software Engineer`
   - Years: `5`

4. **Click "💾 Save Profile"**
   - Should see ✅ "Profile saved successfully!"
   - Data is stored locally

### Verify

```javascript
// In Chrome DevTools Console:
chrome.storage.sync.get(['autofillProfile'], (result) => {
    console.log('Stored Profile:', result);
});
```

**Expected**: Profile data appears in console

---

## Test Scenario 2: Form Detection & Autofill (15 minutes)

### Test Sites

**Option A: LinkedIn Job Application** (Recommended)
1. Go to linkedin.com → Jobs
2. Find a job posting
3. Click "Easy Apply"

**Option B: Test Form** (If LinkedIn unavailable)
```html
<!-- Save as test_form.html locally -->
<form>
    <input type="text" name="firstName" placeholder="First Name">
    <input type="email" name="email" placeholder="Email">
    <input type="tel" name="phone" placeholder="Phone">
    <select name="country">
        <option>Select Country</option>
        <option>United States</option>
        <option>Canada</option>
    </select>
    <button type="submit">Submit</button>
</form>

<!-- Open with: file:///path/to/test_form.html -->
```

### Steps

1. **Navigate to Form Page**
2. **Click Extension Icon** → Should show popup
3. **Check Console** (F12)
   - Should see: `[Content] Received TRIGGER_AUTOFILL_FROM_POPUP message`
4. **Click "⚡ Autofill Tab"** (in popup)
   - Should start filling form
5. **Watch Console for Autofill Process**:
   ```
   [Content] FloatingButtonManager initialized
   [Content] Autofill started
   [Content] Detected X fields
   [Content] Filled Y fields
   [Popup] Received AUTOFILL_COMPLETE
   ```

### Verify Results

- [ ] Fields are populated with correct values
- [ ] Dropdown selections work
- [ ] No console errors
- [ ] Popup shows results
- [ ] Application appears in History tab

---

## Test Scenario 3: Framework Support (20 minutes)

### A. React Select (linkedin.com)

```javascript
// In DevTools Console on LinkedIn page:
// Check if React Select is detected:

// Open extension popup
// Click "⚡ Autofill Tab"
// Click "Autofill Tab"

// In console, check for:
console.log('React Select Detected:', window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
```

**Verify**: React Select dropdowns work correctly

### B. Material-UI (if testing on MUI site)

```bash
# Test form created with MUI:
# You can create a local test form with MUI if needed
```

**Verify**: MUI Select elements populate

### C. Ant Design (if testing on Ant Design site)

**Verify**: Ant Design Select elements populate

---

## Test Scenario 4: Field Detection (10 minutes)

### Various Field Types

Create a test form with:

```html
<form>
    <!-- Text fields -->
    <input type="text" placeholder="Full Name">
    <input type="text" placeholder="First Name">
    <input type="text" placeholder="Last Name">
    
    <!-- Contact -->
    <input type="email" placeholder="Email Address">
    <input type="tel" placeholder="Phone Number">
    
    <!-- Address -->
    <input type="text" placeholder="City">
    <input type="text" placeholder="State">
    <input type="text" placeholder="Country">
    
    <!-- Professional -->
    <input type="text" placeholder="Current Job Title">
    <input type="number" placeholder="Years of Experience">
    
    <!-- Social -->
    <input type="url" placeholder="LinkedIn Profile">
    <input type="url" placeholder="GitHub Profile">
    
    <!-- Dropdowns -->
    <select placeholder="Country">
        <option>United States</option>
        <option>Canada</option>
        <option>India</option>
    </select>
</form>
```

### Steps

1. Open form
2. Click Extension → Autofill Tab → Autofill
3. Check each field matches

**Expected**: All fields properly detected and filled

---

## Test Scenario 5: Error Handling (10 minutes)

### Test Missing Profile

1. **Clear Stored Profile**:
   ```javascript
   // In DevTools Console:
   chrome.storage.sync.set({ autofillProfile: null });
   ```

2. **Navigate to form page**
3. **Click "⚡ Autofill Tab"**
4. **Expect Error**: "Please fill out and save your profile first"

### Test Network Error

1. **Open DevTools** → Network tab
2. **Check "Offline"**
3. **Click Extension** → Autofill
4. **Expect Graceful Handling**: Error message, no crash

### Test Invalid Form

1. **Go to page without form**
2. **Click "⚡ Autofill Tab"**
3. **Expect**: "No application form detected" or similar

---

## Test Scenario 6: Floating Button (10 minutes)

### Setup

1. Navigate to LinkedIn job application form
2. **Wait 2-3 seconds**
3. **Look for ⚡ button** in bottom-right corner

### Test Features

- [ ] Button appears on form page
- [ ] Button persists after page reload
- [ ] Click button triggers autofill
- [ ] Close button (X) dismisses button
- [ ] Button reappears after extension reload
- [ ] Button shows toast: "Autofilled X fields!"

### Test Persistence

1. Close floating button with X
2. Refresh page
3. **Button should reappear** (never permanently gone)

---

## Console Debugging

### Expected Log Patterns

**On Form Page**:
```
[Content] Resume Fixer content script loaded
[Content] FloatingButtonManager initialized
[Content] Detecting application form...
[Content] Form fields detected: 12
```

**On Autofill Trigger**:
```
[Popup] Autofilling form...
[Content] Received TRIGGER_AUTOFILL_FROM_POPUP message
[Content] AutofillOrchestrator started
[Content] Field 1: firstName → "John"
[Content] Field 2: email → "john@example.com"
...
[Content] Autofill complete: Filled 10, Skipped 2, Failed 0
[Popup] Received AUTOFILL_COMPLETE
```

### Error Patterns to Fix

```
// ❌ Field not detected
[Content] Could not find field for "..."

// ❌ Event dispatch failed
[Content] Event dispatch error on element

// ❌ Adapter not working
[Content] React Select adapter failed to select option

// ✅ These are expected
[Content] Skipped field: ...
[Content] Using fallback selector
```

---

## Testing Checklist

### Core Functionality
- [ ] Profile saves correctly
- [ ] Popup displays properly
- [ ] Autofill button works
- [ ] Floating button appears
- [ ] Fields are detected
- [ ] Form is filled

### Framework Support
- [ ] HTML Select works
- [ ] React Select works (if available)
- [ ] MUI Select works (if available)
- [ ] Ant Design Select works (if available)

### Edge Cases
- [ ] Empty profile handled
- [ ] Network errors handled
- [ ] Missing fields handled
- [ ] Invalid data handled
- [ ] Page without form handled

### Performance
- [ ] Autofill completes in <5 seconds
- [ ] No UI lag/freezes
- [ ] Memory usage reasonable
- [ ] No console spam

### Cross-Browser (if possible)
- [ ] Works in Chrome
- [ ] Works in Edge
- [ ] Works in Brave
- [ ] Works in Opera

---

## Common Issues & Fixes

### Issue: Autofill not starting

**Debug Steps**:
1. Open DevTools Console
2. Check for errors
3. Verify profile is saved
4. Try manual form fill first

**Fix**:
- Reload extension: chrome://extensions → Click reload icon
- Clear storage: `chrome.storage.sync.clear()`
- Reload page

### Issue: Floating button not showing

**Debug Steps**:
1. Check if page is application form
2. Open console
3. Search for "FloatingButtonManager"

**Fix**:
```javascript
// In console on form page:
// Manually trigger:
console.log(window.FloatingButtonManager);
```

### Issue: Fields not filling

**Debug Steps**:
1. Check console for specific field errors
2. Inspect element to see field name
3. Check field detection

**Fix**:
- Add field to custom fields in profile
- Try manual fill to verify form works
- Check console for field mapping issues

---

## Performance Testing

### Measure Autofill Speed

```javascript
// In DevTools Console:
performance.mark('autofill-start');

// Trigger autofill...

performance.mark('autofill-end');
performance.measure('autofill', 'autofill-start', 'autofill-end');
performance.getEntriesByName('autofill')[0].duration; // milliseconds
```

**Target**: < 5000ms (5 seconds)

### Check Memory Usage

1. Open DevTools → Memory
2. Trigger autofill
3. Observe memory increase
4. Should stabilize after completion

**Target**: < 10MB additional

---

## Reporting Bugs

### Bug Report Template

```markdown
## Bug: [Brief Description]

### Steps to Reproduce
1. ...
2. ...
3. ...

### Expected Behavior
...

### Actual Behavior
...

### Console Output
```
[Paste error logs here]
```

### Environment
- Browser: Chrome/Edge/Brave
- Version: X.X.X
- Page: LinkedIn/Indeed/Custom Form
- Field Type: Text/Select/Email

### Screenshots
[If possible, attach screenshot]
```

---

## Success Criteria

### Basic Testing Pass
- ✅ Profile saves
- ✅ Extension loads without errors
- ✅ Autofill completes on test form
- ✅ Results appear in popup

### Full Testing Pass
- ✅ All basic checks pass
- ✅ Works on 3+ real job sites
- ✅ All field types detected
- ✅ Framework support working
- ✅ Error handling graceful
- ✅ Performance acceptable
- ✅ No console errors

---

## Next Steps After Testing

**If Tests Pass**:
1. Document any edge cases found
2. Plan Phase 2B framework adapters
3. Begin Phase 2C platform extractors

**If Tests Fail**:
1. Collect all error logs
2. Identify patterns
3. Create bug fix tickets
4. Re-test after fixes

**Timeline**: Allocate 2-3 days for thorough testing

