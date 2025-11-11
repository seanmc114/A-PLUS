<script>
/* Unlock targets patch — non-destructive */
(function () {
  // A2 = 240s; then each next level −20s
  const PATCH = {
    A2: 240,
    "Level 3": 220,
    B1: 200,
    B2: 180,
    "Level 6": 160,
    C1: 140,
    C2: 120,
    "Final Boss": 100
  };

  // If your game uses a global targets object, merge into it:
  if (window.UNLOCK_TARGETS && typeof window.UNLOCK_TARGETS === "object") {
    Object.assign(window.UNLOCK_TARGETS, PATCH);
    console.log("[Turbo] UNLOCK_TARGETS patched", window.UNLOCK_TARGETS);
  }

  // If your game reads from localStorage, update common keys safely:
  try {
    const keys = ["unlockTargets", "targets", "thresholds"];
    for (const k of keys) {
      const curr = JSON.parse(localStorage.getItem(k) || "{}");
      const hasAny = ["A2","Level 3","B1","B2","Level 6","C1","C2","Final Boss"].some(x => x in curr);
      if (hasAny) {
        localStorage.setItem(k, JSON.stringify({ ...curr, ...PATCH }));
      }
    }
    // Always keep a canonical copy:
    const base = JSON.parse(localStorage.getItem("unlockTargets") || "{}");
    localStorage.setItem("unlockTargets", JSON.stringify({ ...base, ...PATCH }));
  } catch (e) {
    console.warn("[Turbo] Could not update localStorage", e);
  }
})();
</script>
