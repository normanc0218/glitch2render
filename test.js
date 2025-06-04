const { fetchCalendar } = require('./fetchCalendar');

function extractTimeFromISO(isoString) {
  // Extract the "T09:00:00" part and then slice "09:00"
  return isoString.split('T')[1].slice(0, 5); // returns "09:00"
}

(async () => {
  const now = new Date();
  //For Fai's 
  const events = await fetchCalendar('3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com');
  const jobDate = now.toISOString().split('T')[0].replace(/-/g, '');
  if (events && events.length > 0) {
    const job = events[0];
    const jobs ={
      JobId: `JOB-${jobDate}-${job.etag.slice(1, 7)}`,
      Assigned_to:`Fai`,
      Description: job.summary,
      Start: extractTimeFromISO(job.start.dateTime),
      End: extractTimeFromISO(job.end.dateTime) 
    }
  };
  blocks=[];
})();
