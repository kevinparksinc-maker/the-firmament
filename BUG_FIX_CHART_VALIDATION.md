# Bug Fix: Chart Calculation Hour/Minute Validation

## Issue
Chart calculation was failing with `Invalid input: expected number, received undefined` when submitting the birth chart form. The `hour` and `minute` fields were being sent as `NaN` to the server, failing Zod schema validation.

## Root Cause
**File**: `BirthDataForm.tsx` and `TransitDataForm.tsx`

The form had no client-side validation for `hour` and `minute` fields before sending the request:
- User could clear the time fields, leaving them empty strings
- `parseInt("")` returns `NaN`
- `NaN` was sent in the payload to the server
- Zod schema expected `number` types, not `NaN`
- Server rejected the request with a cryptic validation error

Example:
```typescript
// BEFORE (buggy)
const h = parseInt(hour);  // "" → NaN
const min = parseInt(minute);  // "" → NaN

const result = await calcMutation.mutateAsync({
  hour: h,  // NaN (fails Zod validation)
  minute: min,  // NaN (fails Zod validation)
  // ...
});
```

## Server Schema (Confirmed)
```typescript
// server/routers.ts
const ephemerisRouter = router({
  calculate: publicProcedure
    .input(
      z.object({
        hour: z.number().min(0).max(23),
        minute: z.number().min(0).max(59),
        // ...
      })
    )
    // ...
});
```

The schema explicitly expects `number` types, not `NaN` or `undefined`.

---

## Solution

### 1. **Client-Side Input Validation** (Added)
Both forms now validate `hour` and `minute` before sending:

```typescript
if (isNaN(h) || isNaN(min)) {
  setError("Enter a valid birth time (hour 0–23, minute 0–59).");
  return;
}
if (h < 0 || h > 23) {
  setError("Hour must be between 0 and 23.");
  return;
}
if (min < 0 || min > 59) {
  setError("Minute must be between 0 and 59.");
  return;
}
```

### 2. **Input Field Constraints** (Improved)
Time input fields now:
- Clamp values to valid ranges as the user types
- Reset to sensible defaults when field is blurred while empty
- Prevent negative values

**BirthDataForm** defaults: `hour="12"`, `minute="0"`
**TransitDataForm** defaults: current UTC time (from `getNow()`)

```typescript
onChange={e => {
  const val = e.target.value;
  if (val === "" || val === "-") {
    setHour("");  // Allow clearing temporarily
  } else {
    const num = parseInt(val);
    if (!isNaN(num)) {
      setHour(Math.max(0, Math.min(23, num)).toString());  // Clamp to 0-23
    }
  }
}}
onBlur={() => {
  // Reset to default if left empty
  if (hour === "") {
    setHour("12");  // or "0" for TransitDataForm
  }
}}
```

### 3. **Payload Logging** (Added for Debugging)
Both forms now log the outgoing payload before the request:

```typescript
const payload = {
  year: y,
  month: m,
  day: d,
  hour: h,
  minute: min,
  latitude: la,
  longitude: lo,
  altitude: 0,
};
console.log("[BirthDataForm] Sending calculate-chart payload:", payload);
```

Check browser console (F12 → Console tab) to verify the payload has valid numbers:
```
[BirthDataForm] Sending calculate-chart payload: {
  year: 1986,
  month: 11,
  day: 20,
  hour: 14,
  minute: 30,
  latitude: 32.7767,
  longitude: -96.797,
  altitude: 0
}
```

### 4. **Error Logging** (Added)
Both forms now log calculation errors to console for better debugging:

```typescript
catch (err: any) {
  setError(err.message ?? "Calculation failed. Check your inputs.");
  console.error("[BirthDataForm] Calculation error:", err);
}
```

---

## Files Modified

1. **`client/src/components/BirthDataForm.tsx`**
   - Added validation for `hour` and `minute`
   - Improved time input field behavior (clamping, defaults on blur)
   - Added payload logging before request
   - Added error logging

2. **`client/src/components/TransitDataForm.tsx`**
   - Same fixes as BirthDataForm
   - Defaults to current UTC time instead of fixed "12:00"

---

## Testing the Fix

### Test Case 1: Clear Time Fields
1. Open the chart form
2. Clear the `Hour` field (leave it empty)
3. Click "Cast Natal Chart" or equivalent
4. **Expected**: User sees error: `"Enter a valid birth time (hour 0–23, minute 0–59)."`
5. **Previous behavior**: Raw Zod validation error sent to user

### Test Case 2: Invalid Time Values
1. Enter `Hour: 25` (out of range)
2. Click "Cast Natal Chart"
3. **Expected**: User sees error: `"Hour must be between 0 and 23."`
4. **Input field behavior**: Value is clamped to `23` as you type

### Test Case 3: Valid Submission
1. Fill all required fields (date, time, location)
2. Open browser console (F12)
3. Click "Cast Natal Chart"
4. **Expected**: 
   - Console shows: `[BirthDataForm] Sending calculate-chart payload: { ... }`
   - Payload has valid numbers: `hour: 14`, `minute: 30` (not `NaN`)
   - Chart calculates successfully

### Test Case 4: Edge Cases
- `Hour: -1` → Clamped to `0`
- `Hour: 30` → Clamped to `23`
- `Minute: 999` → Clamped to `59`
- User clicks "USE NOW" (TransitDataForm) → Auto-fills with current UTC time

---

## Why This Fixes the Bug

**Before**: Empty time fields → `NaN` → Sent to server → Zod rejects with generic error
**After**: Empty time fields → Validation catches it → User sees clear error message → Payload never sent with invalid data

The fix operates at multiple layers:
1. **Input constraints**: Prevent invalid values from ever existing in state
2. **Form validation**: Check values before sending
3. **User feedback**: Clear, specific error messages
4. **Debugging**: Console logs show exactly what's being sent

---

## Related Zod Schema
If the server schema ever changes, ensure the client validation matches:

```typescript
// MUST MATCH server schema
hour: z.number().min(0).max(23)     // Client: 0-23, reject NaN
minute: z.number().min(0).max(59)   // Client: 0-59, reject NaN
```
