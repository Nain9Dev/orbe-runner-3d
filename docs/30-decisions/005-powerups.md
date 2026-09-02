# ADR 005: Sistema de Buffs (Power-Ups) Temporales

**Estado:** Aprobado
**Fecha:** 2026-09-02

## Contexto
El juego necesita mayor variabilidad. Introducir ítems temporales (Power-Ups) que alteran la jugabilidad.
Los sistemas en ECS deben ser inmutables en su lógica base, por lo que añadir estados temporales (como invulnerabilidad o súper saltos) al jugador requiere un manejo limpio de estado.

## Decisión
1. Los Power-Ups son entidades con el componente `pickup` (como los orbes) pero con un tag `powerup` para diferenciarlos en `triggers.ts`.
2. Al recoger un Power-Up, se emitirá un evento `powerup:collected` con su tipo (`shield`, `magnet`, `jump`).
3. El `gameSystem` escuchará este evento y mutará un componente temporal en el jugador: `player.buff = { type, timeleft }`.
4. Habrá un nuevo sistema `powerupsSystem` encargado exclusivamente de reducir `timeleft` cada frame, eliminar el buff cuando llegue a 0, y ejecutar la lógica de los buffs activos (por ejemplo, el imán atrae los orbes).
5. Las modificaciones de físicas (ej: Super Salto) o inmunidad (ej: Escudo) se interceptarán en los sistemas correspondientes (`playerSystem` para saltos, `gameSystem` para el daño), verificando si `player.buff` existe y coincide con el tipo esperado.

## Consecuencias
- **Positivas:** Los buffs temporales quedan confinados a un único estado `buff`. Si un sistema se encarga de reducir el tiempo, no dispersamos `timeleft -= dt` por todo el código.
- **Negativas:** El jugador solo podrá tener un buff activo a la vez (por diseño, el nuevo buff sobreescribe al anterior). Esto es intencional para evitar balanceos complejos y saturación visual.
