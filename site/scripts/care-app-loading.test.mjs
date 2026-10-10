import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import React from 'react';
import {renderToString} from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
let pathname = '/';
const cache = new Map();
let seededState = null;
let seededRole = 'elder';
let hookIndex = 0;

// Exercise the actual component's initial SSR render, before useEffect can
// fetch a state. Only framework navigation and toast integrations are mocked.
function loadTypeScript(relativePath) {
  const filename = relativePath.startsWith('/') ? relativePath : fileURLToPath(new URL(relativePath, import.meta.url));
  if (cache.has(filename)) return cache.get(filename);
  const {outputText} = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const compiledModule = {exports: {}};
  const testRequire = (id) => {
    if (id === 'react') return {...React, useState: (initial) => {
      const index = hookIndex++;
      const value = seededState && index === 0 ? seededState : seededState && index === 1 ? false : initial === 'elder' ? seededRole : initial;
      return React.useState(value);
    }};
    if (id === 'next/navigation') return {usePathname: () => pathname, useRouter: () => ({push() {}})};
    if (id === '@/components/ui/sonner') return {Toaster: () => null};
    if (id === '@/components/ui/dialog') return Object.fromEntries(['Dialog','DialogContent','DialogDescription','DialogTitle'].map(name => [name, ({children}) => React.createElement('div', null, children)]));
    if (id === 'sonner') return {toast: {}};
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? fileURLToPath(new URL('../' + id.slice(2), import.meta.url)) : resolve(dirname(filename), id);
      const source = [base, base + '.ts', base + '.tsx'].find(path => existsSync(path));
      if (source) return loadTypeScript(source);
    }
    return require(id);
  };
  runInNewContext(outputText, {module: compiledModule, exports: compiledModule.exports, require: testRequire, crypto: globalThis.crypto}, {filename});
  cache.set(filename, compiledModule.exports);
  return compiledModule.exports;
}

const CareApp = loadTypeScript('../components/care-app.tsx').default;

for (const route of ['/', '/requests', '/contacts', '/records', '/settings']) {
  test(`initial render is safe without loaded data: ${route}`, () => {
    pathname = route;
    hookIndex = 0;
    const html = renderToString(React.createElement(CareApp));
    assert.ok(html.includes(route === '/contacts' ? '家人协助设置电话' : '正在打开你的记录…'));
    assert.ok(html.includes('打开记录'));
    assert.ok(!html.includes('<i></i>'), 'do not invent a notification before data loads');
  });
}

const {initialState} = loadTypeScript('../lib/care-data.ts');
for (const role of ['elder', 'family', 'volunteer']) {
  for (const route of ['/', '/requests', '/settings', '/records']) {
    test(`loaded ${role} view renders safely: ${route}`, () => {
      seededState = initialState();
      seededRole = role;
      hookIndex = 0;
      pathname = route;
      const html = renderToString(React.createElement(CareApp));
      assert.ok(html.includes('不通知真实家人或义工'));
      if (route === '/' && role === 'elder') {
        assert.ok(html.includes('设置家人电话'));
        assert.ok(html.includes('说话求助'));
        assert.ok(html.includes('拍照求助'));
      }
      if (route === '/settings') assert.ok(html.includes('演示角色切换'));
      seededState = null;
      seededRole = 'elder';
    });
  }
}
