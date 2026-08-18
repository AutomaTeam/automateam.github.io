// JS partagé — pages statiques sous /poke/. Année du footer + halo des cartes au survol.
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.card-hover').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}
