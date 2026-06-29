<div align="center">

<br/>

<!-- ANIMATED BANNER -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1f6feb,50:a371f7,100:1f6feb&height=180&section=header&text=AI%20Job%20Application%20Assistant&fontSize=36&fontColor=ffffff&fontAlignY=35&desc=Eliminate%20repetitive%20job%20application%20tasks%20in%20seconds&descSize=16&descAlignY=58&animation=fadeIn" width="100%"/>

<br/>

<!-- BADGES -->
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

<br/>

[![Platforms](https://img.shields.io/badge/Supports-17+%20Platforms-a371f7?style=flat-square)](https://github.com)
[![AI Powered](https://img.shields.io/badge/AI-Semantic%20Field%20Matching-f97316?style=flat-square)](https://github.com)
[![Privacy](https://img.shields.io/badge/Data-Stored%20Locally-3fb950?style=flat-square)](https://github.com)
[![Fill Time](https://img.shields.io/badge/Fill%20Time-Under%203%20seconds-58a6ff?style=flat-square)](https://github.com)

<br/>

**[🚀 Install Extension](#installation) · [📖 Documentation](#usage) · [🤝 Contributing](#contributing) · [🐛 Report Bug](../../issues)**

<br/>

</div>

---

```
❯ extension apply --url "careers.google.com/jobs/123"

  → Extracting job description...              ✓ done
  → Loading profile: your_profile.json
  → Detected 24 form fields across 3 steps
  → Semantic matching:                         24/24 fields mapped
  → Uploading resume...                        ✓ uploaded

  ✓ Application filled in 3.2s — ready for review
```

---

## 🤔 The Problem

Job seekers spend **hours every week** performing tasks that require zero decision-making:

| Pain Point | Reality |
|---|---|
| 🔁 Re-entering personal details | Done on every single application |
| 📤 Uploading resumes repeatedly | Every platform requires it again |
| 🧩 Different form structures | Greenhouse ≠ Workday ≠ Lever |
| 📜 Reading long job descriptions | Buried in HTML clutter |
| ⏱️ Multi-step forms | Constant manual input per step |

> _"Even experienced candidates spend hours every week on tasks that add no value."_

---

## ✨ The Solution

**AI Job Application Assistant** is a browser extension that automates the full application workflow — from reading a job post to filling every field and uploading your resume.

<div align="center">

```
Open Job Post  →  AI Extracts Details  →  Select Profile
     ↓                                          ↓
Submit Application  ←  Review  ←  AI Fills Every Field
```

</div>

---

## 🚀 Core Features

### 🧹 Intelligent Job Description Extraction
Strips HTML, CSS, ads, cookie banners, nav menus — returns a clean structured object with title, company, salary, responsibilities, required skills, and deadline.

### 📄 Resume Parser
Supports PDF (multi-page), ATS-generated, text-based, and scanned resumes via OCR fallback. Returns structured data: contact info, education, work history, skills, projects, links.

### 🤖 Universal Autofill Engine
Fills every field type — text, email, phone, dropdowns, multi-select, radio buttons, checkboxes, date pickers, and file uploads — across 17+ platforms.

### 👤 Smart Profile Manager
Create reusable professional profiles with unlimited custom fields. Store documents, switch profiles per application, never type your details again.

### 🧠 Semantic Field Matching
No brittle CSS selectors. The engine understands that:
```
"Email Address" = "Primary Email" = "Your Email" = "Personal Email"
"Current Employer" = "Company" = "Organization" = "Present Company"
```

### 🔄 Dynamic Form Support
Watches for DOM mutations, lazy-loaded fields, React/Vue/Angular event systems, and multi-step flows — autofill continues even after page updates.

---

## 🎯 Supported Platforms

<div align="center">

| ATS Platforms | Job Boards | Generic |
|---|---|---|
| Greenhouse | LinkedIn Easy Apply | Google Forms |
| Lever | Indeed | Generic HTML Forms |
| Workday | Naukri | React Apps |
| Ashby | Foundit | Vue Apps |
| SmartRecruiters | Wellfound | Angular Apps |
| Taleo | | Next.js |
| BambooHR | | Svelte |
| Oracle Careers | | |
| SAP SuccessFactors | | |
| ICIMS | | |

</div>

---

## ⚡ How It Works

```
1. 🌐  Open a job posting on any supported platform
2. 🔍  Extension extracts the full structured job description via AI
3. 👤  Select a saved professional profile
4. 📦  Required documents are automatically loaded
5. 🎯  Semantic engine detects and maps every form field
6. ✍️   Forms are completed — text, dropdowns, files, everything
7. 👀  You review the completed application
8. 🚀  Submit with confidence
```

**Total time: under 5 seconds.**

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology |
|---|---|
| **Frontend** | React 18 · TypeScript · Tailwind CSS · Vite |
| **Extension APIs** | Chrome MV3 · Storage · Scripting · Tabs · Runtime |
| **Document Processing** | PDF.js · OCR Integration |
| **AI Layer** | LLMs · Semantic Field Matching · Structured Extraction |
| **Storage** | Chrome Storage API · IndexedDB · Local Storage |
| **DOM Utilities** | MutationObserver · Event Dispatching · DOM Parsing |

</div>

---

## 📦 Installation

### Development Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/ai-job-assistant.git
cd ai-job-assistant

# Install dependencies
npm install

# Start development build
npm run dev

# Build for production
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

---

## 🎮 Usage

1. **Navigate** to any job posting
2. **Click** the extension icon
3. **Select** or create a professional profile
4. **Click** `Fill Application`
5. **Review** the completed form
6. **Submit** 🎉

---

## 🗂️ Project Structure

```
ai-job-assistant/
├── src/
│   ├── background/          # Service worker (Chrome MV3)
│   ├── content/             # Content scripts
│   │   ├── autofill/        # Universal autofill engine
│   │   ├── extraction/      # Job description extractor
│   │   └── matcher/         # Semantic field matching
│   ├── popup/               # React popup UI
│   ├── parser/              # Resume parser (PDF.js + OCR)
│   ├── profile/             # Profile manager
│   └── storage/             # Storage layer (IndexedDB)
├── public/
│   └── manifest.json        # Chrome Extension Manifest V3
├── vite.config.ts
└── tsconfig.json
```

---

## 🔒 Privacy

Data stays on your device. Always.

- ✅ All profile data stored locally via Chrome Storage API
- ✅ Resume files remain under your control
- ✅ No telemetry, no tracking, no external transmission
- ✅ AI processing is opt-in and configurable
- ✅ Open source — audit every line

---

## 🗺️ Roadmap

- [ ] AI-powered resume tailoring per job
- [ ] Cover letter generation
- [ ] ATS compatibility scoring
- [ ] Application tracking dashboard
- [ ] Cloud sync across devices
- [ ] Salary insights and job matching
- [ ] Interview preparation mode
- [ ] Career analytics

---

## 🤝 Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

Please follow the [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1f6feb,50:a371f7,100:1f6feb&height=100&section=footer" width="100%"/>

**Made with 🤖 + ❤️ to give job seekers their time back.**

⭐ Star this repo if it saved you time · [Report a Bug](../../issues) · [Request a Feature](../../issues)

</div>
