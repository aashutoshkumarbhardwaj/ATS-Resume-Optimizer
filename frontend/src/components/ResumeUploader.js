import React, { useState } from 'react';
import '../styles/ResumeUploader.css';

function ResumeUploader({ onUpload }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      onUpload && onUpload(droppedFile);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      onUpload && onUpload(selectedFile);
    }
  };

  return (
    <div className="uploader-container">
      <div
        className={`upload-area ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleChange}
          className="file-input"
        />
        <label htmlFor="file-upload" className="upload-label">
          <div className="upload-icon">📁</div>
          <p>Drag and drop your resume or <span>click to upload</span></p>
          <small>Supported: PDF, DOC, DOCX, TXT</small>
        </label>
      </div>
      {file && <p className="file-name">Selected: {file.name}</p>}
    </div>
  );
}

export default ResumeUploader;
