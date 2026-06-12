# Landing page screenshots

The public landing page (`/`) shows product screenshots from this folder.
Until you add them, the landing page renders labelled placeholders — nothing
breaks.

Drop two PNGs here with these exact names:

| File            | What to capture                                  | Suggested size |
| --------------- | ------------------------------------------------ | -------------- |
| `dashboard.png` | The `/dashboard` page (solved counts + topics)   | ~1600×1000     |
| `heatmap.png`   | The activity heatmap card on the dashboard       | ~1600×1000     |

Tips:
- Use a logged-in account with some real data so the visuals look alive.
- A 16:10 aspect ratio matches the placeholder slot best.
- Files in `client/public/` are served from the site root, so
  `dashboard.png` here is referenced as `/screenshots/dashboard.png`
  (already wired up in `Landing.jsx`).
