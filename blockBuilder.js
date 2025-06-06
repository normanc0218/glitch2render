function createTextSection(text) {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text
    }
  };
}

function createInputBlock(block_id, label, action_id, placeholder = "") {
  return {
    type: "input",
    block_id,
    label: {
      type: "plain_text",
      text: label
    },
    element: {
      type: "plain_text_input",
      action_id,
      placeholder: {
        type: "plain_text",
        text: placeholder
      }
    }
  };
}

function createDivider() {
  return { type: "divider" };
}

module.exports = {
  createTextSection,
  createInputBlock,
  createDivider
};
