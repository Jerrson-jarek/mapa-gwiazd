import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';

/** Uruchamia serve.mjs na wolnym porcie przydzielonym przez system (port 0) i zwraca { port, child }. */
function startServer() {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../serve.mjs', import.meta.url)), '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const m = out.match(/localhost:(\d+)/);
      if (m) resolve({ child, port: Number(m[1]) });
    });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`serwer zakończył się przed startem (kod ${code})`)));
  });
}

/** Żądanie z dosłowną ścieżką (bez poprawiania przez klienta), np. „/%”. */
function get(port, path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serve.mjs: błędnie zakodowany adres daje 400 i nie zatrzymuje serwera', async () => {
  const { child, port } = await startServer();
  try {
    assert.ok(port > 0);
    assert.equal((await get(port, '/index.html')).status, 200);
    for (const path of ['/%', '/%E0%A4%A', '/js/%zz.mjs', '/%c0%af']) {
      assert.equal((await get(port, path)).status, 400, path);
    }
    assert.equal(child.exitCode, null, 'serwer nadal działa');
    assert.equal((await get(port, '/')).status, 200);
    assert.equal((await get(port, '/nie-ma-takiego-pliku.txt')).status, 404);
    assert.equal((await get(port, '/js/search.mjs?x=%')).status, 200, 'znak % w parametrach nie dotyczy ścieżki');
  } finally {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  }
});
