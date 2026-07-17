const { getPool, sql } = require("../db-sql");

const EQUIPMENT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

let _areasCache       = null; let _areasFetchedAt    = 0;
let _linesCache       = {};   let _linesFetchedAt    = {};  // keyed by area
let _equipCache       = {};   let _equipFetchedAt    = {};  // keyed by "area|line"

function equipCacheKey(area, line) { return `${area || ''}|${line || ''}`; }

async function getOptions(action_id, query, viewState) {
  const pool = await getPool();
  const q = `%${(query || "").trim()}%`;

  if (action_id === "area") {
    if (_areasCache && Date.now() - _areasFetchedAt < EQUIPMENT_TTL_MS) return _areasCache;
    const result = await pool.request()
      .input("q", sql.NVarChar, q)
      .query(`SELECT DISTINCT area FROM Equipment WHERE area IS NOT NULL AND area LIKE @q ORDER BY area`);
    const options = result.recordset.map(r => ({ text: { type: "plain_text", text: r.area }, value: r.area }));
    options.push({ text: { type: "plain_text", text: "Other" }, value: "__other__" });
    _areasCache = options; _areasFetchedAt = Date.now();
    return options;
  }

  if (action_id === "machineLine") {
    const selectedArea = viewState?.area?.area?.selected_option?.value;
    if (!selectedArea || selectedArea === "__other__") {
      return [{ text: { type: "plain_text", text: "Other" }, value: "__other__" }];
    }
    if (_linesCache[selectedArea] && Date.now() - _linesFetchedAt[selectedArea] < EQUIPMENT_TTL_MS) {
      return _linesCache[selectedArea];
    }
    const result = await pool.request()
      .input("area", sql.NVarChar, selectedArea)
      .input("q", sql.NVarChar, q)
      .query(`SELECT DISTINCT machine_line FROM Equipment WHERE area = @area AND machine_line IS NOT NULL AND machine_line LIKE @q ORDER BY machine_line`);
    const options = result.recordset.map(r => ({ text: { type: "plain_text", text: r.machine_line }, value: r.machine_line }));
    _linesCache[selectedArea] = options; _linesFetchedAt[selectedArea] = Date.now();
    return options;
  }

  if (action_id === "equipmentId") {
    const selectedArea = viewState?.area?.area?.selected_option?.value;
    const selectedLine = viewState?.machineLine?.machineLine?.selected_option?.value;
    const cacheKey = equipCacheKey(selectedArea, selectedLine);
    if (_equipCache[cacheKey] && Date.now() - _equipFetchedAt[cacheKey] < EQUIPMENT_TTL_MS) {
      return _equipCache[cacheKey];
    }
    const req = pool.request().input("q", sql.NVarChar, q);
    let where = "(equipment_id LIKE @q OR equipment_name LIKE @q)";
    if (selectedArea && selectedArea !== "__other__") { req.input("area", sql.NVarChar, selectedArea); where += " AND area = @area"; }
    if (selectedLine && selectedLine !== "__other__") { req.input("line", sql.NVarChar, selectedLine); where += " AND machine_line = @line"; }
    const result = await req.query(`SELECT TOP 99 equipment_id, equipment_name FROM Equipment WHERE ${where} ORDER BY equipment_id`);
    const options = result.recordset.map(r => ({
      text: { type: "plain_text", text: r.equipment_name ? `${r.equipment_id} — ${r.equipment_name}` : r.equipment_id },
      value: r.equipment_id,
    }));
    _equipCache[cacheKey] = options; _equipFetchedAt[cacheKey] = Date.now();
    return options;
  }

  return [];
}

module.exports = async (req, res) => {
  let payload;
  try {
    payload = typeof req.body.payload === "string"
      ? JSON.parse(req.body.payload)
      : req.body.payload;
  } catch {
    return res.status(400).send("Invalid payload");
  }

  const action_id = payload?.action_id;
  const query = payload?.value || "";
  const viewState = payload?.view?.state?.values || {};

  try {
    const options = await getOptions(action_id, query, viewState);
    return res.json({ options });
  } catch (err) {
    console.error(`Options error [${action_id}]:`, err.message);
    return res.json({ options: [] });
  }
};
