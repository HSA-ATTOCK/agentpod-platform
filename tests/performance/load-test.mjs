// Simple load test (no extra tools needed): many concurrent requests against public pages and the
// health check, reporting throughput, latency percentiles and errors.
// Usage: node tests/performance/load-test.mjs https://app.example.com [concurrency=20] [seconds=30]
// Don't point it at Baba's chat API: that spends real AI credit.

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const concurrency = Number(process.argv[3] ?? 20);
const seconds = Number(process.argv[4] ?? 30);
const paths = ["/", "/pricing", "/features", "/api/health", "/sign-in"];

const latencies = [];
let errors = 0;
const statuses = {};
const end = Date.now() + seconds * 1000;

async function worker(id) {
  let i = id;
  while (Date.now() < end) {
    const path = paths[i++ % paths.length];
    const started = performance.now();
    try {
      const res = await fetch(base + path, { redirect: "manual" });
      await res.arrayBuffer();
      statuses[res.status] = (statuses[res.status] ?? 0) + 1;
      if (res.status >= 500) errors++;
    } catch {
      errors++;
    }
    latencies.push(performance.now() - started);
  }
}

console.log(`Load test: ${base}, ${concurrency} concurrent, ${seconds}s`);
await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
latencies.sort((a, b) => a - b);
const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))]?.toFixed(0);
console.log(`Requests: ${latencies.length} (${(latencies.length / seconds).toFixed(1)}/s)`);
console.log(`Latency ms: p50 ${p(0.5)}, p95 ${p(0.95)}, p99 ${p(0.99)}, max ${latencies.at(-1)?.toFixed(0)}`);
console.log(`Status codes: ${JSON.stringify(statuses)}; errors: ${errors}`);
process.exit(errors > latencies.length * 0.01 ? 1 : 0);
