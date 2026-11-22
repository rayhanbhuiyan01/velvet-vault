// A small seeded random generator (xorshift32): the same seed gives the same
// game, which is what makes the screenshot scenes repeatable from run to run.

export function createRandom(seed) {
  let state = (seed | 0) || 0x9e3779b9;
  return function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/** Pick an integer in [min, max) from the seeded stream. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}
