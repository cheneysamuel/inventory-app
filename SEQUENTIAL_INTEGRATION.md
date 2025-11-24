# Sequential Integration in Field Install Action

## Overview
Integrated sequential tracking into the Field Install action modal for serialized inventory items. This allows users to track cable sequential numbers (footage markers) while installing items.

## Features Implemented

### 1. Sequential History Display
- **Location**: Top of Field Install modal (for serialized items with existing sequentials)
- **Content**: Displays all historical sequential readings in a table
  - Sequential number
  - Recorded date/time
- **Styling**: Blue-themed box with scrollable list (max 150px height)

### 2. Dual Input Methods

#### Method A: Footage-First Entry
- User enters footage amount in the **Footage** field
- System automatically calculates estimated sequential:
  ```
  Estimated Sequential = Last Recorded Sequential - Footage
  ```
  (Sequentials decrease as footage is installed)
- Sequential input field is auto-populated with the estimate
- Tracks `inputMethod = 'footage'`

#### Method B: Sequential-First Entry
- User enters current sequential reading in the **Sequential** field
- System automatically calculates footage:
  ```
  Footage = Last Recorded Sequential - Current Sequential
  ```
  (Sequentials decrease as footage is installed)
- Footage input field is auto-updated
- Display shows "Installed: X ft" in green (or error in red if sequential increased)
- Tracks `inputMethod = 'sequential'`

### 3. Dynamic Calculations
- **Real-time updates**: As user types ANY character, calculations update immediately
- **Bidirectional sync**: Changes in either field update the other
- **Sequential behavior**: Sequentials DECREASE as footage is installed
  - Example: Last sequential = 12000, New sequential = 10000 → Installed = 2000 ft
- **Color coding**: 
  - Green text for valid footage installed
  - Red text if sequential increased (invalid scenario)

## Sequential Behavior

**Important**: Cable sequentials work BACKWARDS - they decrease as footage is installed.

### Example:
- **Last Sequential**: 12000 ft
- **New Sequential**: 10000 ft
- **Footage Installed**: 12000 - 10000 = **2000 ft**

### Calculations:
```javascript
// From Footage → Estimate Sequential
estimatedSequential = lastSequential - footage
// Example: 12000 - 2000 = 10000

// From Sequential → Calculate Footage
installedFootage = lastSequential - currentSequential
// Example: 12000 - 10000 = 2000
```

### 4. Sequential Recording

When Field Install action is executed:

```javascript
if (sequentialData[item.id] && sequentialData[item.id].currentSequential) {
    const seqData = sequentialData[item.id];
    const isVerified = seqData.inputMethod === 'sequential';
    
    await Queries.createSequential({
        inventory_id: item.id,
        sequential_number: seqData.currentSequential,
        notes: isVerified 
            ? 'Verified - manually entered during field install' 
            : 'Estimated - calculated from footage during field install'
    });
}
```

### 5. Verification Tracking
Sequential records include notes field to distinguish:
- **Verified**: "Verified - manually entered during field install"
  - User explicitly entered the sequential number
- **Estimated**: "Estimated - calculated from footage during field install"
  - System calculated from footage input

## UI Layout Changes

### For Serialized Items WITH Sequentials:
```
┌─────────────────────────────────────────┐
│ Sequential History                       │
│ ┌─────────────────────────────────────┐ │
│ │ Sequential | Recorded At            │ │
│ │ 1000       | 11/18/2024, 10:30 AM   │ │
│ │ 500        | 11/15/2024, 2:15 PM    │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Item | Location | Crew | Area | Quantity│
├─────────────────────────────────────────┤
│      |          |      |      | Footage:│
│      |          |      |      | [250]   │
│      |          |      |      | of 1000 │
│      |          |      |      |         │
│      |          |      |      |Sequential:|
│      |          |      |      | [1250]  │
│      |          |      |      |(Remaining: 250 ft)|
└─────────────────────────────────────────┘
```

### For Serialized Items WITHOUT Sequentials:
Standard layout - no sequential fields shown

### For Bulk Items:
Standard layout - no sequential fields shown

## Database Schema

Uses existing `sequentials` table:
```sql
CREATE TABLE public.sequentials (
    id integer PRIMARY KEY,
    inventory_id integer NOT NULL,
    sequential_number integer NOT NULL,
    recorded_at timestamp DEFAULT CURRENT_TIMESTAMP,
    notes text,  -- Used for verification status
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);
```

## Code Files Modified

1. **js/ui/views.js**
   - `showFieldInstallModal()` - Made async, fetches sequentials
   - `executeFieldInstallAction()` - Saves sequential records
   - Added sequential history display section
   - Added dual input fields with real-time calculation
   - Added input method tracking

2. **js/db/queries.js** (No changes needed)
   - Already exports `getSequentialsByInventory()`
   - Already exports `createSequential()`

## Usage Flow

1. User selects serialized item with "Field Install" action
2. Modal opens showing:
   - Sequential history (if exists)
   - Standard install fields (area, quantity)
   - **NEW**: Footage input
   - **NEW**: Sequential input
3. User enters EITHER:
   - Footage → Sequential auto-calculated
   - Sequential → Footage auto-calculated
4. User completes field install
5. System saves:
   - Inventory transaction
   - Sequential record with verification status

## Future Enhancements

Potential improvements:
- Add sequential validation (must be > last sequential)
- Show footage calculations between sequential readings
- Export sequential history to PDF
- Add sequential charts/graphs
- Support multiple sequential readings per install
- Add sequential alerts for unusual jumps

## Testing Checklist

- [ ] Open Field Install for serialized item with sequentials
- [ ] Verify sequential history displays correctly
- [ ] Enter footage, verify sequential calculates
- [ ] Enter sequential, verify footage calculates
- [ ] Complete install with footage method
- [ ] Verify "Estimated" sequential saved to database
- [ ] Complete install with sequential method
- [ ] Verify "Verified" sequential saved to database
- [ ] Test with serialized item WITHOUT sequentials
- [ ] Test with bulk items (no sequential fields shown)

## Notes

- Only single items show sequential tracking (not bulk installs)
- Sequential tracking requires inventory_type = 'Serialized'
- Decimal values supported (e.g., 125.5 ft)
- Historical sequentials ordered by recorded_at DESC
- Sequential input method tracked in memory (not persisted separately)
