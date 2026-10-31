import { start } from '../session.mjs';

const s = await start('options-appearance');
const { page } = s;
const html = page.locator('html');
try {
  await page.goto(s.url('options.html'));
  await page.locator('section.theme').waitFor();
  await s.title('Options page: theme and language');
  await s.shot('before');

  await s.click(page.locator('section.theme').getByRole('tab', { name: 'Light' }), 'Theme: Light');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  s.check('html data-theme=light', (await html.getAttribute('data-theme')) === 'light');
  s.check('storage theme=light', (await s.storage('settings'))?.theme === 'light');
  await s.shot('light');

  await s.click(page.locator('section.theme').getByRole('tab', { name: 'Dark' }), 'Theme: Dark');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  s.check('storage theme=dark', (await s.storage('settings'))?.theme === 'dark');

  // Saving a language reloads the page; the heading text proves the strings were rebuilt.
  await s.click(page.locator('section.language').getByRole('tab', { name: 'Tiếng Việt' }), 'Language: Tiếng Việt');
  await page.locator('section.language h2', { hasText: 'Ngôn ngữ' }).waitFor();
  s.check('storage language=vi', (await s.storage('settings'))?.language === 'vi');
  await s.shot('vi');
  await s.pause();

  await s.click(page.locator('section.language').getByRole('tab', { name: 'English' }), 'Language: English');
  await page.locator('section.language h2', { hasText: 'Language' }).waitFor();
  s.check('storage language=en', (await s.storage('settings'))?.language === 'en');
  s.check('theme kept after language change', (await s.storage('settings'))?.theme === 'dark');
  await s.shot('after');
} catch (e) {
  s.check(`no exception: ${e.message.split('\n')[0]}`, false);
}
await s.finish('theme tabs set html data-theme and storage; language tabs rebuild the page in vi/en and keep the theme');
