import React, { useState } from 'react';
import '../styles/SettingsPage.css';

function SettingsPage() {
  const [preferences, setPreferences] = useState({
    theme: 'light',
    notifications: true,
    autoSave: true
  });

  const handleChange = (key, value) => {
    setPreferences({ ...preferences, [key]: value });
  };

  return (
    <div className="settings">
      <h1>Settings</h1>
      <div className="settings-form">
        <div className="settings-group">
          <label>Theme</label>
          <select
            value={preferences.theme}
            onChange={(e) => handleChange('theme', e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        <div className="settings-group">
          <label>Enable Notifications</label>
          <input
            type="checkbox"
            checked={preferences.notifications}
            onChange={(e) => handleChange('notifications', e.target.checked)}
          />
        </div>

        <div className="settings-group">
          <label>Auto Save</label>
          <input
            type="checkbox"
            checked={preferences.autoSave}
            onChange={(e) => handleChange('autoSave', e.target.checked)}
          />
        </div>

        <button className="btn btn-primary">Save Settings</button>
      </div>
    </div>
  );
}

export default SettingsPage;
