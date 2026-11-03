/*
  ai.js — the ONLY place the "AI" lives.

  This prototype's AI is simulated: askAI() uses rules and templates, not a real model.
  To use a real AI model later, replace the inside of askAI() with a call to that model
  and return the same shape of answer. Nothing else in the app needs to change.

  askAI({ task, input }) -> { label, result }
*/

const AI_LABEL = 'Prototype AI (simulated)';

function askAI(request) {
  const task = request && request.task;
  // Tasks are added milestone by milestone (extracting hours, dates, stories...).
  return { label: AI_LABEL, result: null, note: `Task "${task}" is not built yet.` };
}
