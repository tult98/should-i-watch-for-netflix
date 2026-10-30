const LABEL = 'font-size: 11px; color: #b3b3b3; letter-spacing: 0.04em; text-transform: uppercase;';

export const POPOVER_CSS = `
:host { all: initial; }
.panel { position: fixed; left: 0; top: 0; pointer-events: auto; }
.panel[hidden] { display: none; }
.pop {
  width: 380px; box-sizing: border-box; max-height: calc(100vh - 16px); overflow-x: hidden; overflow-y: auto;
  background: #181818; color: #ffffff; text-align: left; font-size: 14px; line-height: normal;
  font-family: 'Netflix Sans', 'Helvetica Neue', Arial, sans-serif;
  border-radius: 10px; border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 18px 48px rgba(0,0,0,0.75);
  scrollbar-width: thin; scrollbar-color: #4d4d4d transparent;
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
.note { font-size: 12px; color: #b3b3b3; }
.badge {
  display: inline-flex; align-items: center; height: 26px; padding: 0 12px; border-radius: 13px;
  font-size: 12px; font-weight: 700; white-space: nowrap; border: 1px solid transparent;
}
.badge-highly_recommended { background: #46d369; color: #0b0b0b; border-color: #46d369; }
.badge-recommended { background: transparent; color: #46d369; border-color: #46d369; }
.badge-maybe { background: transparent; color: #f5c542; border-color: #f5c542; }
.badge-skip { background: transparent; color: #b3b3b3; border-color: #6d6d6d; }
.body { padding: 12px 20px 20px 20px; display: flex; flex-direction: column; gap: 16px; }
.heading { display: flex; flex-direction: column; gap: 4px; }
.title { margin: 0; font-size: 22px; line-height: 1.2; font-weight: 800; letter-spacing: -0.01em; color: #ffffff; }
.sub { font-size: 12px; color: #b3b3b3; }
.score { display: flex; align-items: flex-end; gap: 12px; }
.score-main { display: flex; align-items: center; gap: 8px; }
.score-value { font-size: 40px; line-height: 1; font-weight: 800; letter-spacing: -0.02em; }
.score-meta { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #b3b3b3; padding-bottom: 4px; }
.score-source { font-weight: 700; color: #e5e5e5; }
.warn {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 6px;
  background: rgba(245,197,66,0.12); border: 1px solid rgba(245,197,66,0.45); color: #f5c542; font-size: 13px; font-weight: 600;
}
.warn svg { flex: none; }
.stats { display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 10px; }
.stat { background: #232323; border-radius: 6px; padding: 9px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.label { ${LABEL} overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stat-value { font-size: 16px; font-weight: 700; }
.section { display: flex; flex-direction: column; gap: 6px; }
.synopsis {
  margin: 0; font-size: 14px; line-height: 1.5; color: #e5e5e5;
  display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden;
}
.synopsis-en { color: #b3b3b3; }
.meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
.field { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.field-value { font-size: 14px; font-weight: 500; }
.row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.age {
  display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 4px;
  font-size: 12px; font-weight: 600; border: 1px solid #6d6d6d; color: #e5e5e5;
}
.credits { display: flex; flex-direction: column; gap: 8px; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.chip {
  display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 12px;
  background: #333333; font-size: 12px; font-weight: 500; color: #ffffff;
}
.chip-outline { background: transparent; border: 1px solid #6d6d6d; color: #e5e5e5; }
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
  background: #262626; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px;
  border: 1px solid rgba(255,255,255,0.1);
}
.ai-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ai-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.ai-provider { font-size: 11px; color: #b3b3b3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-verdict { display: flex; align-items: center; gap: 8px; }
.ai-verdict-label { font-size: 12px; color: #b3b3b3; }
.badge.badge-sm { height: 22px; padding: 0 10px; border-radius: 11px; }
.ai-reason { margin: 0; font-size: 14px; line-height: 1.5; color: #e5e5e5; }
.ai-foot { font-size: 11px; color: #b3b3b3; }
.ai-error { margin: 0; font-size: 13px; color: #f5c542; }
.link-btn {
  margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; font-weight: 700;
  text-decoration: underline; cursor: pointer;
}
.link-btn:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
.btn-icon { width: 44px; background: transparent; color: #ffffff; border: 1px solid #6d6d6d; }
.btn-icon:hover { border-color: #ffffff; }
.btn-icon[aria-pressed="true"] { background: #ffffff; color: #141414; border-color: #ffffff; }
.btn:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
@keyframes pulse { 0% { opacity: .35; } 50% { opacity: .7; } 100% { opacity: .35; } }
.skeleton { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.sk { animation: pulse 1.4s ease-in-out infinite; border-radius: 4px; background: #2c2c2c; height: 12px; }
.sk-strong { background: #3a3a3a; }
.sk-box { background: #262626; border-radius: 6px; height: 48px; }
.sk-score { display: flex; align-items: flex-end; gap: 12px; margin-top: 6px; }
.sk-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.sk-actions { display: flex; gap: 8px; }
.sk-btn { height: 44px; border-radius: 6px; }
.sk-grow { flex: 1; }
.sk-score .sk:last-child { margin-bottom: 6px; }
@media (prefers-reduced-motion: reduce) { .sk { animation: none; opacity: .5; } }
`;
