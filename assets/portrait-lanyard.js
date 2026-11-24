/* Three.js adaptation of the supplied React Bits Lanyard component.
 * Uses the portfolio's existing portrait, local fonts and bilingual back face.
 */
const container = document.querySelector('[data-portrait-lanyard]');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const badge = container?.querySelector('.portrait-badge');
let scene;
let version = 0;

function updateFace(flipped) {
  badge.setAttribute('aria-pressed', String(flipped));
  badge.querySelector('.portrait-badge-front').setAttribute('aria-hidden', String(flipped));
  badge.querySelector('.portrait-badge-back').setAttribute('aria-hidden', String(!flipped));
}

async function enhance() {
  const token = ++version;
  scene?.dispose();
  scene = null;
  container.dataset.renderer = 'dom';
  if (motion.matches) return;
  try {
    const [{ createLanyard }, THREE] = await Promise.all([
      import('./vendor/lanyard-scene.js'),
      import('./vendor/three-0.170.0.module.min.js')
    ]);
    await document.fonts.ready;
    if (token !== version) return;
    const created = await createLanyard(THREE, container, {
      onFlip: updateFace,
      onFailure: () => { ++version; scene?.dispose(); scene = null; container.dataset.renderer = 'dom'; }
    });
    if (token !== version) { created.dispose(); return; }
    scene = created;
    container.dataset.renderer = 'webgl';
    if (badge.getAttribute('aria-pressed') === 'true') scene.flip();
  } catch {
    if (token === version) container.dataset.renderer = 'dom';
  }
}

if (container && badge) {
  container.classList.add('is-lanyard-ready');
  badge.disabled = false;
  badge.addEventListener('click', () => {
    if (scene) scene.flip();
    else updateFace(badge.getAttribute('aria-pressed') !== 'true');
  });
  badge.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { scene?.reset(); updateFace(false); }
    else scene?.nudge(event.key === 'ArrowLeft' ? -1 : 1);
  });
  motion.addEventListener('change', enhance);
  void enhance();
}
