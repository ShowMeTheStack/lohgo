// Screen sizes up to 900 wide: phones, landscape phones and small tablets.
import { registerMatrix, SIZES } from './50-matrix-lib.mjs';

export default function (t) {
  registerMatrix(t, SIZES.filter(([w]) => w <= 900));
}
