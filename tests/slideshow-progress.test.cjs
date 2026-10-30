const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the actual slideshow clock without waiting on real time or a browser.
let now = 0;
let id = 0;
const frames = new Map();
const intervals = new Map();
class Component {
  constructor() {
    this.attributes = new Map([['autoplay', '3']]);
    this.properties = new Map();
    this.style = { setProperty: (name, value) => this.properties.set(name, value) };
    this.refs = {
      dots: Array.from({ length: 3 }, () => ({ setAttribute() {} })),
      slides: Array.from({ length: 3 }, () => ({ hasAttribute: () => false })),
    };
    this.isConnected = true;
    this.homepage = true;
  }
  closest() { return this.homepage ? {} : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  matches() { return false; }
}
const context = vm.createContext({
  Component,
  performance: { now: () => now },
  document: { hidden: false },
  customElements: { get: () => true },
  requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
  cancelAnimationFrame: handle => frames.delete(handle),
  setInterval: callback => { intervals.set(++id, callback); return id; },
  clearInterval: handle => intervals.delete(handle),
});
const source = fs.readFileSync('assets/slideshow.js', 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
  .replace('export class Slideshow', 'class Slideshow');
vm.runInContext(`${source}\nglobalThis.TestSlideshow = Slideshow;`, context);
function frame(time) {
  now = time;
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback(time));
}
const slideshow = new context.TestSlideshow();
let advances = 0;
slideshow.next = () => { advances++; slideshow.current = (slideshow.current + 1) % 3; };
slideshow.play();
slideshow.play();
assert.equal(frames.size, 1, 'play cannot create duplicate clocks');
frame(1500);
assert.equal(slideshow.properties.get('--slideshow-progress'), '180.00deg');
assert.equal(advances, 0, 'half a lap must not advance');
frame(3000);
assert.equal(advances, 1, 'one completed lap advances exactly once');
assert.equal(slideshow.properties.get('--slideshow-progress'), '0deg');
frame(4500);
slideshow.select(2, { preventDefault() {} });
slideshow.current = 2;
assert.equal(slideshow.properties.get('--slideshow-progress'), '0deg', 'manual selection restarts the lap');
frame(7499);
assert.equal(advances, 1, 'new selection receives a full interval');
frame(7500);
assert.equal(advances, 2);
slideshow.pause();
frame(15000);
assert.equal(advances, 2, 'pause stops both ring and advance');
slideshow.resume();
assert.equal(frames.size, 0, 'hover leave must not override an explicit user pause');
slideshow.play();
frame(16500);
assert.equal(slideshow.properties.get('--slideshow-progress'), '180.00deg');
slideshow.suspend();
frame(21000);
assert.equal(advances, 2, 'hover/visibility suspension stops the shared clock');
slideshow.resume();
frame(24000);
assert.equal(advances, 3);
slideshow.suspend();

const fiveSecond = new context.TestSlideshow();
fiveSecond.setAttribute('autoplay', '5');
let fiveSecondAdvances = 0;
fiveSecond.next = () => { fiveSecondAdvances++; fiveSecond.current = (fiveSecond.current + 1) % 3; };
const fiveSecondStart = now;
fiveSecond.play();
frame(fiveSecondStart + 2500);
assert.equal(fiveSecond.properties.get('--slideshow-progress'), '180.00deg');
frame(fiveSecondStart + 4999);
assert.equal(fiveSecondAdvances, 0, 'a five-second slide cannot change early');
frame(fiveSecondStart + 5000);
assert.equal(fiveSecondAdvances, 1, 'a complete five-second ring advances the slide');
frame(fiveSecondStart + 5500);
fiveSecond.current = 0;
fiveSecond.current = 1;
assert.equal(fiveSecond.properties.get('--slideshow-progress'), '36.00deg', 'scroll synchronization must not restart the ring');
fiveSecond.suspend();
fiveSecond.resume();
frame(fiveSecondStart + 10500);
assert.equal(fiveSecondAdvances, 2, 'temporary swipe/visibility suspension resumes playback');
fiveSecond.suspend();

const other = new context.TestSlideshow();
other.homepage = false;
let otherAdvances = 0;
other.next = () => otherAdvances++;
other.play();
assert.equal(frames.size, 0, 'other carousels retain their existing timer');
assert.equal(intervals.size, 1);
[...intervals.values()][0]();
assert.equal(otherAdvances, 1);
other.pause();
assert.equal(intervals.size, 0);
console.log('PASS: lap timing, navigation reset, pause/resume, suspension, and other carousels');
