/* Chapter 2 models and views. Registration is safe before DSPMath is loaded. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else {
    root.DSPCh2Core = core;
    core.register(root.DSPCh3Views = root.DSPCh3Views || {});
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PI = Math.PI;
  const A = -1 / 3, B = 4 / 3;
  const filters = {average: [.5, .5], diff1: [1, -1], diff2: [1, -2, 1]};
  const wave = (kind, theta) => kind === 'sin' ? Math.sin(theta) : Math.cos(theta);
  function sampling(F, Fs, kind = 'cos') {
    const alias = F - Fs * Math.floor((F + Fs / 2) / Fs);
    return {F, Fs, kind, alias, nyquistZero: kind === 'sin' && Math.abs(Math.abs(alias) - Fs / 2) < 1e-10,
      original: t => wave(kind, 2 * PI * F * t), equivalent: t => wave(kind, 2 * PI * alias * t),
      sample: n => wave(kind, 2 * PI * F * n / Fs)};
  }
  function indexMap(values, first, mode, parameter) {
    return values.map((value, i) => ({source: first + i, target: mode === 'reverse' ? parameter - first - i : first + i + parameter, value}));
  }
  function convolution(x, h) {
    const y = Array(x.length + h.length - 1).fill(0);
    x.forEach((a, k) => h.forEach((b, j) => {y[k + j] += a * b;}));
    return y;
  }
  function response(key, omega) {
    const h = filters[key];
    const re = h.reduce((s, c, r) => s + c * Math.cos(omega * r), 0);
    const im = h.reduce((s, c, r) => s - c * Math.sin(omega * r), 0);
    const gain = Math.hypot(re, im), phase = gain < 1e-12 ? null : Math.atan2(im, re);
    return {h: h.slice(), omega, re, im, gain, phase, x: n => Math.cos(omega * n),
      y: n => h.reduce((s, c, r) => s + c * Math.cos(omega * (n - r)), 0),
      spectral: n => re * Math.cos(omega * n) - im * Math.sin(omega * n)};
  }
  function roc(key, radius) {
    const directions = key === 'inner' ? ['left', 'left'] : key === 'middle' ? ['right', 'left'] : ['right', 'right'];
    const pieces = [.5, 2].map((a, i) => {
      const c = i ? B : A, dir = directions[i], q = dir === 'right' ? a / radius : radius / a;
      return {a, c, dir, q, converges: q < 1, h: n => dir === 'right' ? (n >= 0 ? c * a ** n : 0) : (n < 0 ? -c * a ** n : 0),
        logTerm: m => Math.log10(Math.abs(c)) + m * Math.log10(q), term: m => Math.abs(c) * q ** m};
    });
    return {key, radius, pieces, valid: pieces.every(p => p.converges), stable: key === 'middle', causal: key === 'outer', h: n => pieces.reduce((s, p) => s + p.h(n), 0)};
  }

  function register(V) {
    const C = {blue: 'var(--dsp-blue)', teal: 'var(--dsp-teal)', orange: 'var(--dsp-orange)', red: 'var(--dsp-red, #bb4949)', ink: 'var(--dsp-ink)', muted: 'var(--dsp-muted)', grid: 'var(--dsp-grid)', paper: 'var(--dsp-paper)'};
    const fmt = (api, n, digits = 4) => api.M.fmt(n, digits);
    const vector = (api, a) => '[' + a.map(v => v == null ? '—' : fmt(api, v)).join(', ') + ']';
    const clip = (n, size) => Math.max(0, Math.min(size - 1, Math.trunc(Number(n) || 0)));
    function select(api, title, key, options, value) {
      const label = api.U.el('label', {class: 'dsp-ch3-control'}), field = api.U.el('select', {'data-control': key, 'aria-label': title});
      options.forEach(([v, t]) => field.append(api.U.el('option', {value: String(v)}, String(t))));
      field.value = String(value); label.append(api.U.el('span', {}, title), field); api.controls.append(label);
      return field;
    }
    function text(api, svg, x, y, value, color = C.ink, size = 14, anchor = 'start') {
      const node = api.U.svg('text', {x, y, fill: color, 'font-size': size, 'text-anchor': anchor}, String(value)); svg.append(node); return node;
    }
    function line(api, svg, x1, y1, x2, y2, color = C.grid, dash = '') {
      const attrs = {x1, y1, x2, y2, stroke: color, 'stroke-width': 1.4}; if (dash) attrs['stroke-dasharray'] = dash; svg.append(api.U.svg('line', attrs));
    }
    function figure(api, title, height = 340, width = 680) {
      const wrap = api.U.el('div', {class: 'dsp-ch3-flow', tabindex: '0', 'aria-label': '图示，可横向滚动', style: 'max-width:100%;min-width:0;overflow-x:auto'});
      const svg = api.U.svg('svg', {viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': title, style: `width:${width}px;max-width:none;height:${height}px;display:block`});
      svg.append(api.U.svg('title', {}, title)); wrap.append(svg); api.canvas.append(wrap); text(api, svg, 18, 26, title, C.ink, 17); return svg;
    }
    function graph(api, title, xlim, ylim, xlabel, height = 270, ticks) {
      const s = figure(api, title, height), p = {l: 58, r: 24, t: 48, b: 43}, width = 680;
      const X = x => p.l + (x - xlim[0]) / (xlim[1] - xlim[0]) * (width - p.l - p.r);
      const Y = y => height - p.b - (y - ylim[0]) / (ylim[1] - ylim[0]) * (height - p.t - p.b);
      const path = (pts, color = C.blue, dash = '') => {const attrs = {d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x)} ${Y(y)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2}; if (dash) attrs['stroke-dasharray'] = dash; s.append(api.U.svg('path', attrs));};
      const xticks = ticks || [xlim[0], (xlim[0] + xlim[1]) / 2, xlim[1]];
      xticks.forEach(x => {line(api, s, X(x), p.t, X(x), height - p.b, C.grid, '3 5'); text(api, s, X(x), height - 22, fmt(api, x, 3), C.muted, 14, 'middle');});
      [ylim[0], 0, ylim[1]].filter((v, i, a) => a.indexOf(v) === i && v >= ylim[0] && v <= ylim[1]).forEach(y => {line(api, s, p.l, Y(y), width - p.r, Y(y), y === 0 ? C.muted : C.grid); text(api, s, p.l - 7, Y(y) + 4, fmt(api, y, 2), C.muted, 14, 'end');});
      text(api, s, width - p.r, height - 2, xlabel, C.muted, 14, 'end');
      const stem = (x, y, color = C.orange, shape = 'circle') => {line(api, s, X(x), Y(0), X(x), Y(y), color); const attrs = shape === 'square' ? {x: X(x) - 4, y: Y(y) - 4, width: 8, height: 8, fill: color} : {cx: X(x), cy: Y(y), r: 4, fill: color}; s.append(api.U.svg(shape === 'square' ? 'rect' : 'circle', attrs));};
      return {svg: s, X, Y, path, stem};
    }
    const curve = (lo, hi, fn, count = 401) => Array.from({length: count}, (_, i) => {const t = lo + (hi - lo) * i / (count - 1); return [t, fn(t)];});
    function setState(api, phase, step) {api.canvas.replaceChildren(); api.canvas.dataset.phase = phase; api.canvas.dataset.step = String(step);}

    V.ch2sampling = api => {
      const f = select(api, '模拟频率 F / Hz', 'F', [1000, 3000, 7000].map(v => [v, v]), 1000);
      const fs = select(api, '采样率 Fs / Hz', 'Fs', [2000, 6000, 8000].map(v => [v, v]), 8000);
      const kind = select(api, '波形（初相位为 0）', 'wave', [['cos', '余弦 cos'], ['sin', '正弦 sin']], 'cos');
      [f, fs, kind].forEach(e => api.listen(e, 'change', () => api.changed()));
      return {steps: () => 11, render(raw) {
        const step = clip(raw, 11), d = sampling(Number(f.value), Number(fs.value), kind.value), shown = Math.min(9, step), end = 8000 / d.Fs;
        setState(api, step === 0 ? 'continuous' : step === 10 ? 'comparison' : 'sampling', step);
        const p = graph(api, `${d.kind}(2π·${d.F}·t) 与 ${d.alias} Hz 的样点比较`, [0, end], [-1.25, 1.25], 't / ms', 290);
        p.path(curve(0, end, ms => d.original(ms / 1000)), C.blue);
        if (step === 10) p.path(curve(0, end, ms => d.equivalent(ms / 1000)), C.teal, '6 4');
        const rows = [];
        for (let n = 0; n < shown; n++) {
          p.stem(n * 1000 / d.Fs, d.sample(n), C.orange, 'square');
          rows.push([n, fmt(api, n * 1000 / d.Fs), fmt(api, d.sample(n)), fmt(api, d.equivalent(n / d.Fs))]);
        }
        text(api, p.svg, 74, 66, '实线：原模拟信号；方块：取样值；末步虚线：等效低频', C.muted, 14);
        if (rows.length) api.canvas.append(api.U.table(['n', 't=n/Fs（ms）', '原信号样值', '等效信号样值'], rows));
        api.formula.textContent = `x[n]=${d.kind}(2π·${d.F}/${d.Fs}·n)；ω=${fmt(api, 2 * PI * d.F / d.Fs)} rad/样本；F̃=F−mFs=${d.alias} Hz。`;
        api.result.textContent = `已取 ${shown}/9 点：${vector(api, Array.from({length: shown}, (_, n) => d.sample(n)))}；等效有符号频率 ${d.alias} Hz。`;
        api.explain.textContent = d.nyquistZero ? '折叠频率处于奈奎斯特边界，零初相正弦的每个整数样点都是 sin(整数·π)=0。全零样本不能恢复原正弦幅值；等号不能保证任意边界相位可恢复。' : Math.abs(Math.abs(d.alias) - d.Fs / 2) < 1e-10 ? '折叠频率恰在奈奎斯特边界：零初相余弦仍有交替正负的样点，但正弦相位分量在样点消失，不能据此保证任意相位的信号可恢复。' : Math.abs(d.alias) !== d.F ? `原信号与 ${d.alias} Hz 的有符号频率在所有整数采样点完全相同。正弦的负频率保留负号；cos 对频率正负对称。相同样本不能说明两条模拟波形相同。` : '当前单音位于 Fs/2 内。末步显示等效曲线与原曲线重合；改选 7000 Hz、Fs=8000 Hz，可观察高频与 −1000 Hz 在样点处相同。';
      }};
    };

    V.ch2index = api => {
      const x = [2, -1, 3, 1], first = -2;
      const mode = select(api, '运算', 'mode', [['delay', '普通移位 x[n−d]'], ['reverse', '反转平移 x[b−n]']], 'delay');
      const choices = [-2, -1, 0, 1, 2].map(v => [v, v]);
      const d = select(api, '移位 d', 'd', choices, 2), b = select(api, '反转参数 b', 'b', choices, 1);
      function update() {d.disabled = mode.value !== 'delay'; b.disabled = mode.value !== 'reverse'; api.changed();}
      [mode, d, b].forEach(e => api.listen(e, 'change', update)); b.disabled = true;
      return {steps: () => 6, render(raw) {
        const step = clip(raw, 6), op = mode.value, parameter = Number(op === 'delay' ? d.value : b.value), mapping = indexMap(x, first, op, parameter), shown = Math.min(4, step);
        setState(api, step === 0 ? 'source' : step === 5 ? 'complete' : 'mapping', step);
        const s = figure(api, '给每个旧样本解出新位置：这不是循环操作', 400), X = n => 70 + (n + 4) * 70;
        text(api, s, 18, 61, '原序列 x[m]，支持 −2≤m≤1', C.blue, 15);
        text(api, s, 18, 226, op === 'delay' ? `新序列 y[n]=x[n−(${parameter})]` : `新序列 y[n]=x[${parameter}−n]`, C.teal, 15);
        [-4, -3, -2, -1, 0, 1, 2, 3, 4].forEach(n => {
          line(api, s, X(n), 76, X(n), 327, C.grid, '3 6');
          text(api, s, X(n), 177, n, C.muted, 14, 'middle'); text(api, s, X(n), 348, n, C.muted, 14, 'middle');
        });
        line(api, s, 43, 123, 653, 123, C.muted); line(api, s, 43, 294, 653, 294, C.muted);
        mapping.forEach((p, i) => {
          const draw = (n, base, color) => {line(api, s, X(n), base, X(n), base - 17 * p.value, color); s.append(api.U.svg('circle', {cx: X(n), cy: base - 17 * p.value, r: 4.5, fill: color})); text(api, s, X(n), base - 17 * p.value + (p.value >= 0 ? -8 : 17), fmt(api, p.value), color, 14, 'middle');};
          draw(p.source, 123, C.blue); if (i < shown) draw(p.target, 294, C.teal);
        });
        const current = step > 0 && step < 5 ? mapping[step - 1] : null;
        if (current) {
          s.append(api.U.svg('path', {d: `M${X(current.source)} 183 C${X(current.source)} 196,${X(current.target)} 198,${X(current.target)} 219`, stroke: C.orange, 'stroke-width': 3, fill: 'none'}));
          s.append(api.U.svg('path', {d: `M${X(current.target) - 5} 211 L${X(current.target)} 220 L${X(current.target) + 5} 211`, stroke: C.orange, 'stroke-width': 2, fill: 'none'}));
          text(api, s, 405, 61, `旧 m=${current.source} → 新 n=${current.target}`, C.orange, 15);
        }
        text(api, s, 18, 385, '所有未列位置均为 0；不取模、不折回，负编号仍保留。', C.muted, 14);
        api.canvas.append(api.U.table(['旧编号 m', '原值', op === 'delay' ? '新编号 n=m+d' : '新编号 n=b−m'], mapping.map((p, i) => [p.source, p.value, i < shown ? p.target : '待映射'])));
        const lo = Math.min(...mapping.map(p => p.target)), hi = Math.max(...mapping.map(p => p.target));
        const output = Array.from({length: hi - lo + 1}, (_, i) => {const p = mapping.find(p => p.target === lo + i); return mapping.indexOf(p) < shown ? p.value : null;});
        api.formula.textContent = op === 'delay' ? `m=n−d ⇒ n=m+d=m+(${parameter})。` : `m=b−n ⇒ n=b−m=${parameter}−m。`;
        api.result.textContent = `y[${lo}…${hi}]=${vector(api, output)}；${shown}/4 个原样本已归位。`;
        api.explain.textContent = op === 'delay' ? '先令旧编号 m=n−d，再解出新编号 n=m+d。d>0 向右移、d<0 向左移，支持起点也跟着移动。' : '直接解 n=b−m 最可靠：每个原样本保留数值，在新的整数编号落下。循环反转的模运算不适用于本题。';
      }};
    };

    V.ch2conv = api => {
      const presets = [{x: [1, 2, 1], h: [1, -1]}, {x: [1, -1, 2], h: [2, 1]}, {x: [2, 1], h: [1, 0, -1]}];
      const preset = select(api, '线性卷积预设', 'preset', presets.map((p, i) => [i, `x=${vector(api, p.x)}，h=${vector(api, p.h)}`]), 0);
      let p = presets[0], y = api.M.linearConvolution(p.x, p.h);
      api.listen(preset, 'change', () => {p = presets[Number(preset.value)]; y = api.M.linearConvolution(p.x, p.h); api.changed();});
      const total = () => 3 + 3 * y.length;
      return {steps: total, render(raw) {
        const step = clip(raw, total()), final = step === total() - 1, n = final ? y.length - 1 : Math.max(0, Math.floor((step - 2) / 3)), phase = final ? 2 : (step - 2) % 3;
        setState(api, step === 0 ? 'original' : step === 1 ? 'reverse' : final ? 'complete' : ['slide', 'products', 'sum'][phase], step);
        const s = figure(api, step < 2 ? (step === 0 ? '原始 h[k]：先确认索引和正负号' : '翻转成 h[−k]，暂不平移') : `n=${n}：${['滑动到位', '逐项相乘', '求和写出'][phase]}`, 330);
        const min = 1 - p.h.length, max = y.length - 1, X = k => 119 + (k - min) * 521 / (max - min);
        text(api, s, 18, 83, 'x[k]', C.blue, 16); text(api, s, 18, 203, step === 0 ? 'h[k]' : step === 1 ? 'h[−k]' : `h[${n}−k]`, C.teal, 16);
        for (let k = min; k <= max; k++) {
          const j = step === 0 ? k : step === 1 ? -k : n - k, overlap = step >= 2 && k >= 0 && k < p.x.length && j >= 0 && j < p.h.length;
          line(api, s, X(k), 49, X(k), 274, C.grid, '3 5');
          if (overlap && phase >= 1) s.append(api.U.svg('rect', {x: X(k) - 20, y: 48, width: 40, height: 226, rx: 4, fill: C.orange, 'fill-opacity': .09}));
          [k >= 0 && k < p.x.length ? p.x[k] : 0, j >= 0 && j < p.h.length ? p.h[j] : 0].forEach((v, row) => {
            const base = row ? 238 : 117, color = overlap && phase >= 1 ? C.orange : row ? C.teal : C.blue;
            line(api, s, X(k), base, X(k), base - v * 23, color); s.append(api.U.svg('circle', {cx: X(k), cy: base - v * 23, r: v ? 4.5 : 2.5, fill: color}));
            if (v) text(api, s, X(k), base - v * 23 + (v >= 0 ? -8 : 18), fmt(api, v), color, 14, 'middle');
          });
          text(api, s, X(k), 296, k, C.muted, 14, 'middle');
        }
        line(api, s, 95, 117, 655, 117, C.muted); line(api, s, 95, 238, 655, 238, C.muted);
        text(api, s, 18, 322, '蓝色为固定输入；下排先翻转，再随输出位置 n 滑动。', C.muted, 14);
        const rows = [];
        if (step >= 2) for (let k = Math.max(0, n - p.h.length + 1); k <= Math.min(p.x.length - 1, n); k++) rows.push([k, p.x[k], p.h[n - k], p.x[k] * p.h[n - k]]);
        if (step >= 2 && phase >= 1) api.canvas.append(api.U.table(['有效 k', 'x[k]', `h[${n}−k]`, '乘积'], rows));
        const known = y.map((v, k) => step >= 2 && (k < n || (k === n && phase === 2)) ? v : null);
        api.canvas.append(api.U.table(['输出 n', '当前 y[n]'], known.map((v, i) => [i, v == null ? '—' : fmt(api, v)])));
        api.formula.textContent = step < 2 ? (step === 0 ? 'y[n]=Σₖ x[k]h[n−k]；先认清 h[k]。' : 'h[k] → h[−k]：原位置 j 移到 −j。') : phase === 0 ? `当前 n=${n}：h[n−k]=h[${n}−k]；先确定与 x[k] 的支持交集。` : `y[${n}] = ${rows.map(r => `(${r[1]})×(${r[2]})`).join(' + ')}${phase === 2 ? ' = ' + fmt(api, y[n]) : ''}`;
        api.result.textContent = `线性输出进度 ${vector(api, known)}；长度 ${p.x.length}+${p.h.length}−1=${y.length}。`;
        api.explain.textContent = final ? '这已经是完整线性卷积：区间外输入取零，最后一项留在自己的输出编号，不做循环折回。' : step < 2 ? '先翻转再平移；h 中的负数保留符号。后退任一步都重新从同一公式恢复状态。' : phase === 0 ? '先找支持区间的交集；交集外至少有一个因子为零。' : phase === 1 ? '橙色列逐项相乘。不要将卷积误作相同编号处的直接相乘。' : '把当前乘积求和，只写入这个 n 的结果，然后继续向右滑动。';
      }};
    };

    V.ch2response = api => {
      const filter = select(api, 'FIR 系统', 'filter', [['average', '两点平均：½x[n]+½x[n−1]'], ['diff1', '一阶差分：x[n]−x[n−1]'], ['diff2', '二阶差分：x[n]−2x[n−1]+x[n−2]']], 'average');
      const omega = select(api, '输入数字角频率 ω', 'omega', Array.from({length: 9}, (_, k) => [k, k === 0 ? '0' : k === 8 ? 'π' : `${k}π/8`]), 4);
      [filter, omega].forEach(e => api.listen(e, 'change', () => api.changed()));
      return {steps: () => 11, render(raw) {
        const step = clip(raw, 11), d = response(filter.value, Number(omega.value) * PI / 8), n = step >= 3 && step < 10 ? step - 6 : null;
        setState(api, step === 0 ? 'input' : step === 1 ? 'transfer' : step === 2 ? 'magnitude-phase' : step === 10 ? 'complete' : 'time-sample', step);
        const p = graph(api, '全时间输入 x[n]=cos(ωn)：圆点仅在整数 n', [-8, 8], [-1.2, 1.2], 'n', 245, [-8, -4, 0, 4, 8]);
        p.path(curve(-8, 8, d.x), C.blue, '4 4'); for (let k = -8; k <= 8; k++) p.stem(k, d.x(k), k === n ? C.orange : C.blue);
        if (step >= 2) {
          const span = Math.max(d.gain * 1.2, .3), q = graph(api, '稳态全时间输出 y[n]：无启动暂态', [-8, 8], [-span, span], 'n', 245, [-8, -4, 0, 4, 8]);
          q.path(curve(-8, 8, d.spectral), C.teal, '6 4'); for (let k = -8; k <= 8; k++) q.stem(k, d.y(k), k === n ? C.orange : C.teal, 'square');
        }
        const H = {re: d.re, im: d.im}, phase = d.phase == null ? '未定义（幅度为 0）' : `${fmt(api, d.phase)} rad = ${fmt(api, d.phase * 180 / PI, 2)}°`;
        if (n != null || step === 10) {
          const ns = n == null ? [-3, -2, -1, 0, 1, 2, 3] : [n];
          api.canvas.append(api.U.table(['n', 'x[n]', '按差分式求和 y[n]', 'Re{H·exp(jωn)}'], ns.map(k => [k, fmt(api, d.x(k)), fmt(api, d.y(k)), fmt(api, d.spectral(k))])));
        }
        api.formula.textContent = step <= 1 ? `H(e^{jω})=Σᵣ h[r]exp(−jωr)；h=${vector(api, d.h)}，ω=${omega.value}π/8。` : d.phase == null ? 'H(e^{jω})=0 ⇒ y[n]=0；零复数没有可定义的相位。' : `y[n]=Re{H(e^{jω})exp(jωn)}=${fmt(api, d.gain)}·cos(ωn+${fmt(api, d.phase)})${n != null ? '；当前 n=' + n : ''}。`;
        api.result.textContent = `H=${fmt(api, H)}；|H|=${fmt(api, d.gain)}；∠H：${phase}${n != null ? '；y[' + n + ']=' + fmt(api, d.y(n)) : ''}。`;
        api.explain.textContent = '输入余弦定义在所有整数时刻，未乘 u[n]，因此这里直接显示完整正弦响应，不引入启动暂态。虚线只帮助读相位；序列取值以整数处的圆点/方块为准。平均抑制高频，差分抑制低频；在零增益处不报告任意相位。';
      }};
    };

    V.ch2roc = api => {
      const region = select(api, '系统收敛域 ROC', 'roc', [['middle', '½<|z|<2：稳定、非因果'], ['outer', '|z|>2：因果、不稳定'], ['inner', '|z|<½：非因果、不稳定']], 'middle');
      const radius = select(api, '观察半径 r=|z|', 'radius', [.25, .5, .75, 1, 1.5, 2, 3].map(v => [v, v]), 1);
      api.listen(region, 'change', () => {radius.value = region.value === 'outer' ? '3' : region.value === 'inner' ? '0.25' : '1'; api.changed();});
      api.listen(radius, 'change', () => api.changed());
      const rule = key => key === 'outer' ? 'h[n]=[−(1/3)(½)ⁿ+(4/3)2ⁿ]u[n]' : key === 'middle' ? 'h[n]=−(1/3)(½)ⁿu[n]−(4/3)2ⁿu[−n−1]' : 'h[n]=[(1/3)(½)ⁿ−(4/3)2ⁿ]u[−n−1]';
      return {steps: () => 11, render(raw) {
        const step = clip(raw, 11), d = roc(region.value, Number(radius.value)), m = step >= 4 && step < 10 ? step - 3 : 6;
        setState(api, ['algebra', 'region', 'sequence', 'weighting'][step] || (step === 10 ? 'conclusion' : 'weighted-tail'), step);
        const s = figure(api, `相同 H(z)，不同 ROC：${d.valid ? '当前半径在所选域内' : '当前半径不在所选域内'}`, 392), cx = 324, cy = 197, scale = 51;
        const circlePath = r => `M${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy}Z`;
        if (step >= 1) {
          const regionPath = d.key === 'inner' ? circlePath(.5 * scale) : d.key === 'middle' ? circlePath(2 * scale) + circlePath(.5 * scale) : 'M38 49H644V355H38Z' + circlePath(2 * scale);
          s.append(api.U.svg('path', {d: regionPath, fill: C.teal, 'fill-opacity': .12, 'fill-rule': 'evenodd'}));
        }
        line(api, s, 44, cy, 643, cy, C.muted); line(api, s, cx, 350, cx, 48, C.muted);
        [.5, 2].forEach(a => {
          s.append(api.U.svg('circle', {cx, cy, r: a * scale, fill: 'none', stroke: C.grid, 'stroke-dasharray': '3 5'}));
          line(api, s, cx + a * scale - 5, cy - 5, cx + a * scale + 5, cy + 5, C.red); line(api, s, cx + a * scale - 5, cy + 5, cx + a * scale + 5, cy - 5, C.red);
          text(api, s, cx + a * scale, cy + 25, a, C.red, 14, 'middle');
        });
        s.append(api.U.svg('circle', {cx, cy, r: scale, fill: 'none', stroke: C.blue, 'stroke-width': 2, 'stroke-dasharray': '7 4'}));
        s.append(api.U.svg('circle', {cx, cy, r: 6, fill: 'none', stroke: C.muted}));
        text(api, s, cx - 10, cy + 21, '0', C.muted, 14, 'end');
        text(api, s, 561, 80, '× 极点：½、2', C.red, 14, 'end'); text(api, s, 561, 104, '虚线：单位圆', C.blue, 14, 'end'); text(api, s, 561, 128, '浅填充：所选 ROC', C.teal, 14, 'end');
        text(api, s, 625, cy - 9, 'Re(z)', C.muted); text(api, s, cx + 9, 64, 'Im(z)', C.muted);
        if (step >= 3) {
          s.append(api.U.svg('circle', {cx, cy, r: d.radius * scale, fill: 'none', stroke: C.orange, 'stroke-width': 2.5}));
          s.append(api.U.svg('rect', {x: cx + d.radius * scale - 4, y: cy - 4, width: 8, height: 8, fill: C.orange}));
          text(api, s, 54, 335, `实线圆：r=${d.radius}${d.radius === 1 ? '，与单位圆重合' : ''}；${d.radius === .5 || d.radius === 2 ? '经过极点，绝不能作为收敛路径' : d.valid ? '两项都满足几何级数收敛条件' : '至少一项不满足几何级数收敛条件'}`, C.orange, 14);
        }
        text(api, s, 18, 379, 'ROC 不含极点；外域在图外继续延伸。○ 原点为二重零点。', C.muted, 14);
        if (step >= 2) {
          const ns = Array.from({length: 9}, (_, i) => i - 4), hs = ns.map(d.h), max = Math.max(...hs.map(Math.abs), .5);
          const p = graph(api, '时域序列的一个观察窗（不是收敛性证明）', [-4, 4], [-1.15 * max, 1.15 * max], 'n', 245, [-4, -2, 0, 2, 4]);
          ns.forEach((n, i) => p.stem(n, hs[i], C.teal));
          api.canvas.append(api.U.table(['分量', '系数', '序列方向', '加权尾项的模比 q', '解析判断'], d.pieces.map((p, i) => [i ? 'B：极点2' : 'A：极点½', fmt(api, p.c), p.dir === 'right' ? '右边：n≥0' : '左边：n≤−1', fmt(api, p.q), p.converges ? 'q<1，绝对收敛' : p.q === 1 ? 'q=1，项不趋0' : 'q>1，项增大'])));
        }
        if (step >= 4) {
          const endpoints = d.pieces.flatMap(p => [p.logTerm(1), p.logTerm(6)]), lo = Math.floor(Math.min(...endpoints)) - 1, hi = Math.ceil(Math.max(...endpoints)) + 1;
          const p = graph(api, '加权尾项大小：纵轴 log₁₀|h分量[n] r⁻ⁿ|', [1, 6], [lo, hi], '尾部编号 m=|n|（忽略有限个起点项）', 260, [1, 2, 3, 4, 5, 6]);
          d.pieces.forEach((piece, i) => {
            const points = Array.from({length: step === 10 ? 6 : m}, (_, k) => [k + 1, piece.logTerm(k + 1)]);
            p.path(points, i ? C.orange : C.blue, i ? '6 4' : '');
            points.forEach(([x, y]) => p.stem(x, y, i ? C.orange : C.blue, i ? 'square' : 'circle'));
          });
          text(api, p.svg, 73, 66, 'A：实线/圆点；B：虚线/方块；斜率由解析比率 q 决定', C.muted, 14);
        }
        const range = d.key === 'outer' ? '|z|>2' : d.key === 'middle' ? '½<|z|<2' : '|z|<½';
        api.formula.textContent = step === 0 ? 'H(z)=1/[(1−½z⁻¹)(1−2z⁻¹)]=−(1/3)/(1−½z⁻¹)+(4/3)/(1−2z⁻¹)' : step < 3 ? `${range}；${rule(d.key)}` : '右边：|a|/r<1；左边：r/|a|<1；两项均收敛才属于所选 ROC。';
        api.result.textContent = `ROC ${range}；${d.causal ? '因果' : '非因果'}；${d.stable ? 'BIBO 稳定（含单位圆）' : 'BIBO 不稳定（不含单位圆）'}。r=${d.radius}：${d.valid ? '在 ROC 内' : '不在 ROC 内'}${step >= 4 ? '；m='+m+' 时 A/B 尾项模='+d.pieces.map(p => fmt(api, p.term(m))).join(' / ') : ''}。`;
        api.explain.textContent = step >= 4 ? '曲线只展示有限项的趋势，收敛结论来自几何级数的严格条件 q<1；q=1 时项不趋零，q>1 时项增大。有限窗看起来很小，不能证明无限尾部收敛。改变 r 可检验同一侧序列为什么要求不同的环域。' : '有理式没有改变，ROC 决定每个极点采用左边还是右边序列。同一系统函数的稳定性取决于所选 ROC 是否包含整个单位圆；因果性则要求右边响应。';
      }};
    };
  }
  return {sampling, indexMap, convolution, response, roc, register};
});
