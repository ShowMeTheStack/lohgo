// Screen sizes wider than 900: tablets in landscape, laptops and desktops.
import { registerMatrix, SIZES } from './50-matrix-lib.mjs';

export default function (t) {
  registerMatrix(t, SIZES.filter(([w]) => w > 900));
}
