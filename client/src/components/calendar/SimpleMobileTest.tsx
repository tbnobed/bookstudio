import { Button } from "@/components/ui/button";

export default function SimpleMobileTest() {
  const handleClick = () => {
    console.log("Button clicked successfully!");
    alert("Mobile interface is working!");
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Mobile Test Interface</h1>
      
      <div className="space-y-4">
        <Button 
          onClick={handleClick}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
        >
          Test Click - This Should Work
        </Button>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Instructions:</h2>
          <p className="text-sm">
            If this button works, the mobile interface is functional. 
            The main issue is likely authentication-related.
          </p>
        </div>
      </div>
    </div>
  );
}