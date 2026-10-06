import { describe, expect, it, beforeEach } from 'vitest';
import { ActionType } from '@reticlehq/core';
import { executeAction } from './actions.js';
import { refs } from '@/dom/addressing/refs.js';

/**
 * `press` must send the `keypress` a browser sends between `keydown` and `keyup`.
 *
 * It sent only the two outer events. A page that reads keys off `keypress` — a barcode scanner
 * listener on `window`, an older keyboard-shortcut library, a PIN pad — got nothing, while the
 * action reported success. The browser's own rule is followed: `keypress` fires only for a key that
 * produces a character (or Enter), never for Escape, Tab, arrows or a bare modifier, and never when
 * the `keydown` was cancelled.
 */
describe('press fires keypress like a browser does', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const record = (el: HTMLElement): string[] => {
    const seen: string[] = [];
    for (const type of ['keydown', 'keypress', 'keyup']) {
      el.addEventListener(type, (e) => seen.push(`${type}:${(e as KeyboardEvent).key}`));
    }
    return seen;
  };

  const target = (): HTMLInputElement => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    return el;
  };

  it('a digit gives keydown, keypress, keyup', async () => {
    const el = target();
    const seen = record(el);
    await executeAction(refs.refFor(el), ActionType.PRESS, { text: '9' });
    expect(seen).toEqual(['keydown:9', 'keypress:9', 'keyup:9']);
  });

  it('Enter gives keydown, keypress, keyup', async () => {
    const el = target();
    const seen = record(el);
    await executeAction(refs.refFor(el), ActionType.PRESS, { text: 'Enter' });
    expect(seen).toEqual(['keydown:Enter', 'keypress:Enter', 'keyup:Enter']);
  });

  it('a window-level keypress listener sees the key', async () => {
    const el = target();
    const log: string[] = [];
    const onKeypress = (e: KeyboardEvent): void => {
      log.push(e.key);
    };
    window.addEventListener('keypress', onKeypress);
    try {
      await executeAction(refs.refFor(el), ActionType.PRESS, { text: '9' });
    } finally {
      window.removeEventListener('keypress', onKeypress);
    }
    expect(log).toEqual(['9']);
  });

  it.each(['Escape', 'Tab', 'ArrowDown', 'Shift'])('no keypress for %s', async (key) => {
    const el = target();
    const seen = record(el);
    await executeAction(refs.refFor(el), ActionType.PRESS, { text: key });
    expect(seen).toEqual([`keydown:${key}`, `keyup:${key}`]);
  });

  it('no keypress after a cancelled keydown', async () => {
    const el = target();
    const seen = record(el);
    el.addEventListener('keydown', (e) => e.preventDefault());
    await executeAction(refs.refFor(el), ActionType.PRESS, { text: '9' });
    expect(seen).toEqual(['keydown:9', 'keyup:9']);
  });

  it('a combo fires keypress for its character key, not for the modifier', async () => {
    const el = target();
    const seen = record(el);
    await executeAction(refs.refFor(el), ActionType.PRESS, { keys: ['Shift', 'A'] });
    expect(seen).toEqual(['keydown:Shift', 'keydown:A', 'keypress:A', 'keyup:A', 'keyup:Shift']);
  });

  it('no keypress for a Control shortcut', async () => {
    const el = target();
    const seen = record(el);
    await executeAction(refs.refFor(el), ActionType.PRESS, { keys: ['Control', 'k'] });
    expect(seen).not.toContain('keypress:k');
  });
});
