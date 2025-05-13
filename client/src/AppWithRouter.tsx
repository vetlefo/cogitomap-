import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import App from './App';
// NOTION INTEGRATION MOVED TO POST-MVP (v1.3-1.5)
// import NotionPage from './pages/NotionPage';

// Import UI components
import { Button } from './components/ui/button';

// Import ModelSelector
import ModelSelector from './components/ModelSelector';

// NEW Navigation with fixed height and sticky stacking context
const NAV_HEIGHT = 48; // 3 rem
const Navigation: React.FC = () => (
  <header
    className="fixed inset-x-0 top-0 z-[100] h-12 flex items-center gap-4 bg-background/90
               backdrop-blur-md shadow-md px-4"
  >
    <Link to="/" className="text-blue-400 hover:text-blue-300 font-bold">
      <img src="/logo.svg" alt="CogitoMap" className="h-8 w-auto" onError={(e) => {
        // Fallback if image doesn't exist
        e.currentTarget.style.display = 'none';
        e.currentTarget.parentElement!.textContent = 'CogitoMap';
      }} />
    </Link>
    <ModelSelector className="ml-auto" /> {/* now visible, never covered */}
  </header>
);

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
      <div className="pt-16 min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<App />} />
              {/* NOTION INTEGRATION MOVED TO POST-MVP (v1.3-1.5)
              <Route path="/notion" element={<NotionPage />} />
              */}
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
};

export default AppWithRouter;