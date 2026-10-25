/**
 * Minimal CDP client over Node's built-in WebSocket (Node 22+).
 *
 * Large `Runtime.evaluate` results are transferred as chunks: a single
 * multi-megabyte data URL can close the socket (code 1006) without any
 * error event, which used to hang every tool forever. Use `readString()`
 * for captures instead of `eval()`.
 */
export class CDP {
  constructor(url, { timeout = 30000, chunk = 1_000_000 } = {}) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.handlers = {};
    this.q = [];
    this.ready = false;
    this.closed = null;
    this.timeout = timeout;
    this.chunk = chunk;

    this.ws.addEventListener('open', () => {
      this.ready = true;
      for (const m of this.q) this.ws.send(m);
      this.q = [];
    });
    this.ws.addEventListener('message', (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      if (m.id) {
        const p = this.pending.get(m.id);
        if (p) {
          this.pending.delete(m.id);
          clearTimeout(p.timer);
          m.error ? p.reject(new Error(m.error.message || 'CDP error')) : p.resolve(m.result);
        }
      } else if (m.method && this.handlers[m.method]) {
        this.handlers[m.method](m.params);
      }
    });
    this.ws.addEventListener('close', (e) => {
      this.ready = false;
      const reason = e.reason ? `: ${e.reason}` : '';
      this.closed = new Error(`CDP socket closed (${e.code}${reason})`);
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(this.closed);
      }
      this.pending.clear();
    });
    this.ws.addEventListener('error', (e) => {
      const detail = e?.message || e?.error?.message || '';
      if (!this.closed) this.closed = new Error(`CDP socket error${detail ? `: ${detail}` : ''}`);
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(this.closed);
      }
      this.pending.clear();
    });
  }

  send(method, params = {}, ms = this.timeout) {
    return new Promise((resolve, reject) => {
      if (this.closed) return reject(this.closed);
      const id = ++this.id;
      const timer = setTimeout(() => {
        const p = this.pending.get(id);
        if (p) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout ${method} after ${ms}ms`));
        }
      }, ms);
      this.pending.set(id, { resolve, reject, timer });
      const s = JSON.stringify({ id, method, params });
      this.ready ? this.ws.send(s) : this.q.push(s);
    });
  }

  on(method, fn) {
    this.handlers[method] = fn;
  }

  async eval(expr, ms = this.timeout) {
    const r = await this.send(
      'Runtime.evaluate',
      { expression: expr, returnByValue: true, awaitPromise: true },
      ms
    );
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }

  async readString(expr, ms = this.timeout) {
    const len = await this.eval(`(${expr}).length`, ms);
    if (!Number.isInteger(len) || len < 0) {
      throw new Error(`readString: ${expr} did not return a string`);
    }
    let out = '';
    for (let off = 0; off < len; off += this.chunk) {
      const part = await this.eval(`(${expr}).slice(${off}, ${off + this.chunk})`, ms);
      if (typeof part !== 'string') {
        throw new Error(`readString: slice at ${off} did not return a string`);
      }
      out += part;
    }
    return out;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
