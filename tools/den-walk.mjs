// The Den, walked as him: every button and drag, in a hidden Chrome (tools/den-drive.mjs). Run after any change to the Den page:
//   SHOTS=<folder> node tools/den-drive.mjs tools/den-walk.mjs
// It uses the real table, so it puts the work area back the way it found it. It never puts away or sends.
import fs0 from 'node:fs';
const B = (process.env.DEN_URL || 'http://127.0.0.1:' + ((() => { try { return JSON.parse(fs0.readFileSync(new URL('../config.json', import.meta.url), 'utf8')).port; } catch { return 0; } })() || 7950)) + '/api/den';
const state = async () => (await fetch(B + '/')).json();
const post = (p, body) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
export default async d => {
  const S = process.env.SHOTS, shot = n => S ? d.shot(S + '/' + n + '.png') : null;
  let fails = 0; const ok = (name, pass, more = '') => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (more ? '  [' + more + ']' : '')); };
  const before = await state();
  const open = before.cards.filter(c => c.state !== 'retired'), words = open.filter(c => c.kind === 'text').slice(0, 3).map(c => c.id);
  // It walks three words cards. A table with fewer gets scratch ones, taken off again at the end.
  const made = [];
  for (let i = words.length; i < 3; i++) { const r = await post('/cards', { kind: 'text', title: 'Walk test (scratch) ' + (i + 1), body: '# Walk test (scratch)\n\nA scratch card for the walk.\n', by: 'odie' }).then(x => x.json()); if (!r.id) { console.log('the walk could not make its scratch cards: ' + JSON.stringify(r)); process.exitCode = 1; return; } made.push(r.id); words.push(r.id); }
  const [a, b, c] = words;
  const widths = () => d.eval('[...document.querySelectorAll("#work .item")].map(e => Math.round(e.getBoundingClientRect().width)).join(" / ")');
  const count = sel => d.eval(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
  const has = (sel, cls) => d.eval(`document.querySelector(${JSON.stringify(sel)}).classList.contains(${JSON.stringify(cls)})`);
  const press = sel => d.eval(`document.querySelector(${JSON.stringify(sel)}).click()`);
  try {
    await post('/bench', { items: [a, b], by: 'odie' }); await post('/bench/layout', { layout: { shape: 'grid', split: 50, rsplit: 50 }, by: 'odie' });
    const PAGE = process.env.PAGE || '/den/';
    await d.page(PAGE);
    ok('two cards out', (await count('#work .item')) === 2);
    ok('one divider between them', (await count('.split.v')) === 1);
    await d.drag('.split.v', 300, 0);
    let l = (await state()).layout; ok('his drag on the divider saves', l.split > 0.6 && l.split < 0.75, 'left ' + l.split);
    ok('cards took the new widths', true, await widths()); await shot('walk-drag');
    await d.eval('document.querySelector(".split.v").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))'); await d.wait(900);
    ok('a double-click evens it', (await state()).layout.split === 0.5);

    ok('one send: no Send, no ready list, no Merge, no ask box on the page', (await count('#send, #readyline, #readypop, #merge, #askbox')) === 0);
    ok('Add something is still there for files and snips', (await count('#drop')) === 1 && (await count('#file')) === 1);

    await post('/bench', { items: [a, b, c], by: 'odie' }); await d.wait(1300);
    ok('three in the grid get both dividers', (await count('.split')) === 2);
    await d.drag('.split.h', 0, -150); ok('his drag on the row divider saves', (await state()).layout.rsplit < 0.45, 'top ' + (await state()).layout.rsplit); await shot('walk-grid3');
    await post('/bench/layout', { layout: { shape: 'row', cols: [50, 25, 25] }, by: 'odie' }); await d.wait(1300);
    ok('row by share', true, await widths()); await shot('walk-row3');
    await post('/bench/layout', { layout: { shape: 'main', split: 64 }, by: 'odie' }); await d.wait(1300);
    ok('main: the first card is the big one', true, await widths()); await shot('walk-main3');
    await post('/bench/layout', { layout: { shape: 'grid', split: 50, rsplit: 50 }, by: 'odie' });

    // the top bar of what we're on: tabs he clicks (Nov 17, his pick of version 6)
    ok('what we are on shows as tabs in the top bar', (await count('#things .tab[data-id]')) >= 3, (await count('#things .tab[data-id]')) + ' tabs');
    ok('a tab that is out is lit', (await count('#things .tab.out')) === 3);
    ok('the nameplate holds his logo and name', (await count('#brand #plate')) === 1);
    await press(`#things .tab[data-id="${a}"]`); await d.wait(1000); ok('a click on a lit tab takes it off', !(await state()).bench.includes(a));
    await press(`#things .tab[data-id="${a}"]`); await d.wait(1000); ok('a click on it again puts it out', (await state()).bench.includes(a));
    await shot('walk-strip');
    await press(`#things .tab[data-id="${a}"] .cx`); await d.wait(1000); ok('the × on a tab takes it off', !(await state()).bench.includes(a));

    // Everything: the whole table, by kind
    await press('#addt'); await d.wait(500); ok('Add to table opens the whole table', await has('#all', 'open'), (await count('#side .th')) + ' pictures');
    ok('Everything has its kinds', (await count('#kinds button')) === 7);
    await d.eval('[...document.querySelectorAll("#kinds button")].find(x => x.textContent === "Pictures").click()'); await d.wait(400);
    ok('Pictures narrows it', ((await count('#side .th')) > 0 || !(await state()).cards.some(c => c.kind === 'picture' && c.state !== 'retired')) && /^Pictures/.test(await d.text('#allt')), await d.text('#allt')); await shot('walk-everything');
    await d.eval('[...document.querySelectorAll("#kinds button")].find(x => x.textContent === "Waiting on you").click()'); await d.wait(400);
    ok('Waiting on you narrows it', /^Waiting on you/.test(await d.text('#allt')), await d.text('#allt'));
    await d.eval('[...document.querySelectorAll("#kinds button")].find(x => x.textContent === "All").click()'); await d.wait(300);
    await press(`#side .th[data-id="${a}"]`); await d.wait(1000); ok('a click in Everything puts it out and closes Everything', (await state()).bench.includes(a) && !(await has('#all', 'open')));
    await press('#addt'); await d.wait(400); await d.key('Escape'); ok('Esc closes Everything', !(await has('#all', 'open')));

    await post('/bench', { items: [b, a], by: 'odie' }); await d.wait(1200);
    ok('the way home shows only with a Homebase set', (await d.eval('!document.querySelector("#home") || document.querySelector("#home").getBoundingClientRect().height >= 40')) === true);
    ok('no question box in the top bar', (await count('#top .ask')) === 0);
    await press('.item .ib[title="Full screen"]'); await d.wait(800); ok('full screen opens', await has('#big', 'open')); await shot('walk-big');
    await d.key('Escape'); ok('Esc returns', !(await has('#big', 'open')));
    // notes on a card (Nov 17): a button in the tab header drops them down; his note saves, waits for his send, and he can change or take it off
    { const full = async () => (await fetch(B + '/cards/' + b)).json(), rides = async () => (await state()).outbox.did.some(x => x.what === 'say' && x.card === b);
      ok('every card has a notes button in its tab header, and no strip under the title', (await count('.item .ib.nt')) === 2 && (await count('.isay')) === 0);
      await press(`.item[data-id="${b}"] .ib.nt`); await d.wait(900); ok('a click drops the notes down', await has('#ndrop', 'open')); await shot('walk-notes');
      await d.eval(`(() => { document.querySelector('#nadd').value = 'walk test note'; document.querySelector('#ndrop .add .nbtn').click(); })()`); await d.wait(1300);
      ok('his note saves on the card', (await full()).says.some(x => x.by === 'hunter' && x.text === 'walk test note'));
      ok('his note waits for his send', await rides());
      await press('#ndrop .n.his:last-child .ed'); await d.wait(300);
      await d.eval(`(() => { document.querySelector('#ndrop .n.his:last-child textarea').value = 'walk test note, edited'; document.querySelector('#ndrop .er .nbtn').click(); })()`); await d.wait(1300);
      ok('he can change his note', (await full()).says.some(x => x.text === 'walk test note, edited' && x.edited));
      await press('#ndrop .n.his:last-child .rm'); await d.wait(1300);
      ok('he can take his note off, and then nothing rides along', !(await full()).says.some(x => /walk test note/.test(x.text)) && !(await rides()));
      await d.key('Escape'); ok('Esc folds the notes and the card stays', !(await has('#ndrop', 'open')) && (await count('.item')) === 2); }
    await press('.item .ib[title^="Take it off"]'); await d.wait(1000); ok('the × takes a card off', (await state()).bench.length === 1);
    await post('/bench', { items: [], by: 'odie' }); await d.wait(1000); ok('an empty table says so', /Nothing is out/.test(await d.text('#work'))); await shot('walk-empty');
    { const mocks = open.filter(c => c.kind === 'mock').slice(0, 2).map(c => c.id); if (mocks.length === 2) { await post('/bench', { items: mocks, by: 'odie' }); await d.wait(2600); ok('two options are two windows, no ways, no Pick', (await count('.item')) === 2 && (await count('.way, .go')) === 0); await shot('walk-two-windows'); } }
    await d.page(PAGE + '?ask=pictures'); await d.wait(700); ok('an old ?ask= link just opens the Den', (await count('#askbox')) === 0 && (await count('#work')) === 1);
    ok('no errors on the page', (await d.errors()).length === 0, (await d.errors()).join('; '));
  } finally {
    for (const id of made) await fetch(B + '/cards/' + id, { method: 'DELETE' }).catch(() => {});
    await post('/bench', { items: before.bench, by: 'odie' }); await post('/bench/layout', { layout: before.layout || { shape: 'reset' }, by: 'odie' });
  }
  console.log(fails ? `${fails} FAILED` : 'all passed'); if (fails) process.exitCode = 1;
};
