import { start } from '../session.mjs';

const s = await start('options-thresholds');
const { page } = s;
const mal = page.locator('section.thresholds-mal');
const score = page.locator('#th-mal-highlyScore');
try {
  await page.goto(s.url('options.html'));
  await mal.waitFor();
  await s.title('Options page: MAL badge thresholds');
  s.check('defaults shown (8)', Number(await score.inputValue()) === 8);

  await s.type(score, '8.5', 'Set "Highly recommended" score to 8.5');
  await s.click(mal.getByRole('button', { name: 'Save thresholds' }), 'Save thresholds');
  await mal.getByRole('status').filter({ hasText: 'Saved' }).waitFor();
  s.check('storage mal.highly.score=8.5', (await s.storage('settings'))?.thresholds?.mal?.highly?.score === 8.5);
  await s.shot('saved');

  await s.type(score, '11', 'Type an out-of-range score (11)');
  await s.click(mal.getByRole('button', { name: 'Save thresholds' }), 'Save thresholds again');
  await page.locator('#th-mal-errors p').first().waitFor();
  s.check('field marked aria-invalid', (await score.getAttribute('aria-invalid')) === 'true');
  s.check('error names the 0-10 range', /0 and 10/.test(await page.locator('#th-mal-errors').innerText()));
  s.check('storage still 8.5 after rejected save', (await s.storage('settings'))?.thresholds?.mal?.highly?.score === 8.5);
  await s.shot('invalid');

  await s.click(mal.getByRole('button', { name: 'Reset to defaults' }), 'Reset to defaults');
  await mal.getByRole('status').filter({ hasText: 'Reset to defaults' }).waitFor();
  s.check('input back to 8', Number(await score.inputValue()) === 8);
  s.check('storage mal.highly.score=8', (await s.storage('settings'))?.thresholds?.mal?.highly?.score === 8);
  s.check('error cleared', (await score.getAttribute('aria-invalid')) === null);
} catch (e) {
  s.check(`no exception: ${e.message.split('\n')[0]}`, false);
}
await s.finish('a valid threshold saves, an out-of-range one is rejected with an error and not stored, Reset restores the default');
