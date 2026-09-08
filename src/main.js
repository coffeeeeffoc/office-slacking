import { createGame, advance, act, getBoss } from './game.js';
import { createSound } from './sound.js';
import { createLook } from './look.js';

const icons = {
  cup: '<path d="M4 7h12v8a6 6 0 0 1-12 0V7Zm12 1h2a3 3 0 0 1 0 6h-2M7 3v1m5-1v1M3 21h15"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
  back: '<path d="m9 6-6 6 6 6M3 12h18"/>',
  arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3v2m0 3h.01"/>',
  look: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
document.querySelector('#app').innerHTML = `
<main class="game" data-phase="ready">
  <div class="world" aria-hidden="true"><img class="office-background" src="./public/assets/office.png" alt=""/><canvas class="room-canvas"></canvas><div class="sunlight"></div><div class="vignette"></div></div>
  <header class="topbar">
    <a class="wordmark" href="./" aria-label="摸鱼事务所首页"><span class="brand-icon">${icon('cup')}</span><span>摸鱼事务所<small>THE ART OF DOING LESS</small></span></a>
    <div class="shift"><span class="live-dot"></span> 周五 · 晴 <i></i> <time id="office-time">17:58:30</time></div>
    <nav class="top-actions" aria-label="游戏设置">
      <button class="icon-button" id="look-around" title="转头环顾 · 拖动空白处 / 方向键" aria-label="转头环顾">${icon('look')}</button>
      <button class="icon-button" id="sound" title="打开环境音" aria-label="打开环境音" aria-pressed="false">${icon('sound')}<span class="off-mark"></span></button>
      <button class="icon-button" id="help" title="操作说明" aria-label="操作说明">${icon('help')}</button>
      <button class="icon-button" id="pause" title="暂停 · Esc" aria-label="暂停游戏">${icon('pause')}</button>
      <button class="icon-button fullscreen-button" id="fullscreen" title="全屏" aria-label="全屏">${icon('expand')}</button>
    </nav>
  </header>

  <section class="scene" aria-label="你的工位">
    <div class="chapter-label"><span>CHAPTER 02 / SCENE 05</span><h1>下班前的九十秒</h1><p>把工作做完，也给自己留一点时间。</p></div>
    <div class="route-note" id="route-note"><span class="route-dot"></span><span id="boss-label">经理还在看文件</span><small id="boss-detail">走廊里很安静。</small></div>
    <div class="people-layer" aria-hidden="true">
      <div class="room-person" data-person="boss"><div class="person-label"></div></div>
      <div class="room-person" data-person="lin"><div class="person-label"></div></div>
    </div>

    <div class="desk-plane">
    <aside class="desk-note" aria-label="今天的待办"><span class="tape"></span><span class="note-date">FRIDAY, 17:58</span><h2>下班前，就两件事。</h2><div id="work-task"><span class="checkbox"></span>核对一笔回款</div><div id="joy-task"><span class="checkbox"></span>给自己 <b>20</b> 秒放空</div><hr/><p>工作要收尾。<br/>快乐也是。</p><span class="note-signature">周末见 :)</span></aside>

    <section class="monitor" aria-label="工位电脑">
      <div class="monitor-bezel"><div class="camera-dot"></div><div class="display">
        <div class="desktop-bar"><span>▦ &nbsp; 工作台</span><span id="desktop-time">17:58</span></div>
        <div class="app-tabs" role="tablist" aria-label="电脑应用"><button id="work-tab" role="tab" aria-selected="true" aria-controls="work-app"><span class="sheet-icon">X</span> 回款汇总_最终版.xlsx <span class="tab-dot"></span></button><button id="break-tab" role="tab" aria-selected="false" aria-controls="break-app">◌ &nbsp; 窗外</button></div>
        <section class="work-app" id="work-app" role="tabpanel" aria-labelledby="work-tab">
          <div class="sheet-menu"><b>文件</b><span>开始</span><span>插入</span><span>公式</span><span>数据</span><small>自动保存 <span id="save-status">✓</span></small></div>
          <div class="formula-bar"><span>D7</span><i>ƒx</i><span id="formula-value">128000</span></div>
          <div class="sheet-content"><table aria-label="九月渠道回款汇总"><colgroup><col class="row-num"/><col/><col/><col/><col class="amount-col"/></colgroup><thead><tr><th></th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead><tbody>
            <tr class="sheet-title-row"><th>1</th><td colspan="4">九月 · 渠道回款汇总 <span>财务部 / 09.08</span></td></tr>
            <tr class="sheet-heading"><th>2</th><td>渠道</td><td>经办人</td><td>状态</td><td>实收金额 / 元</td></tr>
            <tr><th>3</th><td>华东渠道</td><td>林一</td><td><span class="paid">已到账</span></td><td>42,800.00</td></tr>
            <tr><th>4</th><td>华南渠道</td><td>陈默</td><td><span class="paid">已到账</span></td><td>36,900.00</td></tr>
            <tr><th>5</th><td>华北渠道</td><td>许知</td><td><span class="paid">已到账</span></td><td>48,900.00</td></tr>
            <tr class="empty-row"><th>6</th><td></td><td></td><td></td><td></td></tr>
            <tr class="total-row"><th>7</th><td colspan="3">本期回款合计</td><td class="editable-cell"><label class="sr-only" for="total-input">回款合计金额</label><input id="total-input" inputmode="numeric" type="text" value="128000" maxlength="12" autocomplete="off"/><span class="cell-handle"></span></td></tr>
            <tr class="empty-row"><th>8</th><td></td><td></td><td></td><td></td></tr>
          </tbody></table>
          <div class="work-footer"><span id="work-feedback">合计好像没更新，改好后确认一下。</span><button id="verify">核对并保存 <span>↵</span></button></div></div>
          <div class="sheet-bottom"><span>＋</span><b>九月汇总</b><span>渠道明细</span><small>100% ────●─</small></div>
        </section>
        <section class="break-app" id="break-app" role="tabpanel" aria-labelledby="break-tab" hidden>
          <div class="break-heading"><span>窗外 / A LITTLE ESCAPE</span><span>只属于你的片刻</span></div>
          <div class="escape-view"><div class="escape-sun"></div><div class="escape-hill hill-back"></div><div class="escape-hill hill-front"></div><div class="escape-water"></div><div class="escape-ripple"></div><div class="escape-copy"><span>不必每一秒，都有意义。</span><h2>发一会儿呆。</h2><p>山没有赶路，云也是。</p></div><span class="escape-caption">呼吸慢一点 &nbsp; · &nbsp; 偶尔看看走廊</span></div>
          <button class="return-work" id="return-work">${icon('back')} 回到表格 <kbd>Space</kbd></button>
        </section>
        <div class="computer-taskbar"><span class="taskbar-app">X</span><span>◌</span><span class="taskbar-divider"></span><span>▱</span><small>⌁ &nbsp; 简 &nbsp; ▰</small></div>
      </div><div class="monitor-brand">MONDAY</div></div>
      <div class="monitor-neck"></div><div class="monitor-base"></div>
    </section>

    <div class="finance-message" id="finance-message"><span class="message-avatar">林</span><div><b>林一 <small>财务</small></b><p>到账单是 <strong>128,600 元</strong>，<br/>帮忙更新合计，就可以收工啦。</p></div><button id="dismiss-message" aria-label="收起财务消息">×</button></div>
    <button class="coffee-hotspot" id="coffee" aria-label="喝一口水，正常休息"><span class="hotspot-dot"></span><span class="object-label">喝口水 <kbd>C</kbd></span></button>
    <div class="sip-feedback" aria-hidden="true"><span>一口温水。肩膀慢慢放松。</span></div>

    <div class="phone-wrap" id="phone-wrap">
      <div class="phone-shadow" aria-hidden="true"></div>
      <div class="phone" id="phone" role="button" tabindex="0" aria-label="拿起手机，P 键也可操作" aria-describedby="phone-tip">
        <img class="phone-hand" src="./public/assets/phone-hand.png" alt="" aria-hidden="true" draggable="false"/>
        <div class="phone-speaker"></div><div class="phone-display">
          <div class="phone-top"><span>17:58</span><span>▮▮▮ ▰</span></div>
          <div class="phone-lock"><span class="lock-mark">⌁</span><div class="lock-time">17:58</div><p>9 月 8 日 星期五</p><div class="phone-notification"><span>小林 · 刚刚</span><b>周末出逃小分队</b><p>找到一家海边民宿，要不要去？</p></div><span class="phone-pick-hint">点一下，拿起来看看</span></div>
          <div class="phone-feed"><div class="feed-header">周末出逃小分队 <span>•••</span></div><div class="chat-bubble">小林<span>找到一家海边民宿。<br/>老板在看文件，快看一眼。</span></div><div class="sea-photo"><span>把周五，<br/>留在岸上。</span><small>WEEKEND, PLEASE.</small></div><div class="chat-bubble reply-bubble"><span>人还在工位，心已经到了。</span></div><div class="feed-bottom">向上轻划，翻到下一条 ↑</div></div>
          <div class="phone-home"></div>
        </div>
      </div>
      <span class="phone-tip" id="phone-tip">${icon('phone')} 看一眼手机 <kbd>P</kbd></span>
      <button class="stow-button" id="stow">收好手机 <span>↓</span></button>
    </div>
    <button class="drawer-target" id="drawer" aria-label="将手机放入抽屉"><span></span><small>放进抽屉</small></button>
    </div>

    <div class="dialogue" id="dialogue" role="status" aria-live="polite"><span class="dialogue-name">邻座 · 小林</span><p id="dialogue-text">今天的风很好。把最后一笔核完，就歇一会儿吧。</p></div>
    <div class="boss-question" id="boss-question" hidden><span>经理 · 顺便问一句</span><p>“刚才那笔回款，最后合计多少？”</p><div><button data-reply="128600">128,600 元，已经核过了。</button><button data-reply="128000">应该是 128,000 元。</button><button data-reply="ask">您说的是九月渠道回款吗？</button></div></div>
  </section>

  <section class="look-controls" aria-label="环顾办公室">
    <div class="look-directions"><button data-look="-90" aria-label="向左看">‹</button><button data-look="0" id="look-heading" title="点击回到工位">面向工位</button><button data-look="180" aria-label="转身看后面" title="看身后">↶</button><button data-look="90" aria-label="向右看">›</button></div>
    <label class="sr-only" for="look-direction">环顾角度</label><input id="look-direction" type="range" min="-180" max="180" step="1" value="0"/>
    <div class="people-status"><button data-track="boss"><span class="person-bearing">↑</span><span>经理</span><b class="person-distance">8.6 m</b></button><button data-track="lin"><span class="person-bearing">↑</span><span>小林</span><b class="person-distance">2.8 m</b></button></div>
    <small class="look-instruction">拖动空白处环顾 · 点击人物距离看向他</small>
  </section>
  <button id="look-held-phone" hidden>手机还在手里 · 点此收好 ↓</button>
  <div id="room-error" hidden>环顾场景未能加载。<button id="retry-room">重新加载</button></div>

  <footer class="bottom-bar"><div class="rest-meter"><span class="meter-icon">◌</span><div><span>偷回一点时间 <b><span id="joy-value">0.0</span><small> / 20 秒</small></b></span><div class="meter-track"><i id="joy-fill"></i></div></div></div><div class="context-status"><span id="status-dot"></span><span id="context-text">安心坐下，慢慢来</span></div><div class="remaining"><span>距离下班</span><b id="remaining">01:30</b></div></footer>
  <div class="keyboard-hints"><span><kbd>← →</kbd> 转头环顾</span><span><kbd>Space</kbd> 回工位与表格</span><span><kbd>P</kbd> 拿起 / 收好手机</span><span><kbd>Esc</kbd> 暂停</span></div>
  <div class="risk-line" aria-hidden="true"><i id="risk-fill"></i></div>

  <div class="overlay" id="welcome"><section class="intro-card" aria-labelledby="intro-title"><span class="intro-eyebrow"><i></i> 一段可以亲手操作的办公室日常</span><p class="intro-chapter">第五幕 / 工位上的小自由</p><h2 id="intro-title">认真工作，<br/>顺便<span>偷个闲。</span></h2><p class="intro-description">周五，17:58。窗外的光刚刚好。<br/>还剩一笔回款，和一点想留给自己的时间。</p><div class="intro-objectives"><span><b>01</b> 核对回款</span><span><b>02</b> 放空 20 秒</span><span><b>03</b> 自然地收尾</span></div><button class="primary-button" id="start">坐下来，开始上班 ${icon('arrow')}</button><p class="intro-footnote">戴上耳机，听听办公室。右上角可关闭环境音。</p><span class="intro-edition">90 SECOND OFFICE ESCAPE &nbsp; / &nbsp; VOL. 01</span></section></div>
  <dialog id="pause-dialog"><button class="dialog-close" id="close-pause" aria-label="关闭并继续游戏">×</button><span class="modal-eyebrow">TAKE YOUR TIME</span><h2>时间，先停在这里。</h2><p>切到别处时也会自动暂停。回来再继续。</p><div class="help-rows"><span>空白处拖动 / <kbd>← →</kbd></span><b>转头环顾；点击人物距离看向他</b><span>方向文字 / <kbd>Home</kbd></span><b>回到工位；上下方向键抬头低头</b><span>电脑标签 / <kbd>Space</kbd></span><b>打开窗外 / 回到表格</b><span>手机 / <kbd>P</kbd></span><b>拿起、收好；也可拖向抽屉</b><span>杯子 / <kbd>C</kbd></span><b>喝水是正常休息</b><span>手机向下轻划</span><b>自然收好，动作完成前仍可见</b></div><p class="help-note">合计改为财务给出的金额后保存。环顾时人物照常走动，读屏休息暂不计时。经理先有动作再靠近，电脑和手机需要分别收尾；转身不会收好手机。<br/><a href="./public/assets/audio/LICENSE.md" target="_blank" rel="noopener">音效素材与署名 · Nicole Marie T 等</a></p><button class="primary-button" id="resume">继续这一刻 ${icon('arrow')}</button><button class="text-button" id="restart">重新开始这一局</button></dialog>
  <dialog id="result-dialog"><span class="modal-eyebrow" id="result-eyebrow">OFF THE CLOCK</span><h2 id="result-title">今天，就到这里。</h2><p id="result-reason"></p><div class="result-stats"><div><b id="result-joy"></b><span>留给自己的秒数</span></div><div><b id="result-work"></b><span>最后一笔工作</span></div></div><p id="result-note"></p><button class="primary-button" id="retry">再过一个周五 ${icon('arrow')}</button></dialog>
  <div class="asset-error" id="asset-error" hidden>办公室场景未能加载。<button id="reload-assets">重新加载场景</button></div>
</main>`;

const $ = (selector) => document.querySelector(selector);
let game = createGame(1);
let run = 1;
const audio = createSound();
let soundTouched = false;
let previousBoss = '';
let previousPhone = 'down';
let previousCup = 0;
let lastTime = 0;
let previousHint = '';
let messageDismissed = false;
let dragging = null;
let phoneFeedIndex = 0;
const root = $('.game');
const look = createLook(root, () => game);
root.addEventListener('office-room-error', () => {
  look.stop();
  if (game.phase === 'playing') act(game, 'pause');
  clearDrag();
  $('#pause-dialog').close();
  audio.suspend();
  render();
});
root.addEventListener('office-room-ready', () => { if (game.phase === 'paused') pause(); });

function playAction(type, payload) {
  if (game.phase !== 'playing' && !['start', 'resume', 'pause'].includes(type)) return;
  if (type === 'switchApp' || (type === 'phoneToggle' && game.phone === 'down')) look.center();
  act(game, type, payload);
  if (['switchApp', 'verify', 'reply'].includes(type)) audio.click();
  if (type === 'verify') {
    $('#work-feedback').textContent = game.work ? '已核对，合计 128,600 元。可以安心收工。' : '与到账单还对不上。林一发来的金额是 128,600 元。';
    if (!game.work) $('#total-input').focus();
  }
  render();
}

function begin() {
  if (!look.ready) return;
  playAction('start');
  if (!soundTouched && !audio.enabled) toggleSound();
  else if (audio.enabled) audio.resume();
  $('#welcome').hidden = true;
  $('#work-tab').focus({ preventScroll: true });
}

function pause(showHelp = false) {
  look.stop();
  if (game.phase === 'playing') playAction('pause');
  if (game.phase === 'paused' || (showHelp && game.phase === 'ready')) {
    if (!$('#pause-dialog').open) $('#pause-dialog').showModal();
  }
  clearDrag();
  audio.suspend();
}

function resume() {
  $('#pause-dialog').close();
  if (!look.ready) return;
  if (game.phase === 'paused') playAction('resume');
  lastTime = performance.now();
  if (audio.enabled) audio.resume();
}

function restart() {
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  clearDrag();
  game = createGame(++run);
  look.reset();
  previousBoss = '';
  previousHint = '';
  previousPhone = 'down';
  previousCup = 0;
  audio.reset();
  messageDismissed = false;
  $('#total-input').value = '128000';
  $('#formula-value').textContent = '128000';
  $('#total-input').disabled = false;
  $('#work-feedback').textContent = '合计好像没更新，改好后确认一下。';
  $('#finance-message').hidden = false;
  $('#verify').textContent = '核对并保存 ↵';
  lastTime = performance.now();
  begin();
  if (audio.enabled) audio.resume();
}

$('#start').addEventListener('click', begin);
$('#pause').addEventListener('click', () => pause());
$('#help').addEventListener('click', () => pause(true));
$('#resume').addEventListener('click', resume);
$('#close-pause').addEventListener('click', resume);
$('#pause-dialog').addEventListener('cancel', (event) => { event.preventDefault(); resume(); });
$('#result-dialog').addEventListener('cancel', (event) => event.preventDefault());
$('#restart').addEventListener('click', restart);
$('#retry').addEventListener('click', restart);
$('#work-tab').addEventListener('click', () => playAction('switchApp', 'work'));
$('#break-tab').addEventListener('click', () => playAction('switchApp', 'break'));
$('#return-work').addEventListener('click', () => playAction('switchApp', 'work'));
$('#verify').addEventListener('click', () => playAction('verify', Number($('#total-input').value.replace(/[,，\s]/g, ''))));
$('#total-input').addEventListener('input', () => { $('#formula-value').textContent = $('#total-input').value; audio.key(); });
$('#total-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('#verify').click(); });
$('#total-input').addEventListener('focus', () => playAction('focus', 'work'));
$('#stow').addEventListener('click', () => playAction('stow'));
$('#look-held-phone').addEventListener('click', () => playAction('stow'));
$('#drawer').addEventListener('click', () => playAction('stow'));
$('#coffee').addEventListener('click', () => playAction('sip'));
$('#dismiss-message').addEventListener('click', () => { messageDismissed = true; $('#finance-message').hidden = true; });
document.querySelectorAll('[data-reply]').forEach((button) => button.addEventListener('click', () => playAction('reply', button.dataset.reply === 'ask' ? 'ask' : Number(button.dataset.reply))));
async function toggleSound() {
  await audio.toggle();
  $('#sound').setAttribute('aria-pressed', String(audio.enabled));
  $('#sound').setAttribute('aria-label', audio.enabled ? '关闭环境音' : '打开环境音');
  $('#sound').title = audio.enabled ? '关闭环境音' : '打开环境音';
  if (game.phase !== 'playing') audio.suspend();
}
$('#sound').addEventListener('click', () => { soundTouched = true; toggleSound(); });
$('#fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.requestFullscreen(); } catch { $('#fullscreen').hidden = true; }
});
if (!document.fullscreenEnabled) $('#fullscreen').hidden = true;

function clearDrag() {
  if (dragging && $('#phone').hasPointerCapture(dragging.id)) $('#phone').releasePointerCapture(dragging.id);
  dragging = null;
  $('#phone-wrap').style.removeProperty('--drag-x');
  $('#phone-wrap').style.removeProperty('--drag-y');
  root.classList.remove('dragging-phone');
}
$('#phone').addEventListener('pointerdown', (event) => {
  if (game.phase !== 'playing' || event.button > 0) return;
  dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, up: game.phoneProgress > 0.9 };
  $('#phone').setPointerCapture(event.pointerId);
  playAction('focus', 'phone');
});
$('#phone').addEventListener('pointermove', (event) => {
  if (!dragging || dragging.id !== event.pointerId) return;
  dragging.dx = event.clientX - dragging.x;
  dragging.dy = event.clientY - dragging.y;
  if (dragging.up) {
    $('#phone-wrap').style.setProperty('--drag-x', `${Math.max(-160, Math.min(160, dragging.dx))}px`);
    $('#phone-wrap').style.setProperty('--drag-y', `${Math.max(-70, Math.min(250, dragging.dy))}px`);
    root.classList.toggle('dragging-phone', dragging.dy > 20);
  }
});
$('#phone').addEventListener('pointerup', () => {
  if (!dragging) return;
  const { dx, dy, up } = dragging;
  if (up && dy > 45) playAction('stow');
  else if (up && dy < -35) {
    phoneFeedIndex++;
    $('.reply-bubble span').textContent = ['人还在工位，心已经到了。', '周末别定闹钟，自然醒。', '等下班，一起去吹吹风。'][phoneFeedIndex % 3];
    audio.click();
  } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) playAction('phoneToggle');
  clearDrag();
});
$('#phone').addEventListener('pointercancel', () => { clearDrag(); pause(); });
$('#phone').addEventListener('lostpointercapture', clearDrag);
$('#phone').addEventListener('keydown', (event) => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (!event.repeat) playAction('phoneToggle'); } });

document.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.key === 'Escape') { if (!$('#pause-dialog').open && game.phase === 'playing') { event.preventDefault(); pause(); } return; }
  if (game.phase !== 'playing' || event.target.matches('input, textarea, select')) return;
  if (event.code === 'Space') {
    if (event.target.closest('button,a') && !event.target.closest('[role="tab"],#return-work')) return;
    event.preventDefault(); playAction('switchApp', 'work');
  }
  if (event.code === 'KeyP') { event.preventDefault(); playAction('phoneToggle'); }
  if (event.code === 'KeyC') { event.preventDefault(); playAction('sip'); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game.phase === 'playing') pause(); });
window.addEventListener('blur', () => { if (game.phase === 'playing') pause(); });
window.addEventListener('pagehide', () => { clearDrag(); audio.suspend(); });

for (const img of document.querySelectorAll('.world img, .room-person img, .phone-hand')) img.addEventListener('error', () => { $('#asset-error').hidden = false; if (game.phase === 'playing') pause(); });
$('#reload-assets').addEventListener('click', () => {
  $('#asset-error').hidden = true;
  for (const img of document.querySelectorAll('.world img, .room-person img, .phone-hand')) img.src = img.src.split('?')[0] + '?retry=' + Date.now();
});

function render() {
  const boss = getBoss(game);
  const playing = game.phase === 'playing';
  root.dataset.phase = game.phase;
  root.dataset.boss = boss.phase;
  root.dataset.side = boss.side;
  root.dataset.phone = game.phone;
  root.dataset.app = game.app;
  $('.scene').inert = game.phase === 'ready';
  $('.phone-feed').setAttribute('aria-hidden', String(game.phoneProgress < 0.9));
  $('.phone-lock').setAttribute('aria-hidden', String(game.phoneProgress >= 0.9));
  root.classList.toggle('working-done', Boolean(game.work));
  root.classList.toggle('sipping', game.cupProgress > 0);
  root.style.setProperty('--phone-progress', game.phoneProgress.toFixed(4));
  root.style.setProperty('--risk', game.suspicion / 100);
  $('#boss-label').textContent = boss.label;
  $('#boss-detail').textContent = boss.detail;
  $('#joy-value').textContent = game.joy.toFixed(1);
  $('#joy-fill').style.width = `${Math.min(100, game.joy / 20 * 100)}%`;
  $('#risk-fill').style.width = `${game.suspicion}%`;
  $('#work-task').classList.toggle('completed', Boolean(game.work));
  $('#joy-task').classList.toggle('completed', game.joy >= 20);
  const seconds = Math.max(0, Math.ceil(game.duration - game.elapsed));
  $('#remaining').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const officeSeconds = 17 * 3600 + 58 * 60 + 30 + Math.floor(game.elapsed);
  $('#office-time').textContent = [Math.floor(officeSeconds / 3600), Math.floor(officeSeconds / 60) % 60, officeSeconds % 60].map(value => String(value).padStart(2, '0')).join(':');
  $('#desktop-time').textContent = $('#office-time').textContent.slice(0, 5);
  $('#work-app').hidden = game.app !== 'work';
  $('#break-app').hidden = game.app !== 'break';
  $('#work-tab').setAttribute('aria-selected', String(game.app === 'work'));
  $('#break-tab').setAttribute('aria-selected', String(game.app === 'break'));
  $('#total-input').disabled = Boolean(game.work) || !playing;
  $('#verify').disabled = Boolean(game.work) || !playing;
  if (game.work) { $('#verify').textContent = '已保存 ✓'; $('#formula-value').textContent = '128600'; }
  $('#phone').setAttribute('aria-label', game.phone === 'down' ? '拿起手机，P 键也可操作' : '收好手机，P 键也可操作');
  $('#stow').hidden = game.phone === 'down';
  $('#phone-tip').hidden = game.phone !== 'down';
  const questioning = boss.question && !game.questionAnswered && playing;
  $('#boss-question').hidden = !questioning;
  $('[data-reply="ask"]').disabled = Boolean(game.questionExtended);
  if (!messageDismissed) $('#finance-message').hidden = game.work || game.elapsed > 19;

  let status = '走廊安静，可以喘口气';
  if (game.phase === 'ready') status = '安心坐下，慢慢来';
  else if (game.suspicion > 55) status = '经理有些在意，先把现场收好';
  else if (boss.canSee) status = '经理在身边，自然一点';
  else if (['warning', 'approaching'].includes(boss.phase)) status = '有人要经过，留点时间收尾';
  else if (game.phone === 'lowering') status = '放下屏幕，手机正在收好';
  else if (game.phone === 'raising') status = '拿起来，目光落在屏幕上';
  else if (look.lookingAway) status = '正在观察四周 · 转头不会收好手机';
  else if ((game.focus === 'break' && game.app === 'break') || (game.focus === 'phone' && game.phone === 'up')) status = '这一小会儿，属于你';
  else if (game.phone === 'up') status = '注意力回到了电脑，手机还在手里';
  $('#context-text').textContent = status;
  $('#status-dot').classList.toggle('alert', game.suspicion > 30 || boss.canSee);
  if (game.hint && game.hint !== previousHint) {
    previousHint = game.hint;
    $('#dialogue-text').textContent = game.hint;
    $('.dialogue-name').textContent = boss.question || game.lastEvent.startsWith('question-') ? '经理 · 经过工位' : '工位里的片刻';
  }
  $('#dialogue').classList.toggle('quiet', game.elapsed > 8 && (!game.hint || game.elapsed > game.hintUntil));

  if (playing && previousBoss !== boss.phase) {
    if (boss.phase === 'warning') audio.paper();
    if (boss.phase === 'away' && previousBoss === 'leaving') audio.exhale();
  }
  previousBoss = boss.phase;
  if (playing && game.phone === 'down' && previousPhone === 'lowering') audio.place();
  if (playing && game.phone === 'raising' && previousPhone !== 'raising') audio.cloth();
  if (playing && game.cupProgress >= .85 && previousCup < .85) audio.sip();
  if (playing && !game.cupProgress && previousCup) audio.place();
  previousPhone = game.phone;
  previousCup = game.cupProgress;
  audio.update(look.people, game.elapsed, look.yaw, playing);
  if (['won', 'lost'].includes(game.phase) && !$('#result-dialog').open) showResult();
}

function showResult() {
  look.stop();
  clearDrag();
  const won = game.phase === 'won';
  $('#result-eyebrow').textContent = won ? 'OFF THE CLOCK / 18:00' : 'A SMALL OFFICE INCIDENT';
  $('#result-title').textContent = won ? '收工。周末是你的了。' : '嗯……被叫住了。';
  $('#result-reason').textContent = game.endedReason || (won ? '最后一笔回款已核对。手机收好了，窗外的光还在。' : '这次没来得及好好收尾。');
  $('#result-joy').textContent = game.joy.toFixed(1) + 's';
  $('#result-work').textContent = game.work ? '已完成' : '待核对';
  $('#result-note').textContent = won ? '你没有赢过谁。只是给自己，留了一点空白。' : '看看来路，给动作留一点时间。下一局会换一条巡查路线。';
  $('#result-dialog').showModal();
  audio.suspend();
}

function frame(now) {
  const dt = lastTime ? Math.max(0, (now - lastTime) / 1000) : 0;
  look.update(dt);
  act(game, 'look', look.lookingAway);
  advance(game, dt);
  lastTime = now;
  render();
  requestAnimationFrame(frame);
}
render();
requestAnimationFrame(frame);
