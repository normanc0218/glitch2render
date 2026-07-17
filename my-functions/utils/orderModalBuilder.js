const {
  createInputBlock,
  createMultiInputBlock,
  createInputBlock_pic,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_select,
} = require("./blockBuilder");
const userService = require("../services/slackUserService");

function getNYDate() {
  const nyDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [month, day, year] = nyDate.split("/");
  return `${year}-${month}-${day}`;
}

function getNYTime() {
  const d = new Date();
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return `${ny.getHours().toString().padStart(2, "0")}:${ny.getMinutes().toString().padStart(2, "0")}`;
}

/**
 * Build the Submit Order modal view.
 * @param {object} state
 * @param {string|null} state.area
 * @param {string|null} state.areaLabel
 * @param {string|null} state.machineLine
 * @param {string|null} state.machineLineLabel
 * @param {string|null} state.equipmentId      - Preserved on tech-select rebuild
 * @param {string|null} state.equipmentLabel
 * @param {string|null} state.selectedTechValue - Preserved on cascade rebuild
 * @param {string|null} state.selectedTechLabel
 * @param {string|null} state.offlineWarning    - Tech name if an offline tech is selected
 */
function buildOrderModalView({
  area = null, areaLabel = null,
  machineLine = null, machineLineLabel = null,
  equipmentId = null, equipmentLabel = null,
  selectedTechValue = null, selectedTechLabel = null,
  offlineWarning = null,
} = {}) {
  const staffOptions = [
    ...Object.entries(userService.maintenanceStaff).map(([name, value]) => ({
      text: { type: "plain_text", text: name, emoji: true },
      value,
    })),
    ...(userService.offlineTechs || []).map(name => ({
      text: { type: "plain_text", text: `${name} (Non-slack User)`, emoji: true },
      value: `offline:${name}`,
    })),
  ];

  const blocks = buildCascadeBlocks({ area, areaLabel, machineLine, machineLineLabel, equipmentId, equipmentLabel });

  // ── Assigned technician (single select, dispatches on change) ──
  blocks.push({
    type: "input",
    block_id: "assignedTo",
    dispatch_action: true,
    label: { type: "plain_text", text: "Assign the job to" },
    element: {
      type: "static_select",
      action_id: "pickedGuy",
      placeholder: { type: "plain_text", text: "Select the person", emoji: true },
      options: staffOptions,
      ...(selectedTechValue
        ? { initial_option: { text: { type: "plain_text", text: selectedTechLabel || selectedTechValue, emoji: true }, value: selectedTechValue } }
        : {}),
    },
  });

  // Offline tech warning — shown immediately after selection via dispatch_action
  if (offlineWarning) {
    blocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `⚠️ *${offlineWarning}* doesn't have access to Slack. After submitting, you'll be prompted to fill in their completion record on their behalf.`,
      }],
    });
  }

  // ── Rest of form fields ──
  blocks.push(
    createInputBlock("reporter", "Who found the issue?", "reporter", "Name of the finder"),
    createMultiInputBlock("description", "Description of the issue", "issue", "What is the issue?"),
    createInputBlock_select({
      block_id: "priority",
      label: "Priority",
      action_id: "priority",
      options: ["high", "medium", "low"],
      initial_option: "medium",
    }),
    createInputBlock_pic("issuePicture", "Picture of the defect", "file_input_action_id_1"),
    createInputBlock_date("orderDate", "Order Date", "datepickeraction", getNYDate()),
    createInputBlock_time("orderTime", "Order Time", "timepickeraction", getNYTime()),
  );

  return {
    type: "modal",
    callback_id: "submitOrder",
    title: { type: "plain_text", text: "Maintenance Order Form", emoji: true },
    submit: { type: "plain_text", text: "Submit", emoji: true },
    close: { type: "plain_text", text: "Cancel", emoji: true },
    blocks,
  };
}

/**
 * Returns only the cascade blocks (area → machine line → equipment).
 * equipmentId/equipmentLabel are passed through on tech-select rebuilds to
 * preserve the selection; on area/machineLine changes they are intentionally omitted.
 */
function buildCascadeBlocks({
  area = null, areaLabel = null,
  machineLine = null, machineLineLabel = null,
  equipmentId = null, equipmentLabel = null,
} = {}) {
  const blocks = [];

  blocks.push({
    type: "input",
    block_id: "area",
    dispatch_action: true,
    label: { type: "plain_text", text: "Area" },
    element: {
      type: "external_select",
      action_id: "area",
      placeholder: { type: "plain_text", text: "Select area..." },
      min_query_length: 0,
      ...(area ? { initial_option: { text: { type: "plain_text", text: areaLabel || area }, value: area } } : {}),
    },
  });

  if (area === "__other__") {
    blocks.push(
      {
        type: "input",
        block_id: "otherLocation",
        label: { type: "plain_text", text: "Location" },
        element: {
          type: "plain_text_input",
          action_id: "otherLocation",
          placeholder: { type: "plain_text", text: "e.g. Production floor, Red Cage" },
        },
      },
      {
        type: "input",
        block_id: "otherEquipment",
        label: { type: "plain_text", text: "Equipment" },
        element: {
          type: "plain_text_input",
          action_id: "otherEquipment",
          placeholder: { type: "plain_text", text: "e.g. Hand Washroom" },
        },
      }
    );
  } else {
    if (!area) {
      blocks.push({
        type: "section",
        block_id: "machineLinePlaceholder",
        text: { type: "mrkdwn", text: "*Machine Line*\n_Select an area first._" },
      });
    } else {
      blocks.push({
        type: "input",
        block_id: "machineLine",
        dispatch_action: true,
        label: { type: "plain_text", text: "Machine Line" },
        element: {
          type: "external_select",
          action_id: "machineLine",
          placeholder: { type: "plain_text", text: "Select machine line..." },
          min_query_length: 0,
          ...(machineLine ? { initial_option: { text: { type: "plain_text", text: machineLineLabel || machineLine }, value: machineLine } } : {}),
        },
      });
    }

    if (!machineLine) {
      blocks.push({
        type: "section",
        block_id: "equipmentPlaceholder",
        text: { type: "mrkdwn", text: "*Equipment*\n_Select a machine line first._" },
      });
    } else {
      blocks.push({
        type: "input",
        block_id: "equipmentId",
        label: { type: "plain_text", text: "Equipment" },
        element: {
          type: "external_select",
          action_id: "equipmentId",
          placeholder: { type: "plain_text", text: "Search equipment..." },
          min_query_length: 0,
          ...(equipmentId ? { initial_option: { text: { type: "plain_text", text: equipmentLabel || equipmentId }, value: equipmentId } } : {}),
        },
      });
    }
  }

  return blocks;
}

module.exports = { buildOrderModalView, buildCascadeBlocks };
