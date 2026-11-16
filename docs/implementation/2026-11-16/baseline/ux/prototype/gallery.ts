import '../../../../../../typing-app/client/src/style.css';
import { states } from './fixtures.ts';

// Index of reviewable states. Every state is simulated fixture data, not user observation.
document.querySelector('#main')!.innerHTML = `<p class="eyebrow">Prototype · simulated fixtures</p>
<h1>Baseline and unlock states</h1>
<p class="lead">Each link opens one state of the local prototype. Numbers are invented for layout and wording review.
Add <code>&amp;fast=1</code> to any ready state to run a 30 s test on a 10× clock.</p>
<ol class="list">${states.map(s => `<li><span><a class="text-link" href="./index.html?${s.query}">${s.id} · ${s.title}</a><br><span class="small">${s.note}</span></span></li>`).join('')}</ol>`;
