# Custom Signage System Guide

The BookStud.io system now includes customizable signage displays that can be configured for specific studios or groups of studios using URL parameters.

## URLs

- **General Signage**: `/signage` - Shows all studios and bookings
- **Custom Signage**: `/signage/custom` - Customizable with URL parameters

## URL Parameters

### Studio Selection
- `studios=1,2,3` - Show only studios with IDs 1, 2, and 3
- If omitted, shows all studios

### Display Options
- `title=Studio%20A%20Display` - Custom title for the display (URL encoded)
- `weather=true|false` - Show weather widget (default: true)
- `alerts=true|false` - Show facility alerts (default: true)
- `weekly=true|false` - Show weekly overview (default: true)
- `refresh=120` - Auto-refresh interval in seconds (default: 120)

## How to Create New Signage Pages

There are two ways to create new signage pages:

### Method 1: URL Parameters (Recommended)
1. Use the `/signage/custom` route with URL parameters
2. Configure display settings through the URL
3. Examples:
   - `/signage/custom?studios=1,2&title=News%20Department`
   - `/signage/custom?studios=5,6,7&title=Sports%20Area&weather=false`

### Method 2: Create New Page Files (For Advanced Users)
1. Create new page file in `client/src/pages/` (e.g., `NewsSignagePage.tsx`)
2. Copy the structure from `CustomSignagePage.tsx`
3. Add hardcoded studio filtering logic
4. Add route to `client/src/App.tsx`

## Assigning Studios to Pages

### Via URL Parameters
Simply include the studio IDs in the `studios` parameter:
- Single studio: `?studios=1`
- Multiple studios: `?studios=1,2,3`
- All studios: Omit the `studios` parameter

### Finding Studio IDs
1. Log into the BookStud.io admin panel
2. Go to Settings → Studios
3. Note the ID numbers for each studio
4. Use these IDs in your URL parameters

## Example URLs

### Single Studio Display
```
/signage/custom?studios=1&title=Studio%20A&layout=compact&refresh=60
```
Shows only Studio A with compact layout, refreshing every minute.

### News Department Display
```
/signage/custom?studios=1,2,3&title=News%20Department&layout=grid&weather=true
```
Shows Studios 1, 2, and 3 in grid layout with weather.

### Production Area Display
```
/signage/custom?studios=4,5,6,7&title=Production%20Area&layout=list&alerts=true&refresh=300
```
Shows Studios 4-7 in list layout with alerts, refreshing every 5 minutes.

### Control Room Display (Alerts Only)
```
/signage/custom?title=Control%20Room%20Alerts&studios=&alerts=true&weather=false&weekly=false
```
Shows only facility alerts without studio-specific content.

## Layout Types

### Grid Layout (default)
- 4-column responsive grid
- Best for general viewing
- Shows full booking details

### List Layout
- Vertical list format
- Good for smaller displays
- More compact information

### Compact Layout
- 3-column grid with smaller cards
- Maximum information density
- Truncated descriptions

## Studio Status Indicators

- 🟢 **AVAILABLE** - Studio is free
- 🔴 **IN USE** - Studio currently has active booking
- Shows current booking title when in use

## Facility Alerts

Color-coded by severity:
- **Red**: Critical alerts
- **Orange**: High priority alerts
- **Yellow**: Medium priority alerts
- **Blue**: Low priority alerts

## Weather Integration

When enabled, displays:
- Current temperature and conditions
- Weather icon
- Location-based forecast

## Auto-refresh

- Automatically refreshes booking data every minute
- Page reloads completely at specified interval
- Shows last update time in footer

## Deployment Examples

### Conference Room TVs
Each conference room can have its own display showing only relevant studios:
```
Conference Room A: /signage/custom?studios=1,2&title=Conference%20Room%20A
Conference Room B: /signage/custom?studios=3,4&title=Conference%20Room%20B
```

### Department Displays
Different departments can see their studio groups:
```
News: /signage/custom?studios=1,2,3&title=News%20Department
Sports: /signage/custom?studios=4,5&title=Sports%20Department
Production: /signage/custom?studios=6,7,8,9&title=Production%20Studios
```

### Lobby Display
Main lobby can show everything with fast refresh:
```
/signage/custom?title=Main%20Lobby&refresh=60&layout=grid
```

### Engineering Display
Engineering can focus on alerts and system status:
```
/signage/custom?title=Engineering%20Monitor&alerts=true&layout=compact&refresh=30
```

## Technical Notes

- No authentication required - public access
- Responsive design works on various screen sizes
- Optimized for 1920x1080 displays
- Uses facility timezone automatically
- Real-time studio status calculation
- Booking conflicts detected automatically

## Tips for Implementation

1. **Test URLs** before deploying to displays
2. **Use URL encoding** for spaces in titles (`%20`)
3. **Shorter refresh intervals** for critical areas
4. **Compact layout** for smaller screens
5. **Hide unnecessary sections** to focus attention
6. **Document URLs** for each display location