# TODO - Excel Upload Refactor (Admin)

## Step 1
- [ ] Add `dragActive` state and implement drag/drop handlers on the drop zone.

## Step 2
- [ ] Extract Excel parsing/import logic from `handleFileUpload()` into `processExcelFile(file: File): Promise<void>`.

## Step 3
- [ ] Refactor `handleFileUpload(e)` to only extract `file` from `e.target.files` and call `processExcelFile(file)`.

## Step 4
- [ ] Replace drag-and-drop synthetic/fake ChangeEvent creation with direct `processExcelFile(file)`.

## Step 5
- [ ] Improve TypeScript strict-mode safety in FileReader callback (no unsafe assertions, no synthetic events).

## Step 6
- [ ] Prevent uploads while `loading` is true; ensure file input reset remains.

## Step 7
- [ ] Verify build/typecheck via `npm run build` or available script.

