// services/db.js —— IndexedDB 封装（用 idb）
// Schema:
//   books: { bookId, title, coverBlob, pageIds:[], createdAt, updatedAt }
//   pages: { [bookId, pageIndex] (composite key), imageBlob, ocrText, sentences, currentSentenceIdx, createdAt, updatedAt }
//   settings: { key, rate, theme, voiceURI }

const DB_NAME = 'pagevoice';
const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB();
  }
  return dbPromise;
}

async function openDB() {
  if (!window.idb) {
    // 加载 idb UMD
    await import('../../vendor/idb/idb.umd.js');
  }
  return window.idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        // books store
        if (!db.objectStoreNames.contains('books')) {
          const books = db.createObjectStore('books', { keyPath: 'bookId' });
          books.createIndex('by-updatedAt', 'updatedAt');
        }
        // pages store (复合 key)
        if (!db.objectStoreNames.contains('pages')) {
          const pages = db.createObjectStore('pages', { keyPath: ['bookId', 'pageIndex'] });
          pages.createIndex('by-book', 'bookId');
        }
        // settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      }
    },
  });
}

// ===== Books =====
export async function listBooks() {
  const db = await getDB();
  const all = await db.getAll('books');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getBook(bookId) {
  const db = await getDB();
  return db.get('books', bookId);
}

export async function createBook({ title, coverBlob }) {
  const db = await getDB();
  const bookId = `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const book = {
    bookId,
    title: title || `未命名书 ${new Date(now).toLocaleString('zh-CN')}`,
    coverBlob: coverBlob || null,
    pageIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.put('books', book);
  return book;
}

export async function updateBook(bookId, patch) {
  const db = await getDB();
  const book = await db.get('books', bookId);
  if (!book) throw new Error('Book not found: ' + bookId);
  const updated = { ...book, ...patch, updatedAt: Date.now() };
  await db.put('books', updated);
  return updated;
}

export async function deleteBook(bookId) {
  const db = await getDB();
  const tx = db.transaction(['books', 'pages'], 'readwrite');
  await tx.objectStore('books').delete(bookId);
  // 删所有页
  const pagesStore = tx.objectStore('pages');
  const index = pagesStore.index('by-book');
  for await (const cursor of index.iterate(bookId)) {
    await cursor.delete();
  }
  await tx.done;
}

// ===== Pages =====
export async function addPage({ bookId, pageIndex, imageBlob, ocrText, sentences }) {
  const db = await getDB();
  const now = Date.now();
  const page = {
    bookId,
    pageIndex,
    imageBlob,
    ocrText,
    sentences: sentences || [],
    currentSentenceIdx: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.put('pages', page);
  // 更新 book 的 pageIds
  const book = await db.get('books', bookId);
  if (book) {
    book.pageIds = book.pageIds || [];
    if (!book.pageIds.includes(pageIndex)) {
      book.pageIds.push(pageIndex);
      book.pageIds.sort((a, b) => a - b);
    }
    book.updatedAt = now;
    // 如果还没封面，用第一页
    if (!book.coverBlob && imageBlob) {
      book.coverBlob = imageBlob;
    }
    await db.put('books', book);
  }
  return page;
}

export async function getPage(bookId, pageIndex) {
  const db = await getDB();
  return db.get('pages', [bookId, pageIndex]);
}

export async function listPages(bookId) {
  const db = await getDB();
  const tx = db.transaction('pages', 'readonly');
  const index = tx.objectStore('pages').index('by-book');
  const pages = [];
  for await (const cursor of index.iterate(bookId)) {
    pages.push(cursor.value);
  }
  await tx.done;
  return pages.sort((a, b) => a.pageIndex - b.pageIndex);
}

export async function updatePageProgress(bookId, pageIndex, currentSentenceIdx) {
  const db = await getDB();
  const page = await db.get('pages', [bookId, pageIndex]);
  if (!page) return;
  page.currentSentenceIdx = currentSentenceIdx;
  page.updatedAt = Date.now();
  await db.put('pages', page);
  // 顺便刷一下 book 的 updatedAt（让它排到书架前）
  const book = await db.get('books', bookId);
  if (book) {
    book.updatedAt = Date.now();
    await db.put('books', book);
  }
}

export async function deletePage(bookId, pageIndex) {
  const db = await getDB();
  await db.delete('pages', [bookId, pageIndex]);
  // 从 book.pageIds 移除
  const book = await db.get('books', bookId);
  if (book) {
    book.pageIds = (book.pageIds || []).filter((p) => p !== pageIndex);
    book.updatedAt = Date.now();
    await db.put('books', book);
  }
}

// ===== Settings =====
export async function getSettings() {
  const db = await getDB();
  const s = await db.get('settings', 'global');
  return s || { key: 'global', rate: 1.0, theme: 'auto', voiceURI: null };
}

export async function saveSettings(patch) {
  const db = await getDB();
  const cur = await getSettings();
  const next = { ...cur, ...patch, key: 'global' };
  await db.put('settings', next);
  return next;
}

// ===== Storage =====
export async function clearAll() {
  const db = await getDB();
  const tx = db.transaction(['books', 'pages', 'settings'], 'readwrite');
  await tx.objectStore('books').clear();
  await tx.objectStore('pages').clear();
  await tx.objectStore('settings').clear();
  await tx.done;
}

export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    return navigator.storage.estimate();
  }
  return null;
}