/**
 * Todos los números que se pueden tocar sin abrir el código del motor.
 * Cambiar el "feel" del juego debería ser editar este archivo, nada más.
 */
export const CONFIG = {
  world: {
    gravity: -20,
    arenaSize: 40,     // lado del suelo cuadrado
    wallHeight: 3,
  },
  audio: {
    muted: false,
  },
  graphics: {
    lowQuality: false,
  },
  player: {
    speed: 9,
    airControl: 0.75,  // 0 = sin control en el aire, 1 = igual que en suelo
    jump: 12.5,
    radius: 0.6,
    lives: 3,
    respawnInvuln: 1.5, // segundos de invulnerabilidad tras recibir daño
    startGrace: 3,      // margen de cortesía al empezar un nivel
    color: 0x6ee7ff,    // Cyan por defecto
  },
  camera: {
    distance: 6.8,   // más cerca: el protagonista se lee
    height: 2.9,
    sensitivity: 0.0022,
    pitchMin: -0.5,
    pitchMax: 1.1,
    smooth: 12,        // mayor = cámara más pegada al jugador
    fov: 62,
  },
  enemy: {
    speed: 4.5,
    radius: 0.7,
    aggroRange: 24,    // fuera de este radio patrullan en vez de perseguir
  },
  pickup: {
    radius: 0.55,
    spin: 2.2,
  },
  // Progresión Infinita:
  level: (n) => ({
    orbs: 5 + Math.floor(n * 2.5),
    // Exponencial con límite asintótico para enemigos para no saturar memoria
    enemies: Math.min(Math.floor(2 + Math.pow(n, 1.2)), 30), 
    platforms: 4 + Math.floor(n * 2.5),
    // Velocidad asintótica máxima (empieza en 4.5, cap en ~18)
    enemySpeed: CONFIG.enemy.speed + (12 * (1 - Math.exp(-n * 0.1))), 
    arenaScale: Math.min(1 + (n * 0.08), 2.5), // La arena crece hasta un 250%
  }),
};
