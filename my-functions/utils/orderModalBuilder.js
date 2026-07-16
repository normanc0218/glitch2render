const {
  createInputBlock,
  createMultiInputBlock,
  createInputBlock_multistatic,
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
 * @param {string|null} state.area         - Selected area value
 * @param {string|null} state.areaLabel    - Display text for selected area
 * @param {string|null} state.machineLine  - Selected machine line value
 * @param {string|null} state.machineLineLabel - Display text for selected machine line
 */
function buildOrderModalView({ area = null, areaLabel = null, machineLine = null, machineLineLabel = null } = {}) {
  const staffOptions = Object.entries(userService.maintenanceStaff).map(([name, value]) => ({
    text: { type: "plain_text", text: name, emoji: true },
    value,
  }));

  const blocks = buildCascadeBlocks({ area, areaLabel, machineLine, machineLineLabel });

  // ── Rest of form fields ──
  blocks.push(
    createInputBlock("reporter", "Who found the issue?", "reporter", "Name of the finder"),
    createMultiInputBlock("description", "Description of the issue", "issue", "What is the issue?"),
    createInputBlock_multistatic("assignedTo", "Assign the job to", "pickedGuy", "Select the person", staffOptions),
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
 * Used by any modal that needs the same location picker.
 */
function buildCascadeBlocks({ area = null, areaLabel = null, machineLine = null, machineLineLabel = null } = {}) {
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
        },
      });
    }
  }

  return blocks;
}

module.exports = { buildOrderModalView, buildCascadeBlocks };
