export function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `${name}View`));
  document.querySelectorAll('.nav-item[data-view]').forEach((n) => n.classList.toggle('active', n.dataset.view === name));
}
