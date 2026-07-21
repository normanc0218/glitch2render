'use strict';

/**
 * Finds a selected_option from a dynamically-named block.
 * Block IDs for machineLine and equipmentId include the parent value
 * (e.g. "machineLine_Area1", "equipmentId_Line1") so that changing the
 * parent forces a block_id change, resetting Slack's preserved state.
 *
 * @param {object} vals  view.state.values
 * @param {string} prefix  "machineLine" | "equipmentId"
 * @returns {object|null}  selected_option or null
 */
function findDynBlock(vals, prefix) {
  const key = Object.keys(vals || {}).find(k => k.startsWith(prefix + '_'));
  return key ? (vals[key]?.[prefix]?.selected_option ?? null) : null;
}

module.exports = { findDynBlock };
