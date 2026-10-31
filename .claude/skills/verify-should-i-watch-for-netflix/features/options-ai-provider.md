# AI provider settings

The AI card chooses the provider behind the AI opinion button. A custom listbox lists eight providers (DeepSeek, OpenAI, Anthropic, Gemini, OpenRouter, Groq, Ollama, Custom). Picking one fills the base URL and a suggested model, and each provider keeps its own profile. Advanced options holds the API format and base URL. A provider on a new host shows a note that Chrome will ask for that host's permission on save.

## Sub-features

- `provider-pick` opens the list and switches the preset.
- `provider-permission-note` shows the host that Chrome will ask about.
- `provider-save` stores the profile (`aiProvider`, `aiProfiles.<id>`).
- `provider-test` sends a real test request (not driven, it costs money with a real key).

## How to get to it (user POV)

- Options page, card `AI opinion`, field `Provider`.
- Harness: `s.url('options.html')`, `section.ai`, `#ai-provider`.

## Driving it with playwright-core

Preconditions:

- Baseline from `README.md`. No key is stored. The only key typed is a placeholder, and only DeepSeek is saved.

- **Run the whole recipe.** `node .claude/skills/verify-should-i-watch-for-netflix/scripts/scenarios/options-ai-provider.mjs`. Six `PASS` lines, clip, `PACING OK`.
- **Open the list.** `await s.click(page.locator('#ai-provider'), ...)`. `aria-expanded="true"`, 8 `[data-provider]` options.
- **Pick OpenAI.** `await s.click(page.locator('[data-provider=openai]'), ...)`, then open `section.ai summary`. `#ai-base-url` starts with `https://api.openai.com/`, `#ai-model` is filled, and `section.ai .info` names `api.openai.com`.
- **Back to DeepSeek and save.** Pick `[data-provider=deepseek]`, `await s.type(page.locator('#ai-key'), 'verify-not-a-real-key', ...)`, click `Save AI settings`. Status `Saved`, and `settings.aiProfiles.deepseek.key` equals the placeholder.
- **Proof.** `shots/options-ai-provider-{list,openai,saved}.png`, `video/options-ai-provider.webm`.

## Gotchas

- Saving any provider whose host is not in `manifest.json` `host_permissions` triggers a Chrome permission prompt that headless cannot answer. The save then reports `Access to <origin> was not granted, nothing saved`. That refusal is itself a checkable outcome, a stored profile is not.
- The provider control and the API format control (`#ai-format`, options carry `data-format`, inside the collapsed Advanced options) are both custom listboxes, not `<select>`. `selectOption` does not work. Both use the `.p-option` class, so count provider options with `[data-provider]`.
- Choosing `Custom` opens Advanced options by itself.
- `Test connection` makes a live request with the form values, saved or not. Do not use a real key with it unless asked, and say so in the proof if it was mocked.
- The popup's AI row changes with the provider: key set shows `Set`, a keyless provider (Ollama) shows `Ready`.
