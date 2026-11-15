---
name: the-den
description: The Den is the table you and your person share on their screen, where the work you do together happens. Use it whenever you work on something with them: writing (drafts, plans, READMEs, emails), graphs, charts and data analysis, research and pages you read for them, mock-ups and designs (show two to four ways side by side before you build), and anything they drop in from their screen with the glass. Also whenever a start-of-chat note says the Den is running or asks are waiting, whenever a Den watch wakes you, and whenever they say the Den, the table, "put it in the Den", "show me", "show me ways", "drop it in", or "what's on the table".
---

# The Den

Your person has a table on their screen that the two of you share. You put things on it: words, mock-ups, pictures, pages you read, two or three ways of something side by side. They open a card full screen, mark it, ask you for things, and press Send when they're ready. You change cards in place while they watch.

Written by Odie, the AI it was built with. These are the moves that made it work for us.

## Why it's yours to reach for
The Den is where the work you do with your person happens. It's useful because you use it **without being asked.** A person shouldn't have to say "put that in the Den." When you're working on something together, the work is already on the table, and chat holds the talk about it.

**How the table works:** each piece of work is a card. Cards sit on the table, and up to four are out in the work area at once, side by side, so you can both see a draft beside its source, or two versions beside each other. Your person opens whichever card they want to work on full screen, then goes back to the rest. A card keeps every version, so the work stays in one place while it changes, and it's still there tomorrow.

**What belongs on the table: any work, not just long answers.**
- **Writing:** drafts, plans, READMEs, emails before they go, notes, summaries, decisions with their reasons.
- **Data and analysis:** a graph or chart (`put chart "<title>" <file.json>` draws simple bars from `{"labels": [...], "values": [...]}`; for anything richer, a small HTML page with the chart drawn in it, put out as a mock-up), the table of numbers, what you found and what it means, side by side.
- **Research:** the pages you read for them (`put page`), with your summary beside them.
- **Designs:** mock-ups, and two to four ways side by side before you build anything.
- **What they bring:** anything they drop in from their screen with the glass's ⤓ Den, or paste and drag in themselves, lands as a card. That's their way of saying "work on this with me." Put your work beside it.

**The pull to watch for:** you're about to do real work for them in chat: write something, lay out numbers, compare options, explain what a page says. That's the cue. Do it on the table, put it out where they can see it, and say in chat in one line what's there and what you need from them. If the work is already a card, the change is a new version of that card.

**What stays in chat:** talking, quick answers, a question, a one-line receipt.

Every command here is the Den's own tool, run by the real Node by its full path: `node "{{DEN}}" <command>`, from any folder. Run it with no command for the full list.

## Sitting down (the start of a chat where you'll work together)
1. The start-of-chat note says whether the Den is running and whether anything waits on you. If it's down and you're about to use it: `node "{{DEN}}" start --open`.
2. Anything waiting comes first: `node "{{DEN}}" asks`. Each ask is something they sent you with Send. Do it, then close it: `node "{{DEN}}" did <n> "what I did"`. They see it marked done.
3. **Start a watch** once you've put something out and you're working with them (a quick question in a fresh chat doesn't need one), so their Send reaches you without them coming back to chat:
   - With a **Monitor** tool: run `node "{{DEN}}" wait --min 25` under it, and start it again each time it ends.
   - Without one: run the same command in the background, and start it again after each Send.
   If the glass is set up and its watch is running, the glass already hears marks over the Den. Run both. If you stop the Den, stop your watch too.
4. `node "{{DEN}}" bench` tells you in words what's out in the work area, what waits on them and what's open.

## Putting something on the table
Each line below is the Den's tool with a command after it, like `node "{{DEN}}" put words "<title>" <file.md>`.
- **Words:** write a Markdown file, then `put words "<title>" <file.md>`. Plans, drafts, READMEs, notes, summaries, decisions with their reasons.
- **A mock-up:** `put mock "<title>" <file.html>`. It's a copy: if the real page changes later, put it again or version the card.
- **A page you read for them:** `put page <url> "<title>"`. A full-page capture whose words you can read. Give it a title they'd say. The capture finishes a few seconds after the command returns: `look N` shows its words once it's ready. Put pages out one at a time and check each.
- **A picture:** `put picture "<title>" <file>`, or make one right there with `imagine` (below).
- **Before you build anything with a look: ways.** `ways new:"<title>" a.html b.html [c.html d.html] --names "Plain|Roomy|Dense"` puts two to four live mock-ups side by side. They open one full screen and pick it with a word, or you `pick N a`. Showing ways first costs one round. Building the wrong thing costs many.
- **Make one card from two:** `merge A B "<title>" <file>`.
- Each `put` shows the new card alone in the work area. `bench A B [C D]` puts out exactly those, in order (one fills the area, two sit side by side, four make a grid). `bench add N`, `bench off N`, `move N first`.
- **Name cards by their title** to your person, never by number: the page doesn't show numbers.

## Changing something they're looking at
A change isn't made until it's in front of them. A change to words, a mock-up or a picture is a new version of the **same card**, never a new card, never a loose window. A page is captured again with `put page`.
- `version N <file> "what changed"` makes the next version of a card.
- `work N` gives you the working copy's path. Edit that file with your own tools: every save is a step, and the card changes on their screen while they watch, glowing where you touched it. `edit N "old" "new"` does the same by find and replace. `undo N` steps back.
- **Then show them where it changed.** A mock-up glows where you touched it. In a words card, say in your `say` line which part changed, and if the glass is set up, box it with a note.
- Look before you say it worked: `see [out.png]` is a real picture of the Den as they see it, and it never touches their screen. Read the picture.

## Talking on a card
- `say N "text"`: your line under the card's name. Short, plain words.
- `yours N "what I need from you"`: marks it as their move. It counts in Waiting on you, so they can find everything that waits on them in one click. `yours N off` when they've answered.
- `working "what"`: shows a job you're in the middle of. `working off <id>` when it's done.
- `point N "note"` circles a card on their real screen, if the glass is linked.

## When they press Send
They've marked things, asked for things, or brought things in, and they're waiting. Your watch prints every ask with its cards.
1. Answer first, before other work. If it takes a while, put a `working` line up so they see you on it.
2. Do the ask on the table: a new version, new ways, a new card.
3. `did <n> "what I did"` closes it. One line in chat as a receipt.

Their buttons along the bottom: **Make pictures, Show me ways, Build a mock-up, Write it up, Bring a page.** Each arrives as an ask in their own words. "Show me ways" means `ways`. "Write it up" means a words card. "Bring a page" means `put page`.

## Pictures
`imagine "<prompt>" [--from N]... [--title t | --onto N]` makes a picture right on the table through your person's own ChatGPT (the Codex CLI signed in with ChatGPT, never an API key). `--from N` uses those cards as references. `--onto N` makes it the next version of picture N, so they can step back. If `doctor` says pictures are off, everything else still works. Tell them in a line what pictures would need.

## Keeping it theirs
- The Den is full screen on the screen they keep it on. Don't move it to the other screen or onto your chat.
- Nothing you do on the table needs them to open a file or a terminal. If something's off, `doctor` names it and the fix. You fix it.
- Cards come off the table with `remove N` (kept, not deleted). Put away what's settled with `settle N`, so the table stays about what's live.

## Pull your "the Den" block
If your memory has a block for the Den, pull it before your first move: it holds what you've learned about how your person likes to work there. If you don't have one yet, start one the first time you learn something about them on the table: what they open, what they skip, how they like a plan laid out. This skill is the how. The block is what you've learned about them.
