// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

export default function App() {
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [newHabitName, setNewHabitName] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshAll = async () => {
    try {
      const response = await fetch(`${API_URL}/habits`);
      const habitsData = await response.json();
      setHabits(habitsData);

      const checkinsMap = {};
      for (const habit of habitsData) {
        const checkinsResponse = await fetch(`${API_URL}/habits/${habit.id}/checkins`);
        const checkinsData = await checkinsResponse.json();
        checkinsMap[habit.id] = checkinsData;
      }
      setCheckinsByHabit(checkinsMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    try {
      const response = await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHabitName.trim() }),
      });
      if (response.ok) {
        setNewHabitName('');
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCheckIn = async (habitId) => {
    try {
      const response = await fetch(`${API_URL}/habits/${habitId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    try {
      const response = await fetch(`${API_URL}/habits/${habitId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getLastSevenDays = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateStr = String(d.getDate()).padStart(2, '0');
      days.push({
        formatted: `${year}-${month}-${dateStr}`,
        dayNum: d.getDate()
      });
    }
    return days;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const lastSevenDays = getLastSevenDays();

  return (
    <div className="container">
      <h1>🔥 Habit Tracker</h1>

      <div className="new-habit-card">
        <form onSubmit={handleAddHabit} className="new-habit-form">
          <input
            type="text"
            placeholder="e.g. Drink 2L water"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
          />
          <button type="submit">Add Habit</button>
        </form>
      </div>

      {loading ? (
        <div className="status-msg">Loading your habits...</div>
      ) : habits.length === 0 ? (
        <div className="status-msg">No habits yet. Add one above to get started!</div>
      ) : (
        <div className="habit-list">
          {habits.map((habit) => {
            const history = checkinsByHabit[habit.id] || [];
            const isCheckedInToday = history.includes(todayStr);

            return (
              <div key={habit.id} className="habit-card">
                <h3>{habit.name}</h3>
                
                <p className={`streak-text ${habit.streak > 0 ? 'active-streak' : ''}`}>
                  {habit.streak > 0 ? `🔥 ${habit.streak} day streak` : 'No streak yet — check in today!'}
                </p>

                <button
                  className={`checkin-btn ${isCheckedInToday ? 'checked-in' : ''}`}
                  disabled={isCheckedInToday}
                  onClick={() => handleCheckIn(habit.id)}
                >
                  {isCheckedInToday ? '✅ Checked in today' : 'Check In'}
                </button>

                <div className="history-row">
                  {lastSevenDays.map((day) => {
                    const isDone = history.includes(day.formatted);
                    return (
                      <div
                        key={day.formatted}
                        className={`history-box ${isDone ? 'done' : 'not-done'}`}
                        title={day.formatted}
                      >
                        {day.dayNum}
                      </div>
                    );
                  })}
                </div>

                <button
                  className="delete-btn"
                  onClick={() => handleDeleteHabit(habit.id)}
                >
                  Delete Habit
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}