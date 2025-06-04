const axios = require('axios');
const { fetchCalendar } = require('./fetchCalendar');


const openModal_daily_job = async(trigger_id, jobId) => {
  //Use Fai's daily as a sample
    const events = await fetchCalendar('3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com');
    const job={
      JobId: `JOB-${events.etag}`,
              }
    const blocks=[]
    }
// module.exports = { openModal_daily_job};