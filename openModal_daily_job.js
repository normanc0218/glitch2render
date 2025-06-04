const axios = require('axios');
const { fetchCalendar } = require('./fetchCalendar');

const openModal_daily_job = async(trigger_id) => {
  //Use Fai's daily as a sample
    const now = new Date();
    const events = await fetchCalendar('3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com');
    if (events && events.length > 0) {
    // Get the first event's ETag and generate a sample JobId
    const job = events[0];  // Let's use the first event for testing purposes
    
    const jobs = {
      JobId: `JOB-${now.toISOString()}-${job.etag.slice(0, 6)}`,  // Use first 6 characters of ETag
    };

    console.log(jobs);  // Output the generated JobId
    const blocks=[]
    }
  }
// module.exports = { openModal_daily_job};