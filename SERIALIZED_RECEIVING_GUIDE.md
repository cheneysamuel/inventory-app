# Serialized Item Receiving - User Guide

## Overview
The enhanced "Receive Serialized Items" functionality allows users to efficiently receive multiple serialized inventory items with automatic serial number generation and batch processing.

## Setup

### Database Initialization
Before using this feature, run the following SQL in your Supabase database:

```sql
-- Initialize the currentSN config value
INSERT INTO public.config (key, value)
VALUES ('currentSN', '0')
ON CONFLICT (key) DO NOTHING;
```

This creates a config entry that tracks the last serial number sequence used.

## Features

### 1. Item Type Selection
- Select a serialized item type from the dropdown
- The system displays the units per package for the selected item
- Format: `[number] / Item`

### 2. Batch Count Entry
- Enter a numeric value (0-999) in the Batch Count field
- Only digits 0-9 are allowed
- When you tab out, the system automatically generates that many rows in the entry table

### 3. Auto-Generated Serial Numbers
Serial numbers follow the format: `[CMS-######]`

**Prefix Components:**
- **C** = First letter of Client name
- **M** = First letter of Market name  
- **S** = First letter of SLOC name

**Sequence Number:**
- 6-digit padded number (e.g., 000026)
- Auto-increments from the `currentSN` config value
- Example: If Client="Acme", Market="Boston", SLOC="Site1", sequence=26
  - Result: `ABS-000026`

### 4. Batch Entry Table

#### Columns:
1. **SN** - Auto-generated Tilson serial number (read-only)
2. **Mfgr. SN** - Manufacturer's serial number (editable)
3. **Units** - Quantity per item (editable on double-click)

#### Interaction:
- **Click Row**: Focuses on the Mfgr. SN field, cursor moves to end of text
- **Enter Mfgr. SN**: Type the manufacturer's serial number
- **Auto-Add Rows**: When you enter data in the last row, a new row is automatically created
- **Edit Units**: Double-click the Units value to edit it
- **Manual Entry**: You can manually add rows by typing in the last row

### 5. Receiving Items
1. Select item type
2. Enter batch count (or manually enter rows)
3. Fill in manufacturer serial numbers
4. Adjust units if needed (double-click)
5. Click "Receive Items"

The system will:
- Validate all entries
- Insert records into inventory
- Update the currentSN sequence
- Refresh the inventory display
- Show success/error notifications

## Validation Rules
- Item type must be selected
- At least one entry must have a manufacturer SN
- Empty rows (without Mfgr. SN) are ignored
- Units must be a positive number

## Status Assignment
All received items are automatically assigned the "In Stock" status.

## Context
Items are automatically associated with:
- Current Client (from context selector)
- Current Market (from context selector)
- Current SLOC (from context selector)

## Tips
- Use the batch count for quick entry of multiple identical items
- The auto-row feature lets you keep typing without clicking
- Double-click units to adjust quantities for individual items
- The table scrolls if you have many entries
- Serial numbers are generated in sequence and cannot be duplicated

## Troubleshooting

### "Config key not found" error
Run the initialization SQL script to create the `currentSN` config entry.

### Serial numbers not incrementing
Check that the `currentSN` value in the config table is being updated correctly.

### Cannot enter data in Mfgr. SN
Click the row first, then the input field should be focused automatically.

### Units not editable
Remember to **double-click** the units value to edit it.
