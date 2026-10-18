/* global CONFIG, jQuery */
(function () {
  'use strict';
  const modal = jQuery('#modalSearch');
  const input = document.querySelector('#local-search-input');
  const result = document.querySelector('#local-search-result');
  if (!input || !result || !modal.length) return;

  // One download and one normalization per page, shared by every modal opening.
  let loading;
  let entries;
  let opened = false;
  result.setAttribute('aria-live', 'polite');
  function textOf(entry, name) {
    const element = entry.querySelector(name);
    return element ? element.textContent.trim() : '';
  }
  function contentOf(entry) {
    const element = entry.querySelector('content');
    if (!element) return '';
    if (element.getAttribute('type') === 'text') return element.textContent.trim();
    // Compatibility with older indexes; the current index already contains text.
    const template = document.createElement('template');
    template.innerHTML = element.textContent;
    template.content.querySelectorAll('script,style,svg').forEach(node => node.remove());
    return template.content.textContent.replace(/\s+/g, ' ').trim();
  }
  function load() {
    if (entries) return Promise.resolve(entries);
    if (loading) return loading;
    const url = CONFIG.search_path || '/local-search.xml';
    loading = fetch(url, { credentials: 'same-origin', cache: 'no-cache' }).then(response => {
      if (!response.ok) throw new Error('Search index: ' + response.status);
      return response.text();
    }).then(source => {
      const xml = new DOMParser().parseFromString(source, 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('Invalid search index');
      entries = Array.from(xml.querySelectorAll('entry'), entry => {
        const title = textOf(entry, 'title') || 'Untitled';
        const content = contentOf(entry);
        return { title, content, url: textOf(entry, 'url'),
          lowerTitle: title.toLowerCase(), lowerContent: content.toLowerCase() };
      });
      return entries;
    }).catch(error => {
      loading = undefined;
      throw error;
    });
    return loading;
  }
  function message(text) {
    result.replaceChildren();
    const status = document.createElement('p');
    status.className = 'm-auto text-center';
    status.textContent = text;
    result.appendChild(status);
  }
  function highlighted(text, keywords) {
    const fragment = document.createDocumentFragment();
    const lower = text.toLowerCase();
    let cursor = 0;
    while (cursor < text.length) {
      let start = -1;
      let length = 0;
      keywords.forEach(keyword => {
        const at = lower.indexOf(keyword, cursor);
        if (at >= 0 && (start < 0 || at < start || (at === start && keyword.length > length))) {
          start = at;
          length = keyword.length;
        }
      });
      if (start < 0) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
        break;
      }
      fragment.appendChild(document.createTextNode(text.slice(cursor, start)));
      const mark = document.createElement('span');
      mark.className = 'search-word';
      mark.textContent = text.slice(start, start + length);
      fragment.appendChild(mark);
      cursor = start + length;
    }
    return fragment;
  }
  function search() {
    if (!entries) return;
    const query = input.value.trim().toLowerCase();
    input.classList.remove('invalid', 'valid');
    result.replaceChildren();
    if (!query) return;
    const keywords = Array.from(new Set(query.split(/\s+/).filter(Boolean)));
    const includeContent = CONFIG.include_content_in_search !== false;
    const fragment = document.createDocumentFragment();
    let matches = 0;
    entries.forEach(entry => {
      if (!keywords.every(word => entry.lowerTitle.includes(word) ||
          (includeContent && entry.lowerContent.includes(word)))) return;
      const href = new URL(entry.url, location.href);
      if (!['http:', 'https:'].includes(href.protocol)) return;
      matches++;
      const link = document.createElement('a');
      link.href = href.href;
      link.className = 'list-group-item list-group-item-action font-weight-bolder search-list-title';
      link.appendChild(highlighted(entry.title, keywords));
      fragment.appendChild(link);
      if (includeContent && entry.content) {
        const positions = keywords.map(word => entry.lowerContent.indexOf(word)).filter(at => at >= 0);
        const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 20);
        const end = Math.min(entry.content.length, start + 120);
        const snippet = document.createElement('p');
        snippet.className = 'search-list-content';
        if (start) snippet.appendChild(document.createTextNode('…'));
        snippet.appendChild(highlighted(entry.content.slice(start, end), keywords));
        if (end < entry.content.length) snippet.appendChild(document.createTextNode('…'));
        fragment.appendChild(snippet);
      }
    });
    result.appendChild(fragment);
    input.classList.add(matches ? 'valid' : 'invalid');
  }
  // Namespaced replacement prevents duplicate listeners if initialized again.
  jQuery(input).off('input.localSearch').on('input.localSearch', search);
  modal.off('.localSearch');
  modal.on('show.bs.modal.localSearch', function () {
    opened = true;
    if (!entries) message('正在加载搜索索引…');
    load().then(() => {
      modal.attr('data-search-state', 'ready');
      if (opened) search();
    }).catch(() => {
      modal.attr('data-search-state', 'error');
      if (opened) message('搜索索引加载失败，请关闭后重试。');
    });
  });
  modal.on('shown.bs.modal.localSearch', () => input.focus());
  modal.on('hidden.bs.modal.localSearch', function () {
    opened = false;
    input.value = '';
    input.classList.remove('invalid', 'valid');
    result.replaceChildren();
  });
})();
