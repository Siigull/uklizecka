import * as db from './db.js';

import { createCanvas } from 'canvas';

/**
 * Generates a Gantt-style cleaning schedule
 * Toto bylo vibecodenute. Bojim se kouknout dovnitř
 * @param {string} start_str - Interval start (YYYY-MM-DD)
 * @param {string} end_str - Interval end (YYYY-MM-DD)
 */
export async function generate_cleaning_report_image(start_str, end_str) {
  const cleanings = db.get_cleanings(start_str, end_str);
  if (cleanings.length === 0) return null;

  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const firstDate = new Date(cleanings.reduce((min, c) => c.date_start < min ? c.date_start : min, cleanings[0].date_start));
  const lastDate = new Date(cleanings.reduce((max, c) => c.date_end > max ? c.date_end : max, cleanings[0].date_end));

  const weekStart = getMonday(firstDate);
  const totalWeeks = Math.ceil(((lastDate - weekStart) / (1000 * 60 * 60 * 24) + 1) / 7);

  const templatesMap = new Map();
  cleanings.forEach(c => {
    if (!templatesMap.has(c.template_rel)) {
      templatesMap.set(c.template_rel, { 
        name: c.template.name, 
        place: c.template.place, 
        max_users: c.template.max_users,
        instances: [] 
      });
    }
    templatesMap.get(c.template_rel).instances.push(c);
  });

  const templateIds = Array.from(templatesMap.keys());

  // Layout Constants
  const sidebarWidth = 350;
  const weekWidth = 750; 
  const rowHeight = 220; // Increased to fit status, capacity, and several names comfortably
  const headerHeight = 100;
  const padding = 60;

  const width = sidebarWidth + (totalWeeks * weekWidth) + padding;
  const height = headerHeight + (templateIds.length * rowHeight) + padding;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#23272a';
  ctx.fillRect(0, 0, width, height);

  const fillTextTruncated = (text, x, y, maxWidth) => {
    let currentText = String(text || "");
    if (ctx.measureText(currentText).width > maxWidth) {
      while (ctx.measureText(currentText + "...").width > maxWidth && currentText.length > 0) {
        currentText = currentText.slice(0, -1);
      }
      currentText += "...";
    }
    ctx.fillText(currentText, x, y);
  };

  // --- DRAW WEEKLY HEADERS ---
  for (let w = 0; w < totalWeeks; w++) {
    const weekX = sidebarWidth + (w * weekWidth);
    const currentWeekStart = new Date(weekStart);
    currentWeekStart.setDate(weekStart.getDate() + (w * 7));
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    const dateRange = `${currentWeekStart.getDate()}.${currentWeekStart.getMonth() + 1}. — ${currentWeekEnd.getDate()}.${currentWeekEnd.getMonth() + 1}.`;
    ctx.fillText(dateRange, weekX + 30, 65);

    ctx.strokeStyle = '#4f545c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(weekX, 0);
    ctx.lineTo(weekX, height);
    ctx.stroke();
  }

  // --- DRAW ROWS ---
  templateIds.forEach((tid, idx) => {
    const y = headerHeight + (idx * rowHeight);
    const template = templatesMap.get(tid);

    // Sidebar text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    fillTextTruncated(template.name, 40, y + 80, sidebarWidth - 60);
    
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#99aab5';
    fillTextTruncated(template.place, 40, y + 120, sidebarWidth - 60);

    ctx.save();
    ctx.beginPath();
    ctx.rect(sidebarWidth, 0, width - sidebarWidth, height);
    ctx.clip();

    template.instances.forEach(c => {
      const dayOffset = (new Date(c.date_start) - weekStart) / (1000 * 60 * 60 * 24);
      const dayDuration = ((new Date(c.date_end) - new Date(c.date_start)) / (1000 * 60 * 60 * 24)) + 1;

      const pixelsPerDay = weekWidth / 7;
      const blockX = sidebarWidth + (dayOffset * pixelsPerDay) + 15;
      const blockW = (dayDuration * pixelsPerDay) - 30;
      const blockY = y + 20;
      const blockH = rowHeight - 40;

      // Draw Pill
      ctx.fillStyle = c.finished ? '#43b581' : '#f04747';
      ctx.beginPath();
      ctx.roundRect(blockX, blockY, blockW, blockH, 20);
      ctx.fill();

      // Top Status Bar (DONE / ID + Count)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';

      const statusText = c.finished ? 'DONE' : `#${c.id}`;
      ctx.fillText(statusText, blockX + 25, blockY + 45);
      
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${c.users.length}/${template.max_users}`, blockX + blockW - 25, blockY + 45);
      ctx.textAlign = 'left';

      // Divider Line inside Pill
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(blockX + 20, blockY + 65);
      ctx.lineTo(blockX + blockW - 20, blockY + 65);
      ctx.stroke();

      // Participant Names
      ctx.font = '18px sans-serif';
      const maxDisplay = 4;
      const displayUsers = c.users.slice(0, maxDisplay);
      
      displayUsers.forEach((userObj, uIdx) => {
        const userName = userObj.name || "Unknown";
        fillTextTruncated(`• ${userName}`, blockX + 25, blockY + 95 + (uIdx * 25), blockW - 50);
      });

      if (c.users.length > maxDisplay) {
        ctx.font = 'italic 16px sans-serif';
        ctx.fillText(`+ ${c.users.length - maxDisplay} more...`, blockX + 25, blockY + 95 + (maxDisplay * 25));
      }
    });
    ctx.restore();
  });

  return {
    file: canvas.toBuffer('image/png'),
    name: 'cleaning_weekly_names.png'
  };
}
