import * as THREE from 'three';

/**
 * Modelos procedurales con carácter.
 *
 * Nada de assets externos: todo se construye con geometría de three, así el
 * juego sigue pesando lo mismo y el modelo se retoca desde el código.
 *
 * Cada creador devuelve `{ group, update(dt, estado), react(evento) }`:
 *   - `group`   va al ECS como `render.mesh`
 *   - `update`  recibe cómo se está moviendo la entidad y anima el modelo
 *   - `react`   recibe eventos del juego ("collect", "hit", "jump")
 */

const TAU = Math.PI * 2;

/** Degradado radial en un canvas: el truco barato para los brillos. */
let GLOW_TEXTURE = null;
function glowTexture() {
  if (GLOW_TEXTURE) return GLOW_TEXTURE;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.2, 'rgba(180,244,255,0.45)');
  grad.addColorStop(0.55, 'rgba(110,220,255,0.12)');
  grad.addColorStop(1, 'rgba(80,200,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  GLOW_TEXTURE = new THREE.CanvasTexture(canvas);
  GLOW_TEXTURE.colorSpace = THREE.SRGBColorSpace;
  return GLOW_TEXTURE;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** Interpolación estable a cualquier framerate. */
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

/* ---------------------------------------------------------------------------
 * ORBI — el orbe protagonista.
 *
 *        ✦ antena con bulbo que rebota como un muelle
 *      ╭───╮
 *     │ ◕ ◡ ◕ │   cara que NO rueda: ojos con pupilas que miran, boca que cambia
 *      ╰───╯
 *        ◯       cáscara facetada que SÍ rueda + núcleo que late dentro
 *       ═══      anillo orbital inclinado, por debajo de la cara
 *
 * Jerarquía: group (posición y giro del ECS)
 *              └── body (inclinación, squash & stretch, vuelta de celebración)
 *                    ├── shell (rueda)   ├── core (late)
 *                    ├── face  (fija)    ├── ring (orbita)
 *                    └── antenna (muelle) + luz propia
 * ------------------------------------------------------------------------- */
export function createOrbi({ radius: r = 0.6, color = 0x6ee7ff } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const tint = new THREE.Color(color);

  /* 1. Cáscara facetada de cristal --------------------------------------- */
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xbdf7ff,
    roughness: 0.1,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.36,
    flatShading: true,   // las facetas hacen visible que rueda
    envMapIntensity: 1.5,
  });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), shellMat);
  shell.castShadow = true;
  body.add(shell);

  // Halo: un sprite con degradado radial. Siempre mira a la cámara y se funde
  // con el fondo, así brilla de verdad en lugar de parecer una burbuja.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0x8ff2ff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  halo.scale.setScalar(r * 4.2);
  body.add(halo);

  /* 2. Núcleo emisivo ----------------------------------------------------- */
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: tint.clone(),
    emissiveIntensity: 3.2,
    roughness: 0.35,
    flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.26, 1), coreMat);
  core.position.set(0, -r * 0.12, -r * 0.15); // detrás de la cara, no la tapa
  body.add(core);

  /* 3. Anillo orbital ----------------------------------------------------- */
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r * 1.12, r * 0.05, 10, 44),
    new THREE.MeshStandardMaterial({
      color: 0xeaf9ff,
      emissive: tint.clone(),
      emissiveIntensity: 0.5,
      metalness: 1,
      roughness: 0.25,
    }),
  );
  // Inclinado y por debajo del ecuador: así nunca cruza por delante de la cara.
  ring.position.y = -r * 0.52;
  ring.rotation.set(Math.PI / 2 - 0.2, 0, 0.14);
  ring.castShadow = true;
  body.add(ring);

  /* 4. Cara (no rueda) ----------------------------------------------------- */
  const face = new THREE.Group();
  body.add(face);

  const eyeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xbccbe8, emissiveIntensity: 0.75, roughness: 0.3,
  });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0a1024, roughness: 0.25 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const eyeGeo = new THREE.SphereGeometry(r * 0.3, 20, 16);
  const pupilGeo = new THREE.SphereGeometry(r * 0.15, 14, 12);
  const glintGeo = new THREE.SphereGeometry(r * 0.045, 8, 8);

  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eye.position.set(side * r * 0.36, r * 0.28, r * 0.68); // local +Z es "delante"
    eye.scale.set(1, 1, 0.62);

    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0, 0, r * 0.22);
    const glint = new THREE.Mesh(glintGeo, glintMat);
    glint.position.set(-side * r * 0.05, r * 0.05, r * 0.1);
    pupil.add(glint);
    eye.add(pupil);

    face.add(eye);
    eyes.push({ eye, pupil });
  }

  // Dos bocas que se turnan: sonrisa (por defecto) y "oh" (susto o bostezo).
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x0a1024, roughness: 0.4 });
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.26, r * 0.05, 8, 22, Math.PI),
    mouthMat,
  );
  smile.position.set(0, -r * 0.14, r * 0.86);
  smile.rotation.z = Math.PI; // el arco mira hacia arriba: sonrisa
  face.add(smile);

  const oh = new THREE.Mesh(new THREE.SphereGeometry(r * 0.17, 14, 12), mouthMat);
  oh.position.set(0, -r * 0.16, r * 0.86);
  oh.scale.set(0.85, 1, 0.5);
  oh.visible = false;
  face.add(oh);

  // Mofletes: dos discos suaves que se encienden al celebrar.
  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xff88aa, transparent: true, opacity: 0,
  });
  const blushes = [];
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(r * 0.13, 12), blushMat.clone());
    blush.position.set(side * r * 0.58, r * 0.02, r * 0.68);
    blush.rotation.y = side * 0.8;
    face.add(blush);
    blushes.push(blush);
  }

  /* 4b. Espalda: respiradero y propulsores -------------------------------- *
   * La cámara persigue a Orbi por detrás, así que esta es la cara que más se
   * ve mientras se juega: aquí es donde tiene que pasar algo.                */
  const back = new THREE.Group();
  body.add(back);

  const vent = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.4, r * 0.07, 8, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: tint.clone(),
      emissiveIntensity: 2.4,
      roughness: 0.3,
      metalness: 0.4,
    }),
  );
  vent.position.z = -r * 0.72;
  back.add(vent);

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x9ff6ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameGeo = new THREE.ConeGeometry(r * 0.17, r * 0.7, 10, 1, true);
  const flames = [];
  for (const side of [-1, 1]) {
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(side * r * 0.26, -r * 0.05, -r * 0.95);
    flame.rotation.x = -Math.PI / 2; // la punta mira hacia atrás
    back.add(flame);
    flames.push(flame);
  }

  /* 5. Antena con muelle --------------------------------------------------- */
  const antenna = new THREE.Group();
  antenna.position.y = r * 0.85;
  body.add(antenna);

  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.025, r * 0.04, r * 0.5, 6),
    new THREE.MeshStandardMaterial({ color: 0xbfe9ff, metalness: 0.9, roughness: 0.3 }),
  );
  stalk.position.y = r * 0.25;
  antenna.add(stalk);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: new THREE.Color(0xffc94d), emissiveIntensity: 2.8, roughness: 0.3,
  });
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.17, 1), bulbMat);
  bulb.position.y = r * 0.56;
  antenna.add(bulb);

  /* 6. Luz propia ---------------------------------------------------------- */
  const lamp = new THREE.PointLight(color, 4.5, 11, 2);
  lamp.position.y = r * 0.2;
  body.add(lamp);

  /* --------------------------------------------------------------------- *
   * Estado de animación
   * --------------------------------------------------------------------- */
  let t = 0;
  let blinkIn = 1.5 + Math.random() * 3;
  let blinkPhase = -1;      // >= 0 mientras dura el parpadeo
  let squash = 0;           // + estirado (salto), - aplastado (aterrizaje)
  let grounded = true;
  let lastYaw = 0;
  let bank = 0;             // inclinación al girar
  let lean = 0;             // inclinación al acelerar
  let spin = 0;             // vuelta de celebración pendiente (radianes)
  let dizzy = 0;            // mareo tras un golpe
  let cheer = 0;            // segundos de euforia restantes
  let idle = 0;             // segundos quieto (para el bostezo)
  let yawn = 0;
  let antennaVel = 0;
  let antennaAng = 0;
  let lookX = 0;
  let lookY = 0;

  return {
    group,

    /** Eventos del juego: el modelo decide cómo se pone. */
    react(kind) {
      if (kind === 'collect') { cheer = 0.8; spin = TAU * 1.5; idle = 0; antennaVel -= 7; }
      if (kind === 'hit') { dizzy = 1.2; cheer = 0; }
      if (kind === 'jump') { antennaVel -= 9; idle = 0; }
    },

    /** Lo llama el sistema `avatar` en cada paso de lógica. */
    update(dt, s = {}) {
      t += dt;
      const speed = s.speed ?? 0;
      const moving = speed > 0.5;
      const scared = (s.threat ?? Infinity) < 7 && !moving ? true : (s.threat ?? Infinity) < 5;

      idle = moving ? 0 : idle + dt;
      cheer = Math.max(0, cheer - dt);
      dizzy = Math.max(0, dizzy - dt);

      /* Núcleo y luz: laten, y más rápido si corres. */
      const beat = Math.sin(t * (3.2 + speed * 0.25));
      core.scale.setScalar(1 + beat * 0.07);
      core.rotation.y += dt * 0.8;
      coreMat.emissiveIntensity = 2.6 + beat * 0.5 + speed * 0.05 + cheer * 1.5;
      halo.scale.setScalar(r * (4.2 + beat * 0.15 + cheer * 0.9));
      halo.material.opacity = 0.5 + beat * 0.06 + cheer * 0.35;
      lamp.intensity = 2.6 + beat * 0.4 + cheer * 2;

      /* Al recibir un golpe se pone rojo un instante. */
      const hurt = clamp(dizzy / 1.2, 0, 1);
      coreMat.emissive.copy(tint).lerp(new THREE.Color(0xff4d6d), hurt);
      shellMat.opacity = 0.36 + (s.invulnerable ? Math.sin(t * 22) * 0.22 : 0);

      /* La cáscara rueda según lo que avanza; la cara se queda quieta. */
      shell.rotation.x += (speed / r) * dt;
      shell.rotation.y += dt * 0.25;

      /* Propulsores: se encienden al correr y titilan. */
      const thrust = clamp(speed / 9, 0, 1);
      flameMat.opacity = thrust * (0.55 + Math.sin(t * 30) * 0.12);
      for (const flame of flames) flame.scale.set(1, 0.6 + thrust * 0.9, 1);
      vent.material.emissiveIntensity = 1.8 + thrust * 2.2 + cheer * 2;

      /* Anillo: orbita más rápido cuanto más corres. */
      ring.rotation.z += dt * (0.6 + speed * 0.2);

      /* Inclinación: hacia delante al acelerar, hacia dentro al girar. */
      const yaw = s.yaw ?? 0;
      let dYaw = yaw - lastYaw;
      while (dYaw > Math.PI) dYaw -= TAU;
      while (dYaw < -Math.PI) dYaw += TAU;
      lastYaw = yaw;
      bank = damp(bank, clamp(-dYaw / Math.max(dt, 1e-4) * 0.08, -0.5, 0.5), 8, dt);
      lean = damp(lean, clamp(speed * 0.032, 0, 0.3), 6, dt);

      /* Salto y aterrizaje: se estira y se aplasta. */
      if (s.grounded !== undefined) {
        if (grounded && !s.grounded) squash = 1;
        if (!grounded && s.grounded) { squash = -1; antennaVel += 11; }
        grounded = s.grounded;
      }
      squash = damp(squash, 0, 9, dt);
      const hop = cheer > 0 ? Math.abs(Math.sin(cheer * 12)) * 0.18 : 0;
      body.position.y = hop + Math.sin(t * 2.2) * 0.03;
      body.scale.set(1 - squash * 0.18, 1 + squash * 0.3, 1 - squash * 0.18);

      /* Celebración: la cáscara da vueltas y el cuerpo se contonea, pero la
         cara sigue de frente para que se le vea la alegría. */
      if (spin > 0) {
        const step = Math.min(spin, dt * 14);
        shell.rotation.y += step;
        ring.rotation.z += step * 0.6;
        spin -= step;
      }
      const wiggle = cheer > 0 ? Math.sin(t * 26) * 0.14 : 0;
      body.rotation.x = lean + (dizzy > 0 ? Math.sin(t * 18) * 0.12 * hurt : 0);
      body.rotation.z = bank + wiggle + (dizzy > 0 ? Math.cos(t * 15) * 0.15 * hurt : 0);

      /* Antena: muelle amortiguado que reacciona a saltos y frenazos. */
      antennaVel += (-antennaAng * 60 - antennaVel * 6) * dt;
      antennaVel += -bank * 6 * dt;
      antennaAng += antennaVel * dt;
      antenna.rotation.z = clamp(antennaAng * 0.05, -0.7, 0.7);
      antenna.rotation.x = Math.sin(t * 1.7) * 0.06;
      bulbMat.emissive.setHex(scared ? 0xff5470 : 0xffd166);
      bulbMat.emissiveIntensity = scared ? 2.6 + Math.sin(t * 20) * 1.2 : 2 + Math.sin(t * 2.5) * 0.4;

      /* Mirada: las pupilas siguen al objetivo que le pasa el sistema. */
      lookX = damp(lookX, clamp(s.lookX ?? 0, -1, 1), 9, dt);
      lookY = damp(lookY, clamp(s.lookY ?? 0, -1, 1), 9, dt);
      for (const { pupil } of eyes) {
        pupil.position.set(lookX * r * 0.09, lookY * r * 0.07, r * 0.2);
      }

      /* Parpadeo, susto, euforia y bostezo se reparten el tamaño del ojo. */
      blinkIn -= dt;
      if (blinkIn <= 0 && blinkPhase < 0) { blinkPhase = 0; blinkIn = 2 + Math.random() * 4; }
      let lid = 1;
      if (blinkPhase >= 0) {
        blinkPhase += dt;
        lid = blinkPhase < 0.07 ? 1 - blinkPhase / 0.07 : (blinkPhase - 0.07) / 0.07;
        if (blinkPhase > 0.14) { blinkPhase = -1; lid = 1; }
      }
      yawn = idle > 7 ? Math.min(1, yawn + dt * 2) : Math.max(0, yawn - dt * 3);
      if (idle > 11) idle = 0;

      const eyeScale = scared ? 1.25 : cheer > 0 ? 0.75 : 1;
      for (const { eye, pupil } of eyes) {
        eye.scale.y = Math.max(0.06, lid * eyeScale * (1 - yawn * 0.9));
        eye.scale.x = eyeScale;
        pupil.scale.setScalar(scared ? 0.65 : cheer > 0 ? 1.15 : 1);
      }

      /* Boca: sonrisa por defecto, "oh" al asustarse o bostezar. */
      const openMouth = scared || yawn > 0.4 || dizzy > 0.4;
      smile.visible = !openMouth;
      oh.visible = openMouth;
      oh.scale.set(0.85 + yawn * 0.5, 1 + yawn * 1.4, 0.5);
      smile.scale.setScalar(cheer > 0 ? 1.35 : 1);

      /* Mofletes encendidos mientras celebra. */
      const blushAlpha = cheer > 0 ? 0.55 : 0;
      for (const blush of blushes) {
        blush.material.opacity = damp(blush.material.opacity, blushAlpha, 8, dt);
      }
    },
  };
}
