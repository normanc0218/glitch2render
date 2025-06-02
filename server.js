require("dotenv").config();
const express = require("express");
const { openModal_accept } = require("./openModal_accept.js");
const { openModal_reject } = require("./openModal_reject.js");
const { openModal_update_progress } = require("./openModal_update_progress.js");
const { openModal_view_detail } = require("./openModal_view_detail.js");
const { openModal_supervisor_approval } = require("./openModal_supervisor_approval.js");
const {  notifyChannel, notifyNewOrder } = require("./notifyChannel");

const axios = require("axios");

const crypto = require("crypto");
const bodyParser = require("body-parser"); // Needed to get raw body
const { displayHome } = require("./appHome");
const { openModal } = require("./openModal"); // Make sure this file and function exist
const qs = require("qs");
const signVerification = require("./signVerification");

const app = express();
const port = process.env.PORT || 12000;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: true }));
app.post("/slack/events",signVerification, async (req, res) => {
  console.log("🔥 /slack/events reached");

  const { type, challenge, event } = req.body;
  if (event.type === "app_home_opened") {
  console.log("App home opened by user:", event.user);
  await displayHome(event.user); // Ensure this passes correct user ID
}
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
      let payload;
        try {
          payload = typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body.payload;
        } catch (err) {
          console.error("Failed to parse payload", err);
          return res.status(400).send("Invalid payload");
        }
      const { token, trigger_id, user, actions, type, view } = payload;
      // Always respond immediately
      res.send(); // Sends 200 OK to Slack
      // console.log(view)
      // View detail
      if (type === "block_actions" && actions && actions[0].action_id === "view_detail") {
        console.log(actions)
        const jobId = actions[0].value;
        const userId = user.id;
        await openModal_view_detail(trigger_id,jobId);
        };
      if (type === "view_submission") {
        if (view.callback_id === "new_job_form") {
          const ts = new Date();
          const data = {
            timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
            Orderedby:user.username,
            machineLocation: view.state.values.machineLocation.machineLocation.selected_option.value,
            finder:view.state.values.reporter_block.reporter.value,
            Description: view.state.values.Description.issue.value,
            maintenanceStaff: view.state.values.maintenanceStaff.pickedGuy.selected_options.map(opt => opt.text.text),
            //mStaff_id should not be shown in the Home view
            mStaff_id: view.state.values.maintenanceStaff.pickedGuy.selected_options.map(opt => opt.value),

            picture: view.state.values.picture.file_input_action_id_1.files.map(file => file.url_private),
            orderdate: view.state.values.date.datepickeraction.selected_date,
            ordertime: view.state.values.time.timepickeraction.selected_time,
            status: "Pending"
          };
          // console.log(data)
          await displayHome(user, data);
          const messageTs = await notifyNewOrder(data)
        }

        // Accept Modal Submission
        else if (view.callback_id === "accept_form") {
          const jobId = view.private_metadata;
          const updatedData = {
            acceptdate: view.state.values.datepicker.accept_date.selected_date,
            accepttime: view.state.values.timepicker.accept_time.selected_time,
            remarks: view.state.values.signature.remarks_input.value,
            status: `Accepted by ${view.state.values.accept_block.whoaccept.selected_option.text.text}`,
            JobId: jobId
            
          };
            await displayHome(user, updatedData);
          //Notify the channel
            await notifyChannel(`✅ Job *${jobId}* was *accepted* by <@${user.id}> on ${updatedData.acceptdate} at ${updatedData.accepttime}.`)
        }      
          // Reject Modal Submission
        else if (view.callback_id === "reject_form") {
          const jobId = view.private_metadata;
          const updatedData = {
          JobId: jobId,
          rejectdate: view.state.values.datepicker.reject_date.selected_date,
          rejecttime: view.state.values.timepicker.reject_time.selected_time,
          rejectreason:view.state.values.reason.reason_input.value,
          rejectby:view.state.values.reject_block.whoreject.selected_option.text.text,
          status: `Rejected by ${view.state.values.reject_block.whoreject.selected_option.text.text}`
        };  
          await displayHome(user,updatedData);
          await notifyChannel(`✅ Job *${jobId}* was *accepted* by <@${user.id}> on ${updatedData.rejectdate} at ${updatedData.rejecttime}.`);
        }        
          // Update progress Modal Submission
        else if (view.callback_id === "update_progress") {
          // console.log('view is ')
          // console.log(view.state.values)
          const jobId = view.private_metadata;
          const updatedData = {
            JobId: jobId,
            updatedBy: view.state.values.accept_block?.whoupdate?.selected_option?.value || null,
            issueCauses: view.state.values.reason_defect_block.reason_defect?.selected_options?.map(opt => opt.value) || [],
            otherreason:view.state.values.other_reason_input.otherreason.value,
            // Clean-up confirmations
            toolsCollected:view.state.values.select_tools.tool_collected?.selected_option?.value || null,
            resetConfirmed: view.state.values.resetbuttons.tool_collected?.selected_option?.value || null,
            //Do I need superviosr Id or the username?
            supervisorUser: view.state.values.supervisor_notify.notify_supervisor.selected_option?.text.text || null,
            supervisorUserId: view.state.values.supervisor_notify.notify_supervisor.selected_option?.value || null,
            supervisorMessage: view.state.values.supervisor_message?.notify_supervisor_message?.value || null,

            // Completion status
            status: view.state.values.complete_job_block.complete_job?.selected_option?.value || null,
            otherStatuses: view.state.values.other_status_block?.otheroption?.selected_options?.map(opt => opt.text.text) || [],
            otherSpecify:view.state.values.specify.specify_other.value,
            
            endDate:view.state.values.date?.datepickeraction?.selected_date || null,
            endTime: view.state.values.time?.timepickeraction?.selected_time || null,
            
            
            //Picture of finished job
            finish_pic:view.state.values.picture.finish_pic.files.map(file => file.url_private)
          };
          await displayHome(user,updatedData);
        }        
          // Update progress Modal Submission
        else if (view.callback_id === "review_progress") {
          // console.log('view is ')
          // console.log(view.state.values)
          const jobId = view.private_metadata;
          const updatedData = {
            JobId: jobId,
            
            toolsChecked:view.state.values.tool_id.Maitenance_tool.selected_option?.value || null,
            extrahelp: view.state.values.clean_input.name_clean.value || null,
            
            supervisorcomment: view.state.values.other_reason_input.detailOfJob.value || null,

            // Completion status
            status: " 👍 *Approved and Completed*",
            
            checkDate:view.state.values.date?.datepickeraction?.selected_date || null,
            checkTime: view.state.values.time?.timepickeraction?.selected_time || null,
              };
          await displayHome(user,updatedData);
        } 
      } else if (actions) {
          const action = actions[0];
          if (action.action_id === "accept_task") {
            const jobId = action.value

            // Open modal for Accept form
            await openModal_accept(trigger_id,jobId);
          } else if (action.action_id === "reject_task") {
            const jobId = action.value
            // Open modal for Reject form
            await openModal_reject(trigger_id,jobId);
          } else if (action.action_id === "update_progress") {
            const jobId = action.value
            //Open modal for update progress
            await openModal_update_progress(trigger_id,jobId);
          } else if (action.action_id === "review_progress") {
            const jobId = action.value
            //Open modal for update progress
            await openModal_supervisor_approval(trigger_id,jobId);
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
