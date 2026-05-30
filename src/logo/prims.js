// Primitive groups register themselves here and are installed into each interpreter.
(function (LG) {
  'use strict';
  const groups = [];
  LG.Prims = {
    groups,
    add(name, fn) { groups.push({ name, fn }); },
    install(interp) { for (const g of groups) g.fn(interp, g.name); },
  };
})(LG);
