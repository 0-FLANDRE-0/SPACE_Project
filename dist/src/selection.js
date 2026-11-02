// Screen-space assistance is used only after an opaque body mesh is missed.
// It changes neither rendered diameter nor world collision/LOS radii.
export function assistedBodySelection(pointer,candidates,assistPixels=14) {
  return candidates.filter(c=>c.visible&&c.pixelRadius<assistPixels)
    .map(c=>({...c,pixelDistance:Math.hypot(c.x-pointer.x,c.y-pointer.y)}))
    .filter(c=>c.pixelDistance<=assistPixels)
    .sort((a,b)=>a.pixelDistance-b.pixelDistance||a.depth-b.depth||a.id.localeCompare(b.id))[0]?.id??null;
}
