import { google } from "googleapis";

export default async function handler(req, res) {
  const body = req.body;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;

  try {
    if (body.action === "login") {
      // Read sheet data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Attendance!A:E",
      });
      const rows = response.data.values || [];

      // Find student
      let found = rows.find(r => r[1] === body.id);
      if (!found) {
        return res.json({ success: false, message: "Student ID not found. Please sign up first." });
      }
      if (found[2] !== body.password) {
        return res.json({ success: false, message: "Incorrect password!" });
      }

      // Calculate overall
      let percentages = found.slice(3).map(v => parseFloat(v) || 0);
      let overall = 0;
      if (percentages.length) {
        overall = (percentages.reduce((a, b) => a + b, 0) / (percentages.length * 100)) * 100;
      }

      return res.json({ success: true, overall: overall.toFixed(2) });
    }

    if (body.action === "submit") {
      // Append attendance data
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Attendance!A:E",
        valueInputOption: "RAW",
        requestBody: {
          values: [[body.name, body.id, "", body.week, body.attendance]],
        },
      });

      return res.json({ message: "Attendance submitted successfully!", overall: body.attendance });
    }

    res.json({ message: "Invalid action." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error", error: err.message });
  }
}
