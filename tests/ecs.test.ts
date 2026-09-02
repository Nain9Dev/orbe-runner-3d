import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/core/world.js';

describe('ECS Core', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it('should spawn entities with incrementing IDs', () => {
    const e1 = world.spawn({ tag: 'a' });
    const e2 = world.spawn({ tag: 'b' });
    
    expect(e1.id).toBeDefined();
    expect(e2.id).toBe(e1.id + 1);
  });

  it('should find entities by components', () => {
    world.spawn({ a: 1, b: 2 });
    world.spawn({ a: 1 });
    world.spawn({ b: 2, c: 3 });

    const withA = world.find('a');
    expect(withA.length).toBe(2);

    const withAB = world.find('a', 'b');
    expect(withAB.length).toBe(1);
  });

  it('should destroy entities at the end of the frame', () => {
    const e = world.spawn({ a: 1 });
    expect(world.first('a')).toBeDefined();

    world.destroy(e);
    // Destroys happen at the end of world.update()
    expect(world.first('a')).toBeDefined(); 

    world.update(0.1);
    expect(world.first('a')).toBeNull();
  });

  it('should execute systems sequentially', () => {
    const order: string[] = [];
    
    world.addSystem({
      init: () => order.push('init1'),
      update: () => order.push('update1')
    });
    
    world.addSystem({
      init: () => order.push('init2'),
      update: () => order.push('update2')
    });

    world.events.emit('game:start');
    
    world.update(0.1);
    
    // In current engine, init might be called manually or during setup.
    // Assuming update runs in addition order:
    expect(order.filter(x => x.startsWith('update'))).toEqual(['update1', 'update2']);
  });
});
