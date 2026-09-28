# Make Keystone the buyer's daily deal desk

## Direction
Prioritize **daily deal execution**: buyers should open Keystone to see what needs action today, who owns it, and which deadline or missing item could hold up a closing. Keep the current restrained, editorial appearance; remove explanatory subtitles that repeat obvious headings, but retain dates, counts, warnings, and financial context that help decisions.

## First release
1. **Tighten the interface.** Remove generic helper sentences beneath section headings across deal steps, pipeline, insights, and settings; keep essential instructions beside the specific control they explain. Shorten the deal-step labels to fit better and remove their extra hint text. Replace stale references to old step numbers. Make empty states tell the user the next useful action rather than describe a feature.
2. **Add a firm-wide “Today” view.** Put it in the main navigation and surface assigned tasks, unassigned tasks, overdue and upcoming key dates, and outstanding diligence requests across accessible deals. Group by urgency, show owner and deal, and let users jump straight to the relevant deal step. Provide filters for mine, team, and unassigned; allow completing tasks from the view. Use real deal data, not demo totals.
3. **Make each deal's next action unmistakable.** In the deal header, show its closest open deadline or overdue task and the most important outstanding diligence item; link directly to Schedule or Data room. Show the same concise blocker signal on pipeline rows/cards. Avoid noisy alerts when a deal has no blockers.
4. **Trust and access pass.** Verify that view-only invitees can open the files they are promised, that date/task counts match their source records, and that error, loading, and no-data states are explicit. Fix any mismatches found before calling the release ready.

## What to build after usage proves demand
- **Follow-up accountability:** optional email digests or reminders for assigned work, only after buyers confirm they want them; no always-running background checker just to determine whether a date is overdue.
- **Decision trail:** record why an assumption changed, who changed it, and which source document supports it. This makes lender and committee reviews defensible.
- **Acquisition decision gates:** a lightweight pre-LOI and go-hard checklist with named approvers and open exceptions, rather than another general-purpose document generator.
- **Property-specific depth:** rent-roll versus collections and lease-expiration analysis for multifamily; tenant concentration, rollover, reimbursements, and lease abstracts for industrial. Build these after firms show which asset types they actually underwrite.

## Why people return
The daily queue, ownership, and hard deadlines create a recurring job to do; source-linked underwriting and a clear decision trail create confidence to keep the work here. Measure weekly active firm members, tasks completed before due date, deals with an assigned next action, and the share of deals that reach a documented decision—not just sign-ups or PDF downloads.

## Technical notes
Use existing deal tasks, DD items, deals, and firm membership with the current access policies; compute overdue status from due dates when reading. Keep shared-party access read-only. Add the Today page under the authenticated app and use the existing design components and colors. If a new table proves necessary later, define grants and row-level policies in the same migration. Verify signed-in desktop/mobile navigation, task completion, and invited-viewer file access before release.
