(() => {
  const button = document.querySelector('.mobile-app-menu-button');
  const menu = document.getElementById('mobile-app-menu');
  if (!button || !menu) return;

  // Keep the dropdown outside header containers. Style 2 intentionally clips
  // parts of its compact header, so a header child can be fully hidden even
  // though aria-expanded changes correctly.
  if (menu.parentElement !== document.body) document.body.appendChild(menu);

  const place = () => {
    const rect = button.getBoundingClientRect();
    const right = Math.max(10, window.innerWidth - rect.right);
    menu.style.position = 'fixed';
    menu.style.top = `${Math.round(rect.bottom + 8)}px`;
    menu.style.right = `${Math.round(right)}px`;
  };

  const close = () => {
    button.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  };

  const open = () => {
    place();
    button.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
  };

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.getAttribute('aria-expanded') === 'true') close();
    else open();
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });

  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 761px)').matches) close();
    else if (!menu.hidden) place();
  });

  window.addEventListener('scroll', () => {
    if (!menu.hidden) place();
  }, { passive: true });
})();
