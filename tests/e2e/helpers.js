/**
 * Fill a React-controlled date input by triggering synthetic events.
 * Playwright's fill() alone doesn't fire React's onChange for date inputs.
 */
export async function fillDateInput(locator, dateStr) {
  await locator.evaluate((el, value) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set
    nativeInputValueSetter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, dateStr)
}
