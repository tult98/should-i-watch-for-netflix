const LABEL = 'font-size: 11px; color: var(--muted); letter-spacing: 0.04em; text-transform: uppercase;';

export const POPOVER_CSS = `
:host { all: initial; }
.panel { position: fixed; left: 0; top: 0; pointer-events: auto; }
.panel[hidden] { display: none; }
.panel {
  --bg: #181818; --fg: #ffffff; --muted: #b3b3b3; --soft: #e5e5e5; --border: rgba(255,255,255,0.14);
  --shadow: 0 18px 48px rgba(0,0,0,0.75); --scroll: #4d4d4d; --outline: #6d6d6d; --stat: #232323; --chip: #333333;
  --ai-bg: #262626; --ai-border: rgba(255,255,255,0.1); --ok: #46d369; --maybe: #f5c542;
  --warn-bg: rgba(245,197,66,0.12); --warn-border: rgba(245,197,66,0.45); --focus: #ffffff;
  --press-bg: #ffffff; --press-fg: #141414; --sk: #2c2c2c; --sk-strong: #3a3a3a; --sk-box: #262626;
}
.panel[data-theme="light"] {
  --bg: #ffffff; --fg: #141414; --muted: #5f5f5f; --soft: #2b2b2b; --border: rgba(0,0,0,0.12);
  --shadow: 0 18px 48px rgba(0,0,0,0.25); --scroll: #bdbdbd; --outline: #8c8c8c; --stat: #f2f2f2; --chip: #ececec;
  --ai-bg: #f2f2f2; --ai-border: rgba(0,0,0,0.1); --ok: #12803a; --maybe: #8a5a00;
  --warn-bg: rgba(245,197,66,0.2); --warn-border: rgba(160,110,0,0.5); --focus: #141414;
  --press-bg: #141414; --press-fg: #ffffff; --sk: #e6e6e6; --sk-strong: #d9d9d9; --sk-box: #f2f2f2;
}
.pop {
  width: 380px; box-sizing: border-box; max-height: calc(100vh - 16px); overflow-x: hidden; overflow-y: auto;
  background: var(--bg); color: var(--fg); text-align: left; font-size: 14px; line-height: normal;
  font-family: 'Netflix Sans', 'Helvetica Neue', Arial, sans-serif;
  border-radius: 10px; border: 1px solid var(--border); box-shadow: var(--shadow);
  scrollbar-width: thin; scrollbar-color: var(--scroll) transparent;
}
.pop * { box-sizing: border-box; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px 0 20px; }
.top-left { display: flex; align-items: center; gap: 8px; }
.pill {
  display: inline-flex; align-items: center; justify-content: center; height: 20px; padding: 0 7px; border-radius: 4px;
  color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
}
.pill-mal { background: #2e51a2; }
.pill-tmdb { background: #0d7a9e; }
.pill-cinemeta { background: #5b4a9e; }
.pill-anilist { background: #0b6aa8; }
.note { font-size: 12px; color: var(--muted); }
.badge {
  display: inline-flex; align-items: center; height: 26px; padding: 0 12px; border-radius: 13px;
  font-size: 12px; font-weight: 700; white-space: nowrap; border: 1px solid transparent;
}
.badge-highly_recommended { background: #46d369; color: #0b0b0b; border-color: #46d369; }
.badge-recommended { background: transparent; color: var(--ok); border-color: var(--ok); }
.badge-maybe { background: transparent; color: var(--maybe); border-color: var(--maybe); }
.badge-skip { background: transparent; color: var(--muted); border-color: var(--outline); }
.body { padding: 12px 20px 20px 20px; display: flex; flex-direction: column; gap: 16px; }
.heading { display: flex; flex-direction: column; gap: 4px; }
.title { margin: 0; font-size: 22px; line-height: 1.2; font-weight: 800; letter-spacing: -0.01em; color: var(--fg); }
.sub { font-size: 12px; color: var(--muted); }
.score { display: flex; align-items: flex-end; gap: 12px; }
.score-main { display: flex; align-items: center; gap: 8px; }
.score-value { font-size: 40px; line-height: 1; font-weight: 800; letter-spacing: -0.02em; }
.score-meta { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--muted); padding-bottom: 4px; }
.score-label { display: inline-flex; align-items: center; gap: 6px; }
.score-icon { flex: none; display: block; }
.stat-head { display: flex; align-items: center; gap: 5px; min-width: 0; }
.score-source { font-weight: 700; color: var(--soft); }
.warn {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 6px;
  background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--maybe); font-size: 13px; font-weight: 600;
}
.warn svg { flex: none; }
.stats { display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 10px; }
.stat { background: var(--stat); border-radius: 6px; padding: 9px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.label { ${LABEL} overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stat-value { font-size: 16px; font-weight: 700; }
.section { display: flex; flex-direction: column; gap: 6px; }
.synopsis {
  margin: 0; font-size: 14px; line-height: 1.5; color: var(--soft);
  display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden;
}
.synopsis-en { color: var(--muted); }
.meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
.field { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.field-value { font-size: 14px; font-weight: 500; }
.row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.age {
  display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 4px;
  font-size: 12px; font-weight: 600; border: 1px solid var(--outline); color: var(--soft);
}
.credits { display: flex; flex-direction: column; gap: 8px; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.chip {
  display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 12px;
  background: var(--chip); font-size: 12px; font-weight: 500; color: var(--fg);
}
.chip-outline { background: transparent; border: 1px solid var(--outline); color: var(--soft); }
.actions { display: flex; align-items: center; gap: 8px; }
.btn {
  margin: 0; height: 44px; border-radius: 6px; cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center;
}
.btn-ai { flex: 1; border: 0; background: #e50914; color: #ffffff; font-size: 14px; font-weight: 700; gap: 8px; }
.btn-ai:hover { background: #f6121d; }
.btn-ai:disabled { cursor: progress; opacity: 0.7; }
.btn-ai:disabled:hover { background: #e50914; }
.ai-slot:empty { display: none; }
.ai-box {
  background: var(--ai-bg); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px;
  border: 1px solid var(--ai-border);
}
.ai-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ai-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.ai-provider { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-verdict { display: flex; align-items: center; gap: 8px; }
.ai-verdict-label { font-size: 12px; color: var(--muted); }
.badge.badge-sm { height: 22px; padding: 0 10px; border-radius: 11px; }
.ai-reason { margin: 0; font-size: 14px; line-height: 1.5; color: var(--soft); }
.ai-foot { font-size: 11px; color: var(--muted); }
.ai-error { margin: 0; font-size: 13px; color: var(--maybe); }
.link-btn {
  margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; font-weight: 700;
  text-decoration: underline; cursor: pointer;
}
.link-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.btn-icon { width: 44px; background: transparent; color: var(--fg); border: 1px solid var(--outline); }
.btn-icon:hover { border-color: var(--focus); }
.btn-icon[aria-pressed="true"] { background: var(--press-bg); color: var(--press-fg); border-color: var(--press-bg); }
.btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
@keyframes pulse { 0% { opacity: .35; } 50% { opacity: .7; } 100% { opacity: .35; } }
.skeleton { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.sk { animation: pulse 1.4s ease-in-out infinite; border-radius: 4px; background: var(--sk); height: 12px; }
.sk-strong { background: var(--sk-strong); }
.sk-box { background: var(--sk-box); border-radius: 6px; height: 48px; }
.sk-score { display: flex; align-items: flex-end; gap: 12px; margin-top: 6px; }
.sk-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.sk-actions { display: flex; gap: 8px; }
.sk-btn { height: 44px; border-radius: 6px; }
.sk-grow { flex: 1; }
.sk-score .sk:last-child { margin-bottom: 6px; }
@media (prefers-reduced-motion: reduce) { .sk { animation: none; opacity: .5; } }
`;
