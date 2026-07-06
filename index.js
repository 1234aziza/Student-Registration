// backend/index.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite database connection to a file named data.db
const db = new Database('data.db');

// Create the habits table to track the master list of habits
db.prepare(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`).run();

// Create the checkins table to track completions of specific habits per calendar day
db.prepare(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
  )
`).run();

/**
 * The calculateStreak function takes a habitId and reviews historical checkins ordered descending by calendar date.
 * It dynamically computes today's and yesterday's date strings in the format YYYY-MM-DD.
 * If there is no check-in logged for both today and yesterday, the streak is broken and returns 0.
 * If yesterday has a check-in but today does not, it safely preserves the streak and counts sequentially backward from yesterday.
 * It loops dynamically day by day backwards using a lookup Set until a calendar date without a recorded check-in is found.
 */
function calculateStreak(habitId) {
  const checkins = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  if (checkins.length === 0) return 0;
  
  const checkinDates = new Set(checkins.map(c => c.date));
  
  const todayObj = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];
  
  const todayStr = formatDate(todayObj);
  
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = formatDate(yesterdayObj);
  
  if (!checkinDates.has(todayStr) && !checkinDates.has(yesterdayStr)) {
    return 0;
  }
  
  let currentStr = checkinDates.has(todayStr) ? todayStr : yesterdayStr;
  let currentObj = new Date(currentStr);
  let streak = 0;
  
  while (checkinDates.has(formatDate(currentObj))) {
    streak++;
    currentObj.setDate(currentObj.getDate() - 1);
  }
  
  return streak;
}

// ROUTE A — POST /habits: Creates a brand new habit tracking item
app.post('/habits', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: "name is required" });
  }
  
  const createdAt = new Date().toISOString();
  const info = db.prepare('INSERT INTO habits (name, created_at) VALUES (?, ?)').run(name.trim(), createdAt);
  
  res.status(201).json({
    id: info.lastInsertRowid,
    name: name.trim(),
    created_at: createdAt,
    streak: 0
  });
});

// ROUTE B — GET /habits: Lists all habits along with their dynamically computed streak counters
app.get('/habits', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits ORDER BY created_at ASC').all();
  const updatedHabits = habits.map(habit => {
    habit.streak = calculateStreak(habit.id);
    return habit;
  });
  res.status(200).json(updatedHabits);
});

// ROUTE C — POST /habits/:id/checkin: Registers a completion event for a habit on a given date
app.post('/habits/:id/checkin', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  let { date } = req.body;
  
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }
  
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(habitId);
  if (!habit) {
    return res.status(404).json({ error: "Habit not found" });
  }
  
  try {
    const checkedAt = new Date().toISOString();
    db.prepare('INSERT INTO checkins (habit_id, date, checked_at) VALUES (?, ?, ?)').run(habitId, date, checkedAt);
    
    const updatedStreak = calculateStreak(habitId);
    res.status(201).json({
      id: habitId,
      habit_id: habitId,
      date: date,
      checked_at: checkedAt,
      streak: updatedStreak
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: "Already checked in for this date" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ROUTE D — GET /habits/:id/checkins: Returns an array of simple calendar date strings for completed check-ins
app.get('/habits/:id/checkins', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(habitId);
  if (!habit) {
    return res.status(404).json({ error: "Habit not found" });
  }
  
  const checkins = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  const dateStrings = checkins.map(c => c.date);
  res.status(200).json(dateStrings);
});

// ROUTE E — DELETE /habits/:id/checkin/:date: Reverses or removes a specific recorded history entry logging checklist satisfaction for a unique targeted day
app.delete('/habits/:id/checkin/:date', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const { date } = req.params;
  
  db.prepare('DELETE FROM checkins WHERE habit_id = ? AND date = ?').run(habitId, date);
  res.status(200).json({ message: "Checkin removed" });
});

// ROUTE F — DELETE /habits/:id: Completely purges a habit definition and all corresponding check-in historical logs
app.delete('/habits/:id', (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  
  db.prepare('DELETE FROM checkins WHERE habit_id = ?').run(habitId);
  db.prepare('DELETE FROM habits WHERE id = ?').run(habitId);
  
  res.status(200).json({ message: `Habit ${habitId} and its checkins deleted` });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});