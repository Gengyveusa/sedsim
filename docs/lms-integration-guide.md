# SedSim LMS Integration Guide

This guide explains how to integrate SedSim with your institution's Learning Management System (LMS) using **xAPI (Tin Can)** statements and/or a **SCORM 1.2 / SCORM 2004** wrapper.

---

## Table of Contents

1. [Overview](#overview)
2. [xAPI Integration](#xapi-integration)
3. [SCORM Integration](#scorm-integration)
4. [LMS Configuration Panel](#lms-configuration-panel)
5. [LMS-Specific Setup](#lms-specific-setup)
   - [Canvas](#canvas)
   - [Moodle](#moodle)
   - [Blackboard](#blackboard)
6. [xAPI Statement Reference](#xapi-statement-reference)
7. [SCORM Data Model Reference](#scorm-data-model-reference)
8. [Troubleshooting](#troubleshooting)

---

## Overview

SedSim supports two complementary approaches to LMS integration:

| Approach | Use when |
|----------|----------|
| **xAPI (Tin Can)** | Your LMS has a Learning Record Store (LRS) endpoint. Recommended for rich event tracking. |
| **SCORM 1.2 / 2004** | Your LMS only supports SCORM packages. Scores & completion flow to the gradebook automatically. |

Both approaches can be used simultaneously.

---

## xAPI Integration

### How it works

SedSim sends xAPI statements to any conformant **Learning Record Store (LRS)** when key learner events occur:

| Event | xAPI Verb | When triggered |
|-------|-----------|---------------|
| Scenario starts | `attempted` | Learner clicks "Start Scenario" |
| Scenario finishes | `completed` | Engine auto-stops after all steps complete |
| Score reported | `scored` | Immediately after `completed` |
| Drug administered | `administered-drug` (custom) | Each bolus or infusion |
| Intervention applied | `applied-intervention` (custom) | Airway device, oxygen, BLS maneuvers |

### Configuration

1. Open SedSim in your browser.
2. Click the **LMS** tab in the right sidebar (collapsed by default).
3. Toggle **LMS Integration** to **Enabled**.
4. Enter your **LRS endpoint URL** (e.g. `https://lrs.example.com/xapi`).
5. Choose the **auth type** and provide credentials.
6. Click **Test connection** to verify connectivity.
7. Optionally set the **learner name and email** (used as the xAPI actor).

### Endpoint format

The LRS endpoint should point to the xAPI endpoint root (without `/statements`):

```
https://lrs.yourschool.edu/xapi
```

SedSim appends `/statements` automatically.

### Authentication

| Type | When to use |
|------|-------------|
| **None** | Open/public LRS or token passed in the URL |
| **Basic** | Username + password Basic Auth |
| **Bearer** | OAuth 2.0 bearer token |

---

## SCORM Integration

### Packaging SedSim as a SCORM object

SedSim auto-detects the SCORM API when embedded in an LMS. No manual packaging is required if you are self-hosting. If your LMS requires an importable SCORM package, follow these steps:

1. Build the application:
   ```bash
   npm run build
   ```
2. Copy the `dist/` directory contents into a folder named `sedsim/`.
3. Add an `imsmanifest.xml` to the root of that folder (see template below).
4. Zip the folder: `zip -r sedsim-scorm.zip sedsim/`.
5. Import the zip into your LMS.

#### `imsmanifest.xml` template (SCORM 2004)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="sedsim-manifest"
           version="1"
           xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
           xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
           xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
           xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
           xmlns:imsss="http://www.imsglobal.org/xsd/imsss">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="sedsim_org">
    <organization identifier="sedsim_org">
      <title>SedSim Sedation Simulator</title>
      <item identifier="item_sedsim" identifierref="sedsim_resource">
        <title>SedSim Sedation Simulator</title>
        <adlcp:completionThreshold>0.70</adlcp:completionThreshold>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="sedsim_resource"
              type="webcontent"
              adlcp:scormType="sco"
              href="index.html">
      <!-- list all dist/ files here -->
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
```

For **SCORM 1.2**, change the schema/schemaversion lines to:

```xml
<schema>ADL SCORM</schema>
<schemaversion>1.2</schemaversion>
```

and replace `adlcp:scormType="sco"` with `adlcp:scormType="sco"` (same value, different namespace).

### What SedSim reports via SCORM

| SCORM 1.2 element | SCORM 2004 element | Value |
|-------------------|--------------------|-------|
| `cmi.core.score.raw` | `cmi.score.raw` | Scenario score (0–100) |
| `cmi.core.score.min` | `cmi.score.min` | 0 |
| `cmi.core.score.max` | `cmi.score.max` | 100 |
| `cmi.core.lesson_status` | `cmi.completion_status` / `cmi.success_status` | passed / failed / incomplete |
| `cmi.core.session_time` | `cmi.session_time` | Elapsed scenario time |

---

## LMS Configuration Panel

The **LMS** side-panel inside SedSim provides:

- **Enable / Disable** toggle
- **SCORM status** — shows detected SCORM version (`1.2`, `2004`, or _Not detected_)
- **Endpoint URL** — your LRS endpoint
- **Auth type** — None / Basic / Bearer
- **Test connection** button with live status indicator
- **Learner identity** (name + email) — collapsed by default; pre-filled from SCORM if available
- **Session stats** — statements sent, statements queued for retry

---

## LMS-Specific Setup

### Canvas

1. In Canvas, go to **Admin → Settings → Apps → External Tools** (or per-course).
2. If using SCORM: **Import a new SCORM package** via **Canvas Studio** or the **SCORM module** (requires the SCORM LTI tool).
3. If using xAPI: Configure an LRS such as [SCORM Cloud](https://scorm.com) or [Learning Locker](https://learninglocker.net) and point SedSim's endpoint to it.
4. Set the **completion threshold** to 70% for the gradebook to mark as passing.

### Moodle

1. In Moodle, install the **SCORM activity plugin** (included by default in Moodle 3.x+).
2. Add a **SCORM activity** to your course.
3. Upload the `sedsim-scorm.zip` package.
4. Configure **Grade** → **Maximum grade: 100**.
5. Set **Grading method: Highest grade**.
6. For xAPI: install [Logstore xAPI](https://moodle.org/plugins/logstore_xapi) and configure the LRS endpoint there.

### Blackboard

1. In Blackboard, go to **Course Content → Build Content → SCORM Object**.
2. Upload `sedsim-scorm.zip`.
3. In the Grade Center, a column is automatically created; set the **possible points** to 100.
4. For xAPI: Blackboard Learn Ultra supports xAPI natively — configure the LRS under **System Admin → LTI Tool Providers**.

---

## xAPI Statement Reference

All statements use actor type `Agent` with an `mbox` IFI.

### Activity IDs

| Activity | IRI |
|----------|-----|
| Generic simulation | `https://sedsim.app/activities/simulation` |
| Scenario | `https://sedsim.app/activities/scenario/{scenarioId}` |
| Drug | `https://sedsim.app/activities/drug/{drugName}` |
| Intervention | `https://sedsim.app/activities/intervention/{intervention}` |

### Verb IRIs

| Verb | IRI |
|------|-----|
| attempted | `http://adlnet.gov/expapi/verbs/attempted` |
| completed | `http://adlnet.gov/expapi/verbs/completed` |
| scored | `http://adlnet.gov/expapi/verbs/scored` |
| administered-drug | `https://sedsim.app/verbs/administered-drug` |
| applied-intervention | `https://sedsim.app/verbs/applied-intervention` |

### Example: `scored` statement

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "actor": {
    "objectType": "Agent",
    "name": "Jane Smith",
    "mbox": "mailto:jane.smith@university.edu"
  },
  "verb": {
    "id": "http://adlnet.gov/expapi/verbs/scored",
    "display": { "en-US": "scored" }
  },
  "object": {
    "objectType": "Activity",
    "id": "https://sedsim.app/activities/scenario/colonoscopy-basic",
    "definition": {
      "type": "http://adlnet.gov/expapi/activities/simulation",
      "name": { "en-US": "SedSim Scenario: colonoscopy-basic" }
    }
  },
  "result": {
    "score": { "scaled": 0.85, "raw": 85, "min": 0, "max": 100 },
    "completion": true,
    "success": true,
    "duration": "PT12M30S"
  },
  "context": { "platform": "SedSim", "language": "en-US" },
  "timestamp": "2026-03-10T14:22:00.000Z"
}
```

---

## SCORM Data Model Reference

| SCORM 1.2 | SCORM 2004 | Notes |
|-----------|------------|-------|
| `cmi.core.student_name` | `cmi.learner_name` | Read by SedSim to pre-fill actor |
| `cmi.core.student_id` | `cmi.learner_id` | Read by SedSim to build `mbox` |
| `cmi.core.lesson_status` | `cmi.completion_status` + `cmi.success_status` | Written at scenario end |
| `cmi.core.score.raw` | `cmi.score.raw` | Written at scenario end |
| `cmi.core.score.scaled` | `cmi.score.scaled` | Written at scenario end |
| `cmi.core.session_time` | `cmi.session_time` | Written at scenario end |
| `cmi.suspend_data` | `cmi.suspend_data` | Available for future use |

---

## Troubleshooting

### "Could not reach LRS" on connection test

- Check the endpoint URL (must include the xAPI root, e.g. `/xapi` not `/xapi/statements`).
- Ensure CORS is configured on your LRS to allow requests from your SedSim origin.
- Verify credentials (username/password or bearer token).

### Score not appearing in gradebook

- For SCORM: confirm the SCO is using `adlcp:scormType="sco"` (not `asset`).
- For SCORM 1.2: the LMS requires `cmi.core.lesson_status` to be `passed` or `completed`.
- For SCORM 2004: both `cmi.completion_status = completed` and `cmi.success_status = passed` must be set.
- Run SedSim to the end of a scenario (do not close before the debrief).

### SCORM API not detected

- The SedSim page must be loaded inside the LMS iframe, not in a standalone browser window.
- Some LMS platforms require the SCORM package to be imported before the API is injected.
- Check the browser console for errors during initialisation.

### Statements queued but not sent

- SedSim automatically retries on the next event. Pending statements are stored in browser memory and will be sent when connectivity is restored.
- Note: pending statements are lost if the page is closed. For guaranteed delivery, use a SCORM package in addition to xAPI.

---

*Last updated: 2026-03-10*
