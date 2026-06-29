const { WebClient } = require("@slack/web-api");
const { buildCascadeBlocks } = require("../utils/orderModalBuilder");
const {
  createInputBlock,
  createMultiInputBlock,
  createInputBlock_pic,
  createInputBlock_date,
  createInputBlock_time,
} = require("../utils/blockBuilder");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

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

function buildDispatchModalView({ area = null, areaLabel = null, machineLine = null, machineLineLabel = null } = {}) {
  const blocks = buildCascadeBlocks({ area, areaLabel, machineLine, machineLineLabel });

  blocks.push(
    createInputBlock("reporter", "Who found the issue?", "reporter", "Name of the finder"),
    createMultiInputBlock("description", "Description of the issue", "issue", "What is the issue?"),
    createInputBlock_pic("issuePicture", "Picture of the defect", "file_input_action_id_1"),
    createInputBlock_date("dispatchDate", "Dispatch Date", "datepickeraction", getNYDate()),
    createInputBlock_time("dispatchTime", "Dispatch Time", "timepickeraction", getNYTime()),
  );

  return {
    type: "modal",
    callback_id: "dispatch",
    title: { type: "plain_text", text: "Dispatch Form", emoji: true },
    submit: { type: "plain_text", text: "Submit", emoji: true },
    close: { type: "plain_text", text: "Cancel", emoji: true },
    blocks,
  };
}

const openModal_dispatch = async (trigger_id) => {
  await client.views.open({
    trigger_id,
    view: buildDispatchModalView(),
  });
};

module.exports = openModal_dispatch;
module.exports.buildDispatchModalView = buildDispatchModalView;
