import { Simulation } from '../shared/simulation.js';

// Solo uses the same world and AI, on a separate thread. No room, socket or
// second player is created, and rendering cannot stall the simulation clock.
let sim = null;
let paused = false;
let speed = 1;
const id = 'solo-player';
function publish() {
  if (sim) postMessage({ type: 'state', code: 'SOLO', host: id, paused, ...sim.snapshot() });
}
self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    sim = new Simulation({ observer: !!data.observer });
    sim.addPlayer(id, data.character === 1 ? 1 : 0);
    sim.start(true);
    publish();
    return;
  }
  if (!sim) return;
  if (data.type === 'speed' && sim.observer)
    speed = [1, 2, 4].includes(data.speed) ? data.speed : 1;
  if (data.type === 'input' && !sim.observer) sim.setInput(id, data);
  if (data.type === 'action' && !paused && !sim.observer) sim.action(id, data.action);
  if (data.type === 'start') {
    sim.start(true);
    publish();
  }
  if (data.type === 'pause') {
    paused = !!data.paused;
    for (const p of sim.players) {
      p.charging = false;
      p.throwCharge = 0;
    }
    sim.setInput(id, {});
    publish();
  }
};
let ticks = 0;
setInterval(() => {
  if (!sim) return;
  if (!paused) for (let i = 0; i < speed; i++) sim.tick(0.05);
  if (++ticks % 2 === 0) publish();
}, 50);
