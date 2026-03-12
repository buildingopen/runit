# Launch Kit

Use this file to launch RunIt across channels with consistent messaging.

## Core Message

- Tagline: **AI writes code. RunIt makes it real.**
- One-liner: **Turn Python functions into live apps with auto-generated UI and share links.**

## Audience Angles

- **AI coders:** Paste generated Python and get a usable app fast
- **Indie hackers:** Ship internal tools without frontend work
- **Dev teams:** Share runnable demos from plain Python functions

## Channel Copy

### Show HN (short)

Title idea:

`Show HN: RunIt - Turn AI-generated Python into live apps`

Body seed:

```
I kept getting useful Python from AI tools, but shipping it took too long.
Built RunIt to close that gap.

- Paste Python with type hints
- RunIt generates a form automatically
- Click Go Live and share a link
- Built-in memory via remember()
- Self-hosted with Docker

Repo: https://github.com/buildingopen/runit
Would love feedback on DX and onboarding friction.
```

### Reddit (r/Python, r/selfhosted)

Post seed:

```
Built an OSS tool to turn Python functions into live apps with share links.
You paste code, it generates UI from type hints, runs in Docker sandbox, and supports simple memory.

Would love feedback from people who prototype with AI-generated code.
```

### X / Twitter

Post seed:

```
AI writes code. RunIt makes it real.

Paste Python -> auto-generated UI -> Go Live -> share link.
Self-hosted, Docker sandbox, built-in memory.

OSS: https://github.com/buildingopen/runit
```

## Assets Checklist

- [ ] `README.md` has demo visuals above the fold
- [ ] Social preview image configured (`apps/web/public/og/runit-social-preview.svg`)
- [ ] Quick Start command verified on fresh machine
- [ ] Golden-path E2E passing in CI

## Launch Day Checklist

- [ ] Publish release notes
- [ ] Post on Show HN
- [ ] Post on X / Twitter
- [ ] Post to relevant Reddit communities
- [ ] Monitor issues for onboarding friction during first 24 hours
