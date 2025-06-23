import { useState } from "react";

export default function EmergencyTest() {
  const [clickCount, setClickCount] = useState(0);

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'white', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>Emergency Test Page</h1>
      <p>If you can see this and interact with it, the basic React app is working.</p>
      
      <button 
        onClick={() => {
          setClickCount(prev => prev + 1);
          console.log("Button clicked!");
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
          margin: '10px 0'
        }}
      >
        Test Click (Clicked {clickCount} times)
      </button>

      <div style={{ marginTop: '20px' }}>
        <a href="/auth" style={{ color: '#007bff', textDecoration: 'underline' }}>
          Go to Auth Page
        </a>
        {' | '}
        <a href="/emergency-login" style={{ color: '#007bff', textDecoration: 'underline' }}>
          Emergency Login
        </a>
      </div>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
        <h3>Debug Info:</h3>
        <p>Current URL: {window.location.href}</p>
        <p>User Agent: {navigator.userAgent}</p>
        <p>Time: {new Date().toISOString()}</p>
      </div>
    </div>
  );
}