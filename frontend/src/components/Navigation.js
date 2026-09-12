import React from 'react';
import '../styles/Navigation.css';

function Navigation() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <a href="/">📄 Resume Fixer</a>
        </div>
        <ul className="navbar-menu">
          <li><a href="/">Home</a></li>
          <li><a href="/dashboard">Dashboard</a></li>
          <li><a href="/analysis">Analysis</a></li>
          <li><a href="/settings">Settings</a></li>
          <li><a href="/login">Login</a></li>
        </ul>
      </div>
    </nav>
  );
}

export default Navigation;
