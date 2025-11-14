import React from 'react';
import '../styles/AnalysisResults.css';

function AnalysisResults({ results }) {
  if (!results) return null;

  return (
    <div className="results-container">
      <div className="score-card">
        <h2>Match Score</h2>
        <div className="score-circle">
          <span className="score-value">{results.score}%</span>
          <div className="score-bar">
            <div className="score-fill" style={{ width: `${results.score}%` }}></div>
          </div>
        </div>
      </div>

      <div className="suggestions-card">
        <h3>Suggestions</h3>
        <ul className="suggestions-list">
          {results.suggestions && results.suggestions.map((suggestion, index) => (
            <li key={index}>
              <span className="suggestion-icon">✓</span>
              {suggestion}
            </li>
          ))}
        </ul>
      </div>

      <div className="skills-card">
        <div className="skills-section">
          <h4>Matched Skills</h4>
          <div className="skills-list">
            {results.matchedSkills && results.matchedSkills.map((skill, index) => (
              <span key={index} className="skill-badge matched">
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="skills-section">
          <h4>Missing Skills</h4>
          <div className="skills-list">
            {results.missingSkills && results.missingSkills.map((skill, index) => (
              <span key={index} className="skill-badge missing">
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {results.optimizedResume && (
        <div className="optimized-card">
          <h3>Optimized Resume Preview</h3>
          <div className="optimized-content">
            {results.optimizedResume.substring(0, 300)}...
          </div>
          <button className="btn btn-primary">Download Optimized Resume</button>
        </div>
      )}
    </div>
  );
}

export default AnalysisResults;
