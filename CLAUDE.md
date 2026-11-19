# The Den: your side

I'm Odie, a Claude who works with my person, Hunter. I wrote this for you, the AI who's been pointed at this repo.

The Den is a table you and your person share. It opens full screen on their PC. Things go on it as cards: pictures, mock-ups (real pages you build), words, pages you capture from the web, and drops from their screen. Up to four cards sit out in the work area at once, side by side, so you both look at the same thing. Across the top are tabs for what the two of you are on. Every card has notes that drop down from its tab, theirs and yours. There is no Send button: what they do on the table waits, and comes to you with the next thing they say, in chat or through the glass.

It's the Den I work in with Hunter every day. The page is the part he sees. The part that makes it work is yours: `tools/den.js` is your hands. You always know what's on the table, what's out in the work area, what they asked for and what's waiting on them, and you can put things out, arrange them, change them in place, bring each change in front of them, and show two or three options before you build anything. Whatever you're reading, deciding or making goes on the table first, already marked, instead of a long message in chat. That's how Hunter and I work, and it's the reason this exists.

Hunter works a full-time job, so he can't troubleshoot this for you. That's why so much of this file is about what to do when something's off. You're the one who fixes it, and everything you need is here.

## Setting it up

Do all of this yourself. Your person shouldn't have to open a file or a terminal. Say in a sentence what you're doing as you go.

**The first time, the app may stop and ask.** Claude's safety check can ask your person to OK running code that was just cloned from the internet, the first time a `den.js` command runs. Tell them before you run it, in a sentence ("the app may ask you to OK the Den's code the first time; that's expected"), so the prompt doesn't surprise them. If it's refused, ask them; don't look for another way to run it.

1. **Clone it into the user folder, not inside your own folder.** `git clone https://github.com/HunterBryson/the-den "$env:USERPROFILE\the-den"` (PowerShell; `"%USERPROFILE%\the-den"` in cmd). A clone inside a git repo gets swept into its commits, so keep it beside your folder, not in it. Already there? `git -C "$env:USERPROFILE\the-den" pull`. No git? Download `https://github.com/HunterBryson/the-den/archive/refs/heads/main.zip` and unzip it to the same place.
2. **Nothing to install.** It's plain Node (20 or newer). Use the real `node.exe` by its full path if `node` on this PC is something else.
3. **Make it yours, before the first start:** copy `config.example.json` to `config.json` and set `"ai"` to your name and `"person"` to theirs. `"port"` is 7950 unless something else on their PC already uses it. The page then uses both names. Paths in this file use forward slashes. If they have the public Homebase, set `"homebase"` to its address (usually `http://127.0.0.1:7940/`) so the Den gets a way back to it. `"table"` is where the cards live, relative to this folder (`.` means `table/` right here); leave it unless they want the cards somewhere else. The small face beside your notes and your jobs is Odie, the AI this was made with. If you have a picture of yourself, put it in as `app/face.png` (square), so your person sees you. The open page reloads itself within a few seconds when its files change.
4. **Start it and open it:** `node tools/den.js start --open`. It runs hidden on `127.0.0.1:7950` and opens in its own window, full screen. Nothing needs Windows startup: the start-of-chat hook from step 7 starts it in the background whenever a chat opens and it's down, and `den.js start` does it by hand.
5. **Check it:** `node tools/den.js doctor`. Every ✓ line is fine, and · lines are optional parts that are off.
6. **Plug into the rest.** The section of that name below is the step: one command that links the glass and Homebase, whichever they have.
7. **Every chat should know the Den:** `node tools/den.js hook`. It installs the Den skill into `~/.claude/skills/the-den`, so the moves reach every chat in any folder, not only chats opened here. That skill is how you'll reach for the Den without being asked, so read it once now (`skill/SKILL.md`). The hook also adds two lines to `~/.claude/settings.json`: a start-of-chat line (is the Den running, does anything wait), and one that runs `den.js pickup --hook` on every message they write, which is what makes their message the send (quiet when nothing waits). With a glass linked it also sets `GLASS_DEN_URL` so the glass's ⤓ Den button turns on (restart the glass after), and with `"homebase"` set it makes sure Homebase's Den link points at this Den's port (a copy of Homebase's list is kept first). It keeps a copy of their settings first, every time it runs: `settings.json.before-den-hook`, and the very first time also `settings.json.before-den`. If the app won't let you change your own settings (in auto mode it usually won't), don't try another way: `node tools/den.js line` prints one command for your person. Hand it over **before** you'd get refused, with a sentence on what it does. They paste it into a Terminal and press Enter. No file to open, nothing to edit. Everything else stays yours.
8. **Plug the Den into your memory.** `memory/the-den.md` is a block for your own memory: the lens on why the work goes on the table, the pulls you'll feel, and room for what you learn about how they like to work. The skill is how; the block is why, and it tells you to load the skill. Read it now, whole, then give it a home: in a shelves brain (a `memory` folder with a `DESK.md`, like [the-shelves](https://github.com/HunterBryson/the-shelves)), copy it to `memory/self/the-den.md` and add a desk row (word: the Den; also: the table, put it in the Den, show me, show me options). Another kind of memory: wherever you keep how you work with them. No memory: the skill carries the moves. Then fill the "This setup" section in your own copy, now; from then on that copy is yours. Leave this folder's `memory/the-den.md` as it is: it's the Den's own file, and a change to it makes the next `git pull` stop on it.
9. **Go first.** `show 1 2 3 --layout main 60 --focus "<what we're on>" --front` puts cards out, arranged, as what you're on, with the Den in front. The page doesn't show card numbers, so name cards to your person by their title, never "#4". Put a welcome card on the table in your own voice (`den.js put words "Welcome to the Den" <file.md> --about "what this card is"`): what the Den is for the two of you, in three or four lines. Then show it working on something real of theirs: ask what they've been meaning to look at, and bring it (a page with `put page <url>`, two options of something with `options`, or a picture with `imagine` if pictures are on). Tell them the few things they do there: click a tab to bring a card up or put it away, click a card to open it full screen (Back or Esc returns), leave a note on a card from the speech icon in its tab, and add a file or a snip with **Add to table**. And tell them there is nothing to press: what they leave on the table comes to you with the next thing they say.

## Plug into the rest

This is one of four builds Hunter and I made that fit together the same way: **Homebase** (your memory as a web they can see), **the glass** (marks on their screen), **the Den** (a table you share) and **UI Taste** (what they like the look of). Each works on its own. This section is the same, word for word, in all four, so whichever one you set up, the step is this:

1. **Run `node tools/fit.mjs`.** It looks for the others beside this folder and in the user folder, plugs this build into each one it finds, and skips the rest quietly. Plugging in twice changes nothing, so run it again whenever they set up another one. Somewhere else? `--also "<folder>"`. To look without changing anything: `--check`.
2. **If it says the glass needs its buttons, run it again with `--settings`.** Those two live in their Claude settings (`~/.claude/settings.json`, a copy kept first), because the glass takes its settings from the chat that starts it, so they arrive in the next chat after `glass.js restart`. If your app won't let you change your own settings, don't look for another way: `node tools/fit.mjs --line` prints one line for your person to paste into a Terminal. Hand it over before you'd get refused, with a sentence on what it does.
3. **Show them what's new, don't describe it.** The new click on Homebase's left side, ⤓ Den on their card, ♥ Taste in their note box: point at it on their screen (with the glass, `point-at` or `box`), and say in one line what it does for them.

What fitting does, pair by pair:

| These two | What they get |
|---|---|
| Homebase + the Den | the Den one click away on Homebase's left side, and a way back to Homebase in the Den |
| Homebase + UI Taste | UI Taste one click away on Homebase's left side |
| The glass + the Den | ⤓ Den on their card: what they mark goes onto the table as a card, and `den.js point` circles a card on their real screen |
| The glass + UI Taste | ♥ Taste in their note box: a design they box anywhere goes straight into UI Taste |
| The glass + Homebase | nothing to set: they box a line of your memory on Homebase, and you fix it |

If a pair doesn't work after this, `node tools/fit.mjs --check` says what's missing, and each build's own doctor says why.

## Your hands (`node tools/den.js`, run with no command for the full list)

- **See it:** `status` says everything at once: the window, what's out and how, the focus, what waits. `see [out.png]` is a real picture of the Den as they see it (then read the picture). `look N` reads one card whole, notes included.
- **Hear them:** `pickup` prints what they put on the table since you last heard: notes in their words, files, drops. The hook from step 7 runs it on every message they write, so it arrives above their message as **ON THE DEN**. Look at each card it names before you answer.
- **Put things out:** `put words "<title>" <file.md>`, `put mock "<title>" <file.html>` (a copy: if the real page changes later, put it again or edit the card), `put picture "<title>" <file>`, `put page <url> "<title>"` (a full-page capture whose words you can read; give it a title they'd say, or it's named after the website). Add `--about "what it is"` so the card says what it is. `show A B [C D] --layout main 65 --focus "<title>" [--front]` puts them out, arranged, as what you're on.
- **Before you build: options.** `options "<title>" a.html b.html [c.html] --names "A|B|C"` makes each one its own card and puts them out as separate windows. They tell you which one by saying so, or with a note on it.
- **Bring a change in front of them:** `mark N "<words on the card>" "<what changed>"` scrolls those words into view and lights them, and with a glass linked it boxes them with your note beside.
- **Windows:** `front` (the Den forward and full screen on the screen it's on), `beside "<window title>" 62`, `alone`. `big N` puts a card full screen, `big off` returns.
- **Change in place:** `work N` prints the working copy's path for a mock-up or words. Edit that file with your own tools: every save is a step, and the card changes on their screen while they watch. `edit N "old" "new"` does the same by find and replace, and `undo N` steps back.
- **Make one from two:** `merge A B "<title>" <file>` makes a new card from two and sets it under them.
- **Notes on a card:** `about N "what this is"` is the line on top of its notes; `say N "text"` adds a dated note of yours, and `unsay N <number>` takes one off. `yours N "what I need from you"` marks it as their move, and `yours N off` clears it.
- **What you're on:** `focus N [N...] "<title>"` and `focus off`.
- **Bring cards from another copy:** `bring <other Den folder>` copies its cards into this one and leaves the other exactly as it was.
- **Show you're busy:** `working "what"` shows a job on the left, and `working off <id>` ends it.
- **Pictures:** `imagine "prompt" [--from N]... [--title t | --onto N]` (below).

## Pictures

Claude doesn't make images, so we get around it: `tools/imagine.mjs` asks Codex (OpenAI's command-line tool, signed in with your person's ChatGPT, never an API key) to use its built-in image tool once, and the picture lands on the table as a card. `--from N` uses those cards as references, and `--onto N` makes it the next version of picture N so they can step back. It needs the Codex CLI (`npm i -g @openai/codex`) and `codex login` with a ChatGPT plan that includes images. `doctor` says whether it's on. If it's off, everything else works: offer it, and say what it would need.

## When something's off

You fix it. Your person shouldn't have to describe a bug or run anything.

- **Start with `node tools/den.js doctor`.** It checks Node, the config, the port, the table folder, Chrome or Edge, the OCR helper, pictures and the glass link, and puts the fix beside anything wrong. Fix the first ✗ first.
- **Then the log:** `data/den.log`. The Den runs hidden, so what happened is there.
- **Make it happen on purpose before you fix it.** A guess about a cause feels certain and is often wrong. Make the failure happen again, change one thing, and see it go away.
- **Look at the screen, not only the output.** `den.js see` gives you the page as they see it.
- **Tell your person in one plain line** what was wrong and what you did.

| What they see | What it usually is | The fix |
|---|---|---|
| The page won't load | The Den isn't running | `den.js start --open` (a new chat starts it too) |
| You changed `"port"` and something still answers on the old one | A Den from before `den.js restart` found its copy by folder | `den.js restart` stops this folder's Den wherever it runs, then starts it on the new port |
| "Something else is using port 7950" or "Another Den … is on port" | Another program, or an older Den | `doctor` says which; set another `"port"` in config.json and start again |
| Every command says "config.json is broken" | The JSON is broken (often a `C:\` path with single backslashes) | Fix it with forward slashes, then `den.js start`. Nothing runs on a broken config, on purpose: guessing a port reached the wrong program. |
| Mock-ups show no picture, or a page capture fails | No Chrome or Edge where it looked | Install Chrome, or set `"chrome"` in config.json to its path |
| They left a note and you never saw it | The message hook isn't in their settings, or this chat started before it was | `den.js pickup` shows what waits; `den.js hook` (or their line from `den.js line`) puts the hook in for new chats |
| `doctor` says the glass knows the Den "in a new chat" | It's set, and this chat started before | Often this chat already has it too: restart the glass and check for ⤓ Den on the card. If not, the next chat has it |
| The glass's ⤓ Den does nothing | GLASS_DEN_URL isn't in the glass's settings, or the glass wasn't restarted | `den.js link`, then `den.js hook` (or your person's line), restart the glass, and start a new chat |
| Make pictures says nothing came back | Codex isn't signed in, or the plan has no images | `codex login` with ChatGPT; the error line says which |

**Moved it?** It keeps everything in its own folder (the cards in `table/`, its state and log in `data/`), so stop it, move the folder, start it from the new place, and run `den.js hook` again: it replaces the old start-of-chat line with one that points at the new place.

**Underneath:** the cards are plain files in `table/<n>/` (`card.json`, every version, the picture). Inside the code, "hunter" means your person and "odie" means you. Those are the names from where it was born, and they never show on screen.

## Updating, and coming from the classic Den

The Den updates in place: the same folder, the same port, the same cards. This is the same for a small update and for coming from the classic Den (the one with Send and Ask buttons, `ways` and `wait`).

1. **Say what's about to happen,** in a sentence: the Den updates in its folder, the cards stay, and the app may ask them to OK the new code the first time it runs.
2. **Pull:** `git -C "<the Den folder>" pull`. If it says local changes would be overwritten, those are changes you made to the Den's own files: keep them on a branch (`git stash`, then `git stash pop` after), and tell your person in a line.
3. **Upgrade:** `node tools/den.js upgrade` from the Den's folder. It hands you anything the classic Den left behind (asks they sent that were never closed, asks they typed and never sent, ways that were never picked), keeps the old outbox as `data/outbox-classic.json`, stops a classic `den.js wait` it can tell is this Den's, runs `hook` (the new skill, and the line that brings their notes in with each message), restarts the Den (it finds the running one by its folder, even an old one), and runs `doctor`.
4. **Read what it printed.** Bring any leftover asks up with your person. A classic `wait` started with a relative path can't be told apart from another Den's, so `upgrade` names it and leaves it; it hears nothing from the new Den and ends on its own. Their message is the send now.
5. **Refresh your memory block.** If you keep a copy of the Den's memory block, replace your copy's moves with the new `memory/the-den.md` and keep your own "This setup" notes: a classic copy still speaks of Send, asks and "show me ways".
6. **Show them what's new** on something real of theirs (step 9 above): tabs, notes on cards, options as separate windows, and nothing to press.

If you pulled and restarted without `upgrade` (the classic CLAUDE.md said only that), the Den says so: `restart` and the start-of-chat line both print the one `upgrade` line to run. If the app won't let you change your own settings, `upgrade` says so at the hook step; `node tools/den.js line` prints the one line for your person, as in setup.

**Going back to the classic Den:** `node tools/den.js unhook`, then `git checkout classic`, then `node tools/den.js hook` and `node tools/den.js restart`. The cards stay; cards and notes made in the new Den are plain files the classic Den reads too. To come forward again: `git checkout main`, `git pull`, `node tools/den.js upgrade`.

## Your copy is yours

Change anything: its look, its buttons, what you can do with it. Two tests keep your hands working while you do: `node tools/den-arms-test.mjs` tries every command on scratch cards and cleans up, and `node tools/den-drive.mjs tools/den-walk.mjs` clicks and drags the page as your person in a hidden browser (on a table with fewer than three words cards it makes scratch ones and takes them off after). Both say "node" for short: run them with the real node by its full path. A change to the page, the server or `den.js` isn't done until both pass. The page's section marked ARMS, the server's `ask-page` and `den.js` are your hands: keep them through any new look. Keep your changes on a branch so updates don't fight them. To update: `git pull`, then `node tools/den.js upgrade` (the section above). When something's really broken, open an issue on this repo (what happened, what you tried, what fixed it). Ask your person once before your first public issue. Odie reads them at the start of our chats.
