# CYBERSURE

**Intelligent network security configuration & compliance platform — interactive prototype.**

CYBERSURE analyses network configuration, tracks security findings and compliance, and converts
configurations between vendor platforms. The **Configuration Converter** runs on a real FastAPI
backend; everything else runs in the browser.

> This is a prototype. No device is ever contacted, no configuration is ever written to hardware, and
> every device, finding, configuration and report in the console is fictional sample data. The
> AI Assistant is a local, context-aware rule engine — no external model is called.

---
## 🚀 Live Prototype & System Demonstration

Experience the complete user journey and core functionalities of Cybersure through our live interactive deployment, comprehensive video walkthrough, and detailed technical documentation. 

### 🔗 Quick Access Links
[![Live Deployment](https://img.shields.io/badge/🌐_Launch_Cybersure_App-0052CC?style=for-the-badge)](https://cybersure-1-lwcb.onrender.com/)
[![Watch Video](https://img.shields.io/badge/▶️_Watch_Demo_Video-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](YOUR_VIDEO_LINK_HERE)
[![Architecture](https://img.shields.io/badge/📐_View_Architecture_Doc-238636?style=for-the-badge)](./Architecture%20Document.pdf)

---

### 💻 Live Interactive Prototype
Our application is currently deployed and available for live testing. This environment reflects the latest stable build, allowing you to explore the navigation, interface design, and primary features exactly as an end-user would experience them.

> **💡 Testing Guide:** We recommend accessing the platform via a modern desktop web browser for the optimal experience. Feel free to interact with the interface, navigate through the available modules, and test the responsiveness of the UI components across different screen sizes.

👉 **[Access the Cybersure Live Prototype](https://cybersure-1-lwcb.onrender.com/)**

---

### 🎥 Video Walkthrough
For a guided tour of the application's capabilities, we have prepared a detailed video demonstration. This walkthrough covers the user onboarding process, key feature workflows, and highlights the technical solutions driving the user interface. It serves as an excellent primer before diving into the live prototype.

[![Watch the Demo](https://img.youtube.com/vi/YOUR_YOUTUBE_VIDEO_ID/maxresdefault.jpg)](YOUR_VIDEO_LINK_HERE)
*(Click the thumbnail above to view the full demonstration video)*

---

### 📐 System Architecture Document
To understand the underlying infrastructure, data flow, and technology stack powering this prototype, please review our core technical documentation directly within this repository. 

This concise overview (Max 2 Pages) details the structural foundation of the project, including:
* **High-Level System Design:** Component interaction and module separation.
* **Technology Stack:** Rationale behind frontend, backend, and database choices.
* **Data Flow & Integrations:** How information moves securely through the system.
* **Deployment Strategy:** The pipeline used to serve the application to Render.

👉 **[Read the Architecture Document](./Architecture%20Document.pdf)** 
*(Ensure your file is named exactly `Architecture Document.pdf` in the root folder, or change `.pdf` to `.md` in the link above if it is a Markdown file)*
---


## Prototype boundaries

Deliberately out of scope: billing, payments, social features, threat-intel feeds, a SOC console,
live attack simulation, ticketing, CRM, user management, and any claim of real device
connectivity. The AI Assistant is local and rule-based; it does not call Gemini or any other
provider.

# 🔮 Future Scope

Potential future development includes:

- Additional network/security vendors
- Expanded security control coverage
- Continuous configuration monitoring
- Scheduled compliance assessments
- Role-based access control
- Enterprise authentication
- Centralized audit logs
- Cloud deployment
- SIEM/SOC integrations
- More advanced risk prioritization
- Expanded AI-assisted remediation
- Automated configuration remediation with explicit authorization

---
# ⚠️ Prototype Scope & Limitations

CyberSure is an **SIH prototype** and should be evaluated according to the functionality implemented in the submitted version.

Important limitations may include:

- Scanner coverage is limited to the checks implemented in the prototype.
- Vendor support depends on the implemented vendor modules.
- AI-generated explanations should be reviewed by a qualified security professional before operational use.
- Compliance mapping in the prototype does not constitute legal certification or formal third-party certification.
- Non-intrusive scanning should be used only on systems for which the user has authorization.
- Production deployment would require additional authentication, authorization, secure secret management, logging, monitoring, testing, and infrastructure hardening.

---
# 👥 Team

**Project:** CyberSure  
**Problem Statement:** 26155  
**Organization:** National Technical Research Organisation (NTRO)  
**Theme:** Blockchain & Cybersecurity  
**Category:** Software



## Quick start

Two processes: the conversion API, then the frontend. Run them in two terminals.

**Windows — one command:** double-click `start.cmd` (or run `cmd /c start.cmd`). It verifies Node
and Python, installs what is missing (`npm install` automatically; `pip install` only if you
approve), copies `.env` from `.env.example` when absent, then starts the backend in its own window
and Vite in the current one. `start.cmd --check` runs every check without starting anything, and
failures stay on screen instead of closing the window.

From the project root:

```bash
npm run dev:api
```

That launcher picks a working Python interpreter, sets `PYTHONPATH`, and starts uvicorn:

```
CYBERSURE conversion API -> http://localhost:8000
  cwd      <repo>/backend
  reload   off - restart after backend edits
  health   http://localhost:8000/api/v1/health
```

**Auto-reload is opt-in: `npm run dev:api:reload`.** It is off by default on purpose.
`--reload` depends on filesystem-watch events, and those are not delivered reliably everywhere — in
some sandboxed and containerised environments, edits inside `app/` are silently missed, so the server
keeps running code that no longer matches the disk. The default plain start always reflects what is
on disk; restart after a backend edit.

When you do use `--reload`, scope it: `uvicorn app.main:app --reload --port 8000 --reload-dir app`.
Without `--reload-dir`, the reloader watches the whole working directory, which includes `backend.log`
if you redirect output there — so every access-log line counts as a file change and the server
restarts on every request, eventually dying. Keep any log file outside the watched tree.

The API is then at <http://localhost:8000> (interactive docs at `/docs`). Verify it before touching
the frontend:

```bash
curl http://localhost:8000/api/v1/health
# {"status":"ok","service":"CYBERSURE Conversion API",...}
```

`GET /api/v1/health` is the canonical health endpoint. An unversioned `GET /health` alias exists for
load balancers and container probes, so they do not fill the access log with 404s.

To run it by hand instead:

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

On Windows, if `python` is not on PATH:

```powershell
cd backend
py -3.11 -m pip install -r requirements.txt
$env:PYTHONPATH='.'
py -3.11 -m uvicorn app.main:app --port 8000
```

### 2. Frontend (React + Vite)

```bash
npm install
npm run dev
```

The console is then at <http://localhost:5173>.

`strictPort` is on, so if 5173 is taken Vite **fails loudly** instead of quietly moving to 5174.
That matters: a dev server on an unexpected port used to be rejected by the backend's CORS policy,
and the browser reported it as a dead service.

### 3. Configuration

Copy `.env.example` to `.env` and adjust if needed. The defaults work for local development.

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | frontend | `http://localhost:8000` | Base URL of the conversion API |
| `VITE_API_TIMEOUT_MS` | frontend | `30000` | Client request timeout |
| `CYBERSURE_CORS_ORIGINS` | backend | Vite dev origins | Comma-separated exact origins |
| `CYBERSURE_CORS_ORIGIN_REGEX` | backend | loopback any port | Extra origin pattern (see below) |
| `CYBERSURE_MAX_UPLOAD_BYTES` | backend | `4194304` | Max upload size |
| `CYBERSURE_ALLOWED_UPLOAD_EXTENSIONS` | backend | `.cfg,.conf,.txt,.rsc,…` | Accepted upload extensions |
| `CYBERSURE_MAX_REPORTS` | backend | `100` | In-memory report retention |

`VITE_*` variables are inlined into the public bundle at build time. **Never put a secret in one.**
Backend secrets belong in ordinary (non-`VITE_`) environment variables, read only by the backend.

### CORS

The backend trusts two things, and never a wildcard:

1. An exact list — `CYBERSURE_CORS_ORIGINS`, defaulting to the Vite dev and preview origins.
2. A pattern — `CYBERSURE_CORS_ORIGIN_REGEX`, defaulting to
   `^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$`.

Rule 2 is why a shifted dev port is not a problem. A loopback origin can only ever be your own
machine, so matching one by pattern is not the same exposure as `*`. Lookalike hosts
(`http://localhost.evil.example`, `http://notlocalhost:5173`) and remote origins are still refused —
the pattern is anchored. To lock it down, set an explicit pattern:

```
CYBERSURE_CORS_ORIGIN_REGEX=^https?://localhost:5173$
```

---

## How the converter works

Every conversion — **any** supported source platform to **any** supported target platform — runs
through one pipeline:

```
source configuration text
        ↓
   source parser            (per-platform syntax)
        ↓
normalized network model    (platform-independent IR)
        ↓
   target renderer          (per-platform syntax)
        ↓
      validation
        ↓
    JSON report
```

The normalized model is what makes `NX-OS → Junos`, `NX-OS → FortiOS` and `RouterOS → PAN-OS` all
work: they travel exactly the same path. There is no allow-list of platform pairs, so there is no
"No mapping" case.

### No fabricated conversion

Where a construct cannot be translated faithfully, the engine says so instead of inventing output:

- **`unsupported`** — the target platform has no equivalent construct. The original source command
  is included in the report.
- **`requires_review`** — a translation exists but cannot be proven equivalent.

A Cisco ACL targeting Junos is reported as unsupported. No invented `firewall family inet` filter
block is emitted. Conversion status is derived from what actually happened:

| Status | Meaning |
| --- | --- |
| `CONVERSION SUCCESSFUL` | Everything recognised was translated and the output validated |
| `PARTIAL CONVERSION` | Some constructs could not be translated; each is listed |
| `REQUIRES REVIEW` | Translated, but some translations need a human decision |
| `UNSUPPORTED CONFIGURATION` | Nothing in the input could be expressed in the target syntax |
| `CONVERSION ERROR` | The generated configuration failed structural validation |

---

## Supported platforms

Served live by `GET /api/v1/devices`; the converter's From/To dropdowns are built from that response.

| Platform | CLI family |
| --- | --- |
| Cisco IOS | Cisco-style blocks |
| Cisco IOS XE | Cisco-style blocks |
| Cisco NX-OS | Cisco-style blocks + `feature` / VLAN names |
| Cisco ASA | Cisco-style blocks + security levels, `nat (real,global)` |
| Juniper Junos | `set` commands and brace blocks |
| Fortinet FortiOS | `config` / `edit` / `set` / `next` / `end` |
| Palo Alto PAN-OS | `set` / `edit` device and interface config |
| MikroTik RouterOS | path-style export |
| Arista EOS | Cisco-style blocks + inline VLAN names |
| Huawei VRP | `sysname` / `interface` / `ip route-static` |
| Aruba AOS-CX | Cisco-style blocks, `1/1/1` interfaces |
| VyOS | flat `set` syntax |

Adding a platform is a two-step change: write the converter module, then register it in
`backend/app/converters/__init__.py`. Nothing else needs to change — the API, the dropdowns and the
docs all follow the registry.

---

## API

Base path `/api/v1`. Interactive documentation at <http://localhost:8000/docs>.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness + engine/platform summary |
| `GET` | `/health/ready` | Readiness: every registered platform is constructible |
| `GET` | `/devices` | Platform catalogue with capabilities |
| `GET` | `/devices/{id}` | One platform |
| `POST` | `/conversions` | Convert configuration text |
| `POST` | `/conversions/upload` | Convert an uploaded configuration file |
| `POST` | `/detect` | Guess the source platform, with confidence and reasons |
| `POST` | `/validate` | Validate a configuration in its own syntax |
| `GET` | `/conversions/{id}` | The report generated for a conversion |
| `GET` | `/reports` | Stored reports (in-memory, per process) |
| `GET` | `/reports/{id}` | One report |
| `GET` | `/reports/{id}/download` | Download as `configuration-report.json` |
| `POST` | `/reports/configuration` | Convert and return the report in one call |

### Example request

```bash
curl -X POST http://localhost:8000/api/v1/conversions \
  -H "Content-Type: application/json" \
  -d '{
    "source_platform": "cisco-nxos",
    "target_platform": "juniper-junos",
    "configuration": "hostname Core-Switch-01\ninterface Ethernet1/1\n  no switchport\n  ip address 10.40.0.2 255.255.255.0\n"
  }'
```

Returns the target configuration, a status, warnings, unsupported commands, requires-review items,
validation stages and a line-by-line mapping:

```json
{
  "id": "CONV-1A2B3C4D",
  "source_platform": "cisco-nxos",
  "target_platform": "juniper-junos",
  "status": "success",
  "converted_configuration": "set system host-name Core-Switch-01\nset interfaces ge-1/0/1 unit 0 family inet address 10.40.0.2/24\ncommit\n",
  "commands_processed": 4,
  "commands_converted": 2,
  "requires_review": 1,
  "unsupported": 0,
  "warnings": [{ "status": "requires_review", "concept": "Vendor-specific behaviour", "detail": "…" }],
  "validation": [{ "id": "syntax", "label": "Syntax Check", "status": "pass", "detail": "…" }],
  "mapping": [{ "line": 1, "source": "hostname Core-Switch-01", "status": "converted", "…" : "…" }]
}
```

### Report

Reports are **JSON only**. The converter's report contains the source and target platforms, the
status, the converted configuration, the summary counters, the warnings, the unsupported commands,
the requires-review items and the validation stages — every field derived from the actual run.

---

## Security

- **No secret ever reaches the browser.** The frontend holds no API key and calls no model provider.
  If a hosted model is added later, the browser calls the backend and the backend calls the provider.
- **Uploaded configuration is untrusted text.** It is size-limited, extension-checked, decoded with a
  replacement fallback, and never evaluated. There is no `eval`, no shell, no templating.
- **CORS is an explicit origin list**, not a wildcard. A wildcard is never enabled implicitly.
- **No stack trace reaches the client.** Unhandled errors are logged server-side and returned as a
  clean message.
- Nothing is written to disk. Reports live in memory for the life of the process.

---

## Verification

```bash
npm run verify
```

runs, in order:

| Script | What it covers |
| --- | --- |
| `typecheck` | `tsc --noEmit` |
| `verify:engine` | Analysis engine invariants |
| `verify:ui` | Every route renders (jsdom) |
| `verify:workflow` | Full user workflow, incl. the converter against a stubbed API |
| `verify:smoke` | Report generation and export contracts |
| `verify:nodata` | No fabricated demo data; frontend catalogue matches the backend registry |
| `verify:desktop` | Route rendering, console noise, wording guards |
| `verify:api` | **Live** HTTP checks against a running backend (skips if it is down) |
| `verify:success` | The brief's critical success condition, live, plus the honesty rules |

Backend tests:

```bash
cd backend && python -m pytest -q
```

77 tests covering health, the device catalogue, detection, all 12 platforms parsing their own
syntax, the full 12×12 pair cross-product, every error path, upload limits, hostile input, and the
report contract.

To require a live backend for `verify:api`, use `npm run verify:api:required`.

---

## Project layout

```
backend/
  requirements.txt
  app/
    main.py                 FastAPI app, CORS, error handling
    core/config.py          Environment-driven settings
    models/
      network.py            The normalized network model (the IR)
      device.py             Platform registry
      conversion.py         Request/response schemas
      report.py             JSON report projection
    services/
      converter.py          Orchestration: parse → normalize → render → validate
      validator.py          Structural validation of generated output
      detector.py           Platform detection with confidence
      reports.py            In-memory report store
    converters/
      base.py               Converter contract + issue recording
      cisco_like.py         Shared Cisco-style parser and renderer
      cisco_ios.py  cisco_ios_xe.py  cisco_nxos.py  cisco_asa.py
      arista_eos.py  aruba_aoscx.py
      juniper_junos.py  fortinet_fortios.py  paloalto_panos.py
      mikrotik_routeros.py  huawei_vrp.py  vyos.py
      __init__.py           Registry — add new platforms here
    api/routes/             health · devices · conversion · reports
    utils/addressing.py     Mask ↔ prefix, interface-name translation
  tests/                    pytest suite

src/
  lib/
    api.ts                  The only module that talks to the backend
    conversionAdapter.ts    Wire format → ConversionResult
  hooks/useBackendStatus.ts Availability + platform catalogue
  pages/ConverterPage.tsx   The converter workflow
  data/platforms.ts         Display metadata + offline fallback
  components/converter/     Editor and result panels
scripts/
  api-check.mjs             Live HTTP checks
  apiStub.ts                In-process API for the jsdom harnesses
  workflow-check.tsx  render-check.tsx  smoke-check.tsx  probe.tsx
```

---

## Routes

`/` landing · `/assessment` dashboard · `/devices` · `/configuration` · `/converter` ·
`/issues` · `/compliance` · `/reports` · `/assistant` · `/changes` · `/settings`

---
