const { fetchCalendar } = require('./fetchCalendar');

(async () => {
  const now = new Date();
  const events = await fetchCalendar('3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com');
  const jobDate = now.toISOString().split('T')[0].replace(/-/g, '');
  if (events && events.length > 0) {
    const job = events[0];
    const jobId = `JOB-${jobDate}-${job.etag.slice(1, 7)}`;
    console.log("Sample Job Info:");
    console.log({
      JobId: jobId,
      Summary: job.summary,
      Start: job.start?.dateTime || job.start?.date,
      End: job.end?.dateTime || job.end?.date,
    });
  } else {
    console.log("No events found.");
  }
})();
