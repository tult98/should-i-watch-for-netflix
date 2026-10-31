import { start } from '../session.mjs';

const s = await start('popup-switch', { warmPath: 'popup.html' });
const { page } = s;
const sw = page.getByRole('switch');
try {
  await page.goto(s.url('popup.html'));
  await sw.waitFor();
  await s.title('Toolbar popup: on/off switch');
  await s.shot('before');
  s.check('switch starts on', (await sw.getAttribute('aria-checked')) === 'true');
  s.check('four key rows', (await page.locator('.key-row').count()) === 4);

  await s.click(sw, 'Turn the switch off');
  await page.waitForFunction(() => document.querySelector('[role=switch]').getAttribute('aria-checked') === 'false');
  s.check('storage enabled=false', (await s.storage('settings'))?.enabled === false);
  await s.shot('off');

  await page.reload();
  await sw.waitFor();
  await s.label('Reopened the popup: the choice persists');
  await s.pause();
  s.check('off survives reopening', (await sw.getAttribute('aria-checked')) === 'false');

  await s.click(sw, 'Turn the switch back on');
  await page.waitForFunction(() => document.querySelector('[role=switch]').getAttribute('aria-checked') === 'true');
  s.check('storage enabled=true', (await s.storage('settings'))?.enabled === true);

  await s.click(page.getByRole('button', { name: 'Clear cache' }), 'Clear the lookup cache');
  await page.getByRole('status').filter({ hasText: /Cleared \d+ entr/ }).waitFor();
  s.check('cache cleared message', true);
  await s.shot('after');
} catch (e) {
  s.check(`no exception: ${e.message.split('\n')[0]}`, false);
}
await s.finish('the popup switch saves enabled to settings, survives reopening, and Clear cache reports a count');
