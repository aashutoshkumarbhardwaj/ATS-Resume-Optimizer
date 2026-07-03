# Extension Verification Checklist

**Date**: July 3, 2026  
**Version**: 1.0.0

Use this checklist to verify the autofill extension is working correctly.

---

## PRE-TESTING SETUP

- [ ] Close all Chrome windows
- [ ] Clear Chrome cache (Settings → Privacy → Clear browsing data)
- [ ] Reload the extension (chrome://extensions → Find Resume Fixer → Click reload)
- [ ] Open new Chrome window
- [ ] Open extension popup

---

## TEST 1: Profile Save & Persistence ✅ CRITICAL

### Save Profile
- [ ] Open popup
- [ ] Click "⚡ Autofill" tab
- [ ] Fill in these required fields:
  - [ ] Full Name: "John Doe"
  - [ ] Email: "john.doe@example.com"
  - [ ] Phone: "555-123-4567"
  - [ ] City: "San Francisco"
  - [ ] Country: "United States"
  - [ ] Current Job Title: "Software Engineer"
  - [ ] LinkedIn: "https://linkedin.com/in/johndoe"
  - [ ] GitHub: "https://github.com/johndoe"
- [ ] Click "💾 Save Profile"
- [ ] See message: "✅ Profile saved successfully!"

### Console Verification
- [ ] Open console (F12 → Console)
- [ ] Should see logs:
  ```
  [Popup] 💾 Saving profile with 20 fields
  [Popup] ✅ Profile saved to local storage
  [Popup] ✅ Profile verified in storage with 20 fields
  ```
- [ ] No error messages should appear

### Persistence Test
- [ ] Close popup
- [ ] Refresh the entire page (F5)
- [ ] Open popup again → "⚡ Autofill" tab
- [ ] **VERIFY**: All fields still have the data you entered
- [ ] No message about "Profile was lost"

---

## TEST 2: Button Initialization ✅ CRITICAL

### Button Appears on Any Form Page
- [ ] Navigate to: https://forms.google.com
- [ ] Create a new form OR find an existing one
- [ ] **Verify**: Blue "⚡ Autofill Form" button appears in bottom-right corner
- [ ] Console should show:
  ```
  [UnifiedButton] ✅ UnifiedAutofillButton initialized successfully
  [UnifiedButton] Button injected successfully
  ```

### Button on Different Sites
- [ ] Try LinkedIn job application form
- [ ] Try Indeed job application form
- [ ] Try any website with form elements
- [ ] **Verify**: Button should appear on ALL of them

### Console Check
- [ ] No error messages like:
  - [ ] "UnifiedAutofillButton class not found" ❌ BAD
  - [ ] "Button already in DOM" (is OK - just informational)

---

## TEST 3: Autofill Functionality ✅ CRITICAL

### Google Forms Test
1. [ ] Go to: https://forms.google.com
2. [ ] Create new form with these question types:
   - [ ] Text field: "What is your name?"
   - [ ] Text field: "What is your email?"
   - [ ] Text field: "What is your phone?"
   - [ ] Text field: "What city are you in?"
3. [ ] Click "⚡ Autofill Form" button
4. [ ] **Verify**: Button shows loading state briefly
5. [ ] **Verify**: Message appears like "✅ Filled 4 fields!"
6. [ ] **Verify**: Form fields are populated with your profile data

### Console Logs
- [ ] Should see sequence:
  ```
  [UnifiedButton] 🚀 Starting autofill process...
  [UnifiedButton] 📦 Profile data: present (20 keys)
  [UnifiedButton] 📬 Sending autofill trigger to content script...
  [Content] 📬 Received autofill trigger: TRIGGER_AUTOFILL_FROM_BUTTON
  [Orchestrator] 🔍 Found N input elements on the page
  [Orchestrator] 📋 Total detected fields: M
  [Orchestrator] ✅ Successfully filled field "name"
  [Orchestrator] ✅ Successfully filled field "email"
  [Orchestrator] ✅ Successfully filled field "phone"
  [Orchestrator] ✅ Successfully filled field "city"
  [Orchestrator] 📊 Autofill summary: { filled: 4, skipped: 0, failed: 0, total: 4 }
  ```

### Verification
- [ ] Manual check: Form fields actually contain the data
- [ ] No console errors

---

## TEST 4: Multiple Pages & Persistence ✅ IMPORTANT

### Page Navigation Test
1. [ ] Fill Google Form with autofill
2. [ ] Navigate to different page
3. [ ] Navigate back to same form
4. [ ] Click autofill again
5. [ ] **Verify**: Still works, fields get filled again

### Multiple Forms
1. [ ] Create 2nd Google Form
2. [ ] Click autofill on form 1
3. [ ] Navigate to form 2
4. [ ] Click autofill on form 2
5. [ ] **Verify**: Both forms filled successfully

### Browser Restart Test (Optional but Recommended)
1. [ ] Close all Chrome windows completely
2. [ ] Close all Chrome processes (use Task Manager if needed)
3. [ ] Restart Chrome
4. [ ] Open popup → Autofill tab
5. [ ] **Verify**: Profile data is still there

---

## TEST 5: Error Handling ✅ IMPORTANT

### No Profile Saved Scenario
1. [ ] Click "⚡ Clear History" in settings (optional)
2. [ ] Manually clear storage:
   ```javascript
   // In console:
   chrome.storage.local.clear()
   ```
3. [ ] Refresh page
4. [ ] Open popup → "⚡ Autofill" tab
5. [ ] **Verify**: Shows "Profile was lost. Please fill out your profile again."
6. [ ] **Verify**: No console errors with stack traces

### Autofill with No Profile
1. [ ] Make sure profile is cleared (see above)
2. [ ] Go to any form page
3. [ ] Click autofill button
4. [ ] **Verify**: Toast shows "Please fill out your profile in the popup first!"
5. [ ] **Verify**: Button returns to normal state
6. [ ] **Verify**: No console errors

### Form with No Matching Fields
1. [ ] Create form with unusual field names like:
   - [ ] "Username (required)"
   - [ ] "Favorite Color"
   - [ ] "Custom Field 123"
2. [ ] Click autofill
3. [ ] **Verify**: Shows message like "No matching fields found" or "Filled 0 fields"
4. [ ] **Verify**: No errors in console

---

## TEST 6: Partial Fills ✅ GOOD TO KNOW

### Form with Some Matching Fields
1. [ ] Create form with:
   - [ ] "Email" (matches ✓)
   - [ ] "Phone Number" (matches ✓)
   - [ ] "Username" (no match ✗)
   - [ ] "Favorite Color" (no match ✗)
2. [ ] Click autofill
3. [ ] **Verify**: Shows "✅ Filled 2 fields!"
4. [ ] **Verify**: Email and phone are filled
5. [ ] **Verify**: Username and Favorite Color are NOT filled

### Check Console for Details
```javascript
[Orchestrator] ✅ Successfully filled field "email"
[Orchestrator] ✅ Successfully filled field "phone"
[Orchestrator] ⏭️  Skipped field "Username" - no value for "username"
[Orchestrator] ⏭️  Skipped field "Favorite Color" - no value for "favoritecolor"
[Orchestrator] 📊 Autofill summary: { filled: 2, skipped: 2, failed: 0, total: 4 }
```

---

## TEST 7: Different Field Types ✅ OPTIONAL

### Text Inputs
- [ ] Create text field
- [ ] Click autofill
- [ ] **Verify**: Gets filled with correct data

### Dropdowns
- [ ] Create dropdown with options: "Option A", "Option B", "Option C"
- [ ] Add field name that matches a profile field (e.g., "Country")
- [ ] Add "United States" as an option
- [ ] Click autofill
- [ ] **Verify**: "United States" is selected

### Textareas
- [ ] Create textarea field for "bio" or "about you"
- [ ] Fill profile bio with text
- [ ] Click autofill
- [ ] **Verify**: Textarea gets filled

### Checkboxes
- [ ] Create checkbox for "I agree to terms"
- [ ] Click autofill
- [ ] **Verify**: Checkbox handling works (may or may not check depending on value)

### Radio Buttons
- [ ] Create radio button group: "Yes" / "No"
- [ ] Click autofill
- [ ] **Verify**: Appropriate option is selected

---

## TEST 8: Console Checking ✅ FINAL

### Open Console (F12 → Console Tab)

**Should NOT see**:
- [ ] ❌ "UnifiedAutofillButton class not found"
- [ ] ❌ "Cannot read properties of null"
- [ ] ❌ "AutofillOrchestrator not defined"
- [ ] ❌ "Extension context invalidated" (repeated)
- [ ] ❌ "Failed to save profile"
- [ ] ❌ "Uncaught" errors

**Should see** (for normal operations):
- [ ] ✅ "[Popup]" logs when opening popup
- [ ] ✅ "[UnifiedButton]" logs when clicking button
- [ ] ✅ "[Content]" logs when autofill triggers
- [ ] ✅ "[Orchestrator]" logs during fill operation

**Expected error messages** (these are OK):
- [ ] "Profile not found in storage" (when storage cleared, expected behavior)
- [ ] "No matching fields found" (when form has no recognized fields, expected)

---

## FINAL VERDICT

After completing all tests, check:

- [ ] Profile saves successfully
- [ ] Profile persists across refresh
- [ ] Button appears on any form page
- [ ] Button clicks trigger autofill
- [ ] Forms get filled with correct data
- [ ] Errors are handled gracefully
- [ ] Console shows expected logs
- [ ] No critical errors in console

### If ALL boxes are checked ✅
**Extension is ready for production!**

### If ANY boxes are unchecked ❌
Check: `AUTOFILL_DEBUG_GUIDE.md` for troubleshooting

---

## Quick Debug Commands

Paste these in console (F12 → Console tab) if you need to debug:

### Check if profile is saved
```javascript
chrome.storage.local.get(['autofillProfile'], (r) => {
    console.log('Profile in storage:', !!r.autofillProfile);
    if (r.autofillProfile) {
        console.log('Fields:', Object.keys(r.autofillProfile));
        console.log('Email:', r.autofillProfile.email);
    }
});
```

### Check if button is initialized
```javascript
console.log('UnifiedAutofillButton:', typeof window.UnifiedAutofillButton);
console.log('Button instance:', window.__unifiedAutofillButtonInstance ? 'EXISTS' : 'MISSING');
console.log('Button in DOM:', !!document.getElementById('ats-unified-autofill-button'));
```

### Check if orchestrator is available
```javascript
console.log('AutofillOrchestrator:', typeof AutofillOrchestrator);
```

### Manual autofill trigger
```javascript
chrome.runtime.sendMessage({
    type: 'TRIGGER_AUTOFILL_FROM_BUTTON',
    profile: {
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        phone: '555-0000'
    }
}, (response) => console.log('Autofill response:', response));
```

---

**Document Version**: 1.0.0  
**Last Updated**: July 3, 2026  
**Status**: ✅ Ready for Testing
