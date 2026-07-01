# Phase 2 Implementation Guide

This guide provides step-by-step instructions for implementing the 6 major improvements to the ATS Resume Optimizer extension.

## Quick Start

1. Review the requirements and design in `.kiro/specs/ats-resume-optimizer/`
2. Follow the implementation order below
3. Test each feature as you go
4. Refer to specific task details when implementing

---

## Part 1: Field Detection and Mapping (Foundation)

### Task 1: Enhanced Field Detector

**File**: `extension/src/autofill/core/fieldDetector.js`

**What to do**:
1. Extend the existing `FieldDetector` class
2. Add support for Shadow DOM element detection
3. Add support for iframe content detection
4. Add confidence scoring for field matches

**Key additions**:
```javascript
class FieldDetector {
  // NEW: Detect elements in Shadow DOM
  detectShadowDOMInputs() {
    const shadowElements = [];
    // Traverse all Shadow DOM boundaries
    return shadowElements;
  }
  
  // NEW: Detect elements inside iframes
  detectIframeInputs() {
    const iframeElements = [];
    // Access and traverse iframe content safely
    return iframeElements;
  }
  
  // NEW: Calculate confidence score for field match
  calculateConfidence(label, element, fieldType) {
    // Return score 0-100 based on:
    // - Label match quality
    // - Element accessibility
    // - Semantic relevance
    return score;
  }
}
```

**Tests**:
- [ ] Detects inputs in Shadow DOM
- [ ] Detects inputs in iframes
- [ ] Confidence scores are reasonable

---

### Task 2: Field Variations and Mapping

**File**: `extension/src/autofill/core/fieldMapper.js` (NEW)

**What to do**:
1. Create field variation database
2. Implement fuzzy matching
3. Map resume fields to form fields

**Implementation**:
```javascript
class FieldMapper {
  // Comprehensive field variations
  static FIELD_VARIATIONS = {
    firstName: [
      'first name', 'given name', 'legal name', 'preferred name',
      'first_name', 'firstname', 'forename', 'first n',
      'fname', 'givenname', 'legalname', 'preferredname'
    ],
    lastName: [
      'last name', 'family name', 'surname',
      'last_name', 'lastname', 'lname'
    ],
    // ... all 20+ field types with variations
  };
  
  // Match any variation to resume field
  static mapLabelToField(label) {
    // Implement fuzzy matching
    // Return best match or null
  }
  
  // Extract value from resume for a field type
  static extractResumeValue(resume, fieldType) {
    // Return appropriate resume value for field type
  }
}
```

**Data to include**:
- Basic info: firstName, lastName, email, phone, address
- Location: country, state, city, zipCode
- Professional: company, jobTitle, yearsExperience, salary, noticePeriod
- Employment: employmentType, visaStatus
- Education: degree, major, gpa, graduationYear
- Links: linkedIn, portfolio, github

**Tests**:
- [ ] Recognizes all field variations
- [ ] Fuzzy matching works
- [ ] Resume values extracted correctly

---

### Task 3: Event Dispatching

**File**: `extension/src/autofill/core/eventDispatcher.js` (NEW)

**What to do**:
1. Create universal event dispatcher
2. Handle React Fiber access
3. Support all form frameworks

**Implementation**:
```javascript
class EventDispatcher {
  // Dispatch all necessary events for input change
  static dispatchInputEvents(element, value) {
    // Set value
    element.value = value;
    
    // Trigger React state if available
    this.triggerReactUpdate(element, value);
    
    // Dispatch browser events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }
  
  // Access React Fiber to trigger updates
  static triggerReactUpdate(element, value) {
    const fiberKey = Object.keys(element).find(key => 
      key.startsWith('__react')
    );
    
    if (fiberKey) {
      // Access and update React state
      // This ensures form recognizes the change
    }
  }
}
```

**Tests**:
- [ ] Events dispatched in correct order
- [ ] React inputs update state
- [ ] Vue inputs update state
- [ ] Angular inputs update state

---

## Part 2: Form Framework Support

### Task 4: React Select Adapter

**File**: `extension/src/autofill/adapters/reactSelectAdapter.js` (NEW)

**Implementation**:
```javascript
class ReactSelectAdapter {
  static detect(element) {
    // Check if element is React Select component
    return element.closest('[class*="react-select"]') || 
           element.closest('[class*="Select"]');
  }
  
  static async setValue(element, value) {
    // 1. Find the input element
    const input = element.querySelector('input') || element;
    
    // 2. Focus and click to open dropdown
    input.focus();
    input.click();
    
    // 3. Wait for dropdown to appear
    await this.waitForDropdown();
    
    // 4. Find matching option
    const option = this.findOption(value);
    
    // 5. Click the option
    if (option) {
      option.click();
      await this.wait(100); // Allow state update
      return true;
    }
    
    return false;
  }
  
  static async waitForDropdown() {
    // Wait up to 500ms for dropdown to appear
    for (let i = 0; i < 50; i++) {
      if (document.querySelector('[class*="MenuList"]')) return;
      await this.wait(10);
    }
  }
  
  static findOption(value) {
    // Find option with matching text
    const options = document.querySelectorAll('[class*="option"]');
    return Array.from(options).find(opt =>
      opt.textContent.toLowerCase().includes(value.toLowerCase())
    );
  }
}
```

**Tests**:
- [ ] Detects React Select
- [ ] Opens dropdown
- [ ] Selects correct option
- [ ] State updates properly

---

### Task 5: Material-UI Adapter

**File**: `extension/src/autofill/adapters/muiAdapter.js` (NEW)

Similar to React Select adapter but for MUI Select component.

**Tests**:
- [ ] Detects MUI Select
- [ ] Handles MUI styling
- [ ] Selects correct option

---

### Task 6: Ant Design Adapter

**File**: `extension/src/autofill/adapters/antDesignAdapter.js` (NEW)

For Ant Design Select component.

---

### Task 7: Chakra & Headless UI Adapter

**File**: `extension/src/autofill/adapters/headlessUIAdapter.js` (NEW)

For Chakra UI and Headless UI combobox patterns.

---

## Part 3: Dropdown Value Selection

### Task 8: Dropdown Selector

**File**: `extension/src/autofill/core/dropdownSelector.js` (NEW)

**Implementation**:
```javascript
class DropdownSelector {
  static MAPPINGS = {
    country: {
      'India': ['India', 'IN', 'IND', 'Ind'],
      'United States': ['USA', 'US', 'United States', 'America', 'U.S.A'],
      'Canada': ['Canada', 'CA', 'CAN'],
      'United Kingdom': ['UK', 'GB', 'United Kingdom', 'England'],
      // ... 200+ countries
    },
    
    state: {
      'California': ['CA', 'California', 'Calif.', 'CA 90210'],
      'New York': ['NY', 'New York', 'N.Y.', 'New York State'],
      // ... all US states
    },
    
    employmentType: {
      'Full-time': ['Full-time', 'Full time', 'FT', 'Fulltime', 'Full-Time'],
      'Part-time': ['Part-time', 'Part time', 'PT', 'Parttime'],
      'Contract': ['Contract', 'Contractor', 'Contract Work'],
      'Temporary': ['Temporary', 'Temp', 'Temporary Contract'],
      'Internship': ['Internship', 'Intern', 'Internships'],
      'Freelance': ['Freelance', 'Freelancer', 'Freelancing'],
    },
    
    noticePeriod: {
      'Immediate': ['Immediate', 'Now', 'Ready to join', '0 days'],
      '15 days': ['15 days', '15', 'Two weeks', '2 weeks'],
      '30 days': ['30 days', '30', 'One month', 'Month'],
      '60 days': ['60 days', '60', 'Two months'],
      '90 days': ['90 days', '90', 'Three months'],
    },
    
    visaStatus: {
      'Citizen': ['Citizen', 'Yes, I am a citizen', 'Permanent Resident', 'PR', 'Passport'],
      'Need sponsorship': ['Need sponsorship', 'Visa required', 'Require sponsorship', 'Will need sponsor'],
      'No sponsorship needed': ['No sponsorship', 'No visa required', 'Have work authorization'],
    },
    
    yearsExperience: {
      '0-2': ['0-2 years', '0-2', 'Less than 2', 'Entry level', 'Junior'],
      '2-5': ['2-5 years', '2-5', 'Mid-level'],
      '5-10': ['5-10 years', '5-10', 'Senior'],
      '10+': ['10+ years', '10+', 'More than 10', 'Expert'],
    },
  };
  
  static findBestMatch(fieldType, resumeValue, dropdownOptions) {
    const mappings = this.MAPPINGS[fieldType];
    if (!mappings) return null;
    
    // Find which key the resume value matches
    let resumeKey = null;
    for (const [key, aliases] of Object.entries(mappings)) {
      if (aliases.some(alias => 
        this.matchesValue(resumeValue, alias)
      )) {
        resumeKey = key;
        break;
      }
    }
    
    if (!resumeKey) return null;
    
    // Find matching dropdown option
    const targetAliases = mappings[resumeKey];
    return dropdownOptions.find(option =>
      targetAliases.some(alias =>
        this.matchesOption(option, alias)
      )
    );
  }
  
  static matchesValue(value, target) {
    // Fuzzy match with case-insensitive comparison
    const cleanValue = value?.toLowerCase().trim() || '';
    const cleanTarget = target?.toLowerCase().trim() || '';
    return cleanValue.includes(cleanTarget) || 
           cleanTarget.includes(cleanValue);
  }
  
  static matchesOption(option, target) {
    // Extract text from option element or string
    const optionText = typeof option === 'string' ? option : option.textContent;
    return this.matchesValue(optionText, target);
  }
}
```

**Tests**:
- [ ] Country selection works
- [ ] State selection works
- [ ] Employment type selection works
- [ ] Notice period selection works
- [ ] Experience level selection works
- [ ] Visa status selection works

---

## Part 4: Google Forms Support

### Task 9: Google Forms Handler

**File**: `extension/src/autofill/adapters/googleFormsAdapter.js` (NEW)

**Implementation**:
```javascript
class GoogleFormsAdapter {
  static detect() {
    // Check if current page is Google Forms
    return window.location.hostname.includes('docs.google.com') &&
           document.querySelector('[data-form-id]');
  }
  
  static findAllFields() {
    // Find all Google Forms fields
    const fields = [];
    
    // Text inputs
    document.querySelectorAll('[data-item-type="TEXT"]').forEach(field => {
      fields.push({
        type: 'TEXT',
        element: field,
        label: this.extractLabel(field),
      });
    });
    
    // Multiple choice (radio)
    document.querySelectorAll('[data-item-type="MULTIPLE_CHOICE"]').forEach(field => {
      fields.push({
        type: 'RADIO',
        element: field,
        label: this.extractLabel(field),
        options: this.extractOptions(field),
      });
    });
    
    // Checkboxes
    document.querySelectorAll('[data-item-type="CHECKBOX"]').forEach(field => {
      fields.push({
        type: 'CHECKBOX',
        element: field,
        label: this.extractLabel(field),
        options: this.extractOptions(field),
      });
    });
    
    // Dropdown
    document.querySelectorAll('[data-item-type="DROPDOWN"]').forEach(field => {
      fields.push({
        type: 'SELECT',
        element: field,
        label: this.extractLabel(field),
        options: this.extractOptions(field),
      });
    });
    
    return fields;
  }
  
  static extractLabel(field) {
    // Find the label text for a field
    const labelElement = field.querySelector('[role="heading"]');
    return labelElement?.textContent?.trim() || '';
  }
  
  static extractOptions(field) {
    // Get options for radio/checkbox/dropdown
    const options = [];
    field.querySelectorAll('[role="option"]').forEach(opt => {
      options.push(opt.textContent?.trim() || '');
    });
    return options;
  }
  
  static fillTextField(field, value) {
    const input = field.querySelector('input[type="text"]');
    if (!input) return false;
    
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  
  static selectOption(field, value, type) {
    // For radio/checkbox/dropdown
    if (type === 'RADIO' || type === 'CHECKBOX') {
      const options = field.querySelectorAll('[role="option"]');
      const matching = Array.from(options).find(opt =>
        opt.textContent?.toLowerCase().includes(value.toLowerCase())
      );
      
      if (matching) {
        matching.click();
        return true;
      }
    } else if (type === 'SELECT') {
      // Handle dropdown
      const select = field.querySelector('select') ||
                    field.querySelector('[role="combobox"]');
      // ... implement dropdown selection
    }
    
    return false;
  }
}
```

**Tests**:
- [ ] Detects Google Forms
- [ ] Detects all field types
- [ ] Fills text inputs
- [ ] Selects radio buttons
- [ ] Selects checkboxes
- [ ] Selects dropdown options

---

## Part 5: Job Description Extraction

### Task 10: Platform Extractors

**File**: `extension/src/autofill/extractors/platformExtractors.js` (NEW)

**Implementation**:
```javascript
class PlatformExtractor {
  static async extract(url) {
    const domain = this.getDomain(url);
    const extractor = this.getExtractor(domain);
    
    try {
      const data = await extractor.extract();
      data.confidence = this.calculateConfidence(data);
      return data;
    } catch (error) {
      console.error('Platform extraction failed:', error);
      return null;
    }
  }
  
  static getDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }
  
  static getExtractor(domain) {
    // Return platform-specific extractor
    if (domain.includes('linkedin')) return new LinkedInExtractor();
    if (domain.includes('indeed')) return new IndeedExtractor();
    if (domain.includes('glassdoor')) return new GlassdoorExtractor();
    if (domain.includes('monster')) return new MonsterExtractor();
    if (domain.includes('ziprecruiter')) return new ZipRecruiterExtractor();
    if (domain.includes('workable')) return new WorkableExtractor();
    if (domain.includes('greenhouse')) return new GreenhouseExtractor();
    if (domain.includes('lever')) return new LeverExtractor();
    
    return new SemanticExtractor();
  }
  
  static calculateConfidence(data) {
    let score = 0;
    if (data.jobTitle?.length > 5) score += 25;
    if (data.company?.length > 2) score += 15;
    if (data.description?.length > 200) score += 40;
    if (data.requirements?.length > 0) score += 20;
    return Math.min(score, 100);
  }
}
```

### Task 11: LinkedIn Extractor

**File**: `extension/src/autofill/extractors/linkedinExtractor.js` (NEW)

```javascript
class LinkedInExtractor {
  async extract() {
    return {
      jobTitle: this.extractJobTitle(),
      company: this.extractCompany(),
      location: this.extractLocation(),
      description: this.extractDescription(),
      requirements: this.extractRequirements(),
      salary: this.extractSalary(),
    };
  }
  
  extractJobTitle() {
    return document.querySelector(
      '.job-details-jobs-unified-top-card__job-title'
    )?.textContent?.trim();
  }
  
  extractCompany() {
    return document.querySelector(
      '.job-details-jobs-unified-top-card__company-name'
    )?.textContent?.trim();
  }
  
  extractDescription() {
    const descElement = document.querySelector('.jobs-description__content');
    return descElement?.textContent?.trim();
  }
  
  // ... similar for other fields
}
```

### Task 12: Indeed Extractor

Similar structure for Indeed platform...

### Task 13: Glassdoor Extractor

Similar structure for Glassdoor platform...

**Continue for**: Monster, ZipRecruiter, Workable, Greenhouse, Lever

---

### Task 14: Semantic Extractor (Fallback)

**File**: `extension/src/autofill/extractors/semanticExtractor.js` (NEW)

This uses semantic analysis when platform-specific extractors don't work. (Already partially implemented in content-script.js - extract and refactor)

---

## Part 6: Floating Button & Orchestration

### Task 15: Floating Button Manager

**File**: `extension/src/contentScript/floatingButton.js` (NEW)

```javascript
class FloatingButtonManager {
  constructor() {
    this.buttonId = 'ats-autofill-floating-button';
    this.checkInterval = 10000; // 10 seconds
  }
  
  async init() {
    this.loadPreferences();
    this.injectButton();
    this.startMonitoring();
  }
  
  injectButton() {
    if (document.getElementById(this.buttonId)) return;
    
    const button = document.createElement('div');
    button.id = this.buttonId;
    button.innerHTML = `
      <button class="ats-float-btn" title="Autofill Application">
        <span>Autofill</span>
      </button>
    `;
    
    button.style.cssText = \`
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      background: #4A90E2;
      color: white;
      border: none;
      border-radius: 50px;
      padding: 12px 20px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    \`;
    
    button.querySelector('button').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'TRIGGER_AUTOFILL' });
    });
    
    document.body.appendChild(button);
  }
  
  startMonitoring() {
    this.monitorInterval = setInterval(() => {
      if (!document.getElementById(this.buttonId)) {
        console.log('[FloatingButton] Re-injecting button');
        this.injectButton();
      }
    }, this.checkInterval);
  }
  
  show() {
    const btn = document.getElementById(this.buttonId);
    if (btn) btn.style.display = 'block';
    chrome.storage.local.set({ buttonHidden: false });
  }
  
  hide() {
    const btn = document.getElementById(this.buttonId);
    if (btn) btn.style.display = 'none';
    // NOTE: Visually hidden but NOT removed from DOM
  }
  
  remove() {
    const btn = document.getElementById(this.buttonId);
    if (btn) btn.remove();
    clearInterval(this.monitorInterval);
  }
  
  loadPreferences() {
    chrome.storage.local.get(['buttonHidden'], (result) => {
      if (result.buttonHidden) {
        this.hide();
      }
    });
  }
}
```

### Task 16: Automatic Autofill Orchestrator

**File**: `extension/src/contentScript/autofillOrchestrator.js` (NEW)

```javascript
class AutofillOrchestrator {
  async start() {
    try {
      // Step 1: Detect if we're on an app form
      const isAppForm = await this.detectApplicationForm();
      if (!isAppForm) {
        console.log('[Autofill] Not an application form');
        return;
      }
      
      // Step 2: Extract job description
      const jobData = await this.extractJobDescription();
      if (!jobData || jobData.confidence < 30) {
        this.sendMessage('ENABLE_MANUAL_JOB_INPUT');
        return;
      }
      
      // Step 3: Load resume
      const resume = await this.loadResume();
      if (!resume) {
        this.sendMessage('SHOW_RESUME_UPLOAD');
        return;
      }
      
      // Step 4: Autofill form
      const results = await this.autofillForm(resume, jobData);
      
      // Step 5: Report results
      this.sendMessage('AUTOFILL_COMPLETE', {
        filled: results.filled,
        skipped: results.skipped,
        failed: results.failed,
        details: results.details,
      });
      
    } catch (error) {
      console.error('[Autofill] Error:', error);
      this.sendMessage('AUTOFILL_ERROR', { error: error.message });
    }
  }
  
  async detectApplicationForm() {
    // Check if page has form fields
    const inputs = document.querySelectorAll('input, select, textarea');
    return inputs.length > 0;
  }
  
  async extractJobDescription() {
    // Use enhanced extraction logic
    // (Already implemented in content-script.js)
  }
  
  async loadResume() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['uploadedResume'], (result) => {
        resolve(result.uploadedResume);
      });
    });
  }
  
  async autofillForm(resume, jobData) {
    const detector = new FieldDetector();
    const fields = detector.detectFields();
    const results = {
      filled: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };
    
    for (const field of fields) {
      try {
        const value = this.extractValue(resume, field.dataKey);
        if (!value) {
          results.skipped++;
          continue;
        }
        
        const success = await this.fillField(field, value);
        if (success) {
          results.filled++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
      }
      
      // Small delay between fills
      await this.wait(50);
    }
    
    return results;
  }
  
  extractValue(resume, fieldKey) {
    // Extract appropriate value from resume
    // based on field type
  }
  
  async fillField(field, value) {
    // Use appropriate adapter based on field.framework
    // Return true on success, false on failure
  }
  
  sendMessage(type, data) {
    chrome.runtime.sendMessage({ type, data });
  }
  
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Testing Checklist

### Unit Tests

- [ ] FieldDetector detects all field types
- [ ] FieldMapper maps all field variations
- [ ] EventDispatcher triggers all events
- [ ] React Select adapter works
- [ ] MUI adapter works
- [ ] Ant Design adapter works
- [ ] Chakra/Headless UI adapter works
- [ ] Google Forms adapter works
- [ ] DropdownSelector finds correct options
- [ ] Platform extractors extract job data
- [ ] Floating button manager maintains button
- [ ] Orchestrator completes autofill workflow

### Integration Tests

- [ ] LinkedIn form autofill end-to-end
- [ ] Indeed form autofill end-to-end
- [ ] Glassdoor form autofill end-to-end
- [ ] Google Forms autofill end-to-end
- [ ] Custom form autofill end-to-end

### Manual Testing

- [ ] Test on 5+ real job board applications
- [ ] Test with 5+ different resumes
- [ ] Test floating button persistence
- [ ] Test fallback "Retry" functionality
- [ ] Test error handling
- [ ] Test on different browsers (Chrome, Edge, Brave)

---

## Performance Benchmarks

Target metrics after implementation:

- Form field detection: < 500ms
- Job description extraction: < 2 seconds
- Autofill completion: < 5 seconds
- Floating button injection: < 100ms
- Memory usage: < 10MB for extension
- CPU usage during autofill: < 10% peak

---

## Migration Notes

- All Phase 1 features remain unchanged
- Backward compatible with existing resume data
- No breaking changes to API
- Existing users not affected

