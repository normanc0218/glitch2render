require("dotenv").config();
const express = require("express");
const { openModal_accept } = require("./openModal_accept.js");
const crypto = require("crypto");
const bodyParser = require("body-parser"); // Needed to get raw body
const { displayHome } = require("./appHome");
const { openModal } = require("./openModal"); // Make sure this file and function exist
const qs = require("qs");
const signVerification = require("./signVerification");

const app = express();
const port = process.env.PORT || 12000;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

// Middleware for parsing URL-encoded bodies (Slack sends payloads this way)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/slack/events", signVerification, async (req, res) => {
  const { type, challenge, event } = req.body;

  switch (type) {
    case "url_verification":
      // Step 1: Respond to Slack URL Verification
      return res.send({ challenge });

    case "event_callback": {
      console.log("✅ Slack request verified");
      if (event.type === "app_home_opened") {
        await displayHome(event.user);
      }

      return res.sendStatus(200); // Always respond 200 to Slack
    }
    default:
      return res.sendStatus(400);
  }
});
// Slack Actions
app.post("/slack/actions", async (req, res) => {
  // If it's a slash command payload
  if (!req.body.payload) {
    const { command, user_id, trigger_id, text, response_url, user_name } =
      req.body;

    console.log("Slash command received:", command);

    if (command === "/newjob") {
      // You could open a modal here or respond with a message
      await openModal(trigger_id); // You must have `openModal` defined for this

      // Respond with 200 OK (Slack expects a response)
      return res.status(200).send(); // Optionally add a visible message
    }

    return res.status(200).send("Unknown command");
  } else {
    // Otherwise it's an interactive payload (e.g. button, modal, etc.)
    try {
      const payload = JSON.parse(req.body.payload);
      const { token, trigger_id, user, actions, type, view } = payload;
      // Always respond immediately
      res.send(); // Sends 200 OK to Slack

      if (type === "view_submission") {
        const ts = new Date();
        // console.log(view.state.values.picture.file_input_action_id_1.files[0].thumb_1024);
        const data = {
          timestamp: ts.toLocaleString("en-US", {
            timeZone: "America/New_York",
          }),
          machineLocation:
            view.state.values.machineLocation.machine_location_input.value,
          Description: view.state.values.Description.issue.value,
          maintenanceStaff:
            view.state.values.maintenanceStaff.pickedGuy.selected_options.map(
              (option) => option.text.text
            ),
          mStaff_id:
            view.state.values.maintenanceStaff.pickedGuy.selected_options.map(
              (option) => option.value
            ),
          picture: view.state.values.picture.file_input_action_id_1.files.map(
            (option) => option.url_private
          ),
          date: view.state.values.date.datepickeraction.selected_date,
          time: view.state.values.time.timepickeraction.selected_time,
        };
        await displayHome(user, data);
      } else if (actions) {
        const action = actions[0];
        console.log("loop")
        if (action.action_id === "accept_task") {
          const jobId = view.mStaff_id;
          // Open modal for Accept form
          console.log(payload)
          await openModal_accept(trigger_id,jobId);
        } 
        else if (action.action_id.match(/add_/)) 
        {
          await openModal(trigger_id);
        }
      }
    } catch (error) {
      console.error("Error processing Slack action:", error);
      // Cannot send res.status(500) here because res.send() is already sent above
    }
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
