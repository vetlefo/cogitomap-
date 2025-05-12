import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import App from './App';
// NOTION INTEGRATION MOVED TO POST-MVP (v1.3-1.5)
// import NotionPage from './pages/NotionPage';

// Import UI components
import { Button } from './components/ui/button';

// Define a simple navigation component
const Navigation: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-black/70 backdrop-blur-md z-50 p-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <Link to="/" className="text-blue-400 hover:text-blue-300 font-bold">
            CogitoMap
          </Link>
          
          <div className="ml-6 flex space-x-1">
            {/* NOTION INTEGRATION MOVED TO POST-MVP (v1.3-1.5)
            <Link to="/notion">
              <Button variant="ghost" className="text-xs h-8 px-2">
                Notion
              </Button>
            </Link>
            */}
          </div>
        </div>
      </div>
    </nav>
  );
};

// Define a loading component
const Loading: React.FC = () => (
  <div className="w-full h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// Main application with routing
const AppWithRouter: React.FC = () => {
  return (
    <Router>
      <Navigation />
      <div className="pt-12"> {/* Add padding to account for the fixed navbar */}
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<App />} />
            {/* NOTION INTEGRATION MOVED TO POST-MVP (v1.3-1.5)
            <Route path="/notion" element={<NotionPage />} />
            */}
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
};

export default AppWithRouter;