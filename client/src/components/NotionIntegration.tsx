import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { ExternalLink, CheckCircle, AlertCircle, Database } from 'lucide-react';

interface NotionStatus {
  connected: boolean;
  databases: {
    nodes: boolean;
    edges: boolean;
  };
}

const NotionIntegration: React.FC = () => {
  const [status, setStatus] = useState<NotionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Check Notion connection status on component mount
  useEffect(() => {
    checkStatus();
  }, []);
  
  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/notion/status');
      
      if (!response.ok) {
        throw new Error(`Failed to check Notion status: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check Notion status');
      console.error('Error checking Notion status:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSync = async (direction: 'pull' | 'push', nodeTypes: string[] = [], syncEdges: boolean = true) => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    
    try {
      const response = await fetch('/api/notion/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          direction,
          nodeTypes,
          syncEdges
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      setSyncResult(result);
      
      // Refresh status after sync
      checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync operation failed');
      console.error('Error during sync:', err);
    } finally {
      setSyncing(false);
    }
  };
  
  const renderSetupInstructions = () => (
    <div className="space-y-4 py-4">
      <h3 className="text-lg font-semibold">Setup Instructions</h3>
      <ol className="space-y-3 list-decimal pl-5">
        <li>
          Go to <a 
            href="https://www.notion.so/my-integrations" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 flex items-center"
          >
            Notion Integrations <ExternalLink className="h-4 w-4 ml-1" />
          </a>
        </li>
        <li>Create a new integration with a name like "CogitoMap"</li>
        <li>
          Set the following capabilities:
          <ul className="list-disc pl-5 mt-1">
            <li>Read content</li>
            <li>Update content</li>
            <li>Insert content</li>
          </ul>
        </li>
        <li>Copy the "Internal Integration Secret"</li>
        <li>Add it as the <code>NOTION_INTEGRATION_SECRET</code> environment variable</li>
        <li>Create a new page in your Notion workspace</li>
        <li>From the page, click "Share" and add your integration</li>
        <li>Copy the page URL and add it as the <code>NOTION_PAGE_URL</code> environment variable</li>
        <li>Restart the server and refresh this page</li>
      </ol>
    </div>
  );
  
  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Notion Integration</CardTitle>
          <CardDescription>Checking connection status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Notion Integration</CardTitle>
          <CardDescription>Connection Check Failed</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={checkStatus} className="mt-4">Retry</Button>
        </CardContent>
      </Card>
    );
  }
  
  if (!status?.connected) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Notion Integration</CardTitle>
          <CardDescription>Not connected to Notion</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Required</AlertTitle>
            <AlertDescription>
              The application could not connect to Notion. Please check your integration settings.
            </AlertDescription>
          </Alert>
          {renderSetupInstructions()}
        </CardContent>
        <CardFooter>
          <Button onClick={checkStatus} className="mr-2">Check Again</Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Notion Integration</CardTitle>
            <CardDescription>Manage your knowledge graph in Notion</CardDescription>
          </div>
          <Badge variant={status.connected ? "outline" : "destructive"} className="ml-2">
            {status.connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Database Status</h3>
          <div className="flex space-x-4">
            <div className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              <span>Nodes Database:</span>
              {status.databases.nodes ? 
                <CheckCircle className="h-5 w-5 text-green-500 ml-2" /> : 
                <AlertCircle className="h-5 w-5 text-yellow-500 ml-2" />
              }
            </div>
            <div className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              <span>Edges Database:</span>
              {status.databases.edges ? 
                <CheckCircle className="h-5 w-5 text-green-500 ml-2" /> : 
                <AlertCircle className="h-5 w-5 text-yellow-500 ml-2" />
              }
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="pull">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pull">Pull from Notion</TabsTrigger>
            <TabsTrigger value="push">Push to Notion</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pull" className="p-4 border rounded-md mt-2">
            <h3 className="font-medium mb-2">Import Data from Notion</h3>
            <p className="text-sm text-gray-500 mb-4">
              Pull your knowledge graph data from Notion into this application.
            </p>
            <div className="flex space-x-2">
              <Button 
                onClick={() => handleSync('pull')} 
                disabled={syncing || !status.databases.nodes}
              >
                {syncing ? 'Importing...' : 'Import All Nodes & Edges'}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="push" className="p-4 border rounded-md mt-2">
            <h3 className="font-medium mb-2">Export Data to Notion</h3>
            <p className="text-sm text-gray-500 mb-4">
              Push your local knowledge graph data to Notion.
            </p>
            <div className="flex space-x-2">
              <Button 
                onClick={() => handleSync('push')} 
                disabled={syncing || !status.databases.nodes}
              >
                {syncing ? 'Exporting...' : 'Export All Nodes & Edges'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        {syncResult && (
          <Alert className="mt-4">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Sync Successful</AlertTitle>
            <AlertDescription>
              {syncResult.exported && `Exported ${syncResult.exported.nodes} nodes and ${syncResult.exported.edges} edges.`}
              {syncResult.imported && `Imported ${syncResult.imported.nodes} nodes and ${syncResult.imported.edges} edges.`}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default NotionIntegration;