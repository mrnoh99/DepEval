/* 우울 평가 서비스워커 — 오프라인 지원 + 항상 최신 반영

   전략: 같은 출처 요청은 "네트워크 우선(network-first)".
   - 온라인이면 항상 최신 파일을 받아오고(= 배포한 업데이트가 바로 반영),
     받은 응답을 캐시에 저장해 둔다.
   - 오프라인이면 캐시로 폴백(페이지 이동은 index.html로).
   이전의 cache-first 방식은 app.js/styles.css가 갱신되지 않는 문제가 있어 교체함. */
const CACHE = "depeval-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 외부 자원은 기본 처리

  // 네트워크 우선: 최신을 받아 캐시에 갱신, 실패하면 캐시로 폴백
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) =>
          cached || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())
        )
      )
  );
});
