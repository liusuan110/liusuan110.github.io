/* Article-scoped study index. No libraries, polling, or extra content requests. */
(() => {
  'use strict';
  const start = () => {
    const article = document.querySelector('.comm-reading');
    if (!article || article.dataset.studyIndexReady) return;
    article.dataset.studyIndexReady = 'true';
    const headings = [...article.querySelectorAll('h2[id],h3[id],h4[id]')];
    if (!headings.length) return;
    document.body.classList.add('comm-study-page');
    const boardColumn = document.querySelector('#board-ctn')?.parentElement;
    const row = boardColumn?.parentElement;
    let host = row && [...row.children].filter(el => el.classList.contains('side-col')).pop();
    if (host) {
      boardColumn.classList.add('comm-study-content-column');
      host.classList.add('comm-study-index-column');
      row.firstElementChild.classList.add('comm-study-leading-column');
    } else {
      host = document.querySelector('.layout > aside');
    }
    if (!host) return;
    // Also tolerate an older cached shell without allowing its TOC to take over.
    const oldToc = host.querySelector('#toc');
    if (oldToc) {
      window.tocbot?.destroy();
      oldToc.remove();
    }
    const create = (tag, className, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text) el.textContent = text;
      return el;
    };
    const index = create('nav', 'comm-study-index');
    index.id = 'comm-study-index';
    index.setAttribute('aria-label', '通信原理文章三级目录');
    const header = create('div', 'comm-index-header');
    header.append(create('strong', '', '文章目录'));
    const close = create('button', 'comm-index-close', '关闭');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭文章目录');
    header.append(close);
    const tree = create('div', 'comm-index-tree');
    tree.id = 'comm-index-tree';
    const root = create('ol', 'comm-index-list');
    tree.append(root);
    index.append(header, tree);
    // The standalone preview already has a navigation host.
    if (!boardColumn) host.replaceChildren(index);
    else host.append(index);
    const links = new Map();
    const stack = [{level: 1, list: root}];
    headings.forEach((heading, i) => {
      const level = Number(heading.tagName.slice(1));
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      const item = create('li', 'comm-index-item');
      const link = create('a', 'comm-index-link');
      const label = heading.cloneNode(true);
      label.querySelectorAll('.anchorjs-link,.headerlink').forEach(n => n.remove());
      label.querySelectorAll('mjx-container').forEach(n => {
        const math = n.querySelector('mjx-assistive-mml math');
        n.replaceWith(document.createTextNode(math?.textContent || n.textContent));
      });
      link.textContent = label.textContent.replace(/\s+/g, ' ').trim();
      link.href = '#' + encodeURIComponent(heading.id);
      link.dataset.commTarget = heading.id;
      link.title = link.textContent;
      links.set(heading.id, link);
      const hasChildren = i + 1 < headings.length && Number(headings[i + 1].tagName.slice(1)) > level;
      if (hasChildren) {
        const group = create('details', 'comm-index-group');
        const summary = create('summary', 'comm-index-summary');
        summary.append(link);
        const children = create('ol', 'comm-index-list');
        group.append(summary, children);
        item.append(group);
        stack[stack.length - 1].list.append(item);
        stack.push({level, list: children});
      } else {
        item.append(link);
        stack[stack.length - 1].list.append(item);
      }
    });
    const mobile = window.matchMedia('(max-width: 991px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dialog = create('dialog', 'comm-index-dialog');
    dialog.id = 'comm-index-dialog';
    dialog.setAttribute('aria-label', '文章目录');
    const launch = create('button', 'comm-index-launch', '目录');
    launch.type = 'button';
    launch.setAttribute('aria-haspopup', 'dialog');
    launch.setAttribute('aria-controls', dialog.id);
    launch.setAttribute('aria-expanded', 'false');
    document.body.append(dialog, launch);
    let returnFocus = true;
    const keepActiveVisible = () => {
      const selected = tree.querySelector('[aria-current="location"]');
      if (!selected || !tree.clientHeight) return;
      const a = selected.getBoundingClientRect(), b = tree.getBoundingClientRect();
      if (a.top < b.top + 16 || a.bottom > b.bottom - 16) {
        tree.scrollTop += a.top - b.top - tree.clientHeight * .4;
      }
    };
    launch.addEventListener('click', () => {
      returnFocus = true;
      dialog.append(index);
      dialog.showModal();
      document.body.classList.add('comm-index-open');
      launch.setAttribute('aria-expanded', 'true');
      keepActiveVisible();
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      host.append(index);
      document.body.classList.remove('comm-index-open');
      launch.setAttribute('aria-expanded', 'false');
      if (returnFocus && mobile.matches) launch.focus({preventScroll: true});
    });
    mobile.addEventListener('change', () => {
      if (!mobile.matches && dialog.open) { returnFocus = false; dialog.close(); }
    });
    let active, autoOpened = new Set();
    const manuallyOpened = new WeakSet();
    tree.addEventListener('click', event => {
      const summary = event.target.closest('summary');
      if (summary && !event.target.closest('a')) {
        const group = summary.parentElement;
        if (group.open) manuallyOpened.delete(group); else manuallyOpened.add(group);
      }
    });
    const select = id => {
      if (id === active || !links.has(id)) return;
      if (active) links.get(active)?.removeAttribute('aria-current');
      active = id;
      const link = links.get(id);
      link.setAttribute('aria-current', 'location');
      const parents = new Set();
      let node = link.parentElement;
      while (node && node !== tree) {
        if (node.tagName === 'DETAILS') parents.add(node);
        node = node.parentElement;
      }
      autoOpened.forEach(group => {
        if (!parents.has(group) && !manuallyOpened.has(group)) group.open = false;
      });
      parents.forEach(group => { group.open = true; });
      autoOpened = parents;
      keepActiveVisible();
    };
    let points = [], frame = 0, dirty = true, navigationUntil = 0;
    const update = () => {
      frame = 0;
      if (dirty) {
        points = headings.filter(h => h.getClientRects().length).map(h => ({id: h.id, top: h.getBoundingClientRect().top + window.scrollY}));
        dirty = false;
      }
      if (!points.length || performance.now() < navigationUntil) return;
      const top = window.scrollY + 115;
      let low = 0, high = points.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (points[mid].top <= top) low = mid; else high = mid - 1;
      }
      select(points[low].id);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const invalidate = () => { dirty = true; schedule(); };
    const jump = (id, smooth) => {
      const target = document.getElementById(id);
      if (!target || !article.contains(target)) return;
      let parent = target.parentElement;
      while (parent && parent !== article) {
        if (parent.tagName === 'DETAILS') parent.open = true;
        parent = parent.parentElement;
      }
      if (dialog.open) { returnFocus = false; dialog.close(); }
      select(id);
      navigationUntil = performance.now() + (smooth && !reduced.matches ? 900 : 0);
      target.scrollIntoView({behavior: smooth && !reduced.matches ? 'smooth' : 'instant', block: 'start'});
      target.setAttribute('tabindex', '-1');
      target.focus({preventScroll: true});
      dirty = true;
      setTimeout(schedule, 950);
    };
    tree.addEventListener('click', event => {
      const link = event.target.closest('a[data-comm-target]');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const id = link.dataset.commTarget;
      history.pushState(null, '', '#' + encodeURIComponent(id));
      jump(id, true);
    });
    const hashTarget = () => {
      try { return decodeURIComponent(location.hash.slice(1)); } catch (_) { return ''; }
    };
    window.addEventListener('hashchange', () => jump(hashTarget(), false));
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', invalidate, {passive: true});
    article.addEventListener('toggle', invalidate, true);
    if ('ResizeObserver' in window) new ResizeObserver(invalidate).observe(article);
    if (document.fonts?.ready) document.fonts.ready.then(invalidate);
    if (hashTarget()) requestAnimationFrame(() => jump(hashTarget(), false));
    schedule();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
