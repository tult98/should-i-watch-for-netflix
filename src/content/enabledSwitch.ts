import { SETTINGS_KEY, enabledOf, parseSettings, type Settings } from '../shared/settings';

type StorageListener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

export interface StorageEvents {
  addListener(listener: StorageListener): void;
}

// A change can land before the first load answers, and the load would then apply an older value.
export function watchEnabled(events: StorageEvents, load: () => Promise<Settings>, apply: (enabled: boolean) => void): void {
  let changed = false;
  events.addListener((changes, area) => {
    const change = changes[SETTINGS_KEY];
    if (area !== 'local' || !change) return;
    changed = true;
    apply(enabledOf(parseSettings(change.newValue)));
  });
  load().then(
    (settings) => !changed && apply(enabledOf(settings)),
    () => !changed && apply(true),
  );
}
