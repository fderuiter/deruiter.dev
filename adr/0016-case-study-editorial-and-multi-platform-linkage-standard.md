# 0016. High-Assurance Systems Case Study Editorial and Multi-Platform Linkage Standard

## Status

Accepted

## Context

The portfolio showcases complex engineering projects ranging from compiler runtimes and clinical trial compliance tools to machine learning pipelines, full-stack web applications, and embedded firmware. Previously:

- Case study editorial content lacked a unified, deep-dive architectural structure, resulting in inconsistent detail across projects.
- Case study headers did not prominently display direct links to external source code repositories (`github_url`) or secondary external artifacts (such as Kaggle notebooks or package registries).
- There were no standardized bidirectional link seams connecting case study writeups to corresponding in-app interactive tools (e.g. CRF Studio `/simulator`, Proof Workspace `/proof`, or Arcade games `/arcade/*`).
- Several GitHub issues (`[Case Study]`) remained open without structured tracer-bullet implementation and automated test coverage.

## Decision

We instituted the **High-Assurance Systems Case Study Editorial & Multi-Platform Linkage Standard**:

1. **Mandatory 5-Section Editorial Structure**: Every case study adheres to a strict high-density engineering narrative:
   - **Section 1: Executive Summary & Problem Solved** (Core value proposition, operational friction, key quantitative metrics and performance benchmarks).
   - **Section 2: Deep Dive Architecture & Design Patterns** (Module boundaries, state machines, worker thread isolation, decoupled factories).
   - **Section 3: System Design & Runtime Data Flow** (Mermaid.js architectural topology diagram).
   - **Section 4: Key Technical Challenges & Production Code Snippets** (2–3 real TypeScript/Python/Rust algorithms with strict type signatures).
   - **Section 5: Trade-Offs, Edge Cases & Lessons Learned** (Memory/GC boundaries, failure modes, roadmap).

2. **Platform-Agnostic Multi-Action Hero Bar**:
   - Primary action buttons prominently display direct links to GitHub repositories (`fderuiter/<repo>`) with live/simulated repository telemetry (stars, language, commits).
   - Graceful platform-agnostic support for external artifacts (such as Kaggle notebooks for ML/data science pipelines) without requiring artificial GitHub repositories or throwing telemetry exceptions.
   - Dedicated `Launch Interactive Studio` buttons connecting case studies directly to relevant in-app simulators (`/simulator`, `/proof`, `/arcade/*`).

3. **Interactive Developer CLI Sandbox**:
   - Step-by-step interactive terminal commands (`commands_json`, `playback_json`) rendered via `SandboxTerminal` to simulate live CLI interactions directly in the browser.

4. **Tracer-Bullet Issue-by-Issue Rollout**:
   - Work through the open `[Case Study]` GitHub issues (#321 DuckDeploy, #314 + #440 CRF.xl, #317 Cardiac Risk, #316 4Glory, #309 Sortify, #307 PromptOps, #306 Wedding Website) sequentially, implementing red-green tests, verifying 5-point discovery matrix indexing, and closing issues upon completion.

## Consequences

- All case studies provide a consistent, high-density technical reading experience matching the engineering standards of top-tier systems software.
- Visitors can seamlessly inspect original source code on GitHub/Kaggle or launch interactive in-browser simulations.
- SEO and discovery matrices (Command Palette, Navbar, Footer, Sitemap, OpenGraph cards) remain 100% synchronized with zero documentation drift.
