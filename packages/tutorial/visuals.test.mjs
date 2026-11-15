import test from 'node:test';
import assert from 'node:assert/strict';
import { frequencyTHz, syntheticFlux, uncertaintyExample, normalizeRA, diagramLabelScale, fitViewBoxPoint, clientToDiagramPoint, mountVisual } from './visuals.js';

test('wavelength ruler follows the vacuum inverse wavelength-frequency relation', () => {
  assert.equal(frequencyTHz(1), 299.792458);
  assert.equal(frequencyTHz(2), frequencyTHz(1) / 2);
  assert.ok(Number.isNaN(frequencyTHz(0)));
});

test('synthetic spectrum stays finite and positive over the full advertised slider range', () => {
  for (let hundredths = 75; hundredths <= 500; hundredths++) {
    assert.ok(syntheticFlux(hundredths / 100) > 0);
    assert.ok(Number.isFinite(syntheticFlux(hundredths / 100)));
  }
  assert.ok(syntheticFlux(1.2) > syntheticFlux(2.4));
});

test('averaging reduces only independent error and retains a fully shared error floor', () => {
  const one = uncertaintyExample(1);
  const twentyFive = uncertaintyExample(25);
  assert.equal(twentyFive.independent, 0.2);
  assert.equal(one.shared, twentyFive.shared);
  assert.ok(twentyFive.total > 0.3);
  assert.ok(twentyFive.total < one.total);
  assert.ok(Math.abs(twentyFive.total ** 2 - 0.13) < 1e-12);
});

test('sky addresses wrap consistently across the RA seam', () => {
  assert.equal(normalizeRA(360), 0);
  assert.equal(normalizeRA(-15), 345);
  assert.equal(normalizeRA(735), 15);
});

test('optional missing visual host is harmless', () => {
  assert.doesNotThrow(() => mountVisual(null, 'spectrum')());
});

test('wide SVG letterboxing maps a click on the spectrum peak to the same wavelength', () => {
  // A 720 ×172 SVG holds a 440 ×172 drawing, centred with 140px side gutters.
  const plotX = 48 + (1.2 - 0.75) / 4.25 * 366;
  const point = fitViewBoxPoint(10 + 140 + plotX, 20 + 60, { left: 10, top: 20, width: 720, height: 172 });
  const lambda = 0.75 + (point.x - 48) / 366 * 4.25;
  assert.ok(Math.abs(lambda - 1.2) < 1e-12);
  assert.equal(point.y, 60);
});

test('narrow and vertically letterboxed SVGs use the same drawing coordinates', () => {
  assert.deepEqual(fitViewBoxPoint(120, 63, { left: 10, top: 20, width: 220, height: 86 }), { x: 220, y: 86 });
  assert.deepEqual(fitViewBoxPoint(220, 164, { left: 0, top: 0, width: 440, height: 328 }), { x: 220, y: 86 });
  assert.equal(fitViewBoxPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }), null);
});

test('browser SVG inverse transform takes priority, including translated or scaled ancestors', () => {
  const svg = {
    getScreenCTM: () => ({ inverse: () => ({ a: 0.5, d: 0.5, e: -25, f: -10 }) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform(m) { return { x: this.x * m.a + m.e, y: this.y * m.d + m.f }; } }),
    getBoundingClientRect: () => { throw new Error('Do not use an untransformed bounding box.'); },
  };
  assert.deepEqual(clientToDiagramPoint(svg, 490, 192), { x: 220, y: 86 });
});

test('small charts retain an eleven CSS pixel label instead of shrinking it with the viewBox', () => {
  for (const width of [240, 310, 390, 440]) {
    const bounds = { width, height: 172 * width / 440 };
    assert.ok(Math.abs(11 * diagramLabelScale(bounds) * width / 440 - 11) < 1e-10);
  }
  assert.equal(diagramLabelScale({ width: 720, height: 172 }), 1);
  assert.equal(diagramLabelScale({ width: 0, height: 0 }), 1);
});

// A small DOM fixture exercises the real handlers without a browser or extra dependency.
function mountedVisual(kind, run) {
  class Element {
    constructor(tag) {
      this.tag = tag; this.children = []; this.attributes = new Map(); this.events = new Map();
      this.className = ''; this.textContent = ''; this.properties = new Map();
      this.style = { setProperty: (name, value) => this.properties.set(name, value) };
      this.classList = { add: name => { this.className += ` ${name}`; } };
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'class') this.className = value; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    append(...children) { for (const child of children) { this.children.push(child); child.parentNode = this; } }
    replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...children); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
    addEventListener(type, callback) { this.events.set(type, callback); }
    removeEventListener(type) { this.events.delete(type); }
    click() { this.events.get('click')?.({}); }
    getBoundingClientRect() { return { width: 440, height: 172, left: 0, top: 0 }; }
  }
  const previous = { document: globalThis.document, ResizeObserver: globalThis.ResizeObserver };
  const observers = [];
  globalThis.document = { createElement: tag => new Element(tag), createElementNS: (_ns, tag) => new Element(tag) };
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  };
  const container = new Element('div');
  const find = predicate => {
    const walk = element => predicate(element) ? element : element.children.map(walk).find(Boolean);
    return walk(container);
  };
  let destroy;
  try {
    destroy = mountVisual(container, kind);
    run({ find, observers, destroy, container });
  } finally {
    destroy?.();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
}

test('mask toggle exposes the displayed reasons and interpretation to the live readout', () => {
  mountedVisual('mask', ({ find, destroy }) => {
    const toggle = find(element => element.tag === 'button');
    const output = find(element => element.tag === 'output');
    assert.equal(output.getAttribute('aria-live'), 'polite');
    assert.match(output.textContent, /관측 범위 밖.*공통 파장 없음.*포화·품질 불량/);
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    toggle.click();
    assert.match(output.textContent, /빗금은 비교에서 제외.*검정은 낮은 밝기일 수/);
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    toggle.click();
    assert.match(output.textContent, /관측 범위 밖.*공통 파장 없음/);
    destroy();
    assert.equal(toggle.events.size, 0);
  });
});

test('spectrum has a readable HTML axis caption and disconnects its responsive observer on exit', () => {
  mountedVisual('spectrum', ({ find, observers, destroy, container }) => {
    const svg = find(element => element.tag === 'svg');
    const caption = find(element => element.className === 'sv-caption');
    assert.match(caption.textContent, /가로축: 파장 λ \(µm\).*세로축: Fν \(mJy\)/);
    assert.equal(svg.getAttribute('aria-describedby'), caption.id);
    const observer = observers[0];
    observer.callback([{ target: svg, contentRect: { width: 310, height: 172 * 310 / 440 } }]);
    assert.ok(Math.abs(Number(svg.properties.get('--sv-label-scale')) - 440 / 310) < 1e-10);
    destroy();
    assert.equal(observer.disconnected, true);
    assert.equal(container.children.length, 0);
  });
});
