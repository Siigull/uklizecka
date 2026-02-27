import * as db from './db.js';
import * as cheerio from "cheerio";

import { createCanvas } from 'canvas';
import { MANAGER_ROLE } from './config.js';

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
  const rowHeight = 230; // Increased to fit status, capacity, and up to 6 names comfortably
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
      if (c.finished) {
        ctx.fillStyle = '#3b82f6'; // blue
      } else {
        // Improved color gradient: red (empty) -> orange/yellow (half) -> green (full)
        const joined = c.users.length;
        const max = template.max_users || 1;
        const ratio = Math.max(0, Math.min(1, joined / max));
        // Gradient stops:
        // 0.0: #f04747 (red)
        // 0.5: #f7b32b (orange/yellow)
        // 1.0: (green)
        let r, g, b;
        // TODO(Sigull): Maybe move color based on how many left
        //               When 2/3 it is basically green.
        if (ratio < 0.5) {
          // Red to yellow
          // #f04747 (240,71,71) to #f7b32b (247,179,43)
          const t = ratio / 0.5;
          r = Math.round(240 + (247 - 240) * t);
          g = Math.round(71 + (179 - 71) * t);
          b = Math.round(71 + (43 - 71) * t);
        } else {
          // Yellow to green
          // #f7b32b (247,179,43) to (50,205,50)
          const t = (ratio - 0.5) / 0.5;
          r = Math.round(247 + (50 - 247) * t);
          g = Math.round(179 + (205 - 179) * t);
          b = Math.round(43 + (50 - 43) * t);
        }
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      }
      ctx.beginPath();
      ctx.roundRect(blockX, blockY, blockW, blockH, 20);
      ctx.fill();


      // Top Status Bar (DONE / ID) - top left
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      const statusText = c.finished ? 'DONE' : `#${c.id}`;
      ctx.textAlign = 'left';
      ctx.fillText(statusText, blockX + 25, blockY + 45);

      // Users/Max Users - top right, big and bold
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${c.users.length}/${template.max_users}`, blockX + blockW - 25, blockY + 46);
      ctx.textAlign = 'left';

      // Divider Line inside Pill
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(blockX + 20, blockY + 65);
      ctx.lineTo(blockX + blockW - 20, blockY + 65);
      ctx.stroke();

      // Participant Names (up to 6, in two columns of 3 rows, truncate if too long)
      const maxDisplay = 6;
      const nameFontSize = 28;
      ctx.font = `bold ${nameFontSize}px sans-serif`;
      const nameLineHeight = nameFontSize + 8;
      const displayUsers = c.users.slice(0, maxDisplay);

      // Layout: two columns, three rows
      const namesPerCol = 3;
      const nameAreaWidth = blockW - 50;
      const nameColWidth = (nameAreaWidth - 20) / 2; // 2 columns, 20px gap
      const colX = [blockX + 25, blockX + 25 + nameColWidth + 20];
      for (let i = 0; i < displayUsers.length; i++) {
        const userObj = displayUsers[i];
        const userName = userObj.name || "Unknown";
        const col = Math.floor(i / namesPerCol);
        const row = i % namesPerCol;
        const x = colX[col];
        const y = blockY + 95 + row * nameLineHeight;
        fillTextTruncated(`• ${userName}`, x, y, nameColWidth - 10);
      }

      if (c.users.length > maxDisplay) {
        ctx.font = 'italic 20px sans-serif';
        ctx.fillText(`+ ${c.users.length - maxDisplay} more...`, blockX + 25, blockY + 95 + 3 * nameLineHeight);
      }
    });
    ctx.restore();
  });

  return {
    file: canvas.toBuffer('image/png'),
    name: 'cleaning_weekly_names.png'
  };
}

async function extract_semester_dates(url) {
  try {
    const response = await fetch(url);
    const html_string = await response.text();
    const $ = cheerio.load(html_string);

    const target_paragraph = $("p:contains('Výuka')").text();
    
    if (!target_paragraph) {
      return;
    }
    
    const regex = /(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/;
    const match = target_paragraph.match(regex);

    if (match) {
      const start_date = match[1];
      const end_date = match[2];
      return { start_date, end_date };
    }
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

export async function get_current_semester_dates() {
  const now = new Date();
  const shifted = new Date(now);
  shifted.setMonth(shifted.getMonth() - 7);
  const year = shifted.getFullYear();

  const winter_semester = await extract_semester_dates(`https://www.fit.vut.cz/study/schedule/11357/.cs?year=${year}&sem=Z`);
  const summer_semester = await extract_semester_dates(`https://www.fit.vut.cz/study/schedule/11357/.cs?year=${year}&sem=L`);

  const now_date = now.toISOString().split('T')[0];
  if (winter_semester && winter_semester.start_date && winter_semester.end_date) {
    if (now_date >= winter_semester.start_date && now_date <= winter_semester.end_date) {
      return winter_semester;
    }
  }
  if (summer_semester && summer_semester.start_date && summer_semester.end_date) {
    if (now_date >= summer_semester.start_date && now_date <= summer_semester.end_date) {
      return summer_semester;
    }
  }
  if (summer_semester && summer_semester.end_date) {
    let after_summer = summer_semester;
    const endDate = new Date(after_summer.end_date);
    endDate.setFullYear(endDate.getFullYear() + 1);
    after_summer.end_date = endDate.toISOString().split('T')[0];
    return after_summer;
  
  } else {
    return { start_date: "2000-01-01", end_date: "2100-01-01" };
  }
}

// nickname or just username if member doesn't have it
export function get_nick(member) {
  return member.nick ? member.nick : member.user.username;
}

export function is_manager(member) {
  return member.roles.some(r => r === MANAGER_ROLE);
}
