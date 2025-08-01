

function createInputBlock(block_id, label, action_id, placeholder = "",option=false) {
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
    },
    "optional": option
  };
}
function createInputBlock_multistatic(block_id, label, action_id, placeholder = "",options) {
  return {
    type: "input",
    block_id,
    label: {
      type: "plain_text",
      text: label
    },
    element: {
      type: "multi_static_select",
      action_id,
      options: options,
      placeholder: {
        type: "plain_text",
        text: placeholder
      }
    }
  };
}
function createInputBlock_pic(block_id, label, action_id) {
  return {
    type: "input",
    block_id,
    label: {
      type: "plain_text",
      text: label
    },
    element: {
      type: "file_input",
      action_id,
      "filetypes": [
					"jpg",
					"png"
				],
      max_files: 5
     }
  };
}

function createInputBlock_date(block_id, label, action_id,initial_date) {
  return {
			type: "input",
      block_id,
			element: {
				type: "datepicker",
				initial_date,
				placeholder: {
					type: "plain_text",
					text: "Select a date",
					emoji: true
				},
				action_id,
			},
			label: {
				type: "plain_text",
				text: label,
				emoji: true
			}
		}
}

function createInputBlock_time(block_id, label, action_id,initial_time) {
  return {
			type: "input",
      block_id,
			element: {
				type: "timepicker",
				initial_time,
				placeholder: {
					type: "plain_text",
					text: "Select a time",
					emoji: true
				},
				action_id,
			},
			label: {
				type: "plain_text",
				text: label,
				emoji: true
			}
		}
}

function createInputBlock_select({ block_id, label, action_id, options=[]}) {
  return {
    type: "input",
    block_id,
    label: {
      type: "plain_text",
      text: label,
    },
    element: {
      type: "static_select",
      action_id,
      placeholder: {
        type: "plain_text",
        text: "Select an option",
        emoji: true,
      },
      options: options.map(opt => ({
        text: { type: "plain_text", text: opt, emoji: true },
        value: opt,
      })),
    },
  };
}

function createInputBlock_checkboxes({ block_id, label, action_id, options=[],optional=false}) {
  return {
    type: "input",
    block_id,
    label: {
      type: "plain_text",
      text: label,
    },
    element: {
      type: "checkboxes",
      action_id,
      options: options.map(opt => ({
        text: { type: "mrkdwn", text: opt },
        value: opt,
      }))},    
    optional:optional
  };
}

function createInputBlock_radio({ block_id, label, action_id, options=[]}) {
  return {
    type: "input",
    block_id,
    label: {
      type: "plain_text",
      text: label,
    },
    element: {
      type: "radio_buttons",
      action_id,
      options: options.map(([name, value]) => ({
  text: {
    type: "mrkdwn",
    text: name
  },
  value: value
      })),
    },
  };
}
//
function createDivider() {
  return { type: "divider" };
}
function createTextSection(text) {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: text
    }
  };
}
function createHeader(text) {
  return {
    type: "header",
    text: {
      type: "plain_text",
      text: text,
      emoji: true
    }
  };
}
function createImage( image_url, alt_text) {
  return {
    type: "image",
    image_url: image_url,
    alt_text: alt_text
  };
}

function createButton(text, value, action_id, style = "primary") {
  
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text,
        },
        value,
        action_id,
        style,
      },
    ],
  };
}
function createD4Button(text, value, action_id) {
  
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text,
        },
        value,
        action_id,
      },
    ],
  };
}
module.exports = {
  createInputBlock,
  createInputBlock_multistatic,
  createInputBlock_pic,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_select,
  createInputBlock_checkboxes,
  createInputBlock_radio,
  createTextSection,
  createDivider,
  createHeader,
  createImage,
  createButton,
  createD4Button
};
