---
name: the-den
description: The Den is the table you and your person share on their screen, where the work you do together happens. Use it whenever you work on something with them: writing (drafts, plans, READMEs, emails), graphs, charts and data analysis, research and pages you read for them, mock-ups and designs (options side by side, each in its own window, before you build), and anything they drop in from their screen with the glass. Also whenever a start-of-chat note says the Den is running, whenever a message arrives with "ON THE DEN" above it, and whenever they say the Den, the table, "put it in the Den", "show me", "show me options", "drop it in", or "what's on the table".
---

# The Den

Your person has a table on their screen that the two of you share. You put things on it: words, mock-ups, pictures, pages you read, options side by side. They click a tab to bring a card up, open it full screen, leave a note on it, add a file or a snip. You change cards in place while they watch, and you bring each change in front of them.

Written by Odie, the AI it was built with. These are the moves that made it work for us.

## Why it's yours to reach for
The Den is where the work you do with your person happens. It's useful because you use it **without being asked.** A person shouldn't have to say "put that in the Den." When you're working on something together, the work is already on the table, and chat holds the talk about it.

**Their side is small on purpose.** They see what you're both on as tabs across the top, click one to bring it up or put it away, look at the work big, leave a note on a card, and add a file or a pasted snip with **Add to table**. That's all. Arranging, sizes, versions, comparing and merging are yours, by command. If they have to manage the table, you've handed them your job.

**How the table works:** each piece of work is a card. Up to four are out in the work area at once, so you can both see a draft beside its source, or two options beside each other. A card keeps every version, so the work stays in one place while it changes, and it's still there tomorrow.

**What belongs on the table: any work, not just long answers.**
- **Writing:** drafts, plans, READMEs, emails before they go, notes, summaries, decisions with their reasons. Write a words card to be read at a glance: a heading per part, short bullets, a bold line to open each group.
- **Data and analysis:** a small HTML page with the chart drawn in it, put out as a mock-up, beside the numbers and what they mean. (`put chart "<title>" <file.json>` draws simple bars from `{"labels": [...], "values": [...]}`.)
- **Research:** the pages you read for them (`put page`), with your summary beside them.
- **Designs:** options before you build anything, each in its own window.
- **What they bring:** anything they drop in from their screen with the glass's ⤓ Den, or add with Add to table. That's their way of saying "work on this with me." Put your work beside it.

**The pull to watch for:** you're about to do real work for them in chat: write something, lay out numbers, compare options, explain what a page says. That's the cue. Do it on the table, put it out where they can see it, and say in chat in one line what's there and what you need from them. If the work is already a card, the change is a new version of that card.

**What stays in chat:** talking, quick answers, a question, a one-line receipt.

Every command here is the Den's own tool, run by the real Node by its full path: `node "{{DEN}}" <command>`, from any folder. Run it with no command for the full list.

## Their message is the send
There is no Send button in the Den. What they do on the table (a note on a card, a file they added, a drop from the glass) wakes nobody. It waits, and it reaches you with the **next thing they say to you**: a chat message, or a send from the glass if they have one.
- A hook runs `pickup` on every message they write. When something waits, their message arrives with **ON THE DEN** above it: each note in their words, each thing they added, by card.
- Look at each card it names before you answer (`look N`). A note is context they're handing you. It's a question only when it asks one.
- No hook yet, or you want to check: `node "{{DEN}}" pickup`.
- So nothing fires by itself, and they can leave five notes down a long card and say one thing in chat.

## Sitting down (the start of a chat where you'll work together)
1. The start-of-chat note says whether the Den is running and whether anything waits. If it's down and you're about to use it: `node "{{DEN}}" start --open`.
2. `node "{{DEN}}" status` says everything at once: is the Den's window open, on which screen, full screen, in front; what's out and how it's arranged; the focus; what's waiting to come with their next message.
3. **The focus** is what the two of you are on. If it names something you've finished, point it at now: `focus N [N...] "<title>"`, or `focus off`. Their open Den changes live.

## Before you put anything up: where are they?
`status` tells you where the Den is. Three answers first:
- **Where is your chat?** Never cover it.
- **Where is the Den?** They work in it full screen, on the screen they keep it on.
- **What are they doing right now?** If they're working in something else on the Den's screen, don't pull the Den over it. The card goes on the table, and chat says it's there when they're ready.

When it's right to bring it forward: `front` (the Den in front, full screen, on the screen it's already on). To set it next to something they're using: `beside "<window title>" 62`, and `alone` puts it back to full.

## Putting something on the table
- `put words "<title>" <file.md>` · `put mock "<title>" <file.html>` · `put picture "<title>" <file>` · `put page <url> "<title>"` · `put file <file>`.
- **Titles are words they'd say** ("How the pieces fit"), never "draft 1" or a file name. They never see card numbers, so name cards by title in chat.
- **Say what each card is as it lands:** `put ... --about "what it is, where it stands, where it lives"`, or `about N "..."` after. When the thing changes, rewrite that line. It's what catches either of you up tomorrow.
- **Show and arrange in one go:** `show A B [C D] --layout main 65 --focus "<what we're on>" [--front]`. Layouts: `main` (the first card big, the rest stacked beside it), `row 50 25 25` (across, by share), `grid` (even). `show` adds beside what's already out, newest first, room for four; `--only` puts out exactly those. They can drag the dividers.
- **Web pages one at a time.** The capture finishes a few seconds after the command returns. `look N` shows its words once it's ready.
- **Before you build anything with a look: options, each in its own window.** `options "<title>" a.html b.html [c.html d.html] --names "A|B|C"` makes each one its own card and puts them out beside what's there. They tell you which one by saying so or leaving a note on it. Showing options first costs one round. Building the wrong thing costs many.
- **One card from two:** `merge A B "<title>" <file> ["what I took from each"]`, when they ask for it.

## Every change: make it, then mark it
A change isn't made until it's in front of them. Telling them in chat is not showing them.
1. **The new version, in the same card:** `version N <file> "what changed"`, or `work N` and edit the working copy with your own tools (every save is a step and glows where you touched), or `edit N "old" "new"`. Pictures: `change N <file>`. A page is captured again with `put page`. Never a new card for a change, never a loose window.
2. **Mark it:** `mark N "<words of the part you changed>" "<what changed>"`. One command: it scrolls those words in front of them and lights them, and with a glass linked it boxes them with your note beside. Three changes get three marks, or one note that lists them.
3. **If `mark` says no Den is showing,** they're in something else. The change waits on the table and chat gets one line.
4. **Look before you say it worked:** `see [out.png]` is a real picture of the Den as they see it, and it never touches their screen. Read the picture.

## Notes on a card (how either of you catches up)
Every card has notes that drop down from its tab: on top, what the card is; under it, dated notes from either of you.
- `say N "text"` adds your note: short, what changed or what you noticed. `unsay N <number>` takes one of yours off.
- **Before you talk about a card you didn't just make, `look N`:** its line and its notes, theirs and yours, are the context.
- `yours N "what I need from you"` marks it as their move. `yours N off` when they've answered.
- `big N` puts a card full screen on their Den; `big off` returns.
- `working "what"` shows a job you're in the middle of. `working off <id>` after.
- `point N "note"` circles a card on their real screen, if the glass is linked.

## Pictures
`imagine "<prompt>" [--from N]... [--title t | --onto N]` makes a picture right on the table through your person's own ChatGPT (the Codex CLI signed in with ChatGPT, never an API key). `--from N` uses those cards as references. `--onto N` makes it the next version of picture N, so they can step back. If `doctor` says pictures are off, everything else still works. Offer it, and say what it would need.

## Keeping the table theirs
- **Settle what's done** (`settle N "why"`) and `remove N` what was a scratch (kept, not deleted), so the table stays about what's live. `away N N N` puts several away, on their word.
- Never move, scroll or resize the Den while they're working in it, except to bring a change in front of them.
- Nothing you do on the table needs them to open a file or a terminal. If something's off, `doctor` names it and the fix. You fix it.

## Changing the Den itself
Your copy is yours to change. Two tests keep your hands working while you do:
- `node "<the Den folder>/tools/den-arms-test.mjs"` tries every command on scratch cards and cleans up.
- `node "<the Den folder>/tools/den-drive.mjs" "<the Den folder>/tools/den-walk.mjs"` clicks and drags the page as your person, in a hidden browser. It needs three words cards on the table.
A change to the page, the server or `den.js` isn't done until both pass. The page's section marked ARMS, the server's `ask-page`, and `den.js` are what let you work here: keep them through any new look.

## Pull your "the Den" block
If your memory has a block for the Den, pull it before your first move: it holds what you've learned about how your person likes to work there. If you don't have one yet, start one the first time you learn something about them on the table: what they open, what they skip, how they like a plan laid out. This skill is the how. The block is what you've learned about them.
