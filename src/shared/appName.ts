export function appName(): string {
  return chrome.runtime.getManifest().name;
}
