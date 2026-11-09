# Working on the guide funnel

Read `HANDOVER.md` in this folder first: what the app is, how it ships, every
setting, how to change content and video, and the open items. Then
`AGENTS.md` (this Next.js version differs from older ones).

Rules for every change:

- Production deploys from branch `claude/awesome-meitner-otpkia` (Vercel,
  project guide-funnel, root directory `guide`). Work on a branch and merge
  into it; never push to the repository's default branch for this app.
- Content lives in `content/*.json`. Change copy, links, reviews and video ids
  there, not in components.
- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run check:dashes`
  and `npm run build` before every push. All must pass.
- No em dashes in content, code or commit messages.
- Only approved proof (`content/proof.json`), no invented reviews, no hosted
  outside footage.
- Never write, print or commit a secret. Settings are changed by a person in
  Vercel; say which variable and what it is for.
- Videos: YouTube id or a hosted MP4 (H.264, 30 fps, faststart). Not Mux.
- The test browser cannot decode H.264: say that video playback still needs
  a real phone check rather than claiming it plays.
