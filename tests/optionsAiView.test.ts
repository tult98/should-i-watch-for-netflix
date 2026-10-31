// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyValueStore } from '../src/background/cache';
import type { AiDraft, ConnectionResult } from '../src/options/ai';
import { renderAiSection } from '../src/options/aiView';
import { saveWithPermission, type SaveResult } from '../src/options/save';
import { SETTINGS_KEY, loadSettings, type Settings } from '../src/shared/settings';

const flush = () => new Promise((r) => setTimeout(r, 0));

const DEEPSEEK = { format: 'openai', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', key: 'ds-key' } as const;
const OPENAI = { format: 'openai', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4.1', key: 'oa-key' } as const;
const SAVED: Settings = { aiProvider: 'deepseek', aiProfiles: { deepseek: DEEPSEEK, openai: OPENAI } };

function setup(settings: Settings = SAVED, deps: Partial<Parameters<typeof renderAiSection>[0]> = {}) {
  const save = vi.fn<(d: AiDraft) => Promise<SaveResult>>(async () => ({ status: 'refused', reason: 'denied' }));
  const test = vi.fn<(d: AiDraft) => Promise<ConnectionResult>>(async () => ({ ok: true, ms: 640 }));
  const view = renderAiSection({ save, test, ...deps });
  document.body.replaceChildren(view.element);
  view.fill(settings);
  const q = <T extends HTMLElement>(sel: string) => view.element.querySelector<T>(sel)!;
  const input = (id: string) => q<HTMLInputElement>(`#${id}`);
  const button = q<HTMLButtonElement>('#ai-provider');
  const list = q<HTMLElement>('[role="listbox"]');
  const option = (id: string) => q<HTMLElement>(`[data-provider="${id}"]`);
  const keydown = (el: Element, key: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  return {
    view, save, test, input, button, list, option, keydown,
    model: input('ai-model'), key: input('ai-key'), baseUrl: input('ai-base-url'),
    format: q<HTMLSelectElement>('#ai-format'), advanced: q<HTMLDetailsElement>('details'),
    permission: q('.info'), status: q('.status'), shownName: () => q('.p-current .p-name').textContent,
    buttons: [...view.element.querySelectorAll<HTMLButtonElement>('.actions .btn')],
  };
}

afterEach(() => vi.restoreAllMocks());

describe('AI section fields', () => {
  it('loads the active profile and lists the preset models', () => {
    const s = setup();
    expect(s.shownName()).toBe('DeepSeek');
    expect(s.model.value).toBe('deepseek-chat');
    expect(s.key.value).toBe('ds-key');
    expect(s.baseUrl.value).toBe(DEEPSEEK.baseUrl);
    expect(s.model.getAttribute('list')).toBe('ai-models');
    expect([...s.view.element.querySelectorAll('#ai-models option')].map((o) => o.getAttribute('value'))).toEqual(['deepseek-chat', 'deepseek-reasoner']);
    expect(s.advanced.open).toBe(false);
  });

  it('falls back to the preset when nothing is saved', () => {
    const s = setup({});
    expect(s.shownName()).toBe('DeepSeek');
    expect(s.key.value).toBe('');
    expect(s.model.value).toBe('deepseek-chat');
  });

  it('shows the three formats in a native select', () => {
    const s = setup();
    expect([...s.format.options].map((o) => o.value)).toEqual(['openai', 'anthropic', 'gemini']);
  });
});

describe('switching provider', () => {
  it('loads that providers saved profile and never leaks the previous key', () => {
    const s = setup();
    s.button.click();
    s.option('openai').click();
    expect(s.shownName()).toBe('OpenAI');
    expect([s.model.value, s.key.value, s.baseUrl.value]).toEqual(['gpt-4.1', 'oa-key', OPENAI.baseUrl]);
    s.button.click();
    s.option('anthropic').click();
    expect(s.key.value).toBe('');
    expect([s.model.value, s.baseUrl.value, s.format.value]).toEqual(['claude-haiku-4-5', 'https://api.anthropic.com/v1/messages', 'anthropic']);
  });

  it('saves nothing and drops unsaved edits of the previous provider', () => {
    const s = setup();
    s.key.value = 'typed-but-unsaved';
    s.button.click();
    s.option('openai').click();
    s.button.click();
    s.option('deepseek').click();
    expect(s.key.value).toBe('ds-key');
    expect(s.save).not.toHaveBeenCalled();
  });

  it('clears the status line', async () => {
    const s = setup();
    s.buttons[1]!.click();
    await flush();
    expect(s.status.textContent).toBe('Kết nối được · 640 ms · JSON hợp lệ');
    s.button.click();
    s.option('groq').click();
    expect(s.status.textContent).toBe('');
  });

  it('opens Advanced for Custom, with empty fields', () => {
    const s = setup();
    expect(s.advanced.open).toBe(false);
    s.button.click();
    s.option('custom').click();
    expect(s.advanced.open).toBe(true);
    expect([s.baseUrl.value, s.model.value, s.key.value]).toEqual(['', '', '']);
    expect(s.shownName()).toBe('Tùy chỉnh');
  });

  it('opens Advanced on load when Custom is the saved provider', () => {
    expect(setup({ aiProvider: 'custom' }).advanced.open).toBe(true);
  });
});

describe('key hint', () => {
  const hint = (s: ReturnType<typeof setup>) => s.view.element.querySelector('#ai-key')!.parentElement!.querySelector('.hint')!;

  it('links to where the provider issues keys', () => {
    const s = setup();
    expect(hint(s).querySelector('a')?.getAttribute('href')).toBe('https://platform.deepseek.com/api_keys');
    s.button.click();
    s.option('openai').click();
    expect(hint(s).querySelector('a')?.getAttribute('href')).toBe('https://platform.openai.com/api-keys');
  });

  it('says a local model needs no key and has no link', () => {
    const s = setup({ aiProvider: 'ollama' });
    expect(hint(s).querySelector('a')).toBeNull();
    expect(hint(s).textContent).toContain('để trống');
  });

  it('has no link for Custom', () => {
    expect(hint(setup({ aiProvider: 'custom' })).querySelector('a')).toBeNull();
  });
});

describe('permission box', () => {
  it('is hidden for DeepSeek, which the manifest grants', () => {
    expect(setup().permission.hasAttribute('hidden')).toBe(true);
  });

  it('names the host of another provider and follows provider switches', () => {
    const s = setup();
    s.button.click();
    s.option('openai').click();
    expect(s.permission.hasAttribute('hidden')).toBe(false);
    expect(s.permission.textContent).toContain('(api.openai.com)');
    s.button.click();
    s.option('deepseek').click();
    expect(s.permission.hasAttribute('hidden')).toBe(true);
  });

  it('follows edits of the Base URL, including an invalid one', () => {
    const s = setup();
    s.baseUrl.value = 'https://llm.example.com:8443/v1';
    s.baseUrl.dispatchEvent(new Event('input'));
    expect(s.permission.textContent).toContain('(llm.example.com)');
    s.baseUrl.value = 'nonsense';
    s.baseUrl.dispatchEvent(new Event('input'));
    expect(s.permission.hasAttribute('hidden')).toBe(true);
    s.baseUrl.value = '';
    s.baseUrl.dispatchEvent(new Event('input'));
    expect(s.permission.hasAttribute('hidden')).toBe(true);
  });

  it('shows localhost for Ollama', () => {
    expect(setup({ aiProvider: 'ollama' }).permission.textContent).toContain('(localhost)');
  });
});

describe('save and test', () => {
  it('sends the draft of the active provider, with preset fallbacks for blank fields', () => {
    const s = setup();
    s.button.click();
    s.option('anthropic').click();
    s.key.value = ' sk-ant ';
    s.model.value = '';
    s.buttons[0]!.click();
    expect(s.save).toHaveBeenCalledWith({
      provider: 'anthropic',
      format: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1/messages',
      model: 'claude-haiku-4-5',
      key: 'sk-ant',
    });
  });

  it('merges into the stored profiles and shows the saved line', async () => {
    const data = new Map<string, unknown>([[SETTINGS_KEY, SAVED]]);
    const store: KeyValueStore = {
      get: async (k) => data.get(k),
      set: async (k, v) => void data.set(k, v),
      remove: async (k) => void data.delete(k),
      keys: async () => [...data.keys()],
    };
    const s = setup(SAVED, { save: (draft) => saveWithPermission(draft, { request: async () => true }, store, store) });
    s.button.click();
    s.option('groq').click();
    s.key.value = 'gk';
    s.buttons[0]!.click();
    expect(s.status.textContent).toBe('Đang lưu…');
    await flush();
    expect(s.status.textContent).toBe('Đã lưu');
    const stored = await loadSettings(store);
    expect(stored.aiProvider).toBe('groq');
    expect(Object.keys(stored.aiProfiles!).sort()).toEqual(['deepseek', 'groq', 'openai']);
    expect(stored.aiProfiles!.groq?.key).toBe('gk');
    expect(stored.aiProfiles!.openai?.key).toBe('oa-key');
    expect(s.shownName()).toBe('Groq');
  });

  it('reports a refused permission and an invalid URL, and a failed save', async () => {
    const s = setup(SAVED, { save: async () => ({ status: 'refused', reason: 'denied' }) });
    s.baseUrl.value = 'https://llm.example.com/v1';
    s.buttons[0]!.click();
    await flush();
    expect(s.status.textContent).toContain('https://llm.example.com');
    expect(s.status.classList.contains('error')).toBe(true);

    const invalid = setup(SAVED, { save: async () => ({ status: 'refused', reason: 'invalid_url' }) });
    invalid.buttons[0]!.click();
    await flush();
    expect(invalid.status.textContent).toContain('Base URL');

    const failing = setup(SAVED, { save: () => Promise.reject(new Error('x')) });
    failing.buttons[0]!.click();
    await flush();
    expect(failing.status.textContent).toBe('Không lưu được');
  });

  it('tests the current draft without a key for a keyless provider and shows the time', async () => {
    const s = setup({ aiProvider: 'ollama' });
    s.buttons[1]!.click();
    expect(s.test).toHaveBeenCalledWith(expect.objectContaining({ provider: 'ollama', key: undefined }));
    expect(s.buttons[1]!.disabled).toBe(true);
    await flush();
    expect(s.buttons[1]!.disabled).toBe(false);
    expect(s.status.textContent).toBe('Kết nối được · 640 ms · JSON hợp lệ');
    expect(s.status.classList.contains('error')).toBe(false);
  });

  it('shows the error text of a failed test', async () => {
    const s = setup(SAVED, { test: async () => ({ ok: false, reason: 'bad_ai_key' }) });
    s.buttons[1]!.click();
    await flush();
    expect(s.status.textContent).toBe('API key cho AI không đúng');
    expect(s.status.classList.contains('error')).toBe(true);
  });

  it('clears the status on any input', async () => {
    const s = setup();
    s.buttons[1]!.click();
    await flush();
    for (const el of [s.model, s.key, s.baseUrl]) {
      s.buttons[1]!.click();
      await flush();
      expect(s.status.textContent).not.toBe('');
      el.dispatchEvent(new Event('input'));
      expect(s.status.textContent).toBe('');
    }
    s.buttons[1]!.click();
    await flush();
    s.format.dispatchEvent(new Event('change'));
    expect(s.status.textContent).toBe('');
  });
});

describe('provider dropdown', () => {
  it('is a listbox button with an option per provider and the selected one marked', () => {
    const s = setup();
    expect(s.button.getAttribute('aria-haspopup')).toBe('listbox');
    expect(s.button.getAttribute('aria-expanded')).toBe('false');
    expect(s.list.hidden).toBe(true);
    const options = [...s.list.querySelectorAll('[role="option"]')];
    expect(options).toHaveLength(8);
    expect(options.filter((o) => o.getAttribute('aria-selected') === 'true').map((o) => o.getAttribute('data-provider'))).toEqual(['deepseek']);
    expect(options[0]!.querySelector('.p-icon')?.textContent).toBe('D');
    expect(options[0]!.querySelector('.p-sub')?.textContent).toBe('OpenAI-compatible (chat/completions)');
    expect(s.option('anthropic').querySelector('.p-sub')?.textContent).toBe('Anthropic (messages)');
  });

  it('opens on click and focuses the list with the selected option active', () => {
    const s = setup();
    s.button.click();
    expect(s.list.hidden).toBe(false);
    expect(s.button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(s.list);
    expect(s.list.getAttribute('aria-activedescendant')).toBe(s.option('deepseek').id);
  });

  it('opens with the arrow keys from the button', () => {
    const s = setup();
    s.keydown(s.button, 'ArrowDown');
    expect(s.list.hidden).toBe(false);
  });

  it('moves with arrows, wraps, jumps with Home and End, and selects with Enter', () => {
    const s = setup();
    s.button.click();
    s.keydown(s.list, 'ArrowDown');
    expect(s.list.getAttribute('aria-activedescendant')).toBe(s.option('openai').id);
    s.keydown(s.list, 'ArrowUp');
    s.keydown(s.list, 'ArrowUp');
    expect(s.list.getAttribute('aria-activedescendant')).toBe(s.option('custom').id);
    s.keydown(s.list, 'Home');
    expect(s.list.getAttribute('aria-activedescendant')).toBe(s.option('deepseek').id);
    s.keydown(s.list, 'End');
    s.keydown(s.list, 'Enter');
    expect(s.list.hidden).toBe(true);
    expect(s.shownName()).toBe('Tùy chỉnh');
    expect(s.option('custom').getAttribute('aria-selected')).toBe('true');
    expect(s.option('deepseek').getAttribute('aria-selected')).toBe('false');
    expect(document.activeElement).toBe(s.button);
  });

  it('selects with Space', () => {
    const s = setup();
    s.button.click();
    s.keydown(s.list, 'ArrowDown');
    s.keydown(s.list, ' ');
    expect(s.shownName()).toBe('OpenAI');
  });

  it('closes on Escape without changing anything, and returns focus to the button', () => {
    const s = setup();
    s.button.click();
    s.keydown(s.list, 'ArrowDown');
    s.keydown(s.list, 'Escape');
    expect(s.list.hidden).toBe(true);
    expect(s.shownName()).toBe('DeepSeek');
    expect(s.key.value).toBe('ds-key');
    expect(document.activeElement).toBe(s.button);
  });

  it('closes on an outside click and on Tab', () => {
    const s = setup();
    s.button.click();
    document.body.click();
    expect(s.list.hidden).toBe(true);
    s.button.click();
    s.keydown(s.list, 'Tab');
    expect(s.list.hidden).toBe(true);
    s.button.click();
    s.list.click();
    expect(s.list.hidden).toBe(false);
  });

  it('toggles closed when the button is clicked again', () => {
    const s = setup();
    s.button.click();
    s.button.click();
    expect(s.list.hidden).toBe(true);
  });

  it('keeps the key when the same provider is picked again', () => {
    const s = setup();
    s.key.value = 'edited';
    s.button.click();
    s.option('deepseek').click();
    expect(s.key.value).toBe('edited');
  });
});
