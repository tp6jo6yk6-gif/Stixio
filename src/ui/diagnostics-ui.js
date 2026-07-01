import { formatBytes } from './beta-hardening-core.js';

export function createDiagnosticsUi({ getSnapshot, onClear }) {
  injectStyle();
  const holder = document.createElement('div');
  holder.id = 'stixioDiagnosticsRoot';
  holder.innerHTML = `
    <button id="stixioDiagnosticsButton" type="button" aria-label="開啟診斷資訊">診斷</button>
    <section id="stixioErrorBanner" role="alert" aria-live="assertive" hidden>
      <div><strong data-error-title></strong><p data-error-message></p><small data-error-recovery></small></div>
      <div class="stixio-error-actions"><button type="button" data-show-diagnostics>診斷資訊</button><button type="button" data-dismiss-error>關閉</button></div>
    </section>
    <div id="stixioDiagnosticsBackdrop" hidden>
      <section id="stixioDiagnosticsPanel" role="dialog" aria-modal="true" aria-labelledby="stixioDiagnosticsTitle">
        <header><div><small>Beta support</small><h2 id="stixioDiagnosticsTitle">Stixio 診斷資訊</h2></div><button type="button" data-close-diagnostics aria-label="關閉">×</button></header>
        <div id="stixioDiagnosticsSummary"></div>
        <div class="stixio-diagnostics-actions"><button type="button" data-copy-diagnostics>複製診斷</button><button type="button" data-download-diagnostics>下載 JSON</button><button type="button" data-clear-diagnostics>清除錯誤</button></div>
        <div id="stixioDiagnosticsErrors"></div>
      </section>
    </div>`;
  document.body.appendChild(holder);

  const show = () => { render(); holder.querySelector('#stixioDiagnosticsBackdrop').hidden = false; };
  const hide = () => { holder.querySelector('#stixioDiagnosticsBackdrop').hidden = true; };
  holder.querySelector('#stixioDiagnosticsButton').addEventListener('click', show);
  holder.querySelector('[data-show-diagnostics]').addEventListener('click', show);
  holder.querySelector('[data-dismiss-error]').addEventListener('click', () => { holder.querySelector('#stixioErrorBanner').hidden = true; });
  holder.querySelector('[data-close-diagnostics]').addEventListener('click', hide);
  holder.querySelector('#stixioDiagnosticsBackdrop').addEventListener('click', event => { if (event.target.id === 'stixioDiagnosticsBackdrop') hide(); });
  holder.querySelector('[data-copy-diagnostics]').addEventListener('click', async () => {
    const text = JSON.stringify(getSnapshot(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setBanner({ title: '診斷資訊已複製', message: '可直接貼到錯誤回報中。', recovery: '', severity: 'info' });
    } catch { downloadText(text, diagnosticsFileName()); }
  });
  holder.querySelector('[data-download-diagnostics]').addEventListener('click', () => downloadText(JSON.stringify(getSnapshot(), null, 2), diagnosticsFileName()));
  holder.querySelector('[data-clear-diagnostics]').addEventListener('click', () => { onClear?.(); render(); });
  window.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });

  function setBanner(issue) {
    const banner = holder.querySelector('#stixioErrorBanner');
    banner.hidden = false;
    banner.dataset.severity = issue.severity || 'error';
    banner.querySelector('[data-error-title]').textContent = issue.title || '操作沒有完成';
    banner.querySelector('[data-error-message]').textContent = issue.message || '';
    banner.querySelector('[data-error-recovery]').textContent = issue.recovery || '';
  }

  function render() {
    const report = getSnapshot();
    const summary = holder.querySelector('#stixioDiagnosticsSummary');
    const errors = holder.querySelector('#stixioDiagnosticsErrors');
    summary.innerHTML = '';
    const storage = report.storage;
    const rows = [
      ['版本', `${report.app.version} · ${report.app.build.slice(0, 12)}`],
      ['瀏覽器', report.runtime.userAgent || 'Unknown'],
      ['連線', report.runtime.online === false ? '離線' : '線上'],
      ['本地資源', report.runtime.features.jszip ? 'JSZip 已載入' : 'JSZip 缺失'],
      ['儲存空間', storage ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}` : '瀏覽器未提供']
    ];
    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('strong');
      const description = document.createElement('span');
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      summary.appendChild(row);
    });
    errors.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = `最近錯誤（${report.recentErrors.length}）`;
    errors.appendChild(title);
    if (!report.recentErrors.length) {
      const empty = document.createElement('p');
      empty.textContent = '目前沒有記錄到錯誤。';
      errors.appendChild(empty);
      return;
    }
    [...report.recentErrors].reverse().forEach(item => {
      const card = document.createElement('article');
      const heading = document.createElement('strong');
      const message = document.createElement('p');
      const meta = document.createElement('small');
      heading.textContent = `${item.code} · ${item.title}`;
      message.textContent = item.message;
      meta.textContent = `${item.time} · ${item.source}`;
      card.append(heading, message, meta);
      errors.appendChild(card);
    });
  }

  render();
  return { show, hide, setBanner, render };
}

function downloadText(text, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function diagnosticsFileName() {
  return `stixio-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
}

function injectStyle() {
  if (document.querySelector('#stixioDiagnosticsStyle')) return;
  const style = document.createElement('style');
  style.id = 'stixioDiagnosticsStyle';
  style.textContent = `
    #stixioDiagnosticsRoot{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #stixioDiagnosticsButton{position:fixed;right:18px;bottom:18px;z-index:9997;border:0;border-radius:999px;background:#0f172a;color:#a7f3d0;padding:10px 16px;font-weight:900;box-shadow:0 10px 30px rgba(15,23,42,.25);cursor:pointer}
    #stixioErrorBanner{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:9999;width:min(720px,calc(100vw - 32px));background:#fff;border:2px solid #fb7185;border-radius:18px;padding:14px 16px;box-shadow:0 18px 60px rgba(15,23,42,.25);display:flex;gap:16px;align-items:flex-start;justify-content:space-between}
    #stixioErrorBanner[hidden],#stixioDiagnosticsBackdrop[hidden]{display:none!important}
    #stixioErrorBanner[data-severity="warning"]{border-color:#f59e0b}#stixioErrorBanner[data-severity="info"]{border-color:#38bdf8}
    #stixioErrorBanner strong{display:block;font-size:15px;color:#0f172a}#stixioErrorBanner p{margin:4px 0;color:#334155;font-size:13px}#stixioErrorBanner small{display:block;color:#64748b;line-height:1.45}
    .stixio-error-actions,.stixio-diagnostics-actions{display:flex;gap:8px;flex-wrap:wrap}.stixio-error-actions button,.stixio-diagnostics-actions button{border:0;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer;background:#e2e8f0;color:#0f172a}
    #stixioDiagnosticsBackdrop{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.64);display:grid;place-items:center;padding:20px}
    #stixioDiagnosticsPanel{width:min(820px,100%);max-height:min(780px,calc(100vh - 40px));overflow:auto;background:#f8fafc;border-radius:24px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.35);color:#0f172a}
    #stixioDiagnosticsPanel header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}#stixioDiagnosticsPanel header small{color:#059669;font-weight:900;text-transform:uppercase;letter-spacing:.12em}#stixioDiagnosticsPanel h2{margin:3px 0 0;font-size:24px}#stixioDiagnosticsPanel header button{border:0;background:#e2e8f0;border-radius:12px;width:38px;height:38px;font-size:24px;cursor:pointer}
    #stixioDiagnosticsSummary{display:grid;gap:8px;margin:18px 0}#stixioDiagnosticsSummary>div{display:grid;grid-template-columns:110px 1fr;gap:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;overflow-wrap:anywhere}#stixioDiagnosticsSummary strong{color:#64748b}
    #stixioDiagnosticsErrors{margin-top:18px}#stixioDiagnosticsErrors h3{font-size:14px}#stixioDiagnosticsErrors article{margin-top:8px;background:#fff;border:1px solid #fecdd3;border-radius:12px;padding:12px}#stixioDiagnosticsErrors article p{margin:5px 0;font-size:12px;color:#334155;overflow-wrap:anywhere}#stixioDiagnosticsErrors article small{color:#94a3b8}
    @media(max-width:640px){#stixioErrorBanner{flex-direction:column}.stixio-error-actions{width:100%}#stixioDiagnosticsSummary>div{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}
