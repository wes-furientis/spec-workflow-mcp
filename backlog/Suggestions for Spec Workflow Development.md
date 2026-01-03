# Suggestions for Spec Workflow Development

**Document Purpose:** Lessons learned from the Optical Seeker Trade Study Tool project to improve future AI-assisted development workflows.

**Date:** 2025-12-31

---

## Executive Summary

During the development of this project, approximately 58% of requirements were missed or incorrectly implemented despite having comprehensive specification documents. This document captures the root causes and provides actionable suggestions for preventing similar issues in future projects.

---

## What Went Wrong

### 1. Task Order Was Not Followed
The tasks.md file had a logical sequence with frontend architecture tasks (1.11-1.21) interleaved in Phase 1. Instead:
- All backend tasks were completed first (Phases 1-3)
- Frontend was built as a single batch at the end
- Critical architecture tasks (tab navigation, page components) were skipped entirely

**Impact:** Built a single-page dashboard instead of the specified 5-tab SPA.

### 2. Assumptions Replaced Specification Reading
When building the frontend, assumptions were made about what an "optical seeker trade tool" should look like, rather than reading structure.md which explicitly defined:
- 5 page components (SummaryPage, ConfigPage, etc.)
- Folder organization (components/config/, components/layout/, etc.)
- Component hierarchy

**Impact:** Wrong architecture, wrong folder structure, missing components.

### 3. No Progress Tracking Against Tasks
The spec-workflow system provides:
- `log-implementation` tool to record completed work
- Task status markers in tasks.md
- Approval workflow for phase completion

None of these were used during development.

**Impact:** Lost track of what was actually complete vs. assumed complete.

### 4. Core Features Deprioritized
The project's differentiating features (self-populating parameters, context-sensitive detector) were in requirements.md but never implemented. Focus went to "making calculations work" rather than "making the right user experience."

**Impact:** 42% requirement compliance despite "working" software.

---

## Suggestions for Future Projects

### 1. Enforce Phase Gates with Explicit Checkpoints

Add checkpoint sections after each phase in tasks.md:

```markdown
## PHASE 1 CHECKPOINT
Before proceeding to Phase 2, verify ALL of the following:
- [ ] All Phase 1 tasks marked [x] in this file
- [ ] Tab navigation component renders 5 tabs
- [ ] Each page component exists at specified path
- [ ] Routes work: /summary, /config, /results, /comparison, /profiles
- [ ] Screenshot taken and saved to docs/checkpoints/phase1.png

**DO NOT PROCEED UNTIL CHECKPOINT COMPLETE**
```

**Why it helps:** Creates explicit stopping points where architecture must be verified before features are added on top.

### 2. Add Verification Tasks After Architectural Tasks

For every architectural task, add a paired verification task:

```markdown
- [ ] 1.11: Create TabNavigation component
- [ ] 1.11-V: VERIFY: Take screenshot showing 5 tabs, confirm click changes URL

- [ ] 1.12: Create ConfigPage with 5 panels
- [ ] 1.12-V: VERIFY: Screenshot showing all 5 config panels rendered
```

**Why it helps:** Prevents marking tasks "done" when they're only partially complete or incorrectly implemented.

### 3. Include Visual Specifications

Requirements like "tabbed interface" are ambiguous. Add ASCII wireframes or reference images:

```markdown
REQ-13: Tabbed Interface

Required layout:
┌──────────────────────────────────────────────────────────────┐
│  Optical Seeker Trade Tool                    [Save] [Load]  │
├─────────┬────────┬─────────┬────────────┬──────────┬─────────┤
│ Summary │ Config │ Results │ Comparison │ Profiles │         │
├─────────┴────────┴─────────┴────────────┴──────────┴─────────┤
│                                                              │
│                    [Page Content Area]                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘

- Tab bar is persistent across all pages
- Active tab is visually highlighted
- URL reflects current tab (/summary, /config, etc.)
```

**Why it helps:** Removes ambiguity about what "tabbed interface" means.

### 4. Mark Blocking vs. Optional Requirements

Not all requirements are equal. Use severity markers:

```markdown
REQ-13: [ARCHITECTURE-BLOCKING] Tabbed interface with 5 tabs
  - This requirement MUST be implemented before any other frontend work
  - All other frontend requirements depend on this structure

REQ-7: [CORE-FEATURE] Johnson criteria DRI calculation
  - Primary calculation feature, must be implemented

REQ-14: [ENHANCEMENT] Export to PDF/Excel
  - Can be implemented after core features complete
```

**Why it helps:** Clarifies priority and dependency order.

### 5. Require Progress Reporting at Defined Intervals

Add to CLAUDE.md or project instructions:

```markdown
## Progress Reporting Requirements

After completing ANY numbered task:
1. Mark task complete in tasks.md: `- [x] Task description`
2. Run `log-implementation` MCP tool with artifacts
3. Report to user: "Completed: [Task ID] - [Brief description]. Next: [Next task ID]"

After completing a PHASE:
1. Complete the phase checkpoint
2. Take verification screenshots
3. Request user approval before proceeding to next phase
```

**Why it helps:** Forces incremental progress tracking rather than batch completion claims.

### 6. Separate Architecture Phase from Feature Phases

Structure tasks.md with architecture as a distinct, blocking phase:

```markdown
## Phase 0: Architecture Foundation (BLOCKING)
All tasks in this phase must be complete before any other phase begins.

### 0.1 Project Structure
- [ ] Create all required directories per structure.md
- [ ] Create placeholder files for all major components
- [ ] Verify folder structure matches specification

### 0.2 Navigation & Routing
- [ ] Implement tab navigation component
- [ ] Set up all routes
- [ ] Verify navigation works

### 0.3 Page Shells
- [ ] Create all page components (empty but rendering)
- [ ] Verify each page accessible via route

## Phase 0 CHECKPOINT
[Explicit verification steps]

---
## Phase 1: Core Calculations
(Only start after Phase 0 checkpoint complete)
```

**Why it helps:** Ensures foundation is solid before building on it.

### 7. Include Anti-Patterns in Steering Documents

Add a "What NOT to do" section to conventions.md or architecture.md:

```markdown
## Anti-Patterns to Avoid

### Don't Build a Dashboard When Tabs Are Specified
If requirements say "tabbed interface with N tabs," you must implement:
- React Router (or equivalent) with N routes
- Tab navigation component
- N separate page components
You must NOT implement:
- Single-page layout with all content visible
- Accordion or collapsible sections instead of tabs

### Don't Skip Frontend Architecture for "Quick Progress"
Backend tests passing does not mean the project is on track.
Frontend architecture (navigation, routing, page structure) must be
implemented BEFORE feature components.
```

**Why it helps:** Explicitly calls out the exact mistake that was made.

### 8. Add Structure Verification Scripts

Create automated checks for structural requirements:

```bash
#!/bin/bash
# scripts/verify-structure.sh

echo "Verifying project structure against structure.md..."

required_files=(
  "frontend/src/pages/SummaryPage.tsx"
  "frontend/src/pages/ConfigPage.tsx"
  "frontend/src/pages/ResultsPage.tsx"
  "frontend/src/pages/ComparisonPage.tsx"
  "frontend/src/pages/ProfilesPage.tsx"
  "frontend/src/components/layout/TabNavigation.tsx"
  "frontend/src/components/layout/Header.tsx"
)

missing=0
for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "MISSING: $file"
    missing=$((missing + 1))
  fi
done

if [ $missing -gt 0 ]; then
  echo "ERROR: $missing required files missing!"
  exit 1
fi

echo "All required files present."
```

**Why it helps:** Automated verification catches structural issues immediately.

### 9. Define "Done" Criteria for Each Requirement

Each requirement should have explicit acceptance criteria:

```markdown
REQ-1: Self-populating parameter system

**Acceptance Criteria:**
1. [ ] F-number automatically calculates from focal_length / aperture
2. [ ] IFOV automatically calculates from pixel_pitch / focal_length
3. [ ] Derived values show visual indicator (different border/icon)
4. [ ] Hovering derived value shows formula and source values
5. [ ] User can "lock" a derived value to override it
6. [ ] Changing a source value updates all dependent derived values

**Not Accepted If:**
- User must manually enter values that could be calculated
- No visual distinction between user-entered and calculated values
- Calculation happens only on button click (must be real-time)
```

**Why it helps:** Makes it impossible to claim a requirement is "done" when it's only partially implemented.

### 10. Include a Minimum Viable Demo Checklist

Add to requirements.md:

```markdown
## Minimum Viable Demo

The following must be demonstrable before claiming "frontend complete":

1. [ ] User opens app, sees Summary tab active with key metrics
2. [ ] User clicks Config tab, sees 5 configuration panels
3. [ ] User changes a parameter, sees related parameters auto-update
4. [ ] User clicks Results tab, sees calculations and charts
5. [ ] User clicks Comparison tab, sees multi-camera comparison
6. [ ] User clicks Profiles tab, can save/load configurations
7. [ ] User exports results to PDF

If any of these fail, frontend is NOT complete.
```

**Why it helps:** Defines the demo scenario that proves requirements are met.

---

## Summary of Recommendations

| # | Suggestion | Effort | Impact |
|---|------------|--------|--------|
| 1 | Phase gates with checkpoints | Low | High |
| 2 | Verification tasks | Low | High |
| 3 | Visual specifications | Medium | High |
| 4 | Blocking vs. optional markers | Low | Medium |
| 5 | Progress reporting requirements | Low | High |
| 6 | Separate architecture phase | Low | High |
| 7 | Anti-patterns documentation | Low | Medium |
| 8 | Structure verification scripts | Medium | High |
| 9 | Done criteria per requirement | Medium | High |
| 10 | Minimum viable demo checklist | Low | High |

---

## Applying These Lessons

For the current project remediation:
1. REMEDIATION_TASKS.md already incorporates checkpoints after each phase
2. Phase R1 (Architecture) is explicitly marked as BLOCKING
3. Verification steps are included in each phase

For future projects:
1. Add these patterns to the spec-workflow templates
2. Include structural verification in CI/CD pipeline
3. Require checkpoint screenshots before phase transitions
4. Use the "done criteria" pattern for all requirements

---

## Conclusion

The core issue was **building what seemed right rather than building what was specified**. The specification documents contained all necessary information, but they weren't used as the authoritative source during implementation.

The suggestions above create friction at key decision points, forcing verification against specifications before proceeding. This friction is intentional - it's much cheaper to catch architectural mistakes early than to refactor after features are built on the wrong foundation.
