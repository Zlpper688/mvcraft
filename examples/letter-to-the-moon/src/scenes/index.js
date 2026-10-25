import { createPrologue } from './prologue.js';
import { createSeaNight } from './seaNight.js';
import { createFish } from './fish.js';
import { createStairs } from './stairs.js';
import { createThreads } from './threads.js';
import { createDrop } from './drop.js';
import { createMirror } from './mirror.js';
import { createRain } from './rain.js';
import { createCity } from './city.js';
import { createDescent } from './descent.js';
import { createMoongate } from './moongate.js';
import { createStarsea } from './starsea.js';
import { createSeaDawn } from './seaDawn.js';
import { createEnd } from './end.js';

export const SCENE_BUILDERS = {
  prologue: createPrologue,
  seaNight: createSeaNight,
  fish: createFish,
  stairs: createStairs,
  threads: createThreads,
  drop: createDrop,
  mirror: createMirror,
  rain: createRain,
  city: createCity,
  descent: createDescent,
  moongate: createMoongate,
  starsea: createStarsea,
  seaDawn: createSeaDawn,
  end: createEnd
};
