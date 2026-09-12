import React, { useState } from 'react';
import '../styles/HomePage.css';

function HomePage() {
  const [jobRole, setJobRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      // API call will be implemented
      console.log('Analyzing...');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="homepage">
      <section className="hero">
        <h1>Resume Fixer</h1>
        <p>Optimize your resume for any job role</p>
      </section>

      <section className="analyzer">
        <div className="analyzer-container">
          <div className="input-group">
            <label>Job Role</label>
            <input
              type="text"
              placeholder="e.g., Software Engineer"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="input-group">
            <label>Job Description</label>
            <textarea
              placeholder="Paste the job description..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="textarea-field"
              rows="6"
            ></textarea>
          </div>

          <div className="input-group">
            <label>Your Resume</label>
            <textarea
              placeholder="Paste your resume content..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="textarea-field"
              rows="8"
            ></textarea>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !jobRole || !jobDescription || !resumeText}
            className="btn btn-primary btn-large"
          >
            {loading ? 'Analyzing...' : 'Analyze & Optimize'}
          </button>
        </div>
      </section>

      <section className="features">
        <h2>Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Keyword Matching</h3>
            <p>Match your resume with job requirements</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Score Analysis</h3>
            <p>Get a detailed match score for any position</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💡</div>
            <h3>Smart Suggestions</h3>
            <p>Receive actionable improvements for your resume</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✨</div>
            <h3>Optimization</h3>
            <p>Get an optimized version of your resume</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
