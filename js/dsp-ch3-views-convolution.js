/* Chapter 3: reversible convolution and block-convolution teaching views. */
(() => {
  'use strict';
  const V = window.DSPCh3Views = window.DSPCh3Views || {};
  const C = {blue: 'var(--dsp-blue, #3289b7)', teal: 'var(--dsp-teal, #188f81)', orange: 'var(--dsp-orange, #c77735)', red: 'var(--dsp-red, #cc5959)', muted: 'var(--dsp-muted, #7c8a96)', grid: 'var(--dsp-grid, #d6e1e7)'};
  let serial = 0;
  const mod = (n, N) => ((n % N) + N) % N;
  const num = n => Math.abs(n) < 1e-9 ? '0' : Number(n.toFixed(4)).toString();
  const vec = x => '[' + x.map(v => v == null ? '—' : num(v)).join(', ') + ']';
  const limitStep = (n, total) => Math.max(0, Math.min(total - 1, Math.trunc(Number(n) || 0)));

  function select(api, label, key, options, initial) {
    const wrap = api.U.el('label', {class: 'dsp-ch3-control'});
    const text = api.U.el('span', {}, label);
    const field = api.U.el('select', {'data-control': key, 'aria-label': label});
    options.forEach(([value, title]) => field.append(api.U.el('option', {value: String(value)}, title)));
    field.value = String(initial);
    wrap.append(text, field);
    api.controls.append(wrap);
    return field;
  }

  function figure(api, title, height = 360, width = 760) {
    const wrap = api.U.el('div', {class: 'dsp-ch3-flow', style: 'overflow-x:auto;max-width:100%;min-width:0;'});
    const svg = api.U.svg('svg', {viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': title, style: `display:block;width:${width}px;max-width:none;height:${height}px;`});
    svg.append(api.U.svg('title', {}, title));
    wrap.append(svg);
    api.canvas.append(wrap);
    return svg;
  }

  function text(api, svg, x, y, value, color = 'currentColor', size = 14, anchor = 'start') {
    const node = api.U.svg('text', {x, y, fill: color, 'font-size': size, 'text-anchor': anchor}, String(value));
    svg.append(node);
    return node;
  }

  function line(api, svg, x1, y1, x2, y2, color = C.grid, dash = '') {
    const attrs = {x1, y1, x2, y2, stroke: color, 'stroke-width': 1.5};
    if (dash) attrs['stroke-dasharray'] = dash;
    svg.append(api.U.svg('line', attrs));
  }

  function cards(api, svg, title, values, y, opts = {}) {
    const count = values.length;
    const left = opts.left || 144;
    const span = opts.span || 582;
    const dx = span / Math.max(count, 1);
    text(api, svg, 16, y + 22, title, 'currentColor', 14);
    values.forEach((value, k) => {
      const x = left + k * dx;
      const color = opts.color ? opts.color(k) : C.blue;
      const visible = value != null;
      svg.append(api.U.svg('rect', {x: x + 3, y, width: Math.max(20, dx - 6), height: 35, rx: 5, fill: color, 'fill-opacity': visible ? 0.12 : 0.04, stroke: color, 'stroke-opacity': visible ? 0.8 : 0.25}));
      text(api, svg, x + dx / 2, y + 23, visible ? num(value) : '—', visible ? 'currentColor' : C.muted, 15, 'middle');
      text(api, svg, x + dx / 2, y + 53, opts.index ? opts.index(k) : k, C.muted, 12, 'middle');
    });
    return k => left + (k + 0.5) * dx;
  }

  function marker(api, svg, id, color) {
    const defs = api.U.svg('defs');
    const mark = api.U.svg('marker', {id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto'});
    mark.append(api.U.svg('path', {d: 'M0 0 L10 5 L0 10 Z', fill: color}));
    defs.append(mark);
    svg.append(defs);
  }

  function caption(api, value) {
    api.canvas.append(api.U.el('p', {class: 'dsp-ch3-readout'}, value));
  }

  V.convolution = function convolution(api) {
    const exam = api.root.dataset.exam === 'true';
    const presets = [
      {label: 'x=[1,2,3,4]，h=[1,1]', x: [1, 2, 3, 4], h: [1, 1]},
      {label: '含负数：x=[2,−1,1]，h=[1,−1,1]', x: [2, -1, 1], h: [1, -1, 1]},
      {label: '冲激移位：x=[0,1,0,0]，h=[1,2]', x: [0, 1, 0, 0], h: [1, 2]}
    ];
    if (exam) presets.push({label: '信通卷四.1：x=R₃，h=[2,1,3,2]', x: [1, 1, 1], h: [2, 1, 3, 2]});
    const preset = select(api, '输入预设', 'preset', presets.map((p, i) => [i, p.label]), exam ? presets.length - 1 : 0);
    const nControl = select(api, '圆周卷积点数 N', 'N', (exam ? [4, 5, 6, 8] : [4, 5, 8]).map(n => [n, String(n)]), 4);
    const id = 'dsp-ch3-fold-' + (++serial);
    let data;

    function model() {
      const p = presets[Number(preset.value)];
      const x = p.x.slice(), h = p.h.slice(), N = Number(nControl.value);
      const linear = api.M.linearConvolution(x, h);
      const circular = api.M.circularConvolution(x, h, N);
      return {x, h, N, linear, circular, L: linear.length};
    }

    function update() {
      data = model();
      api.changed();
    }
    api.listen(preset, 'change', update);
    api.listen(nControl, 'change', update);
    data = model();
    const total = () => 4 + 4 * data.L;

    function moving(n, phase, introductory) {
      const {x, h, L} = data;
      const indices = Array.from({length: L + h.length - 1}, (_, i) => i - h.length + 1);
      const min = indices[0], max = indices[indices.length - 1];
      const svg = figure(api, introductory === 0 ? '查看原序列 h[k]' : introductory === 1 ? '先翻转为 h[−k]' : `n=${n}：翻转后滑动、相乘、相加`, 410);
      const X = k => 124 + (k - min) * 584 / Math.max(max - min, 1);
      const isOverlap = k => k >= 0 && k < x.length && n - k >= 0 && n - k < h.length;
      text(api, svg, 16, 26, introductory === 0 ? '先看两个从 n=0 开始的有限长序列' : introductory === 1 ? '翻转：原索引 j → −j；数值保持不变' : `当前输出位置 n=${n}：${['滑动到位', '逐项相乘', '求和写出输出'][phase]}`, 'currentColor', 17);
      text(api, svg, 16, 79, 'x[k]', C.blue, 16);
      text(api, svg, 16, 198, introductory === 0 ? 'h[k]' : introductory === 1 ? 'h[−k]' : `h[${n}−k]`, C.teal, 16);
      const baseline = [124, 240];
      indices.forEach(k => {
        line(api, svg, X(k), 43, X(k), 265, C.grid, '3 6');
        const highlight = introductory == null && phase >= 1 && isOverlap(k);
        if (highlight) svg.append(api.U.svg('rect', {x: X(k) - 21, y: 43, width: 42, height: 220, rx: 4, fill: C.orange, 'fill-opacity': 0.08}));
        const hIndex = introductory === 0 ? k : introductory === 1 ? -k : n - k;
        const values = [k >= 0 && k < x.length ? x[k] : 0, hIndex >= 0 && hIndex < h.length ? h[hIndex] : 0];
        values.forEach((v, row) => {
          const y = baseline[row] - v * (row ? 22 : 13);
          const color = highlight ? C.orange : row ? C.teal : C.blue;
          line(api, svg, X(k), baseline[row], X(k), y, color);
          svg.append(api.U.svg('circle', {cx: X(k), cy: y, r: v ? 4.5 : 2.5, fill: color, 'fill-opacity': v ? 1 : 0.4}));
          if (v) text(api, svg, X(k), y + (v >= 0 ? -9 : 17), num(v), color, 14, 'middle');
        });
        text(api, svg, X(k), 298, k, C.muted, 13, 'middle');
      });
      baseline.forEach(y => line(api, svg, 100, y, 730, y, C.muted));
      text(api, svg, 733, 300, 'k', C.muted, 13);
      const terms = [];
      if (introductory == null) {
        for (let k = Math.max(0, n - h.length + 1); k <= Math.min(x.length - 1, n); k++) terms.push({k, a: x[k], b: h[n - k]});
      }
      const product = terms.map(t => `${num(t.a)}×(${num(t.b)})`).join(' + ');
      text(api, svg, 16, 318, introductory == null && phase >= 1 ? `有效乘积：${product}` : introductory === 1 ? '注意：翻转只改变位置，h[0] 仍在原点。' : '下一步先翻转 h，再沿 k 轴滑动。', introductory == null && phase >= 1 ? C.orange : C.muted, 15);
      const produced = Array.from({length: L}, (_, q) => introductory == null && (q < n || (q === n && phase === 2)) ? data.linear[q] : null);
      cards(api, svg, '已求出的 r[n]', produced, 337);
      return {product, terms, produced};
    }

    function fold(q, finished) {
      const {linear, circular, N, L} = data;
      const svg = figure(api, '把线性卷积的各项按模 N 叠加到圆周卷积', 350);
      const count = Math.max(N, L);
      const padded = Array.from({length: count}, (_, i) => i < L ? linear[i] : 0);
      const accumulated = Array(N).fill(0);
      const last = finished ? L - 1 : q;
      for (let i = 0; i <= last; i++) accumulated[mod(i, N)] += linear[i];
      text(api, svg, 16, 29, finished ? '所有线性卷积项都已按模 N 归位' : `当前取线性卷积项 r[${q}]=${num(linear[q])}`, 'currentColor', 17);
      const X = cards(api, svg, '线性 r[q]', padded, 64, {color: k => !finished && k === q ? C.orange : k >= N ? C.orange : C.blue});
      const values = Array.from({length: count}, (_, i) => i < N ? accumulated[i] : null);
      cards(api, svg, `N=${N} 圆周和`, values, 224, {color: k => k < N && !finished && k === mod(q, N) ? C.orange : k < N ? C.teal : C.muted, index: k => k < N ? k : '—'});
      if (!finished) {
        const target = mod(q, N), wraps = q >= N, color = wraps ? C.orange : C.blue;
        marker(api, svg, id, color);
        svg.append(api.U.svg('path', {d: `M${X(q)} 104 C${X(q)} 162,${X(target)} 168,${X(target)} 217`, fill: 'none', stroke: color, 'stroke-width': 3, 'marker-end': `url(#${id})`}));
        text(api, svg, 16, 181, wraps ? `${q} mod ${N} = ${target}：尾部折回` : `${q} mod ${N} = ${target}：位置保持`, color, 16);
      }
      text(api, svg, 16, 324, N >= L ? `N=${N} ≥ ${L}：原始支持内没有两项落入同一个模 N 位置。` : `N=${N} < ${L}：不同线性索引落到同一位置；折回项为 0 时数值可能恰好不变。`, 'currentColor', 15);
      const err = Math.max(...circular.map((v, i) => Math.abs(v - accumulated[i])));
      return {accumulated, err};
    }

    function render(rawStep) {
      const step = limitStep(rawStep, total());
      const {x, h, N, L, linear, circular} = data;
      const completeAt = 2 + 3 * L;
      api.canvas.replaceChildren();
      delete api.canvas.dataset.n;
      api.canvas.dataset.phase = step < 2 ? ['original', 'reverse'][step] : step < completeAt ? 'linear' : step === completeAt ? 'linear-complete' : step < total() - 1 ? 'fold' : 'complete';
      api.canvas.dataset.step = String(step);
      if (step <= 1) {
        moving(0, 0, step);
        api.formula.textContent = step === 0 ? '线性卷积 r[n] = Σₖ x[k]h[n−k]；先辨认原始 h[k]。' : '先反转：h[k] → h[−k]，原位置 j 搬到 −j。';
        api.result.textContent = `x=${vec(x)}；h=${vec(h)}；待求输出长度 Lx+Lh−1=${L}。`;
        api.explain.textContent = step === 0 ? '两个序列从索引 0 开始。逐步前进后，依次看到反转、平移、乘法和求和。' : '反转完成后再平移到 n，得到 h[n−k]；固定一个 n，沿 k 轴相乘再相加。';
        return;
      }
      if (step < completeAt) {
        const n = Math.floor((step - 2) / 3), phase = (step - 2) % 3;
        const state = moving(n, phase, null);
        api.canvas.dataset.n = String(n);
        api.formula.textContent = phase === 0 ? `n=${n}：h[n−k] = h[${n}−k]；与 x[k] 的支持交集决定有效求和范围。` : `r[${n}] = ${state.product}${phase === 2 ? ' = ' + num(linear[n]) : ''}`;
        api.result.textContent = `线性卷积进度：${vec(state.produced)}。`;
        api.explain.textContent = phase === 0 ? `现在把 h[−k] 平移到 n=${n}；先找两行都属于原支持区间的位置。` : phase === 1 ? '橙色列是有效乘积；支持区间外的输入为零，因而不贡献求和。' : `把乘积相加后写入 r[${n}]，再移动到下一个输出位置。`;
        return;
      }
      if (step === completeAt) {
        const svg = figure(api, '完整线性卷积以及即将进行的模 N 折叠', 220);
        text(api, svg, 16, 28, '线性卷积已完成；接下来逐项放入 N 个圆周位置', 'currentColor', 17);
        cards(api, svg, '线性 r[n]', linear, 63);
        text(api, svg, 16, 170, `输出覆盖 0…${L - 1}，长度 ${x.length}+${h.length}−1=${L}。`, 'currentColor', 16);
        api.formula.textContent = `c_N[p] = Σₘ r[p+mN]，0≤p<N；当前选择 N=${N}。`;
        api.result.textContent = `完整线性卷积 r=${vec(linear)}。`;
        api.explain.textContent = `逐步前进将显示真实的折回路径。改变 N，观察 N≥Lx+Lh−1=${L} 时混叠如何消失。`;
        return;
      }
      const finished = step === total() - 1;
      const q = Math.min(L - 1, step - completeAt - 1);
      const state = fold(q, finished);
      api.canvas.dataset.n = String(q);
      const p = mod(q, N), previous = state.accumulated[p] - linear[q];
      api.formula.textContent = finished ? `c_${N}[p] = Σₘ r[p+${N}m]；无混叠所需 N≥Lx+Lh−1=${L}。` : `q=${q} → p=${q} mod ${N}=${p}；c_${N}[${p}] ← ${num(previous)} + (${num(linear[q])}) = ${num(state.accumulated[p])}。`;
      api.result.textContent = `线性 r=${vec(linear)}；${finished ? '完整' : '当前累计'} ${N} 点圆周和=${vec(state.accumulated)}。`;
      api.explain.textContent = finished ? `直接圆周卷积计算为 ${vec(circular)}，与折叠结果的最大误差 ${num(state.err)}。${N >= L ? '补零长度足够，前 '+L+' 项与线性卷积一致，其余为零。' : '尾部落到已有位置发生相加；将 N 改为 '+L+' 或更大再回放。'}` : q >= N ? '橙色箭头是真正的模 N 回卷路径。目标位置保留原值，再加上这一项，因此产生时域混叠。' : '当前项无需跨越边界，直接放到相同编号。继续回放，观察是否有尾部再次进入这个位置。';
    }
    return {steps: total, render};
  };

  V.blocks = function blocks(api) {
    const exam = api.root.dataset.exam === 'true';
    const profiles = {
      'future-ola': {method: 'OLA', x: [2, 4, -1, 3, 1, 5, -2, 0], h: [1, -1, 2]},
      'ict-ols': {method: 'OLS', x: [2, 3, 4, 8, 8, 8, 4, 3, 2], h: [-2, 1, 2]}
    };
    const profileControl = exam ? select(api, '真题与指定分块法', 'profile', [['future-ola', '未来卷计算.3：OLA，新输入 B=3'], ['ict-ols', '信通卷四.2：OLS，有效输出 B=3']], 'future-ola') : null;
    let x = [1, 2, 3, 4, 5, 6];
    const method = select(api, '分块方法', 'method', [['OLA', 'OLA 重叠相加'], ['OLS', 'OLS 重叠保留']], 'OLA');
    const lhControl = select(api, '滤波器长度 Lh', 'Lh', [2, 3, 4].map(n => [n, `${n}（全 1）`]), 3);
    const nControl = select(api, '每块 DFT 点数 N', 'N', (exam ? [5, 8] : [4, 5, 8]).map(n => [n, String(n)]), 5);
    const bControl = select(api, '每块新数据 B', 'B', [[1, '1'], [2, '2'], [3, '3']], 3);
    if (exam) {
      method.disabled = true;
      lhControl.replaceChildren(api.U.el('option', {value: '3'}, '3（按原题系数）'));
      lhControl.value = '3'; lhControl.disabled = true;
    }
    let data;

    function rebuild() {
      const profile = exam ? profiles[profileControl.value] : null;
      if (exam) {
        x = profile.x.slice(); method.value = profile.method;
        nControl.disabled = profile.method === 'OLS';
        if (profile.method === 'OLS') nControl.value = '5';
      }
      const N = Number(nControl.value), Lh = Number(lhControl.value), maxB = N - Lh + 1;
      const previousB = Math.max(1, Number(bControl.value) || 1);
      bControl.replaceChildren();
      for (let b = 1; b <= maxB; b++) bControl.append(api.U.el('option', {value: String(b)}, String(b)));
      bControl.value = String(exam ? 3 : method.value === 'OLS' ? maxB : Math.min(previousB, maxB));
      bControl.disabled = exam || method.value === 'OLS';
      bControl.setAttribute('aria-disabled', String(bControl.disabled));
      const h = exam ? profile.h.slice() : Array(Lh).fill(1), B = Number(bControl.value);
      const trace = method.value === 'OLA' ? api.M.olaTrace(x, h, B, N) : api.M.olsTrace(x, h, N);
      data = {method: method.value, h, N, Lh, B, trace, linear: api.M.linearConvolution(x, h)};
    }
    const update = () => {rebuild(); api.changed();};
    [method, lhControl, nControl, bControl].forEach(field => api.listen(field, 'change', update));
    if (profileControl) api.listen(profileControl, 'change', () => {nControl.value = '5'; update();});
    rebuild();
    const total = () => 2 + 5 * data.trace.blocks.length;

    function overview() {
      const {method: kind, B, N, Lh, trace} = data;
      const svg = figure(api, '分块规则与完整输出长度', 292);
      text(api, svg, 16, 28, kind === 'OLA' ? 'OLA：输入不重叠，输出按原位置相加' : 'OLS：输入重叠，输出丢弃前缀后拼接', 'currentColor', 17);
      cards(api, svg, '原始 x[n]', x, 57);
      cards(api, svg, '滤波器 h[n]', data.h, 136, {color: () => C.teal});
      text(api, svg, 16, 244, `N=${N}，Lh=${Lh}，B=${B}；共 ${trace.blocks.length} 块；完整输出长度 ${trace.output.length}。`, 'currentColor', 15);
      caption(api, kind === 'OLA' ? `有效约束 N≥B+Lh−1：${N}≥${B}+${Lh}−1。每块原始输入最多取 B 个新样本，不重叠。` : `固定 B=N−Lh+1=${B}。相邻输入块重叠 ${Lh - 1} 点；起始补 ${Lh - 1} 个零，尾部补零冲洗，直到得到全部输出。`);
    }

    function currentBlock(index, phase) {
      const {method: kind, B, N, Lh, h, trace} = data;
      const block = trace.blocks[index], OLA = kind === 'OLA';
      const before = index ? trace.blocks[index - 1].partial.slice() : Array(trace.output.length).fill(0);
      const after = phase === 4 ? block.partial : before;
      const effectiveFresh = OLA ? block.fresh : block.input.slice(Lh - 1);
      const inputStart = OLA ? block.start : block.start - Lh + 1;
      const svg = figure(api, `${kind} 第 ${index + 1} 块：${['读取输入', '补零并确定频域长度', '得到循环卷积', OLA ? '输出对齐' : '丢弃污染前缀', OLA ? '累加到完整输出' : '拼接有效输出'][phase]}`, 415);
      text(api, svg, 16, 27, `${kind} 第 ${index + 1}/${trace.blocks.length} 块：${['读取输入', '准备 N 点运算', '逐块循环卷积', OLA ? '对齐待相加区间' : '标出丢弃与保留区间', OLA ? '完成本块累加' : '完成本块拼接'][phase]}`, 'currentColor', 17);
      if (phase === 0) {
        cards(api, svg, OLA ? '本块新输入' : '重叠输入窗口', OLA ? effectiveFresh : block.input, 62, {color: k => !OLA && k < Lh - 1 ? C.orange : C.blue, index: k => OLA ? block.start + k : inputStart + k});
        cards(api, svg, '滤波器 h', h, 158, {color: () => C.teal});
        text(api, svg, 16, 267, OLA ? `数据取 x[${block.start}…${block.start + B - 1}]，超出末尾的样本补 0。` : `窗口取 x[${inputStart}…${inputStart + N - 1}]；原输入范围外一律补 0。`, 'currentColor', 15);
      } else {
        const rawLength = OLA ? B : N;
        cards(api, svg, 'N 点输入', block.input, 57, {color: k => OLA && k >= rawLength ? C.muted : !OLA && k < Lh - 1 ? C.orange : C.blue, index: k => OLA && k >= B ? '补零' : inputStart + k});
        if (phase === 1) {
          cards(api, svg, 'h 补至 N 点', Array.from({length: N}, (_, k) => h[k] || 0), 150, {color: k => k < Lh ? C.teal : C.muted});
          text(api, svg, 16, 271, '下一步：DFT(input) × DFT(h) → IDFT，得到 N 点循环卷积。', 'currentColor', 15);
        } else {
          cards(api, svg, '循环输出 c[m]', block.circular, 151, {color: k => !OLA && phase >= 3 ? (k < Lh - 1 ? C.red : C.teal) : C.teal});
          if (!OLA && phase >= 3) {
            line(api, svg, 145, 206, 144 + (Lh - 1) * 582 / N, 206, C.red);
            text(api, svg, 16, 250, `丢弃 c[0…${Lh - 2}] = ${vec(block.discard)}`, C.red, 15);
            text(api, svg, 16, 279, `保留 c[${Lh - 1}…${N - 1}] = ${vec(block.kept)}`, C.teal, 15);
          } else if (OLA && phase >= 3) {
            const start = block.start, stop = Math.min(trace.output.length - 1, start + block.linear.length - 1);
            const useful = block.linear.slice(0, stop - start + 1);
            const overlap = index ? Math.min(Lh - 1, trace.output.length - start) : 0;
            text(api, svg, 16, 248, `本块线性有效项 ${vec(useful)} → 全局 n=${start}…${stop}`, C.teal, 15);
            text(api, svg, 16, 278, overlap ? `与此前输出交叠 ${overlap} 点：n=${start}…${start + overlap - 1}，逐项相加。` : '第一块还没有此前输出；从全零累计数组开始相加。', C.orange, 15);
          } else {
            text(api, svg, 16, 255, OLA ? 'N 足够容纳这块的线性卷积，圆周结果的有效前缀可按位置累加。' : `前 ${Lh - 1} 点可能受循环回卷污染；下一步将标红并丢弃。`, 'currentColor', 15);
          }
        }
      }
      const progress = Array.from({length: after.length}, (_, k) => {
        const through = phase === 4 ? index : index - 1;
        if (through < 0) return null;
        const prior = trace.blocks[through];
        const end = OLA ? prior.start + prior.linear.length : prior.start + B;
        return k < end ? after[k] : null;
      });
      cards(api, svg, OLA ? '当前累计输出' : '已拼接输出', progress, 337, {color: k => phase >= 3 && k >= block.start && k < block.start + (OLA ? block.linear.length : B) ? C.orange : C.blue});
      return {block, before, after, progress, effectiveFresh};
    }

    function alignment(index, phase, state) {
      if (phase < 3) return;
      const {method: kind, Lh, trace, B} = data;
      const {block, before} = state;
      if (kind === 'OLS') {
        const extra = Math.max(0, block.start + B - trace.output.length);
        caption(api, `本块有效输出送入全局 y[${block.start}…${block.start + B - 1}]。${extra ? `末块有 ${extra} 个输出超出完整长度 ${trace.output.length}，最终裁去；末尾的非零尾响应已保留。` : '有效部分直接拼接，不与上一块相加。'}红色前缀无论数值是否偶然正确，都按规则丢弃。`);
        return;
      }
      const svg = figure(api, 'OLA 输出对齐后相加', 255);
      text(api, svg, 16, 27, '同一全局索引对齐：已有累计值 + 当前块贡献', 'currentColor', 16);
      const addend = Array.from({length: trace.output.length}, (_, k) => k >= block.start && k < block.start + block.linear.length ? block.linear[k - block.start] : 0);
      const overlap = k => index > 0 && k >= block.start && k < block.start + Lh - 1;
      cards(api, svg, '此前累计', before, 57, {color: k => overlap(k) ? C.orange : C.blue});
      cards(api, svg, '本块贡献', addend, 133, {color: k => overlap(k) ? C.orange : C.teal});
      text(api, svg, 16, 233, phase === 3 ? '橙色列需要相加；再前进一步，完成本块写入。' : '相加已经写入上图的累计输出；后续块继续在自己的全局位置叠加。', 'currentColor', 15);
    }

    function render(rawStep) {
      const step = limitStep(rawStep, total());
      const {method: kind, B, N, Lh, trace, linear} = data;
      api.canvas.replaceChildren();
      delete api.canvas.dataset.block;
      api.canvas.dataset.step = String(step);
      api.canvas.dataset.method = kind;
      if (step === 0) {
        overview();
        api.canvas.dataset.phase = 'overview';
        api.formula.textContent = kind === 'OLA' ? `N≥B+Lh−1：${N}≥${B}+${Lh}−1；块偏移为 jB。` : `B=N−Lh+1=${B}；每块丢弃前 Lh−1=${Lh - 1} 点。`;
        api.result.textContent = `x=${vec(x)}；h=${vec(data.h)}；目标输出长度 ${linear.length}。`;
        api.explain.textContent = kind === 'OLA' ? '先分割不重叠的输入段，补零后逐块循环卷积；各块的线性输出尾部要在相同全局位置相加。' : '输入窗口先保留上一段末尾的 Lh−1 点，再加入 B 个新样本。最后仍须输入零值，冲洗滤波器尾响应。';
        return;
      }
      if (step === total() - 1) {
        const svg = figure(api, '完整分块输出与直接线性卷积核对', 240);
        text(api, svg, 16, 28, `${kind}：全部 ${trace.blocks.length} 块已经完成`, 'currentColor', 17);
        cards(api, svg, `${kind} 输出`, trace.output, 59, {color: () => C.teal});
        cards(api, svg, '直接线性卷积', linear, 139, {color: () => C.blue});
        const error = Math.max(...linear.map((v, k) => Math.abs(v - trace.output[k])));
        api.canvas.dataset.phase = 'complete';
        api.formula.textContent = `y[0…${linear.length - 1}] = x*h；${kind === 'OLA' ? '按 jB 对齐后相加' : '丢弃每块前缀后拼接，并裁至 Lx+Lh−1 点'}。`;
        api.result.textContent = `完整输出 ${vec(trace.output)}；与直接线性卷积的最大误差 ${num(error)}。`;
        api.explain.textContent = kind === 'OLA' ? '每块输入只出现一次；输出的重叠尾部通过相加恢复原来应有的全部贡献。' : '重叠输入提供历史样本，污染前缀被丢弃；尾部冲洗保留滤波器的全部余响，所以完整长度超过输入长度。';
        return;
      }
      const index = Math.floor((step - 1) / 5), phase = (step - 1) % 5;
      const state = currentBlock(index, phase);
      alignment(index, phase, state);
      const {block} = state;
      api.canvas.dataset.phase = ['input', 'padding', 'circular', kind === 'OLA' ? 'align' : 'discard', 'commit'][phase];
      api.canvas.dataset.block = String(index);
      if (phase < 2) {
        api.formula.textContent = `${kind} 第 ${index + 1} 块：N=${N}，Lh=${Lh}，B=${B}；${kind === 'OLA' ? `输入起点 jB=${block.start}` : `窗口起点 jB−(Lh−1)=${block.start - Lh + 1}`}。`;
      } else if (phase === 2) {
        api.formula.textContent = `本步求 c_${index}[m] = IDFT{DFT(x_${index})·DFT(h)}，0≤m<${N}；尚未写入全局输出。`;
      } else {
        const action = phase === 3 ? '待写入' : '已写入';
        api.formula.textContent = kind === 'OLA' ? `${action}：y[${block.start}+m] += c_${index}[m]，0≤m<${Math.min(block.linear.length, trace.output.length - block.start)}。` : `${action}：y[${block.start}+r] = c_${index}[${Lh - 1}+r]，0≤r<${B}（超出完整长度时裁去）。`;
      }
      api.result.textContent = phase < 2 ? `当前输入 ${vec(block.input)}；待进行 ${N} 点循环卷积。` : `${N} 点循环结果 ${vec(block.circular)}；${kind === 'OLA' ? '当前累计' : '已拼接'} ${vec(state.progress)}。`;
      api.explain.textContent = phase === 0 ? kind === 'OLA' ? '读取 B 个互不重叠的新数据；不足 B 的末块用零补齐。' : '橙色为已读过的历史样本，新数据在其后；超出原输入的样本为冲洗所需的零。' : phase === 1 ? kind === 'OLA' ? '将本块和滤波器都补到 N 点。N≥B+Lh−1 保证本块不会发生时域混叠。' : '输入窗口已有 N 点；滤波器补到 N 点。循环卷积会使前 Lh−1 个位置可能受尾部回卷影响。' : phase === 2 ? '本步的数值来自实际 DFT 乘法与 IDFT。继续前进，查看哪些位置需要相加或丢弃。' : phase === 3 ? kind === 'OLA' ? '先对齐，不立即拼接；橙色位置存在来自不同块的贡献，需要相加。' : '红色前缀按规则丢弃，绿色 B 点才是本块新产生的线性卷积输出。' : kind === 'OLA' ? '本块贡献已经累加；累计输出的尾部可能还会与后块重叠。' : '本块有效值已顺序拼接；末块补零继续产生尾响应，超过目标长度的点会被裁去。';
    }
    return {steps: total, render};
  };
  V.examConvolution = api => V.convolution(api);
  V.examBlocks = api => V.blocks(api);
})();
