/**
 * Customer Signal Engine
 * Tracks recurring objections, requested capabilities, buying triggers, churn reasons
 * by segment with direction: new, growing, fading
 */

const db = require('../db');

function addSignal({ source_type, source_ref, segment, signal_type, signal_text, direction = 'new' }) {
  const result = db.prepare(`
    INSERT INTO customer_signals (source_type, source_ref, segment, signal_type, signal_text, direction, evidence_count)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(source_type, source_ref, segment, signal_type, signal_text, direction);
  return result.lastInsertRowid;
}

function getWeeklyBrief() {
  const newSignals = db.prepare(`
    SELECT * FROM customer_signals
    WHERE direction = 'new'
    ORDER BY created_at DESC
    LIMIT 50
  `).all();

  const growing = db.prepare(`
    SELECT * FROM customer_signals
    WHERE direction = 'growing'
    ORDER BY evidence_count DESC, updated_at DESC
    LIMIT 50
  `).all();

  const fading = db.prepare(`
    SELECT * FROM customer_signals
    WHERE direction = 'fading'
    ORDER BY updated_at DESC
    LIMIT 50
  `).all();

  return { newSignals, growing, fading };
}

function proposeChange(signal_id, new_direction, reason) {
  db.prepare(`
    UPDATE customer_signals
    SET direction = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(new_direction, signal_id);

  return { signal_id, new_direction, reason };
}

module.exports = { addSignal, getWeeklyBrief, proposeChange };
