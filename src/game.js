export const TOTAL = 128600;
export const JOY_TARGET = 20;

const EPSILON = 1e-9;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createGame(seed = 1) {
  return {
    seed,
    route: Number.isFinite(seed) ? ((Math.trunc(seed) - 1) % 2 + 2) % 2 : 0,
    elapsed: 0,
    duration: 90,
    phase: 'ready',
    app: 'work',
    focus: 'work',
    lookingAway: false,
    phone: 'down',
    phoneProgress: 0,
    phoneSpeed: 1 / 0.75,
    quickClosing: false,
    noiseUntil: 0,
    cupActive: false,
    cupElapsed: 0,
    cupProgress: 0,
    drinkJoy: 0,
    joy: 0,
    suspicion: 0,
    work: 0,
    selectedCell: null,
    answer: null,
    questionAnswered: false,
    questionExtended: false,
    questionMissed: false,
    replyCooldownUntil: 0,
    hint: '核对本月总额，再给自己留二十秒。过道里的动静值得留意。',
    hintUntil: 7,
    lastEvent: '',
    eventId: 0,
    evidence: '',
    endedReason: '',
  };
}

export function visits(state) {
  const offset = state.route * 2;
  return [
    { start: 21 + offset, end: 36 + offset, side: state.route ? 'right' : 'left', question: false },
    { start: 54 + offset, end: 72 + offset + (state.questionExtended ? 4 : 0), side: state.route ? 'left' : 'right', question: true },
  ];
}

export function getBoss(state) {
  for (const visit of visits(state)) {
    const t = state.elapsed;
    if (t < visit.start - EPSILON || t >= visit.end + 5 - EPSILON) continue;
    let phase;
    let progress;
    if (t < visit.start + 4 - EPSILON) {
      phase = 'warning';
      progress = (t - visit.start) / 4;
    } else if (t < visit.start + 9 - EPSILON) {
      phase = 'approaching';
      progress = (t - visit.start - 4) / 5;
    } else if (t < visit.end - EPSILON) {
      phase = 'watching';
      progress = (t - visit.start - 9) / (visit.end - visit.start - 9);
    } else {
      phase = 'leaving';
      progress = (t - visit.end) / 5;
    }
    const sideText = visit.side === 'left' ? '左' : '右';
    const question = visit.question && phase === 'watching' && !state.questionAnswered;
    const lines = {
      warning: ['有人起身', `${sideText}边传来翻动文件的声音，经理准备沿过道过来了。`],
      approaching: ['脚步靠近', `${sideText}侧的脚步越来越近，他正沿过道走向你的工位。`],
      watching: question
        ? ['经理在等你回答', '“这三笔一共多少？我带去开会。”总额就在表格里。']
        : ['经理在工位旁', state.questionAnswered ? '“好，我就用这个数。”他把数字记在文件上。' : '他停下来翻看文件，抬眼便能看到你的桌面。'],
      leaving: ['脚步渐远', '他把文件夹合上，转身朝会议室走去。'],
    };
    return {
      phase,
      label: lines[phase][0],
      detail: lines[phase][1],
      side: visit.side,
      progress: clamp(progress, 0, 1),
      canSee: phase === 'watching' || (phase === 'approaching' && progress >= 0.6 - EPSILON) || (phase === 'leaving' && progress < 0.3 - EPSILON),
      question,
    };
  }
  return {
    phase: 'away',
    label: '办公室的寻常片刻',
    detail: state.elapsed < 20 ? '窗边传来断续的键盘声，小林还在改他的第七版方案。' : '过道暂时安静了下来。窗边有人轻轻敲着键盘。',
    side: state.route ? 'right' : 'left',
    progress: 0,
    canSee: false,
    question: false,
  };
}

function cue(state, event, hint, duration = 4) {
  state.lastEvent = event;
  state.eventId += 1;
  if (hint) {
    state.hint = hint;
    state.hintUntil = state.elapsed + duration;
  }
}

function finish(state) {
  if (state.work < 1) state.endedReason = '临走前，表格的总额还没有核对。下次先把这件小事做好。';
  else if (state.joy + EPSILON < JOY_TARGET) state.endedReason = '工作做完了，却没有留够二十秒给自己。安静的间隙可以放心休息。';
  else if (state.phone !== 'down') state.endedReason = '时间到了，手机还没放稳。下次给收尾留一点余量。';
  else if (state.app !== 'work') state.endedReason = '离开前忘了把电脑切回工作表，休闲页面还亮着。';
  else state.endedReason = '总额核对好了，也给自己留出了片刻。今天的节奏，刚刚好。';
  state.phase = state.work >= 1 && state.joy + EPSILON >= JOY_TARGET && state.phone === 'down' && state.app === 'work' ? 'won' : 'lost';
  cue(state, state.phase, state.endedReason);
}

export function act(state, type, payload) {
  if (type === 'start' && state.phase === 'ready') {
    state.phase = 'playing';
    cue(state, 'start');
    return state;
  }
  if (type === 'pause' && state.phase === 'playing') {
    state.phase = 'paused';
    return state;
  }
  if (type === 'resume' && state.phase === 'paused') {
    state.phase = 'playing';
    return state;
  }
  if (state.phase !== 'playing') return state;

  if (type === 'look' && typeof payload === 'boolean') {
    state.lookingAway = payload;
  } else if (type === 'switchApp' && ['work', 'break'].includes(payload)) {
    state.app = payload;
    state.focus = payload;
    cue(state, 'switch', payload === 'work' ? '表格回到了屏幕上。手里的手机仍要单独放好。' : '鼠标点开了收藏的风景页，先让脑子透透气。');
  } else if (type === 'focus' && ['work', 'break', 'phone'].includes(payload)) {
    if ((payload === 'phone' && state.phoneProgress > 0) || payload === state.app) state.focus = payload;
  } else if (type === 'phoneToggle') {
    if (state.phone === 'up' || state.phone === 'raising') return act(state, 'stow');
    if (state.cupActive) {
      cue(state, 'hands-busy', '先把杯子放稳，再拿手机。');
      return state;
    }
    state.phone = 'raising';
    state.quickClosing = false;
    state.focus = 'phone';
    cue(state, 'phone-lift', '拇指点亮屏幕。拿起来、放回去，都需要一点时间。');
  } else if ((type === 'stow' || type === 'quickStow') && state.phone !== 'down') {
    state.phone = 'lowering';
    state.phoneSpeed = 1 / (type === 'quickStow' ? 0.35 : 0.75);
    state.quickClosing = type === 'quickStow';
    state.focus = state.app;
    cue(state, 'phone-stow', state.quickClosing ? '手收得有些急，手机可能碰响桌沿。' : '把手机慢慢放到桌沿下面，手重新回到鼠标旁。');
  } else if (type === 'sip' && !state.cupActive) {
    if (state.phone !== 'down') {
      cue(state, 'hands-busy', '先放下手机，腾出手拿杯子。');
      return state;
    }
    state.cupActive = true;
    state.cupElapsed = 0;
    state.focus = 'cup';
    cue(state, 'sip', '喝口水，缓一缓。正常休息不用躲。');
  } else if (type === 'verify') {
    if (state.app !== 'work' || !Number.isFinite(payload)) return state;
    state.answer = payload;
    state.focus = 'work';
    if (payload === TOTAL) {
      state.work = 1;
      cue(state, 'work-done', '42,800 + 36,900 + 48,900 = 128,600。已核对，经理问起也有底。', 6);
    } else {
      cue(state, 'work-recheck', '数字还没对上。再加一遍这三笔金额，不用赶。');
    }
  } else if (type === 'reply' && getBoss(state).question && state.elapsed >= state.replyCooldownUntil) {
    if (payload === 'ask') {
      if (!state.questionExtended) {
        state.questionExtended = true;
        cue(state, 'question-clarify', '“是这三笔的合计，对吧？”经理点点头，给你几秒重新看表。', 6);
      }
    } else if (Number.isFinite(payload)) {
      state.replyCooldownUntil = state.elapsed + 0.8;
      if (payload === TOTAL) {
        state.questionAnswered = true;
        state.suspicion = Math.max(0, state.suspicion - 10);
        cue(state, 'question-right', '“十二万八千六。”经理点点头：“好，我带去开会。”', 6);
      } else {
        state.suspicion = Math.min(99, state.suspicion + 16);
        cue(state, 'question-wrong', '“好像不对，再核一下？”经理等着。表格还在，可以重新回答。', 5);
      }
    }
  }
  return state;
}

export function advance(state, dt) {
  if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return state;
  const target = Math.min(state.duration, state.elapsed + dt);
  while (state.elapsed < target - EPSILON && state.phase === 'playing') {
    const boss = getBoss(state);
    const route = visits(state);
    // Split at physical and story events, so a slow frame never skips a warning or a phone's final movement.
    const boundaries = route.flatMap(({ start, end }) => [start, start + 4, start + 7, start + 9, end, end + 1.5, end + 5]);
    if (state.phone === 'raising') boundaries.push(state.elapsed + (1 - state.phoneProgress) * 0.65);
    if (state.phone === 'lowering') boundaries.push(state.elapsed + state.phoneProgress / state.phoneSpeed);
    if (state.cupActive) boundaries.push(state.elapsed + 2 - state.cupElapsed);
    if (state.noiseUntil > state.elapsed) boundaries.push(state.noiseUntil);
    let next = Math.min(target, ...boundaries.filter((time) => time > state.elapsed + EPSILON));

    const phoneEvidence = state.phoneProgress > EPSILON || state.phone === 'raising';
    const screenEvidence = state.app === 'break';
    const noiseEvidence = state.noiseUntil > state.elapsed + EPSILON;
    const evidence = boss.canSee ? (phoneEvidence ? 'phone' : screenEvidence ? 'screen' : noiseEvidence ? 'noise' : '') : '';
    const rate = boss.canSee && evidence ? (phoneEvidence ? 12 : 0) + (screenEvidence ? 11 : 0) + (noiseEvidence ? 4 : 0) : boss.canSee ? -2.4 : -0.65;
    if (rate > 0) next = Math.min(next, state.elapsed + (100 - state.suspicion) / rate);
    const step = next - state.elapsed;
    state.evidence = evidence;
    state.suspicion = clamp(state.suspicion + rate * step, 0, 100);

    if (state.cupActive) {
      const rest = Math.min(step, 4 - state.drinkJoy);
      state.drinkJoy += rest;
      state.joy += rest;
    } else if (!state.lookingAway && ((state.focus === 'phone' && state.phone === 'up') || (state.focus === 'break' && state.app === 'break'))) {
      state.joy += step;
    }

    state.elapsed = next;
    if (state.phone === 'raising') {
      state.phoneProgress = clamp(state.phoneProgress + step / 0.65, 0, 1);
      if (state.phoneProgress >= 1 - EPSILON) {
        state.phoneProgress = 1;
        state.phone = 'up';
      }
    } else if (state.phone === 'lowering') {
      state.phoneProgress = clamp(state.phoneProgress - step * state.phoneSpeed, 0, 1);
      if (state.phoneProgress <= EPSILON) {
        state.phoneProgress = 0;
        state.phone = 'down';
        if (state.quickClosing) {
          state.noiseUntil = state.elapsed + 2;
          cue(state, 'phone-thud', '“嗒。”手机碰了一下桌沿，近处的人听得见。');
          state.quickClosing = false;
        } else cue(state, 'phone-down');
      }
    }
    if (state.cupActive) {
      state.cupElapsed = Math.min(2, state.cupElapsed + step);
      state.cupProgress = Math.sin((state.cupElapsed / 2) * Math.PI);
      if (state.cupElapsed >= 2 - EPSILON) {
        state.cupActive = false;
        state.cupProgress = 0;
        state.focus = state.app;
        cue(state, 'cup-down');
      }
    }

    const after = getBoss(state);
    if (after.phase !== boss.phase) cue(state, `boss-${after.phase}`, after.detail, after.question ? 9 : 5);
    if (state.elapsed >= route[1].end - EPSILON && !state.questionAnswered && !state.questionMissed && state.suspicion < 100 - EPSILON) {
      state.questionMissed = true;
      state.suspicion = Math.min(99, state.suspicion + 18);
      cue(state, 'question-missed', '“先核好发我吧。”经理带着疑问走了，下一段还有机会稳住节奏。', 6);
    }
    if (state.suspicion >= 100 - EPSILON) {
      state.suspicion = 100;
      const sideText = boss.side === 'left' ? '左' : '右';
      state.endedReason = evidence === 'phone' ? `经理从${sideText}侧过道看到了你一直亮着的手机。切回表格，也遮不住手里的屏幕。` : evidence === 'screen' ? '经理停在身旁时，电脑一直开着休闲页面。手机收好了，窗口也要单独切回来。' : '手机撞上桌沿的声音让经理回头，之前的疑心没来得及消退。';
      state.phase = 'lost';
      cue(state, 'lost', state.endedReason);
    } else if (state.elapsed >= state.duration - EPSILON) {
      state.elapsed = state.duration;
      finish(state);
    }
  }
  return state;
}
