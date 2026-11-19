// Test-only agent page for the production settings rail. createAgent is never imported by the
// production entry; this page installs it before the real app mounts its SDK components.
import { createAgent } from '@ui-sdk/web/agent';

// Two independent locks: the bridge refuses settings steps while a block runs (default), and the
// app's own change guard refuses with a source-aware reason. `?bridge=open` disables the first lock
// so the test can prove the second one on its own.
const bridgeOpen = new URLSearchParams(location.search).get('bridge') === 'open';
const running = () => document.querySelector<HTMLElement>('#stage')?.dataset.state === 'running';
const agent = createAgent({ allow: step => !step.confirm && (bridgeOpen || !running()) });

await import('../../src/app.ts');
while (!document.querySelector('#typing-input')) await new Promise(resolve => setTimeout(resolve, 10));

Object.assign(window, { sdkProof: { agent, bridgeOpen, ready: true } });
