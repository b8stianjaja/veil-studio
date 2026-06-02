export function initTabletWobbleFix() {
  let penDownPos = { x: 0, y: 0 };
  let isPenDown = false;

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'pen') {
      isPenDown = true;
      penDownPos = { x: e.clientX, y: e.clientY };
    }
  }, { capture: true });

  window.addEventListener('pointerup', (e) => {
    if (isPenDown && e.pointerType === 'pen') {
      const dx = Math.abs(e.clientX - penDownPos.x);
      const dy = Math.abs(e.clientY - penDownPos.y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance >= 1 && distance <= 15) {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (target instanceof HTMLElement && !target.closest('.gsap-canvas')) {
          target.click();
        }
      }
    }
    isPenDown = false;
  }, { capture: true });
}