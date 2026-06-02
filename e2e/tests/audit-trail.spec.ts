import { test, expect, Page } from '@playwright/test';

/**
 * Full demo flow, exercised through the real UI:
 *   create -> edit -> delete -> (audit trail shows Insert/Update/Delete) -> restore.
 * Every step is verified against what the audit trail records. Confirmations are the
 * app's own styled dialogs (not native browser confirms).
 */

const incidentsRow = 'table.grid tbody tr';

function rowWithText(page: Page, text: string) {
  return page.locator(incidentsRow, { hasText: text });
}

test.describe('Audit trail end-to-end', () => {
  test('a CRUD lifecycle is fully audited and a delete can be restored', async ({ page }) => {
    const title = `E2E incident ${Date.now()}`;

    // ---- CREATE -------------------------------------------------------------
    await page.goto('/accidents');
    await page.getByRole('button', { name: 'New incident' }).click();
    await page.locator('input[name="title"]').fill(title);
    await page.locator('select[name="severity"]').selectOption('Low');
    await page.locator('input[name="location"]').fill('E2E Zone');
    await page.locator('select[name="status"]').selectOption('Open');
    await page.getByRole('button', { name: 'Log incident' }).click();

    const row = rowWithText(page, title);
    await expect(row).toHaveCount(1);
    const reference = (await row.locator('td.num').first().innerText()).trim();
    expect(reference).toMatch(/^ACC-\d+$/);

    // ---- EDIT (Low -> Critical) --------------------------------------------
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.locator('select[name="severity"]').selectOption('Critical');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(rowWithText(page, title)).toContainText('Critical');

    // ---- DELETE (soft, via the styled confirm dialog) -----------------------
    await rowWithText(page, title).getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete incident' }).click();
    await expect(rowWithText(page, title)).toHaveCount(0);

    // ---- AUDIT TRAIL: Insert + Update + Delete all recorded -----------------
    await page.getByRole('link', { name: 'Audit Trail' }).click();
    const auditRows = page.locator('table.grid tbody tr');
    const forRef = (action: string) =>
      auditRows.filter({ hasText: reference }).filter({ has: page.locator(`span.act-${action}`) });

    // Insert and Delete render the full snapshot, so the reference code is in their text.
    await expect(forRef('Insert').first()).toBeVisible();
    const deleteRow = forRef('Delete').first();
    await expect(deleteRow).toBeVisible();

    // The Update collapses unchanged fields, so the reference code is NOT in its text.
    // Identify it by the severity transition we made (Low -> Critical), unique to this record.
    const updateRow = auditRows
      .filter({ has: page.locator('span.act-Update') })
      .filter({ hasText: 'Low' })
      .filter({ hasText: 'Critical' });
    await expect(updateRow.first()).toBeVisible();

    // ---- RESTORE (via the styled confirm dialog) ----------------------------
    await deleteRow.getByRole('button', { name: 'Restore', exact: true }).click();
    await page.getByRole('button', { name: 'Restore record' }).click();
    await expect(forRef('Restore').first()).toBeVisible();

    // ---- BACK ON INCIDENTS: the record is live again ------------------------
    await page.getByRole('link', { name: 'Incidents' }).click();
    await expect(rowWithText(page, title)).toHaveCount(1);
  });

  test('the audit trail loads and shows the seeded entries', async ({ page }) => {
    await page.goto('/audit-trail');
    await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    // The seed runs a full lifecycle, so Insert / Update / Delete are all present.
    await expect(page.locator('span.act-Insert').first()).toBeVisible();
    await expect(page.locator('span.act-Update').first()).toBeVisible();
    await expect(page.locator('span.act-Delete').first()).toBeVisible();
  });
});
