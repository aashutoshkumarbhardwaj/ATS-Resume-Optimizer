import React, { useState, useEffect } from 'react';
import AnalysisResults from '../components/AnalysisResults';
import '../styles/AnalysisPage.css';

function AnalysisPage() {
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  useEffect(() => {
    // Fetch analysis history from API
    console.log('Fetching analysis history...');
  }, []);

  return (
    <div className="analysis-page">
      <h1>Analysis History</h1>
      <div className="analysis-container">
        <div className="history-list">
          {analysisHistory.length === 0 ? (
            <p>No analyses yet. Create one on the home page.</p>
          ) : (
            analysisHistory.map((analysis, index) => (
              <div
                key={index}
                className={`history-item ${selectedAnalysis?.id === analysis.id ? 'active' : ''}`}
                onClick={() => setSelectedAnalysis(analysis)}
              >
                <div className="history-title">{analysis.jobRole}</div>
                <div className="history-score">{analysis.score}%</div>
                <div className="history-date">{new Date(analysis.createdAt).toLocaleDateString()}</div>
              </div>
            ))
          )}
        </div>
        <div className="results-panel">
          {selectedAnalysis && <AnalysisResults results={selectedAnalysis} />}
        </div>
      </div>
    </div>
  );
}

export default AnalysisPage;
