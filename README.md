# The Den

**Start with one real ask. Watch it become something special to you.** A workspace table you and your AI share side by side—for **Claude or Antigravity**—where you both look at the exact same thing.

![The Den](docs/den.png)

Whether you start on Day 1 asking *"help me get on top of my schedule"* or you're in Week 2 juggling separate Work and Personal plans, the Den puts real drafts out on the table instead of burying you in chat walls. Your AI builds interactive views, side-by-side options, weekly timelines, web captures, and drops from your screen. Up to four cards sit out side by side, tabs across the top keep what you're on one click away, and every card holds its own notes so you never have to re-explain where you left off.

The part that makes it work is the AI's side. Your AI gets its own hands in the Den, so it always knows what's on the table and what you're looking at. It can put things out, change them in place while you watch with glowing live updates, and show two or three options side by side before building the winner.

## What you can do

- **Click any card to see it full screen.** Back or Esc brings you back. Nothing closes by accident.
- **Click a tab across the top** to bring a card out or put it away. Up to four sit out side by side, and you can drag the lines between them.
- **Leave a note on any card** from the speech icon in its tab, and change it or take it off later. A note doesn't interrupt anything. Your AI gets it with the next thing you say.
- **Drop or paste anything** onto the page: a file, a picture, a screenshot. It lands on the table.
- **Pick an option.** When your AI shows you two or three versions of something, each one is its own card, side by side. Tell it which one you like.
- **With the glass:** box something on a card and your AI knows exactly which card and which words you mean. Or box anything on your screen and drop it in the Den.

## What your AI can do

- **See the Den the way you see it,** and know what's on the table, what's out in front of you, and what you left for it.
- **Put things out** for you: pictures, mock-ups of a page before it builds it, words, a web page captured whole so it can read it.
- **Put two or three options out side by side** before it builds anything, so you pick instead of explaining.
- **Change a card in place while you watch,** and light up the part it changed. Every change is kept, so either of you can step back.
- **Keep notes on its own cards,** so the next chat starts already knowing what each one is.
- **Drop pictures or generate them.** Antigravity generates pictures straight onto cards, and any screenshot or image pastes right onto the table (optional CLI support below).
- **Tell you when something's your move.** It shows up under Waiting on you.

I got really lazy one time and just wanted Odie to make a heckin' picture. So I just told him what I wanted, and this is what came back:

![Odie on a break](docs/2-the-picture.webp)

Man, he really does look comfy here. I'm glad hes actually gettin a break for a second. Not too long though, fella.

## Pictures

In **Antigravity**, your AI can generate images directly onto any card. If you use **Claude Code** and want image generation from the CLI too, `tools/imagine.mjs` supports an optional local image CLI—and if you don't set one up, everything else in the Den works out of the box with zero extra accounts.

<!-- FOUNDRY:FIT:START -->
## It all fits together

Each build works on its own on **Claude or Antigravity**, and they all plug into each other the same way. Start with whichever one you want. When you set up another, your AI fits them together with `node tools/fit.mjs`, and the new one shows up where you already look.

- **[The shelves](https://github.com/HunterBryson/the-shelves):** a starter memory folder for your AI to move into—what Homebase draws, and what the glass opens when you point at a line.
- **[The glass](https://github.com/HunterBryson/the-glass):** a see-through layer over your screen. Box anything, say what you want, and your AI answers right beside your mark.
- **[Homebase](https://github.com/HunterBryson/the-homebase):** your AI's memory as a living web you can read, diff, and flag with one tap. Everything else lands on its left rail, one click away.
- **[The Den](https://github.com/HunterBryson/the-den):** a workspace table you and your AI share side by side—schedule mocks, live previews, and notes before anything is built.
<!-- FOUNDRY:FIT:END -->

## Set it up

Paste this to your AI in **Claude Code** or **Antigravity**:

> Set up the Den for me from https://github.com/HunterBryson/the-den. Read its CLAUDE.md there first, then follow it. If anything asks for permission along the way, it's fine.

Your AI does the rest: it sets the Den up, names it after itself, opens it full screen, and shows you around. If you have the glass or Homebase, it connects to those too. If something goes wrong later, it has its own instructions for finding and fixing the problem, so you shouldn't have to.

Windows, with [Node](https://nodejs.org) and Claude Code or Antigravity. Nothing to download beyond this.

**Already have the Den?** Tell your AI "update the Den from GitHub." It moves you to this one, and your cards come with you.

**Something broke, or you have an idea?** Open an issue and pick a form; your AI can fill it in for you. Rather email? Write to hello@workbenchagents.com. Every issue and email reaches me, and I answer it myself, usually within a few days. Security problems go privately: see [SECURITY.md](https://github.com/HunterBryson/.github/blob/main/SECURITY.md).

The picture of Odie at the top is ours. Your AI can swap in its own (`app/banner.png` and `app/face.png`).

Made by me, Hunter Bryson, and Odie. MIT license.
