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
export function glowTexture() {
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
export function createOrbi({ radius: r = 0.6, color = 0x6ee7ff, tier = 0 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const tint = new THREE.Color(color);

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
  const shellGeo = new THREE.IcosahedronGeometry(r, 2);
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.castShadow = true;
  body.add(shell);

  // Chasis Cibernético: Malla de alambre sobre la cáscara
  const wireMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
  const wireGeo = new THREE.WireframeGeometry(shellGeo);
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  wireframe.scale.setScalar(1.02); // Ligeramente más grande que la cáscara
  shell.add(wireframe);

  // Halo: un sprite con degradado radial. Siempre mira a la cámara y se funde
  // con el fondo, así brilla de verdad en lugar de parecer una burbuja.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0x8ff2ff,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  halo.scale.setScalar(r * 2.8);
  body.add(halo);

  /* 2. Núcleo emisivo ----------------------------------------------------- */
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: tint.clone(),
    emissiveIntensity: 1.5,
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

  // Evolución Tier 1: Segundo anillo orbital
  let ring2;
  let crown; // Prevención de errores para Tiers > 3
  if (tier >= 1) {
    ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.05, r * 0.05, 8, 36),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: tint.clone(),
        emissiveIntensity: 0.8,
        metalness: 1,
        roughness: 0.2,
      }),
    );
    ring2.position.y = r * 0.4;
    ring2.rotation.set(Math.PI / 2 + 0.3, 0, -0.2);
    ring2.castShadow = true;
    body.add(ring2);
  }

  // Corona Tier 3
  if (tier >= 3) {
    crown = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.4, r * 0.05, 4, 3),
      new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 1.5 })
    );
    crown.position.y = r * 1.2;
    crown.rotation.x = Math.PI / 2;
    body.add(crown);
  }

  /* 4. Cara (Visor Cibernético) -------------------------------------------- */
  const face = new THREE.Group();
  body.add(face);

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x020510, roughness: 0.1, metalness: 0.9, clearcoat: 1
  });
  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.5, r * 0.5, r * 0.35, 24, 1, false, -Math.PI/2.2, Math.PI/1.1),
    visorMat
  );
  visor.rotation.x = Math.PI / 2;
  visor.position.set(0, r * 0.1, r * 0.65);
  face.add(visor);

  // Ojos LED (Pupilas)
  const pupilMat = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, emissive: tint.clone(), emissiveIntensity: 1.5 
  });
  const pupilGeo = new THREE.CapsuleGeometry(r * 0.05, r * 0.08, 4, 8);
  
  const eyes = [];
  for (const side of [-1, 1]) {
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(side * r * 0.2, r * 0.1, r * 1.15);
    pupil.rotation.z = side * 0.1;
    face.add(pupil);
    eyes.push(pupil);
  }

  // Mofletes: dos discos suaves que se encienden al celebrar.
  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xff88aa, transparent: true, opacity: 0,
  });
  const blushes = [];
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(r * 0.13, 12), blushMat.clone());
    blush.position.set(side * r * 0.55, -r * 0.05, r * 0.7);
    blush.rotation.y = side * 0.8;
    face.add(blush);
    blushes.push(blush);
  }

  /* 4b. Orejas / Alerones Aerodinámicos ------------------------------------ */
  const ears = [];
  const earMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.2 });
  const earGeo = new THREE.ConeGeometry(r * 0.15, r * 0.6, 4);
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * r * 0.8, r * 0.2, 0);
    
    const mesh = new THREE.Mesh(earGeo, earMat);
    mesh.rotation.z = side * -Math.PI / 2.5; // apuntan hacia afuera
    mesh.position.x = side * r * 0.2;
    ear.add(mesh);
    
    body.add(ear);
    ears.push({ group: ear, side, baseRotZ: ear.rotation.z });
  }

  /* 4c. Manos de Energía Articuladas ----------------------------------------- */
  const hands = [];
  const handMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: tint.clone(), emissiveIntensity: 2, transparent: true, opacity: 0.8
  });
  const handGeo = new THREE.SphereGeometry(r * 0.2, 12, 12);
  const fingerGeo = new THREE.BoxGeometry(r * 0.08, r * 0.08, r * 0.08);

  for (const side of [-1, 1]) {
    const handGroup = new THREE.Group();
    handGroup.position.set(side * r * 1.1, -r * 0.2, r * 0.3);
    
    const hand = new THREE.Mesh(handGeo, handMat);
    handGroup.add(hand);

    // Dedos satélites
    const fingers = [];
    for (let i = 0; i < 3; i++) {
      const finger = new THREE.Mesh(fingerGeo, handMat);
      handGroup.add(finger);
      fingers.push({ mesh: finger, offset: (i / 3) * TAU });
    }

    body.add(handGroup);
    hands.push({ group: handGroup, side, baseY: handGroup.position.y, fingers });
  }

  /* 4d. Espalda: Respiradero y propulsores --------------------------------- */
  const back = new THREE.Group();
  body.add(back);

  const vent = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.4, r * 0.07, 8, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: tint.clone(),
      emissiveIntensity: 1.0,
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

  // Evolución Tier 2: Alas de energía
  if (tier >= 2) {
    const wingMat = new THREE.MeshBasicMaterial({
      color: tint.clone(),
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const wingGeo = new THREE.ConeGeometry(r * 0.3, r * 1.5, 3);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(side * r * 0.5, r * 0.3, -r * 0.6);
      wing.rotation.set(-Math.PI / 3, 0, side * -0.5);
      back.add(wing);
    }
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
  const lamp = new THREE.PointLight(color, 0.8, 11, 2);
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
  let flipAng = 0; // Ángulo de voltereta
  let flipVel = 0; // Velocidad de rotación de la voltereta

  /* ---------------------------- motion trail ----------------------------
   * A ribbon of fading copies behind Lúmen (REQ-025.23). Two jobs:
   *
   *   - **Speed you can see.** The dash covers 6.8 units in a fifth of a second;
   *     without a trail that reads as a teleport rather than as movement.
   *   - **Where you just were.** On a precision jump the ghost of the take-off
   *     point is a genuine aid, not decoration.
   *
   * Fixed pool, positions written in world space each step. Nothing is created
   * or destroyed while the game runs.
   * ------------------------------------------------------------------- */
  const TRAIL = 10;
  const trailMat = new THREE.SpriteMaterial({
    map: glowTexture(), color: tint.clone(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const trail = [];
  for (let i = 0; i < TRAIL; i++) {
    const ghost = new THREE.Sprite(trailMat.clone());
    ghost.visible = false;
    // Parented to the scene root, not to the group: a trail that followed the
    // avatar would defeat the entire point of a trail.
    trail.push({ sprite: ghost, life: 0, attached: false });
  }
  let trailTimer = 0;

  return {
    group,

    /** The ghosts live in world space, so they need adopting by the scene once. */
    attachTrail(scene) {
      for (const g of trail) {
        if (g.attached) continue;
        scene.add(g.sprite);
        g.attached = true;
      }
    },

    detachTrail(scene) {
      for (const g of trail) {
        if (!g.attached) continue;
        scene.remove(g.sprite);
        g.attached = false;
      }
    },

    /** Eventos del juego: el modelo decide cómo se pone. */
    react(kind) {
      if (kind === 'collect') { cheer = 0.8; spin = TAU * 1.5; idle = 0; antennaVel -= 7; }
      if (kind === 'hit') { dizzy = 1.2; cheer = 0; }
      if (kind === 'jump') { 
        antennaVel -= 9; 
        idle = 0;
        // Iniciar voltereta frontal rápida (360 grados)
        flipVel = TAU * 1.5; 
      }
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

      /* ------------------------------ trail ------------------------------ */

      const dashing = !!s.dashing;
      // Ghosts are dropped by distance travelled, and much more densely during
      // an Impulso, which is when the eye most needs the help.
      trailTimer += dt * speed * (dashing ? 5.5 : 1);
      if (trailTimer > 1 && (speed > 6 || dashing)) {
        trailTimer = 0;
        let oldest = trail[0];
        for (const g of trail) if (g.life < oldest.life) oldest = g;
        oldest.life = 1;
        oldest.sprite.position.copy(group.position);
        oldest.sprite.position.y += r * 0.1;
        oldest.sprite.material.color.copy(tint);
      }
      for (const g of trail) {
        if (g.life <= 0) { g.sprite.visible = false; continue; }
        g.life = Math.max(0, g.life - dt * (dashing ? 4.2 : 3));
        g.sprite.visible = true;
        g.sprite.material.opacity = g.life * g.life * (dashing ? 0.5 : 0.26);
        g.sprite.scale.setScalar(r * (1.6 + (1 - g.life) * 1.4));
      }

      /* Núcleo y luz: laten, y más rápido si corres. */
      const beat = Math.sin(t * (3.2 + speed * 0.25));
      // …and with the music on top of its own rhythm (REQ-025.13).
      const musicPulse = s.beat?.pulse ?? 0;
      core.scale.setScalar(1 + beat * 0.07);
      core.rotation.y += dt * 0.8;
      coreMat.emissiveIntensity = 1.6 + beat * 0.4 + speed * 0.05 + cheer * 1.0
        + musicPulse * 0.5;
      halo.scale.setScalar(r * (2.8 + beat * 0.15 + cheer * 0.5 + musicPulse * 0.22));
      halo.material.opacity = 0.2 + beat * 0.05 + cheer * 0.2 + musicPulse * 0.07;
      lamp.intensity = 0.8 + beat * 0.2 + cheer * 0.5 + musicPulse * 0.35;

      /* Al recibir un golpe se pone rojo un instante. */
      const hurt = clamp(dizzy / 1.2, 0, 1);
      coreMat.emissive.copy(tint).lerp(new THREE.Color(0xff4d6d), hurt);
      shellMat.opacity = 0.36 + (s.invulnerable ? Math.sin(t * 22) * 0.22 : 0);

      /* La cáscara rueda según lo que avanza; la cara se queda quieta. */
      shell.rotation.x += (speed / r) * dt;
      shell.rotation.y += dt * 0.25;

      /* Propulsores: se encienden al correr y titilan. */
      const thrust = clamp(speed / 9, 0, 1);
      flameMat.opacity = thrust * (0.35 + Math.sin(t * 30) * 0.08);
      for (const flame of flames) flame.scale.set(1, 0.6 + thrust * 0.9, 1);
      vent.material.emissiveIntensity = 0.4 + thrust * 0.5 + cheer * 0.1;

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

      /* Celebración y Voltereta de Salto */
      if (spin > 0) {
        const step = Math.min(spin, dt * 14);
        shell.rotation.y += step;
        ring.rotation.z += step * 0.6;
        spin -= step;
      }
      
      // Progresar la voltereta frontal
      if (!grounded && flipVel > 0) {
        flipAng += flipVel * dt;
        if (flipAng >= TAU) {
          flipAng = 0; // Vuelta completa
          flipVel = 0;
        }
      } else if (grounded) {
        // Corrección de aterrizaje si se quedó a medias
        flipAng = damp(flipAng, 0, 15, dt);
        flipVel = 0;
      }

      const wiggle = cheer > 0 ? Math.sin(t * 26) * 0.14 : 0;
      body.rotation.x = lean - flipAng + (dizzy > 0 ? Math.sin(t * 18) * 0.12 * hurt : 0);
      body.rotation.z = bank + wiggle + (dizzy > 0 ? Math.cos(t * 15) * 0.15 * hurt : 0);

      /* Antena: muelle amortiguado que reacciona a saltos y frenazos. */
      antennaVel += (-antennaAng * 60 - antennaVel * 6) * dt;
      antennaVel += -bank * 6 * dt;
      antennaAng += antennaVel * dt;
      antenna.rotation.z = clamp(antennaAng * 0.05, -0.7, 0.7);
      antenna.rotation.x = Math.sin(t * 1.7) * 0.06;
      bulbMat.emissive.setHex(scared ? 0xff5470 : 0xffd166);
      bulbMat.emissiveIntensity = scared ? 2.6 + Math.sin(t * 20) * 1.2 : 2 + Math.sin(t * 2.5) * 0.4;

      /* Mirada: las pupilas se deslizan por el visor. */
      lookX = damp(lookX, clamp(s.lookX ?? 0, -1, 1), 9, dt);
      lookY = damp(lookY, clamp(s.lookY ?? 0, -1, 1), 9, dt);
      
      const eyeScale = scared ? 1.4 : cheer > 0 ? 0.7 : 1;
      for (let i = 0; i < eyes.length; i++) {
        const pupil = eyes[i];
        const side = i === 0 ? -1 : 1;
        pupil.position.set(side * r * 0.2 + lookX * r * 0.15, r * 0.1 + lookY * r * 0.08, r * 1.15);
        pupil.scale.setScalar(damp(pupil.scale.x, eyeScale, 12, dt));
        pupil.material.emissiveIntensity = scared ? 5 + Math.sin(t*20)*2 : 3;
        if (dizzy > 0) pupil.rotation.z += dt * 5 * side; // ojos locos
      }

      /* Orejas: reaccionan a la velocidad y a los saltos. */
      for (const ear of ears) {
        // Se pegan a la cabeza al correr, y aletean al saltar o celebrar
        const targetRot = ear.baseRotZ + ear.side * (speed * 0.04 - squash * 0.8 + (cheer > 0 ? Math.sin(t * 15) * 0.2 : 0));
        ear.group.rotation.z = damp(ear.group.rotation.z, targetRot, 12, dt);
        // Se inclinan hacia delante al acelerar
        ear.group.rotation.x = damp(ear.group.rotation.x, lean * 1.5, 10, dt);
      }

      /* Manos de Energía Articuladas: siguen el salto y orbitan sus dedos. */
      for (const hand of hands) {
        const joy = cheer > 0 ? r * 0.6 + Math.sin(t * 12 + hand.side) * 0.1 : 0;
        const drag = -squash * r * 0.8; 
        const targetY = hand.baseY + joy + drag;
        hand.group.position.y = damp(hand.group.position.y, targetY, 15, dt);
        hand.group.scale.setScalar(cheer > 0 ? 1.3 : 1);
        
        // Animación de los dedos flotantes
        for (const finger of hand.fingers) {
          const orbitR = r * 0.28 + (speed * 0.015);
          const orbitT = t * 3 + finger.offset;
          finger.mesh.position.set(
            Math.cos(orbitT) * orbitR,
            Math.sin(orbitT * 2) * orbitR * 0.5,
            Math.sin(orbitT) * orbitR
          );
          finger.mesh.rotation.x += dt * 2;
          finger.mesh.rotation.y += dt * 3;
        }
      }

      /* Mofletes encendidos mientras celebra. */
      const blushAlpha = cheer > 0 ? 0.55 : 0;
      for (const blush of blushes) {
        blush.material.opacity = damp(blush.material.opacity, blushAlpha, 8, dt);
      }

      /* Animación de Tiers */
      if (tier >= 1 && ring2) {
        ring2.rotation.y += dt * 0.4;
        ring2.rotation.x = Math.sin(t * 1.5) * 0.3;
      }
      if (tier >= 3 && crown) {
        crown.rotation.y -= dt * 1.2;
        crown.position.y = Math.sin(t * 3) * 0.15;
      }
    },
  };
}

/* ---------------------------------------------------------------------------
 * Recursos compartidos de los modelos que se repiten.
 *
 * Orbi es único y puede permitirse materiales propios; de cazadores y orbes
 * hay decenas, así que geometría y material se crean UNA vez y se reparten.
 * Lo que varía por instancia son las transformaciones, que salen gratis.
 * ------------------------------------------------------------------------- */
const cache = {};
const once = (key, make) => (cache[key] ??= make());

/* ---------------------------------------------------------------------------
 * CAZADOR — el enemigo.
 *
 * Lo contrario de Orbi a propósito: un solo ojo en vez de dos, ángulos en vez
 * de curvas, rojo en vez de cian y púas que se abren cuando te ha visto.
 * ------------------------------------------------------------------------- */
export function createHunter({ radius: r = 0.7, type = 'tracker', tier = 0 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  let color = 0x37101f;
  let emissive = 0x8e1230;
  let spikeColor = 0xd83f5e;
  let auraColor = 0xff3b5c;

  if (type === 'stalker') {
    color = 0x100522;
    emissive = 0x4a128e;
    spikeColor = 0x983fd8;
    auraColor = 0xaa3bff;
  } else if (type === 'tank') {
    color = 0x1a0505;
    emissive = 0x400202;
    spikeColor = 0xaa1111;
    auraColor = 0xff1111;
  } else if (type === 'boss') {
    color = 0x050505;
    emissive = 0xff0000;
    spikeColor = 0xffffff;
    auraColor = 0xff0055;
  } else if (type === 'turret') {
    color = 0x222222;
    emissive = 0xffaa00;
    spikeColor = 0xffaa00;
    auraColor = 0xffee00;
  }

  const hullMat = once(`hunterHull_${type}_${tier}`, () => new THREE.MeshStandardMaterial({
    color: tier >= 2 ? 0x050505 : color,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: 0.55 + tier * 0.2,
    roughness: tier >= 2 ? 0.2 : 0.55,
    metalness: tier >= 2 ? 0.8 : 0.35,
    flatShading: true,
  }));
  
  let hullGeo;
  if (type === 'stalker') hullGeo = once('stalkerGeo', () => new THREE.CylinderGeometry(r * 0.9, r * 0.8, r * 0.4, 8));
  else if (type === 'tank') hullGeo = once('tankGeo', () => new THREE.BoxGeometry(r * 1.2, r * 1.2, r * 1.2));
  else if (type === 'boss') hullGeo = once('bossGeo', () => new THREE.DodecahedronGeometry(r * 1.1, 0));
  else if (type === 'turret') hullGeo = once('turretGeo', () => new THREE.ConeGeometry(r * 0.9, r * 2, 4));
  else hullGeo = once('trackerGeo', () => new THREE.IcosahedronGeometry(r * 0.78, 1)); // tracker
  
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.castShadow = true;
  body.add(hull);

  // Chasis Cibernético Hostil (Wireframe)
  const wireMat = new THREE.LineBasicMaterial({ color: spikeColor, transparent: true, opacity: 0.5 });
  const wireGeo = new THREE.WireframeGeometry(hullGeo);
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  wireframe.scale.setScalar(1.05); // Sobresale para parecer una jaula de picos
  hull.add(wireframe);

  // Armas/Apéndices según tipo
  const spikes = new THREE.Group();
  
  if (type === 'tracker') {
    // Anillo de sierras
    const sawGeo = once('trackerSawGeo', () => new THREE.TorusGeometry(r * 0.9, r * 0.05, 4, 16));
    const sawMat = once('trackerSawMat', () => new THREE.MeshStandardMaterial({ color: 0xaa2244, metalness: 0.9, roughness: 0.1 }));
    for (let i = 0; i < 2; i++) {
      const saw = new THREE.Mesh(sawGeo, sawMat);
      saw.rotation.x = i === 0 ? Math.PI/2 : 0;
      spikes.add(saw);
    }
  } else if (type === 'tank') {
    // Escudos pesados orbitantes
    const shieldGeo = once('tankShieldGeo', () => new THREE.BoxGeometry(r * 0.6, r * 0.6, r * 0.2));
    const shieldMat = once('tankShieldMat', () => new THREE.MeshStandardMaterial({ color: 0x220505, metalness: 0.8, roughness: 0.5 }));
    for (let i = 0; i < 6; i++) {
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      const theta = (i / 6) * TAU;
      shield.position.set(Math.cos(theta) * r * 1.1, 0, Math.sin(theta) * r * 1.1);
      shield.lookAt(0, 0, 0);
      spikes.add(shield);
    }
  } else if (type === 'stalker') {
    // Aletas aerodinámicas cortantes
    const finGeo = once('stalkerFinGeo', () => new THREE.ConeGeometry(r * 0.2, r * 1.2, 3));
    const finMat = once('stalkerFinMat', () => new THREE.MeshStandardMaterial({ color: 0x551188, metalness: 0.6 }));
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeo, finMat);
      const theta = (i / 4) * TAU;
      fin.position.set(Math.cos(theta) * r * 0.8, 0, Math.sin(theta) * r * 0.8);
      fin.rotation.z = Math.PI / 2;
      fin.rotation.y = -theta;
      spikes.add(fin);
    }
  } else if (type === 'boss') {
    // Escudos orbitales dobles (Centinela)
    const ringGeo = once('bossRingGeo', () => new THREE.TorusGeometry(r * 1.5, r * 0.1, 4, 32));
    const ringMat = once('bossRingMat', () => new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = i === 0 ? Math.PI/2 : 0;
      spikes.add(ring);
    }
  } else if (type === 'turret') {
    // Cañón láser que apunta
    const gunGeo = once('turretGunGeo', () => new THREE.CylinderGeometry(r * 0.1, r * 0.2, r * 1.5, 8));
    const gunMat = once('turretGunMat', () => new THREE.MeshStandardMaterial({ color: 0x333333 }));
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.z = r;
    gun.rotation.x = Math.PI / 2;
    spikes.add(gun);
  }
  
  body.add(spikes);

  // Ojos (Stalker tiene múltiples ojos pequeños, los demás 1 gigante)
  const eye = new THREE.Group();
  eye.position.z = type === 'stalker' ? r * 0.4 : r * 0.58;
  body.add(eye);

  const scleraGeo = once(`hunterEyeGeo_${type}`, () => new THREE.SphereGeometry(type === 'stalker' ? r * 0.15 : r * 0.44, 18, 14));
  const scleraMat = once(`hunterEyeMat_${type}`, () => new THREE.MeshStandardMaterial({
    color: 0xffe4e9, emissive: 0x552028, emissiveIntensity: 0.5, roughness: 0.25,
  }));
  const irisGeo = once(`hunterIrisGeo_${type}`, () => new THREE.SphereGeometry(type === 'stalker' ? r * 0.08 : r * 0.25, 16, 12));
  
  const irisBaseColor = type === 'stalker' ? 0xff2dcf : 0xff2d55;
  const irisFinalColor = tier >= 3 ? 0xff0000 : irisBaseColor;
  const irisMat = once(`hunterIrisMat_${type}_${tier}`, () => new THREE.MeshStandardMaterial({
    color: 0x120308, emissive: new THREE.Color(irisFinalColor), emissiveIntensity: 0.8 + tier * 0.5, roughness: 0.2,
  }));

  const numEyes = type === 'stalker' ? 3 : 1;
  const irises = [];
  
  for(let i=0; i < numEyes; i++) {
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.z = type === 'stalker' ? r * 0.1 : r * 0.28;
    iris.scale.set(1, 1, 0.6);
    sclera.add(iris);
    
    if (type === 'stalker') {
      const offsetX = (i - 1) * 0.4 * r;
      sclera.position.set(offsetX, 0, Math.abs(offsetX) * -0.2);
    }
    eye.add(sclera);
    irises.push(iris);
  }

  // Aura: delata a distancia que eso te está buscando.
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: auraColor,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  aura.scale.setScalar(r * (type === 'tank' ? 3.0 : 2.5));
  body.add(aura);

  /* --------------------------- the tell ---------------------------------
   * ADR-010 guarantees at least 0.45 s of warning before anything that can hurt
   * Lúmen. Until this spec that guarantee existed only in the simulation: the
   * model about to attack looked exactly like the model that was not, so the
   * warning was real and invisible. Three pieces make it visible, and they are
   * driven by `s.fsm.progress` running 0 → 1 across the wind-up:
   *
   *   charge  a glow that swells inside the hull
   *   ring    a flat ring on the ground that closes as the attack approaches
   *   aim     a line towards the target, for the archetypes that shoot
   * ------------------------------------------------------------------- */

  const tellColor = type === 'boss' ? 0xff0033 : type === 'turret' ? 0xffaa00 : 0xffdd55;

  const charge = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: tellColor, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  charge.scale.setScalar(r * 2);
  body.add(charge);

  // A closing ring reads as a countdown without a number on screen: the player
  // learns "when it touches the middle, move" in one encounter.
  const ring = new THREE.Mesh(
    once('tellRingGeo', () => new THREE.RingGeometry(0.82, 1, 40)),
    new THREE.MeshBasicMaterial({
      color: tellColor, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -r * 0.9;
  group.add(ring);

  // Only the archetypes that fire down a line get a line.
  let aimLine = null;
  if (type === 'turret' || type === 'boss') {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 40),
    ]);
    aimLine = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: tellColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    }));
    body.add(aimLine);
  }

  const TELLING = new Set(['lunge_wind', 'wind', 'leap_wind', 'aim', 'slam_wind', 'volley_wind', 'roar']);
  // While airborne on a leap or a slam, the ring stops being a countdown and
  // becomes a footprint: it shows the exact radius the shockwave will cover
  // (REQ-025.21). The player needs to know where it is *safe*, not merely that
  // something is coming.
  const IMPACTING = new Set(['leap', 'slam']);
  const SHOCK_RADIUS = type === 'boss' ? 9 : 6.5;

  const phase = Math.random() * TAU;
  let t = 0;
  let aggro = 0;
  let tell = 0;

  return {
    group,

    update(dt, s = {}) {
      t += dt;
      const speed = s.speed ?? 0;
      const dist = s.threat ?? Infinity;      // distancia al jugador
      const aggroRange = type === 'stalker' ? 10 : type === 'tank' ? 25 : 16;
      aggro = damp(aggro, dist < aggroRange ? 1 : 0, 3, dt);

      /* ------------------------------ tell ------------------------------ */

      const fsm = s.fsm;
      const telling = !!fsm && TELLING.has(fsm.state);
      const progress = telling ? clamp(fsm.progress ?? 0, 0, 1) : 0;
      // Rises fast, falls fast: a tell that lingers after the attack has landed
      // is worse than none, because it stops meaning "now".
      tell = damp(tell, telling ? 1 : 0, telling ? 22 : 14, dt);

      const flash = telling ? 0.55 + Math.sin(t * (14 + progress * 30)) * 0.45 : 0;

      charge.material.opacity = tell * (0.35 + flash * 0.45);
      charge.scale.setScalar(r * (1.6 + progress * 2.4 + flash * 0.3));

      const impacting = !!fsm && IMPACTING.has(fsm.state) && (type === 'tank' || type === 'boss');
      if (impacting) {
        // True radius, held steady and pulsing, so it reads as a hazard area
        // rather than as a countdown.
        ring.material.opacity = 0.55 + Math.sin(t * 18) * 0.2;
        ring.scale.setScalar(SHOCK_RADIUS);
        ring.rotation.z += dt * 2.4;
      } else {
        ring.material.opacity = tell * 0.75;
        // Closes from wide to tight: the moment it reaches the body, it lands.
        ring.scale.setScalar(Math.max(0.001, r * (6.5 - progress * 4.6)));
        ring.rotation.z += dt * (0.8 + progress * 5);
      }

      if (aimLine) {
        aimLine.material.opacity = tell * (0.12 + progress * 0.5);
        aimLine.scale.z = 0.4 + progress * 0.6;
      }

      // Stunned by an Impulso: everything sags and the tell goes out, so the
      // window the stun bought is unmistakable.
      if (s.stunned) {
        tell = 0;
        charge.material.opacity = 0;
        ring.material.opacity = 0;
        if (aimLine) aimLine.material.opacity = 0;
      }

      // Flota y cabecea; cuanto más cerca está de ti, más nervioso.
      const nerves = clamp(1 - dist / (aggroRange * 0.6), 0, 1);
      const bobFreq = type === 'stalker' ? 4.0 : type === 'tank' ? 1.2 : 2.4;
      body.position.y = Math.sin(t * bobFreq + phase) * 0.09 + nerves * Math.sin(t * 30) * 0.03;
      body.rotation.x = clamp(speed * 0.03, 0, 0.35) + Math.sin(t * 1.9 + phase) * 0.05;
      body.rotation.z = Math.sin(t * 1.3 + phase) * 0.08 + nerves * Math.cos(t * 27) * 0.04;

      // El casco gira lento: da sensación de máquina, no de pelota.
      hull.rotation.y += dt * (0.4 + speed * 0.12);
      spikes.rotation.y -= dt * (0.25 + speed * 0.1);
      spikes.scale.setScalar(0.75 + aggro * 0.45 + nerves * 0.15);

      // El ojo te mira: dos ángulos a partir de la dirección local al jugador.
      eye.rotation.y = damp(eye.rotation.y, clamp(s.lookX ?? 0, -1, 1) * 0.8, 10, dt);
      eye.rotation.x = damp(eye.rotation.x, -clamp(s.lookY ?? 0, -1, 1) * 0.6, 10, dt);
      for (const ir of irises) {
        ir.scale.setScalar(1 - nerves * 0.25); // pupila que se cierra al acercarse
      }

      // The aura breathes with the music (REQ-025.13). Bounded and additive: it
      // must never be loud enough to compete with the tell.
      const pulse = s.beat?.pulse ?? 0;
      aura.material.opacity = 0.1 + aggro * 0.2 + Math.sin(t * 6 + phase) * 0.05
        + pulse * 0.06 * aggro + tell * 0.25;
      aura.scale.setScalar(r * (type === 'tank' ? 3.0 : 2.5) + aggro * 0.6 + tell * 0.8);

      if (s.stunned) {
        body.rotation.z += Math.sin(t * 24) * 0.06;
        body.position.y -= 0.12;
      }
    },
  };
}

/* ---------------------------------------------------------------------------
 * ORBE — el coleccionable.
 *
 * Un cristal dentro de una jaula giroscópica. Se ve desde lejos gracias al
 * halo, que es lo que hace que apetezca ir a por él.
 * ------------------------------------------------------------------------- */
/**
 * Fragmento de Estrella.
 *
 * `tier` decides how loud it is. A `risk` Fragmento is worth three times a
 * `path` one and is always somewhere that costs something to reach, so it has to
 * announce itself from far enough away that the player can decide *before*
 * committing to the detour: violet instead of amber, a taller light pillar and a
 * faster spin. Readability at distance is the whole design of this object.
 */
export function createOrbGem({ radius: r = 0.55, tier = 'path' } = {}) {
  const group = new THREE.Group();
  const risky = tier === 'risk';
  const coreColor = risky ? 0xe9c4ff : 0xffe6a3;
  const glowColor = risky ? 0xb14dff : 0xffc861;
  const emissive = risky ? 0x9b30ff : 0xffb020;

  const gem = new THREE.Mesh(
    once(`orbGemGeo_${tier}`, () => new THREE.OctahedronGeometry(r * 0.95, 0)),
    once(`orbGemMat_${tier}`, () => new THREE.MeshStandardMaterial({
      color: coreColor,
      emissive: new THREE.Color(emissive),
      emissiveIntensity: risky ? 1.1 : 0.8,
      roughness: 0.2,
      metalness: 0.3,
      flatShading: true,
    })),
  );
  gem.castShadow = true;
  group.add(gem);

  // Jaula: dos aros cruzados que giran en sentidos distintos.
  const ringGeo = once(`orbRingGeo_${tier}`, () => new THREE.TorusGeometry(r * 1.15, r * 0.06, 8, 28));
  const ringMat = once(`orbRingMat_${tier}`, () => new THREE.MeshStandardMaterial({
    color: risky ? 0xf0dcff : 0xfff1cf,
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: 0.6,
    metalness: 1,
    roughness: 0.25,
  }));
  const ringA = new THREE.Mesh(ringGeo, ringMat);
  const ringB = new THREE.Mesh(ringGeo, ringMat);
  ringB.rotation.y = Math.PI / 2;
  group.add(ringA, ringB);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: glowColor,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  halo.scale.setScalar(r * 2.8);
  group.add(halo);

  // A thin beam towards the sky: this is what makes a Fragmento visible over a
  // ledge you cannot see past. Risk Fragmentos throw it higher on purpose.
  const pillar = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: glowColor,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  pillar.scale.set(r * 0.6, r * (risky ? 46 : 30), 1);
  pillar.position.y = r * 10;
  group.add(pillar);

  const phase = Math.random() * TAU;
  let t = 0;

  return {
    group,

    update(dt) {
      t += dt;
      const rush = risky ? 1.8 : 1;
      gem.rotation.y += dt * 1.4 * rush;
      gem.rotation.x += dt * 0.5 * rush;
      ringA.rotation.z += dt * 0.9 * rush;
      ringB.rotation.x -= dt * 1.1 * rush;
      const pulse = Math.sin(t * (risky ? 4.4 : 2.6) + phase);
      halo.scale.setScalar(r * (2.8 + pulse * 0.3) * (risky ? 1.3 : 1));
      halo.material.opacity = 0.18 + pulse * 0.08;

      pillar.material.opacity = (risky ? 0.22 : 0.15) + pulse * 0.05;
    },
  };
}

/* ---------------------------------------------------------------------------
 * POWER-UP — Item temporal (shield, magnet, jump).
 * ------------------------------------------------------------------------- */
export function createPowerupIcon({ radius: r = 0.5, type = 'shield' } = {}) {
  const group = new THREE.Group();

  let color = 0x00ffff; // shield
  if (type === 'magnet') color = 0xff00ff;
  if (type === 'jump') color = 0x00ff00;

  const geo = once(`powerupGeo_${type}`, () => {
    if (type === 'magnet') return new THREE.TorusGeometry(r * 0.8, r * 0.25, 8, 16, Math.PI * 1.5);
    if (type === 'jump') return new THREE.ConeGeometry(r * 0.7, r * 1.4, 4);
    return new THREE.DodecahedronGeometry(r * 0.8, 0); // shield
  });

  const mat = once(`powerupMat_${type}`, () => new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.8,
    flatShading: true,
  }));

  const icon = new THREE.Mesh(geo, mat);
  icon.castShadow = true;
  group.add(icon);

  // Halo exterior
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: color,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  halo.scale.setScalar(r * 2.5);
  group.add(halo);

  // Pilar de luz holográfico
  const pillar = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: color,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  pillar.scale.set(r * 0.5, r * 40, 1);
  pillar.position.y = r * 15;
  group.add(pillar);

  const phase = Math.random() * TAU;
  let t = 0;

  return {
    group,
    update(dt) {
      t += dt;
      icon.rotation.y -= dt * 2.0;
      icon.rotation.z += dt * 1.0;
      icon.position.y = Math.sin(t * 3.5 + phase) * 0.15;
      
      const pulse = Math.sin(t * 5.0 + phase);
      halo.scale.setScalar(r * (2.2 + pulse * 0.3));
      halo.material.opacity = 0.2 + pulse * 0.1;
      pillar.material.opacity = 0.1 + pulse * 0.05;
    },
  };
}

/**
 * ALIADO — Dron acompañante
 * Flota al lado del jugador y dispara láseres defensivos.
 */
export function createDrone({ radius: r = 0.3 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x99ccff,
    emissive: 0x0088ff,
    emissiveIntensity: 0.8,
    metalness: 0.9,
    roughness: 0.2,
    flatShading: true,
  });
  
  const geo = new THREE.OctahedronGeometry(r, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  body.add(mesh);

  const ringGeo = new THREE.TorusGeometry(r * 1.5, r * 0.1, 4, 16);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x00ffff, emissiveIntensity: 1.0,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  body.add(ring);

  const phase = Math.random() * TAU;
  let t = 0;
  
  return {
    group,
    update(dt, s = {}) {
      t += dt;
      mesh.rotation.y += dt * 2.0;
      mesh.rotation.x = Math.sin(t * 3.0) * 0.2;
      ring.rotation.z -= dt * 1.5;
      
      body.position.y = Math.sin(t * 4.0 + phase) * 0.2;
    }
  };
}

/**
 * ENEMIGO — Interceptor
 * Muy rápido, ataca en línea recta en lugar de perseguir lentamente.
 */
export function createInterceptor({ radius: r = 0.5 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // Forma de flecha (tetraedro apuntando hacia adelante)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x220505,
    metalness: 0.8,
    roughness: 0.3,
    flatShading: true,
  });
  const geo = new THREE.TetrahedronGeometry(r * 1.2, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 4;
  mesh.rotation.z = Math.PI / 4;
  mesh.castShadow = true;
  body.add(mesh);

  // Ojo rojo central
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.3, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffaaaa, emissive: 0xffaa00, emissiveIntensity: 1.0 })
  );
  eye.position.set(0, 0, r * 0.6);
  body.add(eye);

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0xff8800,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  aura.scale.setScalar(r * 2.5);
  body.add(aura);

  const phase = Math.random() * TAU;
  let t = 0;

  return {
    group,
    update(dt, s = {}) {
      t += dt;
      // Gira sobre su eje longitudinal al atacar
      const speed = s.speed ?? 0;
      mesh.rotation.y += dt * (1.0 + speed * 2.0);
      body.position.y = Math.sin(t * 6.0 + phase) * 0.1;
      
      const pulse = Math.sin(t * 8.0);
      aura.scale.setScalar(r * (2.5 + pulse * 0.2));
      aura.material.opacity = 0.15 + pulse * 0.05;
    }
  };
}

/* ---------------------------------------------------------------------------
 * PROYECTIL — the bolt a Centinela fires.
 *
 * Small, bright, and trailed by a stretched sprite so its direction of travel is
 * readable at a glance. A projectile you cannot read the heading of is a
 * projectile you cannot dodge, which would put it straight through the fairness
 * floor the enemy design is built on.
 * ------------------------------------------------------------------------- */
export function createProjectile({ radius: r = 0.28 } = {}) {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    once('boltGeo', () => new THREE.IcosahedronGeometry(r, 0)),
    once('boltMat', () => new THREE.MeshStandardMaterial({
      color: 0xffd9e2,
      emissive: new THREE.Color(0xff2a6d),
      emissiveIntensity: 1.4,
      roughness: 0.2,
      flatShading: true,
    })),
  );
  group.add(core);

  const trail = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0xff2a6d,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  trail.scale.set(r * 2.2, r * 7, 1);
  group.add(trail);

  let t = 0;

  return {
    group,
    update(dt) {
      t += dt;
      core.rotation.x += dt * 9;
      core.rotation.y += dt * 7;
      trail.material.opacity = 0.4 + Math.sin(t * 26) * 0.12;
    },
  };
}

/* ---------------------------------------------------------------------------
 * BALIZA DE REANCLAJE — the checkpoint.
 *
 * Dormant it is a slow, cold ring; the moment Lúmen anchors to it the ring locks
 * upright and turns to the player's own colour. The state change has to be
 * unmistakable from a distance, because the whole value of a checkpoint is
 * knowing you already have it.
 * ------------------------------------------------------------------------- */
export function createBeacon({ radius: r = 1.1 } = {}) {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    once('beaconRingGeo', () => new THREE.TorusGeometry(r, r * 0.09, 10, 36)),
    new THREE.MeshStandardMaterial({
      color: 0x9fd8ff,
      emissive: new THREE.Color(0x2a4b7c),
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.25,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const pillar = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0x6ee7ff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  pillar.scale.set(r * 1.4, r * 26, 1);
  pillar.position.y = r * 9;
  group.add(pillar);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0x6ee7ff,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  halo.scale.setScalar(r * 3);
  group.add(halo);

  let t = 0;
  let lit = 0;

  return {
    group,

    react(kind) {
      if (kind === 'anchor') lit = 1;
    },

    update(dt, s = {}) {
      t += dt;
      if (s.reached) lit = Math.min(1, lit + dt * 3);

      const pulse = Math.sin(t * (1.4 + lit * 3.2));
      ring.rotation.z += dt * (0.4 + lit * 2.2);
      ring.material.emissiveIntensity = 0.5 + lit * 2.2 + pulse * 0.3;
      ring.material.color.setHex(lit > 0.5 ? 0x6ee7ff : 0x9fd8ff);
      ring.scale.setScalar(1 + lit * 0.25 + pulse * 0.03);

      pillar.material.opacity = lit * (0.28 + pulse * 0.06);
      halo.material.opacity = 0.1 + lit * 0.25 + pulse * 0.04;
      halo.scale.setScalar(r * (3 + lit * 1.2 + pulse * 0.2));
    },
  };
}
