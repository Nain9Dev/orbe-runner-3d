# Orbe Runner 3D

**Jugar online: https://orbe.naindev.com**

Videojuego 3D open source hecho desde cero: recoge todos los orbes de la arena
esquivando a los cazadores y pasa de nivel. Cada nivel se genera solo y es más
grande y más rápido que el anterior.

- **Sin build, sin npm, sin bundler**: son archivos `.js` con módulos ES nativos.
- **Sin internet**: three.js (MIT) viene incluido en `vendor/`.
- **Sin dependencias de juego**: física, IA, cámara, HUD y niveles son código propio.

## Jugar

```bash
git clone https://github.com/Nain9Dev/orbe-runner-3d.git
cd orbe-runner-3d
python3 -m http.server 8000
# abre http://localhost:8000
```

Sirve igual cualquier servidor estático (`npx serve`, `php -S`, Live Server...).
Hace falta un servidor porque los módulos ES no se cargan desde `file://`.

| Tecla | Acción |
|---|---|
| `W A S D` / flechas | Moverse (relativo a la cámara) |
| `Espacio` | Saltar |
| Ratón | Girar la cámara |
| `Esc` | Soltar el ratón (clic para recuperarlo) |

## Publicarlo en internet

El juego es HTML estático, así que cualquier hosting de estáticos vale y todos
los gratuitos aguantan de sobra: se sirve desde CDN y no hay servidor que
escalar. Este repo está preparado para **GitHub Pages**:

- `CNAME` ya apunta a `orbe.naindev.com`.
- `.nojekyll` evita que Pages procese los archivos con Jekyll.
- Cada `git push` a `main` republica el sitio solo.

Pasos, una sola vez:

1. En el repo: **Settings → Pages → Source: _Deploy from a branch_ → `main` → `/ (root)` → Save**.
2. En el DNS de `naindev.com`, un registro nuevo:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | CNAME | `orbe` | `nain9dev.github.io` |

3. Cuando GitHub emita el certificado (unos minutos), marca **Enforce HTTPS**
   en Settings → Pages. Hace falta HTTPS para que el bloqueo de ratón funcione.

Sin dominio propio, el juego queda igualmente en
`https://nain9dev.github.io/orbe-runner-3d/` (borra el archivo `CNAME`).

## Cómo está montado

Es un **ECS** (Entity–Component–System) minúsculo, unas 200 líneas de núcleo:

- **Entidad**: un objeto con `id`.
- **Componente**: una propiedad de esa entidad (`transform`, `body`, `enemy`...).
- **Sistema**: una función `update(world, dt)` que trabaja sobre las entidades
  que tengan ciertos componentes.

```
orbe-runner-3d/
├── index.html            # canvas + HUD + importmap
├── CNAME                 # dominio propio para GitHub Pages
├── preview.png           # imagen de vista previa al compartir el enlace
└── src/
    ├── main.js           # monta el mundo y enchufa los sistemas (el "guion" del juego)
    ├── config.js         # todos los números ajustables
    ├── core/
    │   ├── world.js      # ECS: entidades, consultas, registro de sistemas
    │   ├── engine.js     # bucle con paso fijo (lógica) + render por frame
    │   ├── events.js     # bus de eventos
    │   └── input.js      # teclado y ratón como estado consultable
    ├── game/
    │   ├── prefabs.js    # catálogo de objetos: jugador, enemigo, orbe, plataforma...
    │   └── level.js      # generador de niveles determinista
    └── systems/
        ├── player.js     # entrada  -> velocidad
        ├── enemy.js      # IA       -> velocidad
        ├── physics.js    # velocidad-> posición + colisiones
        ├── triggers.js   # contactos-> eventos ("orb:collected", "player:hit")
        ├── camera.js     # seguimiento en tercera persona
        ├── game.js       # reglas: orbes, vidas, niveles
        ├── render.js     # única parte que habla con three.js
        └── hud.js        # única parte que toca el DOM
```

Cada frame:

```
entrada -> sistemas de lógica (paso fijo 1/60) -> eventos -> render
```

El paso fijo hace que la física se comporte igual a 30 que a 144 FPS.

## Cómo se amplía

**Un objeto nuevo** (`src/game/prefabs.js`):

```js
definePrefab('trampolin', ({ position }) => ({
  tag: 'trampolin',
  transform: { position: position.clone(), yaw: 0 },
  solid: { size: new THREE.Vector3(3, 0.5, 3) },
  bounce: { power: 18 },                       // componente propio
  render: { mesh: mesh(GEO.box, MAT.platform, new THREE.Vector3(3, 0.5, 3)) },
}));
```

**Una mecánica nueva**: un sistema que filtre por ese componente y una línea en
`src/main.js`:

```js
export function bounceSystem() {
  return {
    name: 'bounce',
    update(world) {
      const p = world.first('player');
      for (const t of world.query('bounce', 'transform')) {
        if (p && p.transform.position.distanceTo(t.transform.position) < 2.5) {
          p.body.velocity.y = t.bounce.power;
        }
      }
    },
  };
}
```

Nada más hay que tocar: ni el motor, ni el render, ni la física.

**Reglas y contenido**: `src/systems/game.js` escucha eventos (`orb:collected`,
`player:hit`) y decide qué pasa; `src/game/level.js` construye el mundo. Cambiar
la generación por niveles escritos a mano en JSON es reescribir esa función y ya.

**Ajustar el "feel"**: todo está en `src/config.js` (gravedad, salto, velocidad,
cámara, dificultad por nivel). No hace falta abrir el motor.

**Probar en caliente**: en la consola del navegador tienes `GAME`:

```js
GAME.CONFIG.player.jump = 20;
GAME.world.addSystem(miSistema());   // se activa al momento
GAME.world.removeSystem('enemy');    // modo paseo
```

## Decisiones de diseño

- **Geometrías y materiales compartidos** entre instancias: cientos de entidades
  sin coste extra de memoria.
- **Colisiones esfera–caja** resueltas a mano: suficiente para un plataformas y
  cero dependencias. Si algún día hay miles de sólidos, el punto donde meter una
  rejilla espacial es `physicsSystem`, sin tocar nada más.
- **Eventos en vez de llamadas directas** entre sistemas: se puede añadir sonido,
  partículas o logros suscribiéndose, sin modificar quien los emite.
- **HUD en DOM** y no en el canvas: se maqueta con CSS normal y se puede
  sustituir por otra capa sin tocar el juego.

## Licencia

MIT — ver `LICENSE`. Incluye [three.js](https://threejs.org) r160 (MIT) en
`vendor/`, con su licencia en `vendor/THREE-LICENSE.txt`.
