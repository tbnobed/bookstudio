import { useState } from "react";

export default function ClickTest() {
  const [clicks, setClicks] = useState(0);

  return (
    <div 
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 10000,
        backgroundColor: 'red',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace'
      }}
    >
      <button 
        onClick={() => {
          setClicks(prev => prev + 1);
          console.log("Emergency test button clicked!");
        }}
        style={{
          backgroundColor: 'white',
          color: 'red',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Test {clicks}
      </button>
    </div>
  );
}