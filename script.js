// Знаходимо бургер-кнопку та навігацію
const burger = document.querySelector('.burger');
const nav = document.querySelector('.nav');

// При натисканні на бургер відкриваємо/закриваємо меню
burger.addEventListener('click', () => {
  nav.classList.toggle('open');
});
