'use strict';
// Gears and splines: helpers for the gear tools in tools.js (drawings are in
// diagrams-eng.js).

// Module in the current length unit from the pitch field: inch mode takes a
// diametral pitch P (teeth per inch of pitch diameter), so m = 1 / P inch.
function gearMod(mp, sys) { return sys === 'inch' ? (mp > 0 ? 1 / mp : NaN) : mp; }
