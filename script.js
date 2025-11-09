// Turbo: A+ Edition — unlock targets only (as requested)

// A2 (level 2) unlocks at 240 seconds.
// Each subsequent level reduces by 20 seconds.
window.UNLOCK_TARGETS = {
  A2: 240,          // Level 2
  "Level 3": 220,   // -20
  B1: 200,          // -20
  B2: 180,          // -20
  "Level 6": 160,   // -20
  C1: 140,          // -20
  C2: 120,          // -20
  "Final Boss": 100 // -20
};

// Optional: if your code reads from localStorage instead of a global,
// uncomment the line below to persist these targets.
// localStorage.setItem('unlockTargets', JSON.stringify(window.UNLOCK_TARGETS));

console.log("Turbo: A+ Edition ready — unlock targets set:", window.UNLOCK_TARGETS);
