# Universal Autofill Engine - Quick Reference Guide

## TL;DR - The Three New Modules

### 1. Field Detector 🔍
**What**: Finds form fields on job application pages
**How**: Analyzes labels, attributes, types, context
**Why**: Identifies what needs to be filled
```javascript
const detector = new FieldDetector();
const fields = detector.getAllFormFields();
// Gets all visible, interactive form fields with metadata
```

### 2. Field Validator ✅
**What**: Checks if user data is valid before filling
**How**: Validates email, phone, URL, dates, numbers, files, etc.
**Why**: Prevents invalid data submission and XSS attacks
```javascript
const validator = new FieldValidator();
const result = validator.validateEmail('john@example.com');
// { valid: true }
```

### 3. Confidence Scorer 🎯
**What**: Decides if field should be auto-filled or ask user
**How**: Scores matches: semantic 40%, name 30%, type 20%, context 10%
**Why**: Smart autofill = fewer mistakes, better UX
```javascript
const scorer = new ConfidenceScorer();
const score = scorer.scoreFieldMatch(fieldInfo, 'email', value);
// { confidence: 0.92, action: 'auto_fill' }
```

---

## Common Use Cases

### Detect and Fill Email Field
```javascript
const detector = new FieldDetector();
const validator = new FieldValidator();
const scorer = new ConfidenceScorer();

// 1. Find all fields
const fields = detector.getAllFormFields();

// 2. Find email field
const emailField = fields.find(f => {
  const analysis = detector.analyzeField(f);
  return analysis[0]?.fieldKey === 'email';
});

// 3. Check confidence
const score = scorer.scoreFieldMatch(
  emailField, 
  'email', 
  'user@example.com'
);

// 4. Validate data
const valid = validator.validateEmail('user@example.com');

// 5. Fill if confident and valid
if (score.confidence >= 0.85 && valid.valid) {
  emailField.element.value = 'user@example.com';
  emailField.element.dispatchEvent(new Event('input'));
}
```

### Validate Entire Profile Before Autofill
```javascript
const validator = new FieldValidator();

const profileSchema = {
  required: ['email', 'phone'],
  fields: {
    email: { type: 'email' },
    phone: { type: 'phone', country: 'US' }
  }
};

const result = validator.validateProfile(userProfile, profileSchema);

if (!result.valid) {
  console.log('Errors:', result.errors); // { email: 'Invalid format' }
} else {
  console.log('Profile is valid, ready to autofill');
}
```

### Score Entire Form for Autofill Success
```javascript
const scorer = new ConfidenceScorer();

// Get all fields and possible profile matches
const fields = detector.getAllFormFields();
const profileMatches = [
  { key: 'email', data: profile.email },
  { key: 'phone', data: profile.phone },
  { key: 'firstName', data: profile.firstName }
];

// Score the entire form
const formScore = scorer.scoreForm(fields, profileMatches);

console.log(`${formScore.matchedFields}/${formScore.totalFields} fields matched`);
console.log(`Average confidence: ${(formScore.averageConfidence * 100).toFixed(1)}%`);
console.log(`Action: ${formScore.formClassification.action}`);
// Output: 15/18 fields matched
//         Average confidence: 87.3%
//         Action: auto_fill
```

### Custom Validator for Custom Fields
```javascript
const validator = new FieldValidator();

// Register custom validator for LeetCode rating
validator.registerCustomValidator('leetcode', (value) => ({
  valid: value >= 500 && value <= 3000,
  error: 'LeetCode rating must be between 500-3000'
}));

// Use it
const result = validator.validateCustom('leetcode', 2100);
// { valid: true }

const result2 = validator.validateCustom('leetcode', 4000);
// { valid: false, error: 'LeetCode rating must be between 500-3000' }
```

### Phone Validation by Country
```javascript
const validator = new FieldValidator();

// US phone
validator.validatePhone('555-123-4567', 'US');
// { valid: true }

// India phone
validator.validatePhone('+91-9876543210', 'India');
// { valid: true }

// UK phone
validator.validatePhone('+44-20-7946-0958', 'UK');
// { valid: true }

// Unknown country (fallback)
validator.validatePhone('123-456-7890', 'Japan');
// { valid: true } - uses basic validation
```

### Batch Validate Multiple Fields
```javascript
const validator = new FieldValidator();

const fieldData = {
  email: 'john@example.com',
  phone: '555-123-4567',
  experience: 5,
  website: 'https://johndoe.com'
};

const schema = {
  email: { type: 'email', required: true },
  phone: { type: 'phone', required: true, country: 'US' },
  experience: { type: 'yearsExperience' },
  website: { type: 'url' }
};

const results = validator.validateBatch(fieldData, schema);

Object.entries(results).forEach(([field, result]) => {
  console.log(`${field}: ${result.valid ? '✅' : '❌'}`);
});
// Output:
// email: ✅
// phone: ✅
// experience: ✅
// website: ✅
```

### Rank Possible Field Matches
```javascript
const scorer = new ConfidenceScorer();

const fieldInfo = {
  label: 'Contact Email',
  name: 'contact_email',
  type: 'email',
  context: 'Please provide your email address'
};

const possibleMatches = [
  { key: 'phone', data: '+1234567890' },
  { key: 'email', data: 'user@example.com' },
  { key: 'website', data: 'https://example.com' }
];

const ranked = scorer.scoreAndRankMatches(fieldInfo, possibleMatches);

ranked.forEach(match => {
  console.log(`${match.profileKey}: ${(match.confidence * 100).toFixed(1)}%`);
});
// Output:
// email: 95.2%
// website: 42.0%
// phone: 28.5%
```

### Get Best Match Above Threshold
```javascript
const scorer = new ConfidenceScorer();

const best = scorer.getBestMatch(
  fieldInfo,
  possibleMatches,
  0.70 // minimum confidence threshold
);

if (best) {
  console.log(`Best match: ${best.profileKey} (${(best.confidence * 100).toFixed(1)}%)`);
  console.log(`Recommendation: ${best.recommendation}`); // auto_fill, confirm, skip
} else {
  console.log('No match above threshold');
}
```

### Detect React Component Fields
```javascript
const detector = new FieldDetector();

// Checks for React elements and data bindings
const dynamic = detector.detectDynamicContent();
console.log(dynamic.hasReactElements); // true for React apps
console.log(dynamic.hasLoadingIndicators); // true if loading
console.log(dynamic.hasLazyLoadedFields); // true if lazy loading

// Handle accordingly
if (dynamic.hasReactElements) {
  // Use React-specific event triggering
  // Trigger 'input' and 'change' events
}
```

### Detect Multi-Step Forms
```javascript
const detector = new FieldDetector();

const multiStep = detector.detectMultiStepForm();
console.log(multiStep.hasSteps); // true
console.log(multiStep.currentStep); // 1
console.log(multiStep.totalSteps); // 3

// Fill step by step
for (let step = 1; step <= multiStep.totalSteps; step++) {
  const fieldsInStep = detector.getAllFormFields();
  // Fill fields for current step
  // Wait for next button or proceed to next step
}
```

---

## Common Patterns

### Pattern 1: Smart Autofill Workflow
```javascript
async function smartAutofill(profile) {
  const detector = new FieldDetector();
  const validator = new FieldValidator();
  const scorer = new ConfidenceScorer();

  // 1. Validate profile
  const validation = validator.validateProfile(profile, schema);
  if (!validation.valid) throw new Error('Invalid profile');

  // 2. Detect form
  const fields = detector.getAllFormFields();
  console.log(`Found ${fields.length} fields`);

  // 3. Score and fill
  for (const field of fields) {
    const analysis = detector.analyzeField(field);
    const match = scorer.scoreFieldMatch(field, analysis[0].fieldKey, profile[analysis[0].fieldKey]);
    
    if (match.confidence >= 0.85) {
      field.element.value = profile[analysis[0].fieldKey];
      field.element.dispatchEvent(new Event('input'));
    }
  }
}
```

### Pattern 2: Confirmation Workflow
```javascript
async function autofillWithConfirmation(profile, onConfirm) {
  const scorer = new ConfidenceScorer();
  const fields = detector.getAllFormFields();

  for (const field of fields) {
    const score = scorer.scoreFieldMatch(field, key, value);
    
    if (score.confidence >= 0.85) {
      // Auto-fill high confidence
      field.element.value = value;
    } else if (score.confidence >= 0.60) {
      // Ask for confirmation
      const confirmed = await onConfirm({
        field: field.label,
        suggestedValue: value,
        confidence: score.confidence
      });
      
      if (confirmed) {
        field.element.value = value;
      }
    }
    // Skip low confidence fields
  }
}
```

### Pattern 3: Security-First Approach
```javascript
function secureAutofill(profile, field, value) {
  const validator = new FieldValidator();
  
  // 1. Sanitize input
  const sanitized = validator.sanitizeInput(value);
  
  // 2. Check for suspicious patterns
  if (validator.checkSuspiciousPatterns(sanitized)) {
    console.warn('Suspicious pattern detected');
    return false;
  }
  
  // 3. Validate against field type
  const validation = validator.validateByType(sanitized, field.type);
  if (!validation.valid) {
    console.error('Validation failed:', validation.error);
    return false;
  }
  
  // 4. Safe to fill
  field.element.value = sanitized;
  return true;
}
```

---

## Confidence Levels Explained

```
┌─────────────────────────────────────────────────┐
│  CONFIDENCE LEVEL GUIDE                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  HIGH (≥0.85) - AUTO-FILL                      │
│  ├─ Examples:                                  │
│  │  • "What is your email?" → email field      │
│  │  • type="email" field → email value         │
│  │  • "Phone Number" field → phone value       │
│  └─ Error rate: <2%                            │
│                                                 │
│  MEDIUM (0.60-0.85) - CONFIRM                  │
│  ├─ Examples:                                  │
│  │  • "Contact Info" → could be email/phone    │
│  │  • Custom field names → might be company    │
│  │  • Similar patterns → LinkedIn vs GitHub    │
│  └─ Error rate: 5-15%                          │
│                                                 │
│  LOW (<0.60) - SKIP                            │
│  ├─ Examples:                                  │
│  │  • Unknown field types                      │
│  │  • No clear label/context                   │
│  │  • Custom niche fields                      │
│  └─ Requires manual entry                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## API Cheat Sheet

### FieldDetector
```javascript
new FieldDetector()                              // Create instance
.detectField(element)                            // Analyze single field
.getFieldType(element)                           // Get input type
.extractLabel(element)                           // Get field label
.isVisible(element)                              // Check if visible
.isInteractive(element)                          // Check if clickable
.analyzeField(fieldInfo)                         // Score matches
.registerCustomPattern(name, pattern)            // Add custom pattern
.getAllFormFields()                              // Get all fields
.detectFieldGroups()                             // Group related fields
.detectMultiStepForm()                           // Check for steps
.detectDynamicContent()                          // Check for async loading
```

### FieldValidator
```javascript
new FieldValidator()                             // Create instance
.validateEmail(email)                            // Validate email
.validatePhone(phone, country)                   // Validate phone
.validateUrl(url)                                // Validate URL
.validateDate(date)                              // Validate date
.validatePostalCode(code, country)               // Validate postal
.validateYearsExperience(years)                  // Validate 0-70
.validateGPA(gpa)                                // Validate 0-4.0
.validateSalary(salary)                          // Validate salary
.validateGraduationYear(year)                    // Validate year
.validateFile(file, options)                     // Validate file
.validateRequired(value)                         // Check required
.validateByType(value, type, options)            // Type-based validation
.validateBatch(data, schema)                     // Multiple fields
.validateProfile(profile, schema)                // Full profile
.sanitizeInput(input)                            // Remove XSS
.checkSuspiciousPatterns(input)                  // Detect injection
.registerCustomValidator(name, fn)               // Custom rule
```

### ConfidenceScorer
```javascript
new ConfidenceScorer()                           // Create instance
.calculateConfidence(fieldMatch)                 // Calculate score
.scoreSemanticMatch(label, key)                  // Semantic match
.scoreNameMatch(name, key)                       // Name attribute
.scoreTypeMatch(type, expected)                  // Input type
.scoreContextMatch(context, key)                 // Nearby text
.classifyConfidence(score)                       // Get action
.scoreFieldMatch(fieldInfo, key, value)          // Score field
.scoreAndRankMatches(fieldInfo, matches)         // Rank matches
.getBestMatch(fieldInfo, matches, threshold)     // Best match
.scoreForm(fields, profileData)                  // Score form
.getScoringStatistics()                          // Get stats
.getConfidenceDistribution()                     // Get breakdown
.setThresholds(thresholds)                       // Custom thresholds
.setWeights(weights)                             // Custom weights
.resetHistory()                                  // Clear history
```

---

## Troubleshooting

### "Field Not Detected"
```javascript
// 1. Check if field is visible
console.log(detector.isVisible(element)); // Should be true

// 2. Check if field is interactive
console.log(detector.isInteractive(element)); // Should be true

// 3. Check if field has label/context
const fieldInfo = detector.detectField(element);
console.log(fieldInfo.label); // Should have value

// 4. Manually add pattern if not recognized
detector.registerCustomPattern('myField', {
  keywords: ['my', 'custom', 'field'],
  patterns: [/myfield/i]
});
```

### "Validation Failing"
```javascript
// 1. Check for country-specific formats
validator.validatePhone(value, 'US'); // Must match US format

// 2. Check for special characters
const sanitized = validator.sanitizeInput(value);

// 3. Check for suspicious patterns
validator.checkSuspiciousPatterns(value); // Should be false
```

### "Low Confidence Scores"
```javascript
// 1. Check field labeling
const fieldInfo = detector.detectField(element);
console.log(fieldInfo.label); // Should be descriptive

// 2. Adjust custom thresholds
scorer.setThresholds({
  high: 0.80,     // Lower from 0.85
  medium: 0.50    // Lower from 0.60
});

// 3. Review scoring breakdown
const score = scorer.scoreFieldMatch(fieldInfo, key, value);
console.log(score.scores); // See individual component scores
```

---

## Performance Tips

### Tip 1: Cache Field Analysis
```javascript
// Instead of analyzing each time
const fieldCache = new Map();

for (const field of fields) {
  let analysis = fieldCache.get(field.id);
  if (!analysis) {
    analysis = detector.analyzeField(detector.detectField(field));
    fieldCache.set(field.id, analysis);
  }
}
```

### Tip 2: Batch Validation
```javascript
// Instead of validating individually
const results = validator.validateBatch(fieldData, schema);
// Faster than multiple calls
```

### Tip 3: Use Thresholds
```javascript
// Skip scoring low-match fields
const best = scorer.getBestMatch(field, matches, 0.70);
if (best) {
  // Continue processing
}
```

---

## Need Help?

- **Full Documentation**: See `AUTOFILL_MODULES_GUIDE.md`
- **Implementation Status**: See `IMPLEMENTATION_STATUS.md`
- **Test Examples**: See `__tests__/*.test.js` files
- **Integration Guide**: See main `UNIVERSAL_AUTOFILL_ENGINE.md`

---

**Last Updated**: June 30, 2026  
**Status**: Production Ready ✅
