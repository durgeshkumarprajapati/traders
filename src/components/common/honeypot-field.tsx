/**
 * Spam trap. Real visitors never see or reach it (visually hidden, hidden from assistive technology, not
 * focusable, autocomplete off); bots that fill every input reveal themselves. Checked on the server before validation.
 */
export function HoneypotField() {
  return (
    <div aria-hidden="true" className="sr-only">
      <label>
        Leave this field empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
