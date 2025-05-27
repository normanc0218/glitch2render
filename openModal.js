const axios = require('axios');
const qs = require('qs');
const openModal = async(trigger_id) => {
  const modal_json = require(`./modal_j.json`);
  const modal=JSON.parse(modal_json);

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: trigger_id,
    view: JSON.stringify(modal)
  };
  
  const result = await axios.post('https://slack.com/api/views.open', qs.stringify(args));
};
module.exports = { openModal};