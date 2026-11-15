import '@ui-sdk/web/segmented-control';
import '@ui-sdk/web/switch';
import '@ui-sdk/web/select';
import '@ui-sdk/web/collapsible';
import '@ui-sdk/web/button';
import { createAgent } from '@ui-sdk/web/agent';
import type { UiChangeEvent, UiSegmentedControlElement } from '@ui-sdk/web';

const changes: { setting: string; value: unknown; source: string; accepted: boolean }[] = [];
const native = <T extends HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!;
const locked = () => native<HTMLSelectElement>('duration').disabled;
const agent = createAgent({ allow: step => !step.confirm && !locked() });

// Exercise the real native editor and engine without changing their production entry.
await import('../../src/app.ts');
while (!document.querySelector('#typing-input')) await new Promise(resolve => setTimeout(resolve, 10));

const duration = native<HTMLSelectElement>('duration');
const kind = native<HTMLSelectElement>('practice-kind');
const pair = native<HTMLSelectElement>('manual-pair');
const qwerty = native<HTMLInputElement>('qwerty');
const items = (select: HTMLSelectElement) => [...select.options].map(option => ({
  value: option.value, label: option.textContent!, disabled: option.disabled,
}));
const choice = (id: string, label: string, select: HTMLSelectElement) => `
  <ui-segmented-control id="${id}" aria-label="${label}" default-value="${select.value}">
    <ui-segmented-control-indicator></ui-segmented-control-indicator>
    ${items(select).map(item => `<ui-segmented-control-item value="${item.value}" ${item.disabled ? 'disabled' : ''}>${item.label}</ui-segmented-control-item>`).join('')}
  </ui-segmented-control>`;

native('sdk-proof').innerHTML = `
  <ui-collapsible id="sdk-settings" aria-label="Proof options">
    <ui-collapsible-trigger><button type="button">Proof options</button></ui-collapsible-trigger>
    <ui-collapsible-panel keep-mounted hidden>
      ${choice('sdk-duration', 'Block length', duration)}
      ${choice('sdk-kind', 'Exercise category', kind)}
      <ui-select id="sdk-pair" default-value="${pair.value}">
        <ui-select-label>Letter pair</ui-select-label>
        <ui-select-trigger><button type="button"><ui-select-value></ui-select-value></button></ui-select-trigger>
        <ui-select-content>${items(pair).map(item => `<ui-select-item value="${item.value}">${item.label}</ui-select-item>`).join('')}</ui-select-content>
      </ui-select>
      <ui-switch id="sdk-qwerty" aria-label="Physical QWERTY" ${qwerty.checked ? 'default-checked' : ''}>
        <ui-switch-thumb>Physical QWERTY</ui-switch-thumb>
      </ui-switch>
      <ui-button id="sdk-done"><button type="button">Close proof panel</button></ui-button>
    </ui-collapsible-panel>
  </ui-collapsible>
  <output id="sdk-source" aria-live="polite"></output>`;

const sdkDuration = document.querySelector<UiSegmentedControlElement>('#sdk-duration')!;
const sdkKind = document.querySelector<UiSegmentedControlElement>('#sdk-kind')!;
const sdkPair = document.querySelector('ui-select')!;
const sdkQwerty = document.querySelector('ui-switch')!;
sdkPair.items = items(pair);

function apply(event: UiChangeEvent<unknown>, setting: string, valid: boolean, write: () => void) {
  const accepted = !locked() && valid;
  const { value, source } = event.detail;
  changes.push({ setting, value, source, accepted });
  native('sdk-source').textContent = `${source}: ${setting} ${accepted ? 'accepted' : 'refused'}`;
  if (!accepted) { event.preventDefault(); return; }
  write();
}
sdkDuration.addEventListener('valuechange', event => apply(event, 'duration',
  items(duration).some(item => item.value === event.detail.value), () => {
    duration.value = event.detail.value!;
    duration.dispatchEvent(new Event('change'));
  }));
sdkKind.addEventListener('valuechange', event => apply(event, 'practice',
  items(kind).some(item => item.value === event.detail.value && !item.disabled), () => {
    kind.value = event.detail.value!;
    kind.dispatchEvent(new Event('change'));
  }));
sdkPair.addEventListener('valuechange', event => apply(event, 'pair',
  kind.value === 'manual' && items(pair).some(item => item.value === event.detail.value), () => {
    pair.value = String(event.detail.value);
    pair.dispatchEvent(new Event('change'));
  }));
sdkQwerty.addEventListener('checkedchange', event => apply(event, 'qwerty',
  typeof event.detail.value === 'boolean', () => {
    qwerty.checked = event.detail.value;
    qwerty.dispatchEvent(new Event('change'));
  }));
document.querySelector('ui-button')!.addEventListener('action', event => {
  if (locked()) { event.preventDefault(); return; }
  changes.push({ setting: 'close', value: false, source: event.detail.source, accepted: true });
  document.querySelector('ui-collapsible')!.api.close();
});

Object.assign(window, { sdkProof: { agent, changes, ready: true } });
