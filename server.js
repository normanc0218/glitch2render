require("dotenv").config();
const express = require("express");
const { openModal_accept } = require("./openModal_accept.js");
const { openModal_reject } = require("./openModal_reject.js");
const { openModal_update_progress } = require("./openModal_update_progress.js");
const { openModal_view_detail } = require("./openModal_view_detail.js");
const { openModal_supervisor_approval } = require("./openModal_supervisor_approval.js");
//Daily modals
const { openModal_daily_job } = require("./openModal_daily_job.js");
const { openModal_daily_update} = require("./openModal_daily_update.js");
//Project + PM modals
const { openModal_projects} = require("./openModal_projects.js");
const { openModal_project_update} = require("./openModal_project_update.js");
//general Approval
const { openModal_general_approval} = require("./openModal_general_approval.js");


const db2 = require("./db2")
const db3 = require("./db3")
const {  threadNotify, notifyNewOrder } = require("./notifyChannel");
const path = require("path");

const axios = require("axios");

const crypto = require("crypto");
const bodyParser = require("body-parser"); // Needed to get raw body
const { db,displayHome } = require("./appHome");
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
//helper functions
// generateUUID
async function generateUniqueJobId()  {
  let jobId;
  let exists = true;

  while (exists) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    jobId = `JOB-${dateStr}-${randomStr}`;
    exists = false;
    try {
      const allUsers = db.getData("/"); // root object: { user1: { data: [...] }, user2: { data: [...] }, ... }

      for (const user in allUsers) {
        const userJobs = allUsers[user]?.data || [];
        if (userJobs.some((job) => job.JobId === jobId)) {
          exists = true;
          break;
        }
      }
    } catch (error) {
      // If /jobs doesn't exist yet, that's fine — it means no data yet
      exists = false;
    }
  }

  return jobId;
}

//events
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
        const jobId = actions[0].value;
        const userId = user.id;
        await openModal_view_detail(trigger_id,jobId);
        };
      if (type === "view_submission") {
        if (view.callback_id === "new_job_form") {
          const ts = new Date();
          const jobId = await generateUniqueJobId();
          const data = {
            JobId : jobId,
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
          // Get Slack message timestamp
          const messageTs = await notifyNewOrder(data, jobId);
          data.messageTs = messageTs;

          // Save job to DB (create or update)
          let jobs = [];
          try {
            jobs = await db.getData("/data/");
          } catch {
            jobs = [];
          }

          const jobIndex = jobs.findIndex((job) => job.JobId === jobId);
          if (jobIndex > -1) {
            jobs[jobIndex] = { ...jobs[jobIndex], ...data };
          } else {
            jobs.push(data);
          }
          await db.push("/data/", jobs, true);

          // Now update user's home view (with full job info incl. messageTs)
          await displayHome(user, data);
        }
        // Accept Modal Submission
        else if (view.callback_id === "accept_form") {
          const jobId = view.private_metadata;
          //from previous payloads (or from database)
          const data = await db.getData("/data") || [];
          const job = data.find(item => item.JobId === jobId);
          console.log(job.messageTs)
          const updatedData = {
            startDate: view.state.values.datepicker.accept_date.selected_date,
            startTime: view.state.values.timepicker.accept_time.selected_time,
            remarks: view.state.values.signature.remarks_input.value,
            status: `Accepted by ${view.state.values.accept_block.whoaccept.selected_option.text.text}`,
            JobId: jobId
            
          };
          const msg = `✅ Job *${jobId}* was *accepted* by <@${user.id}> on ${updatedData.acceptdate} at ${updatedData.accepttime}.\n *Status update:* ${updatedData.status}`

          await displayHome(user, updatedData);
          //Notify the channel
          await threadNotify(msg,job.messageTs)
        }      
          // Reject Modal Submission
        else if (view.callback_id === "reject_form") {
          const jobId = view.private_metadata;
          //from previous payloads (or from database)
          const data = await db.getData("/data") || [];
          const job = data.find(item => item.JobId === jobId);
          
          const updatedData = {
          JobId: jobId,
          rejectdate: view.state.values.datepicker.reject_date.selected_date,
          rejecttime: view.state.values.timepicker.reject_time.selected_time,
          rejectreason:view.state.values.reason.reason_input.value,
          rejectby:view.state.values.reject_block.whoreject.selected_option.text.text,
          status: `Rejected by ${view.state.values.reject_block.whoreject.selected_option.text.text}`
        };  
          const msg = `✅ Job *${jobId}* was *rejected* by <@${user.id}> on ${updatedData.rejectdate} at ${updatedData.rejecttime}.\n *Status update:* ${updatedData.status}`

          await displayHome(user, updatedData);
          //Notify the channel
          await threadNotify(msg,job.messageTs);
        }        
          // Update progress Modal Submission
        else if (view.callback_id === "update_progress") {
          // console.log('view is ')
          // console.log(view.state.values)
          const jobId = view.private_metadata;
                    //from previous payloads (or from database)
          const data = await db.getData("/data") || [];
          const job = data.find(item => item.JobId === jobId);
          
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
            finish_pic:view.state.values.picture.finish_pic.files.map(file => file.url_private)|| []
          };
          const msg = `✅ Job *${jobId}* was *updated* by <@${user.id}> on ${updatedData.endDate} at ${updatedData.endTime}. Please <@${updatedData.supervisorUserId}> to check and approve the job!!\n *Status update:* ${updatedData.status}`

          await displayHome(user, updatedData);
          //Notify the channel
          await threadNotify(msg,job.messageTs);
        }        
          // Update progress Modal Submission
        else if (view.callback_id === "review_progress") {
          // console.log('view is ')
          // console.log(view.state.values)
          const jobId = view.private_metadata;
          //from previous payloads (or from database)
          const data = await db.getData("/data") || [];
          const job = data.find(item => item.JobId === jobId);
          
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
          const msg = `✅ Job *${jobId}* was *approved and completed* by <@${user.id}> on ${updatedData.checkDate} at ${updatedData.checkTime}.\n *Status update:* ${updatedData.status}`

          await displayHome(user, updatedData);
          //Notify the channel
          await threadNotify(msg,job.messageTs);
        }         
        // Update progress for daily job
        else if (view.callback_id === "daily_update") {
          const jobId = view.private_metadata;  // Job ID passed from the modal
          const ts = new Date();

          // Construct the job path for db2, making sure to include the jobId
          const jobPath = `/jobs/${jobId}`;
          console.log(view);
          try {
            // Try loading the existing job entry using the jobId
            const job = await db2.getData(jobPath).catch(() => null);

            if (!job) {
              console.error(`⚠️ Job ${jobId} not found in DB`);
              return;  // If the job does not exist, exit the function
            }

            // Extract state values from the modal submission
            const state = view.state.values;

            // Construct the updated job object
            const updatedJob = {
              ...job,
              timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
              remarks: state.comments?.remarks_input?.value || null,
              supervisorUser: state.supervisor_notify?.notify_supervisor?.selected_option?.value || null,
              startDate: state.date?.datepickeraction?.selected_date || null,
              startTime: state.time?.timepickeraction?.selected_time || null,
              endDate: state.date?.datepickeraction?.selected_date || null,
              endTime: state.time?.timepickeraction?.selected_time || null,
              finish_pic: state.picture.file_general_input.files.map(file => file.url_private)|| [],
              status: "Waiting for Supervisor approval"
            };

            // Save the updated job to the DB (merge instead of overwrite)
            await db2.push(jobPath, updatedJob, false);  // false = merge
            // Optional: Notify a Slack channel about the job completion
            try {
              const res = await axios.post(
                "https://slack.com/api/chat.postMessage",
                {
                  channel: process.env.SLACK_NOTIFICATION_CHANNEL_ID,
                  text: `✅ *Daily Job ${jobId}* was completed.`,
                },
                 // <@${view.user.id}>
                {
                  headers: {
                    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              if (res.data.ok) {
                return res.data.ts;  // Return the Slack message timestamp
              } else {
                console.error("Slack API error:", res.data.error);
                return null;
              }
            } catch (err) {
              console.error("Error sending Slack notification:", err.message || err);
              return null;
            }

          } catch (error) {
            console.error("Error updating job:", error.message || error);
            return null;
          }
        }
        // Update progress for Project
        else if (view.callback_id === "project_update") {
          const jobId = view.private_metadata;  // Job ID passed from the modal
          const ts = new Date();

          // Construct the job path for db3, making sure to include the jobId
          const jobPath = `/jobs/${jobId}`;
          console.log(db3);
          try {
            // Try loading the existing job entry using the jobId
            const job = await db3.getData(jobPath).catch(() => null);

            if (!job) {
              console.error(`⚠️ Job ${jobId} not found in DB`);
              return;  // If the job does not exist, exit the function
            }

            // Extract state values from the modal submission
            const state = view.state.values;

            // Construct the updated job object
            const updatedJob = {
              ...job,
              timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
              remarks: state.comments?.remarks_input?.value || null,
              supervisorUser: state.supervisor_notify?.notify_supervisor?.selected_option?.value || null,
              startDate: state.date?.datepickeraction?.selected_date || null,
              startTime: state.time?.timepickeraction?.selected_time || null,
              endDate: state.date?.datepickeraction?.selected_date || null,
              endTime: state.time?.timepickeraction?.selected_time || null,
              finish_pic: state.picture.file_general_input.files.map(file => file.url_private)|| [],
              status: "Waiting for Supervisor approval"
            };

            // Save the updated job to the DB (merge instead of overwrite)
            await db3.push(jobPath, updatedJob, false);  // false = merge
            // Optional: Notify a Slack channel about the job completion
            try {
              const res = await axios.post(
                "https://slack.com/api/chat.postMessage",
                {
                  channel: process.env.SLACK_NOTIFICATION_CHANNEL_ID,
                  text: `✅ *Daily Job ${jobId}* was completed.`,
                },
                 // <@${view.user.id}>
                {
                  headers: {
                    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              if (res.data.ok) {
                return res.data.ts;  // Return the Slack message timestamp
              } else {
                console.error("Slack API error:", res.data.error);
                return null;
              }
            } catch (err) {
              console.error("Error sending Slack notification:", err.message || err);
              return null;
            }

          } catch (error) {
            console.error("Error updating job:", error.message || error);
            return null;
          }
        }

      }
        else if (actions) {
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
            //Open modal for Daily jobs
            await openModal_supervisor_approval(trigger_id,jobId);
          }

          //
          // Daily section
          //
          else if (action.action_id === "open_daily_job") {
            //Open home modal for Daily job
            await openModal_daily_job(trigger_id,user.id);
          }
          else if (action.action_id === "update_daily") {
          //Open modal for update progress
            const jobId = action.value
            console.log(view)
            await openModal_daily_update(view.id,jobId)
          }
          //
          // Project section
          //
          else if (action.action_id === "long_project") {
            //Open home modal for update progress
            await openModal_projects(trigger_id,user.id);
          }
          else if (action.action_id === "update_finish_project") {
            //Open modal for update progress
            const jobId = action.value
            console.log(view)
            await  openModal_project_update(view.id,jobId);
          }
    
          //Daily approval
          else if (action.action_id === "approve_daily") {
            //Open modal for update progress
            const jobId = action.value
            console.log(jobId)
            await openModal_general_approval(view.id,jobId,true);
          }
          //Project approval
          else if (action.action_id === "approve_project") {
            //Open modal for update progress
            const jobId = action.value
            console.log(jobId)
            await openModal_general_approval(view.id,jobId);
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


// Serve your JSON file to Power BI
// app.get("/data-export", (req, res) => {
//   const filePath = path.join(__dirname, "myDatabase.json");
//   res.sendFile(filePath);
// });
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
