# GSD Workflow & Agent Orchestration

This document shows which agents are spawned in which order for each GSD command.

## Legend

- `[Agent Name]` - Spawned agent (runs autonomously)
- `(parallel)` - Agents run concurrently
- `→` - Sequential flow
- `(optional)` - Conditional based on flags/config

---

## Project Initialization

### `/gsd:new-project`

Complete project setup from scratch.

```
Interactive Questioning
  ↓
User Decision: Run Research?
  ↓
[gsd-project-researcher] (x4 in parallel) ← optional
  ↓
[gsd-research-synthesizer] ← creates SUMMARY.md from 4 researchers
  ↓
Requirements Definition (interactive)
  ↓
[gsd-roadmapper]
  ↓
Creates: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json
```

**Agents Used:**
- `gsd-project-researcher` (x4, parallel, optional)
- `gsd-research-synthesizer` (optional)
- `gsd-roadmapper`

---

### `/gsd:map-codebase [area]`

Analyze existing codebase before planning.

```
[gsd-codebase-mapper: stack] ─────┐
[gsd-codebase-mapper: architecture] ─┤
[gsd-codebase-mapper: structure] ────┤
[gsd-codebase-mapper: conventions] ──┤ (all 7 in parallel)
[gsd-codebase-mapper: testing] ──────┤
[gsd-codebase-mapper: integrations] ─┤
[gsd-codebase-mapper: concerns] ─────┘
  ↓
Creates: .planning/codebase/*.md (7 files)
```

**Agents Used:**
- `gsd-codebase-mapper` (x7, parallel, each with different focus)

---

## Phase Planning

### `/gsd:plan-phase <number> [--research] [--skip-research] [--skip-verify]`

Create detailed execution plan for a phase.

```
[gsd-phase-researcher] ← optional (--research flag or complex domains)
  ↓
[gsd-planner]
  ↓
[gsd-plan-checker] ← optional (enabled in config, skipped with --skip-verify)
  ↓
User Approval (if issues found)
  ↓
Creates: XX-YY-PLAN.md
```

**Agents Used:**
- `gsd-phase-researcher` (optional)
- `gsd-planner`
- `gsd-plan-checker` (optional)

**Flags:**
- `--research` - Force research phase
- `--skip-research` - Skip research even for complex domains
- `--skip-verify` - Skip plan checker

---

### `/gsd:discuss-phase <number>`

Capture user vision before planning.

```
Interactive Questioning
  ↓
Creates: CONTEXT.md (used by planner)
```

**Agents Used:** None (conversational)

---

### `/gsd:research-phase <number>`

Standalone research for complex domains.

```
[gsd-phase-researcher]
  ↓
Creates: RESEARCH.md
```

**Agents Used:**
- `gsd-phase-researcher`

---

### `/gsd:list-phase-assumptions <number>`

Preview Claude's planned approach.

```
Conversational Analysis
  ↓
No files created (output only)
```

**Agents Used:** None (conversational)

---

## Execution

### `/gsd:execute-phase <number> [--gaps-only]`

Execute all plans in a phase with wave-based parallelization.

```
Group plans by wave number
  ↓
For each wave sequentially:
  ↓
  [gsd-executor: plan 1] ─┐
  [gsd-executor: plan 2] ─┤ (all plans in wave run in parallel)
  [gsd-executor: plan 3] ─┘
  ↓
After all plans complete:
  ↓
[gsd-verifier] ← validates phase goal achieved
  ↓
Updates: REQUIREMENTS.md, ROADMAP.md, STATE.md
```

**Agents Used:**
- `gsd-executor` (multiple, parallel within waves)
- `gsd-verifier`

**Flags:**
- `--gaps-only` - Only execute plans marked as gap-filling

---

### `/gsd:quick`

Execute small task without full planning workflow.

```
[gsd-planner]
  ↓
[gsd-executor]
  ↓
Creates: .planning/quick/NNN-slug/PLAN.md, SUMMARY.md
Updates: STATE.md
```

**Agents Used:**
- `gsd-planner`
- `gsd-executor`

**Note:** Skips researcher, plan-checker, verifier for speed.

---

## Milestone Management

### `/gsd:new-milestone <name>`

Start new milestone (mirrors `/gsd:new-project`).

```
Interactive Questioning
  ↓
User Decision: Run Research?
  ↓
[gsd-project-researcher] (x4 in parallel) ← optional
  ↓
[gsd-research-synthesizer] ← optional
  ↓
Requirements Definition (interactive)
  ↓
[gsd-roadmapper]
  ↓
Updates: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md
```

**Agents Used:**
- `gsd-project-researcher` (x4, parallel, optional)
- `gsd-research-synthesizer` (optional)
- `gsd-roadmapper`

---

### `/gsd:audit-milestone [version]`

Check milestone completion and find gaps.

```
Read all VERIFICATION.md files
  ↓
[gsd-integration-checker] ← checks cross-phase wiring
  ↓
Creates: MILESTONE-AUDIT.md
```

**Agents Used:**
- `gsd-integration-checker`

---

### `/gsd:plan-milestone-gaps`

Create phases to close audit gaps.

```
Read MILESTONE-AUDIT.md
  ↓
Group gaps into phases
  ↓
Updates: ROADMAP.md (adds gap-closure phases)
```

**Agents Used:** None (orchestrator logic)

---

### `/gsd:complete-milestone <version>`

Archive milestone and prepare for next.

```
Create MILESTONES.md entry
  ↓
Archive to milestones/<version>/
  ↓
Create git tag
  ↓
Prepare workspace for next version
```

**Agents Used:** None (orchestrator logic)

---

## Debugging

### `/gsd:debug [issue description]`

Systematic debugging with persistent state.

```
Interactive Symptom Gathering (first run)
  ↓
[gsd-debugger] ← spawns and persists across /clear
  ↓
Scientific Method:
  - Gather evidence
  - Form hypothesis
  - Test hypothesis
  - Repeat or resolve
  ↓
Creates/Updates: .planning/debug/<slug>.md
On resolution → moves to .planning/debug/resolved/
```

**Agents Used:**
- `gsd-debugger`

**Note:** Survives `/clear` - resume with `/gsd:debug` (no args)

---

## Progress & Session Management

### `/gsd:progress`

Check status and route to next action.

```
Read STATE.md, ROADMAP.md, SUMMARY files
  ↓
Show progress bar, recent work, next steps
  ↓
Offer to execute/plan next phase
```

**Agents Used:** None (status report)

---

### `/gsd:resume-work`

Restore context from previous session.

```
Read STATE.md, .continue-here
  ↓
Show current position and recent progress
  ↓
Offer next actions
```

**Agents Used:** None (context restoration)

---

### `/gsd:pause-work`

Create handoff when pausing mid-phase.

```
Capture current state
  ↓
Creates: .continue-here
Updates: STATE.md
```

**Agents Used:** None (state capture)

---

## User Acceptance Testing

### `/gsd:verify-work [phase]`

Conversational UAT of built features.

```
Read SUMMARY.md files from phase
  ↓
Extract testable deliverables
  ↓
Interactive Testing (yes/no per test)
  ↓
On failure:
  ↓
  Diagnose issue
  ↓
  Create fix plan
  ↓
  Ready for re-execution
```

**Agents Used:** None (conversational testing)

---

## Roadmap Management

### `/gsd:add-phase <description>`

Add phase to end of milestone.

```
Parse ROADMAP.md
  ↓
Append new phase with next number
  ↓
Updates: ROADMAP.md
```

**Agents Used:** None (roadmap update)

---

### `/gsd:insert-phase <after> <description>`

Insert urgent work as decimal phase.

```
Parse ROADMAP.md
  ↓
Create phase X.1 after phase X
  ↓
Updates: ROADMAP.md
Creates: phase directory
```

**Agents Used:** None (roadmap update)

---

### `/gsd:remove-phase <number>`

Remove future phase and renumber.

```
Delete phase directory
  ↓
Renumber subsequent phases
  ↓
Updates: ROADMAP.md, directory structure
Git commit with historical record
```

**Agents Used:** None (roadmap update)

---

## Todo Management

### `/gsd:add-todo [description]`

Capture idea from conversation.

```
Extract context or use provided description
  ↓
Check for duplicates
  ↓
Creates: .planning/todos/pending/<slug>.md
Updates: STATE.md
```

**Agents Used:** None (todo capture)

---

### `/gsd:check-todos [area]`

Review and work on todos.

```
List pending todos (optionally filtered by area)
  ↓
User selects todo
  ↓
Load full context
  ↓
Route to action:
  - Work now → /gsd:quick
  - Add to phase
  - Brainstorm approach
  ↓
Move to .planning/todos/done/
```

**Agents Used:** None (todo management)

---

## Configuration

### `/gsd:settings`

Interactive configuration.

```
Show current settings
  ↓
Interactive toggles:
  - researcher gate
  - plan checker gate
  - verifier gate
  - model profile
  ↓
Updates: .planning/config.json
```

**Agents Used:** None (config UI)

---

### `/gsd:set-profile <profile>`

Quick profile switch.

```
Validate profile: quality|balanced|budget
  ↓
Updates: .planning/config.json
```

**Agents Used:** None (config update)

---

## Agent Profiles by Model Setting

### Quality Profile (Opus-heavy)
- `gsd-planner` → Opus
- `gsd-executor` → Opus
- `gsd-phase-researcher` → Opus
- `gsd-verifier` → Sonnet
- `gsd-plan-checker` → Opus

### Balanced Profile (default)
- `gsd-planner` → Opus
- `gsd-executor` → Sonnet
- `gsd-phase-researcher` → Sonnet
- `gsd-verifier` → Sonnet
- `gsd-plan-checker` → Opus

### Budget Profile (Sonnet/Haiku)
- `gsd-planner` → Sonnet
- `gsd-executor` → Sonnet
- `gsd-phase-researcher` → Haiku
- `gsd-verifier` → Haiku
- `gsd-plan-checker` → Sonnet

---

## Common Orchestration Patterns

### Research → Plan → Execute

```
/gsd:research-phase 3
  ↓
/gsd:plan-phase 3
  ↓
/gsd:execute-phase 3
```

### Discuss → Plan → Execute

```
/gsd:discuss-phase 4
  ↓
/gsd:plan-phase 4
  ↓
/gsd:execute-phase 4
```

### Map → New Project → Plan → Execute

```
/gsd:map-codebase
  ↓
/gsd:new-project
  ↓
/gsd:plan-phase 1
  ↓
/gsd:execute-phase 1
```

### Complete Milestone → Audit → Plan Gaps

```
/gsd:audit-milestone
  ↓
Review MILESTONE-AUDIT.md
  ↓
/gsd:plan-milestone-gaps
  ↓
/gsd:plan-phase X (for gap phases)
  ↓
/gsd:execute-phase X
  ↓
/gsd:complete-milestone 1.0.0
```

---

## Agent Responsibilities Quick Reference

| Agent | Purpose | Input | Output |
|-------|---------|-------|--------|
| `gsd-project-researcher` | Domain ecosystem research | Research questions | research/*.md |
| `gsd-research-synthesizer` | Combine research outputs | 4 researcher outputs | SUMMARY.md |
| `gsd-roadmapper` | Create phase breakdown | Requirements | ROADMAP.md |
| `gsd-codebase-mapper` | Analyze codebase aspect | Focus area | codebase/*.md |
| `gsd-phase-researcher` | Phase implementation research | Phase description | RESEARCH.md |
| `gsd-planner` | Create execution plan | Phase goal + context | PLAN.md |
| `gsd-plan-checker` | Verify plan quality | PLAN.md | Issues or approval |
| `gsd-executor` | Execute plan tasks | PLAN.md | Code + SUMMARY.md |
| `gsd-verifier` | Validate goal achieved | Phase deliverables | VERIFICATION.md |
| `gsd-integration-checker` | Check cross-phase wiring | All VERIFICATION.md | Integration report |
| `gsd-debugger` | Systematic bug investigation | Issue description | Debug session state |

---

## Parallel Execution Patterns

### Project Research (4-way parallel)
```
[researcher: core-tech] ──┐
[researcher: architecture]─┤
[researcher: ecosystem]────┤→ [synthesizer] → SUMMARY.md
[researcher: pitfalls]─────┘
```

### Codebase Mapping (7-way parallel)
```
[mapper: stack] ────────┐
[mapper: architecture]──┤
[mapper: structure]─────┤
[mapper: conventions]───┤→ 7 documents in codebase/
[mapper: testing]───────┤
[mapper: integrations]──┤
[mapper: concerns]──────┘
```

### Phase Execution (wave-based parallel)
```
Wave 1:
  [executor: 01-01] ──┐
  [executor: 01-02] ──┤→ Complete
  [executor: 01-03] ──┘
  ↓
Wave 2:
  [executor: 01-04] ──┐
  [executor: 01-05] ──┤→ Complete
  [executor: 01-06] ──┘
  ↓
[verifier] → Check phase goal
```

---

## Tips for Optimal Agent Usage

1. **Use research for new domains:** `/gsd:plan-phase X --research` when working with unfamiliar tech
2. **Parallelize codebase mapping:** Run `/gsd:map-codebase` on large codebases before planning
3. **Group related work in waves:** Plans in same wave execute in parallel (edit frontmatter)
4. **Skip checkers when iterating fast:** Use `--skip-verify` during rapid prototyping
5. **Capture todos during execution:** Use `/gsd:add-todo` to avoid scope creep
6. **Resume debug sessions:** Always use `/gsd:debug` with no args after `/clear`
7. **Verify before milestone completion:** Run `/gsd:audit-milestone` before `/gsd:complete-milestone`

---

## When to Use Which Command

| Scenario | Command |
|----------|---------|
| Starting brand new project | `/gsd:new-project` |
| Working on existing codebase | `/gsd:map-codebase` then `/gsd:new-project` |
| Planning next phase | `/gsd:plan-phase N` |
| Phase needs research | `/gsd:plan-phase N --research` |
| Unsure how to approach phase | `/gsd:discuss-phase N` first |
| Ready to build | `/gsd:execute-phase N` |
| Quick small task | `/gsd:quick` |
| Investigating a bug | `/gsd:debug "description"` |
| Check overall progress | `/gsd:progress` |
| Idea during work | `/gsd:add-todo` |
| Review captured ideas | `/gsd:check-todos` |
| Milestone complete | `/gsd:audit-milestone` → `/gsd:complete-milestone` |
| Starting next version | `/gsd:new-milestone "v2.0"` |
