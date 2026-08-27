<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f0c29,50:302b63,100:24243e&height=220&section=header&text=JobOrbit&fontSize=60&fontColor=ffffff&fontAlignY=38&desc=ATS%20Resume%20Optimizer%20%2B%20Auto-Apply%20Chrome%20Extension&descAlignY=58&descSize=18&animation=fadeIn" width="100%"/>

### 🚀 Stop applying manually. Start applying smart.

**JobOrbit** is a Chrome extension that optimizes your resume for ATS, auto-applies to jobs from LinkedIn, autofills any application form, and tracks every application you send — automatically.

<p>
  <img src="https://img.shields.io/badge/Manifest-V3-8A2BE2?style=for-the-badge&logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-Build-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-00C853?style=for-the-badge" />
</p>

<p>
  <img src="https://img.shields.io/badge/status-active--development-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/platforms%20supported-17%2B-blueviolet?style=flat-square" />
  <img src="https://img.shields.io/github/stars/yourusername/joborbit?style=flat-square&color=yellow" />
</p>

</div>

<br/>

## ✨ What JobOrbit Does

Job hunting is a numbers game — JobOrbit removes the manual grind so you can play it at scale.

| Feature | What it means for you |
|---|---|
| 🧠 **ATS Resume Optimizer** | Scores and rewrites your resume against a job description so it clears ATS filters before a human ever sees it |
| 🔗 **LinkedIn Auto-Apply** | Detects Easy Apply / job listings on LinkedIn and submits applications automatically on your behalf |
| ⚡ **Universal Autofill** | Semantic field-matching engine fills out application forms across 17+ job platforms — no more retyping your own resume |
| 📊 **Application Monitoring** | Tracks every job you've applied to, with a live running count and status per application |
| 📋 **Experience-Requirement Detection** | Surfaces the required years of experience on a listing at a glance, before you waste time applying |
| 🗂️ **Central Dashboard** | One place to see applied jobs, pending ones, and outcomes — no more spreadsheet tracking |

<br/>

## 🎬 Demo

<div align="center">
<img src="https://via.placeholder.com/900x500/0f0c29/ffffff?text=JobOrbit+Demo+GIF" width="85%" />
</div>

<br/>

## 🏗️ Architecture

```
joborbit/
├── extension/                 # Chrome Extension (Manifest V3)
│   ├── content-scripts/       # Field detection + autofill engine
│   ├── background/            # Service worker — apply orchestration, monitoring
│   ├── popup/                 # React + TS popup UI
│   └── manifest.json
├── resume-optimizer/          # ATS scoring & resume rewrite engine
├── dashboard/                 # Web dashboard (applications, counts, status)
├── shared/                    # Shared types & utils
└── docs/
```

**How autofill works:** a multi-signal field detector reads label text, `name`/`id` attributes, placeholder text, and DOM position to semantically map form fields to your profile data — even on platforms with obfuscated or auto-generated field names.

<br/>

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- Chrome / Chromium-based browser

### Install

```bash
git clone https://github.com/yourusername/joborbit.git
cd joborbit
npm install
npm run build
```

### Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/dist` folder
4. Pin JobOrbit to your toolbar

### Set up your profile

Open the extension → fill in your profile once (resume, experience, links, preferences) → JobOrbit uses this to autofill and auto-apply everywhere.

<br/>

## 🧩 Core Modules

<table>
<tr>
<td width="50%">

**Resume Optimizer**
- Parses resume + job description
- Keyword-gap analysis against ATS parsers
- Returns an ATS match score + rewrite suggestions

</td>
<td width="50%">

**Auto-Apply Engine**
- Scans LinkedIn job listings/feed
- Filters by your saved criteria
- Submits Easy Apply applications automatically

</td>
</tr>
<tr>
<td width="50%">

**Autofill Engine**
- Semantic field matcher (17+ platforms)
- Handles multi-step forms
- Falls back gracefully on unknown fields

</td>
<td width="50%">

**Application Monitor**
- Logs every application sent
- Live count + per-job status
- Surfaces required experience per listing

</td>
</tr>
</table>

<br/>

## 🛣️ Roadmap

- [ ] Cover letter auto-generation per job
- [ ] More platform integrations beyond LinkedIn
- [ ] Application analytics (response rate, time-to-response)
- [ ] Resume version A/B testing

<br/>

## 🤝 Contributing

Contributions are welcome — open an issue or PR.

```bash
git checkout -b feature/your-feature
git commit -m "feat: your feature"
git push origin feature/your-feature
```

<br/>

## 📄 License

MIT © [Your Name]

<br/>

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:24243e,50:302b63,100:0f0c29&height=100&section=footer" width="100%"/>

**Built to get you hired faster.**

</div>
