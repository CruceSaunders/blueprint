// All of the page's behaviour, as one small inline script (no framework runtime is shipped; see scripts/strip-runtime.mjs).
// 1. Sets data-in on [data-reveal], [data-play] and [data-draw] once they scroll into view; CSS animates the rest.
const js = `(function(){
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.setAttribute('data-in','');io.unobserve(e.target)}})},{rootMargin:'0px 0px -12% 0px',threshold:0.15});
document.querySelectorAll('[data-reveal],[data-play],[data-draw]').forEach(function(el){io.observe(el)});
})();`;

export function Behaviour() {
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
