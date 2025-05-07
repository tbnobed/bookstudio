import { useEffect, useState } from 'react';
import { FACILITY_TIMEZONE } from '@/lib/dateUtils';
import { InfoIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function TimezoneDisplay() {
  const [userTimezone, setUserTimezone] = useState<string>('');
  const [timezoneDiff, setTimezoneDiff] = useState<number>(0);

  useEffect(() => {
    // Get the user's local timezone
    const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(localTimezone);
    
    // Calculate the time difference between user timezone and facility timezone
    const now = new Date();
    const userOffset = now.getTimezoneOffset();
    
    // Get the facility timezone offset
    const facilityTime = new Date(now.toLocaleString('en-US', { timeZone: FACILITY_TIMEZONE }));
    const facilityOffset = (facilityTime.getTime() - now.getTime()) / (60 * 1000) + userOffset;
    
    // Convert to hours
    setTimezoneDiff(Math.round(facilityOffset / 60));
  }, []);

  if (!userTimezone) {
    return null;
  }
  
  // Only show if user is not in facility timezone
  if (userTimezone === FACILITY_TIMEZONE) {
    return (
      <Badge variant="outline" className="ml-2 bg-green-50">
        {formatTimezone(FACILITY_TIMEZONE)}
      </Badge>
    );
  }

  const diffText = timezoneDiff > 0 
    ? `${timezoneDiff} hours ahead of your time` 
    : `${Math.abs(timezoneDiff)} hours behind your time`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="cursor-help ml-2 bg-yellow-50 hover:bg-yellow-100">
            <InfoIcon className="h-3 w-3 mr-1" />
            {formatTimezone(FACILITY_TIMEZONE)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p><strong>All times are shown in {formatTimezone(FACILITY_TIMEZONE)}</strong></p>
            <p>Your local timezone is {formatTimezone(userTimezone)}</p>
            <p>{FACILITY_TIMEZONE} is {diffText}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatTimezone(timezone: string): string {
  // Convert "America/Chicago" to a more readable "America/Chicago (CST)"
  try {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      timeZoneName: 'short'
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    const shortTz = tzPart ? tzPart.value : '';
    
    // Make the timezone name more user-friendly
    const parts2 = timezone.split('/');
    const location = parts2[parts2.length - 1].replace(/_/g, ' ');
    
    return `${location} (${shortTz})`;
  } catch (e) {
    return timezone;
  }
}