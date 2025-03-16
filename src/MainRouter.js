import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import App from './App'; // Import your main App component
import Journey from './components/Journey'; // Import the Journey component
import Home from './components/Home'; // Import the Home component

const MainRouter = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} /> {/* Your main app component */}
        <Route path="/new-journey" element={<Journey />} /> {/* New journey route */}
        {/* Add more routes here as needed */}
      </Routes>
    </Router>
  );
};

export default MainRouter; 