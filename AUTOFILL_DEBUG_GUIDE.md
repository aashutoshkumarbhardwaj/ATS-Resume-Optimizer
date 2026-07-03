# Autofill Debugging Quick Guide

## Console Log Prefix Reference

| Prefix | Location | Responsibility |
|--------|----------|-----------------|
| `[Popup]` | popup.js | Profile form, save/load functionality |
| `[UnifiedButton]` | floatingButtonManager.js | Floating button UI, trigger autofill |
| `[Content]` | content-script.js | Message handling, orchestrator coordination |
| `[Orchestrator]` | autofillOrchestrator.js | Form detection, field filling |

## Quick Troubleshooting

### Issue: "Profile was lost. Please fill out your profile again."

**What it means**: Profile data is not in storage

**Debug steps**:
```javascript
// Open browser console (F12 → Console tab)
// Manually check what's in storage:
chrome.storage.local.get(['autofillProfile'], (result) => {
    console.log('Stored profile:', result.autofillProfile);
    console.log('Keys in profile:', result.autofillProfile ? Object.keys(result.autofillProfile) : 'NONE');
});
```

**Fix**:
1. Fill profile again
2. Watch for: `[Popup] ✅ Profile saved to local storage`
3. Verify: `[Popup] ✅ Profile verified in storage with N fields`

---

### Issue: Autofill Button Not Appearing

**What it means**: floatingButtonManager.js failed to initialize or inject button

**Check logs for**:
- `[UnifiedButton] ✅ UnifiedAutofillButton initialized successfully` ← SHOULD SEE THIS
- `[UnifiedButton] ❌ UnifiedAutofillButton class not found after 5 seconds` ← BAD
- `[UnifiedButton] Button injected successfully` ← SHOULD SEE THIS

**Fix**: 
- Check manifest.json has floatingButtonManager.js BEFORE content-script.js
- Verify no JavaScript errors in console
- Try refresh page

---

### Issue: Autofill Button Appears But Does Nothing When Clicked

**What it means**: Button click isn't triggering orchestrator or message sending failed

**Check logs for**:
- `[UnifiedButton] 🚀 Starting autofill process...`
- `[UnifiedButton] 📦 Profile data: present (N keys)` ← Should see this
- `[UnifiedButton] 📬 Sending autofill trigger to content script...`

**If you see "Profile data: MISSING"**:
- User hasn't saved profile yet
- Profile was deleted from storage
- Fix: Fill and save profile in popup

**If you don't see the logs**:
- Button might not be initialized
- Check: `typeof window.UnifiedAutofillButton` in console
- Should return `"function"`

---

### Issue: "No matching fields found" Even Though Form Has Fields

**What it means**: Orchestrator detected form but couldn't match fields to profile

**Check logs for**:
- `[Orchestrator] 🔍 Found N input elements on the page` ← How many found?
- `[Orchestrator] ✅ Detected field: "email" → "email" (INPUT)` ← Field mappings
- `[Orchestrator] ⚠️  No pattern match for field: "username"` ← Fields that didn't match

**Understanding the mapping**:
```javascript
// Orchestrator looks for these patterns in field labels:
email: ['email', 'emailaddress', 'e-mail', 'mail'],
name: ['name', 'full name', 'fullname'],
firstName: ['first name', 'firstname', 'given name'],
lastName: ['last name', 'lastname', 'family name'],
phone: ['phone', 'telephone', 'mobile', 'cell', 'contact'],
city: ['city', 'town'],
// ... etc
```

**Example**:
- Form field label: "What's your email?" → Matches "email" pattern ✅
- Form field label: "Username" → Doesn't match any pattern ❌

**Fix**:
- Add more pattern matching in autofillOrchestrator.js `fieldMapper`
- Or manually fill those fields

---

### Issue: "Filled N fields" But Some Fields Still Empty

**What it means**: Orchestrator filled what it could match, but form has fields it couldn't detect

**Check logs for**:
- `[Orchestrator] 📊 Final Results: { filled: N, skipped: M, failed: 0 }`
- `[Orchestrator] ✅ Successfully filled field "email"` ← What was filled
- `[Orchestrator] ⏭️  Skipped field "Username" - no value for "username"` ← What was skipped

**Understanding skipped vs failed**:
- **Skipped**: Field detected but no matching profile data (e.g., field wants "middle_name" but profile only has first_name/last_name)
- **Failed**: Field detected and profile has data, but element manipulation failed (rare)

**Fix**:
- Add more fields to profile form (check autofill popup for what's available)
- Add more pattern matching for unusual field names

---

## Common Success Logs

### Successful profile save:
```
[Popup] 💾 Saving profile with 20 fields
[Popup] ✅ Profile saved to local storage
[Popup] ✅ Profile saved to sync storage (backup)
[Popup] ✅ Profile verified in storage with 20 fields
```

### Successful autofill:
```
[UnifiedButton] 🚀 Starting autofill process...
[UnifiedButton] 📦 Profile data: present (20 keys)
[UnifiedButton] 📬 Sending autofill trigger to content script...
[Content] 📬 Received autofill trigger: TRIGGER_AUTOFILL_FROM_BUTTON
[Orchestrator] 🔍 Found 8 input elements on the page
[Orchestrator] 📋 Total detected fields: 5
[Orchestrator] 📊 Autofill summary: { filled: 5, skipped: 0, failed: 0, total: 5 }
[UnifiedButton] ✅ Autofill succeeded. Filled fields: 5
```

---

## Manual Testing from Console

### Check if profile exists:
```javascript
chrome.storage.local.get(['autofillProfile'], (r) => console.log(r.autofillProfile));
```

### Manually trigger autofill on current page:
```javascript
chrome.runtime.sendMessage({
    type: 'TRIGGER_AUTOFILL_FROM_POPUP',
    profile: {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '555-1234'
    }
}, (response) => console.log('Response:', response));
```

### Check if UnifiedAutofillButton class is available:
```javascript
console.log('Class available:', typeof window.UnifiedAutofillButton);
console.log('Button instance:', window.__unifiedAutofillButtonInstance);
console.log('Button in DOM:', !!document.getElementById('ats-unified-autofill-button'));
```

### Check manifest script loading:
```javascript
console.log('AutofillOrchestrator available:', typeof AutofillOrchestrator);
console.log('window keys with Button/Autofill:', 
    Object.keys(window).filter(k => k.includes('Button') || k.includes('Autofill')));
```

---

## Performance Notes

- Profile save should be <100ms
- Button initialization should be <500ms
- Autofill operation should be <2 seconds (depends on form size)
- If operations timeout or hang, check extension context in console

---

## Emergency Reset

If something is broken and you want to start fresh:

```javascript
// Clear all extension storage:
chrome.storage.local.clear(() => console.log('Local storage cleared'));
chrome.storage.sync.clear(() => console.log('Sync storage cleared'));

// Then reload extension:
// Go to chrome://extensions → find extension → click reload
```
