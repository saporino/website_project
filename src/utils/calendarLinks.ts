export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  durationMinutes?: number;
}

function fmtGoogle(d: Date) { return d.toISOString().replace(/[-:]/g, '').replace('.000', ''); }

export function googleCalendarLink(e: CalendarEvent): string {
  const end = new Date(e.startDate.getTime() + (e.durationMinutes ?? 60) * 60000);
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${fmtGoogle(e.startDate)}/${fmtGoogle(end)}`, details: e.description ?? '', location: e.location ?? '' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function outlookCalendarLink(e: CalendarEvent): string {
  const end = new Date(e.startDate.getTime() + (e.durationMinutes ?? 60) * 60000);
  const p = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: e.title, startdt: e.startDate.toISOString(), enddt: end.toISOString(), body: e.description ?? '', location: e.location ?? '' });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}

export function icsFileContent(e: CalendarEvent): string {
  const end = new Date(e.startDate.getTime() + (e.durationMinutes ?? 60) * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Saporino RepCo//PT','BEGIN:VEVENT',
    `DTSTART:${fmt(e.startDate)}`,`DTEND:${fmt(end)}`,`SUMMARY:${e.title}`,
    `DESCRIPTION:${e.description ?? ''}`,`LOCATION:${e.location ?? ''}`,
    `UID:${Date.now()}@saporino-repco`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
}

export function downloadICS(e: CalendarEvent) {
  const blob = new Blob([icsFileContent(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `visita-${e.title.replace(/\s+/g,'-').toLowerCase()}.ics`; a.click();
  URL.revokeObjectURL(url);
}
