// Throwaway measurement runner for Q1-Q4 and Q5/Q6. Node >= 18 (built-in fetch), no deps.
// Usage: SPIKE_URL=<base url> node scripts/measure.mjs <echo|cookies|headers|direct|cold|latency> [--n N]
// Output is numbers and PASS/FAIL only: never URLs, hostnames or IPs. Errors print only a code/name.
// Env: SPIKE_URL (CloudFront base URL, no trailing /api), SPIKE_ENDPOINT_URL (direct endpoint, for `direct`),
//      MY_IP (optional, Q3: your public IP; if unset, one call to https://checkip.amazonaws.com is made).
// Exit codes: 0 = ran (PASS), 1 = FAIL, 2 = usage or runtime error.

const [cmd, ...rest] = process.argv.slice(2);
const nIdx = rest.indexOf('--n');
const n = nIdx >= 0 ? Number(rest[nIdx + 1]) : cmd === 'latency' ? 50 : 3;

const fail = (msg) => {
  console.error(msg);
  process.exit(2);
};
const base = (name) => (process.env[name] ?? '').replace(/\/+$/, '') || fail(`Missing env var ${name}`);
const verdict = (ok) => {
  if (!ok) process.exitCode = 1;
  return ok ? 'PASS' : 'FAIL';
};
const sorted = (xs) => [...xs].sort((a, b) => a - b);
const pct = (xs, p) => sorted(xs)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)];
const get = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) });

async function timed(url, init) {
  const t0 = performance.now();
  const res = await get(url, init);
  const text = await res.text();
  return { res, text, ms: Math.round(performance.now() - t0) };
}

// Expand an IPv6 address to 8 zero-padded groups. Limitation: no IPv4-mapped (::ffff:1.2.3.4) support.
function norm(ip) {
  ip = ip.trim().toLowerCase();
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail === undefined ? [] : tail ? tail.split(':') : [];
  const fill = tail === undefined ? [] : Array(Math.max(0, 8 - h.length - t.length)).fill('0');
  return [...h, ...fill, ...t].map((g) => g.padStart(4, '0')).join(':');
}

// CloudFront-Viewer-Address is "ip:port" (v4) or "[ip]:port" / "ip:port" (v6): strip the port.
function stripPort(v) {
  if (v.startsWith('[')) return v.slice(1, v.indexOf(']'));
  return v.includes(':') ? v.replace(/:\d+$/, '') : v;
}

async function myIp() {
  if (process.env.MY_IP) return process.env.MY_IP.trim();
  const res = await get('https://checkip.amazonaws.com');
  if (!res.ok) throw new Error('checkip');
  return (await res.text()).trim();
}

const commands = {
  // Q1: POST JSON without x-amz-content-sha256 must reach the app.
  async echo() {
    let ok = 0;
    for (let i = 0; i < n; i++) {
      const res = await get(`${base('SPIKE_URL')}/api/echo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ probe: i }),
      });
      const json = res.ok ? await res.json() : null;
      const echoed = json?.body?.probe === i;
      if (echoed) ok++;
      console.log(`q1 try=${i + 1} status=${res.status} echoed=${echoed}`);
    }
    console.log(`Q1 ${verdict(ok === n)} ok=${ok}/${n}`);
  },

  // Q2 (script half): three Set-Cookie headers kept separate, then echoed back by name.
  async cookies() {
    const root = base('SPIKE_URL');
    const set = await get(`${root}/api/cookies/set`);
    if (!set.ok) return console.log(`Q2 ${verdict(false)} set-status=${set.status}`);
    const raw = set.headers.getSetCookie();
    const jar = raw.map((c) => c.split(';')[0]).join('; ');
    const echo = await get(`${root}/api/cookies/echo`, { headers: { cookie: jar } });
    if (!echo.ok) return console.log(`Q2 ${verdict(false)} echo-status=${echo.status}`);
    const echoed = await echo.json();
    const attrsOk = raw.every((c) => /HttpOnly/i.test(c) && /Secure/i.test(c) && /SameSite=Strict/i.test(c));
    console.log(`q2 set-cookie-count=${raw.length} attrs-intact=${attrsOk} echoed=${echoed.cookieNames?.length ?? 0}`);
    console.log(`Q2 (script half; confirm in Chrome DevTools) ${verdict(raw.length === 3 && attrsOk && echoed.cookieNames?.length === 3)}`);
  },

  // Q3: CloudFront-Viewer-Address present and matching the caller IP. x-real-ip is not evaluated.
  async headers() {
    const ip = norm(await myIp());
    let ok = 0;
    let unknown = 0;
    for (let i = 0; i < n; i++) {
      const res = await get(`${base('SPIKE_URL')}/api/headers`);
      if (!res.ok) {
        console.log(`q3 try=${i + 1} status=${res.status} viewer-present=no matches=no`);
        continue;
      }
      const raw = ((await res.json())['cloudfront-viewer-address'] ?? '').trim();
      const viewer = raw ? norm(stripPort(raw)) : '';
      const family = !viewer ? 'n/a' : viewer.includes(':') ? 'v6' : 'v4';
      const mine = ip.includes(':') ? 'v6' : 'v4';
      let matches = 'no';
      if (viewer && family !== mine) matches = 'unknown (family mismatch; set MY_IP to your address of the same family)';
      else if (viewer && viewer === ip) matches = 'yes';
      if (matches === 'yes') ok++;
      else if (matches !== 'no') unknown++;
      console.log(`q3 try=${i + 1} viewer-present=${viewer ? 'yes' : 'no'} family=${family} matches=${matches}`);
    }
    if (unknown > 0) console.log(`Q3 INCONCLUSIVE ok=${ok}/${n} unknown=${unknown}`);
    else console.log(`Q3 ${verdict(ok === n)} ok=${ok}/${n}`);
  },

  // Q4 / Q8 smoke: an unsigned call straight to the endpoint must be 403. Reuse after every deploy.
  async direct() {
    let ok = 0;
    for (let i = 0; i < n; i++) {
      const res = await get(`${base('SPIKE_ENDPOINT_URL')}/api/health`);
      if (res.status === 403) ok++;
      console.log(`q4 try=${i + 1} status=${res.status}`);
    }
    console.log(`Q4 ${verdict(ok === n)} ok=${ok}/${n}`);
  },

  // Q5: first request after idle (run only once EndpointActiveEnvironments is 0 / no datapoints).
  async cold() {
    const { res, text, ms } = await timed(`${base('SPIKE_URL')}/api/health`);
    let json = null;
    try {
      json = res.ok ? JSON.parse(text) : null;
    } catch {}
    console.log(`q5 status=${res.status} first-request-ms=${ms} coldBootMs=${json?.coldBootMs ?? 'n/a'} uptimeMs=${json?.uptimeMs ?? 'n/a'}`);
    if (json?.uptimeMs > 10000) console.log('warning: server uptime > 10 s, the environment was probably NOT cold; this sample is not valid');
    console.log(`Q5 (one sample; repeat n>=3 and take min/median/max) ${verdict(res.ok && ms <= 3000)} (limit 3000 ms)`);
  },

  // Q6: warm latency. 2 warm-ups (and the cold request) are excluded; n >= 20 required.
  async latency() {
    if (n < 20) fail('Q6 needs --n >= 20');
    const url = `${base('SPIKE_URL')}/api/health`;
    for (let i = 0; i < 3; i++) await timed(url).catch(() => {}); // 1 cold + 2 warm-ups, discarded
    const xs = [];
    let failures = 0;
    for (let i = 0; i < n; i++) {
      try {
        const { res, ms } = await timed(url);
        if (res.ok) xs.push(ms);
        else failures++;
      } catch {
        failures++;
      }
    }
    if (failures > 0) {
      console.log(`Q6 ${verdict(false)} failures=${failures}/${n} (non-2xx or timeout)${xs.length ? ` p50=${pct(xs, 50)}ms of ${xs.length} ok` : ''}`);
      return;
    }
    const p50 = pct(xs, 50);
    const zone = p50 <= 300 ? 'PASS' : p50 <= 400 ? 'FAIL (gray zone 300-400 ms: user decides, no automatic Plan B)' : 'FAIL (> 400 ms: reconsiderar sa-east-1 (fuerza Plan B))';
    if (p50 > 300) process.exitCode = 1;
    console.log(`Q6 n=${n} p50=${p50}ms p95=${pct(xs, 95)}ms min=${sorted(xs)[0]}ms max=${sorted(xs)[n - 1]}ms => ${zone}`);
  },
};

if (!commands[cmd]) fail(`Usage: measure.mjs <${Object.keys(commands).join('|')}> [--n N]`);
if (!Number.isInteger(n) || n < 1) fail('--n must be an integer >= 1');
try {
  await commands[cmd]();
} catch (e) {
  console.error(`error: ${e.cause?.code ?? e.name}`);
  process.exit(2);
}
