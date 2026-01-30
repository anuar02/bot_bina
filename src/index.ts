import { SignalEngine } from './execution/SignalEngine.js';

async function main() {
  const engine = new SignalEngine();
  await engine.start();
}

main().catch(console.error);
