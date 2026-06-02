# Audit Trail: Demo Script & Guide

A roughly 4-minute walkthrough of the app: the unified diff hero, light/dark and accent theming,
three Change-History views, and the append-only restore flow. Everything is wired to the **real .NET
API**, so every mutation is logged by the EF Core interceptor, not faked.

## URLs

| Thing | URL |
|---|---|
| The app | http://localhost:4200 (opens on Audit Trail) |
| Incidents page | http://localhost:4200/accidents |
| Backend API | http://localhost:5080/api |
| API explorer (Scalar) | http://localhost:5080/scalar |

## Before you start

Two things need to be running.

```bash
# Terminal 1: backend API on :5080
cd backend && dotnet run

# Terminal 2: the app on :4200
cd frontend && npm start
```

Or both at once from the repo root: `make dev`. Then open http://localhost:4200.

**For a pristine demo** (reset to the three seed incidents, clear any test data):

```bash
make clean                 # removes build artifacts + the SQLite demo DB
cd backend && dotnet run   # restarts and reseeds ACC-0001 / 0002 / 0003
```

Whatever theme and accent you last picked persists in localStorage. That is intentional, it remembers
your preferences.

## Two ways to demo

1. **Let the app drive.** Click **Tour** (top-right) for an 8-step guided walkthrough: it spotlights
   each part of the screen with a short caption and Next / Back. Good for a hands-off or first-time
   audience.
2. **Drive it yourself** with the talk track below. More control, better for a tailored pitch.

The seed data is already a story: incident **ACC-0001** was logged as High, then escalated to
**Critical** and **Resolved**; **ACC-0003** was logged then **soft-deleted as a duplicate** (so it's
sitting in the trail ready to restore); four different people made the changes over the past week.

## The 60-second version

> "This is Audit Trail. Every change to a record gets logged automatically, field by field. _(point
> at the top entry)_ Here's the most recent one: a status moved from Investigating to Resolved, by
> safety.admin, an hour ago. _(switch Detailed / Compact / Timeline)_ You can read the whole history
> three ways. And nothing is ever lost: this slip-on-floor incident was deleted as a duplicate, but
> _(click Restore on the ACC-0003 Delete row)_ I can bring it straight back from the log, and the
> restore itself gets recorded. Captured automatically, readable any way you like, and reversible."

## The full talk track

Read it almost word-for-word. Each beat flows into the next. Italic _(cues)_ tell you what to click.

**① Open the app. It lands on Audit Trail.**
> "So this is **Audit Trail**. It answers one question, and answers it well: *who changed what, and
> when.* Every time someone adds, edits, or deletes a record, it gets written down automatically.
> Nobody has to remember to log anything; it happens down at the database level. What you're looking
> at is that log."

**② Point at one entry.**
> "Each row is a single change. Take this one _(point to an Update entry)_. It doesn't just say
> 'something changed,' it tells you exactly which field, and what it went from and to. You can see
> this one flipped from `false` to `true`. The little marks on the left, plus / minus / tilde, tell
> you at a glance whether something was added, removed, or edited, so you're never relying on color
> alone. And if I want the whole picture, including the fields that *didn't* change, I just hit
> **Expand**. _(click Expand)_"

**③ Click the moon, then Tweaks.**
> "Quick aside on polish, because it matters when people live in a tool all day. There's a dark mode
> _(click the moon, top-right)_, and it remembers what you picked. And down here there's a little
> control panel _(click Tweaks, bottom-right)_ where you can change the accent color, tighten the
> spacing to fit more on screen, or switch how the diff is laid out. All of that sticks between
> sessions. _(close Tweaks)_"

**④ Switch views: Detailed, Compact, Timeline.**
> "Here's the part I like. The same history reads three different ways. _(click through the switcher)_
> **Detailed** is the full diff on every entry. **Compact** gives you one clean line per change, and
> you click any row to open it up. And **Timeline** lays it all out by day, like a story of what
> happened, with the dots color-coded by the kind of change. Same data, whichever way your brain
> likes to read it."

**⑤ Log a new incident, then go back to Audit Trail.**
> "Let me show you this is all real, not a mockup. _(Incidents, then New incident, fill it in, Log
> incident)_ There's the confirmation, and the new row flashed so you can see it landed. Now watch:
> _(go back to Audit Trail)_ there it is at the top, an **Insert**. I didn't type that log line into
> the interface. The backend recorded it the instant the record was saved, in the very same
> transaction. So these two screens literally cannot drift apart."

**⑥ Delete an incident, then restore it from the log.**
> "And the last idea, which is the whole point: nothing is ever truly deleted. _(on Incidents, delete
> one, confirm)_ When I remove this, it's a soft delete. It leaves the active list, but it's still in
> the trail. _(go to Audit Trail, find the Delete, click Restore, confirm)_ And from the log itself I
> can bring it back. It rebuilds the record from the snapshot we kept, and logs the restore as its own
> new entry. The history only ever grows. You can always see the full story."

**⑦ Open Filters, then Export CSV.**
> "And of course you can filter the log by action, by who did it, by date _(open Filters, try one)_,
> and export exactly what you're looking at to a spreadsheet. _(click Export CSV)_ So that's Audit
> Trail: every change captured automatically, readable three ways, and reversible, without ever losing
> the record of what happened."

## If someone asks "what's under the hood?"

- **It's a real app, not a prototype.** An Angular front end talking to a .NET API with a real database.
- **The logging is automatic.** One piece of code at the database layer (an EF Core
  `SaveChangesInterceptor`) catches every save, so a column added tomorrow is audited with zero extra
  work.
- **Restore works from a snapshot.** The full before/after of every record is kept, so a delete is
  reversible and the history stays append-only.
- **The look.** IBM Plex type, a forensic-ledger feel, light and dark, four accent colors, all
  themeable live.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Tables are empty, or "Is the API running on :5080?" | The backend isn't up. `cd backend && dotnet run`. |
| "Port 4200 in use" when starting the app | Start on another port: `npm start -- --port 4300`. |
| You want a clean slate | `make clean`, then restart the backend (reseeds three incidents). |
| Theme looks odd from a past run | It's remembering your last choice; toggle it back with the moon / sun. |
