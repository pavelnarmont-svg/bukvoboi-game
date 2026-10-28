// Service worker: игра открывается без интернета.
// Оболочка (страница, скрипт, стили, иконки) кэшируется при установке; файлы словаря — по мере загрузки
// (кнопка «Скачать словарь для офлайн-игры» в настройках загружает их все сразу).
const VERSION = '1cd2f2fc3d';
const SHELL = `bukvoboy-shell-${VERSION}`;
const DICT = 'bukvoboy-dict';
const SHELL_FILES = ['./', 'index.html', 'app.js', 'app.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('bukvoboy-shell-') && key !== SHELL) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes('/dict/')) {
    // словарь: сначала кэш, при промахе — сеть и запись в кэш (файлы меняются только вместе с версией словаря)
    event.respondWith((async () => {
      const cache = await caches.open(DICT);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // оболочка: сначала сеть (чтобы обновления приходили сразу), при отсутствии сети — кэш
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
      return res;
    } catch (e) {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const index = await caches.match('index.html');
        if (index) return index;
      }
      throw e;
    }
  })());
});
