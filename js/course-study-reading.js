/* Article-scoped study index. No libraries, polling, or extra content requests. */
(() => {
  'use strict';
  const start = () => {
    const article = document.querySelector('.markdown-body');
    if (!article || article.dataset.studyIndexReady) return;
    article.dataset.studyIndexReady = 'true';
    article.classList.add('course-reading');
    const headings = [...article.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    headings.forEach((heading, i) => {
      if (heading.id) return;
      let id = 'course-heading-' + (i + 1);
      while (document.getElementById(id)) id += '-section';
      heading.id = id;
    });
    if (!headings.length) return;
    document.body.classList.add('course-study-page');
    const boardColumn = document.querySelector('#board-ctn')?.parentElement;
    const row = boardColumn?.parentElement;
    let host = row && [...row.children].filter(el => el.classList.contains('side-col')).pop();
    if (host) {
      boardColumn.classList.add('course-study-content-column');
      host.classList.add('course-study-index-column');
      row.firstElementChild.classList.add('course-study-leading-column');
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
    const index = create('nav', 'course-study-index');
    index.id = 'course-study-index';
    index.setAttribute('aria-label', '课程文章分层目录');
    const header = create('div', 'course-index-header');
    header.append(create('strong', '', '文章目录'));
    const close = create('button', 'course-index-close', '关闭');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭文章目录');
    header.append(close);
    const tree = create('div', 'course-index-tree');
    tree.id = 'course-index-tree';
    const root = create('ol', 'course-index-list');
    tree.append(root);
    index.append(header, tree);
    // The standalone preview already has a navigation host.
    if (!boardColumn) host.replaceChildren(index);
    else host.append(index);
    const links = new Map();
    const stack = [{level: 0, list: root}];
    headings.forEach((heading, i) => {
      const level = Number(heading.tagName.slice(1));
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      const item = create('li', 'course-index-item');
      const link = create('a', 'course-index-link');
      const label = heading.cloneNode(true);
      label.querySelectorAll('.anchorjs-link,.headerlink').forEach(n => n.remove());
      label.querySelectorAll('mjx-container').forEach(n => {
        const math = n.querySelector('mjx-assistive-mml math');
        n.replaceWith(document.createTextNode(math?.textContent || n.textContent));
      });
      link.textContent = label.textContent.replace(/\s+/g, ' ').trim();
      link.href = '#' + encodeURIComponent(heading.id);
      link.dataset.courseTarget = heading.id;
      link.title = link.textContent;
      links.set(heading.id, link);
      const hasChildren = i + 1 < headings.length && Number(headings[i + 1].tagName.slice(1)) > level;
      if (hasChildren) {
        const group = create('details', 'course-index-group');
        const summary = create('summary', 'course-index-summary');
        summary.append(link);
        const children = create('ol', 'course-index-list');
        group.append(summary, children);
        item.append(group);
        stack[stack.length - 1].list.append(item);
        stack.push({level, list: children});
      } else {
        item.append(link);
        stack[stack.length - 1].list.append(item);
      }
    });
    // Only oversized inline formulas become scroll boxes. Short formulas keep
    // their original line boxes, and hidden answers are fitted when opened.
    let inlineFrame = 0, fittedWidth = 0;
    const fitInlineMath = () => {
      inlineFrame = 0;
      const blocks = new Map(), jobs = [];
      article.querySelectorAll('mjx-container:not([display="true"])').forEach(node => {
        if (!node.getClientRects().length) return;
        const svg = node.querySelector('svg');
        const block = node.closest('p,li,td,th,h1,h2,h3,h4,h5,h6,blockquote,.markdown-body');
        if (!svg || !block) return;
        if (!blocks.has(block)) {
          const style = getComputedStyle(block);
          blocks.set(block, block.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0));
        }
        jobs.push([node, svg.getBoundingClientRect().width > blocks.get(block) + 1]);
      });
      jobs.forEach(([node, wide]) => {
        node.classList.toggle('course-inline-math-scroll', wide);
        if (wide && !node.hasAttribute('tabindex')) {
          node.tabIndex = 0;
          node.dataset.courseMathTab = 'true';
        } else if (!wide && node.dataset.courseMathTab) {
          node.removeAttribute('tabindex');
          delete node.dataset.courseMathTab;
        }
        if (wide && !node.hasAttribute('title')) {
          node.title = '较长公式，可左右滚动';
          node.dataset.courseMathTitle = 'true';
        } else if (!wide && node.dataset.courseMathTitle) {
          node.removeAttribute('title');
          delete node.dataset.courseMathTitle;
        }
      });
      fittedWidth = article.clientWidth;
    };
    const requestInlineFit = () => { if (!inlineFrame) inlineFrame = requestAnimationFrame(fitInlineMath); };
    window.addEventListener('resize', requestInlineFit, {passive: true});
    article.addEventListener('toggle', requestInlineFit, true);
    requestInlineFit();
    const mobile = window.matchMedia('(max-width: 991px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dialog = create('dialog', 'course-index-dialog');
    dialog.id = 'course-index-dialog';
    dialog.setAttribute('aria-label', '文章目录');
    const launch = create('button', 'course-index-launch', '目录');
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
      document.body.classList.add('course-index-open');
      launch.setAttribute('aria-expanded', 'true');
      keepActiveVisible();
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      host.append(index);
      document.body.classList.remove('course-index-open');
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
        points = headings.filter(h => h.getClientRects().length).map(h => ({id: h.id, top: h.getBoundingClientRect().top + window.scrollY})).sort((a, b) => a.top - b.top);
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
    let pendingJump = null, jumpSerial = 0, settleTimer = 0;
    const stopFollowing = () => {
      if (!pendingJump) return;
      pendingJump = null;
      clearTimeout(settleTimer);
      navigationUntil = 0;
      dirty = true;
      schedule();
    };
    const settleJump = () => {
      settleTimer = 0;
      const job = pendingJump;
      if (!job || !job.ready || performance.now() > job.expires) return;
      const margin = parseFloat(getComputedStyle(job.target).scrollMarginTop) || 90;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const desired = Math.min(maxScroll, Math.max(0, window.scrollY + job.target.getBoundingClientRect().top - margin));
      if (Math.abs(desired - window.scrollY) > 2) {
        window.scrollTo({top: desired, behavior: 'instant'});
        dirty = true;
      }
      select(job.id);
    };
    const queueSettlement = () => {
      if (!pendingJump?.ready) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settleJump, 80);
    };
    const invalidate = () => { dirty = true; schedule(); queueSettlement(); };
    // A long jump can initialize teaching widgets above its target. Follow only
    // that requested target during settling; ordinary user scrolling cancels it.
    window.addEventListener('scrollend', () => {
      if (pendingJump) { pendingJump.ready = true; queueSettlement(); }
    });
    ['wheel', 'touchstart', 'pointerdown'].forEach(type => {
      window.addEventListener(type, stopFollowing, {passive: true});
    });
    window.addEventListener('keydown', event => {
      if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) stopFollowing();
    });
    const jump = (id, smooth) => {
      const target = document.getElementById(id);
      if (!target || !article.contains(target)) return;
      let parent = target.parentElement;
      while (parent && parent !== article) {
        if (parent.tagName === 'DETAILS') parent.open = true;
        parent = parent.parentElement;
      }
      if (dialog.open) { returnFocus = false; dialog.close(); }
      stopFollowing();
      select(id);
      const serial = ++jumpSerial;
      pendingJump = {id, target, serial, ready: !smooth || reduced.matches, expires: performance.now() + 6000};
      navigationUntil = pendingJump.expires;
      target.scrollIntoView({behavior: smooth && !reduced.matches ? 'smooth' : 'instant', block: 'start'});
      target.setAttribute('tabindex', '-1');
      target.focus({preventScroll: true});
      dirty = true;
      queueSettlement();
      setTimeout(() => {
        if (pendingJump?.serial === serial) { pendingJump.ready = true; queueSettlement(); }
      }, 1800);
      setTimeout(() => {
        if (pendingJump?.serial === serial) { settleJump(); stopFollowing(); }
      }, 6000);
    };
    tree.addEventListener('click', event => {
      const link = event.target.closest('a[data-course-target]');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const id = link.dataset.courseTarget;
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
    if ('ResizeObserver' in window) new ResizeObserver(() => {
      invalidate();
      if (article.clientWidth !== fittedWidth) requestInlineFit();
    }).observe(article);
    if (document.fonts?.ready) document.fonts.ready.then(() => { invalidate(); requestInlineFit(); });
    if (hashTarget()) requestAnimationFrame(() => jump(hashTarget(), false));
    schedule();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
