import { Simulation } from '../shared/simulation.js';

// Solo uses the same world and AI, on a separate thread. No room, socket or
// second player is created, and rendering cannot stall the simulation clock.
let sim = null;
let paused = false;
const id = 'solo-player';
function publish() {
  if (sim) postMessage({ type: 'state', code: 'SOLO', host: id, paused, ...sim.snapshot() });
}
self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    sim = new Simulation();
    sim.addPlayer(id, data.character === 1 ? 1 : 0);
    sim.start(true);
    publish();
    return;
  }
  if (!sim) return;
  if (data.type === 'input') sim.setInput(id, data);
  if (data.type === 'action' && !paused) sim.action(id, data.action);
  if (data.type === 'start') {
    sim.start(true);
    publish();
  }
  if (data.type === 'pause') {
    paused = !!data.paused;
    sim.setInput(id, {});
    publish();
  }
};
let ticks = 0;
setInterval(() => {
  if (!sim) return;
  if (!paused) sim.tick(0.05);
  if (++ticks % 2 === 0) publish();
}, 50);
