// All of the page's behaviour, as one small inline script (no framework runtime is shipped; see scripts/strip-runtime.mjs).
// 1. Sets data-in on [data-reveal], [data-play] and [data-draw] once they scroll into view; CSS animates the rest.
// 2. The relationship-kind picker: press (or hover, on a mouse) a kind to show its line and meaning.
const js = `(function(){
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.setAttribute('data-in','');io.unobserve(e.target)}})},{rootMargin:'0px 0px -12% 0px',threshold:0.15});
document.querySelectorAll('[data-reveal],[data-play],[data-draw]').forEach(function(el){io.observe(el)});
var box=document.querySelector('[data-kinds]');if(!box)return;
var name=box.querySelector('[data-kind-name]'),reads=box.querySelector('[data-kind-reads]'),cur=null;
var meaning={};box.querySelectorAll('dl dt').forEach(function(dt){meaning[dt.textContent]=dt.nextElementSibling.textContent});
function pick(b){var k=b.getAttribute('data-kind');if(k===cur)return;cur=k;
box.querySelectorAll('[data-kind]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
box.querySelectorAll('[data-stage]').forEach(function(s){var on=s.getAttribute('data-stage')===k;s.hidden=!on;s.classList.remove('play');if(on){void s.getBoundingClientRect();s.classList.add('play')}});
name.textContent=k;reads.textContent=meaning[k]||''}
var first=box.querySelector('[aria-pressed=true]');if(first)cur=first.getAttribute('data-kind');
box.querySelectorAll('[data-kind]').forEach(function(b){b.addEventListener('click',function(){pick(b)});b.addEventListener('mouseenter',function(e){if(matchMedia('(hover: hover)').matches)pick(b)})});
})();`;

export function Behaviour() {
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
