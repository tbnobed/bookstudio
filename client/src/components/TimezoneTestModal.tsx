import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  testTimezoneHandling, 
  FACILITY_TIMEZONE,
  createFacilityDate,
  formatTime,
  formatDate,
  formatDateTimeRange,
  isSameDay,
  addDays,
} from "@/lib/dateUtils";

interface TimezoneTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TimezoneTestModal({ isOpen, onClose }: TimezoneTestModalProps) {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [userTimezone, setUserTimezone] = useState<string>("");
  const [testsPassed, setTestsPassed] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      // Reset the test results when the modal opens
      setTestResults([]);
      setTestsPassed(true);
      
      // Capture console.log outputs to display in modal
      const originalConsoleLog = console.log;
      const logs: string[] = [];

      console.log = (...args) => {
        originalConsoleLog(...args);
        
        // Filter out only timezone test logs
        if (typeof args[0] === 'string' && 
            (args[0].includes('TIMEZONE') || 
             args[0].includes('timezone') || 
             args[0].includes('This date in') ||
             args[0].includes('Day comparison'))) {
          logs.push(args.join(' '));
          
          // Check if any tests failed
          if (args.includes('FAILED')) {
            setTestsPassed(false);
          }
        }
      };

      // Set user timezone
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);

      // Run the tests
      testTimezoneHandling();

      // Set the results
      setTestResults(logs);

      // Restore original console.log
      console.log = originalConsoleLog;
    }
  }, [isOpen]);

  // Generate example test cases to display in the modal
  const generateExampleTests = () => {
    const now = new Date();
    const testCases = [];
    
    // Test case 1: Current date in facility timezone
    const facilityDate = createFacilityDate(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      12, 0, 0
    );
    
    testCases.push({
      name: "Noon today in facility timezone (Dallas)",
      date: facilityDate,
      formattedDate: formatDateTimeRange(facilityDate, facilityDate)
    });
    
    // Test case 2: Late night case
    const lateNight = createFacilityDate(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23, 30, 0
    );
    
    testCases.push({
      name: "Late night today in facility timezone (11:30 PM in Dallas)",
      date: lateNight,
      formattedDate: formatDateTimeRange(lateNight, lateNight)
    });
    
    // Test case 3: Day boundary test
    const nextDayEarly = createFacilityDate(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 30, 0
    );
    
    testCases.push({
      name: "Early morning tomorrow in facility timezone (12:30 AM in Dallas)",
      date: nextDayEarly,
      formattedDate: formatDateTimeRange(nextDayEarly, nextDayEarly),
      sameDayTest: isSameDay(lateNight, nextDayEarly) ? "FAILED" : "PASSED"
    });
    
    return testCases;
  };
  
  const exampleTests = generateExampleTests();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Timezone Handling Test Results 
            {testsPassed ? 
              <span className="ml-2 text-green-500">✓ PASSED</span> : 
              <span className="ml-2 text-red-500">✗ FAILED</span>
            }
          </DialogTitle>
          <DialogDescription>
            Testing how the application handles dates and times across different timezones
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 max-h-96 overflow-y-auto mt-4">
          <div className="flex space-x-6 text-sm border-b pb-3">
            <div>
              <p className="font-semibold">Facility Timezone:</p>
              <p className="text-primary">{FACILITY_TIMEZONE}</p>
            </div>
            <div>
              <p className="font-semibold">Your Local Timezone:</p>
              <p className="text-primary">{userTimezone}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="font-semibold">Test Cases:</h3>
            
            <div className="bg-gray-50 p-3 rounded-md space-y-3">
              {exampleTests.map((test, index) => (
                <div key={index} className="border-b pb-2 last:border-b-0 last:pb-0">
                  <p className="font-medium">{test.name}</p>
                  <p className="text-sm text-gray-600">ISO time: <span className="font-mono text-xs">{test.date.toISOString()}</span></p>
                  <p className="text-sm text-gray-600">Display format: <span className="font-medium text-primary">{test.formattedDate}</span></p>
                  {test.sameDayTest && (
                    <p className="text-sm">
                      Day comparison test: <span className={test.sameDayTest === "PASSED" ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                        {test.sameDayTest}
                      </span>
                    </p>
                  )}
                </div>
              ))}
            </div>
            
            <div>
              <h3 className="font-semibold mt-3 mb-2">Technical Test Results:</h3>
              <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                {testResults.length > 0 ? (
                  testResults.map((log, i) => (
                    <div key={i} className={log.includes('FAILED') ? 'text-red-500' : log.includes('PASSED') ? 'text-green-500' : ''}>
                      {log}
                    </div>
                  ))
                ) : (
                  <p>No test results available</p>
                )}
              </pre>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TimezoneTestModal;