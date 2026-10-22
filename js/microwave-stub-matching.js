/* Single/double shunt-stub teaching model. Actual voltage-Gamma coordinates. */
((global) => {
  'use strict';
  const TAU = 2 * Math.PI, EPS = 1e-11;
  const complex = (r, i = 0) => ({r, i});
  const abs = a => Math.hypot(a.r, a.i);
  const add = (a, b) => complex(a.r + b.r, a.i + b.i);
  const divide = (a, b) => {
    const scale = Math.max(Math.abs(b.r), Math.abs(b.i));
    if (scale < 1e-14) return null;
    const br = b.r / scale, bi = b.i / scale, ar = a.r / scale, ai = a.i / scale;
    const d = br * br + bi * bi;
    return complex((ar * br + ai * bi) / d, (ai * br - ar * bi) / d);
  };
  const gammaFromZ = z => divide(complex(z.r - 1, z.i), complex(z.r + 1, z.i));
  const gammaFromY = y => y ? divide(complex(1 - y.r, -y.i), complex(1 + y.r, y.i)) : complex(-1);
  const yFromGamma = g => divide(complex(1 - g.r, -g.i), complex(1 + g.r, g.i));
  const mod = (v, period) => ((v % period) + period) % period;
  const rotate = (g, distance) => {
    const t = -2 * TAU * distance, c = Math.cos(t), s = Math.sin(t);
    return complex(g.r * c - g.i * s, g.r * s + g.i * c);
  };
  const line = (y, distance) => yFromGamma(rotate(gammaFromY(y), distance));
  function susceptance(type, length, ratio = 1) {
    const t = TAU * length, s = Math.sin(t), c = Math.cos(t);
    if (type === 'short') return Math.abs(s) < 1e-13 ? (length > .25 ? Infinity : -Infinity) : -ratio * c / s;
    return Math.abs(c) < 1e-13 ? Infinity : ratio * s / c;
  }
  function lengthFromB(type, b, ratio = 1) {
    if (type === 'short') return Math.atan2(ratio, -b) / TAU;
    return Math.abs(b) < EPS ? 0 : mod(Math.atan2(b, ratio), Math.PI) / TAU;
  }
  function shunt(g, b) {
    if (!Number.isFinite(b)) return complex(-1); // infinite shunt admittance shorts the junction
    const p = complex(1 + g.r, g.i), jbp = complex(-b * p.i, b * p.r);
    return divide(complex(2 * g.r - jbp.r, 2 * g.i - jbp.i), complex(2 + jbp.r, jbp.i));
  }
  function solveSingle(z, type = 'short', ratio = 1) {
    const gl = gammaFromZ(z), radius = abs(gl);
    if (radius < EPS) return {status: 'matched', solutions: [{d: 0, bNear: 0, nearLength: lengthFromB(type, 0, ratio)}]};
    if (z.r <= 0 || radius >= 1 - 1e-12) return {status: 'reactive', solutions: []};
    const v = radius * Math.sqrt(Math.max(0, 1 - radius * radius));
    const solutions = [-1, 1].map(sign => {
      const g = complex(-radius * radius, sign * v), y = yFromGamma(g);
      const d = mod(Math.atan2(gl.i, gl.r) - Math.atan2(g.i, g.r), TAU) / (2 * TAU);
      return {d, bNear: -y.i, nearLength: lengthFromB(type, -y.i, ratio), yNear: y};
    }).sort((a, b) => a.d - b.d);
    return {status: 'two', solutions};
  }
  function solveDouble(z, distance, spacing, nearType = 'short', farType = 'short', ratio = 1) {
    const y1 = yFromGamma(rotate(gammaFromZ(z), distance));
    if (!y1 || y1.r <= EPS) return {status: 'reactive', solutions: [], first: y1};
    const g = y1.r, c = Math.cos(TAU * spacing), s = Math.sin(TAU * spacing);
    const build = B => {
      const bNear = B - y1.i, y2 = line(complex(g, B), spacing), bFar = -y2.i;
      return {d: distance, B, bNear, bFar, yNear: complex(g, B), yFar: y2,
        nearLength: lengthFromB(nearType, bNear, ratio), farLength: lengthFromB(farType, bFar, ratio)};
    };
    if (Math.abs(s) < 1e-10) {
      if (Math.abs(g - 1) > 1e-9) return {status: 'half-wave-forbidden', solutions: [], first: y1};
      return {status: 'family', first: y1, solutions: [build(y1.i)]}; // representative b1=0
    }
    const discriminant = g - g * g * s * s, limit = 1 / (s * s);
    const tolerance = 1e-12 * Math.max(1, Math.abs(g), Math.abs(g * g * s * s));
    if (discriminant < -tolerance) return {status: 'forbidden', solutions: [], first: y1, limit};
    const root = Math.sqrt(Math.abs(discriminant) <= tolerance ? 0 : Math.max(0, discriminant));
    const Bs = root === 0 ? [c / s] : [(c - root) / s, (c + root) / s];
    const solutions = Bs.map(build).sort((a, b) => a.nearLength - b.nearLength);
    return {status: solutions.length === 1 ? 'tangent' : 'two', solutions, first: y1, limit};
  }
  const presets = Object.freeze({
    single: Object.freeze({name: '期中 2022–2023：单短路支节', mode: 'single', r: 4, x: -1, z0: 50,
      d: .1, spacing: .125, feed: 0, nearType: 'short', farType: 'short', nearLength: .1, farLength: .25, ratio: 1, wavelengthMm: 60}),
    double: Object.freeze({name: '2024–2025 A：双短路支节', mode: 'double', r: 1.5, x: -1.2, z0: 50,
      d: .12, spacing: .125, feed: .24, nearType: 'short', farType: 'short', nearLength: .1, farLength: .25, ratio: 1, wavelengthMm: null}),
    mixed: Object.freeze({name: '2023–2024 A：近短路、远开路', mode: 'double', r: .6, x: -1.5, z0: 50,
      d: .05, spacing: .375, feed: 0, nearType: 'short', farType: 'open', nearLength: .1, farLength: .25, ratio: 1, wavelengthMm: null})
  });
  function circuit(state) {
    const gl = gammaFromZ(complex(state.r, state.x)), bn = susceptance(state.nearType, state.nearLength, state.ratio);
    const oneMinus = rotate(gl, state.d), onePlus = shunt(oneMinus, bn);
    const points = [gl, oneMinus, onePlus];
    const operations = [{kind: 'line', value: state.d}, {kind: 'shunt', value: bn}];
    if (state.mode === 'double') {
      const bf = susceptance(state.farType, state.farLength, state.ratio);
      const twoMinus = rotate(onePlus, state.spacing), twoPlus = shunt(twoMinus, bf);
      points.push(twoMinus, twoPlus, rotate(twoPlus, state.feed));
      operations.push({kind: 'line', value: state.spacing}, {kind: 'shunt', value: bf}, {kind: 'line', value: state.feed});
    }
    return {points, operations, inputGamma: points[points.length - 1], y: points.map(yFromGamma)};
  }
  function advance(start, operation, fraction) {
    if (fraction <= 0) return start;
    if (operation.kind === 'line') return rotate(start, operation.value * fraction);
    const b = Number.isFinite(operation.value) ? operation.value * fraction :
      fraction >= 1 ? operation.value : Math.sign(operation.value) * fraction / (1 - fraction);
    return shunt(start, b);
  }
  function sampleGrid(r, n = 160) {
    return [complex(1), ...Array.from({length: n + 1}, (_, k) => gammaFromZ(complex(r,
      Math.tan(-Math.PI / 2 + 1e-5 + (Math.PI - 2e-5) * k / n)))), complex(1)];
  }
  const model = Object.freeze({complex, abs, gammaFromZ, gammaFromY, yFromGamma, rotate, line, shunt,
    susceptance, lengthFromB, solveSingle, solveDouble, circuit, advance, presets, sampleGrid});
  if (typeof document === 'undefined') {
    if (typeof module === 'object' && module.exports) module.exports = model;
    return;
  }
  if (global.MicrowaveStubMatching) { global.MicrowaveStubMatching.init(); return; }

  const NS = 'http://www.w3.org/2000/svg', SELECTOR = '.mw-demo[data-mw-demo="stub-matching"]';
  const controllers = new Map(); let serial = 0;
  const node = (tag, attrs = {}, value = '', svg = false) => {
    const e = svg ? document.createElementNS(NS, tag) : document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (value) e.textContent = value; return e;
  };
  const svg = (tag, attrs, value) => node(tag, attrs, value, true);
  const clean = v => Math.abs(v) < 5e-9 ? 0 : v;
  const fixed = (v, digits = 6) => Number.isFinite(v) ? clean(v).toFixed(digits) : '∞';
  const fmt = a => a ? `${fixed(a.r)} ${clean(a.i) < 0 ? '−' : '+'} j${fixed(Math.abs(a.i))}` : '∞（短路面导纳）';
  const C = 240, R = 203, position = g => [C + R * g.r, C - R * g.i];
  const path = points => points.filter(Boolean).map((g, k) => {
    const [x, y] = position(g); return `${k ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`;
  }).join(' ');

  function mount(host) {
    if (controllers.has(host)) return;
    host.classList.add('mwt-lab'); const id = `mwt-${++serial}`;
    const state = {...presets.single, preset: 'single', progress: 0};
    let frame = 0, last = 0, playing = false, visible = true, solutionKey = '';
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)');
    const title = node('strong', {class: 'mwt-title'}, '支节匹配实验台：移动参考面，再在同一结点加电纳');
    const intro = node('p', {class: 'mwt-intro'}, '实际 Γ 坐标；蓝色为主线传播，橙色为并联电纳。每一步下方都列出所在参考面。两根支节之间的线段必须保留。');
    const buttons = node('div', {class: 'mwt-presets', role: 'group', 'aria-label': '历年题预设'});
    const makeButton = (parent, action, label, fn) => {
      const b = node('button', {type: 'button', 'data-mwt-action': action}, label); b.addEventListener('click', fn); parent.append(b); return b;
    };
    const presetButtons = {};
    Object.entries(presets).forEach(([key, p]) => { presetButtons[key] = makeButton(buttons, `preset-${key}`, p.name, () => loadPreset(key)); });
    const layout = node('div', {class: 'mwt-layout'}), figure = node('figure', {class: 'mwt-figure'});
    const chart = svg('svg', {viewBox: '0 0 480 480', role: 'img', 'aria-labelledby': `${id}-title ${id}-desc`});
    const chartTitle = svg('title', {id: `${id}-title`}, '单支节与双支节的实际反射系数轨迹');
    const description = svg('desc', {id: `${id}-desc`}); chart.append(chartTitle, description);
    const defs = svg('defs'), clip = svg('clipPath', {id: `${id}-clip`});
    clip.append(svg('circle', {cx: C, cy: C, r: R + 1})); defs.append(clip); chart.append(defs);
    const grid = svg('g', {'clip-path': `url(#${id}-clip)`});
    [0, .2, .5, 1, 2, 5].forEach(r => grid.append(svg('path', {d: path(sampleGrid(r)), class: 'mwt-grid'})));
    [-5, -2, -1, -.5, -.2, .2, .5, 1, 2, 5].forEach(x => {
      const points = Array.from({length: 161}, (_, k) => gammaFromZ(complex(Math.tan((Math.PI / 2 - 1e-5) * k / 160), x)));
      points.push(complex(1)); grid.append(svg('path', {d: path(points), class: 'mwt-grid'}));
    });
    grid.append(svg('path', {d: path([complex(-1), complex(1)]), class: 'mwt-grid'}));
    chart.append(grid, svg('circle', {cx: C, cy: C, r: R, class: 'mwt-boundary'}));
    const targets = svg('g'), paths = svg('g'), markers = svg('g'), labels = svg('g');
    chart.append(targets, paths, markers, labels);
    chart.append(svg('text', {x: 465, y: 234, 'text-anchor': 'end', class: 'mwt-axis'}, 'Re Γ'),
      svg('text', {x: 249, y: 22, class: 'mwt-axis'}, 'Im Γ'));
    const legend = node('figcaption', {class: 'mwt-legend'});
    [['主线传播', 'line'], ['加支节电纳', 'shunt'], ['第二面 g=1', 'target'], ['反推辅助圆', 'aux']].forEach(([text, kind]) => {
      const item = node('span'); item.append(node('i', {class: `mwt-key-${kind}`}), document.createTextNode(text)); legend.append(item);
    });
    const chartNote = node('p', {class: 'mwt-note'});
    figure.append(chart, legend, chartNote);
    const controls = node('div', {class: 'mwt-controls'}), fields = node('div', {class: 'mwt-fields'}), inputs = {};
    const number = (key, label, min, max) => {
      const box = node('div', {class: 'mwt-field', 'data-mwt-field': key});
      const e = node('input', {type: 'number', id: `${id}-${key}`, min, max, step: 'any', 'data-mwt-control': key});
      box.append(node('label', {for: `${id}-${key}`}, label), e); fields.append(box); inputs[key] = e; return e;
    };
    const select = (key, label) => {
      const box = node('div', {class: 'mwt-field', 'data-mwt-field': key});
      const e = node('select', {id: `${id}-${key}`, 'data-mwt-control': key});
      e.append(node('option', {value: 'short'}, '短路：−cot'), node('option', {value: 'open'}, '开路：+tan'));
      box.append(node('label', {for: `${id}-${key}`}, label), e); fields.append(box); inputs[key] = e;
    };
    number('r', '归一负载电阻 rL', 0, 100); number('x', '归一负载电抗 xL', -100, 100);
    number('z0', '主线 Z₀ / Ω', .01, 10000); number('ratio', '支节 Yₛ/Y₀ = Z₀/Zₛ', .01, 100);
    number('d', '负载至近支节 d/λ', 0, .5); number('spacing', '支节间距 Δ/λ', 0, .5);
    select('nearType', '近支节 l₁ 的终端'); select('farType', '远支节 l₂ 的终端');
    number('nearLength', '近支节 l₁/λₛ', 0, .5); number('farLength', '远支节 l₂/λₛ', 0, .5);
    number('feed', '远支节至输入 a/λ', 0, .5);
    const error = node('p', {class: 'mwt-error', role: 'status'}), actions = node('div', {class: 'mwt-actions'});
    const playButton = makeButton(actions, 'play', '播放', () => playing ? stop('已暂停。') : play());
    makeButton(actions, 'step', '下一步', () => {stop(); state.progress = Math.min(total(), Math.floor(state.progress + 1e-7) + 1); render();});
    makeButton(actions, 'reset', '重置本题', () => loadPreset(state.preset));
    const progress = node('input', {type: 'range', min: 0, max: 2, step: 'any', value: 0,
      'aria-label': '逐阶段演示进度', 'data-mwt-control': 'progress'});
    const motion = node('p', {class: 'mwt-note'}), readout = node('div', {class: 'mwt-result', 'aria-live': 'off'});
    const stageDescription = node('p', {class: 'mwt-stage-description'});
    controls.append(fields, error, actions, progress, motion, stageDescription, readout); layout.append(figure, controls);
    const circuitDiagram = svg('svg', {viewBox: '0 0 720 150', class: 'mwt-circuit-diagram', role: 'img',
      'aria-label': '实际主线与并联支节结构，橙点标出当前演示位置；示意非比例绘制'});
    const circuitBox = node('div', {class: 'mwt-circuit', role: 'group', 'aria-label': '从负载向源的电路和计算阶段'});
    const solutions = node('section', {class: 'mwt-solutions'}), status = node('p', {class: 'mwt-status', 'aria-live': 'polite'});
    const notes = node('p', {class: 'mwt-note'}, '均匀无耗线，实数正 Z₀，峰值约定不影响此处阻抗设计。支节用自身 λₛ；开路零长度表示未接，短路零长度则直接短接主线。蓝弧顺时针表示真实传播，紫色辅助圆是设计条件的逆向投影。');
    host.replaceChildren(title, intro, buttons, circuitDiagram, circuitBox, layout, solutions, status, notes);

    const total = () => state.mode === 'single' ? 2 : 5;
    const solution = () => state.mode === 'single' ? solveSingle(complex(state.r, state.x), state.nearType, state.ratio) :
      solveDouble(complex(state.r, state.x), state.d, state.spacing, state.nearType, state.farType, state.ratio);
    function sync() {
      Object.entries(inputs).forEach(([key, e]) => {e.value = String(state[key]); e.removeAttribute('aria-invalid');});
      ['spacing', 'farType', 'farLength', 'feed'].forEach(key => {inputs[key].parentElement.hidden = state.mode === 'single';});
      progress.max = String(total()); progress.value = String(state.progress); error.textContent = '';
    }
    function applyPlan(plan, message = true) {
      state.d = plan.d; state.nearLength = plan.nearLength;
      if (state.mode === 'double') state.farLength = plan.farLength;
      state.progress = 0; sync();
      if (message) status.textContent = '已载入这一整组长度。用下一步看传播与加电纳，或播放到输入面。';
    }
    function loadPreset(key) {
      stop(); Object.assign(state, presets[key], {preset: key, progress: 0}); solutionKey = '';
      const solved = solution(); if (solved.solutions.length) applyPlan(solved.solutions[0], false); else sync();
      render(); status.textContent = '已载入题目与方案 A。参数可自由修改；源侧结果始终按实际参数计算。';
    }
    function stop(message = '') {
      playing = false; if (frame) global.cancelAnimationFrame(frame); frame = 0; last = 0;
      playButton.textContent = '播放'; playButton.setAttribute('aria-pressed', 'false'); host.dataset.mwtPlaying = 'false';
      if (message) status.textContent = message;
    }
    function tick(time) {
      frame = 0;
      if (!host.isConnected || !visible || document.hidden || reduced.matches) {stop(); return;}
      if (last) state.progress = Math.min(total(), state.progress + Math.min((time - last) / 1000, .08) * .65);
      last = time; render();
      if (state.progress >= total()) {stop('已到输入面；观察源侧反射与负载侧驻波的区别。'); return;}
      frame = global.requestAnimationFrame(tick);
    }
    function play() {
      if (reduced.matches || !visible || document.hidden) return;
      if (state.progress >= total()) state.progress = 0;
      playing = true; last = 0; playButton.textContent = '暂停'; playButton.setAttribute('aria-pressed', 'true');
      host.dataset.mwtPlaying = 'true'; frame = global.requestAnimationFrame(tick);
    }
    function circle(center, radius, className) {
      const points = Array.from({length: 181}, (_, k) => add(center, complex(radius * Math.cos(TAU * k / 180), radius * Math.sin(TAU * k / 180))));
      return svg('path', {d: path(points), class: className});
    }
    function labelsFor(points) {
      const groups = [];
      points.forEach((g, i) => {
        const [x, y] = position(g), group = groups.find(a => Math.hypot(a.x - x, a.y - y) < 16);
        if (group) group.names.push(i); else groups.push({x, y, names: [i]});
      });
      const occupied = [{left: 390, right: 470, top: 210, bottom: 240}, {left: 245, right: 325, top: 2, bottom: 27}];
      groups.forEach(g => {
        const value = g.names.join('/'), w = value.length * 11 + 3;
        for (const [dx, dy] of [[12, -12], [12, 27], [-12, -12], [-12, 27], [0, -27], [0, 36]]) {
          const anchor = dx < 0 ? 'end' : dx === 0 ? 'middle' : 'start', x = g.x + dx, y = g.y + dy;
          const left = x - (anchor === 'end' ? w : anchor === 'middle' ? w / 2 : 0), box = {left, right: left + w, top: y - 18, bottom: y + 3};
          if (left < 12 || box.right > 468 || box.top < 10 || box.bottom > 469 || occupied.some(b => !(box.right < b.left || left > b.right || box.bottom < b.top || box.top > b.bottom))) continue;
          labels.append(svg('text', {x, y, 'text-anchor': anchor, class: 'mwt-point-label'}, value)); occupied.push(box); break;
        }
      });
    }
    function names() { return state.mode === 'single' ? ['0 负载', '1 主线到接入面 y₁⁻', '2 加支节后 y₁⁺ = 输入'] :
      ['0 负载', '1 近支节前 y₁⁻', '2 加近支节后 y₁⁺', '3 远支节前 y₂⁻', '4 加远支节后 y₂⁺', '5 输入面']; }
    function drawCircuit() {
      circuitDiagram.replaceChildren();
      const start = 55, load = 650, near = state.mode === 'single' ? 320 : 470, far = 255, y = 48;
      const wire = (x1, y1, x2, y2, className = 'mwt-circuit-wire') => circuitDiagram.append(svg('line', {x1, y1, x2, y2, class: className}));
      const label = (x, ly, text, anchor = 'middle') => circuitDiagram.append(svg('text', {x, y: ly, 'text-anchor': anchor, class: 'mwt-circuit-label'}, text));
      wire(start, y, load, y);
      circuitDiagram.append(svg('rect', {x: load - 8, y: y - 13, width: 16, height: 26, class: 'mwt-circuit-load'}));
      label(load + 18, y + 7, 'ZL', 'start'); label(load, 22, '0 负载'); label(start, 22, state.mode === 'single' ? '输入' : '5 输入');
      label((near + load) / 2, 38, `d=${fixed(state.d, 3)}λ`);
      const branch = (x, type, name, stage) => {
        wire(x - 5, y, x - 5, 113, 'mwt-circuit-stub'); wire(x + 5, y, x + 5, 113, 'mwt-circuit-stub');
        if (type === 'short') wire(x - 8, 113, x + 8, 113, 'mwt-circuit-stub');
        else [-5, 5].forEach(dx => circuitDiagram.append(svg('circle', {cx: x + dx, cy: 113, r: 3, class: 'mwt-circuit-open'})));
        label(x, 22, stage); label(x + 15, 101, `${name} ${type === 'short' ? '短路' : '开路'}`, 'start');
      };
      branch(near, state.nearType, 'l₁', '1 / 2');
      if (state.mode === 'double') {
        branch(far, state.farType, 'l₂', '3 / 4');
        label((far + near) / 2, 38, `Δ=${fixed(state.spacing, 3)}λ`);
        label((start + far) / 2, 38, `a=${fixed(state.feed, 3)}λ`);
      }
      const p = state.progress;
      const currentX = p <= 1 ? load + (near - load) * p : state.mode === 'single' || p <= 2 ? near :
        p <= 3 ? near + (far - near) * (p - 2) : p <= 4 ? far : far + (start - far) * (p - 4);
      circuitDiagram.append(svg('circle', {cx: currentX, cy: y, r: 7, class: 'mwt-current-point'}));
      label(20, 141, state.mode === 'single' ? '橙点为当前面。1/2 是同一接入点的接入前／后；结构非比例绘制。' :
        '橙点为当前面。1/2 与 3/4 分别在同一接入点；结构非比例绘制。', 'start');
    }
    function renderSolutions(solved) {
      const key = [state.mode, state.r, state.x, state.d, state.spacing, state.nearType, state.farType, state.ratio].join('/');
      if (key === solutionKey) return; solutionKey = key; solutions.replaceChildren();
      solutions.append(node('strong', {}, state.mode === 'single' ? '两组单支节方案：d 与 l₁ 成对使用' : '固定接入位置：先检查电导，再选整组 l₁、l₂'));
      const messages = {
        forbidden: `此第一面 g=${fixed(solved.first?.r)} > csc²(βΔ)=${fixed(solved.limit)}：处于盲区，改变两根支节长度仍不能匹配。`,
        'half-wave-forbidden': '间距为半波长的整数倍，两面电导相同；当前 g≠1，无解。',
        family: '间距为半波长的整数倍且 g=1：b₁+b₂ 抵消原有电纳即可，有连续多组解。下方只列 b₁=0 的代表方案。',
        tangent: '正好处于盲区边界：辅助圆相切，两组解合成一组。',
        reactive: '当前负载不吸收平均有功功率，没有有限的无耗纯电纳匹配方案。',
        matched: '负载已经匹配；各位置 g=1。这里列未接支节／零电纳支节的代表方案。'
      };
      if (messages[solved.status]) solutions.append(node('p', {class: 'mwt-note'}, messages[solved.status]));
      const cards = node('div', {class: 'mwt-solution-cards'});
      solved.solutions.forEach((plan, i) => {
        const card = node('div', {class: 'mwt-solution'});
        makeButton(card, `solution-${i + 1}`, `载入方案 ${String.fromCharCode(65 + i)}`, () => {stop(); applyPlan(plan); render();});
        card.append(node('p', {}, `d/λ=${fixed(plan.d)}；b₁=${fixed(plan.bNear)}；l₁/λₛ=${fixed(plan.nearLength)}`));
        if (state.mode === 'double') card.append(node('p', {}, `b₂=${fixed(plan.bFar)}；l₂/λₛ=${fixed(plan.farLength)}`));
        if (state.wavelengthMm) card.append(node('p', {}, `本题空气 λ=λₛ=${state.wavelengthMm} mm：d=${fixed(plan.d * state.wavelengthMm, 4)} mm，l₁=${fixed(plan.nearLength * state.wavelengthMm, 4)} mm。`));
        cards.append(card);
      });
      solutions.append(cards);
    }
    function render() {
      const data = circuit(state), step = Math.min(total() - 1, Math.floor(state.progress)), fraction = state.progress >= total() ? 1 : state.progress - step;
      const current = advance(data.points[step], data.operations[step], fraction), solved = solution();
      targets.replaceChildren(); paths.replaceChildren(); markers.replaceChildren(); labels.replaceChildren();
      targets.append(circle(complex(-.5), .5, 'mwt-target'));
      if (state.mode === 'double') {
        targets.append(circle(rotate(complex(-.5), -state.spacing), .5, 'mwt-aux'));
        if (data.y[1] && data.y[1].r >= 0) targets.append(circle(complex(-data.y[1].r / (1 + data.y[1].r)), 1 / (1 + data.y[1].r), 'mwt-first-g'));
      }
      data.operations.forEach((operation, i) => {
        const points = Array.from({length: 141}, (_, k) => advance(data.points[i], operation, k / 140));
        const css = operation.kind === 'line' ? 'mwt-line-path' : 'mwt-shunt-path';
        paths.append(svg('path', {d: path(points), class: css + ' mwt-ghost'}));
        const completion = Math.min(1, Math.max(0, state.progress - i));
        if (completion > 0) paths.append(svg('path', {d: path(Array.from({length: 141}, (_, k) => advance(data.points[i], operation, completion * k / 140))), class: css}));
      });
      data.points.forEach((g, i) => {
        const [x, y] = position(g); markers.append(svg('circle', {cx: x, cy: y, r: 4, class: 'mwt-stage-point'}));
      });
      const [x, y] = position(current); markers.append(svg('circle', {cx: x, cy: y, r: 6, class: 'mwt-current-point'})); labelsFor(data.points);
      drawCircuit(); const stageNames = names(); circuitBox.replaceChildren();
      stageNames.forEach((name, i) => {
        const b = makeButton(circuitBox, `stage-${i}`, name, () => {stop(); state.progress = i; render();});
        b.setAttribute('aria-pressed', String(Math.round(state.progress) === i));
        if (i > 0) b.title = data.operations[i - 1].kind === 'line' ? '沿真实主线向源移动' : '只在本接入面并联纯电纳';
      });
      const active = state.progress >= total() ? total() : Math.floor(state.progress), next = Math.min(total(), active + 1);
      stageDescription.textContent = state.progress >= total() ? '演示到达输入面。源侧匹配时，近支节到负载的一段仍可存在驻波。' :
        `${stageNames[active]} → ${stageNames[next]}：${data.operations[active].kind === 'line' ? '沿线移动，Γ 模不变、相位顺时针减小。' : '在当前同一结点加电纳，g 不变；不把两处支节跨线相加。'}`;
      const input = data.inputGamma, magnitude = abs(input), match = magnitude < 1e-7;
      readout.replaceChildren();
      const rows = state.mode === 'single' ? [['接入前 y₁⁻', data.y[1]], ['加支节后 y₁⁺', data.y[2]]] :
        [['近支节前 y₁⁻', data.y[1]], ['近支节后 y₁⁺', data.y[2]], ['远支节前 y₂⁻', data.y[3]], ['远支节后 y₂⁺', data.y[4]]];
      rows.push(['当前演示面 y', yFromGamma(current)], ['完整网络输入 Γ', input]);
      rows.forEach(([label, value]) => {const row = node('p'); row.append(node('span', {}, label), node('b', {}, fmt(value))); readout.append(row);});
      const text = node('p', {class: 'mwt-match-status', 'data-mwt-output': 'matching'}, `|Γin|=${fixed(magnitude)}；${match ? '源侧匹配' : '源侧仍失配'}。`);
      readout.append(text); host.dataset.mwtInputMagnitude = String(magnitude);
      chartNote.textContent = state.mode === 'single' ? '先由等 |Γ| 圆走到 g=1，再在该面消电纳。图上编号对应上方电路步骤；“当前演示面”与完整网络的输入结果分开显示。' :
        `绿色为第二面 g=1；紫色为它逆时针 ${fixed(720 * state.spacing, 1)}° 反推到第一面的辅助圆。橙色虚线是第一面固定 g 轨迹；交点决定第一根支节。`;
      progress.value = String(state.progress); progress.setAttribute('aria-valuetext', `${fixed(state.progress, 2)}，共${total()}步`);
      Object.entries(presetButtons).forEach(([key, b]) => b.setAttribute('aria-pressed', String(state.preset === key)));
      description.textContent = `${chartNote.textContent} 当前演示面导纳 ${fmt(yFromGamma(current))}，完整网络输入反射系数 ${fmt(input)}。`;
      renderSolutions(solved); host.dataset.mwtProgress = String(state.progress); host.dataset.mwtMode = state.mode;
      host.dataset.mwtSolveStatus = solved.status;
    }
    Object.entries(inputs).forEach(([key, e]) => {
      e.addEventListener(e.tagName === 'SELECT' ? 'change' : 'input', () => {
        stop(); const pending = {}, invalid = [];
        Object.entries(inputs).forEach(([name, input]) => {
          if (input.tagName === 'SELECT') {pending[name] = input.value; return;}
          const valid = input.value.trim() !== '' && input.validity.valid && Number.isFinite(Number(input.value));
          input.setAttribute('aria-invalid', String(!valid)); if (!valid) invalid.push(name); pending[name] = Number(input.value);
        });
        if (invalid.length) {error.textContent = '请在标注范围内输入有限数值；图保留上次有效参数。'; return;}
        Object.assign(state, pending); state.progress = 0; error.textContent = ''; render();
        status.textContent = key.includes('Type') ? '已改变终端，现有长度的电纳也随之变化；可重新载入一组匹配方案。' : '已更新参数。两组理论方案按新条件计算，实际网络读数使用当前输入长度。';
      });
      e.addEventListener('focus', () => {if (playing) stop('编辑参数时已暂停。');});
    });
    progress.addEventListener('input', () => {stop(); state.progress = Number(progress.value); render();});
    const motionChange = () => {playButton.disabled = reduced.matches; motion.textContent = reduced.matches ?
      '系统开启减少动态效果：请用下一步、阶段按钮或进度条。' : '可暂停、逐步或拖动进度；离开视口和切换标签页时自动暂停。'; if (reduced.matches) stop();};
    reduced.addEventListener('change', motionChange);
    const observer = 'IntersectionObserver' in global ? new IntersectionObserver(entries => {visible = entries[0].isIntersecting; if (!visible) stop();}, {threshold: 0}) : null;
    if (observer) observer.observe(host);
    const controller = {host, stop, getState: () => {
      const data = circuit(state), step = Math.min(total() - 1, Math.floor(state.progress));
      const fraction = state.progress >= total() ? 1 : state.progress - step;
      const currentGamma = advance(data.points[step], data.operations[step], fraction);
      return {...state, playing, stage: Math.min(total(), Math.floor(state.progress)),
        ...data, currentGamma, currentY: yFromGamma(currentGamma), solved: solution()};
    }, destroy: () => {
      stop(); if (observer) observer.disconnect(); reduced.removeEventListener('change', motionChange); controllers.delete(host); delete host.dataset.mwStubReady;
    }};
    controllers.set(host, controller); motionChange(); loadPreset('single'); host.dataset.mwStubReady = '1';
  }
  function init(scope = document) {
    controllers.forEach((c, host) => {if (!host.isConnected) c.destroy();});
    if (scope.matches?.(SELECTOR)) mount(scope); scope.querySelectorAll?.(SELECTOR).forEach(mount);
  }
  document.addEventListener('visibilitychange', () => {if (document.hidden) controllers.forEach(c => c.stop());});
  global.MicrowaveStubMatching = Object.freeze({model, init, getState: host => controllers.get(host)?.getState() || null});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(), {once: true}); else init();
})(typeof window !== 'undefined' ? window : globalThis);
