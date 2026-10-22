/* Independent Smith lab. No dependencies; all loci use Gamma=(z-1)/(z+1). */
((global) => {
  'use strict';
  const TAU = 2 * Math.PI;
  const complex = (r, i = 0) => ({r, i});
  const add = (a, b) => complex(a.r + b.r, a.i + b.i);
  const sub = (a, b) => complex(a.r - b.r, a.i - b.i);
  const neg = a => complex(-a.r, -a.i);
  const abs = a => Math.hypot(a.r, a.i);
  const divide = (a, b) => {
    const scale = Math.max(Math.abs(b.r), Math.abs(b.i));
    if (scale < 1e-12) return null;
    const br = b.r / scale, bi = b.i / scale, ar = a.r / scale, ai = a.i / scale;
    const q = br * br + bi * bi;
    return complex((ar * br + ai * bi) / q, (ai * br - ar * bi) / q);
  };
  const gammaFromZ = z => divide(sub(z, complex(1)), add(z, complex(1)));
  const zFromGamma = g => divide(add(complex(1), g), sub(complex(1), g));
  const yFromGamma = g => divide(sub(complex(1), g), add(complex(1), g));
  const mod = (x, m) => ((x % m) + m) % m;
  const rotate = (g, distance) => {
    const angle = -2 * TAU * distance, c = Math.cos(angle), s = Math.sin(angle);
    return complex(g.r * c - g.i * s, g.r * s + g.i * c);
  };
  const presets = Object.freeze({
    A: Object.freeze({r: .8, x: -.6, z0: 100, distance: .2, name: 'A：80 − j60 Ω，Z₀=100 Ω'}),
    B: Object.freeze({r: 1.6, x: -.4, z0: 50, distance: .35, name: 'B：80 − j20 Ω，Z₀=50 Ω'}),
    C: Object.freeze({r: .5, x: -.1, z0: 50, distance: 0, name: 'C：zL=0.5 − j0.1，找两个 g=1 位置'})
  });
  function intersections(g) {
    const radius = abs(g);
    if (radius < 1e-9 || radius >= 1 - 1e-10) return [];
    const vertical = radius * Math.sqrt(Math.max(0, 1 - radius * radius));
    return [-1, 1].map(sign => {
      const point = complex(-radius * radius, sign * vertical);
      const distance = mod(Math.atan2(g.i, g.r) - Math.atan2(point.i, point.r), TAU) / (2 * TAU);
      const y = yFromGamma(point), bIn = -y.i;
      return {distance, gamma: point, y, bIn, shortLength: Math.atan2(1, -bIn) / TAU};
    }).sort((a, b) => a.distance - b.distance);
  }
  function sampleResistance(r, n = 220) {
    const points = [complex(1)];
    for (let k = 0; k <= n; k++) {
      const x = Math.tan(-Math.PI / 2 + .00001 + (Math.PI - .00002) * k / n);
      points.push(gammaFromZ(complex(r, x)));
    }
    points.push(complex(1));
    return points;
  }
  function sampleReactance(x, n = 180) {
    const points = [];
    for (let k = 0; k <= n; k++) {
      points.push(gammaFromZ(complex(Math.tan((Math.PI / 2 - .00001) * k / n), x)));
    }
    points.push(complex(1));
    return points;
  }
  const model = Object.freeze({complex, gammaFromZ, zFromGamma, yFromGamma, rotate, intersections,
    sampleResistance, sampleReactance, presets});
  // This branch also makes the model directly verifiable with Node's require().
  if (typeof document === 'undefined') {
    if (typeof module === 'object' && module.exports) module.exports = model;
    return;
  }
  if (global.MicrowaveSmithLab) { global.MicrowaveSmithLab.init(); return; }

  const NS = 'http://www.w3.org/2000/svg', SELECTOR = '.mw-demo[data-mw-demo="smith-lab"]';
  const controllers = new Set(), byHost = new WeakMap();
  let nextId = 0;
  const el = (tag, attributes = {}, value = '') => {
    const node = document.createElement(tag);
    Object.entries(attributes).forEach(([key, val]) => node.setAttribute(key, val));
    if (value) node.textContent = value;
    return node;
  };
  const svgEl = (tag, attributes = {}, value = '') => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([key, val]) => node.setAttribute(key, val));
    if (value) node.textContent = value;
    return node;
  };
  const clean = x => Math.abs(x) < 5e-10 ? 0 : x;
  const fixed = (x, digits = 6) => clean(x).toFixed(digits);
  const formatComplex = (z, digits = 6) => z ? `${fixed(z.r, digits)} ${clean(z.i) < 0 ? '−' : '+'} j${fixed(Math.abs(z.i), digits)}` : '∞（该量在此参考面为极限）';
  const signed = x => `${clean(x) < 0 ? '−' : '+'}${fixed(Math.abs(x))}`;
  const C = 260, R = 224;
  const point = z => [C + R * z.r, C - R * z.i];
  const pathData = points => points.map((p, i) => {
    const [x, y] = point(p); return `${i ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`;
  }).join(' ');

  function mount(host) {
    if (byHost.has(host) || host.dataset.mwSmithReady === '1') return;
    const id = `mws-${++nextId}`;
    const state = {...presets.A, view: 'z', preset: 'A', playing: false};
    let resetPreset = 'A', frame = 0, lastTime = 0, isVisible = true;
    let cachedGeometry = '', cachedSolutions = '';
    const reduceMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
    host.classList.add('mws-lab');
    const title = el('strong', {class: 'mws-title'}, 'Smith 圆图实验台：定位、旋转、找单位电导');
    const intro = el('p', {class: 'mws-intro'}, '输入归一化负载 zL=rL+jxL，沿无耗线从负载向源移动。网格画的是反射系数坐标，曲线刻度对应阻抗或导纳。');
    const presetBar = el('div', {class: 'mws-presets', role: 'group', 'aria-label': '三个代表例预设'});
    const presetButtons = {};
    const makeButton = (parent, label, action, fn) => {
      const button = el('button', {type: 'button', 'data-mws-action': action}, label);
      button.addEventListener('click', fn); parent.append(button); return button;
    };
    Object.entries(presets).forEach(([key, value]) => {
      presetButtons[key] = makeButton(presetBar, value.name, `preset-${key}`, () => loadPreset(key));
    });

    const workspace = el('div', {class: 'mws-workspace'});
    const figure = el('figure', {class: 'mws-figure'});
    const coordinateBadge = el('div', {class: 'mws-coordinate-badge'});
    const plot = el('div', {class: 'mws-plot'});
    const chart = svgEl('svg', {viewBox: '0 0 520 520', role: 'img', 'aria-labelledby': `${id}-chart-title ${id}-chart-desc`});
    const chartTitle = svgEl('title', {id: `${id}-chart-title`}, 'Smith 圆图：沿线位置与单位电导交点');
    const chartDescription = svgEl('desc', {id: `${id}-chart-desc`});
    chart.append(chartTitle, chartDescription);
    const defs = svgEl('defs');
    const clip = svgEl('clipPath', {id: `${id}-clip`});
    clip.append(svgEl('circle', {cx: C, cy: C, r: R + 1}));
    defs.append(clip);
    const marker = svgEl('marker', {id: `${id}-arrow`, viewBox: '0 0 8 8', refX: 7, refY: 4,
      markerWidth: 5, markerHeight: 5, orient: 'auto'});
    marker.append(svgEl('path', {d: 'M0 0L8 4L0 8Z', class: 'mws-arrow-fill'}));
    defs.append(marker); chart.append(defs);
    const gridGroup = svgEl('g', {class: 'mws-grid-lines', 'clip-path': `url(#${id}-clip)`});
    const gridLabelGroup = svgEl('g');
    [0, .2, .5, 1, 2, 5].forEach(r => {
      const locus = svgEl('path', {d: pathData(sampleResistance(r)), class: r === 0 ? 'mws-unit-boundary' : 'mws-grid-path'});
      if (r === 0) chart.append(locus); else gridGroup.append(locus);
      if (r > 0) {
        const [x, y] = point(gammaFromZ(complex(r)));
        gridLabelGroup.append(svgEl('text', {x, y: y + 21, 'text-anchor': 'middle', class: 'mws-svg-grid-label'}, String(r)));
      }
    });
    [-5, -2, -1, -.5, -.2, .2, .5, 1, 2, 5].forEach(x => {
      gridGroup.append(svgEl('path', {d: pathData(sampleReactance(x)), class: 'mws-grid-path'}));
    });
    gridGroup.append(svgEl('path', {d: pathData([complex(-1), complex(1)]), class: 'mws-grid-path'}));
    chart.append(gridGroup, gridLabelGroup);
    const radiusPath = svgEl('path', {class: 'mws-radius-path'});
    const g1Path = svgEl('path', {class: 'mws-g1-path'});
    const travelPath = svgEl('path', {class: 'mws-travel-path', 'marker-end': `url(#${id}-arrow)`});
    const markerGroup = svgEl('g'), labelGroup = svgEl('g');
    const realAxis = svgEl('text', {x: 499, y: 255, 'text-anchor': 'end', class: 'mws-axis-label'});
    const imagAxis = svgEl('text', {x: 269, y: 24, class: 'mws-axis-label'});
    chart.append(radiusPath, g1Path, travelPath, markerGroup, labelGroup, realAxis, imagAxis);
    plot.append(chart);
    const legend = el('figcaption', {class: 'mws-legend'});
    [['网格：等 r/x 或 g/b', 'grid'], ['虚线：等 |Γ|', 'radius'], ['绿线：g=1', 'g1'], ['蓝弧：沿线', 'travel'], ['橙点 P：当前', 'point']].forEach(([label, kind]) => {
      const item = el('span'); item.append(el('i', {class: `mws-key-${kind}`}), document.createTextNode(label)); legend.append(item);
    });
    const direction = el('p', {class: 'mws-chart-note'}, '向源顺时针；Γ 的转角是电长度的两倍。一圈 = 0.5λ。L 为负载点，P 为当前参考面，1/2 为两处 g=1 位置。');
    figure.append(coordinateBadge, plot, legend, direction);

    const controls = el('div', {class: 'mws-controls'});
    const fields = el('div', {class: 'mws-fields'});
    const makeNumber = (label, key, min, max, step) => {
      const box = el('div', {class: 'mws-field'}), fieldId = `${id}-${key}`;
      const input = el('input', {type: 'number', id: fieldId, 'data-mws-control': key, step});
      if (min !== null) input.min = String(min);
      if (max !== null) input.max = String(max);
      box.append(el('label', {for: fieldId}, label), input); fields.append(box);
      return input;
    };
    const rInput = makeNumber('归一电阻 rL ≥ 0', 'r', 0, null, 'any');
    const xInput = makeNumber('归一电抗 xL', 'x', null, null, 'any');
    const z0Input = makeNumber('参考 Z₀ / Ω', 'z0', 0, null, 'any');
    const distanceInput = makeNumber('距离 l/λ（0–0.5）', 'distance', 0, .5, 'any');
    const range = el('input', {type: 'range', min: 0, max: .5, step: 'any',
      'data-mws-control': 'distance-range', 'aria-label': '拖动沿线距离 l/λ，从0到0.5'});
    const rotationReadout = el('p', {class: 'mws-rotation'});
    const viewField = el('div', {class: 'mws-field mws-view-field'}), viewId = `${id}-view`;
    const viewSelect = el('select', {id: viewId, 'data-mws-control': 'view'});
    viewSelect.append(el('option', {value: 'z'}, '阻抗图：实际 Γ'), el('option', {value: 'y'}, '导纳代读：Γy = −Γ'));
    viewField.append(el('label', {for: viewId}, '绘图坐标（不增加线长）'), viewSelect);
    const options = el('div', {class: 'mws-options'});
    const checkOption = (label, key) => {
      const item = el('label'), checkbox = el('input', {type: 'checkbox', 'data-mws-control': key});
      checkbox.checked = true; item.append(checkbox, document.createTextNode(label)); options.append(item); return checkbox;
    };
    const gridCheck = checkOption('显示网格', 'grid');
    const g1Check = checkOption('显示 g=1 与交点', 'g1');
    const actions = el('div', {class: 'mws-actions'});
    const playButton = makeButton(actions, '播放', 'play', () => state.playing ? stop('已暂停，可用数值输入或逐步继续。') : play());
    makeButton(actions, '逐步 +0.01λ', 'step', () => {
      stop(); state.distance = state.distance >= .5 - 1e-10 ? 0 : Math.min(.5, state.distance + .01);
      syncInputs(); render(); status.textContent = '已向源移动一步：Δl=0.01λ，Γ 顺时针转 7.2°。';
    });
    makeButton(actions, '重置', 'reset', () => loadPreset(resetPreset));
    const motionNote = el('p', {class: 'mws-motion-note'});
    const error = el('p', {class: 'mws-error', role: 'status'});
    const readouts = el('dl', {class: 'mws-readouts'}), readoutNodes = {};
    [['z', '当前 z'], ['y', '当前 y'], ['gamma', '实际 Γ'], ['gammaY', '代读 Γy'], ['magnitude', '|Γ| 与 ρ'], ['physical', '实际 Zin / Ω']].forEach(([key, label]) => {
      const row = el('div', {class: 'mws-readout-row'}), value = el('dd');
      row.append(el('dt', {}, label), value); readouts.append(row); readoutNodes[key] = value;
    });
    const coordinateNote = el('p', {class: 'mws-coordinate-note'});
    const status = el('p', {class: 'mws-status', 'aria-live': 'polite', 'aria-atomic': 'true'});
    controls.append(fields, range, rotationReadout, viewField, options, actions, motionNote, error, readouts, coordinateNote);
    workspace.append(figure, controls);
    const solutions = el('section', {class: 'mws-solutions', 'aria-label': '单位电导交点与并联支节关联'});
    solutions.append(el('strong', {class: 'mws-solutions-title'}, '两个 g=1 位置：先选主线位置，再配支节'));
    solutions.append(el('p', {class: 'mws-sign-note'}, '统一写 y=1−j b_in；要匹配，应并联 y_s=+j b_in。表里的 b_in 不是 y 的虚部。'));
    const solutionList = el('div', {class: 'mws-solution-list'}); solutions.append(solutionList);
    const footnote = el('p', {class: 'mws-footnote'}, '假设均匀无耗线、实数正值 Z₀ 和无源负载。Z₀只负责实际阻抗换算；归一化 r/x 决定圆图。外圈 rL=0 的全反射负载不能靠无耗纯电纳支节变成匹配负载。');
    host.replaceChildren(title, intro, presetBar, workspace, solutions, status, footnote);

    function mapped(g) { return state.view === 'y' ? neg(g) : g; }
    function syncInputs() {
      rInput.value = String(state.r); xInput.value = String(state.x); z0Input.value = String(state.z0);
      distanceInput.value = String(Number(state.distance.toFixed(9))); range.value = String(state.distance);
      viewSelect.value = state.view;
    }
    function stop(message = '') {
      state.playing = false;
      if (frame) global.cancelAnimationFrame(frame);
      frame = 0; lastTime = 0; playButton.textContent = '播放'; playButton.setAttribute('aria-pressed', 'false');
      host.dataset.mwsPlaying = 'false'; if (message) status.textContent = message;
    }
    function animate(time) {
      frame = 0;
      if (!host.isConnected) { controller.destroy(); return; }
      if (!state.playing || !isVisible || document.hidden || reduceMotion.matches) { stop(); return; }
      if (lastTime) state.distance = mod(state.distance + Math.min((time - lastTime) / 1000, .05) * .04, .5);
      lastTime = time; distanceInput.value = state.distance.toFixed(6); render();
      frame = global.requestAnimationFrame(animate);
    }
    function play() {
      if (reduceMotion.matches) { status.textContent = '系统开启了减少动态效果；请用逐步或直接输入距离。'; return; }
      if (!isVisible || document.hidden) { status.textContent = '图表不可见，播放保持暂停。'; return; }
      state.playing = true; lastTime = 0; playButton.textContent = '暂停'; playButton.setAttribute('aria-pressed', 'true');
      host.dataset.mwsPlaying = 'true'; status.textContent = '正在向源移动；一圈对应 0.5λ。可随时暂停。';
      frame = global.requestAnimationFrame(animate);
    }
    function loadPreset(key) {
      stop(); Object.assign(state, presets[key], {view: 'z', preset: key}); resetPreset = key;
      gridCheck.checked = true; g1Check.checked = true;
      [rInput, xInput, z0Input, distanceInput].forEach(input => input.removeAttribute('aria-invalid'));
      error.textContent = ''; cachedGeometry = ''; cachedSolutions = ''; syncInputs(); render();
      status.textContent = `已载入 ${presets[key].name}；重置会回到本例的起始设置。`;
    }
    function labelMarkers(markers) {
      const groups = [];
      markers.forEach(item => {
        const [x, y] = point(mapped(item.gamma));
        const near = groups.find(g => Math.hypot(g.x - x, g.y - y) < 18);
        if (near) near.names.push(item.name); else groups.push({x, y, names: [item.name]});
      });
      const occupied = [{left: 438, right: 506, top: 233, bottom: 259},
        {left: 264, right: 340, top: 5, bottom: 29}];
      groups.forEach(group => {
        const value = group.names.join('/'), width = 12 * value.length + 4;
        let chosen = null;
        for (const [dx, dy] of [[14, -14], [14, 29], [-14, -14], [-14, 29], [0, -24], [0, 35]]) {
          const anchor = dx < 0 ? 'end' : dx === 0 ? 'middle' : 'start';
          const x = group.x + dx, y = group.y + dy;
          const left = x - (anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0);
          const box = {left, right: left + width, top: y - 20, bottom: y + 3};
          if (box.left < 14 || box.right > 506 || box.top < 15 || box.bottom > 505) continue;
          if (occupied.some(b => !(box.right < b.left || box.left > b.right || box.bottom < b.top || box.top > b.bottom))) continue;
          chosen = {x, y, anchor, box}; break;
        }
        if (chosen) {
          occupied.push(chosen.box); labelGroup.append(svgEl('text', {x: chosen.x, y: chosen.y,
            'text-anchor': chosen.anchor, class: 'mws-point-label'}, value));
        }
      });
    }
    function updateSolutions(gl, points) {
      const key = `${state.r}/${state.x}`;
      if (key === cachedSolutions) return;
      cachedSolutions = key; solutionList.replaceChildren();
      if (!points.length) {
        const message = abs(gl) < 1e-9 ? '负载已经匹配：各位置 y=1，无须再找两个不同的接入点。' :
          '全反射边界：没有有限的 g=1 接入点；无耗纯电纳支节不能让纯电抗负载吸收平均有功功率。';
        solutionList.append(el('p', {class: 'mws-degenerate'}, message)); return;
      }
      points.forEach((solution, i) => {
        const card = el('div', {class: 'mws-solution'});
        makeButton(card, `到交点 ${i + 1}：l/λ=${fixed(solution.distance)}`, `intersection-${i + 1}`, () => {
          stop(); state.distance = solution.distance; syncInputs(); render();
          status.textContent = `已到 g=1 交点 ${i + 1}。这是选接入位置，尚未实际加入支节。`;
        });
        card.append(el('p', {}, `y = ${formatComplex(solution.y)}；b_in = ${signed(solution.bIn)}`));
        card.append(el('p', {}, `需 y_s = ${solution.bIn < 0 ? '−' : '+'}j${fixed(Math.abs(solution.bIn))}；同阻抗短路支节 l_s/λ_s = ${fixed(solution.shortLength)}`));
        solutionList.append(card);
      });
    }
    function render() {
      const gl = gammaFromZ(complex(state.r, state.x)), current = rotate(gl, state.distance);
      const z = zFromGamma(current), y = yFromGamma(current), points = intersections(gl);
      const geometryKey = `${state.view}/${state.r}/${state.x}`;
      if (geometryKey !== cachedGeometry) {
        cachedGeometry = geometryKey;
        radiusPath.setAttribute('d', pathData(Array.from({length: 221}, (_, k) => mapped(complex(abs(gl) * Math.cos(TAU * k / 220), abs(gl) * Math.sin(TAU * k / 220))))));
        const g1 = [];
        for (let k = 0; k <= 220; k++) {
          const b = Math.tan(-Math.PI / 2 + .00001 + (Math.PI - .00002) * k / 220);
          g1.push(mapped(divide(sub(complex(1), complex(1, b)), add(complex(1), complex(1, b)))));
        }
        g1Path.setAttribute('d', pathData(g1));
      }
      const arc = Array.from({length: 161}, (_, k) => mapped(rotate(gl, state.distance * k / 160)));
      travelPath.setAttribute('d', pathData(arc)); travelPath.style.display = state.distance > 1e-7 && abs(gl) > 1e-9 ? '' : 'none';
      gridGroup.style.display = gridCheck.checked ? '' : 'none'; gridLabelGroup.style.display = gridCheck.checked ? '' : 'none';
      g1Path.style.display = g1Check.checked ? '' : 'none';
      markerGroup.replaceChildren(); labelGroup.replaceChildren();
      const markers = [{gamma: gl, name: 'L', className: 'mws-load-point'}];
      if (g1Check.checked) points.forEach((p, i) => markers.push({gamma: p.gamma, name: String(i + 1), className: 'mws-crossing-point'}));
      markers.push({gamma: current, name: 'P', className: 'mws-current-point'});
      markers.forEach(item => {
        const [x, py] = point(mapped(item.gamma));
        markerGroup.append(svgEl('circle', {cx: x, cy: py, r: item.name === 'P' ? 6 : 5, class: item.className}));
      });
      labelMarkers(markers);
      const isAdmittance = state.view === 'y';
      coordinateBadge.textContent = isAdmittance ? '当前画 Γy=−Γ：导纳代读坐标' : '当前画实际 Γ：阻抗坐标';
      realAxis.textContent = isAdmittance ? 'Re Γy' : 'Re Γ'; imagAxis.textContent = isAdmittance ? 'Im Γy' : 'Im Γ';
      coordinateNote.textContent = isAdmittance ?
        '点、轨迹与 g=1 圆都已映到 Γy=−Γ。右侧 g=1 圆只是同一物理状态的导纳代读；没有增加 λ/4 线段，实际 Γ 数值不变。' :
        '实际 Γ 平面的 g=1 圆位于左半图，圆心 −0.5、半径 0.5；不是右半图的 r=1 圆。绿色交点把电导调到 1，仍需支节消电纳。';
      rotationReadout.textContent = `l/λ=${fixed(state.distance)}；电长度 βl=${fixed(360 * state.distance, 2)}°；Γ 顺时针转 ${fixed(720 * state.distance, 2)}°`;
      range.value = String(state.distance); range.setAttribute('aria-valuetext', `${fixed(state.distance)} 波长，反射系数顺时针 ${fixed(720 * state.distance, 2)} 度`);
      readoutNodes.z.textContent = formatComplex(z); readoutNodes.y.textContent = formatComplex(y);
      readoutNodes.gamma.textContent = formatComplex(current); readoutNodes.gammaY.textContent = formatComplex(neg(current));
      const magnitude = abs(gl), rho = magnitude >= 1 - 1e-10 ? '∞' : fixed((1 + magnitude) / (1 - magnitude), 4);
      readoutNodes.magnitude.textContent = `${fixed(magnitude)}；ρ=${rho}`;
      readoutNodes.physical.textContent = z ? formatComplex(complex(z.r * state.z0, z.i * state.z0), 4) : '∞（开路极限）';
      chartDescription.textContent = `${coordinateBadge.textContent}。负载${formatComplex(complex(state.r, state.x))}，向源移动${fixed(state.distance)}波长；实际反射系数${formatComplex(current)}。蓝弧为顺时针双倍电长度，绿线为单位电导。`;
      Object.entries(presetButtons).forEach(([key, button]) => button.setAttribute('aria-pressed', String(state.preset === key)));
      updateSolutions(gl, points);
      host.dataset.mwsView = state.view; host.dataset.mwsPreset = state.preset;
      host.dataset.mwsDistance = String(state.distance); host.dataset.mwsGammaReal = String(current.r); host.dataset.mwsGammaImag = String(current.i);
    }

    [[rInput, 'r'], [xInput, 'x'], [z0Input, 'z0'], [distanceInput, 'distance']].forEach(([input, key]) => {
      input.addEventListener('input', () => {
        stop(); const pending = {}, inputs = [[rInput, 'r'], [xInput, 'x'], [z0Input, 'z0'], [distanceInput, 'distance']];
        let valid = true;
        inputs.forEach(([field, fieldKey]) => {
          const value = Number(field.value);
          const okay = field.value.trim() !== '' && Number.isFinite(value) && field.validity.valid &&
            (fieldKey !== 'z0' || value > 0);
          field.setAttribute('aria-invalid', String(!okay)); valid = valid && okay; pending[fieldKey] = value;
        });
        if (!valid) { error.textContent = '请输入有限数值：rL ≥ 0，Z₀ > 0，0 ≤ l/λ ≤ 0.5。图保留上次有效状态。'; return; }
        error.textContent = ''; Object.assign(state, pending);
        if (key !== 'distance') state.preset = 'custom';
        render();
      });
      input.addEventListener('focus', () => { if (state.playing) stop('编辑数值时已暂停播放。'); });
    });
    range.addEventListener('input', () => { stop(); state.distance = Number(range.value); distanceInput.value = state.distance.toFixed(6); render(); });
    viewSelect.addEventListener('change', () => { stop(); state.view = viewSelect.value; render(); status.textContent = '已切换读图坐标，物理线长与实际反射系数均未改变。'; });
    [gridCheck, g1Check].forEach(input => input.addEventListener('change', render));
    const motionChange = () => {
      playButton.disabled = reduceMotion.matches;
      motionNote.textContent = reduceMotion.matches ? '系统开启减少动态效果：连续播放已关闭，可直接输入或逐步移动。' : '播放可暂停；离开视口或切到其他标签页时自动暂停，不会自动重播。';
      if (reduceMotion.matches && state.playing) stop('已按系统减少动态效果设置暂停。');
    };
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', motionChange); else reduceMotion.addListener(motionChange);
    const observer = 'IntersectionObserver' in global ? new IntersectionObserver(entries => {
      isVisible = entries[0].isIntersecting;
      if (!isVisible && state.playing) stop('已离开图表，播放自动暂停；返回后可手动继续。');
    }, {threshold: 0}) : null;
    if (observer) observer.observe(host);
    const controller = {
      host, stop,
      snapshot: () => ({r: state.r, x: state.x, z0: state.z0, distance: state.distance, view: state.view,
        preset: state.preset, playing: state.playing, gamma: rotate(gammaFromZ(complex(state.r, state.x)), state.distance)}),
      destroy: () => {
        stop(); if (observer) observer.disconnect();
        if (reduceMotion.removeEventListener) reduceMotion.removeEventListener('change', motionChange); else reduceMotion.removeListener(motionChange);
        controllers.delete(controller); byHost.delete(host); delete host.dataset.mwSmithReady;
      }
    };
    byHost.set(host, controller); controllers.add(controller);
    syncInputs(); motionChange(); render(); playButton.setAttribute('aria-pressed', 'false');
    host.dataset.mwSmithReady = '1'; host.dataset.mwsPlaying = 'false';
    status.textContent = '默认已载入例 A。先观察负载 L 与当前位置 P，再尝试切换导纳代读。';
  }
  function init(scope = document) {
    controllers.forEach(controller => { if (!controller.host.isConnected) controller.destroy(); });
    if (scope.matches && scope.matches(SELECTOR)) mount(scope);
    if (scope.querySelectorAll) scope.querySelectorAll(SELECTOR).forEach(mount);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) controllers.forEach(controller => controller.stop('页面不可见，播放自动暂停。'));
  });
  global.MicrowaveSmithLab = Object.freeze({version: '1.0.0', init, model,
    getState: host => byHost.has(host) ? byHost.get(host).snapshot() : null});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(), {once: true}); else init();
})(typeof window !== 'undefined' ? window : globalThis);
