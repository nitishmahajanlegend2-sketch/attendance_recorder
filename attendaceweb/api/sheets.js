import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), 'credentials.json'), // your downloaded service account key
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID"; // Get from Google Sheets URL

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Login validation
    const { studentID, password } = req.query;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'AttendanceData!A2:H',
    });
    const rows = response.data.values || [];

    const user = rows.find(row => row[0] === studentID);
    if (!user) {
      return res.json({ success: false, message: "User not found. Sign up first." });
    }
    if (user[2] !== password) {
      return res.json({ success: false, message: "Incorrect password." });
    }

    // Calculate overall
    const weeks = user.slice(3).filter(Boolean).map(Number);
    const overall = (weeks.reduce((a,b)=>a+b,0) / (weeks.length*100)) * 100;
    return res.json({ success: true, overall });
  }

  if (req.method === 'POST') {
    const { studentID, name, week, attendance } = req.body;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'AttendanceData!A2:H',
    });
    const rows = response.data.values || [];

    let rowIndex = rows.findIndex(r => r[0] === studentID);
    if (rowIndex === -1) {
      // New student
      const newRow = [studentID, name, "password", "", "", "", "", ""];
      newRow[2] = ""; // password set on signup
      newRow[week+2] = attendance.toFixed(2);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'AttendanceData!A2',
        valueInputOption: 'RAW',
        resource: { values: [newRow] }
      });
    } else {
      // Update existing
      const cell = `AttendanceData!D${rowIndex+2+week-1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `AttendanceData!${String.fromCharCode(68+week-1)}${rowIndex+2}`,
        valueInputOption: 'RAW',
        resource: { values: [[attendance.toFixed(2)]] }
      });
    }

    const weeks = rows[rowIndex]?.slice(3).filter(Boolean).map(Number) || [];
    const overall = (weeks.reduce((a,b)=>a+b,0) / (weeks.length*100)) * 100;
    return res.json({ success: true, overall });
  }
}
