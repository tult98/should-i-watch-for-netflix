import { initLocale, type Locale } from '../shared/i18n';
import { SETTINGS_KEY, parseSettings } from '../shared/settings';
import type { StorageEvents } from './enabledSwitch';

export function watchLocale(events: StorageEvents, onChange: (next: Locale) => void = () => {}): void {
  events.addListener((changes, area) => {
    const change = changes[SETTINGS_KEY];
    if (area !== 'local' || !change) return;
    onChange(initLocale(parseSettings(change.newValue)));
  });
}
