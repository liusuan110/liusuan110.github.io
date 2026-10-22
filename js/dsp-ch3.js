/* DSP chapter 3: shared accessible playback and formula-driven learning views. */
(() => {
  'use strict';
  const M = window.DSPMath;
  if (!M || !window.DSPFFT) return;
  const V = window.DSPCh3Views = window.DSPCh3Views || {};
  const NS = 'http://www.w3.org/2000/svg';
  const C = {blue: 'var(--dsp-blue)', teal: 'var(--dsp-teal)', orange: 'var(--dsp-orange)', ink: 'var(--dsp-ink)', muted: 'var(--dsp-muted)', grid: 'var(--dsp-grid)'};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function node(tag, attrs = {}, text = '', ns) {
    const e = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v)));
    if (text !== '') e.textContent = String(text);
    return e;
  }
  const el = (t, a, s) => node(t, a, s);
  const svg = (t, a, s) => node(t, a, s, NS);
  function table(headers, rows) {
    const wrap = el('div', {class: 'dsp-ch3-table', tabindex: '0', 'aria-label': '数值表，可横向滚动'});
    const t = el('table'), head = el('tr');
    headers.forEach(v => head.append(el('th', {scope: 'col'}, v)));
    const th = el('thead'); th.append(head); t.append(th);
    const body = el('tbody');
    rows.forEach(row => { const tr = el('tr'); row.forEach(v => tr.append(el('td', {}, v))); body.append(tr); });
    t.append(body); wrap.append(t); return wrap;
  }
  function plot(host, o) {
    const width = Math.max(200, Math.min(850, host.clientWidth || 650));
    const height = o.height || 245, p = {l: 48, r: 26, t: 38, b: 42};
    const s = svg('svg', {viewBox: `0 0 ${width} ${height}`, width: '100%', role: 'img', 'aria-label': o.title, class: 'dsp-ch3-plot'});
    s.append(svg('title', {}, o.title));
    const X = x => p.l + (x - o.xlim[0]) / (o.xlim[1] - o.xlim[0]) * (width - p.l - p.r);
    const Y = y => height - p.b - (y - o.ylim[0]) / (o.ylim[1] - o.ylim[0]) * (height - p.t - p.b);
    const path = (points, color = C.blue, dash) => {
      const a = {d: points.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x)} ${Y(y)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2};
      if (dash) a['stroke-dasharray'] = dash;
      const e = svg('path', a); s.append(e); return e;
    };
    const text = (x, y, value, color = C.muted, anchor = 'middle') => {
      const e = svg('text', {x: X(x), y: Y(y), fill: color, 'font-size': 13, 'text-anchor': anchor}, value); s.append(e); return e;
    };
    const tx = o.ticksX || [o.xlim[0], (o.xlim[0] + o.xlim[1]) / 2, o.xlim[1]];
    const ty = o.ticksY || [o.ylim[0], o.ylim[1]];
    ty.forEach(y => { path([[o.xlim[0], y], [o.xlim[1], y]], C.grid); const e = text(o.xlim[0], y, M.fmt(y), C.muted, 'end'); e.setAttribute('x', p.l - 8); e.setAttribute('dy', 4); });
    tx.forEach(x => { path([[x, o.ylim[0]], [x, o.ylim[1]]], C.grid); const e = text(x, o.ylim[0], typeof x === 'number' ? M.fmt(x, 2) : x); e.setAttribute('y', height - 20); });
    const zero = Math.min(o.ylim[1], Math.max(o.ylim[0], 0));
    path([[o.xlim[0], zero], [o.xlim[1], zero]], C.muted);
    s.append(svg('text', {x: p.l, y: 20, fill: C.ink, 'font-size': 14}, o.title));
    s.append(svg('text', {x: width - p.r, y: height - 4, fill: C.muted, 'font-size': 12, 'text-anchor': 'end'}, o.xlabel || ''));
    const dot = (x, y, color = C.orange, r = 4) => { const e = svg('circle', {cx: X(x), cy: Y(y), r, fill: color}); s.append(e); return e; };
    const stem = (x, y, color = C.teal) => { path([[x, zero], [x, y]], color); return dot(x, y, color); };
    host.append(s); return {svg: s, X, Y, path, dot, stem, text};
  }
  const U = {el, svg, table, plot};
  function select(api, label, key, options, value) {
    const l = el('label', {class: 'dsp-ch3-control'}), field = el('select', {'data-control': key, 'aria-label': label});
    options.forEach(([v, t]) => field.append(el('option', {value: v}, t)));
    field.value = value; l.append(el('span', {}, label), field); api.controls.append(l); return field;
  }
  const vector = x => '[' + x.map(v => M.fmt(v)).join(', ') + ']';
  function selectable(e, k, label) { e.setAttribute('data-k', k); e.setAttribute('tabindex', '0'); e.setAttribute('role', 'button'); e.setAttribute('aria-label', label); return e; }
  function selection(api, callback) {
    const handler = e => { const t = e.target.closest('[data-k]'); if (t && api.canvas.contains(t)) callback(Number(t.dataset.k)); };
    api.listen(api.canvas, 'pointerover', handler); api.listen(api.canvas, 'focusin', handler); api.listen(api.canvas, 'click', handler);
    api.listen(api.canvas, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); } });
  }

  V.sampling = api => {
    const presets = [[1, 2, 3, 4], [1, 1, 1, 1], [1, 0, -1, 0], [1, 2, 0, -1]];
    const preset = select(api, '有限记录（始终只有4个样本）', 'preset', presets.map((v, k) => [k, vector(v)]), 0);
    const count = select(api, 'DFT 点数 N', 'N', [4, 8, 16].map(n => [n, n]), 4);
    let data, chosen = 0, at = 0;
    function update() {
      const x = presets[Number(preset.value)], N = Number(count.value);
      const spectrum = M.dft(M.pad(x, N));
      const curve = Array.from({length: 257}, (_, i) => { const w = 2 * Math.PI * i / 256; return [w, M.abs(M.dtft(x, w))]; });
      data = {x, N, spectrum, curve, ymax: Math.max(...curve.map(p => p[1])) * 1.12}; chosen = 0; api.changed();
    }
    function describe() {
      const {x, N, spectrum} = data, w = 2 * Math.PI * chosen / N;
      api.formula.textContent = `ωₖ = 2πk/N；X[k] = Σ x[n]exp(−jωₖn) = X(eʲω)|ω=ωₖ`;
      api.result.textContent = `k=${chosen}，ωₖ=${M.fmt(w, 4)} rad，X[${chosen}]=${M.fmt(spectrum[chosen], 4)}，|X|=${M.fmt(M.abs(spectrum[chosen]), 4)}`;
      api.explain.textContent = `原始记录 x=${vector(x)}；上图连续曲线不随 N 改变。补零只把同一曲线采得更密，不能分开原记录无法区分的相邻频率。${at === 0 ? '下一步开始逐个取样。' : '选择一个采样点查看复数系数。'}`;
    }
    selection(api, k => { chosen = k; describe(); });
    api.listen(preset, 'change', update); api.listen(count, 'change', update);
    const view = {steps: () => data.N + 2, render(step) {
      at = step; api.canvas.replaceChildren();
      const {N, spectrum, curve, ymax} = data;
      const upper = plot(api.canvas, {title: '连续 DTFT 幅度：一个 2π 周期', xlim: [0, 2 * Math.PI], ylim: [0, ymax], xlabel: 'ω / rad', ticksX: [0, Math.PI, 2 * Math.PI]});
      upper.path(curve); const lower = plot(api.canvas, {title: `同一曲线上的 ${N} 点 DFT`, xlim: [0, 2 * Math.PI], ylim: [0, ymax], xlabel: 'ωₖ = 2πk/N', ticksX: [0, Math.PI, 2 * Math.PI]});
      for (let k = 0; k < Math.min(N, step); k++) {
        const w = 2 * Math.PI * k / N, a = M.abs(spectrum[k]);
        upper.dot(w, a, C.orange, 3);
        selectable(lower.stem(w, a), k, `k=${k}，X=${M.fmt(spectrum[k])}`);
      }
      chosen = step > 0 ? Math.min(step - 1, N - 1) : 0;
      describe();
    }};
    update(); return view;
  };

  V.unitcircle = api => {
    const count = select(api, '单位圆采样点数 N', 'N', [4, 8, 16].map(n => [n, n]), 8);
    let N = 8, chosen = 0, current = 0, overlay = null;
    function describe() {
      const w = 2 * Math.PI * chosen / N, z = M.cx(Math.cos(w), Math.sin(w)), W = M.twiddle(N, chosen), value = M.dtft([1, 2, 3, 4], w);
      api.formula.textContent = `zₖ = exp(+j2πk/N)；W_N^k = exp(−j2πk/N)；X[k] = X(z)|z=zₖ`;
      api.result.textContent = `k=${chosen}，ωₖ=${M.fmt(w, 4)}；zₖ=${M.fmt(z, 4)}；W_N^k=${M.fmt(W, 4)}；X(zₖ)=${M.fmt(value, 4)}`;
      api.explain.textContent = '蓝圆：DTFT 在单位圆上连续取值；青点：DFT 的有限采样位置。橙色虚线指向所选 W_N^k，它与 zₖ 共轭。示例 x=[1,2,3,4] 为有限长序列，单位圆在其 Z 变换收敛域内。';
    }
    function drawSelection(step) {
      if (!overlay) return;
      overlay.replaceChildren();
      if (step) {
        const w = 2 * Math.PI * chosen / N, X = x => 180 + 120 * x, Y = y => 180 - 120 * y;
        overlay.append(svg('line', {x1: 180, y1: 180, x2: X(Math.cos(w)), y2: Y(Math.sin(w)), stroke: C.teal, 'stroke-width': 2}));
        overlay.append(svg('line', {x1: 180, y1: 180, x2: X(Math.cos(w)), y2: Y(-Math.sin(w)), stroke: C.orange, 'stroke-width': 2, 'stroke-dasharray': '5 4'}));
        overlay.append(svg('circle', {cx: X(Math.cos(w)), cy: Y(-Math.sin(w)), r: 4, fill: C.orange}));
      }
      describe();
    }
    function draw(step) {
      api.canvas.replaceChildren();
      const side = Math.max(270, Math.min(440, api.canvas.clientWidth || 400));
      const visibleSide = Math.min(side, api.canvas.clientWidth || side), font = Math.max(14, 14 * 360 / visibleSide);
      const s = svg('svg', {viewBox: '0 0 360 360', width: side, style: 'display:block;max-width:100%;margin:auto', role: 'img', 'aria-label': 'Z平面单位圆采样与旋转因子'});
      const X = x => 180 + 120 * x, Y = y => 180 - 120 * y;
      [[30, 180, 332, 180], [180, 330, 180, 30]].forEach(([x1, y1, x2, y2]) => s.append(svg('line', {x1, y1, x2, y2, stroke: C.grid})));
      s.append(svg('circle', {cx: 180, cy: 180, r: 120, fill: 'none', stroke: C.blue, 'stroke-width': 2}));
      s.append(svg('text', {x: 327, y: 210, fill: C.muted, 'font-size': font, 'text-anchor': 'end'}, 'Re(z)'));
      s.append(svg('text', {x: 190, y: 24, fill: C.muted, 'font-size': font}, 'Im(z)'));
      for (let k = 0; k < Math.min(step, N); k++) {
        const w = 2 * Math.PI * k / N;
        const e = svg('circle', {cx: X(Math.cos(w)), cy: Y(Math.sin(w)), r: 5, fill: C.teal});
        selectable(e, k, `单位圆采样点 k=${k}`); s.append(e);
        s.append(svg('text', {x: X(1.15 * Math.cos(w)), y: Y(1.15 * Math.sin(w)) + 4, fill: C.muted, 'font-size': font, 'text-anchor': 'middle'}, k));
      }
      overlay = svg('g', {'pointer-events': 'none'}); s.append(overlay);
      api.canvas.append(s); drawSelection(step);
    }
    selection(api, k => {
      if (chosen === k) return;
      chosen = k; drawSelection(current);
    });
    api.listen(count, 'change', () => { N = Number(count.value); chosen = 0; api.changed(); });
    return {steps: () => N + 2, render(step) { current = step; chosen = step > 0 ? Math.min(step - 1, N - 1) : 0; draw(step); }};
  };

  V.shift = api => {
    const label = el('label', {class: 'dsp-ch3-control'}), input = el('input', {value: '1,2,3,4', 'aria-label': '有限序列，用逗号分隔', 'data-control': 'sequence', type: 'text'});
    const apply = el('button', {type: 'button', 'data-action': 'apply'}, '应用序列');
    label.append(el('span', {}, '2～8 个实数（逗号分隔）'), input); api.controls.append(label, apply);
    const mode = select(api, '操作', 'mode', [['right', '圆周右移'], ['left', '圆周左移'], ['ordinary', '普通右移（区间外为零）'], ['reverse', '循环反转']], 'right');
    const error = el('span', {class: 'dsp-ch3-validation', role: 'status'}); api.controls.append(error);
    let x = [1, 2, 3, 4], previous = null;
    api.listen(apply, 'click', () => {
      const parts = input.value.trim().split(/[,，\s]+/), values = parts.map(Number);
      if (parts.length < 2 || parts.length > 8 || parts.some(v => !v) || values.some(v => !Number.isFinite(v) || Math.abs(v) > 20)) { error.textContent = '请输入2～8个有限实数，幅值不超过20。'; return; }
      x = values; previous = null; error.textContent = ''; api.changed();
    });
    api.listen(mode, 'change', () => { previous = null; api.changed(); });
    return {steps: () => mode.value === 'reverse' ? 2 : x.length + 1, render(m) {
      api.canvas.replaceChildren(); const N = x.length, op = mode.value, ordinary = op === 'ordinary', length = ordinary ? N + m : N;
      const y = Array(length).fill(0), dest = x.map((v, i) => op === 'reverse' ? (m ? M.mod(-i, N) : i) : ordinary ? i + m : M.mod(i + (op === 'left' ? -m : m), N));
      dest.forEach((d, i) => { y[d] = x[i]; });
      const width = Math.max(560, length * 62 + 90), height = 255, wrap = el('div', {class: 'dsp-ch3-flow'});
      const s = svg('svg', {viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': '序列的索引映射与移位过程'});
      const X = i => 50 + i * (width - 95) / Math.max(length - 1, 1), base = 140, max = Math.max(...x.map(Math.abs), 1), scale = 66 / max;
      s.append(svg('line', {x1: 22, y1: base, x2: width - 15, y2: base, stroke: C.grid}));
      y.forEach((v, i) => s.append(svg('text', {x: X(i), y: 211, fill: C.muted, 'text-anchor': 'middle', 'font-size': 13}, `n=${i}`)));
      x.forEach((v, i) => {
        const g = svg('g', {transform: `translate(${X(dest[i])},0)`});
        g.append(svg('line', {x1: 0, y1: base, x2: 0, y2: base - v * scale, stroke: C.blue, 'stroke-width': 3}));
        g.append(svg('circle', {cx: 0, cy: base - v * scale, r: 5, fill: C.blue}));
        g.append(svg('text', {x: 0, y: base - v * scale + (v >= 0 ? -10 : 19), fill: C.ink, 'text-anchor': 'middle', 'font-size': 15}, M.fmt(v)));
        g.append(svg('rect', {x: -22, y: 166, width: 44, height: 25, rx: 3, fill: C.teal, 'fill-opacity': .12}));
        g.append(svg('text', {x: 0, y: 183, fill: C.teal, 'text-anchor': 'middle', 'font-size': 12}, `旧 ${i}`));
        if (!reduce.matches && previous && previous.op === op && previous.N === N && Math.abs(previous.m - m) === 1) {
          const old = previous.dest[i], target = dest[i];
          const delta = (m - previous.m) * (op === 'left' ? -1 : 1);
          const crossed = !ordinary && op !== 'reverse' && (old + delta < 0 || old + delta >= N);
          const a = svg('animateTransform', {attributeName: 'transform', type: 'translate', dur: '0.45s', fill: 'freeze', values: crossed ? `${X(old)} 0;${delta > 0 ? width + 25 : -25} 0;${delta > 0 ? -25 : width + 25} 0;${X(target)} 0` : `${X(old)} 0;${X(target)} 0`, keyTimes: crossed ? '0;0.45;0.55;1' : '0;1', calcMode: 'linear'});
          g.append(a);
          if (crossed) g.append(svg('animate', {attributeName: 'opacity', values: '1;0;0;1', keyTimes: '0;0.45;0.55;1', dur: '0.45s', fill: 'freeze'}));
        }
        s.append(g);
      });
      s.append(svg('text', {x: 22, y: 25, fill: C.ink, 'font-size': 15}, op === 'reverse' ? (m ? '循环反转：0保留，其余索引取负后求模' : '原序列：下一步做循环反转') : `当前${op === 'left' ? '左' : '右'}移 ${m} 位`));
      wrap.append(s); api.canvas.append(wrap, table(['旧索引 i', '新位置', '数值'], x.map((v, i) => [i, dest[i], M.fmt(v)])));
      api.formula.textContent = op === 'reverse' ? (m ? 'y[n] = x[(−n) mod N]' : 'y[n] = x[n]') : ordinary ? `y[n] = x[n−${m}]（x 的区间外取0）` : `y[n] = x[(n${op === 'left' ? '+' : '−'}${m}) mod ${N}]`;
      api.result.textContent = `y=${vector(y)}`;
      api.explain.textContent = ordinary ? '普通右移把整个零延拓序列移向右边，显示范围跟随增长，不把尾部丢掉。' : op === 'reverse' ? '循环反转不是把数组直接倒过来：[1,2,3,4] 的四点循环反转为 [1,4,3,2]。' : '每前进一步移动一位。越过周期边界的元素从另一端归位；下表追踪每个旧索引，数值不会改变。';
      previous = {op, N, m, dest};
    }};
  };

  V.complexity = api => {
    const sizes = [8, 16, 32, 64, 128, 256, 1024];
    const count = select(api, '计算点数 N', 'N', sizes.map(n => [n, n]), 8);
    api.listen(count, 'change', () => api.go(sizes.indexOf(Number(count.value))));
    return {steps: () => sizes.length, render(step) {
      const N = sizes[step], t = M.complexity(N); count.value = N; api.canvas.replaceChildren();
      const p = plot(api.canvas, {title: '理论复数乘法次数（纵轴 log₁₀）', xlim: [3, 10], ylim: [0, 6.2], xlabel: 'log₂ N', ticksX: [3, 5, 7, 10], ticksY: [0, 2, 4, 6]});
      const drawn = sizes.slice(0, step + 1);
      p.path(drawn.map(n => [Math.log2(n), Math.log10(n * n)]), C.blue);
      p.path(drawn.map(n => [Math.log2(n), Math.log10(n / 2 * Math.log2(n))]), C.teal);
      p.dot(Math.log2(N), Math.log10(t.dftMultiplications), C.blue); p.dot(Math.log2(N), Math.log10(t.fftMultiplications), C.teal);
      api.canvas.append(table(['N', '直接 DFT 复乘', '基2 FFT 复乘', '直接 DFT 复加', '基2 FFT 复加'], [[N, t.dftMultiplications, t.fftMultiplications, t.dftAdditions, t.fftAdditions]]));
      api.formula.textContent = '直接 DFT：N² 次复乘、N(N−1) 次复加；基2 FFT：(N/2)log₂N 次复乘、Nlog₂N 次复加。';
      api.result.textContent = `N=${N}：${t.stages} 级、${t.butterflies} 个蝶形；复乘数之比约 ${M.fmt(t.dftMultiplications / t.fftMultiplications, 2)}。`;
      api.explain.textContent = '蓝色为直接 DFT，青色为基2 FFT。这是未专门省略 W=1、±j 等平凡乘法的标准理论计数；不代表实测耗时。观察 N 增大后，分解复用中间结果怎样节省计算。';
    }};
  };

  V.ifft = api => {
    const preset = select(api, '频域输入', 'preset', [['rect4', '4点：X=[2,1−j,0,1+j]'], ['book4', '4点：教材例3.10的频域结果'], ['book8', '8点：教材例3.11的频域结果']], 'rect4');
    let X, stages;
    function update() {
      X = preset.value === 'rect4' ? [M.cx(2), M.cx(1, -1), M.cx(0), M.cx(1, 1)] : M.dft(preset.value === 'book4' ? [1, M.cx(0, 2), 0, 0] : [4, -3, 2, 0, -1, -2, 3, 1]);
      const c = X.map(M.conj), f = window.DSPFFT.fft(c), back = f.map(M.conj), x = back.map(z => M.scale(z, 1 / X.length));
      stages = [X, c, f, back, x, x]; api.changed();
    }
    api.listen(preset, 'change', update);
    const titles = ['读入频域向量 X', '对 X 逐项取共轭', '调用同一个前向 FFT', '对 FFT 输出再取共轭', '每项除以 N', '正向变换复核'];
    const formulas = ['输入 X[k]', 'C[k] = X*[k]', 'F[n] = FFT{X*[k]}', 'G[n] = F*[n]', 'x[n] = (1/N) · (FFT{X*})*', 'DFT{x[n]} ≈ X[k]'];
    const view = {steps: () => 6, render(step) {
      api.canvas.replaceChildren(); const values = stages[step], N = X.length;
      api.canvas.append(table(['索引', titles[step]], values.map((v, k) => [k, M.fmt(v, 5)])));
      api.formula.textContent = formulas[step]; api.result.textContent = `${titles[step]}：${vector(values)}`;
      api.explain.textContent = step === 5 ? `直接 DFT 复核的最大误差为 ${M.maxError(M.dft(values), X).toExponential(2)}。符号转换靠两次共轭完成，1/N 归一化不能漏。` : '这条流程复用前向 FFT：共轭 → FFT → 共轭 → 除以 N。当前表格由实际复数计算得到，可前后逐步核对。';
    }}; update(); return view;
  };

  const instances = new Map();
  function mount(root) {
    if (instances.has(root)) return;
    const factory = V[root.dataset.dspDemo]; if (!factory) return;
    const abort = new AbortController(), controls = el('div', {class: 'dsp-ch3-controls'}), toolbar = el('div', {class: 'dsp-ch3-toolbar', role: 'group', 'aria-label': '演示播放控制'});
    const button = (action, title) => { const b = el('button', {type: 'button', 'data-action': action}, title); toolbar.append(b); return b; };
    const prev = button('prev', '上一步'), play = button('play', '播放'), next = button('next', '下一步'), reset = button('reset', '重置');
    const speedLabel = el('label', {class: 'dsp-ch3-control'}), speed = el('select', {'aria-label': '播放速度', 'data-control': 'speed'});
    [[1800, '慢速'], [1100, '正常'], [600, '快速']].forEach(([v, t]) => speed.append(el('option', {value: v}, t))); speed.value = 1100;
    speedLabel.append(el('span', {}, '速度'), speed); toolbar.append(speedLabel);
    const stepText = el('span', {class: 'dsp-ch3-step'}), range = el('input', {type: 'range', min: 0, max: 1, value: 0, 'aria-label': '当前演示步骤', 'data-control': 'step'});
    const progress = el('div', {class: 'dsp-ch3-progress'}); progress.append(range, stepText);
    const canvas = el('div', {class: 'dsp-ch3-canvas'}), formula = el('div', {class: 'dsp-ch3-formula'}), result = el('div', {class: 'dsp-ch3-result', 'aria-live': 'polite', 'aria-atomic': 'true'}), explain = el('div', {class: 'dsp-ch3-explain'});
    const motionNote = el('p', {class: 'dsp-ch3-motion-note'}, '已按“减少动态效果”偏好关闭自动播放，仍可单步查看。');
    const live = el('div', {class: 'dsp-ch3-live'}); live.append(controls, toolbar, progress, canvas, formula, result, explain, motionNote); root.append(live);
    let current = 0, timer = null, running = false, model = null, rendering = false;
    const listen = (e, event, fn) => e.addEventListener(event, fn, {signal: abort.signal});
    function pause() { running = false; clearTimeout(timer); timer = null; play.textContent = '播放'; play.setAttribute('aria-pressed', 'false'); }
    function draw() {
      if (!model || rendering) return;
      rendering = true;
      try {
        const total = Math.max(1, model.steps()); current = Math.max(0, Math.min(total - 1, current));
        range.max = total - 1; range.value = current; stepText.textContent = `第 ${current + 1} / ${total} 步`;
        prev.disabled = current === 0; next.disabled = current >= total - 1; play.disabled = reduce.matches || total < 2;
        motionNote.hidden = !reduce.matches; model.render(current);
        canvas.querySelectorAll('.dsp-ch3-flow').forEach(e => { e.tabIndex = 0; e.setAttribute('aria-label', '图示，可横向滚动查看完整过程'); });
        root.dataset.step = current;
      } finally { rendering = false; }
    }
    function go(n) { pause(); current = n; draw(); }
    function tick() { if (!running) return; if (current >= model.steps() - 1) { pause(); return; } current++; draw(); if (current >= model.steps() - 1) pause(); else timer = setTimeout(tick, Number(speed.value)); }
    const api = {M, U, root, controls, canvas, formula, result, explain, listen, changed() { pause(); current = 0; if (model) draw(); }, go, pause, redraw: draw};
    try { model = factory(api); } catch (e) { abort.abort(); live.remove(); console.error('DSP chapter 3 view:', root.dataset.dspDemo, e); return; }
    listen(prev, 'click', () => go(current - 1)); listen(next, 'click', () => go(current + 1)); listen(reset, 'click', () => { pause(); if (model.reset) model.reset(); go(0); });
    listen(play, 'click', () => { if (running) { pause(); return; } if (reduce.matches) return; if (current >= model.steps() - 1) current = 0; running = true; play.textContent = '暂停'; play.setAttribute('aria-pressed', 'true'); draw(); timer = setTimeout(tick, Number(speed.value)); });
    listen(range, 'input', () => go(Number(range.value))); listen(speed, 'change', () => { if (running) { clearTimeout(timer); timer = setTimeout(tick, Number(speed.value)); } });
    listen(reduce, 'change', () => { pause(); draw(); });
    let lastWidth = root.clientWidth, frame = null;
    const ro = new ResizeObserver(() => { const w = root.clientWidth; if (Math.abs(w - lastWidth) < 1) return; lastWidth = w; cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); }); ro.observe(root);
    const instance = {pause, destroy() { pause(); abort.abort(); ro.disconnect(); cancelAnimationFrame(frame); if (model.destroy) model.destroy(); live.remove(); root.classList.remove('is-ready'); instances.delete(root); }};
    instances.set(root, instance); root.classList.add('is-ready'); draw();
  }
  const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) mount(e.target); else instances.get(e.target)?.pause(); }), {rootMargin: '450px 0px', threshold: 0});
  document.querySelectorAll('.dsp-ch3-demo').forEach(root => observer.observe(root));
  document.addEventListener('visibilitychange', () => { if (document.hidden) instances.forEach(v => v.pause()); });
  const mutations = new MutationObserver(() => instances.forEach((v, root) => { if (!root.isConnected) { observer.unobserve(root); v.destroy(); } })); mutations.observe(document.body, {childList: true, subtree: true});
  window.addEventListener('pagehide', () => { observer.disconnect(); mutations.disconnect(); instances.forEach(v => v.destroy()); });
  window.addEventListener('pageshow', e => { if (e.persisted) { document.querySelectorAll('.dsp-ch3-demo').forEach(root => observer.observe(root)); mutations.observe(document.body, {childList: true, subtree: true}); } });
})();
