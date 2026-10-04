/* Shared standalone developer tools. Sync with: pnpm sync:dev-mode. */
(() => {
  const { window, document, MutationObserver, performance } = globalThis;
  if (!window || window.SmallGamesDev) return;
  const actions = new Map();
  let host, shadow, dialog, toggle, info, performanceOutput, snapshot;
  let hidden = false,
    showTouches = false,
    frame = 0,
    frames = 0,
    fps = 0,
    last = 0,
    modalObserver;
  const touches = new Map();

  function flag(value) {
    if (value === null || value === undefined) return undefined;
    return ['', '1', 'true', 'on', 'yes'].includes(String(value).trim().toLowerCase());
  }
  function urlFlag(location) {
    // Only the Shell's game routes put their query after the hash.
    if (location.hash?.startsWith('#/games/') && location.hash.includes('?')) {
      const route = new URLSearchParams(location.hash.slice(location.hash.indexOf('?') + 1));
      if (route.has('dev')) return flag(route.get('dev'));
    }
    const query = new URLSearchParams(location.search);
    return query.has('dev') ? flag(query.get('dev')) : undefined;
  }
  function state() {
    let current = window;
    // A child's explicit URL wins; a same-origin host URL wins over shared storage.
    for (let depth = 0; depth < 20; depth++) {
      try {
        const value = urlFlag(current.location);
        if (value !== undefined) return { enabled: value, source: depth ? 'parent-url' : 'url' };
        if (current.parent === current) break;
        current = current.parent;
      } catch {
        break;
      }
    }
    try {
      const value = flag(window.localStorage.getItem('dev'));
      if (value !== undefined) return { enabled: value, source: 'storage' };
    } catch {
      /* Blocked storage must not prevent URL opt-in or gameplay. */
    }
    return { enabled: false, source: 'default' };
  }
  function withMode(search = '') {
    const query = new URLSearchParams(search);
    const mode = state();
    if (query.has('dev')) query.set('dev', flag(query.get('dev')) ? '1' : '0');
    else if (mode.source !== 'default') query.set('dev', mode.enabled ? '1' : '0');
    return query.toString();
  }
  function runtimeInfo() {
    let game;
    try {
      game = snapshot?.();
    } catch (error) {
      game = { error: String(error) };
    }
    return {
      mode: state(),
      page: window.location.pathname,
      embedded: window.parent !== window,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      },
      fps,
      ...(game === undefined ? {} : { game }),
    };
  }
  function report(value) {
    if (info) info.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
  function renderActions() {
    const target = shadow?.querySelector('[data-actions]');
    if (!target) return;
    target.replaceChildren();
    for (const action of actions.values()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.dataset.devAction = action.id;
      button.addEventListener('click', async () => {
        if (!state().enabled) return;
        button.disabled = true;
        try {
          await action.run();
          report(runtimeInfo());
        } catch (error) {
          report(`操作失败：${String(error)}`);
        } finally {
          button.disabled = false;
        }
      });
      target.append(button);
    }
  }
  function measure(now) {
    frames++;
    if (now - last >= 1000) {
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      performanceOutput.textContent = `${fps} FPS · ${window.innerWidth} × ${window.innerHeight} · DPR ${window.devicePixelRatio}`;
    }
    frame = window.requestAnimationFrame(measure);
  }
  function stopPerformance() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }
  function touch(event) {
    if (!showTouches || event.composedPath().includes(host)) return;
    let dot = touches.get(event.pointerId);
    if (event.type === 'pointerdown') {
      dot = document.createElement('i');
      dot.className = 'touch';
      shadow.append(dot);
      touches.set(event.pointerId, dot);
    }
    if (!dot) return;
    dot.style.left = `${event.clientX}px`;
    dot.style.top = `${event.clientY}px`;
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      dot.remove();
      touches.delete(event.pointerId);
    }
  }
  function clearTouches() {
    for (const dot of touches.values()) dot.remove();
    touches.clear();
  }
  function topLayer() {
    if (!host) return;
    // A game's modal makes outside controls inert. Keep tools inside its active dialog.
    const modal = [...document.querySelectorAll('dialog[open]')]
      .filter((node) => node.matches(':modal'))
      .at(-1);
    const parent = modal ?? document.body;
    if (host.parentNode !== parent) parent.append(host);
    if (!host.showPopover) return;
    try {
      if (host.matches(':popover-open')) host.hidePopover();
      host.showPopover();
    } catch {
      /* Older WebViews retain fixed positioning. */
    }
  }
  function removePanel() {
    modalObserver?.disconnect();
    stopPerformance();
    clearTouches();
    showTouches = false;
    host?.remove();
    host = shadow = dialog = toggle = info = performanceOutput = undefined;
  }
  function refresh() {
    if (typeof document === 'undefined' || !document.body) return;
    document.documentElement.dataset.devMode = String(state().enabled);
    if (!state().enabled || hidden) {
      removePanel();
      return;
    }
    if (host) return;
    host = document.createElement('small-games-devtools');
    host.setAttribute('data-game-dev-tools', '');
    host.setAttribute('popover', 'manual');
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{all:initial;position:fixed;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;background:transparent;pointer-events:none;z-index:2147483646;font:14px/1.5 system-ui,sans-serif;color:#edf7f4}
      *{box-sizing:border-box}button,input{font:inherit}button{min-height:44px;border:1px solid #52756e;border-radius:10px;background:#25483f;color:#edf7f4;padding:8px 12px;cursor:pointer;touch-action:manipulation}button:focus-visible,input:focus-visible{outline:3px solid #f8ca6a;outline-offset:2px}button:disabled{opacity:.5}
      [data-toggle]{position:fixed;right:max(8px,env(safe-area-inset-right));top:max(88px,calc(env(safe-area-inset-top) + 80px));width:48px;padding:0;pointer-events:auto;touch-action:none;box-shadow:0 2px 12px #0007}
      dialog{pointer-events:auto;color:inherit;background:#142b26;border:1px solid #52756e;border-radius:16px;padding:16px;width:min(360px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;margin:auto;font:14px/1.5 system-ui,sans-serif;overscroll-behavior:contain}dialog::backdrop{background:#001b1790}h2{font-size:18px;margin:0}header{display:flex;justify-content:space-between;align-items:center;gap:12px}p{color:#b6cdc5;margin:12px 0}label{display:flex;align-items:center;gap:10px;min-height:44px}input{width:20px;height:20px}section{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 monospace;background:#0c201b;padding:10px;border-radius:8px;max-height:220px;overflow:auto}output{position:fixed;bottom:max(8px,env(safe-area-inset-bottom));left:8px;padding:4px 8px;border-radius:6px;background:#142b26e6;font:12px/1.5 monospace;pointer-events:none}.touch{position:fixed;width:28px;height:28px;transform:translate(-50%,-50%);border:2px solid #f8ca6a;background:#f8ca6a55;border-radius:50%;pointer-events:none}
    </style>
    <button type="button" data-toggle aria-label="开发者调试" aria-haspopup="dialog">开发</button>
    <dialog aria-label="开发者调试选项"><header><h2>开发者调试</h2><button type="button" data-close>关闭</button></header>
      <p>拖动「开发」按钮可调整位置。调试选项仅在开发模式出现。</p>
      <label><input type="checkbox" data-performance>显示性能信息</label>
      <label><input type="checkbox" data-touches>显示触点</label>
      <label><input type="checkbox" data-remember>记住开发模式（当前站点）</label>
      <section><button type="button" data-inspect>查看运行信息</button><button type="button" data-reload>重新加载游戏</button><button type="button" data-exit>退出开发模式</button></section>
      <section data-actions aria-label="游戏调试选项"></section><pre data-info aria-live="polite">选择选项开始调试。</pre>
    </dialog><output hidden aria-label="开发性能统计"></output>`;
    toggle = shadow.querySelector('[data-toggle]');
    dialog = shadow.querySelector('dialog');
    info = shadow.querySelector('[data-info]');
    performanceOutput = shadow.querySelector('output');
    // Developer presses must not start scene actions; key releases still clear held input.
    for (const type of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'click',
      'keydown',
      'wheel',
    ])
      host.addEventListener(type, (event) => event.stopPropagation());
    let drag;
    toggle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const bounds = toggle.getBoundingClientRect();
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: bounds.left,
        top: bounds.top,
        moved: false,
      };
      toggle.setPointerCapture(event.pointerId);
    });
    toggle.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 6;
      if (!drag.moved) return;
      toggle.style.right = 'auto';
      toggle.style.left = `${Math.max(4, Math.min(window.innerWidth - 52, drag.left + dx))}px`;
      toggle.style.top = `${Math.max(4, Math.min(window.innerHeight - 52, drag.top + dy))}px`;
    });
    toggle.addEventListener('pointerup', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      drag = undefined;
      // Touch browsers can suppress a compatibility click after dragging or rotating.
      if (!moved) dialog.showModal();
    });
    for (const type of ['pointercancel', 'lostpointercapture'])
      toggle.addEventListener(type, () => {
        drag = undefined;
      });
    toggle.addEventListener('click', (event) => {
      if (event.detail === 0 && !event.pointerType && !dialog.open) dialog.showModal();
    });
    shadow.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => toggle?.focus({ preventScroll: true }));
    shadow.querySelector('[data-performance]').addEventListener('change', (event) => {
      stopPerformance();
      performanceOutput.hidden = !event.target.checked;
      if (event.target.checked) {
        frames = 0;
        last = performance.now();
        frame = window.requestAnimationFrame(measure);
      }
    });
    shadow.querySelector('[data-touches]').addEventListener('change', (event) => {
      showTouches = event.target.checked;
      if (!showTouches) clearTouches();
    });
    const remember = shadow.querySelector('[data-remember]');
    try {
      remember.checked = flag(window.localStorage.getItem('dev')) === true;
    } catch {
      /* The URL can enable tools when storage is unavailable. */
    }
    remember.addEventListener('change', () => {
      try {
        if (remember.checked) window.localStorage.setItem('dev', '1');
        else window.localStorage.removeItem('dev');
        report('存储设置已更新，下次打开游戏生效。');
      } catch {
        remember.checked = !remember.checked;
        report('浏览器不允许写入存储；仍可使用 URL 的 dev 参数。');
      }
    });
    shadow.querySelector('[data-inspect]').addEventListener('click', () => report(runtimeInfo()));
    shadow.querySelector('[data-reload]').addEventListener('click', () => window.location.reload());
    shadow.querySelector('[data-exit]').addEventListener('click', () => {
      try {
        window.localStorage.removeItem('dev');
      } catch {
        /* An explicit dev=0 URL still disables this document. */
      }
      const url = new URL(window.location.href);
      url.searchParams.set('dev', '0');
      if (url.hash.startsWith('#/games/') && url.hash.includes('?')) {
        const split = url.hash.indexOf('?'),
          route = new URLSearchParams(url.hash.slice(split + 1));
        route.set('dev', '0');
        url.hash = `${url.hash.slice(0, split)}?${route}`;
      }
      window.location.replace(url.href);
    });
    document.body.append(host);
    modalObserver = new MutationObserver(topLayer);
    modalObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    renderActions();
    topLayer();
  }
  window.SmallGamesDev = Object.freeze({
    isEnabled: () => state().enabled,
    state,
    withMode,
    inspect: runtimeInfo,
    refresh,
    setPanelHidden(value) {
      hidden = value;
      refresh();
    },
    registerActions(items) {
      for (const item of items) actions.set(item.id, item);
      renderActions();
      return () => {
        for (const item of items) if (actions.get(item.id) === item) actions.delete(item.id);
        renderActions();
      };
    },
    registerSnapshot(read) {
      snapshot = read;
      return () => {
        if (snapshot === read) snapshot = undefined;
      };
    },
  });
  if (!document) return;
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
  window.addEventListener('hashchange', refresh);
  window.addEventListener('storage', (event) => {
    if (event.key === 'dev' || event.key === null) refresh();
  });
  window.addEventListener('blur', clearTouches);
  window.addEventListener('resize', () => {
    if (!toggle?.style.left) return;
    toggle.style.left = `${Math.max(4, Math.min(window.innerWidth - 52, parseFloat(toggle.style.left)))}px`;
    toggle.style.top = `${Math.max(4, Math.min(window.innerHeight - 52, parseFloat(toggle.style.top)))}px`;
  });
  document.addEventListener('fullscreenchange', topLayer);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
    document.addEventListener(type, touch, { passive: true });
})();
