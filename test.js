const { fetchCalendar } = require('./fetchCalendar');

(async () => {
  const events = await fetchCalendar('3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com');
  console.log(events); // Now you can safely use the result
  
})();
