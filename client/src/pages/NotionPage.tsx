import React from 'react';
import NotionIntegration from '../components/NotionIntegration';

const NotionPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notion Integration</h1>
        <p className="text-gray-700">
          Connect CogitoMap with your Notion workspace to synchronize your knowledge graph.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-8">
        <NotionIntegration />
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Connection Issues</h3>
              <p className="text-sm text-gray-600">
                If you're having trouble connecting to Notion, try these steps:
              </p>
              <ol className="list-decimal ml-5 mt-2 text-sm">
                <li>Verify that your integration token is correct</li>
                <li>Make sure your integration has the necessary capabilities (read/write content)</li>
                <li>Check that the page URL is correct and accessible</li>
                <li>Share the page with your integration via the Share button in Notion</li>
              </ol>
            </div>
            
            <div>
              <h3 className="font-medium">Page ID Format</h3>
              <p className="text-sm text-gray-600">
                Notion page IDs can be in different formats. The most common is:
              </p>
              <div className="mt-2 p-2 bg-gray-100 rounded text-sm font-mono">
                xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
              </div>
              <p className="text-sm text-gray-600 mt-2">
                If using a page URL, it should look like:
              </p>
              <div className="mt-2 p-2 bg-gray-100 rounded text-sm font-mono break-all">
                https://www.notion.so/workspace/My-Page-abcdef123456789...
              </div>
            </div>
            
            <div>
              <h3 className="font-medium">Database Creation</h3>
              <p className="text-sm text-gray-600">
                If the databases don't appear in Notion after connection:
              </p>
              <ol className="list-decimal ml-5 mt-2 text-sm">
                <li>Make sure your integration has "Insert content" capability</li>
                <li>Check that you have sufficient permissions in the workspace</li>
                <li>Try manually creating a test page in the same workspace to confirm write access</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotionPage;