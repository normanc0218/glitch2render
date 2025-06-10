const axios = require("axios");
const qs = require("qs");
const {
  createInputBlock,
  createInputBlock_select,
  createTextSection,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_checkboxes,
  createInputBlock_radio,
  createInputBlock_pic,
} = require("./blockBuilder");
const nyDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date()); // e.g. "2025-05-28"
const [month, day, year] = nyDate.split("/");
const initialDate = `${year}-${month}-${day}`;

function getNYTimeString() {
  const d = new Date();
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hh = ny.getHours().toString().padStart(2, '0');
  const mm = ny.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
const initialTime = getNYTimeString();

const openModal_general_approval = async (
  viewId,
  jobId,
  isDailyJob = false
) => {
  const blocks = [];
  blocks.push(
    createInputBlock_select({
      block_id: "tool_id",
      label:
        "Assigned Maintenance has/have collected their tools and materials",
      action_id: "Maitenance_tool",
      options: ["Yes", "No"], // <-- make sure this is passed in like this
    })
  );
  // if the project is daily job, block push the following 3 blocks, otherwise dont push
  if (isDailyJob) {
    blocks.push(
      createInputBlock_select({
        block_id: "clean_id",
        label: "Working area needs extra helps for cleaning?",
        action_id: "working_area",
        options: ["Yes", "No"], // <-- make sure this is passed in like this
      })
    );
    blocks.push(
      createInputBlock(
        "clean_input",
        "Assign who to help cleaning?",
        "name_clean",
        "e.g. Somebody",
        true
      )
    );
    blocks.push(
      createInputBlock(
        "other_input",
        "*Specify other details related to this job",
        "detailOfJob",
        "e.g. Something",
        true
      )
    );
  }
  blocks.push(
    createInputBlock_pic("picture", "How is the job?", "file_general_app")
  );
  blocks.push(
    createInputBlock("comments", "Comments", "remarks_input", "comments")
  ),
    blocks.push(
      createInputBlock_date(
        "date",
        "Check Date",
        "datepickeraction",
        initialDate
      )
    );
  blocks.push(
    createInputBlock_time("time", "Check Time", "timepickeraction", initialTime)
  );
  const modal = {
    type: "modal",
    callback_id: "general_approval",
    private_metadata: jobId,
    title: {
      type: "plain_text",
      text: "Review progress",
    },
    submit: {
      type: "plain_text",
      text: "Approved",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks,
  };

  // API call to open the modal
 try {
    const result = await axios.post(
      "https://slack.com/api/views.update",
      {
        token: process.env.SLACK_BOT_TOKEN,
        view_id: viewId,
        view: modal   
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
      }
    );

    if (result.data.ok) {
      console.log("Modal opened successfully!");
    } else {
      console.error("Error opening modal:", result.data.error, result.data);
    }
  } catch (error) {
    console.error("Error during modal open request:", error.message);
  }
};

module.exports = { openModal_general_approval };
