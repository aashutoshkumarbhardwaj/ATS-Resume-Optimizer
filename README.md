# 🚀 AI Job Application Assistant

<div align="center">

<img src="./assets/logo.png" width="140" alt="Logo"/>

### Apply Faster. Apply Smarter.

An AI-powered browser extension that extracts job descriptions, analyzes resumes, and automatically fills job applications across major hiring platforms.

<p>

<img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white"/>
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
<img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react"/>
<img src="https://img.shields.io/badge/TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss"/>
<img src="https://img.shields.io/badge/AI-Powered-7C3AED?style=for-the-badge"/>

</p>

---

### ✨ One Click → Complete Your Job Application

</div>

---

# 🎥 Preview

> Replace these with your own GIFs or screenshots.

| Dashboard               | Job Extraction        | Autofill               |
| ----------------------- | --------------------- | ---------------------- |
| ![](docs/dashboard.gif) | ![](docs/extract.gif) | ![](docs/autofill.gif) |

---

# 🌟 Features

## 🧠 AI Job Description Extraction

* Extracts only meaningful job information
* Removes HTML, CSS, JavaScript and page clutter
* Detects:

  * Job Title
  * Company
  * Location
  * Responsibilities
  * Requirements
  * Skills
  * Benefits
  * Salary
  * Experience
* Works across major hiring platforms

---

## 📄 Resume Parsing

* Resume PDF parsing
* Multi-page support
* ATS Resume support
* OCR fallback for scanned PDFs
* Structured information extraction

---

## ⚡ Universal Autofill

Automatically fills job applications on:

* Google Forms
* LinkedIn Easy Apply
* Greenhouse
* Lever
* Workday
* Ashby
* SmartRecruiters
* Taleo
* Oracle
* SAP SuccessFactors
* ICIMS
* BambooHR
* Generic HTML Forms

Supports

* Text fields
* Dropdowns
* Checkboxes
* Radio buttons
* Date Pickers
* Multi-step forms
* Resume uploads

---

## 👤 Smart Profile Manager

Store multiple profiles

* Software Engineer
* Intern
* Product Manager
* Data Scientist
* Custom Profiles

Save

* Personal Information
* Education
* Experience
* Skills
* Portfolio Links
* Resume
* Cover Letter
* Certificates

---

## 🎯 Intelligent Field Matching

Instead of relying only on field names, the extension understands

* Labels
* Placeholders
* Nearby text
* Semantic meaning
* React-controlled components

Example

Email Address

↓

Email

Current Employer

↓

Current Company

GitHub Profile

↓

GitHub URL

---

# 🏗 Architecture

```text
                Browser Extension

                     │

        ┌────────────┴────────────┐
        │                         │
 Popup UI                 Background Worker
        │                         │
        └────────────┬────────────┘
                     │
            Content Script
                     │
     ┌───────────────┼───────────────┐
     │               │               │
 Job Extraction   Autofill      Resume Parser
     │               │               │
     └───────────────┼───────────────┘
                     │
              AI Processing Layer
                     │
          Structured JSON Output
```

---

# ✨ Tech Stack

* React
* TypeScript
* Tailwind CSS
* Chrome Extension Manifest V3
* Vite
* PDF.js
* AI APIs
* Local Storage
* Chrome Storage API

---

# 📂 Project Structure

```text
src/
│
├── popup/
├── background/
├── content/
├── components/
├── services/
├── parser/
├── autofill/
├── ai/
├── storage/
├── hooks/
├── utils/
└── assets/
```

---

# 🚀 Getting Started

## Clone

```bash
git clone <repository-url>
```

## Install

```bash
npm install
```

## Start Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

---

# 🧩 Supported Platforms

| Platform            | Status |
| ------------------- | ------ |
| Google Forms        | ✅      |
| LinkedIn Easy Apply | ✅      |
| Greenhouse          | ✅      |
| Lever               | ✅      |
| Workday             | ✅      |
| Ashby               | ✅      |
| SmartRecruiters     | ✅      |
| Taleo               | ✅      |
| BambooHR            | ✅      |
| Generic Forms       | ✅      |

---

# 📈 Roadmap

* AI Resume Scoring
* Resume Tailoring
* AI Cover Letter Generator
* Interview Preparation
* Salary Insights
* Job Match Score
* One-Click Apply
* Cloud Profile Sync
* Analytics Dashboard
* Multi-language Support

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push your branch
5. Open a Pull Request

---

# ⭐ Why This Project?

Applying for jobs is repetitive.

This extension eliminates repetitive work by combining AI-powered job extraction, resume understanding, and intelligent autofill into a seamless workflow that saves time and improves application accuracy.

---

<div align="center">

### ⭐ Star this repository if you found it useful!

Made with ❤️ for developers, students, and job seekers.

</div>
