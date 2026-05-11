const logger = require('../services/logger');

class SelectorAI {
  constructor(page) {
    this.page = page;
  }

  async detectCategoryLinks() {
    const strategies = [
      this.findNavLinks.bind(this),
      this.findSidebarLinks.bind(this),
      this.findCategoryLinks.bind(this),
      this.findAnyRelevantLinks.bind(this),
    ];

    for (const strategy of strategies) {
      const links = await strategy();
      if (links.length > 0) {
        logger.debug(`[SELECTOR_AI] Found ${links.length} category links via ${strategy.name}`);
        return links;
      }
    }
    return [];
  }

  async findNavLinks() {
    return this.page.evaluate(() => {
      const links = [];
      const navSelectors = [
        'nav a', '.nav a', '.navigation a',
        '.menu a', '#menu a', '.navbar a',
        'header a', '.header a', '.main-nav a',
        '.primary-nav a', '.top-nav a',
        'li a', '.list a', 'ul a',
      ];
      for (const selector of navSelectors) {
        document.querySelectorAll(selector).forEach(a => {
          const text = (a.textContent || '').trim().toLowerCase();
          const href = a.getAttribute('href');
          if (text && href && href !== '#' && !href.startsWith('javascript:')) {
            links.push({ text: (a.textContent || '').trim(), href, selector });
          }
        });
      }
      return links;
    });
  }

  async findSidebarLinks() {
    return this.page.evaluate(() => {
      const links = [];
      const sidebarSelectors = [
        '.sidebar a', '#sidebar a', '.side-nav a',
        '.side a', '.left-nav a', '.right-nav a',
        '.aside a', 'aside a', '.categories a',
        '.category-list a', '.product-categories a',
      ];
      for (const selector of sidebarSelectors) {
        document.querySelectorAll(selector).forEach(a => {
          const text = (a.textContent || '').trim().toLowerCase();
          const href = a.getAttribute('href');
          if (text && href && href !== '#' && !href.startsWith('javascript:')) {
            links.push({ text: (a.textContent || '').trim(), href, selector });
          }
        });
      }
      return links;
    });
  }

  async findCategoryLinks() {
    return this.page.evaluate(() => {
      const links = [];
      const categoryKeywords = [
        'category', 'product', 'machine', 'equipment',
        'parts', 'model', 'series', 'type',
      ];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        const text = (a.textContent || '').trim().toLowerCase();
        if (href && href !== '#' && !href.startsWith('javascript:')) {
          const hasCategoryKeyword = categoryKeywords.some(k =>
            href.toLowerCase().includes(k) || text.includes(k)
          );
          if (hasCategoryKeyword && text.length < 50) {
            links.push({ text: (a.textContent || '').trim(), href, selector: 'a[href]' });
          }
        }
      });
      return links;
    });
  }

  async findAnyRelevantLinks() {
    return this.page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        const text = (a.textContent || '').trim();
        if (href && text && href !== '#' && !href.startsWith('javascript:') && text.length < 60) {
          links.push({ text, href, selector: 'a[href]' });
        }
      });
      return links;
    });
  }

  findCategoryByText(links, targetCategory) {
    const target = targetCategory.toLowerCase().trim();
    const targetWords = target.split(/\s+/);

    const scored = links.map(link => {
      const linkText = link.text.toLowerCase().trim();
      const href = (link.href || '').toLowerCase();

      let score = 0;

      if (linkText === target) score += 100;
      else if (linkText.includes(target)) score += 50;
      else if (href.includes(target)) score += 30;
      else {
        const linkWords = linkText.split(/\s+/);
        const matchCount = targetWords.filter(w => linkWords.some(lw => lw.includes(w) || w.includes(lw))).length;
        score += (matchCount / targetWords.length) * 60;
      }

      return { ...link, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score > 0);
  }

  async detectMachineListings() {
    const strategies = [
      this.findArticleListings.bind(this),
      this.findProductGrid.bind(this),
      this.findProductRows.bind(this),
      this.findProductCards.bind(this),
      this.findTableRows.bind(this),
      this.findListItems.bind(this),
    ];

    for (const strategy of strategies) {
      const items = await strategy();
      if (items.length > 0) {
        logger.debug(`[SELECTOR_AI] Found ${items.length} machine listings via ${strategy.name}`);
        return { items, strategy: strategy.name };
      }
    }
    return { items: [], strategy: 'none' };
  }

  async findArticleListings() {
    return this.page.evaluate(() => {
      const items = [];
      const articles = document.querySelectorAll('article');
      for (const article of articles) {
        const link = article.querySelector('a[href*="detail"]') || article.querySelector('a[href]');
        if (!link) continue;

        const href = link.getAttribute('href');
        const img = article.querySelector('img');
        const modelEl = article.querySelector('.model, [class*="model"], h3, .title, .name, .item-name, .product-name');
        const name = modelEl ? (modelEl.textContent || '').trim() : (link.textContent || '').trim();

        if (name && href) {
          items.push({
            name,
            url: href,
            thumbnail: img ? img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy') || '' : '',
          });
        }
      }
      return items;
    });
  }

  async findProductGrid() {
    return this.page.evaluate(() => {
      const items = [];
      const gridSelectors = [
        '.product-grid', '.products-grid', '.product-list',
        '.item-grid', '.listing-grid', '.grid-items',
        '.product-listing', '[class*="product"]', '[class*="grid"]',
      ];
      for (const selector of gridSelectors) {
        const containers = document.querySelectorAll(selector);
        for (const container of containers) {
          const links = container.querySelectorAll('a[href]');
          links.forEach(a => {
            const text = (a.textContent || '').trim();
            const href = a.getAttribute('href');
            if (text && href && text.length < 100) {
              const img = a.querySelector('img');
              items.push({
                name: text,
                url: href,
                thumbnail: img ? img.getAttribute('src') || img.getAttribute('data-src') || '' : '',
              });
            }
          });
        }
        if (items.length > 0) break;
      }
      return items;
    });
  }

  async findProductRows() {
    return this.page.evaluate(() => {
      const items = [];
      const rowSelectors = [
        '.product-row', '.item-row', '.listing-row',
        'tr', '[class*="row"]',
      ];
      for (const selector of rowSelectors) {
        document.querySelectorAll(selector).forEach(row => {
          const link = row.querySelector('a[href]');
          if (link) {
            const text = (link.textContent || '').trim();
            const href = link.getAttribute('href');
            if (text && href) {
              const img = row.querySelector('img');
              const nameEl = row.querySelector('.name, .title, .product-name, .item-name, h2, h3, h4');
              items.push({
                name: nameEl ? (nameEl.textContent || '').trim() : text,
                url: href,
                thumbnail: img ? img.getAttribute('src') || img.getAttribute('data-src') || '' : '',
              });
            }
          }
        });
        if (items.length > 0) break;
      }
      return items;
    });
  }

  async findProductCards() {
    return this.page.evaluate(() => {
      const items = [];
      const cardSelectors = [
        '.card', '.product-card', '.item-card',
        '.product-item', '.listing-item', '.machine-item',
        '[class*="card"]', '[class*="item"]',
      ];
      for (const selector of cardSelectors) {
        document.querySelectorAll(selector).forEach(card => {
          const link = card.querySelector('a[href]');
          if (link) {
            const text = (link.textContent || '').trim();
            const href = link.getAttribute('href');
            if (text && href) {
              const img = card.querySelector('img');
              const nameEl = card.querySelector('.name, .title, h2, h3, h4, .product-name');
              items.push({
                name: nameEl ? (nameEl.textContent || '').trim() : text,
                url: href,
                thumbnail: img ? img.getAttribute('src') || img.getAttribute('data-src') || '' : '',
              });
            }
          }
        });
        if (items.length > 0) break;
      }
      return items;
    });
  }

  async findTableRows() {
    return this.page.evaluate(() => {
      const items = [];
      document.querySelectorAll('table tbody tr, table tr').forEach(row => {
        const link = row.querySelector('a[href]');
        if (link) {
          const text = (link.textContent || '').trim();
          const href = link.getAttribute('href');
          if (text && href) {
            const img = row.querySelector('img');
            items.push({ name: text, url: href, thumbnail: img ? img.getAttribute('src') || img.getAttribute('data-src') || '' : '' });
          }
        }
      });
      return items;
    });
  }

  async findListItems() {
    return this.page.evaluate(() => {
      const items = [];
      document.querySelectorAll('li a[href], .list a[href]').forEach(a => {
        const text = (a.textContent || '').trim();
        const href = a.getAttribute('href');
        if (text && href && text.length < 100 && text.length > 2) {
          const img = a.querySelector('img');
          items.push({
            name: text,
            url: href,
            thumbnail: img ? img.getAttribute('src') || img.getAttribute('data-src') || '' : '',
          });
        }
      });
      return items;
    });
  }

  async detectDownloadButton() {
    const strategies = [
      this.findDownloadByText.bind(this),
      this.findDownloadByIcon.bind(this),
      this.findDownloadByClass.bind(this),
      this.findAnyDownloadLink.bind(this),
    ];

    for (const strategy of strategies) {
      const button = await strategy();
      if (button) {
        logger.debug(`[SELECTOR_AI] Found download button via ${strategy.name}`);
        return button;
      }
    }
    return null;
  }

  async findDownloadByText() {
    const downloadTexts = [
      'download photo', 'download photos', 'download image', 'download images',
      'download zip', 'download archive', 'download file',
      'photo download', 'image download', 'zip download',
      'download all', 'download pictures',
      'download', 'download photo', 'dload',
    ];

    return this.page.evaluate((texts) => {
      const allElements = document.querySelectorAll('a, button, span, div');
      for (const el of allElements) {
        const text = (el.textContent || '').trim().toLowerCase();
        for (const target of texts) {
          if (text === target || text.startsWith(target) || text.includes(target)) {
            const href = el.getAttribute('href') || el.getAttribute('data-url') || el.getAttribute('data-href');
            const onclick = el.getAttribute('onclick');
            return {
              element: 'text_match',
              text: (el.textContent || '').trim(),
              href,
              onclick,
              tagName: el.tagName,
            };
          }
        }
      }
      return null;
    }, downloadTexts);
  }

  async findDownloadByIcon() {
    return this.page.evaluate(() => {
      const iconSelectors = [
        '[class*="download"]', '[class*="zip"]', '[class*="archive"]',
        '[class*="photo"]', '[class*="image"]',
        'i[class*="download"]', 'svg[class*="download"]',
        '[data-icon*="download"]',
      ];
      for (const selector of iconSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const parent = el.closest('a') || el.closest('button') || el;
          return {
            element: 'icon_match',
            text: (parent.textContent || '').trim(),
            href: parent.getAttribute('href') || parent.getAttribute('data-url'),
            tagName: parent.tagName,
          };
        }
      }
      return null;
    });
  }

  async findDownloadByClass() {
    return this.page.evaluate(() => {
      const classSelectors = [
        'a[href*="download"]', 'a[href*="zip"]', 'a[href*=".zip"]',
        'a[href*="photo"]', 'a[href*="image"]', 'a[href*="imgzip"]',
        'a[class*="download"]', 'a[class*="zip"]',
        'button[class*="download"]', 'button[class*="zip"]',
        '[data-action="download"]', '[rel="download"]',
      ];
      for (const selector of classSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          return {
            element: 'attribute_match',
            text: (el.textContent || '').trim(),
            href: el.getAttribute('href'),
            tagName: el.tagName,
          };
        }
      }
      return null;
    });
  }

  async findAnyDownloadLink() {
    return this.page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="."]');
      for (const a of links) {
        const href = a.getAttribute('href');
        if (href && (href.endsWith('.zip') || href.includes('download') || href.includes('getfile'))) {
          return {
            element: 'extension_match',
            text: (a.textContent || '').trim(),
            href,
            tagName: 'A',
          };
        }
      }
      return null;
    });
  }

  async detectImageGallery() {
    return this.page.evaluate(() => {
      const images = [];
      const gallerySelectors = [
        '.gallery img', '.product-gallery img',
        '.image-gallery img', '.slider img',
        '.carousel img', '.lightbox img',
        '[class*="gallery"] img', '[class*="slider"] img',
        'main img', '.content img', '.product img',
        '.details img', '.machine img',
      ];
      for (const selector of gallerySelectors) {
        document.querySelectorAll(selector).forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy');
          if (src && !src.includes('icon') && !src.includes('logo')) {
            images.push(src);
          }
        });
        if (images.length > 0) break;
      }
      return images;
    });
  }

  async detectPagination() {
    return this.page.evaluate(() => {
      const paginationSelectors = [
        '.pagination', '.pagination a',
        '.page-numbers', '.page-nav',
        '.pages a', '.pager a',
        '[class*="pagination"] a',
        'a.next', 'a[rel="next"]',
        '.next a', '.next-page',
        'a:has-text("Next")', 'a:has-text("next")',
        'a:has-text(">")', 'a:has-text(">>")',
      ];
      for (const selector of paginationSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const href = el.getAttribute('href');
            if (href && href !== '#') {
              return { url: href, selector };
            }
          }
        } catch (e) { /* ignore */ }
      }
      return null;
    });
  }
}

module.exports = SelectorAI;
