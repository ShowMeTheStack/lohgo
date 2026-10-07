// Try it on every reference example, part 1 of 3.
import { WITH_EXAMPLE, tryTests } from './60-ref-lib.mjs';

export default function (t) {
  const per = Math.ceil(WITH_EXAMPLE.length / 3);
  tryTests(t, WITH_EXAMPLE.slice(0 * per, 1 * per));
}
