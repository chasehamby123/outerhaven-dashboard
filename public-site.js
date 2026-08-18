(function(){
  const nav=document.querySelector('.siteNav');
  const menu=document.getElementById('mobileMenuBtn');

  menu?.addEventListener('click',()=>nav?.classList.toggle('mobileOpen'));
  document.querySelectorAll('.siteNavLinks a').forEach(a=>a.addEventListener('click',()=>nav?.classList.remove('mobileOpen')));

  const observer=new IntersectionObserver(entries=>entries.forEach(x=>{
    if(x.isIntersecting)x.target.classList.add('visible');
  }),{threshold:.12});
  document.querySelectorAll('.fadeUp').forEach(el=>observer.observe(el));
})();
