import React from 'react';
import '../styles/DashboardPage.css';

function DashboardPage() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Total Analyses</h3>
          <p className="stat">0</p>
        </div>
        <div className="dashboard-card">
          <h3>Average Score</h3>
          <p className="stat">-</p>
        </div>
        <div className="dashboard-card">
          <h3>Last Analysis</h3>
          <p className="stat">-</p>
        </div>
        <div className="dashboard-card">
          <h3>Active Resumes</h3>
          <p className="stat">0</p>
        </div>
      </div>
      <div className="dashboard-section">
        <h2>Recent Analyses</h2>
        <p>No recent analyses</p>
      </div>
    </div>
  );
}

export default DashboardPage;
