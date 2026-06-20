# Lane Planner Redesign - Implementation Plan

## Goal
Transform the lane planner from a sidebar-based layout to a modern dashboard-style interface that's more user-friendly and attention-grabbing.

## Current Structure (To Be Removed)
- Left sidebar (w-96) with all inputs and results
- Map takes remaining space
- Tabs appear in sidebar after calculation

## New Structure

### 1. Hero Input Bar (Top)
**Horizontal layout with all key inputs in one row:**
- Origin (text input + ZIP lookup)
- → Arrow visual separator
- Destination (text input + ZIP lookup)
- Start Date (date picker)
- Miles Per Day (range slider showing value)
- Calculate Button (prominent, gradient orange)

**Features:**
- Responsive: wraps on smaller screens
- Visual validation: green checkmark when location resolved
- Map click mode indicator: prominent banner when active
- Error display: inline banner with dismiss option

### 2. KPI Dashboard Cards (Shows after route calculated)
**4-column grid of metric cards:**
- Distance (blue) - total miles
- Duration (purple) - estimated days
- Est. Cost (orange) - total trip cost in $k format
- States (emerald) - count + abbreviated list

**Style:**
- White background with colored borders
- Icon in colored circular badge
- Hover effect: shadow elevation
- Large numbers (3xl font)
- Small labels (xs uppercase tracking-wide)

### 3. Main Content Grid (3 columns on lg screens)

#### Left Column (lg:col-span-3) - Shows after route calculated
**Load & Cost Settings Panel**
- Collapsible white card with shadow
- Scrollable overflow-y-auto
- Sections:
  1. Load Specifications
     - Grid: Height / Width / Weight inputs
     - Warning card if oversized
     - Pilot car requirements if needed
  2. Cost Calculator  
     - Fuel price / Truck MPG inputs
  3. Cost Breakdown Card
     - Gradient orange/amber background
     - Itemized costs
     - Bold total
  4. Edit Route Button
     - Purple theme
     - Active state shows instructions
  5. Disclaimer

#### Center Column (lg:col-span-6)
**Results Tabs Panel**
- Tab navigation at top (Route / Weather / Summary)
- Scrollable content area
- Tab content:
  1. **Route Tab**
     - Origin → Destination card
     - Distance/Days metric cards
     - Daily forecast cards with weather
     - Weigh stations list
     - Elevation profile + warnings
  2. **Weather Tab**
     - Weather forecast cards with severity colors
     - Precipitation/wind/temp details
  3. **Summary Tab**
     - Exportable JSON summary
     - Pilot car state breakdown
     - Complete trip details

#### Right Column (lg:col-span-3)
**Map Panel**
- Full height map container
- Overlay controls:
  - Map click mode buttons (origin/destination) - only before route
  - Route markers legend - only after route
  - Fullscreen hint when in selection mode
- Markers:
  - Green: Origin
  - Blue: Daily stops
  - Red: Destination
  - Orange: Weigh stations
  - Purple: Waypoints (edit mode)

### 4. Before Route Calculated
**Map takes full width (lg:col-span-12)**
- Hero bar at top
- Large map with click-to-set controls overlaid

## Visual Design Tokens

### Colors
- Primary CTA: Orange gradient (from-orange-600 to-orange-500)
- Distance metric: Blue (text-blue-600, border-blue-100, bg-blue-50)
- Duration metric: Purple (text-purple-600, border-purple-100)
- Cost metric: Orange (text-orange-600, border-orange-100)
- States metric: Emerald (text-emerald-600, border-emerald-100)
- Warning: Amber (bg-amber-50, border-amber-300)
- Severe warning: Red (bg-red-50, border-red-300)
- Success: Emerald (text-emerald-600)
- Error: Red (text-red-600)

###Shadows
- Card: shadow-sm
- Card hover: shadow-md
- Button: shadow-lg
- Button hover: shadow-xl

### Borders
- Default: border-slate-200
- Inputs: border-2 border-slate-300
- Focus: ring-2 ring-{color}-100

### Spacing
- Container padding: px-6 py-4
- Card padding: p-4
- Section gap: space-y-4
- Grid gap: gap-4

### Typography
- Page background: bg-slate-50
- Card background: bg-white
- Headings: font-bold text-slate-900
- Labels: font-semibold text-slate-700
- Body: text-slate-600
- Muted: text-slate-500

## Implementation Strategy

1. Replace opening divs and hero bar section
2. Add KPI cards section (conditional on route.length > 0)
3. Replace sidebar with three-column grid
4. Move map to right column
5. Add center column with tabs
6. Preserve all existing functionality (state, calculations, map interactions)
7. Test responsive behavior
8. Validate no TypeScript/compile errors

## Key Functionality to Preserve
- All useState hooks and state management
- Map initialization and interaction
- Route calculation logic
- Weather fetching
- Cost calculations
- Pilot car requirements
- Route editing with waypoints
- Export functionality
- ZIP code lookup
- Map click-to-set locations

## Mobile Considerations
- Hero bar wraps inputs vertically
- KPI cards stack 2-column on mobile, 4-column on lg
- Three-column grid stacks vertically on mobile
- Map gets reasonable min-height when stacked
