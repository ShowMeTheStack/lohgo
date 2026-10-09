// Every program in the library categories school, science, shapes: opened from the library sheet, checked
// against its header and run with F5 (answering questions, pressing keys, clicking the world).
import { programTests } from './70-library-lib.mjs';

export default function (t) {
  programTests(t, ['school', 'science', 'shapes']);
}
