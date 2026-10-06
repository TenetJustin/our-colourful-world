export function requestGamePointerLock() {
  const canvas = document.querySelector('canvas')
  if (!canvas?.requestPointerLock) return
  try {
    const result = canvas.requestPointerLock() as Promise<void> | void
    if (result && typeof result.catch === 'function') void result.catch(() => undefined)
  } catch {
    // Pointer lock is optional; a later click on the scene can retry it.
  }
}
