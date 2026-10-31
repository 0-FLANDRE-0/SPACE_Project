// v0.5E.1 moves authoring entry points into the real DEV drawer.
export async function openSurfaceTool(page,selector,touch=false){
 if(!await page.locator(selector).isVisible())await page.locator('#developer-tools').click();
 if(touch)await page.locator(selector).tap();else await page.locator(selector).click();
}
