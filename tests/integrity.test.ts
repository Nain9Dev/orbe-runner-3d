import { describe, it, expect } from 'vitest';
import {
  create,
  applyDamage,
  repair,
  extend,
  ratio,
  isCritical,
  describe as describeIntegrity,
} from '../src/domain/integrity.js';

describe('Integridad del Núcleo — REQ-024.30, REQ-024.32, REQ-024.33', () => {
  it('starts full', () => {
    const s = create(3);
    expect(s.current).toBe(3);
    expect(s.max).toBe(3);
    expect(s.shield).toBe(false);
  });

  it('removes exactly the damage taken', () => {
    const r = applyDamage(create(3), 1);
    expect(r.state.current).toBe(2);
    expect(r.lost).toBe(1);
    expect(r.lethal).toBe(false);
  });

  it('clamps over-damage at zero and reports it as lethal', () => {
    const r = applyDamage(create(3), 10);
    expect(r.state.current).toBe(0);
    expect(r.lost).toBe(3);
    expect(r.lethal).toBe(true);
  });

  it('absorbs a whole lethal hit with the Escudo and consumes it', () => {
    const shielded = { ...create(3), shield: true };
    const r = applyDamage(shielded, 10);
    expect(r.absorbed).toBe(true);
    expect(r.lost).toBe(0);
    expect(r.lethal).toBe(false);
    expect(r.state.current).toBe(3);
    expect(r.state.shield).toBe(false);
  });

  it('ignores zero damage without consuming the Escudo', () => {
    const shielded = { ...create(3), shield: true };
    const r = applyDamage(shielded, 0);
    expect(r.state.shield).toBe(true);
    expect(r.lost).toBe(0);
  });

  it('never repairs above the maximum', () => {
    const damaged = applyDamage(create(3), 2).state;
    const r = repair(damaged, 5);
    expect(r.state.current).toBe(3);
    expect(r.gained).toBe(2);
  });

  it('extends the ceiling and fills the new layer', () => {
    const s = extend(create(3), 2);
    expect(s.max).toBe(5);
    expect(s.current).toBe(5);
  });

  it('reports a 0..1 ratio and never divides by zero', () => {
    expect(ratio(create(4))).toBe(1);
    expect(ratio(applyDamage(create(4), 2).state)).toBe(0.5);
    expect(ratio({ current: 0, max: 0, shield: false })).toBe(0);
  });

  it('flags critical at one layer or less', () => {
    expect(isCritical(create(3))).toBe(false);
    expect(isCritical(applyDamage(create(3), 2).state)).toBe(true);
    expect(isCritical(applyDamage(create(3), 3).state)).toBe(true);
  });

  it('produces an accessible description for every state — REQ-024.35', () => {
    expect(describeIntegrity(create(3))).toBe('Integridad 3 de 3');
    expect(describeIntegrity({ current: 1, max: 3, shield: false })).toContain('crítica');
    expect(describeIntegrity({ current: 2, max: 3, shield: true })).toContain('escudo');
    expect(describeIntegrity({ current: 0, max: 3, shield: false })).toBe('Núcleo colapsado');
  });

  it('does not mutate the state it is given', () => {
    const s = create(3);
    applyDamage(s, 1);
    repair(s, 1);
    expect(s.current).toBe(3);
  });
});
