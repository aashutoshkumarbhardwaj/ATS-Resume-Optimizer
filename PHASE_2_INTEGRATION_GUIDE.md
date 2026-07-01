# Phase 2 Integration Guide

**How to integrate Phase 2 modules into the extension**

---

## Quick Start

### 1. Add Script References to `manifest.json`

Add these new scripts to your `content_scripts`:

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "src/autofill/core/fieldMapper.js",
        "src/autofill/core/eventDispatcher.js",
        "src/autofill/core/dropdownSelector.js",
        "src/autofill/adapters/reactSelectAdapter.js",
        "src/autofill/adapters/muiSelectAdapter.js",
        "src/autofill/adapters/antDesignSelectAdapter.js",
        "src/contentScript/floatingButtonManager.js",
        "src/contentScript/autofillOrchestrator.js",
        "src/contentScript/content-script.js"
      ],
      "run_at": "document_start"
    }
  ]
}
```

### 2. Initialize in Content Script

Add to `content-script.js`:

```javascript
// Initialize Phase 2 modules
const floatingButtonManager = new FloatingButtonManager();
floatingButtonManager.init().catch(err => 
  console.error('[Content] FloatingButton init error:', err)
);

// Listen for autofill trigger
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TRIGGER_AUTOFILL_FROM_BUTTON') {
    const orchestrator = new AutofillOrchestrator();
    orchestrator.start().then(result => {
      sendResponse({ success: true, result });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});
```

### 3. Add Popup Button

In `popup.html`:

```html
<button id="autofill-now-btn" class="btn btn-primary">
  <span id="autofill-status">Auto-fill Form</span>
</button>

<div id="autofill-progress" style="display: none;">
  <div class="progress-bar"></div>
  <p id="progress-text">Filling form...</p>
</div>

<div id="autofill-results" style="display: none;">
  <h3>Results</h3>
  <p><strong>Filled:</strong> <span id="filled-count">0</span></p>
  <p><strong>Skipped:</strong> <span id="skipped-count">0</span></p>
  <p><strong>Failed:</strong> <span id="failed-count">0</span></p>
  <button id="retry-autofill-btn" class="btn btn-secondary">Retry Autofill</button>
</div>
```

### 4. Add Popup Handler

In `popup.js`:

```javascript
document.getElementById('autofill-now-btn').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  
  // Show progress
  document.getElementById('autofill-progress').style.display = 'block';
  document.getElementById('autofill-now-btn').disabled = true;
  
  // Trigger autofill in content script
  chrome.tabs.sendMessage(tab.id, {
    type: 'TRIGGER_AUTOFILL_FROM_POPUP'
  });
});

// Listen for results
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AUTOFILL_RESULT') {
    handleAutofillResult(request.data);
  }
});

function handleAutofillResult(data) {
  document.getElementById('autofill-progress').style.display = 'none';
  document.getElementById('autofill-now-btn').disabled = false;
  
  if (data.type === 'AUTOFILL_COMPLETE') {
    showResults(data.data);
  } else if (data.type === 'ENABLE_MANUAL_JOB_INPUT') {
    showManualJobInput();
  } else if (data.type === 'SHOW_RESUME_UPLOAD') {
    showResumeUpload();
  } else {
    showError(data.type, data.data);
  }
}

function showResults(results) {
  document.getElementById('autofill-results').style.display = 'block';
  document.getElementById('filled-count').textContent = results.filled;
  document.getElementById('skipped-count').textContent = results.skipped;
  document.getElementById('failed-count').textContent = results.failed;
}
```

---

## Module Integration Points

### 1. Field Detection Flow

```
Form Page
    ↓
FloatingButtonManager detects form
    ↓
User clicks button
    ↓
Orchestrator.start()
    ↓
AutofillOrchestrator.detectFormFields()
    ↓
For each field:
  - FieldDetector.detectField()
  - FieldMapper.mapLabelToField()
  - Get confidence score
    ↓
Return mapped fields
```

**Integration Point**: In `autofillOrchestrator.js`:

```javascript
detectFormFields() {
  const fieldDetector = new FieldDetector();
  const fieldMapper = new FieldMapper();
  
  const inputElements = document.querySelectorAll('input, select, textarea');
  
  for (const element of inputElements) {
    const fieldInfo = fieldDetector.detectField(element);
    const label = this.getFieldLabel(element);
    const resumeFieldType = fieldMapper.mapLabelToField(label);
    
    // Store mapped field
  }
}
```

---

### 2. Field Filling Flow

```
Orchestrator.autofillFormFields()
    ↓
For each field:
    ↓
Extract resume value
  FieldMapper.extractResumeValue(resume, fieldType)
    ↓
Transform value
  FieldMapper.transformValue(value, fieldType)
    ↓
Determine field type
    ↓
Dispatch events
  EventDispatcher.dispatchEvent(element, value)
    ↓
If dropdown:
  Check framework
  (ReactSelect, MUI, AntDesign, etc.)
  Or use DropdownSelector.findBestMatch()
    ↓
Dispatch change events
```

**Integration Point**: In `autofillOrchestrator.js`:

```javascript
async fillField(field, value) {
  const { element, fieldType } = field;
  
  // For selects
  if (fieldType === 'select') {
    return await this.fillSelectField(element, value);
  }
  
  // For others
  return await EventDispatcher.dispatchEvent(element, value);
}

async fillSelectField(element, value) {
  if (ReactSelectAdapter.detect(element)) {
    return await ReactSelectAdapter.setValue(element, value);
  }
  
  if (MUISelectAdapter.detect(element)) {
    return await MUISelectAdapter.setValue(element, value);
  }
  
  // Use dropdown selector for matching
  const options = Array.from(element.options);
  const selector = new DropdownSelector();
  const matched = selector.findBestMatch(
    element.name,
    value,
    options
  );
  
  if (matched) {
    element.value = matched.value;
    return await EventDispatcher.dispatchSelectEvents(element, matched.value);
  }
  
  return false;
}
```

---

### 3. Floating Button Integration

```
Page Load
    ↓
FloatingButtonManager.init()
    ↓
Detect if application form
  FloatingButtonManager.isApplicationForm()
    ↓
Yes → Inject button
    ↓
Start monitoring (every 10s)
    ↓
If button missing → Re-inject
```

**Integration Point**: The `floatingButtonManager.js` already handles this automatically. Just ensure it's loaded:

```html
<!-- In manifest.json -->
"content_scripts": [{
  "js": ["src/contentScript/floatingButtonManager.js"]
}]
```

---

## Testing Checklist

### Before going live:

- [ ] All modules loaded in manifest
- [ ] FloatingButton appears on form pages
- [ ] Button click triggers orchestrator
- [ ] Fields are detected correctly
- [ ] Resume values extracted properly
- [ ] React Select dropdowns work
- [ ] MUI dropdowns work
- [ ] Ant Design dropdowns work
- [ ] Results displayed in popup
- [ ] Error handling works
- [ ] No console errors
- [ ] Performance < 5s

---

## Debugging

### Enable Debug Logging

In each module, logging is already in place. Enable it:

```javascript
// In your extension code
localStorage.setItem('debugMode', 'true');

// Then in console
console.log(localStorage.getItem('debugMode'));
```

### Check Specific Module

```javascript
// In popup console or DevTools
new FieldMapper().mapLabelToField("First Name");
// Should return "firstName"

// Test dropdown selector
new DropdownSelector().findBestMatch(
  "country",
  "India",
  [
    { text: "United States" },
    { text: "India" },
    { text: "Canada" }
  ]
);
// Should return India option
```

### Monitor Autofill

```javascript
// In page DevTools console
chrome.runtime.sendMessage({
  type: 'TRIGGER_AUTOFILL_FROM_BUTTON',
  source: 'debug'
});
// Watch for messages and results
```

---

## Common Issues & Solutions

### Issue: Fields not detected
**Solution**: 
1. Check if FieldDetector is loaded
2. Verify label extraction is working
3. Check if resume data exists

```javascript
// Debug
const detector = new FieldDetector();
const field = detector.detectField(inputElement);
console.log('Detected field:', field);
```

---

### Issue: React Select not opening
**Solution**:
1. Check if ReactSelectAdapter.detect() returns true
2. Verify click event is firing
3. Check if options are rendering

```javascript
// Debug
console.log('Is React Select:', ReactSelectAdapter.detect(element));
element.click();
console.log('Elements after click:', document.querySelectorAll('[role="option"]'));
```

---

### Issue: Dropdown values not matching
**Solution**:
1. Check value mapping in DropdownSelector
2. Verify fuzzy matching working
3. Check option text extraction

```javascript
// Debug
const selector = new DropdownSelector();
const options = element.querySelectorAll('option');
console.log('Options:', Array.from(options).map(o => o.text));
console.log('Match for India:', selector.findBestMatch('country', 'India', options));
```

---

### Issue: Events not dispatching
**Solution**:
1. Check if EventDispatcher is loaded
2. Verify element is visible and focusable
3. Check if React Fiber access is working

```javascript
// Debug
console.log('Is React:', EventDispatcher.isReactComponent(element));
EventDispatcher.focus(element);
console.log('Element focused:', document.activeElement === element);
```

---

## Performance Tips

### 1. Optimize Field Detection
```javascript
// Cache detected fields
const fields = this.detectFormFields();
this.detectedFields = fields;

// Reuse instead of re-detecting
for (const field of this.detectedFields) {
  // Fill fields
}
```

### 2. Batch Element Queries
```javascript
// Bad: Multiple queries
for (const field of fields) {
  const option = document.querySelector(`option:contains('${value}')`);
}

// Good: Query once
const allOptions = document.querySelectorAll('option');
for (const field of fields) {
  const option = findInCache(value, allOptions);
}
```

### 3. Debounce Button Clicks
```javascript
let autofillInProgress = false;

button.addEventListener('click', async () => {
  if (autofillInProgress) return;
  
  autofillInProgress = true;
  
  try {
    await orchestrator.start();
  } finally {
    autofillInProgress = false;
  }
});
```

---

## Next Integration Steps

### Phase 2B: More Frameworks
- [ ] Add Chakra UI Adapter
- [ ] Add Headless UI Adapter  
- [ ] Add Google Forms Adapter
- [ ] Test with each framework

### Phase 2C: Enhanced Extraction
- [ ] Add platform-specific extractors
- [ ] Test on LinkedIn, Indeed, Glassdoor
- [ ] Add Shadow DOM support
- [ ] Add iframe support

### Phase 2D: UI Polish
- [ ] Add progress indicator
- [ ] Enhance error messages
- [ ] Add retry mechanism
- [ ] Field remapping UI

---

## Files Modified

### manifest.json
- Add new scripts to content_scripts

### src/contentScript/content-script.js
- Add floating button initialization
- Add autofill message listeners

### src/popup/popup.js
- Add autofill button handler
- Add result display logic

### src/popup/popup.html
- Add autofill button
- Add progress indicator
- Add results display

---

## Success Criteria

When integration is complete:

1. ✅ Extension detects form on page load
2. ✅ Floating button appears automatically
3. ✅ User clicks button
4. ✅ Form auto-fills (85%+ of fields)
5. ✅ Results shown to user
6. ✅ User can make final edits
7. ✅ All happens in <5 seconds
8. ✅ No console errors
9. ✅ Works across multiple browsers
10. ✅ User satisfaction 4.5+ stars

---

**Ready to integrate? Start with step 1 above!**

For questions, refer to module documentation or check console logs.

---

**Document Version**: 1.0
**Last Updated**: 2026-07-02
