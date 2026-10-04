# CLAUDE.md

Rules for building the content rewards platform. Follow them for the whole project.

## The brief

The full brief lives in `/docs`. Read it in this order: `README.md`, `01_PRODUCT.md`, `02_DATA_AND_MONEY.md`, `03_SYSTEMS.md`, `04_BUILD_PLAN.md`, `05_DESIGN_SYSTEM.md`, then `docs/design/handoff/README.md`.

- Final design mockups: `docs/design/handoff/` ("Platform Mockups.dc.html" and "Creator Site v1.dc.html").
- Screenshots of every screen, state and theme of those mockups at 1440, 1024 and 390 px: `docs/design/reference-screens/`. These screenshots are the locked design.
- Reference image: `docs/reference/home-reference.jpg`.

## Design rules

- The design is locked. The handoff mockups decide every visual and copy detail of every screen they show, with "Creator Site v1" winning on creator screens. Never change them for any reason. Build them pixel for pixel.
- That covers layout, fonts, colours, gradients, spacing, sizes, copy, labels, animations and the order of sections. Not to "improve" them, not to match another doc, not to fix something that looks wrong.
- If something in the design looks like a mistake, say so to the owner and keep building it exactly as designed.
- Where `05_DESIGN_SYSTEM.md` or `home-reference.jpg` disagree with the mockups, the mockups win, every time, without asking. Do not list these as questions.
- `support.js` and `image-slot.js` in the handoff folder are the mockup's preview tool only. Never use them in the product.
