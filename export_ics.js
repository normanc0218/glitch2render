const fs = require('fs');

function formatICSDate(dateStr, timeStr) {
  const dt = new Date(`${dateStr}T${timeStr}`);
  return dt.toISOString().replace(/[-:]/g, '').split('.')[0];
}

function generateICSFromJobs(jobs) {
  let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\n";

  for (const job of jobs) {
    if (!job.orderdate || !job.ordertime) continue;

    const dtStart = formatICSDate(job.orderdate, job.ordertime);
    const dtEnd = job.endDate && job.endTime
      ? formatICSDate(job.endDate, job.endTime)
      : dtStart; // same time if no end

    icsContent += `
BEGIN:VEVENT
SUMMARY:${job.Description || 'Maintenance Task'}
DESCRIPTION:Job ID: ${job.JobId}\\nOrdered by: ${job.Orderedby}\\nStaff: ${job.maintenanceStaff?.join(', ')}
DTSTART:${dtStart}
DTEND:${dtEnd}
LOCATION:${job.machineLocation || 'N/A'}
STATUS:CONFIRMED
END:VEVENT
    `.trim() + '\n';
  }

  icsContent += "END:VCALENDAR";
  return icsContent;
}

// Example: export file
const jobsData = require('./myDatabase.json');
const jobs=jobsData.data;// your job data here
console.log(jobs)
const ics = generateICSFromJobs(jobs);
fs.writeFileSync('jobs_schedule.ics', ics);
console.log("ICS file created: jobs_schedule.ics");
