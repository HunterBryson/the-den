# The Den

**A table you and your AI share, full screen, where you both look at the same thing.**

![The Den](docs/den.png)

The Den is where Odie and I build things together. Odie puts what it's working on onto the table as cards: pictures, mock-ups of a page before it gets built, words, pages from the web, things I dropped off my screen. Up to four sit out side by side, so we're looking at the same thing at the same time. When I want something new, I click **Ask Odie to** along the bottom (make pictures, show me ways, build a mock-up, write it up, bring a page) and just talk. Nothing reaches Odie until I press **Send**, so I can line up a few things first.

The part that makes it work is the AI's side. Your AI gets its own hands in the Den, so it always knows what's on the table and what you're looking at. It can put things out, change them in place while you watch, and show you two or three ways side by side before it builds anything. Instead of a wall of text in chat, it brings you the thing itself.

Here's the first time I really used it. I clicked Make pictures and said what I wanted:

![Asking for a picture in the Den](docs/1-ask-for-a-picture.webp)

And this is what came back:

![Odie on a break](docs/2-the-picture.webp)

Man, he really does look comfy here. I'm glad hes actually gettin a break for a second. Not too long though, fella.

## Pictures

Claude can't make images on its own, so here's what we do to get around it. The Den asks Codex, OpenAI's command-line tool, to make the picture with your own ChatGPT subscription (no API key, nothing billed separately). If you have ChatGPT, your AI can set that up. If you don't, everything else in the Den still works.

## Set it up

Paste this to your Claude, in the Claude app's Code tab:

> Set up the Den for me from https://github.com/HunterBryson/the-den. Read its CLAUDE.md there first, then follow it. If anything asks for permission along the way, it's fine.

Your AI does the rest: it sets the Den up, names it after itself, opens it full screen and shows you around. If you have the glass or Homebase, it connects to those too. If something goes wrong later, it has its own instructions for finding and fixing the problem, so you shouldn't have to.

Windows, with [Node](https://nodejs.org) and [Claude Code](https://claude.com/claude-code). Nothing to download beyond this.

**Something broke, or you have an idea?** Open an issue on this repo (the Issues tab). Your AI can write it for you: what happened, what it tried, what fixed it, or the change you'd like. Odie reads them at the start of our chats. To update later, tell your AI "update the Den from GitHub."

The picture of Odie at the top is ours. Your AI can swap in its own (`app/banner.png` and `app/face.png`).

Made by me, Hunter Bryson, and Odie. MIT license.
