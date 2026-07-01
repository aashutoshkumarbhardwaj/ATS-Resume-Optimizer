# Phase 2 Quick Reference Guide

**TL;DR Version of Phase 2 Implementation**

---

## The 6 Improvements (One-liner each)

| # | Improvement | What | When Done |
|---|---|---|---|
| 1 | Google Forms & React | Support complex form types | Task 22 |
| 2 | Floating Button Fix | Always accessible autofill | Task 18 |
| 3 | Auto Autofill | No clicks needed | Task 19 |
| 4 | Better Job Extraction | Works on 8+ job boards | Task 20 |
| 5 | Field Detection | Recognizes field variations | Task 14-15 |
| 6 | Dropdown Selection | Auto-selects options | Task 16-17 |

---

## Implementation Order

```
Foundation (Week 1-2)
├── Task 14: Field detector (inputs, Shadow DOM, iframes)
├── Task 15: Field mapper (variations, resume mapping)
├── Task 21: Event dispatcher (React, Vue, Angular)
↓
Frameworks (Week 3-4)
├── Task 16: Framework adapters (React Select, MUI, Ant, Chakra, Headless UI, Google Forms)
├── Task 17: Dropdown selector (country, state, salary, etc.)
↓
Extraction (Week 5-6)
├── Task 20: Platform extractors (LinkedIn, Indeed, Glassdoor, Monster, ZipRecruiter, etc.)
├── Task 20: Shadow DOM, iframe, lazy-load support
↓
Automation (Week 7-8)
├── Task 18: Floating button manager (inject, monitor, persist)
├── Task 19: Autofill orchestrator (auto-detect, auto-extract, auto-fill)
├── Task 23: Integration & testing
├── Task 24: UI/UX enhancements
↓
Testing & Polish (Week 9)
└── Comprehensive testing on all platforms
```

---

## Key Files to Create/Modify

### Create New Files (15 total)

**Field Detection** (3 files)
```
extension/src/autofill/core/fieldDetector.js      (Enhanced existing)
extension/src/autofill/core/fieldMapper.js        (NEW)
extension/src/autofill/core/eventDispatcher.js    (NEW)
```

**Framework Adapters** (6 files)
```
extension/src/autofill/adapters/reactSelectAdapter.js   (NEW)
extension/src/autofill/adapters/muiAdapter.js            (NEW)
extension/src/autofill/adapters/antDesignAdapter.js      (NEW)
extension/src/autofill/adapters/chakraAdapter.js         (NEW)
extension/src/autofill/adapters/headlessUIAdapter.js     (NEW)
extension/src/autofill/adapters/googleFormsAdapter.js    (NEW)
```

**Dropdown Selection** (1 file)
```
extension/src/autofill/core/dropdownSelector.js   (NEW)
```

**Job Extraction** (3 files)
```
extension/src/autofill/extractors/platformExtractors.js    (NEW - router)
extension/src/autofill/extractors/linkedinExtractor.js     (NEW)
extension/src/autofill/extractors/indeedExtractor.js       (NEW)
extension/src/autofill/extractors/glassdoorExtractor.js    (NEW)
extension/src/autofill/extractors/monsterExtractor.js      (NEW)
extension/src/autofill/extractors/semanticExtractor.js     (NEW - fallback)
```

**Automation & UI** (2 files)
```
extension/src/contentScript/floatingButton.js     (NEW)
extension/src/contentScript/autofillOrchestrator.js (NEW)
```

**Modify Existing** (2 files)
```
extension/src/contentScript/content-script.js     (Add orchestrator trigger)
extension/src/popup/popup-fixed.js                (Add progress/results UI)
```

---

## Code Architecture Patterns

### Pattern 1: Framework Detection

```javascript
class FrameworkAdapter {
  static detect(element) {
    // Check class names, IDs, data attributes
    // Return true if this framework is detected
  }
  
  static async setValue(element, value) {
    // Framework-specific logic to set value
    // Dispatch appropriate events
    // Return true on success
  }
}
```

### Pattern 2: Value Mapping

```javascript
class ValueMapper {
  static MAPPINGS = {
    fieldType: {
      'resumeValue': ['option1', 'option2', 'option3'],
      'resumeValue2': ['option4', 'option5'],
    }
  };
  
  static findMatch(fieldType, resumeValue, dropdownOptions) {
    // Match resume value to dropdown options
    // Return best matching option
  }
}
```

### Pattern 3: Extractor Interface

```javascript
class PlatformExtractor {
  async extract() {
    return {
      jobTitle: string,
      company: string,
      description: string,
      location: string,
      requirements: string[],
      salary: string,
    };
  }
}
```

---

## Event Dispatching Checklist

When filling any input:

```javascript
// 1. Set the value
element.value = newValue;

// 2. Trigger React state (if React component)
triggerReactUpdate(element, newValue);

// 3. Dispatch input event
element.dispatchEvent(new Event('input', { bubbles: true }));

// 4. Dispatch change event
element.dispatchEvent(new Event('change', { bubbles: true }));

// 5. Dispatch blur event
element.dispatchEvent(new Event('blur', { bubbles: true }));

// 6. Small delay for state update
await wait(50);
```

---

## Testing Checkpoints

### After Task 14 (Field Detection)
```
✓ Detects all HTML input types
✓ Detects Shadow DOM elements
✓ Detects iframe content
✓ Confidence scoring works
```

### After Task 15 (Field Mapper)
```
✓ Recognizes all field variations
✓ Maps to correct resume data
✓ Handles edge cases
```

### After Task 21 (Event Dispatcher)
```
✓ React inputs update state
✓ Vue inputs update state
✓ All events dispatched in order
✓ Forms recognize changes
```

### After Task 16 (Framework Adapters)
```
✓ React Select works
✓ MUI Select works
✓ Ant Design Select works
✓ Chakra UI works
✓ Headless UI works
✓ Google Forms works
```

### After Task 17 (Dropdown Selector)
```
✓ Country selection 95%+ accurate
✓ State selection 95%+ accurate
✓ Employment type selection 95%+ accurate
✓ All field types working
```

### After Task 20 (Job Extraction)
```
✓ LinkedIn extraction 90%+ success
✓ Indeed extraction 90%+ success
✓ Glassdoor extraction 90%+ success
✓ Shadow DOM extraction works
✓ iframe extraction works
✓ Lazy-load support works
```

### After Task 18 (Floating Button)
```
✓ Button injects on app form pages
✓ Button survives page refresh
✓ Button re-injects if missing
✓ "Show Button" works
✓ Button doesn't interfere with form
```

### After Task 19 (Orchestrator)
```
✓ Auto-detects application form
✓ Auto-extracts job description
✓ Auto-fills all fields
✓ Reports results
✓ Handles errors gracefully
```

---

## Performance Targets

| Component | Target | Threshold |
|-----------|--------|-----------|
| Field detection | < 500ms | < 1s |
| Job extraction | < 2s | < 3s |
| Autofill completion | < 5s | < 10s |
| Button injection | < 100ms | < 200ms |
| Memory usage | < 10MB | < 20MB |
| CPU peak usage | < 10% | < 20% |

---

## Field Variation Examples

### First Name
```
✓ "First Name"       ✓ "Given Name"        ✓ "Legal Name"
✓ "Preferred Name"   ✓ "First_Name"        ✓ "FirstName"
✓ "Forename"         ✓ "First N."          ✓ "FName"
✓ "GivenName"        ✓ "LegalName"         ✓ "PreferredName"
```

### Country
```
✓ "Country"          ✓ "Country of Residence"    ✓ "Nationality"
✓ "Country Code"     ✓ "Select Country"          ✓ "Your Country"
```

### Employment Type
```
✓ "Full-time"        ✓ "Full time"        ✓ "FT"
✓ "Fulltime"         ✓ "Part-time"        ✓ "Part time"
✓ "PT"               ✓ "Parttime"         ✓ "Contract"
✓ "Contractor"       ✓ "Temporary"        ✓ "Temp"
```

### Notice Period
```
✓ "Immediate"        ✓ "Now"               ✓ "0"
✓ "15 days"          ✓ "15"                ✓ "Two weeks"
✓ "30 days"          ✓ "30"                ✓ "One month"
✓ "60 days"          ✓ "60"                ✓ "Two months"
```

---

## Platform Extractors Needed

| Platform | Priority | Confidence Target |
|----------|----------|-------------------|
| LinkedIn | High | 95%+ |
| Indeed | High | 95%+ |
| Glassdoor | High | 90%+ |
| Monster | High | 90%+ |
| ZipRecruiter | Medium | 85%+ |
| Workable | Medium | 85%+ |
| Greenhouse | Medium | 85%+ |
| Lever | Medium | 85%+ |
| Generic | High | 75%+ |

---

## Common Issues & Solutions

### Issue: React state not updating
**Solution**: Use React Fiber key to access and trigger update
```javascript
const fiberKey = Object.keys(element).find(key => key.startsWith('__react'));
if (fiberKey) {
  // Access React state and update
}
```

### Issue: Dropdown not responding to clicks
**Solution**: Add delay between open and selection
```javascript
element.click();
await wait(200); // Wait for dropdown to render
selectOption();
```

### Issue: Form not recognizing field change
**Solution**: Dispatch all event types in sequence
```javascript
// input → change → blur (with delays)
```

### Issue: Can't detect elements in Shadow DOM
**Solution**: Use pierceHandler or traverse shadow roots
```javascript
const findInShadow = (selector) => {
  // Traverse shadow DOM boundaries
};
```

### Issue: Job extraction confidence too low
**Solution**: Implement fallback to semantic extraction
```javascript
result = platformExtract() || semanticExtract();
```

---

## Success Definition

When Phase 2 is complete:

```
✓ Extension works on 8+ job boards
✓ Supports Google Forms and React forms
✓ Auto-fills 90%+ of form fields
✓ Detects 95%+ of form fields
✓ Selects 95%+ of dropdown values
✓ Completes in <5 seconds
✓ Floating button always available
✓ No breaking changes to Phase 1
✓ All tests passing
✓ User satisfaction 4.5+ stars
```

---

## Key Metrics to Track

```
Before Phase 2          After Phase 2          Improvement
─────────────────────────────────────────────────────────
Job boards: 3           → 8+                   2.7x
Field detection: 70%    → 95%                  +25%
Form auto-fill: 30%     → 90%                  3x
Dropdown support: 0%    → 95%                  New feature
Time per app: 10-15m    → 2-3m                 5-10x faster
```

---

## Quick Decision Tree

**Need to detect a field?**
→ Use FieldDetector → Map with FieldMapper → Check variations

**Need to fill an input?**
→ Check framework → Use appropriate adapter → Dispatch events

**Need to select a dropdown?**
→ Use DropdownSelector → Find matching option → Click

**Need to extract a job?**
→ Check platform → Use specific extractor → Fallback to semantic

**Need to trigger autofill?**
→ Use Orchestrator → Auto-detect → Auto-extract → Auto-fill → Report

---

## File Size Estimates

| Component | Size | Priority |
|-----------|------|----------|
| Field Detector | 3-4 KB | High |
| Field Mapper | 4-5 KB | High |
| Event Dispatcher | 2-3 KB | High |
| Framework Adapters (6 files) | 8-10 KB | High |
| Dropdown Selector | 6-8 KB | High |
| Platform Extractors | 12-15 KB | High |
| Floating Button | 2-3 KB | Medium |
| Orchestrator | 4-5 KB | High |
| **Total New Code** | **41-53 KB** | - |

---

## Dependencies Check

Already available:
```
✓ Chrome Extension APIs
✓ DOM APIs
✓ ES6+ JavaScript
✓ Event APIs
✓ Storage APIs
```

Need to verify:
```
? jquery (if used anywhere)
? axios/fetch for API calls
? Any polling libraries
```

---

## Rollback Plan

If Phase 2 causes issues:

```
1. Disable orchestrator (revert autofill trigger)
2. Disable floating button manager (revert to popup only)
3. Revert to Phase 1 job extraction
4. Keep field detection improvements (low risk)
5. Investigate issue
6. Deploy fix
```

---

## Communication Template

**For Daily Standup**:
```
Yesterday:
- Completed Task X
- Found issue with Y
- Tests passing for Z

Today:
- Starting Task A
- Need help with B

Blockers:
- None / [describe if any]
```

**For Weekly Review**:
```
Completed: Tasks X, Y, Z
In Progress: Task A
Not Started: Task B (depends on A)
Issues: [describe]
Risk Level: [Low/Medium/High]
On Track: [Yes/No/At Risk]
```

---

## Last Checklist Before Starting

- [ ] Read PHASE_2_SUMMARY.md
- [ ] Read PHASE_2_IMPROVEMENTS.md
- [ ] Read IMPLEMENTATION_GUIDE.md
- [ ] Reviewed current codebase structure
- [ ] Set up local development environment
- [ ] Created Jira tickets for all tasks
- [ ] Assigned team members
- [ ] Scheduled daily standups
- [ ] Set up CI/CD for testing
- [ ] Ready to start Phase 2A

---

**Ready? → Open IMPLEMENTATION_GUIDE.md and start coding!**

---

**Document Version**: 1.0  
**Last Updated**: 2026-07-02
