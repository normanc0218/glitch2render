const { WebClient } = require("@slack/web-api");
const { buildOrderModalView } = require("../utils/orderModalBuilder");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

const openModal = async (trigger_id) => {
  await client.views.open({
    trigger_id,
    view: buildOrderModalView(),
  });
};

module.exports = openModal;
