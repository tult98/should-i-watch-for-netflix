import { start } from '../session.mjs';

const s = await start('options-ai-provider');
const { page } = s;
const ai = page.locator('section.ai');
try {
  await page.goto(s.url('options.html'));
  await ai.waitFor();
  await s.title('Options page: AI provider');
  await s.click(page.locator('#ai-provider'), 'Open the provider list');
  s.check('listbox open with 8 providers', (await page.locator('[data-provider]').count()) === 8 && (await page.locator('#ai-provider').getAttribute('aria-expanded')) === 'true');
  await s.shot('list');

  await s.click(page.locator('[data-provider=openai]'), 'Pick OpenAI');
  await ai.locator('summary').click();
  s.check('base URL filled with the OpenAI preset', (await page.locator('#ai-base-url').inputValue()).startsWith('https://api.openai.com/'));
  s.check('model filled', (await page.locator('#ai-model').inputValue()).length > 0);
  s.check('permission note names the host', /api\.openai\.com/.test(await ai.locator('.info').innerText()));
  await s.shot('openai');

  await s.click(page.locator('#ai-provider'), 'Back to DeepSeek');
  await s.click(page.locator('[data-provider=deepseek]'), 'Pick DeepSeek (already permitted, so saving needs no prompt)');
  s.check('DeepSeek base URL restored', (await page.locator('#ai-base-url').inputValue()).startsWith('https://api.deepseek.com/'));
  await s.type(page.locator('#ai-key'), 'verify-not-a-real-key', 'Type a placeholder key');
  await s.click(ai.getByRole('button', { name: 'Save AI settings' }), 'Save AI settings');
  await ai.getByRole('status').filter({ hasText: 'Saved' }).waitFor();
  const saved = await s.storage('settings');
  s.check('storage aiProvider=deepseek with a key', (saved?.aiProvider ?? 'deepseek') === 'deepseek' && saved?.aiProfiles?.deepseek?.key === 'verify-not-a-real-key');
  await s.shot('saved');
} catch (e) {
  s.check(`no exception: ${e.message.split('\n')[0]}`, false);
}
await s.finish('the provider list switches presets, shows the host permission note, and a DeepSeek save stores the profile');
