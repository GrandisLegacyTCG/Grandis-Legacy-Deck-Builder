(() => {
  const button = document.querySelector('.mobile-app-menu-button');
  const menu = document.getElementById('mobile-app-menu');
  if (!button || !menu) return;

  const close = () => {
    button.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    menu.hidden = open;
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });

  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) close();
  });

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 761px)').matches) close();
  });
})();
