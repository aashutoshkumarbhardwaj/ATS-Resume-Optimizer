# Field Matching Reference Guide

## Quick Reference - What Gets Matched Now

### 📧 Email Fields
```
Patterns: email, emailaddress, e-mail, mail, electronic mail, email address, your email, contact email, business email
Examples: "Email", "Email Address", "Your Email", "Business Email"
```

### 👤 Name Fields
```
FULL NAME patterns: name, full name, fullname, full-name, your name, applicant name, candidate name, person name, complete name, entire name
FIRST NAME patterns: first name, firstname, first-name, given name, first, given, forename, your first name
LAST NAME patterns: last name, lastname, last-name, family name, surname, last, family, your last name

Examples: "Name" ✓, "Your Name" ✓, "Applicant Name" ✓, "First Name" ✓, "Last Name" ✓
```

### ☎️ Phone Fields ⭐ ENHANCED
```
Patterns: phone, telephone, mobile, cell, contact, mobile number, phone number, 
          cell phone, whatsapp, mobile phone, contact number, phone no, tel, contact no, cellular

Examples:
  "Phone" ✓
  "Mobile" ✓
  "WhatsApp Number" ✓ NEW
  "Contact Number" ✓
  "Mobile Phone" ✓ NEW
  "Cell Phone" ✓ NEW
```

### 📍 Location Fields
```
ADDRESS patterns: address, street, street address, residential address, home address, full address, mailing address, location
CITY patterns: city, town, municipality, your city, city name
STATE patterns: state, province, region, state/province, state province, territory, county, administrative division, your state
ZIP patterns: zip, postal, postcode, zip code, postal code, pincode, pin, postal zip, zip-code
COUNTRY patterns: country, nation, country name, your country

Examples: "Address" ✓, "City" ✓, "State" ✓, "Zip Code" ✓, "Country" ✓
```

### 💼 Professional Fields
```
CURRENT COMPANY patterns: current company, current employer, employer, company, organization, current organization, 
                          workplace, current job company, company name, current employment
CURRENT TITLE patterns: current title, current position, job title, position, current job, job title, occupation, 
                        current role, current job title, designation

Examples: "Company" ✓, "Current Company" ✓, "Job Title" ✓, "Position" ✓
```

### 💰 Salary Fields ⭐ ENHANCED
```
Patterns: expected salary, desired salary, salary expectation, expected compensation, salary requirement, salary,
          annual salary, compensation, expected pay, salary expectancy,
          current salary, current compensation, salary cts, current cts

Examples:
  "Expected Salary" ✓
  "Salary Expectation" ✓
  "Current Salary" ✓ NEW
  "Current CTS" ✓ NEW
  "Salary CTS" ✓ NEW
  "Annual Salary" ✓ NEW
  "Compensation" ✓ NEW
```

### 💻 Portfolio & Links
```
GITHUB patterns: github, github profile, github url, github link, github username, github account
LINKEDIN patterns: linkedin, linkedin profile, linkedin url, linkedin link, linkedin username
PORTFOLIO patterns: portfolio, website, portfolio url, portfolio link, personal website, web url, 
                   portfolio website, your website

Examples: "GitHub" ✓, "LinkedIn" ✓, "Portfolio" ✓, "Website" ✓
```

### 📊 Experience & Skills
```
YEARS OF EXPERIENCE patterns: years of experience, experience, yoe, years exp, total experience, professional experience, 
                              work experience, experience years, exp, years in industry
SKILLS patterns: skills, technical skills, key skills, competencies, expertise, abilities, skillset

Examples: "Years of Experience" ✓, "Experience" ✓, "Skills" ✓, "Technical Skills" ✓
```

### ⏰ Availability & Authorization
```
NOTICE PERIOD patterns: notice period, notice, availability, notice required, when available, start date
WORK AUTHORIZATION patterns: work authorization, authorization, visa, visa status, work permit, eligible to work, 
                             authorization to work, legal to work
WORK ENVIRONMENT patterns: work environment, work type, office, remote, working environment, work location preference

Examples: "Notice Period" ✓, "Availability" ✓, "Work Authorization" ✓, "Work Environment" ✓
```

## Matching Confidence Levels

### 95%+ Confidence (High - Exact Matches)
```
✓ "Phone" contains "phone" → EXACT MATCH
✓ "WhatsApp" contains "whatsapp" → EXACT MATCH
✓ "Salary CTS" contains "salary" → EXACT MATCH
✓ "Your Name" contains "name" → EXACT MATCH
```

### 75-90% Confidence (Medium - Word-Based)
```
✓ "Mobile Phone" (words: mobile, phone) - "phone" matches
✓ "Contact Number" (words: contact, number) - "contact" matches
✓ "Annual Salary" (words: annual, salary) - "salary" matches
```

### 60-75% Confidence (Lower - Partial Matches)
```
✓ "Applicant Name" (words: applicant, name) - "name" matches
✓ "Personal Website" (words: personal, website) - "website" matches
```

### <60% Confidence (Rejected - Too Low)
```
✗ "Please Tell Us About Yourself" - No clear field match → SKIPPED
```

## Edge Cases Handled

### Typo Tolerance ✅
```
"phne" (typo) → Matches "phone" at 80% confidence
"salarry" (typo) → Matches "salary" at 80% confidence
```

### Spacing Variations ✅
```
"First Name" = "First-Name" = "FirstName" = "first name" → All match
"Zip Code" = "Zip-Code" = "ZipCode" = "zip_code" → All match
```

### Word Order ✅
```
"Mobile Phone" = "Phone Mobile" → Both match "phone"
"Address Street" = "Street Address" → Both match "address"
```

### Partial Matches ✅
```
"Preferred Work Environment" → Matches "work environment"
"Expected Annual Salary" → Matches "expected salary"
```

## When Fields Get Skipped

### ❌ No Match
- "Tell us something interesting about you" → Too vague, no pattern
- Random text field → No recognizable field label

### ❌ Hidden Fields
- `style="display: none"`
- `visibility: hidden`
- `opacity: 0`

### ❌ Wrong Element Types
- `type="hidden"`
- `type="button"`
- `type="submit"`

### ❌ No Label
- Form fields with no label, placeholder, or name attribute

## Testing Your Own Fields

### To Test Any Form:
1. Open DevTools (F12)
2. Go to "Elements" tab
3. Right-click on a form field
4. Inspect Element
5. Look for:
   - `<label>` text
   - `placeholder` attribute
   - `name` attribute
   - `aria-label` attribute

### If a field doesn't get filled:
1. Check console for skip reason
2. Verify field label contains recognizable pattern
3. Ensure field is visible (not hidden/opacity 0)
4. Make sure field is not type="hidden"

## Notes
- Patterns are case-insensitive
- Spaces, dashes, underscores, slashes are treated as word separators
- Minimum confidence threshold: 60%
- One field can only match to ONE profile field
- First match wins (highest confidence)

## Performance
- Matching happens ONCE per page load
- Negligible performance impact
- No external calls, all local computation
