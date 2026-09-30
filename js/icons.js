// Ilustrações dos produtos em SVG (sem imagens externas).
// Para usar fotos reais, veja o README.
(function () {
  const s = 'stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  const A = 'fill="var(--ill-a)"'; // cor principal
  const B = 'fill="var(--ill-b)"'; // madeira
  const C = 'fill="var(--ill-c)"'; // metal
  const N = 'fill="none"';
  const icons = {
    drum: `<ellipse cx="60" cy="34" rx="34" ry="10" ${C} ${s}/><path d="M26 34v48c0 6 15 11 34 11s34-5 34-11V34" ${A} ${s}/><path d="M26 34l17 58M60 44l0 49M94 34L77 92M43 42l34 50M77 42L43 92" ${N} stroke="currentColor" stroke-width="2.5" opacity=".55"/><ellipse cx="60" cy="34" rx="34" ry="10" ${C} ${s}/><path d="M34 16l18 14M86 16L68 30" ${N} ${s}/>`,
    container: `<rect x="20" y="42" width="80" height="48" rx="8" ${C} ${s}/><rect x="16" y="30" width="88" height="14" rx="5" ${A} ${s}/><path d="M24 30l4-6h64l4 6" ${N} ${s}/><path d="M32 60h56" ${N} stroke="currentColor" stroke-width="2.5" opacity=".5"/>`,
    table: `<rect x="12" y="36" width="96" height="12" rx="2" ${B} ${s}/><path d="M22 48v46M98 48v46M34 48v30M86 48v30" ${N} ${s}/><path d="M22 70h76" ${N} ${s} opacity=".6"/>`,
    'table-plastic': `<path d="M14 38h92l-6 12H20z" ${A} ${s}/><path d="M26 50l-8 44M94 50l8 44M40 50l-4 30M80 50l4 30" ${N} ${s}/>`,
    bench: `<rect x="10" y="50" width="100" height="12" rx="2" ${B} ${s}/><path d="M20 62l-4 30M100 62l4 30M28 62v22M92 62v22" ${N} ${s}/><path d="M22 78h76" ${N} ${s} opacity=".6"/>`,
    pouf: `<ellipse cx="60" cy="46" rx="36" ry="12" ${A} ${s}/><path d="M24 46v30c0 7 16 12 36 12s36-5 36-12V46" ${A} ${s}/><path d="M24 58c0 7 16 12 36 12s36-5 36-12" ${N} stroke="currentColor" stroke-width="2.5" opacity=".5"/><circle cx="60" cy="46" r="3" fill="currentColor"/>`,
    'pouf-can': `<ellipse cx="60" cy="34" rx="28" ry="9" ${A} ${s}/><path d="M32 40v44c0 5 12 9 28 9s28-4 28-9V40" ${C} ${s}/><path d="M32 52c0 5 12 9 28 9s28-4 28-9M32 70c0 5 12 9 28 9s28-4 28-9" ${N} stroke="currentColor" stroke-width="2.5" opacity=".6"/><path d="M32 34v6c0 5 12 9 28 9s28-4 28-9v-6" ${A} ${s}/>`,
    'pouf-drum': `<ellipse cx="60" cy="28" rx="32" ry="10" ${B} ${s}/><path d="M28 34v52c0 6 14 10 32 10s32-4 32-10V34" ${A} ${s}/><path d="M28 50c0 6 14 10 32 10s32-4 32-10M28 72c0 6 14 10 32 10s32-4 32-10" ${N} ${s}/><path d="M28 28v6c0 6 14 10 32 10s32-4 32-10v-6" ${B} ${s}/>`,
    stool: `<ellipse cx="60" cy="54" rx="32" ry="8" ${B} ${s}/><path d="M36 60l-8 32M84 60l8 32M50 62l-2 30M70 62l2 30" ${N} ${s}/><path d="M32 80h56" ${N} ${s} opacity=".6"/>`,
    'stool-tall': `<ellipse cx="60" cy="22" rx="26" ry="7" ${B} ${s}/><path d="M42 28l-12 72M78 28l12 72M52 29l-4 70M68 29l4 70" ${N} ${s}/><path d="M36 72h48" ${N} ${s}/>`,
    chair: `<rect x="36" y="14" width="46" height="38" rx="4" ${B} ${s}/><path d="M44 24h30M44 34h30" ${N} stroke="currentColor" stroke-width="2.5" opacity=".6"/><path d="M30 58h60l-4-8H34z" ${B} ${s}/><path d="M36 58v40M84 58v40M82 52V14" ${N} ${s}/>`,
    cup: `<path d="M36 22h48l-6 72H42z" ${C} ${s} opacity=".95"/><path d="M40 42h40" ${N} stroke="currentColor" stroke-width="2.5" opacity=".5"/><path d="M40 58l36 0-2 30H44z" fill="var(--ill-a)" opacity=".35"/>`,
    mug: `<path d="M28 30h52v52c0 6-6 10-12 10H40c-6 0-12-4-12-10z" ${A} ${s}/><path d="M80 44h8c7 0 12 5 12 12s-5 12-12 12h-8" ${N} ${s}/><path d="M42 18c-3 4 3 6 0 10M56 16c-3 4 3 6 0 10" ${N} stroke="currentColor" stroke-width="3" opacity=".5"/>`,
    'mug-metal': `<path d="M28 26h52v60c0 4-3 8-8 8H36c-5 0-8-4-8-8z" ${C} ${s}/><path d="M80 40h10c5 0 8 4 8 8v18c0 5-3 8-8 8H80" ${N} ${s}/><path d="M38 34v50M50 34v50" ${N} stroke="currentColor" stroke-width="2.5" opacity=".45"/>`,
    bucket: `<path d="M24 40h72l-8 52c-1 4-4 6-8 6H40c-4 0-7-2-8-6z" ${C} ${s}/><ellipse cx="60" cy="40" rx="36" ry="8" ${A} ${s}/><path d="M24 40c0-18 16-28 36-28s36 10 36 28" ${N} ${s}/><path d="M40 36l6-8 8 6 8-8 8 8" ${N} stroke="currentColor" stroke-width="3" opacity=".6"/>`,
  };
  window.productIcon = function (name, label) {
    const body = icons[name] || icons.container;
    return `<svg viewBox="0 0 120 110" role="img" aria-label="${label || ''}" class="ill">${body}</svg>`;
  };
})();
