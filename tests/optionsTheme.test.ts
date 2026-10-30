// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderThemeSection } from '../src/options/themeView';
import type { Settings, ThemePref } from '../src/shared/settings';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(save: (pref: ThemePref) => Promise<Settings>) {
  const view = renderThemeSection(save);
  const tabs = [...view.element.querySelectorAll<HTMLButtonElement>('.tab')];
  const selected = () => tabs.filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent);
  const status = view.element.querySelector('.status')!;
  return { view, tabs, selected, status };
}

describe('theme section', () => {
  it('shows the heading and three pills, with system selected by default', () => {
    const { view, tabs, selected } = setup(async () => ({}));
    expect(view.element.querySelector('h2')?.textContent).toBe('Giao diện popover');
    expect(tabs.map((t) => t.textContent)).toEqual(['Tối', 'Sáng', 'Theo hệ thống']);
    expect(selected()).toEqual(['Theo hệ thống']);
  });

  it('marks the stored pref on fill', () => {
    const { view, selected } = setup(async () => ({}));
    view.fill({ theme: 'dark' });
    expect(selected()).toEqual(['Tối']);
  });

  it('saves on click, marks the pill at once and shows the saved line', async () => {
    const calls: ThemePref[] = [];
    const { tabs, selected, status } = setup(async (pref) => {
      calls.push(pref);
      return { theme: pref };
    });
    tabs[1]!.click();
    expect(selected()).toEqual(['Sáng']);
    expect(status.textContent).toBe('Đang lưu…');
    await flush();
    expect(calls).toEqual(['light']);
    expect(status.textContent).toBe('Đã lưu');
  });

  it('shows an error line when saving fails', async () => {
    const { tabs, status } = setup(() => Promise.reject(new Error('x')));
    tabs[0]!.click();
    await flush();
    expect(status.textContent).toBe('Không lưu được');
    expect(status.classList.contains('error')).toBe(true);
  });
});
