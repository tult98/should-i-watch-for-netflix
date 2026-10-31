// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderLanguageSection } from '../src/options/languageView';
import type { LanguagePref, Settings } from '../src/shared/settings';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(save: (pref: LanguagePref) => Promise<Settings>) {
  const view = renderLanguageSection(save);
  const tabs = [...view.element.querySelectorAll<HTMLButtonElement>('.tab')];
  const selected = () => tabs.filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent);
  const status = view.element.querySelector('.status')!;
  return { view, tabs, selected, status };
}

describe('language section', () => {
  it('shows the heading and three pills, with auto selected by default', () => {
    const { view, tabs, selected } = setup(async () => ({}));
    expect(view.element.querySelector('h2')?.textContent).toBe('Ngôn ngữ');
    expect(tabs.map((t) => t.textContent)).toEqual(['Tự động', 'Tiếng Việt', 'English']);
    expect(selected()).toEqual(['Tự động']);
  });

  it('marks the stored pref on fill', () => {
    const { view, selected } = setup(async () => ({}));
    view.fill({ language: 'en' });
    expect(selected()).toEqual(['English']);
  });

  it('saves on click, marks the pill at once and shows the saved line', async () => {
    const calls: LanguagePref[] = [];
    const { tabs, selected, status } = setup(async (pref) => {
      calls.push(pref);
      return { language: pref };
    });
    tabs[2]!.click();
    expect(selected()).toEqual(['English']);
    expect(status.textContent).toBe('Đang lưu…');
    await flush();
    expect(calls).toEqual(['en']);
    expect(status.textContent).toBe('Đã lưu');
  });

  it('shows an error line when saving fails', async () => {
    const { tabs, status } = setup(() => Promise.reject(new Error('x')));
    tabs[1]!.click();
    await flush();
    expect(status.textContent).toBe('Không lưu được');
    expect(status.classList.contains('error')).toBe(true);
  });
});
